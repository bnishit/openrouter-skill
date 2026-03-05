# OpenRouter Skill

Stop rebuilding the same OpenRouter integration every project.

A reusable skill that gives your AI coding agent ready-made patterns for model discovery, image generation, cost lookup, routing, and production playbooks — so the agent writes better OpenRouter code instead of starting from scratch.

Landing page: [bnishit.github.io/openrouter-skill](https://bnishit.github.io/openrouter-skill/)

## Install

```bash
npx skills add bnishit/openrouter-skill
```

Works with any AI agent that supports the skills install flow.

After install, invoke it as `$openrouter-integration`.

## Alternative Install

Direct git clone:

```bash
git clone https://github.com/bnishit/openrouter-skill.git
```

Install from `openrouter-skill`. Use `$openrouter-integration` in prompts.

## Capabilities

- **Model Discovery** — search 300+ models by capability, price, or provider and build a picker in minutes
- **Image Generation** — generate images via chat completions with presets for icons, OG images, and social assets
- **Multimodal Chat** — send text, images, and PDFs in the same conversation and parse any response type
- **Cost Tracking** — look up exact cost per generation with real billing data, not estimates
- **Routing & Fallbacks** — route to cheapest provider and fall back automatically when one goes down
- **Tool Calling** — agentic loops with safety limits and structured output with Zod validation
- **Provider & Free Models** — filter by provider and find zero-cost models automatically
- **Starter Templates** — Next.js and Express routes ready to copy, not configure
- **Asset Workflows** — icons, OG images, banners — generate, preview, and persist with metadata
- **Production Playbooks** — fallback rules, logging, audit trails — encoded, not remembered
- **Safer Defaults** — proxies block untrusted URLs unless you explicitly allowlist trusted hosts
- **Verification** — smoke tests and doc-check scripts that detect when OpenRouter changes

## Example Prompts

- `Use $openrouter-integration to add an OpenRouter model picker to this app.`
- `Use $openrouter-integration to add image generation plus image and PDF chat support through an OpenRouter server route.`
- `Use $openrouter-integration to make this OpenRouter workflow production-safe with the built-in best-practice playbooks for routing, tools, and observability.`

## Repository Layout

```text
.
├── SKILL.md
├── agents/openai.yaml
├── references/
├── scripts/
├── assets/
└── docs/
```

- `SKILL.md`: trigger metadata plus the core OpenRouter workflow
- `agents/openai.yaml`: UI-facing metadata for supported agent skill systems
- `references/`: targeted reference material for image generation, requests, routing, troubleshooting, and docs checks
- `references/catalog-routing-best-practices.md`: production rules for model catalogs, provider filters, and fallbacks
- `references/image-generation-best-practices.md`: concrete icon, OG image, social asset, preview, and storage rules
- `references/tool-calling-and-structured-output-best-practices.md`: production rules for tools, schemas, and validation loops
- `references/operations-and-observability-best-practices.md`: logging, generation id, cost audit, and artifact-traceability rules
- `scripts/`: helper scripts for documentation checks and starter installation
- `assets/`: reusable templates, shared helpers, and smoke-test fixtures
- `docs/`: static landing page and search-facing metadata for GitHub Pages

## Included Templates and Helpers

- **Templates**: Next.js and Express starter routes for models, chat, image generation, and cost lookup — plus UI components like a model picker and image workbench
- **Shared helpers**: TypeScript utilities for streaming (SSE), response parsing, generated-image extraction, asset persistence, and structured output validation
- **Tests**: Curl-based smoke tests and fixtures covering text, JSON, tools, image analysis, image generation, and PDFs

The starter proxies default to `data:` URLs for uploaded assets and block arbitrary remote `http(s)` image/PDF URLs unless you set `OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS`.

## Best-Practice Playbooks

- `catalog-routing-best-practices.md`: how to build searchable model pickers, provider-aware routing, and sane fallback behavior without stale hardcoded assumptions
- `image-generation-best-practices.md`: how to generate icons, OG images, and social assets with preview plus storage-ready metadata
- `tool-calling-and-structured-output-best-practices.md`: how to keep tool loops and JSON extraction reliable instead of fragile
- `operations-and-observability-best-practices.md`: how to persist generation ids, log the right fields, and answer later cost/debug questions cleanly

## FAQ

### I already use the OpenRouter SDK. Why do I need this too?

The SDK is the transport layer — HTTP calls and auth. This skill is the decision layer — which model to pick, how to route, what to do on failure, how to audit costs. They complement each other.

### Does this lock me into a specific agent or framework?

No. Works with any agent supporting skills install. Templates produce standard Next.js/Express code. Stop using the skill, keep all generated code.

### How current is the model data?

The skill fetches catalogs live from the OpenRouter API — it never ships hardcoded model lists. Run `check_openrouter_docs.py --quick` to detect API drift.

### What about rate limits and API keys?

The skill enforces server-side key management. Proxy route templates handle auth headers plus OpenRouter attribution headers. Keys never touch the browser.

### Can I use only parts of this?

Yes. Every capability is modular. Use just image generation, or just cost tracking, or just routing playbooks. Pick what you need.

### How do I know the production playbooks are actually good?

They encode specific patterns: tool-call loop limits, Zod schema validation, generation-ID persistence, provider fallback ordering, remote-asset URL allowlisting. Extracted from real production incidents, not theoretical best practices.

### Why not just read OpenRouter's docs?

You can, and you should for reference. The skill exists because reading docs doesn't prevent you from rebuilding the same integration scaffolding every project. It encodes the patterns that worked — model filtering, provider fallbacks, cost lookup, streaming setup, multimodal request shapes — so your agent applies them directly instead of translating docs into code from scratch each time.

## Maintenance

Treat official OpenRouter documentation as the source of truth for endpoints, parameters, and capability metadata.

Use:

```bash
python3 scripts/check_openrouter_docs.py --quick
```

When the script flags drift, update the templates and examples against the relevant OpenRouter documentation.

## License

MIT
