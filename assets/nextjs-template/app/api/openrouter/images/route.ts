import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ImageRequest = {
  model?: string;
  prompt?: string;
  aspect_ratio?: string;
  resolution?: string;
  size?: string;
  quality?: string;
  output_format?: string;
  output_compression?: number;
  background?: string;
  n?: number;
  seed?: number;
  provider?: unknown;
  input_references?: Array<{
    type: "image_url";
    image_url: { url: string };
  }>;
  stream?: boolean;
};

function validateInputReferences(references: ImageRequest["input_references"]) {
  if (!references) return null;
  if (!Array.isArray(references) || references.length > 16) {
    return "input_references must contain at most 16 images";
  }
  const allowedHosts = new Set(
    (process.env.OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
  for (const reference of references) {
    const value = reference?.image_url?.url;
    if (reference?.type !== "image_url" || typeof value !== "string") {
      return "Each input reference must be an image_url item";
    }
    if (value.startsWith("data:image/")) continue;
    try {
      const url = new URL(value);
      if (
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        !allowedHosts.has(url.hostname.toLowerCase())
      ) {
        return "Remote input references must use an allowlisted host";
      }
    } catch {
      return "Input references must be image data URLs or valid HTTP(S) URLs";
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const body = (await request.json()) as ImageRequest;
    if (!body.model || !body.prompt?.trim()) {
      return NextResponse.json({ error: "model and prompt are required" }, { status: 400 });
    }
    const inputReferenceError = validateInputReferences(body.input_references);
    if (inputReferenceError) {
      return NextResponse.json({ error: inputReferenceError }, { status: 400 });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (process.env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    if (process.env.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;

    const upstream = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: body.model,
        prompt: body.prompt.trim(),
        ...(body.aspect_ratio ? { aspect_ratio: body.aspect_ratio } : {}),
        ...(body.resolution ? { resolution: body.resolution } : {}),
        ...(body.size ? { size: body.size } : {}),
        ...(body.quality ? { quality: body.quality } : {}),
        ...(body.output_format ? { output_format: body.output_format } : {}),
        ...(body.output_compression != null
          ? { output_compression: body.output_compression }
          : {}),
        ...(body.background ? { background: body.background } : {}),
        ...(body.n != null ? { n: body.n } : {}),
        ...(body.seed != null ? { seed: body.seed } : {}),
        ...(body.provider ? { provider: body.provider } : {}),
        ...(body.input_references ? { input_references: body.input_references } : {}),
        stream: body.stream ?? false,
      }),
    });

    if (body.stream) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    const json = await upstream.json();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: json?.error || `OpenRouter error ${upstream.status}` },
        { status: upstream.status }
      );
    }
    return NextResponse.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
