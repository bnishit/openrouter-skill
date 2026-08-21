import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ author: string; slug: string }> }
) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }
    const { author, slug } = await context.params;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      Accept: "application/json",
    };
    if (process.env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    if (process.env.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;

    const upstream = await fetch(
      `https://openrouter.ai/api/v1/images/models/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`,
      { headers, next: { revalidate: 300 } }
    );
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
