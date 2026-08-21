import assert from "node:assert/strict";
import test from "node:test";
import {
  findDiscountedModels,
  getUndiscountedPrice,
  isDiscountedPricing,
} from "../shared/openrouter-catalog-and-cost.ts";

test("discount guards accept only fractional numeric discounts", () => {
  assert.equal(isDiscountedPricing({ discount: 0.75 }), true);
  assert.equal(isDiscountedPricing({ discount: 0 }), false);
  assert.equal(isDiscountedPricing({ discount: -0.1 }), false);
  assert.equal(isDiscountedPricing({ discount: 1 }), false);
  assert.equal(isDiscountedPricing({}), false);
});

test("undiscounted price is derived from an already-discounted price", () => {
  assert.equal(getUndiscountedPrice("0.000000375", 0.75), 0.0000015);
  assert.equal(getUndiscountedPrice("0.000000375", 0), null);
  assert.equal(getUndiscountedPrice("not-a-price", 0.75), null);
});

test("discount discovery uses endpoint metadata and keeps effective prices", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    const isGemini = url.includes("google/gemini-3.7-flash");
    if (url.includes("missing/stale-model")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        data: {
          id: isGemini ? "google/gemini-3.7-flash" : "openai/example",
          endpoints: [
            {
              provider_name: isGemini ? "Google" : "OpenAI",
              pricing: {
                prompt: isGemini ? "0.000000375" : "0.000001",
                completion: isGemini ? "0.000001875" : "0.000002",
                discount: isGemini ? 0.75 : 0,
              },
            },
          ],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const result = await findDiscountedModels(
    ["google/gemini-3.7-flash", "missing/stale-model", "openai/example"],
    { apiKey: "test-key", fetchImpl },
    2
  );

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].modelId, "google/gemini-3.7-flash");
  assert.equal(result.results[0].maxDiscount, 0.75);
  assert.equal(result.results[0].endpoints[0].pricing?.prompt, "0.000000375");
  assert.deepEqual(result.errors, [
    { modelId: "missing/stale-model", message: "Not found" },
  ]);
});
