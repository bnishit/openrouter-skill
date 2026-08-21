# Discounts And Cost Controls

Use this playbook when a user wants the cheapest compatible model, sees a promotion, needs to drain a background queue, or asks why OpenRouter credits changed.

## Discount Discovery

Promotions belong to provider endpoints, not to a model id as a permanent property.

1. Fetch candidate models from `GET /api/v1/models`.
2. For each shortlisted model, fetch `GET /api/v1/models/:author/:slug/endpoints`.
3. Keep endpoints whose numeric `pricing.discount` is greater than `0` and less than `1`.
4. Use the prompt, completion, cache, reasoning, request, image, audio, and search prices returned by the API as the effective prices.

The catalog's top-level prices and endpoint prices already include current promotions. Never apply `pricing.discount` to those prices again.

The public discounted-model collection is useful for human browsing, but it is not an API contract. Do not scrape it in production. Use endpoint metadata, cache results briefly, and refresh before a purchase or rollout because promotions can change without notice.

## Compare A Real Workload

Price percentages alone do not predict the bill. Compare candidates using a representative workload:

```text
estimated cost =
  input tokens × prompt price
  + output tokens × completion price
  + reasoning tokens × internal-reasoning price
  + cache reads/writes at their own prices
  + fixed request, media, and search charges
```

- Use at least a small sample of real prompts and expected output lengths.
- Separate interactive traffic from background work.
- Include chunking, retries, fallbacks, and map/reduce calls in request counts.
- Use catalog math only to shortlist models. Once requests run, `usage.cost` and `GET /api/v1/generation?id=...` are the billing truth.
- Compare output quality, grounding, completion rate, latency, and cost before changing a production default.

## Safe Promotion Policy

- Pin a concrete model id for evaluated production behavior.
- Keep the promotion behind configuration so reverting does not require a code rewrite.
- Set provider constraints for required parameters, privacy, and maximum price before sorting by price.
- Log the requested model, resolved model, provider endpoint, discount, and final cost.
- Define a fallback that is compatible and affordable when the promoted endpoint disappears.
- Do not let a temporary discount silently unlock an unbounded backlog. Add a daily request or dollar cap.

## Batch Versus Synchronous Work

OpenRouter's Batch API is for non-interactive work that can complete within 24 hours:

- Submit with `POST /api/beta/batches`.
- Poll `GET /api/beta/batches/:id`.
- Results are available after terminal completion and are retained for 30 days.
- Batch commonly reduces token prices by 50%; web search stays at its normal price and caching varies.
- Keep endpoint and model keys before the inline `requests` array in the submission body.
- Treat `validating` as queued, not complete.

Batch currently supports text workflows across Chat Completions, Responses, Anthropic Messages, and embeddings. Do not assume a catalog `:batch` variant behaves like a normal synchronous model call.

## Service Tiers

`service_tier` is separate from a provider promotion:

- `flex`: lower cost, but higher latency and lower availability.
- `priority`: faster service at a higher price.

Record the tier actually served. Use `flex` for delay-tolerant work only; use ordinary or priority service for user-blocking flows.

## Key And Credit Diagnostics

`GET /api/v1/key` reports the current API key's limit, remaining key allowance, daily/weekly/monthly usage, BYOK usage, and expiry.

`GET /api/v1/credits` reports account-wide purchased credits and usage and requires a management key.

These scopes can disagree: a key may show remaining allowance while the account has no purchased credits left. During a billing incident:

1. Check account credits.
2. Check the key's cap and recent usage.
3. Group stored generations by task, model, provider, request id, and session id.
4. Reconcile exact generation costs before attributing any remaining gap.

## Latest Aliases And Promotions

`~author/family-latest` aliases automatically move to a newer concrete model. The response model reveals what actually served the request.

Use latest aliases for intentionally evergreen experiences. Use a concrete id for evaluations, billing comparisons, regulated workflows, and any rollout where a model change must be reviewed. A moving alias plus a temporary promotion creates two independent sources of behavior change.
