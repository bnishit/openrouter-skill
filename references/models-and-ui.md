# Models And UI

## Endpoints

- `GET https://openrouter.ai/api/v1/models`: full model catalog.
- `GET https://openrouter.ai/api/v1/models/count`: count with matching filters.
- `GET https://openrouter.ai/api/v1/model/:author/:slug`: alias-aware single-model lookup.
- `GET https://openrouter.ai/api/v1/models/user`: catalog filtered by the caller's provider preferences, privacy settings, and guardrails.
- `GET https://openrouter.ai/api/v1/providers`: provider catalog for provider pickers and routing-aware UX.
- `GET https://openrouter.ai/api/v1/models/:author/:slug/endpoints`: provider and endpoint data for one specific model.
- `GET https://openrouter.ai/api/v1/images/models`: dedicated image-generation catalog.
- Prefer calling these from your server, not directly from the browser.

## Request Headers

Use:

```http
Authorization: Bearer <OPENROUTER_API_KEY>
Accept: application/json
HTTP-Referer: <your-site-url>
X-OpenRouter-Title: <your-app-name>
```

`X-Title` is still accepted, but the current docs prefer `X-OpenRouter-Title`.

## Fields To Keep

For each model, keep these fields in your UI shape:

- `id`: the exact value to send in later chat calls.
- `name`: display label.
- `description`: optional helper text.
- `context_length`: useful secondary metadata.
- `architecture.input_modalities`: primary filter for text, image, file, audio, or video support.
- `architecture.output_modalities`: useful for image generation or other non-text outputs.
- `supported_parameters`: use for features such as `response_format`, `structured_outputs`, `tools`, `reasoning`, or provider routing constraints.
- `pricing`: keep raw strings and convert only when displaying math.
- `canonical_slug`, `alias_target`, `default_parameters`, `reasoning`, `expiration_date`, and `benchmarks`: preserve these when aliases, defaults, reasoning controls, deprecation, or ranking matter.
- `top_provider`: useful for provider-specific context or completion limits.

For exact generation-level billing data, use `GET /api/v1/generation?id=...` instead of trying to estimate from catalog pricing alone.

## Filtering Guidance

Use this order:

1. Filter by `architecture.input_modalities`.
2. Filter by `supported_parameters` if the feature requires them.
3. Use model endpoint data when provider-specific support matters.
4. Fall back to `architecture.modality` or name heuristics only when metadata is incomplete.

Examples:

- OCR or image analysis: require `image` in `input_modalities`.
- PDF workflows: prefer `file` support when present; otherwise allow the `file-parser` plugin path.
- Structured JSON: prefer models advertising `structured_outputs` or `response_format`.
- Tool calling: require `tools` in `supported_parameters`.
- Price- or throughput-sensitive routes: use the endpoints list for the chosen model before hard-coding a provider strategy.
- Free-model pickers: filter catalog entries whose relevant pricing fields are zero-valued strings.
- Discount badges: fetch the selected model's endpoint records and use numeric `pricing.discount`; the catalog does not provide a global discount filter.
- Large catalogs: forward documented query parameters and use server-side sorting, pagination, and `/models/count`.

## Normalized UI Shape

A pragmatic shape is:

```ts
type UiModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
  inputModalities: string[];
  outputModalities: string[];
  supportedParameters: string[];
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
  };
};
```

## UI Rules

- Store `id`, not `name`.
- Show `name` first and `id` second.
- Group by provider from the id prefix.
- Add search on `id`, `name`, `provider`, and `description`.
- Add sensible defaults so the picker is useful before the first click.
- Cache the catalog server-side; it does not need a fresh request on every render.
- Cache by normalized query and scope. Never share a public-catalog cache entry with `/models/user`.
- For large lists, use a searchable popover, combobox, or modal list instead of a native select.
- Show selected models as removable tags or chips.
- Show a promotion badge only when live endpoint metadata confirms it, and label prices as current rather than permanent.
- When the app depends on a specific feature, show a badge for it, for example `Vision`, `Files`, `Structured JSON`, `Streaming`, or `Tools`.
- When providers matter separately from models, fetch `/api/v1/providers` and show provider badges or filters directly from the API response.

## Failure Modes

- Exposing the API key in client code.
- Using model `name` as the stored value.
- Treating pricing strings as numbers without explicit conversion.
- Filtering by provider or name only and missing actual capability metadata.
- Building an unsearchable select for hundreds of models.
