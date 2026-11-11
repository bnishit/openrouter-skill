import type { OpenRouterChatResponse, OpenRouterUsage } from "./parse-openrouter-response";
import { getAssistantText } from "./parse-openrouter-response";

export type OpenRouterImageSsePayload = {
  type: "image_generation.partial" | "image_generation.completed";
  b64_json?: string;
  media_type?: string;
  index?: number;
  usage?: OpenRouterUsage;
};

export type OpenRouterSseEvent<T = OpenRouterChatResponse> = {
  type: "message" | "done";
  data: T | null;
  raw: string;
};

function parseSseFrame<T>(frame: string): OpenRouterSseEvent<T> | null {
  const lines = frame
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith(":"));

  if (lines.length === 0) return null;

  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!data) return null;
  if (data === "[DONE]") {
    return { type: "done", data: null, raw: frame };
  }

  const payload = JSON.parse(data);
  const error = payload.error || (payload.type === "response.failed" ? payload.response?.error : null);
  if (error || payload.type === "error") {
    throw new Error(typeof error === "string" ? error : error?.message || payload.message || "OpenRouter stream failed");
  }
  return {
    type: "message",
    data: payload as T,
    raw: frame,
  };
}

export async function* parseOpenRouterSse<T = OpenRouterChatResponse>(
  response: Response
): AsyncGenerator<OpenRouterSseEvent<T>> {
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error?.message || `OpenRouter request failed with status ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Response body is missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Accept LF and CRLF even when a network chunk splits a CRLF pair.
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";
      if (done && buffer.trim()) frames.push(buffer);
      for (const frame of frames) {
        const event = parseSseFrame<T>(frame);
        if (event) {
          yield event;
          if (event.type === "done") return;
        }
      }
      if (done) break;
    }
  } finally {
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}

export async function collectImageStream(response: Response) {
  const images = new Map<number, string>();
  let usage: OpenRouterUsage | null = null;

  for await (const event of parseOpenRouterSse<OpenRouterImageSsePayload>(response)) {
    if (event.type !== "message" || !event.data) continue;
    const index = event.data.index ?? 0;
    if (event.data.b64_json) {
      images.set(
        index,
        `data:${event.data.media_type || "image/png"};base64,${event.data.b64_json}`
      );
    }
    if (event.data.usage) usage = event.data.usage;
  }

  return {
    images: [...images.entries()].sort(([a], [b]) => a - b).map(([, value]) => value),
    usage,
  };
}

export async function collectStreamText(response: Response): Promise<string> {
  let text = "";
  for await (const event of parseOpenRouterSse(response)) {
    if (event.type === "message" && event.data) {
      text += getAssistantText(event.data);
    }
  }
  return text;
}
