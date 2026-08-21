import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; data: unknown[] } | null = null;

export async function GET() {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return NextResponse.json({ data: cache.data, cached: true });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      Accept: "application/json",
    };
    if (process.env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    if (process.env.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;

    const upstream = await fetch("https://openrouter.ai/api/v1/images/models", {
      headers,
      cache: "no-store",
    });
    const json = await upstream.json();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: json?.error || `OpenRouter error ${upstream.status}` },
        { status: upstream.status }
      );
    }

    cache = { at: Date.now(), data: json.data || [] };
    return NextResponse.json({ data: cache.data, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, data: [] }, { status: 500 });
  }
}
