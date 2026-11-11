import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  streamingChat,
  speech,
  submitVideo,
  videoStatus,
  downloadVideo,
  embeddings,
  rerank,
} from "./workflows.ts";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
function mock(handler: (url: string, init: RequestInit) => Response) {
  return {
    apiKey: "synthetic-test-key",
    fetchImpl: (async (url, init) =>
      handler(String(url), init || {})) as typeof fetch,
  };
}

test("stream sample reads SSE text and retains its generation id", async () => {
  const client = mock((url, init) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(JSON.parse(String(init.body)).max_tokens, 128);
    return new Response(
      ': processing\n\ndata: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n',
      { headers: { "x-generation-id": "gen-fixture" } },
    );
  });
  assert.deepEqual(await streamingChat("fixture/model", "Hello", client), {
    text: "Hello",
    generationId: "gen-fixture",
  });
});

test("a 200 stream failure is not returned as successful sample text", async () => {
  const client = mock(
    () =>
      new Response('data: {"error":{"message":"Provider disconnected"}}\n\n'),
  );
  await assert.rejects(
    streamingChat("fixture/model", "Hello", client),
    /Provider disconnected/,
  );
});

test("speech consumes bytes rather than attempting JSON decoding", async () => {
  const client = mock((url, init) => {
    assert.equal(url, "https://openrouter.ai/api/v1/audio/speech");
    assert.equal(JSON.parse(String(init.body)).voice, "fixture-voice");
    return new Response(Uint8Array.of(73, 68, 51), {
      headers: { "content-type": "audio/mpeg", "x-generation-id": "gen-audio" },
    });
  });
  const result = await speech(
    "fixture/speech",
    "Hello",
    "fixture-voice",
    client,
  );
  assert.deepEqual(result.audio, Uint8Array.of(73, 68, 51));
  assert.equal(result.generationId, "gen-audio");
});

test("speech rejects HTTP errors, non-audio, and empty output", async () => {
  await assert.rejects(
    speech(
      "fixture/model",
      "Hello",
      "voice",
      mock(() => json({ error: { message: "No credits" } }, 402)),
    ),
    /No credits/,
  );
  await assert.rejects(
    speech(
      "fixture/model",
      "Hello",
      "voice",
      mock(() => json({ text: "wrong shape" })),
    ),
    /Expected audio/,
  );
  await assert.rejects(
    speech(
      "fixture/model",
      "Hello",
      "voice",
      mock(
        () => new Response(null, { headers: { "content-type": "audio/mpeg" } }),
      ),
    ),
    /no audio/,
  );
});

test("video resumes one id and ignores untrusted returned polling URLs", async () => {
  const calls: string[] = [];
  const client = mock((url, init) => {
    calls.push(url);
    assert.match(
      String((init.headers as Record<string, string>).Authorization),
      /^Bearer /,
    );
    if (init.method === "POST")
      return json(
        {
          id: "job/a",
          status: "pending",
          polling_url: "https://untrusted.invalid/steal",
        },
        202,
      );
    if (url.endsWith("content?index=0"))
      return new Response(Uint8Array.of(1, 2, 3));
    return json({
      id: "job/a",
      status: "completed",
      generation_id: "gen-video",
      unsigned_urls: ["https://untrusted.invalid/download"],
    });
  });
  const job = await submitVideo("fixture/video", "A paper boat", client);
  assert.equal((await videoStatus(job.id, client)).status, "completed");
  assert.deepEqual(await downloadVideo(job.id, client), Uint8Array.of(1, 2, 3));
  assert.deepEqual(calls, [
    "https://openrouter.ai/api/v1/videos",
    "https://openrouter.ai/api/v1/videos/job%2Fa",
    "https://openrouter.ai/api/v1/videos/job%2Fa/content?index=0",
  ]);
});

test("embeddings restore source order and carry model plus dimensions", async () => {
  const client = mock(() =>
    json({
      model: "fixture/embedding",
      data: [
        { index: 1, embedding: [0.2, 0.8] },
        { index: 0, embedding: [0.7, 0.3] },
      ],
      usage: { prompt_tokens: 8 },
    }),
  );
  const result = await embeddings(
    "fixture/embedding",
    ["Export", "Theme"],
    client,
  );
  assert.equal(result.dimensions, 2);
  assert.equal(result.model, "fixture/embedding");
  assert.deepEqual(result.vectors, [
    [0.7, 0.3],
    [0.2, 0.8],
  ]);
});

