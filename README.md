# OpenRouter Skill

Ship OpenRouter work without rebuilding it.

An installable skill that gives AI agents model discovery, image generation, cost tracking, routing, and production playbooks — so you stop rewriting the same OpenRouter patterns.

Landing page: [bnishit.github.io/openrouter-skill](https://bnishit.github.io/openrouter-skill/)

## Install

```bash
npx skills add bnishit/openrouter-skill
```

Works with any AI agent that supports the skills install flow.

## Alternative Install

Direct git clone:

```bash
git clone https://github.com/bnishit/openrouter-skill.git
```

The trigger name is `openrouter-skill`. The installed skill trigger remains `openrouter-integration` for compatibility with existing prompts and local setups.

## Why This Exists

OpenRouter moves faster than app code usually does. New models appear quickly, providers differ, and pricing shifts underneath existing flows. Teams end up redoing the same integration steps every time. This skill bundles those recurring patterns into one installable layer.

## Capabilities

- **Model Discovery** — searchable catalog patterns, filtering guidance, and picker-ready UI examples
- **Provider & Free Models** — provider-aware filters and zero-priced model discovery from the live catalog
- **Multimodal Chat** — text, image, and PDF request patterns with response parsing and streaming
- **Image Generation** — chat-completions patterns for generated images, output modalities, and response parsing
- **Generation Costs** — exact post-hoc lookup for cost, provider, and token accounting per generation
- **Tool Calling** — loop-safe examples for tools, follow-up calls, and structured response handling
- **Routing & Fallbacks** — provider routing, fallback strategies, and parameter-aware request configuration
- **Production Playbooks** — built-in rules for routing, observability, structured output, logging, and audit
- **Asset Workflows** — starter patterns for icons, OG images, social visuals, and persistent asset metadata
- **Starter Templates** — reusable Next.js and Express routes plus a small ops/debug surface
- **Verification** — smoke fixtures, docs checks, and shared helpers for safer integration changes

## Example Prompts

- `Use $openrouter-integration to add an OpenRouter model picker to this app.`
- `Use $openrouter-integration to add provider and free-model filters to this OpenRouter model catalog.`
- `Use $openrouter-integration to fetch a completed OpenRouter generation and show its exact cost.`
- `Use $openrouter-integration to add image generation plus image and PDF chat support through an OpenRouter server route.`
- `Use $openrouter-integration to generate OG images and app icons through OpenRouter, preview them, and store the approved assets cleanly.`
- `Use $openrouter-integration to make this OpenRouter workflow production-safe with the built-in best-practice playbooks for routing, tools, and observability.`
- `Use $openrouter-integration to wire tool calling and provider fallback handling into this project.`

## First Principles

1. **Model markets change quickly** — you need discovery, provider awareness, and safe routing built in
2. **Compatibility is the reason teams choose OpenRouter** — one layer for text, vision, image-gen, and files
3. **Cost matters after the request, not just before it** — exact generation lookup for billing and debugging
4. **Scaffolding should not be rebuilt every project** — starter routes and request shapes are the same across projects
5. **Production rules are learned the hard way — once** — fallbacks, tool-loop safety, and cost logging should be encoded upfront
6. **Agents need structured knowledge, not just API docs** — a skill tells an agent when to use endpoints and how to handle edge cases

## How It Works

### 01 — Shipping fast on a new model

A new image-capable model just appeared. The skill fetches the live catalog, filters by modality, scaffolds the route, and keeps the integration OpenRouter-compatible — no vendor lock-in.

### 02 — Cost clarity after the fact

Yesterday's OCR flow cost more than expected. The skill looks up the generation by ID, returns exact cost, provider, and token fields — wired into logs or admin UI.

### 03 — Low-cost and fallback-conscious builds

You want a workflow that starts cheap and uses free models when possible. The skill filters zero-priced models, lists providers, preserves routing controls, and scaffolds the endpoints your app needs.

### 04 — One path for text, vision, and images

You don't want one SDK for chat, another for images, and a third for file workflows. The skill keeps the app on one OpenRouter-compatible layer across all modalities.

### 05 — Icons and OG images without custom workflows

You need app icons and OG images but don't want to rebuild prompts, preview handling, and asset metadata every time. The skill uses shipped presets and persists with generation metadata.

### 06 — Production rules without rediscovering them

The feature is working, but you don't want to remember all the small rules for fallbacks, tool loops, and cost logging. The skill applies shipped best-practice playbooks so implementation covers the operational rules teams usually learn the hard way.

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

- `assets/nextjs-template/`: API routes and UI components for model browsing, streaming chat, provider catalogs, free-model views, image generation, generated-asset workflows, and generation-cost lookup
- `assets/express-template/`: route handlers and a minimal example server with `/providers`, `/free-models`, `/generation/:id`, and a chat proxy that passes image-generation fields
- `assets/shared/`: TypeScript helpers for response parsing, generated-image extraction, image asset persistence, structured output validation, and SSE streaming
- `assets/tests/`: curl-based smoke tests and fixtures for text, JSON, tools, image analysis, image generation, and PDFs
- `assets/shared/openrouter-catalog-and-cost.ts`: reusable helper for models, providers, free models, and generation cost lookup
- `assets/shared/openrouter-generated-image-assets.ts`: image-generation request presets plus generated-asset extraction for icon, OG image, social, story, and banner flows
- `assets/shared/openrouter-generated-image-assets-node.ts`: Node helper for writing approved generated images to disk in local or server-backed flows
- `assets/nextjs-template/components/openrouter-image-workbench.tsx`: starter UI for generating, previewing, and downloading image assets
- `assets/nextjs-template/app/openrouter-image-lab/page.tsx`: sample page for image generation after install
- `assets/tests/smoke-catalogs.sh`: smoke script for `/models`, `/models/user`, `/providers`, free-model filtering, image-output model discovery, and `/generation`

## Best-Practice Playbooks

- `catalog-routing-best-practices.md`: how to build searchable model pickers, provider-aware routing, and sane fallback behavior without stale hardcoded assumptions
- `image-generation-best-practices.md`: how to generate icons, OG images, and social assets with preview plus storage-ready metadata
- `tool-calling-and-structured-output-best-practices.md`: how to keep tool loops and JSON extraction reliable instead of fragile
- `operations-and-observability-best-practices.md`: how to persist generation ids, log the right fields, and answer later cost/debug questions cleanly

## FAQ

### Is this only for one assistant?

No. The repository is packaged broadly for AI agents that support the skills install flow. The landing page is intentionally written for general agent use.

### What makes this an agent skill?

It packages reusable OpenRouter workflows, templates, references, and helper assets so an AI agent can apply them directly instead of rebuilding the same integration patterns from scratch.

### What do I get besides docs?

The skill prompt, metadata, starter templates, smoke fixtures, shared helpers, and focused references plus best-practice playbooks for models, providers, image generation, tool loops, and generation cost lookup.

### Does this replace the OpenRouter SDK?

No. This skill complements it. The SDK handles HTTP calls and auth. This skill handles the decision layer above it — which model to pick, how to route, what to do when things fail, and how to audit costs after the fact.

### How do I keep the skill updated?

Pull the latest from the repo or re-run `npx skills add bnishit/openrouter-skill`. The skill is versioned in Git, so you can diff changes and decide when to update.

### Can I use this with my own prompts and templates?

Yes. The skill provides defaults and best-practice patterns, but everything is editable. Override templates, swap playbook rules, or extend the skill with your own workflows.

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
