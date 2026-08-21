import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function parseAllowedRemoteAssetHosts(value: string | undefined) {
  return new Set(
    (value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isRemoteHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowlistedRemoteAsset(value: string, allowedHosts: Set<string>) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function collectRemoteAssetViolations(
  input: unknown,
  allowedHosts: Set<string>,
  path = "messages",
  violations: string[] = []
): string[] {
  if (Array.isArray(input)) {
    input.forEach((value, index) => {
      collectRemoteAssetViolations(value, allowedHosts, `${path}[${index}]`, violations);
    });
    return violations;
  }

  if (!input || typeof input !== "object") {
    return violations;
  }

  const record = input as Record<string, unknown>;
  const imageUrl = (record.image_url as Record<string, unknown> | undefined)?.url;
  if (typeof imageUrl === "string" && isRemoteHttpUrl(imageUrl) && !isAllowlistedRemoteAsset(imageUrl, allowedHosts)) {
    violations.push(`${path}.image_url.url -> ${imageUrl}`);
  }

  const fileData = (record.file as Record<string, unknown> | undefined)?.file_data;
  if (typeof fileData === "string" && isRemoteHttpUrl(fileData) && !isAllowlistedRemoteAsset(fileData, allowedHosts)) {
    violations.push(`${path}.file.file_data -> ${fileData}`);
  }

  for (const [key, value] of Object.entries(record)) {
    collectRemoteAssetViolations(value, allowedHosts, `${path}.${key}`, violations);
  }

  return violations;
}

type ProxyBody = {
  model?: string;
  models?: string[];
  messages?: unknown[];
  modalities?: string[];
  image_config?: unknown;
  response_format?: unknown;
  reasoning?: unknown;
  service_tier?: "flex" | "priority" | "auto";
  session_id?: string;
  provider?: unknown;
  plugins?: unknown;
  tools?: unknown;
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const body = (await req.json()) as ProxyBody;

    if (!body.messages?.length) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    const allowedRemoteAssetHosts = parseAllowedRemoteAssetHosts(
      process.env.OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS
    );
    const remoteAssetViolations = collectRemoteAssetViolations(
      body.messages,
      allowedRemoteAssetHosts
    );

    if (remoteAssetViolations.length > 0) {
      return NextResponse.json(
        {
          error:
            "Remote asset URLs must be converted to data URLs server-side or come from an allowlisted host in OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS.",
          details: remoteAssetViolations,
        },
        { status: 400 }
      );
    }

    const payload = {
      model: body.model || "openai/gpt-4o-mini",
      ...(body.models?.length ? { models: body.models } : {}),
      messages: body.messages,
      ...(body.modalities?.length ? { modalities: body.modalities } : {}),
      ...(body.image_config ? { image_config: body.image_config } : {}),
      ...(body.response_format ? { response_format: body.response_format } : {}),
      ...(body.reasoning ? { reasoning: body.reasoning } : {}),
      ...(body.service_tier ? { service_tier: body.service_tier } : {}),
      ...(body.session_id ? { session_id: body.session_id } : {}),
      ...(body.provider ? { provider: body.provider } : {}),
      ...(body.plugins ? { plugins: body.plugins } : {}),
      ...(body.tools ? { tools: body.tools } : {}),
      ...(body.tool_choice ? { tool_choice: body.tool_choice } : {}),
      ...(typeof body.parallel_tool_calls === "boolean"
        ? { parallel_tool_calls: body.parallel_tool_calls }
        : {}),
      ...(typeof body.max_tokens === "number" ? { max_tokens: body.max_tokens } : {}),
      temperature: body.temperature ?? 0,
      stream: body.stream ?? false,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    };

    if (process.env.OPENROUTER_SITE_URL) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    }

    if (process.env.OPENROUTER_APP_NAME) {
      headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;
    }

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (payload.stream) {
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

    return NextResponse.json({
      id: json.id,
      model: json.model,
      choices: json.choices || [],
      usage: json.usage || null,
      data: json.data || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
