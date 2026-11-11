"use client";

import { useMemo, useRef, useState } from "react";
import { parseOpenRouterSse } from "../lib/openrouter/stream-openrouter-sse";
import { getAssistantText, getToolCalls } from "../lib/openrouter/parse-openrouter-response";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function OpenRouterStreamingChat({
  apiPath = "/api/openrouter/chat",
  model = "openai/gpt-4o-mini",
}: {
  apiPath?: string;
  model?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isStreaming, [input, isStreaming]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setDraft("");
    setError("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: true,
          messages: nextMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json?.error || `Request failed with ${response.status}`);
      }

      let assistantText = "";
      let sawToolCall = false;

      for await (const event of parseOpenRouterSse(response)) {
        if (event.type === "done") break;
        if (!event.data) continue;

        assistantText += getAssistantText(event.data);
        if (getToolCalls(event.data).length > 0) {
          sawToolCall = true;
        }
        setDraft(assistantText);
      }

      const finalText = assistantText || (sawToolCall ? "Tool call emitted. Continue the loop server-side or add a tool executor." : "");
      setMessages((current) => [...current, { role: "assistant", content: finalText }]);
      setDraft("");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setError("Request cancelled");
      } else {
        setError(error instanceof Error ? error.message : "Unknown streaming error");
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid #d0d7de", borderRadius: 12, padding: 12, minHeight: 280 }}>
        {messages.length === 0 && !draft && (
          <div style={{ color: "#666" }}>Start a chat to test SSE streaming through your OpenRouter proxy.</div>
        )}

        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>
              {message.role}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
          </div>
        ))}

        {draft && (
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>assistant</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{draft}</div>
          </div>
        )}
      </div>

      {error && <div style={{ color: "crimson" }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask something..."
          rows={4}
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #d0d7de" }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={sendMessage}
          disabled={!canSend}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d0d7de" }}
        >
          Send
        </button>
        <button
          type="button"
          onClick={stopStreaming}
          disabled={!isStreaming}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d0d7de" }}
        >
          Stop
        </button>
      </div>
    </div>
  );
}
