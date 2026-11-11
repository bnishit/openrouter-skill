# Routing And Fallbacks

## Model Routing Options

OpenRouter supports several routing patterns:

1. Single fixed model with OpenRouter-managed provider routing.
2. `models` array for model-level fallback in priority order.
3. `model: "openrouter/auto"` when you want OpenRouter to choose among high-quality models dynamically.
4. `provider` object when you want to constrain or sort providers for a given model.

## Model Fallbacks

Use the `models` parameter to fail over across model ids.

```json
{
  "model": "openai/gpt-4o-mini",
  "models": [
    "google/gemini-2.5-flash",
    "anthropic/claude-3.5-haiku"
  ],
  "messages": [
    { "role": "user", "content": "Extract the invoice total." }
  ],
  "temperature": 0
}
```

Behavior from OpenRouter docs:

- The primary `model` is tried first.
- The `models` array is attempted in order if the primary model fails.
- Fallbacks can trigger on downtime, rate limits, moderation refusal, or validation errors.
- The response `model` field tells you which model ultimately served the request.

## Choose A Router Deliberately

Checked 2026-11-11. Routers select models; provider routing selects an endpoint for a model. A routing preference is not a hard dollar budget.

| Need | Model / feature | Main limit |
| - | - | - |
| General adaptive selection | `openrouter/auto` | Can change both model and reasoning effort per turn |
| Coding-agent turns | `openrouter/auto-code` | Starts with a stronger/more costly coding policy; evaluate your workload |
| Free available models | `openrouter/free` | Availability and rate limits vary; not a reliability guarantee |
| Coding score floor | `openrouter/pareto-code` | `min_coding_score` is 0–1; benchmark rank is not your task's accuracy |
| Multi-model research | `openrouter/fusion`, `openrouter/fusion-flash` | Panel/analyst/tool work adds cost; invocation can be discretionary |
| Task-based selection with Jev | `typesafe/jev-router` | Cost tier is a policy preference, not a cap |
| Choose among your own candidates | `nvidia/switchyard` | Up to three candidates; algorithm and judge add different latency/privacy costs |
| Current model in a family | `~author/family-latest` | Moving alias; unsuitable for a fixed evaluation baseline |

For Auto, configure `plugins: [{ id: "auto-router", allowed_models: ["anthropic/*", "openai/*"], cost_tier: "low" }]`. `excluded_models` removes candidates after the allowlist. Low/medium/high policies trade cost for capability; pin explicit models for reproducible domain-specific extraction. Auto Beta uses its own slug/plugin id; configuration under the wrong plugin id can be accepted and silently ignored. Recheck the selected router's current schema instead of reusing configuration across routers.

Switchyard supports `stage`, `capability`, `auto`, `composite`, `random`, and `passthrough`. Judge-backed algorithms send part of the prompt to another model. Use its docs to choose a policy and inspect its decisions; do not treat the candidate array as a normal fallback list when a routing plugin is active.

Record `session_id`, requested model, actual response model, reasoning effort, cost, and fallback events. Session stickiness reduces cache churn but is not a promise of one fixed model forever.

[Router overview](https://openrouter.ai/docs/guides/routing/routers/overview.md), [Auto](https://openrouter.ai/docs/guides/routing/routers/auto-router.md), [Auto Code](https://openrouter.ai/docs/guides/routing/routers/auto-code.md), [free](https://openrouter.ai/docs/guides/routing/routers/free-router.md), [Pareto](https://openrouter.ai/docs/guides/routing/routers/pareto-router.md), [Fusion](https://openrouter.ai/docs/guides/routing/routers/fusion-router.md), [Jev](https://openrouter.ai/docs/guides/routing/routers/jev-router.md), [Switchyard](https://openrouter.ai/docs/guides/routing/routers/switchyard-router.md).

## Provider Routing

Use the `provider` object when the model id is fixed but provider choice matters.

```json
{
  "model": "meta-llama/llama-3.1-8b-instruct",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "provider": {
    "order": ["deepinfra", "together"],
    "allow_fallbacks": true,
    "require_parameters": true,
    "data_collection": "deny",
    "sort": "throughput",
    "max_price": {
      "prompt": 1,
      "completion": 2
    }
  }
}
```

Common fields from the docs:

- `order`: provider priority list.
- `allow_fallbacks`: allow backup providers for the same model.
- `require_parameters`: only route to providers supporting every requested parameter.
- `data_collection`: allow or deny providers that may store data.
- `zdr`: require zero-data-retention endpoints when available.
- `only` / `ignore`: explicit provider allow or deny lists.
- `sort`: explicit price, latency, throughput, or supported quality sorting; read current options.
- `max_price`: cap acceptable provider pricing.

## Practical Policies

### Lowest latency extraction

- Use a measured fast model as `model`, with a compatible fallback.
- Use `provider.sort: "latency"` for response start time; throughput optimizes generation speed, a different metric.
- Keep `temperature: 0`.

### Highest reliability OCR

- Prefer a vision-capable primary model proven on your documents.
- Add one or two fallbacks with similar multimodal support.
- Use `provider.require_parameters: true` when you depend on `response_format`, tools, or plugins.
- Log the final response `model` so you can see when fallbacks are carrying the workload.

### Privacy-sensitive workflows

- Use `provider.data_collection: "deny"`.
- Add `provider.zdr: true` when required and supported.
- Use `/api/v1/models/user` if the account already encodes privacy guardrails.

### Cost-capped routing

- Use `provider.max_price` with prompt, completion, request, or image caps.
- Pair it with `provider.sort: "price"` when cost matters more than throughput.

## UI Guidance

- Show both the requested model and the resolved response model when fallbacks are enabled.
- If the UI presents model choices, make fallbacks an advanced section rather than the default surface.
- When benchmarking models, disable model-level fallbacks or record fallback events explicitly so results remain interpretable.
- When provider constraints block a request, surface the actual OpenRouter error to the user instead of collapsing it to a generic failure.

## Auto Exacto And Regional Boundaries

[Auto Exacto](https://openrouter.ai/docs/guides/routing/auto-exacto.md) automatically reorders providers for tool-calling requests using tool reliability, throughput, and benchmark signals. It can disrupt provider stickiness and prompt-cache hits. Explicit `provider.sort: "price"` or the `:floor` variant opts into price ordering instead. This does not validate or authorize tool execution in your app.

[In-region routing](https://openrouter.ai/docs/guides/features/in-region-routing.md) uses `https://eu.openrouter.ai/api/v1` or `https://us.openrouter.ai/api/v1` on eligible Business/Enterprise accounts. A catalog region filter alone does not enforce request residency. Inference fails when no eligible endpoint exists; BYOK deployment region and private endpoints still require your own review.

Recheck the feature matrix: Files/hosted containers, Batch, and multi-model routers are not generally available on regional domains. EU PDFs require native parsing; US supports native or Mistral OCR; Cloudflare parsing is global-only. US search currently permits Exa; EU has no supported search engine. Provider ZDR covers inference, not every tool vendor, trace export, uploaded file, or account record. See [server-tool privacy](https://openrouter.ai/docs/guides/features/server-tools.md#privacy-and-regional-availability) and [Sovereign AI boundaries](https://openrouter.ai/docs/guides/features/sovereign-ai.md).
