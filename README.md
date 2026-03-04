# OpenRouter Skill

OpenRouter Skill is an installable agent skill for AI agents that need reliable OpenRouter integration patterns: model discovery, provider discovery, free-model filtering, generation cost lookup, multimodal chat, tool calling, structured output, routing, and starter templates.

Landing page: `https://bnishit.github.io/openrouter-skill/`

## Install

Install with the `skills` CLI for the agent you use:

```bash
npx skills add bnishit/openrouter-skill --agent <your-agent>
```

If your agent runtime supports the `skills` install flow, this repository is intended to work as a reusable OpenRouter skill there as well.

## Compatibility

The public repository name is `openrouter-skill`, but the installed skill trigger remains `openrouter-integration` for compatibility with existing prompts and local setups.

Direct git install still works:

```bash
git clone https://github.com/bnishit/openrouter-skill.git \
  ~/.codex/skills/openrouter-integration
```

## What It Covers

- model discovery and searchable model pickers
- provider discovery and provider-aware routing
- free-model filtering from the live catalog
- generation cost lookup and post-hoc billing inspection
- chat completions and streaming
- structured JSON responses
- multimodal requests with images and PDFs
- tool calling and multi-step agent loops
- model routing and provider fallback policies
- reusable Next.js and Express starter templates

## Example Prompts

- `Use $openrouter-integration to add an OpenRouter model picker to this app.`
- `Use $openrouter-integration to add provider and free-model filters to this OpenRouter model catalog.`
- `Use $openrouter-integration to fetch a completed OpenRouter generation and show its exact cost.`
- `Use $openrouter-integration to add image and PDF chat support through an OpenRouter server route.`
- `Use $openrouter-integration to wire tool calling and provider fallback handling into this project.`

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
- `references/`: targeted reference material for requests, routing, troubleshooting, and docs checks
- `scripts/`: helper scripts for documentation checks and starter installation
- `assets/`: reusable templates, shared helpers, and smoke-test fixtures
- `docs/`: static landing page and search-facing metadata for GitHub Pages

## Included Templates and Helpers

- `assets/nextjs-template/`: API routes and UI components for model browsing, streaming chat, provider catalogs, free-model views, and generation-cost lookup
- `assets/express-template/`: route handlers and a minimal example server with `/providers`, `/free-models`, and `/generation/:id`
- `assets/shared/`: TypeScript helpers for response parsing, structured output validation, and SSE streaming
- `assets/tests/`: curl-based smoke tests and fixtures for text, JSON, tools, images, and PDFs
- `assets/shared/openrouter-catalog-and-cost.ts`: reusable helper for models, providers, free models, and generation cost lookup
- `assets/tests/smoke-catalogs.sh`: smoke script for `/models`, `/models/user`, `/providers`, free-model filtering, and `/generation`

## FAQ

### Is this only for one assistant?

No. The repository is packaged as a broad OpenRouter skill for AI agents, and the public naming and install flow are intentionally agent-agnostic.

### Why is the trigger still `openrouter-integration`?

To avoid breaking existing prompts and local installations. The repo branding changed; the skill trigger did not.

### What should I search for?

This project is optimized around the phrases `OpenRouter Skill`, `OpenRouter agent skill`, and `OpenRouter integration skill`.

## Directory Listing

- agentskill.sh: `https://agentskill.sh/@bnishit/openrouter-integration`

## Maintenance

Treat official OpenRouter documentation as the source of truth for endpoints, parameters, and capability metadata.

Use:

```bash
python3 scripts/check_openrouter_docs.py --quick
```

When the script flags drift, update the templates and examples against the relevant OpenRouter documentation.

## License

MIT
