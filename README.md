# OpenRouter Skill

OpenRouter Skill is an installable skill for AI agents that need reliable OpenRouter integration patterns: model discovery, multimodal chat, tool calling, structured output, routing, and starter templates.

Landing page: `https://bnishit.github.io/openrouter-skill/`

## Install

Install with the `skills` CLI for the agent you use:

```bash
npx skills add bnishit/openrouter-skill --agent codex
npx skills add bnishit/openrouter-skill --agent claude
npx skills add bnishit/openrouter-skill --agent gemini
```

If your agent runtime supports the `skills` install flow, this repository is intended to work as a reusable OpenRouter skill there as well.

## Compatibility

The public repository name is `openrouter-skill`, but the installed skill trigger remains `openrouter-integration` for compatibility with existing prompts and local setups.

Direct git install for Codex-compatible local skills still works:

```bash
git clone https://github.com/bnishit/openrouter-skill.git \
  ~/.codex/skills/openrouter-integration
```

## What It Covers

- model discovery and searchable model pickers
- chat completions and streaming
- structured JSON responses
- multimodal requests with images and PDFs
- tool calling and multi-step agent loops
- model routing and provider fallback policies
- reusable Next.js and Express starter templates

## Example Prompts

- `Use $openrouter-integration to add an OpenRouter model picker to this app.`
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

- `assets/nextjs-template/`: API routes and UI components for model browsing and streaming chat
- `assets/express-template/`: route handlers and a minimal example server
- `assets/shared/`: TypeScript helpers for response parsing, structured output validation, and SSE streaming
- `assets/tests/`: curl-based smoke tests and fixtures for text, JSON, tools, images, and PDFs

## FAQ

### Is this only for Codex?

No. The repository is packaged as a broad OpenRouter skill for AI agents. Codex is one supported install path, but the public naming and install flow are intentionally agent-agnostic.

### Why is the trigger still `openrouter-integration`?

To avoid breaking existing prompts and local installations. The repo branding changed; the skill trigger did not.

### What should I search for?

This project is optimized around the phrases `OpenRouter Skill`, `OpenRouter agent skill`, and `OpenRouter integration skill`.

## Directory Listings

- agentskill.sh: `https://agentskill.sh/@bnishit/openrouter-integration`
- YouWant.ai: `https://youwant.ai`
- Submit AI Tools: `https://submitaitools.org/submit-your-ai-tool/`

## Maintenance

Treat official OpenRouter documentation as the source of truth for endpoints, parameters, and capability metadata.

Use:

```bash
python3 scripts/check_openrouter_docs.py --quick
```

When the script flags drift, update the templates and examples against the relevant OpenRouter documentation.

## License

MIT
