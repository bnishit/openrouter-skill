import { collectStreamText } from "../assets/shared/stream-openrouter-sse.ts";

// Server/CLI examples. Importing this module never sends a request.
export type Client = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};
const base = "https://openrouter.ai/api/v1";

function headers(client: Client) {
  if (!client.apiKey)
    throw new Error("OPENROUTER_API_KEY is required for live calls");
  return {
    Authorization: `Bearer ${client.apiKey}`,
    "Content-Type": "application/json",
    "X-OpenRouter-Title": "OpenRouter Skill Samples",
  };
}

async function request(path: string, client: Client, body?: unknown) {
  const response = await (client.fetchImpl || fetch)(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: headers(client),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: client.signal ?? AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const detail =
      typeof error?.error === "string" ? error.error : error?.error?.message;
    throw new Error(detail || `OpenRouter request failed (${response.status})`);
  }
  return response;
}

export async function streamingChat(
  model: string,
  prompt: string,
  client: Client,
) {
  const response = await request("/chat/completions", client, {
    model,
    messages: [{ role: "user", content: prompt }],
    stream: true,
    max_tokens: 128,
  });
  return {
    text: await collectStreamText(response),
    generationId: response.headers.get("x-generation-id"),
  };
}

export async function speech(
  model: string,
  text: string,
  voice: string,
  client: Client,
) {
  const response = await request("/audio/speech", client, {
    model,
    input: text,
    voice,
    response_format: "mp3",
  });
  if (!response.headers.get("content-type")?.startsWith("audio/"))
    throw new Error("Expected audio bytes");
  const audio = new Uint8Array(await response.arrayBuffer());
  if (!audio.length) throw new Error("Speech returned no audio");
  return {
    audio,
    contentType: response.headers.get("content-type"),
    generationId: response.headers.get("x-generation-id"),
  };
}

export async function submitVideo(
  model: string,
  prompt: string,
  client: Client,
) {
  const response = await request("/videos", client, { model, prompt });
  const job = await response.json();
  if (typeof job.id !== "string" || !job.id)
    throw new Error("Video submission did not return a job id");
  return { id: job.id, status: job.status };
}

export async function videoStatus(jobId: string, client: Client) {
  if (!jobId) throw new Error("Video job id is required");
  // Construct our own URL: never send the bearer token to a returned polling URL.
  return (await request(`/videos/${encodeURIComponent(jobId)}`, client)).json();
}

export async function downloadVideo(jobId: string, client: Client) {
  if (!jobId) throw new Error("Video job id is required");
  const response = await request(
    `/videos/${encodeURIComponent(jobId)}/content?index=0`,
    client,
  );
  return new Uint8Array(await response.arrayBuffer());
}

export async function embeddings(
  model: string,
  input: string[],
  client: Client,
) {
  const json = await (
    await request("/embeddings", client, {
      model,
      input,
      encoding_format: "float",
    })
  ).json();
  const ordered = [...(json.data || [])].sort((a, b) => a.index - b.index);
  if (
    ordered.length !== input.length ||
    ordered.some(
      (row, index) =>
        row.index !== index ||
        !Array.isArray(row.embedding) ||
        !row.embedding.length ||
        row.embedding.some(
          (n: unknown) => typeof n !== "number" || !Number.isFinite(n),
        ),
    )
  ) {
    throw new Error("Invalid embedding result indexes or vectors");
  }
  const dimensions = ordered[0]?.embedding.length ?? 0;
  if (!dimensions || ordered.some((row) => row.embedding.length !== dimensions))
    throw new Error("Inconsistent embedding dimensions");
  return {
    model: json.model || model,
    dimensions,
    vectors: ordered.map((row) => row.embedding),
    usage: json.usage,
  };
}

export async function rerank(
  model: string,
  query: string,
  documents: string[],
  client: Client,
) {
  const json = await (
    await request("/rerank", client, {
      model,
      query,
      documents,
      top_n: documents.length,
    })
  ).json();
  if (!Array.isArray(json.results))
    throw new Error("Rerank response is missing results");
  const seen = new Set<number>();
  const results: Array<{
    document: string;
    originalIndex: number;
    score: number;
  }> = json.results.map((row: { index: number; relevance_score: number }) => {
    if (
      !Number.isInteger(row.index) ||
      row.index < 0 ||
      row.index >= documents.length ||
      seen.has(row.index) ||
      !Number.isFinite(row.relevance_score)
    )
      throw new Error("Invalid rerank document index or score");
    seen.add(row.index);
    return {
      document: documents[row.index],
      originalIndex: row.index,
      score: row.relevance_score,
    };
  });
  return { results, usage: json.usage };
}
