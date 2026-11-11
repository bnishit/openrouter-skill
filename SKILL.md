---
name: "openrouter-integration"
description: "Connect apps to OpenRouter APIs — model/tool discovery, Responses and Messages, images/video/speech/transcription, embeddings/rerank, hosted and client tools, Agent SDK, routing, caching, budgets, privacy, observability, starter templates, and capability-drift checks. Use when adding, comparing, auditing, refreshing, or debugging OpenRouter capabilities, SDKs, models, costs, routing, requests, or assets."
---

# OpenRouter Integration

Use official OpenRouter docs as the source of truth for current endpoints, parameters, and capability metadata. Prefer `openrouter.ai/docs`, `openrouter.ai/openapi.json`, and the API reference pages under `openrouter.ai/docs/api-reference`.

## Choose the API before copying a starter

| Need | API / format | Read |
| - | - | - |
| Text, vision, PDFs, client functions | Chat Completions: `/api/v1/chat/completions`, `messages` | `references/requests-and-responses.md` |
| Responses clients, hosted shell, typed output items | `/api/v1/responses`, `input`; stateless | `references/requests-and-responses.md` |
| Anthropic-compatible clients | `/api/v1/messages`, content blocks and `max_tokens` | `references/requests-and-responses.md` |
| Images, video, speech, transcription | Dedicated media APIs; different response types | `references/multimodal-and-retrieval.md` |
| Search vectors or rerank documents | `/api/v1/embeddings`, `/api/v1/rerank` | `references/multimodal-and-retrieval.md` |
| Hosted tools, deferred tools, Agent SDK, MCP | Tool execution and state rules differ | `references/tools-and-function-calling.md` |
| Routing, caching, budgets, org controls, developer tools | See the full capability map | `references/capability-map.md` |

The supplied Next.js/Express starters implement **Chat Completions and image generation only**, plus selected discovery and cost routes. Guidance for another API does not mean the starter implements it. Choose model ids from live discovery and check endpoint capabilities before choosing request parameters.

### Discover current models and tools

