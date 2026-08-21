import assert from "node:assert/strict";
import test from "node:test";
import { extractGeneratedImageAssets } from "../shared/openrouter-generated-image-assets.ts";
import { collectImageStream } from "../shared/stream-openrouter-sse.ts";

test("image SSE collection keeps the latest preview and terminal usage", async () => {
  const frames = [
    { type: "image_generation.partial", index: 0, media_type: "image/png", b64_json: "cGFydGlhbA==" },
    {
      type: "image_generation.completed",
      index: 0,
      media_type: "image/png",
      b64_json: "ZmluYWw=",
      usage: { cost: 0.02 },
    },
  ];
  const body = `${frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("")}data: [DONE]\n\n`;
  const result = await collectImageStream(new Response(body));

  assert.deepEqual(result.images, ["data:image/png;base64,ZmluYWw="]);
  assert.equal(result.usage?.cost, 0.02);
});

test("dedicated image assets retain requested-model provenance", () => {
  const assets = extractGeneratedImageAssets(
    { data: [{ b64_json: "ZmluYWw=", media_type: "image/png" }] },
    {
      requestedModel: "google/gemini-3.1-flash-image",
      generationId: "request-123",
      purpose: "icon",
    }
  );

  assert.equal(assets[0].model, "google/gemini-3.1-flash-image");
  assert.equal(assets[0].generationId, "request-123");
});
