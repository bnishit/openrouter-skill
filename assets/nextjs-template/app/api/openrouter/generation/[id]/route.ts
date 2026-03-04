import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function buildHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  };

  if (process.env.OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }

  if (process.env.OPENROUTER_APP_NAME) {
    headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;
  }

  return headers;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "generation id is required" }, { status: 400 });
    }

    const params = new URLSearchParams({ id });
    const res = await fetch(`https://openrouter.ai/api/v1/generation?${params.toString()}`, {
      headers: buildHeaders(),
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: unknown; error?: unknown };

    if (!res.ok) {
      return NextResponse.json(
        { error: json.error || `OpenRouter error ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json({
      generation: json.data || json,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
