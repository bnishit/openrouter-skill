# OpenRouter Skill

> The canonical source is [bnishit/skills](https://github.com/bnishit/skills/tree/main/skills/openrouter-integration). This repository mirrors updates for existing installs.

Stop rebuilding the same OpenRouter integration every project.

A reusable skill that gives your AI coding agent ready-made patterns for model discovery, image generation, cost lookup, routing, and production playbooks — so the agent writes better OpenRouter code instead of starting from scratch.

Landing page: [bnishit.github.io/openrouter-skill](https://bnishit.github.io/openrouter-skill/)

## Install

```bash
npx skills add bnishit/skills --skill openrouter-integration --global
```

Works with any AI agent that supports the skills install flow.

After install, invoke it as `$openrouter-integration`.

## Alternative Install

Direct git clone:

```bash
git clone https://github.com/bnishit/skills.git
```

Install from `skills/skills/openrouter-integration`. Use `$openrouter-integration` in prompts.

## Capabilities

- **Choose the right API:** Chat Completions, stateless Responses, Anthropic Messages, dedicated images/video/speech/transcription, embeddings and rerank.
- **Build tools and agents:** client versus hosted tools, tool discovery/search, continuation state, the Agent SDK package migration and MCP integrations.
- **Control routing and cost:** model/provider discovery, promotions, Auto/Auto Code/Pareto/Fusion/Jev/Switchyard, response versus prompt caching, Batch, service tiers and spend caps.
- **Use account controls deliberately:** workspace budgets, Guardrail Policies, Alignment/Armor beta limits, PKCE/workload identity, BYOK, presets, private endpoints and region/data-retention boundaries.
- **Explain what happened:** exact generation costs, router metadata, Logs/Activity/analytics, Broadcast trace export and its privacy controls.
- **Start and verify:** bounded Next.js/Express chat/image starters, reusable helpers, offline regressions, live docs checks, and added/removed docs/API inventory detection.

See the [capability map](references/capability-map.md) for coverage, official sources, migrations and limits. The map covers guidance; the starters do not implement every listed API or administrative control. No account setting or consuming app is changed merely by installing this skill.

## Example Prompts

- `Use $openrouter-integration to add an OpenRouter model picker to this app.`
- `Use $openrouter-integration to compare discounted endpoints for this workload and add a safe fallback and spend cap.`
- `Use $openrouter-integration to add dedicated Image API generation plus image and PDF understanding.`
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

The skill fetches catalogs live from the OpenRouter API — it never ships hardcoded model lists. Run `check_openrouter_docs.py --quick --inventory --strict` for focused assumptions and new/removed indexed pages/operations. Recheck feature semantics and account entitlements for the task.

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
python3 scripts/check_openrouter_docs.py --quick --inventory --strict
python3 -m unittest discover -s scripts/tests -p "test_*.py"
npx --yes tsx --test assets/tests/*.test.ts
```

Run these commands from this skill directory. TypeScript tests use `tsx` to resolve the extensionless imports used by the templates. Installed tests point to the installed helpers. Live smoke calls require your own key and may spend credits.

The installer checks all destination files before copying. It customizes only installed files; existing app files stay untouched, including with `--force`. Add your app’s authentication, access limits, and spend controls before exposing the proxy publicly.

For a capability refresh, follow the full [documentation audit](references/docs-check-workflow.md), including all official indexes and the API changelog. A passing old-assumption check is not evidence that the skill covers new features. The reviewed inventory contains 552 indexed Markdown pages and 174 operations as of 2026-11-11; inventory drift is a review signal, not an automatic baseline update.

## License

MIT
