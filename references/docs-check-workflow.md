# Documentation Maintenance

## Two different jobs

A quick compatibility check asks whether known examples still match selected documentation. A capability audit asks what OpenRouter now offers that the skill does not yet teach. The first cannot replace the second.

```bash
# Existing assumptions: API methods/paths plus focused feature text checks.
python3 scripts/check_openrouter_docs.py --quick --strict
# New/removed pages and API operations relative to the reviewed inventory.
python3 scripts/check_openrouter_docs.py --inventory --strict
# Both, sharing the fetched OpenAPI response.
python3 scripts/check_openrouter_docs.py --quick --inventory --strict
```

These commands are read-only and need no API key. Focused page checks use official Markdown to avoid matching unrelated HTML navigation. Fetch failures are failures, not evidence that a feature was removed.

## Full capability audit

1. Read the [main index](https://openrouter.ai/docs/llms.txt), [guide index](https://openrouter.ai/docs/_llms/docs.txt), and [API index](https://openrouter.ai/docs/_llms/api-reference.txt). Include Client SDK, Agent SDK, developer tools, privacy/admin controls and cookbook categories, not only the chat endpoint.
2. Compare [changelog](https://openrouter.ai/docs/changelog.md) entries and the live [OpenAPI](https://openrouter.ai/openapi.json) with `references/docs-inventory.json`. Review additions, removals, migrations and beta/plan constraints. An endpoint can be renamed after appearing in an older release note: current OpenAPI and owning docs decide the present contract.
3. Map each material gap into `references/capability-map.md` and its existing owning reference. Use examples that apply across products. Distinguish a dated new release from an older capability newly added to this skill.
4. Read each chosen feature's actual request/response contract, execution ownership, cost controls, privacy/state rules and failures. Do not infer that a chat starter implements a feature because the docs mention it.
5. Update code/templates only when needed for the requested integration. Run the regressions below and appropriate live discovery. Paid generations and account mutations require a suitable authorized key/scope; don't call synthetic tests live verification.
6. Only after reviewing the changes, regenerate the inventory with `build_inventory(index_texts, spec)` and record `reviewed_on`. Do not accept a changed baseline just to make a warning disappear. Sync canonical repo, compatibility repo and installed copies from the same reviewed content.

## Results

- `PASS`: the particular assumption or inventory comparison matched.
- `WARN`: a known assumption could not be confirmed, or an indexed page/API operation was added/removed. Investigate the specific source.
- `FAIL`: a fetch, parse, baseline read, or comparison failed.
- `--strict` exits non-zero for warnings and failures.

The inventory detects page/operation additions and removals. It does **not** compare all existing page bodies, SDK signatures, model capabilities, prices, plan entitlements, or every OpenAPI schema field. Read relevant contracts and migration notes even when it passes. The focused checks are high-signal strings, not semantic certification.

## Reviewed on 2026-11-11

The full inventory contains 552 distinct Markdown pages and 174 API operations across 121 paths. The capability map records 30 areas, including formats/media/retrieval, hosted tools and SDKs, routing, caching, governance, identity, privacy, observability and developer tooling. All indexed pages were fetched; key integration contracts and limits were reviewed. This is not a claim of manually reviewing every generated SDK method.

## Regression commands

From this skill directory:

```bash
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
npx --yes tsx --test assets/tests/*.test.ts examples/*.test.ts
bash -n scripts/install_template.sh assets/tests/smoke-curl.sh assets/tests/smoke-catalogs.sh
```

Installer tests cover Next.js root and `src/app`, Express, settings and conflict protection. Streaming fixtures cover split Unicode/LF/CRLF, HTTP/in-stream errors and cleanup. Inventory tests cover a new capability while all old paths remain, a removed operation, a new method on an existing path, duplicate links, and unreadable/empty sources. CI runs offline regressions and copied-starter tests; manual dispatch also checks live docs and inventory.
