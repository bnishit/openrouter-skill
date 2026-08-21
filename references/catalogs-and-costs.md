# Catalogs, Providers, And Costs

## Endpoints

- `GET https://openrouter.ai/api/v1/models`: full model catalog.
- `GET https://openrouter.ai/api/v1/models/count`: count with the same filters.
- `GET https://openrouter.ai/api/v1/model/:author/:slug`: one alias-aware model lookup.
- `GET https://openrouter.ai/api/v1/models/user`: caller-aware model catalog shaped by account and provider preferences.
- `GET https://openrouter.ai/api/v1/models/:author/:slug/endpoints`: provider endpoints, live prices, capabilities, and discounts.
- `GET https://openrouter.ai/api/v1/providers`: provider catalog for routing, ordering, privacy, and availability-aware UIs.
- `GET https://openrouter.ai/api/v1/generation?id=<generation_id>`: fetch one completed generation with cost and token accounting details.
- `GET https://openrouter.ai/api/v1/key`: current key allowance and recent usage.
- `GET https://openrouter.ai/api/v1/credits`: account-wide purchased and used credits; requires a management key.
- `GET https://openrouter.ai/api/v1/activity`: last 30 completed UTC days grouped by endpoint; requires a management key.

## Common Headers

Use:

```http
Authorization: Bearer <OPENROUTER_API_KEY>
Accept: application/json
HTTP-Referer: <your-site-url>
X-OpenRouter-Title: <your-app-name>
```

`HTTP-Referer` and `X-OpenRouter-Title` are especially useful when the request originates from a real app and you want leaderboard attribution or cleaner observability.

## Models

Use `/api/v1/models` when you need the broadest model list for search, filtering, and capability discovery.

Keep these fields:

- `id`
- `canonical_slug` and optional `alias_target`
- `name`
- `description`
- `context_length`
- `architecture.input_modalities`
- `architecture.output_modalities`
- `supported_parameters`
- `pricing`
- `default_parameters`, `reasoning`, `expiration_date`, and optional `benchmarks`
- `top_provider`

The catalog supports pagination, free-text search, modality and supported-parameter filters, context and price filters, author/provider/privacy filters, and server-side sorts for price, latency, throughput, popularity, recency, and selected benchmarks. Prefer these server-side controls to repeatedly downloading and sorting the full catalog.

Store `id`, not `name`.

## User Models

Use `/api/v1/models/user` when the app should respect the caller's configured provider choices and account-specific filtering. This is better than `/models` when the UI should only show models the current account can actually route to.

The user-model endpoint accepts pagination, not the full public-catalog filter set. Reject unsupported user-scope filters instead of forwarding them or implying that they were applied. For public catalog searches, cache by a canonical sorted query key, cap the cache size, and expire old entries.

## Providers

Use `/api/v1/providers` when you need a provider picker, provider status data, or routing-aware UI copy. This is the right place to build:

- provider filter chips
- privacy or logging preference toggles
- ordered provider fallback configuration
- pricing or max-price controls that are provider-sensitive

Prefer storing provider identifiers from the API instead of inventing your own provider enum.

## Free Models

There is no separate "free models list" endpoint to rely on in the skill. The robust approach is:

1. fetch `/api/v1/models`
2. treat pricing values as strings
3. keep models whose relevant price fields are zero-valued strings

Pragmatic filter:

```ts
const freeModels = models.filter((model) => {
  const pricing = model.pricing ?? {};
  return ["prompt", "completion", "request", "image"].every((key) => {
    const value = pricing[key];
    return value == null || value === "0";
  });
});
```

OpenRouter also documents shortcuts such as `openrouter/free`, but for searchable UIs and audits, filter the catalog directly.

## Discounted Endpoints

`/api/v1/models` does not expose a model-level discount flag. For shortlisted model ids, fetch the per-model endpoints route and keep endpoints with numeric `pricing.discount` between `0` and `1`.

Catalog and endpoint prices are already discounted. Do not apply the percentage again. Promotions have no guaranteed public expiry field, so cache briefly and re-check before rollout. Read `discounts-and-cost-controls.md` before changing a production default.

## Generation Lookup

When a completed generation matters for billing, analytics, or debugging, save the response `id` from the original completion and fetch it later:

```bash
curl -s "https://openrouter.ai/api/v1/generation?id=$GENERATION_ID" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Accept: application/json"
```

Fields worth logging when available:

- `id`
- `model`
- `provider_name`
- `tokens_prompt`
- `tokens_completion`
- `native_tokens_prompt`
- `native_tokens_completion`
- `total_cost`
- `created_at`
- `upstream_id`

Use the original completion response for fast inline UX, and `/generation` for delayed audit, billing inspection, or support workflows.

## Cost Handling Rules

- Persist the generation id whenever cost history matters.
- Treat pricing fields from catalog endpoints as strings and convert deliberately.
- Preserve `internal_reasoning`, cache read/write, audio, image, request, search, and conditional override prices; prompt and completion are not the whole bill.
- Treat per-request `usage.cost` as the fast path and `/generation` as the audit path.
- Log both normalized token counts and native token counts when comparing providers.
- Do not estimate price client-side when the exact generation record is available.

## Credit Scope

`/api/v1/key` describes the current key. `/api/v1/credits` describes the account and needs a management key. A key can report unused allowance while the account itself has no spendable credits, so billing diagnostics should check both.

Use `/api/v1/activity` to reconcile account spend by day, model, provider endpoint, and key hash. Keep management keys server-side and never expose this route directly to a browser.

## UI Suggestions

- Add a "Free" filter based on zero-priced catalog entries.
- Show provider badges separately from model ids.
- Expose a "View generation cost" action anywhere you surface past completions.
- Store recent generation ids alongside message history for later audit or support tooling.
