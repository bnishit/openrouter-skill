import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_MS = 60 * 60 * 1000;

type OpenRouterProvider = {
  slug?: string;
  name?: string;
  display_name?: string;
  status?: string;
  data_collection?: string;
  [key: string]: unknown;
};

let cache: { at: number; providers: OpenRouterProvider[] } | null = null;

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

export async function GET() {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    if (cache && Date.now() - cache.at < CACHE_MS) {
      return NextResponse.json({ providers: cache.providers, cached: true });
    }

    const res = await fetch("https://openrouter.ai/api/v1/providers", {
      headers: buildHeaders(),
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: OpenRouterProvider[]; error?: unknown };

    if (!res.ok) {
      return NextResponse.json(
        { error: json.error || `OpenRouter error ${res.status}` },
        { status: res.status }
      );
    }

    const providers = (json.data || []).sort((a, b) => {
      const left = a.display_name || a.name || a.slug || "";
      const right = b.display_name || b.name || b.slug || "";
      return left.localeCompare(right);
    });

    cache = { at: Date.now(), providers };
    return NextResponse.json({ providers, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, providers: [] }, { status: 500 });
  }
}
