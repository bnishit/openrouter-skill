# OpenRouter Integration Skill

`openrouter-integration` is a Codex skill for adding and debugging OpenRouter integrations in application codebases.

Install with:

```bash
npx skills add bnishit/openrouter-integration-skill --agent codex
```

It packages a reusable `SKILL.md`, agent metadata, implementation references, starter templates, shared parsing helpers, and smoke-test fixtures for common OpenRouter work:

- model discovery and searchable model pickers
- chat completions and streaming
- structured JSON responses
- multimodal requests with images and PDFs
- tool calling and multi-step loops
- provider routing and fallback policies
- Next.js and Express starter routes

## Install

Preferred install via the `skills` CLI:

```bash
npx skills add bnishit/openrouter-integration-skill --agent codex
```

Direct git install for Codex also works. Clone this repository into your Codex skills directory using the installed skill name:

```bash
git clone https://github.com/bnishit/openrouter-integration-skill.git \
  ~/.codex/skills/openrouter-integration
```

Restart Codex after cloning so it reloads the available skills.

## Use

Example prompts:

- `Use $openrouter-integration to add an OpenRouter model picker to this Next.js app.`
- `Use $openrouter-integration to wire image and PDF chat requests through an Express proxy.`
- `Use $openrouter-integration to validate our OpenRouter response parsing and tool-calling loop.`

## Repository Layout

```text
.
├── SKILL.md
├── agents/openai.yaml
├── references/
├── scripts/
└── assets/
```

- `SKILL.md`: trigger metadata and the core workflow Codex loads when the skill is used
- `agents/openai.yaml`: UI metadata for skill chips and lists
- `references/`: targeted docs for models, requests, tools, routing, troubleshooting, and doc checks
- `scripts/`: helper scripts for doc verification and template installation
- `assets/`: starter code, shared helpers, and smoke-test fixtures

## Included Templates and Helpers

- `assets/nextjs-template/`: API routes and UI components for model browsing and streaming chat
- `assets/express-template/`: route handlers and a minimal example server
- `assets/shared/`: TypeScript helpers for response parsing, structured output validation, and SSE streaming
- `assets/tests/`: curl-based smoke tests plus request fixtures for text, tools, images, PDFs, and structured output

## Maintenance

Treat the official OpenRouter documentation as the source of truth for endpoints, parameters, and capability metadata.

Use:

```bash
python3 scripts/check_openrouter_docs.py --quick
```

When the script flags drift, reconcile this skill against the relevant OpenRouter documentation before updating templates or examples.

## Notes

This repository keeps the skill contents at repo root so it can be cloned directly into `~/.codex/skills/openrouter-integration`.

## License

MIT
