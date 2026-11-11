import assert from "node:assert/strict";
import test from "node:test";
import { collectStreamText, parseOpenRouterSse } from "../shared/stream-openrouter-sse.ts";

function chunked(body: string) {
  const bytes = new TextEncoder().encode(body);
  return new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  }));
}

for (const newline of ["\n", "\r\n"]) {
  test(`stream handles comments, split Unicode and ${JSON.stringify(newline)} framing`, async () => {
    const body = [": OPENROUTER PROCESSING", "", 'data: {"choices":[{"delta":{"content":"Hello 👋"}}]}', "", 'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"cost":0.01}}', "", "data: [DONE]", "", ""].join(newline);
    assert.equal(await collectStreamText(chunked(body)), "Hello 👋");
  });
}

test("stream rejects non-2xx JSON errors", async () => {
  await assert.rejects(collectStreamText(new Response('{"error":{"message":"Insufficient credits"}}', { status: 402 })), /Insufficient credits/);
});

for (const payload of [
  { error: { message: "Provider disconnected" } },
  { type: "response.failed", response: { error: { message: "Provider disconnected" } } },
  { type: "error", message: "Provider disconnected" },
]) {
  test(`stream rejects a 200 error: ${payload.type || "chat"}`, async () => {
    await assert.rejects(collectStreamText(new Response(`data: ${JSON.stringify(payload)}\n\n`)), /Provider disconnected/);
  });
}

test("DONE stops consumption and releases the response", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode("data: [DONE]\n\ndata: invalid\n\n")); },
    cancel() { cancelled = true; },
  }));
  const events = [];
  for await (const event of parseOpenRouterSse(response)) events.push(event.type);
  assert.deepEqual(events, ["done"]);
  assert.equal(cancelled, true);
  assert.equal(response.body?.locked, false);
});