test("embeddings reject duplicate indexes and mixed dimensions", async () => {
  await assert.rejects(
    embeddings(
      "fixture/model",
      ["a", "b"],
      mock(() =>
        json({
          data: [
            { index: 0, embedding: [1] },
            { index: 0, embedding: [2] },
          ],
        }),
      ),
    ),
    /Invalid embedding/,
  );
  await assert.rejects(
    embeddings(
      "fixture/model",
      ["a", "b"],
      mock(() =>
        json({
          data: [
            { index: 0, embedding: [1] },
            { index: 1, embedding: [2, 3] },
          ],
        }),
      ),
    ),
    /Inconsistent embedding/,
  );
});

test("rerank results refer back to original candidate documents", async () => {
  const result = await rerank(
    "fixture/rerank",
    "export?",
    ["Theme", "Export"],
    mock(() =>
      json({
        results: [
          { index: 1, relevance_score: 0.9 },
          { index: 0, relevance_score: 0.1 },
        ],
      }),
    ),
  );
  assert.deepEqual(
    result.results.map((row) => row.document),
    ["Export", "Theme"],
  );
});

test("rerank rejects invalid or repeated candidate indexes", async () => {
  for (const results of [
    [{ index: 9, relevance_score: 1 }],
    [
      { index: 0, relevance_score: 1 },
      { index: 0, relevance_score: 0.5 },
    ],
  ]) {
    await assert.rejects(
      rerank(
        "fixture/rerank",
        "export?",
        ["Export"],
        mock(() => json({ results })),
      ),
      /Invalid rerank/,
    );
  }
});

test("CLI defaults to a dry-run and does not print a configured key", () => {
  const child = spawnSync(
    "npx",
    [
      "--yes",
      "tsx",
      "examples/run.ts",
      "speech",
      "--model",
      "fixture/speech",
      "--voice",
      "fixture-voice",
      "--text",
      "Export ready",
      "--out",
      "not-written.mp3",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        OPENROUTER_API_KEY: "synthetic-key-that-must-not-appear",
      },
    },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).mode, "dry-run");
  assert.ok(!child.stdout.includes("synthetic-key-that-must-not-appear"));
});

test("client dispatch never executes hosted or unknown tools locally", async () => {
  const { executeClientFunction } = await import("./client-tools.ts");
  let calls = 0;
  const handler = {
    parse: (x: unknown) => x,
    execute: async () => {
      calls++;
      return "ok";
    },
  };
  const registry = { "openrouter:shell": handler, app_lookup: handler };
  for (const call of [
    { id: "a", type: "openrouter:shell" },
    {
      id: "b",
      type: "function",
      function: { name: "openrouter:shell", arguments: "{}" },
    },
    {
      id: "c",
      type: "function",
      function: { name: "constructor", arguments: "{}" },
    },
    {
      id: "d",
      type: "function",
      function: { name: "not_registered", arguments: "{}" },
    },
  ])
    await assert.rejects(executeClientFunction(call, registry), /allowlisted/);
  assert.equal(calls, 0);
});

test("client dispatch validates before executing and preserves the tool-call id", async () => {
  const { executeClientFunction } = await import("./client-tools.ts");
  let calls = 0;
  const registry = {
    lookup: {
      parse(input: unknown) {
        if ((input as any)?.id !== "article-1")
          throw new Error("Invalid article id");
        return input;
      },
      async execute() {
        calls++;
        return { title: "Export CSV" };
      },
    },
  };
  await assert.rejects(
    executeClientFunction(
      {
        id: "call-bad",
        type: "function",
        function: { name: "lookup", arguments: '{"id":"bad"}' },
      },
      registry,
    ),
    /Invalid article/,
  );
  assert.equal(calls, 0);
  assert.deepEqual(
    await executeClientFunction(
      {
        id: "call-good",
        type: "function",
        function: { name: "lookup", arguments: '{"id":"article-1"}' },
      },
      registry,
    ),
    {
      role: "tool",
      tool_call_id: "call-good",
      content: '{"title":"Export CSV"}',
    },
  );
  assert.equal(calls, 1);
});

test("an existing speech output is rejected before a live request can be sent", async () => {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } =
    await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "openrouter-output-"));
  const output = join(directory, "voice.mp3");
  try {
    writeFileSync(output, "keep me");
    const result = spawnSync(
      "npx",
      [
        "--yes",
        "tsx",
        "examples/run.ts",
        "speech",
        "--live",
        "--model",
        "fixture/speech",
        "--voice",
        "fixture",
        "--text",
        "Hello",
        "--out",
        output,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, OPENROUTER_API_KEY: "synthetic-invalid-key" },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EEXIST/);
    assert.equal(readFileSync(output, "utf8"), "keep me");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
