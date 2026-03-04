# Catalog And Routing Best Practices

Use this playbook when the real problem is not "how do I call one model," but "how do I keep the app aligned with the live catalog, provider differences, and fallback behavior over time."

## Core Rules

- Store model `id`, not model `name`.
- Discover current capabilities from `/api/v1/models` or `/api/v1/models/user` instead of hardcoding assumptions.
- Filter by `architecture.input_modalities` and `architecture.output_modalities` before using model-name heuristics.
- Keep provider constraints explicit when privacy, price, or availability matter.
- Log the requested model and the resolved response model separately whenever fallbacks are possible.

## Model Picker Rules

- Make large model lists searchable by `id`, `name`, `provider`, and `description`.
- Group by provider from the model id prefix, but never store only the provider name.
- Keep the catalog server-side and cache it. Model lists should not force a fresh client-side fetch on every render.
- Show feature badges such as `Vision`, `Files`, `Image Output`, `Tools`, or `Structured JSON` only when the metadata supports them.
- Use `/api/v1/models/user` for account-aware pickers when the user should only see practically routable options.

## Filtering Order

1. Filter by modalities.
2. Filter by required parameters such as `tools`, `response_format`, or `structured_outputs`.
3. Add provider-level constraints.
4. Only then sort by price, throughput, or preference.

This prevents the common mistake of selecting a cheap or popular model that cannot actually satisfy the request.

## Provider Routing Rules

- Use `provider.require_parameters: true` when the request depends on tools, JSON mode, structured outputs, or other non-baseline features.
- Use `provider.data_collection: "deny"` and `provider.zdr: true` when privacy requirements exist.
- Use `provider.sort: "price"` only when cost is truly more important than latency or consistency.
- Use `provider.sort: "throughput"` when response-time variance matters more than price.
- Expose provider controls as advanced configuration in the UI; keep the common path simple.

## Fallback Strategy Rules

- Prefer a clearly intentional primary model.
- Add one or two fallbacks that are truly compatible with the same workflow.
- Avoid long fallback chains that make observability and cost analysis harder.
- Disable model-level fallbacks for strict benchmarking flows unless you explicitly want "best available answer" behavior.
- Always surface or log which model actually answered the request.

## Free And Low-Cost Views

- Derive free-model lists from the live catalog, not from stale lists copied into the app.
- Treat all pricing fields as strings until you deliberately convert them.
- Keep "Free" filters and "Low Cost" filters separate. A zero-price route is not the same thing as a cheap route.
- For image-output workflows, check both `output_modalities` and image-related pricing fields.

## Production Defaults

- Keep a cached catalog endpoint in your own server.
- Keep a compact normalized UI model shape that preserves `id`, modalities, supported parameters, provider grouping, and raw pricing strings.
- Persist user selections as model ids and provider settings, not as display labels.
- When routing behavior becomes business-sensitive, capture it in config, not in scattered prompt text.

## What To Avoid

- Hardcoding model names in UI copy without checking the live catalog.
- Using native `<select>` for hundreds of models.
- Choosing fallbacks that do not support the same modality or parameters.
- Treating provider selection as cosmetic when privacy or price requirements exist.
- Hiding the resolved model when fallbacks are active.
