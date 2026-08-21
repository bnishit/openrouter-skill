# Docs Check Workflow

## Goal

OpenRouter docs change often. Before substantial integration work, run a quick docs check to confirm that the skill's assumptions still match the official docs and OpenAPI spec.

## Quick Start

Run:

```bash
python3 scripts/check_openrouter_docs.py --quick
```

This fetches a focused set of official pages plus `openrouter.ai/openapi.json` and checks for high-signal assumptions such as:

- required paths existing in the OpenAPI spec
- preferred title header name
- tool-calling loop requirements
- streaming semantics
- PDF behavior and engine defaults
- provider-routing features
- catalog, single-model, endpoint, image, generation, key, and credit paths
- high-leverage feature pages such as response healing and message transforms

## When To Run It

- Before implementing a new OpenRouter integration in a fresh project.
- When an existing integration suddenly starts failing in a way that suggests docs drift.
- Before updating this skill's templates or references.
- When you suspect new OpenRouter functionality might help the user.

## How To Use The Result

- `PASS`: current skill assumptions still match the live docs.
- `WARN`: something drifted or the script could not confirm a behavior from the current pages.
- `FAIL`: a required page or path could not be fetched or verified.

On warnings or failures:

1. Open only the flagged official page or `openapi.json`.
2. Compare the changed assumption against this skill's templates and references.
3. Update the skill first if the docs clearly changed.
4. Only then implement or debug the target project.

## Scope Rules

- Treat official OpenRouter docs and OpenAPI as the source of truth.
- Do not use third-party blog posts to override the official docs.
- Prefer small, high-confidence checks over brittle HTML scraping.

## What The Script Does Not Replace

The script is a guardrail, not a complete spec diff. If a task depends on a nuanced feature such as provider routing, transforms, or tool calling behavior, still read the relevant official page after the quick check.