```bash
curl --fail-with-body -sS https://openrouter.ai/api/v1/models
curl --fail-with-body -sS https://openrouter.ai/api/v1/tools \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

The public model catalogs can be read without a key. The tools catalog requires authentication (an unauthenticated live check returned 401). Keep its bearer token and inference keys server-side. Use `HTTP-Referer` and `X-OpenRouter-Title` for attribution, not authentication.

## Workflow

1. Check the docs before making non-trivial changes.
   - Run `scripts/check_openrouter_docs.py --quick` when accuracy matters or the integration seems stale.
   - For a refresh or “what is new” request, read the full docs indexes, API changelog, and `references/capability-map.md`; run `--inventory --strict`. A passing quick check only verifies old assumptions and cannot discover the full feature set. Read each relevant feature contract, including limits and beta status, before updating guidance.
   - Reconcile templates, headers, and parameter usage with current docs before coding. Distinguish newly launched features (dated release evidence) from existing features newly covered by this skill.

2. Keep secrets server-side.
   - Do not expose `OPENROUTER_API_KEY` in browser code.
   - Put a server route in front of OpenRouter for model discovery and chat calls.
   - Set `HTTP-Referer` and `X-OpenRouter-Title` headers when the app has a stable URL and title.
   - Do not forward arbitrary user-supplied `http(s)` asset URLs straight to OpenRouter. Fetch trusted assets server-side and convert them to `data:` URLs, or enforce an explicit host allowlist such as `OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS`.

3. For a supported chat/image app, install a starter instead of retyping boilerplate.
   - For other APIs/SDKs, follow the owning feature reference; the installer does not add those routes.
   - Use `scripts/install_template.sh` with `--template nextjs` or `--template express`.
   - Override base path and env var names at install time when the target project already has conventions.
   - Copy shared helpers, streaming UI example, and test fixtures with the template.

4. Decide what you are integrating.
   - Start with `references/capability-map.md` for the current product surface, source links, migration notes, and coverage boundaries.
   - Video, TTS/STT, multimodal audio/video, embeddings, rerank, and Files/Containers: read `references/multimodal-and-retrieval.md`.
   - Catalog, providers, free-model filters, key/credit diagnostics, or generation cost lookup: read `references/catalogs-and-costs.md`.
   - Promotions, discounted endpoints, workload cost comparisons, batch, or service tiers: read `references/discounts-and-cost-controls.md`.
   - Model catalog or picker: read `references/models-and-ui.md`.
   - Model selection, provider filters, or fallback policy that should be production-friendly: read `references/catalog-routing-best-practices.md`.
   - Text, image analysis, dedicated image generation, or PDF inference: read `references/requests-and-responses.md`.
   - End-to-end image asset workflows such as icons, OG images, preview, and storage: read `references/image-generation-best-practices.md`.
   - Tool calling or an agentic loop: read `references/tools-and-function-calling.md`.
   - Tool reliability or structured-output extraction that should survive production use: read `references/tool-calling-and-structured-output-best-practices.md`.
   - Routing and failover policy: read `references/routing-and-fallbacks.md`.
   - Logging, generation audit, and cost observability: read `references/operations-and-observability-best-practices.md`.
   - Common failures: read `references/troubleshooting.md`.

5. Discover models before choosing one.
   - Use `GET /api/v1/models` for the full catalog.
   - Use its filters, pagination, and server-side sorting for large or cost-sensitive catalogs; use `GET /api/v1/model/:author/:slug` for one alias-aware lookup.
   - Use `GET /api/v1/models/user` when user or provider preferences matter.
   - Use `GET /api/v1/providers` when provider routing, privacy, or availability matter in the UI.
   - Use `GET /api/v1/models/:author/:slug/endpoints` when you need endpoint-level provider data, including promotional `pricing.discount`.
   - Derive free-model lists by filtering zero-priced entries from the model catalog.
   - Treat catalog and endpoint prices as already discounted. Never subtract the advertised percentage a second time.
   - Treat promotions as temporary endpoint properties, not as a permanent model-quality or routing policy.
   - Store model `id`, not model `name`.
   - Filter by `architecture.input_modalities` and `architecture.output_modalities` first; use name heuristics only as fallback.

6. Build requests in OpenAI-compatible format.
   - These starters use Chat Completions. For Responses API integrations, use `POST /api/v1/responses` with `input`; include full history each turn. OpenRouter rejects `store: true` and non-null `previous_response_id`. Do not pass Responses payloads to these chat routes.
   - Send text-only chat prompts as normal `messages`.
   - Send images with `content` arrays containing a `text` part and one or more `image_url` parts.
   - Discover generation models and endpoint-specific controls through `GET /api/v1/images/models` and its per-model endpoint route.
   - Use `POST /api/v1/images` for new image integrations. Keep chat-completions image output only for legacy compatibility.
   - Send PDFs with a `file` content part and, when needed, the `file-parser` plugin.
   - Default to `data:` URLs for private uploads and for any untrusted remote asset. Use remote `http(s)` URLs only from explicit allowlisted hosts that you control or trust.
   - Keep `tools` in every tool-calling request, including follow-up calls that only send tool results.
   - Preserve `reasoning_details` unchanged across tool turns when a reasoning model returns it.
   - Use `service_tier: "flex"` only when lower price is worth higher latency and lower availability; record the served tier.
   - Use `POST /api/v1/batches` for non-interactive work; check the provider deadline and match results by `custom_id`. Do not assume a synchronous `:batch` model id is a drop-in replacement.

7. Choose response handling deliberately.
   - For Chat Completions prose, read `choices[0].message.content`; Responses uses typed `output` items; Messages uses `content` blocks. TTS returns bytes and video returns a job. Do not use one parser for all four.
   - For the Image API, read base64 assets from `data[*].b64_json` and preserve `media_type`; for legacy chat image output, read `choices[0].message.images`.
   - For structured data, prefer `response_format: { type: "json_schema", ... }` when the model supports `structured_outputs`.
   - Fall back to `response_format: { type: "json_object" }` when you need JSON but not full schema enforcement.
   - Use `assets/shared/parse-openrouter-response.ts` for robust text, generated-image, and tool-call extraction.
   - Use `assets/shared/stream-openrouter-sse.ts` for streaming.
   - Use `assets/shared/validate-structured-output.ts` with `zod` for type-safe parsing.
   - Use `assets/nextjs-template/components/openrouter-streaming-chat.tsx` as the end-to-end streaming UI example.

8. Reuse parsed PDFs when iterating.
   - If a PDF request returns assistant `annotations`, pass them back on follow-up requests to avoid reparsing cost and latency.
   - Preserve the original file message and append the annotated assistant message before the next user turn.

9. Verify the integration.
   - Run `python3 -m unittest discover -s scripts/tests -p "test_*.py"` and `npx --yes tsx --test assets/tests/*.test.ts` for offline regressions, including installation into an existing app.
   - Run `assets/tests/smoke-curl.sh` for text, structured JSON, tools, image analysis, image generation, and PDF cases.
   - Run `assets/tests/smoke-catalogs.sh` for catalogs, endpoint discounts, key/credit diagnostics, and generation cost lookup.
   - Check both successful responses and non-2xx OpenRouter errors.
   - Log returned `usage`, `cost`, finish reason, resolved model id, and generation id for debugging.
   - Fetch `GET /api/v1/generation?id=...` when exact post-hoc cost or token accounting matters.
   - Compare candidate models on representative production inputs before switching for a temporary discount.
   - For billing incidents, inspect both `/api/v1/key` and `/api/v1/credits`; they report different scopes.

## Resources

- Current capability coverage and official sources: `references/capability-map.md`
- Media, retrieval, and file workflows: `references/multimodal-and-retrieval.md`

- Docs-check script: `scripts/check_openrouter_docs.py`
- Installer script: `scripts/install_template.sh`
- Next.js starter: `assets/nextjs-template/`
- Express starter: `assets/express-template/`
- Shared TypeScript helpers: `assets/shared/`
- Smoke tests and fixtures: `assets/tests/`
- Catalog and cost helper: `assets/shared/openrouter-catalog-and-cost.ts`
- Image asset helper: `assets/shared/openrouter-generated-image-assets.ts`
- Node image persistence helper: `assets/shared/openrouter-generated-image-assets-node.ts`
- Catalogs, providers, free-model filters, and generation cost lookup: `references/catalogs-and-costs.md`
- Discounts, workload comparisons, batch, service tiers, and credit guardrails: `references/discounts-and-cost-controls.md`
- Catalog and routing production rules: `references/catalog-routing-best-practices.md`
- Image generation usage, preview, storage, icons, and OG workflows: `references/image-generation-best-practices.md`
- Tool calling and structured-output production rules: `references/tool-calling-and-structured-output-best-practices.md`
- Operations, logging, and generation audit rules: `references/operations-and-observability-best-practices.md`

## Quality Rules

- Prefer a server proxy with caching for model lists.
- Keep model picker UIs searchable; plain `<select>` breaks down on large catalogs.
- Use `architecture.input_modalities` and `architecture.output_modalities` as the primary capability signals.
- Treat pricing fields as strings from the API; convert explicitly if you need numeric math.
- Persist generation ids anywhere later cost inspection matters.
- Prefer exact generation lookup over estimated UI-only price math when a completed request id exists.
- Include the organization prefix in model ids such as `openai/gpt-4o-mini`.
- Chat Completions uses a `choices` array; other APIs have different envelopes. Preserve unknown fields and nullable values; decode new enum values permissively.
- For streaming, expect SSE comment lines and ignore them.
- For PDFs, choose `cloudflare-ai` for clean text PDFs, `mistral-ocr` for scanned or image-heavy PDFs, and `native` only when the selected model supports file input natively. `pdf-text` is deprecated.
- Do not assume every model supports `response_format`, `structured_outputs`, `tools`, or every OpenAI parameter; check `supported_parameters` first.
- When a request depends on specific parameters such as tools or `response_format`, prefer `provider.require_parameters: true`.
