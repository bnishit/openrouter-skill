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

OpenRouter's Batch API is for non-interactive work. `completion_window` accepts only `24h`; actual provider deadlines vary (Google AI Studio: 48 hours; Google Vertex: 96 hours):

- Submit with `POST /api/v1/batches`.
- Poll `GET /api/v1/batches/:id`.
- Wait for a terminal status; for `completed`, also wait until `results` is non-null. Requests and results expire 30 days after submission.
- Batch commonly reduces token prices by 50%; web search stays at its normal price and caching varies.
- Keep all batch metadata (`endpoint`, `model`, `provider`, `completion_window`, `callback_url`) before the inline `requests` array. Each request needs a unique `custom_id`; match results by that id, never array position.
- Treat `validating`, `in_progress`, and `finalizing` as unfinished. A `202` confirms storage, not successful validation. A completed batch can still have failed requests.

Batch currently supports text workflows across Chat Completions, Responses, Anthropic Messages, and embeddings. Do not assume a catalog `:batch` variant behaves like a normal synchronous model call.

## Service Tiers

`service_tier` is separate from a provider promotion:

- `flex`: lower cost, but higher latency and lower availability.
- `priority`: faster service at a higher price.

Record the tier actually served. Use `flex` for delay-tolerant work only; use ordinary or priority service for user-blocking flows.

## Budgets, Caching, And Credit Diagnostics

`GET /api/v1/key` reports the current key's limits, usage, `budgets`, and `effective_budget`. `GET /api/v1/credits` reports account-wide credits and needs a management key. A remaining key allowance is not account credit and is not the whole effective budget.

- Workspace budgets cap pooled spend over daily/weekly/monthly/lifetime intervals. Configured limits must decrease as intervals narrow: lifetime > monthly > weekly > daily. Limits reset in UTC. Decide whether BYOK spend counts.
- Add a per-key limit for shared agent/CI keys, including BYOK when required. Workspace-owned keys have no human creator: a per-member policy alone does not cap them.
- Budget policies, model/provider policies, and moderation policies are separate. Workspace-wide policies cannot be loosened by a member/key policy. Inspect effective assignments instead of inferring enforcement from one saved guardrail.
- Legacy guardrails still work. Editing a migrated policy can transfer control away from its legacy guardrail for that policy type; check `managed_by` and `legacy_policy_types`. Do not manage the same setting through both APIs.
- During a billing incident, check account credits, effective budgets/key caps, and exact generation costs before attributing the difference. Budget enforcement is a service control, not a substitute for your queue's own bounded work/retry policy.

[Workspace budgets](https://openrouter.ai/docs/guides/features/workspaces/workspace-budgets.md), [shared keys](https://openrouter.ai/docs/guides/best-practices/capping-shared-agent-keys.md), [policies](https://openrouter.ai/docs/guides/features/guardrails/policies.md), [migration](https://openrouter.ai/docs/guides/features/guardrails/policies-migration.md).

### Response cache versus prompt cache

[Response caching](https://openrouter.ai/docs/guides/features/response-caching.md) replays an identical successful request before inference. Enable explicitly with `X-OpenRouter-Cache: true`; set `X-OpenRouter-Cache-TTL` (1–86400 seconds, default 300). It applies to Chat Completions, Responses, Messages, and embeddings, including streams. Cache hits have zero billable counters and a new generation id; preserve the source id from `X-OpenRouter-Cache-Source-Id`.

The cache is scoped to the API key, endpoint, model, stream mode, and normalized request body; JSON property order still matters. Concurrent misses can both be billed. A preset opt-out overrides an enabling header. Account-level ZDR disables response caching; per-request `provider.zdr` is a distinct scope. Cache eviction can precede TTL.

[Prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching.md) instead reuses a provider's input-prefix work while still running a model. Keep cache rates and hit counters separate. Avoid response-cache reuse when an answer must reflect fresh live data or a tool result could trigger a repeated action. A cached tool call still requires normal authorization and idempotency handling.

## Latest Aliases And Promotions

`~author/family-latest` aliases automatically move to a newer concrete model. The response model reveals what actually served the request.

Use latest aliases for intentionally evergreen experiences. Use a concrete id for evaluations, billing comparisons, regulated workflows, and any rollout where a model change must be reviewed. A moving alias plus a temporary promotion creates two independent sources of behavior change.
