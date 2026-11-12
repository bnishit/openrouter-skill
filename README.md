# OpenRouter Integration Skill

> The canonical source is [bnishit/skills](https://github.com/bnishit/skills/tree/main/skills/openrouter-integration). This repository mirrors updates for existing installs.

Give your coding agent a reusable map of OpenRouter: choose the right API, start from a small sample, and show what the evidence proves.

[Landing page](https://bnishit.github.io/openrouter-skill/) · [Capability map](references/capability-map.md) · [Worked samples](examples/README.md) · [Evaluation cases](evals/evals.json)

Community-maintained by Nishit Bhatt. Independent of OpenRouter. MIT licensed.

## Install

```bash
npx skills add bnishit/skills --skill openrouter-integration --global
```

Then ask your agent:

> Use $openrouter-integration to add a resumable video flow. Start with the dry-run sample and show what still needs live verification.

The canonical source is `bnishit/skills`, under `skills/openrouter-integration`. The older `bnishit/openrouter-skill` repository mirrors releases for existing installs and hosts the landing page. Manual installs should point the agent's skill directory at this folder, including its references and assets.

## What ships

| Layer | Included | Boundary |
| - | - | - |
| API and capability guidance | 30 areas: Chat Completions, Responses, Messages, media, retrieval, tools/agents, routing, cost controls, identity, privacy, observability and developer tooling | Guidance is not an implementation of every feature |
| Worked code | Streaming, speech bytes, resumable video, embeddings, rerank, and allowlisted client-tool dispatch | Server/CLI samples, dry-run by default |
| Starter templates | Selected Next.js and Express chat/image routes, discovery/cost routes and UI components | Add your app's authentication, quotas and tenant isolation before exposing a proxy |
| Verification | Unit regressions, focused live docs checks, indexed-page/API-operation drift checks and behavioral eval cases | Each has a different claim; see evidence below |

Client SDKs provide typed API calls. The Agent SDK adds loop/state/tool orchestration. This skill helps choose and apply them; it does not replace either or grant permission to change an account.

## Try a worked sample

From this skill directory, with Node 22+:

```bash
npx --yes tsx examples/run.ts stream --model MODEL_ID --text "Explain a response cache in one sentence."
npx --yes tsx examples/run.ts speech --model SPEECH_MODEL_ID --voice SUPPORTED_VOICE --text "Your export is ready." --out reply.mp3
npx --yes tsx examples/run.ts video --model VIDEO_MODEL_ID --text "A paper boat on a pond." --state video-job.json
npx --yes tsx examples/run.ts video-status --state video-job.json --out clip.mp4
npx --yes tsx examples/run.ts embeddings --model EMBEDDING_MODEL_ID --file examples/articles.json
npx --yes tsx examples/run.ts rerank --model RERANK_MODEL_ID --text "Where is CSV export?" --file examples/articles.json
```

These commands are **dry-runs**: no model call, key output, or generated-asset claim. Choose actual model ids and supported controls from the live catalog. Add `--live` only for a real request using your own server-held `OPENROUTER_API_KEY`; paid-capable calls are then your responsibility. The samples never bundle credentials.

The video sample saves a job id and checks that same job later. It does not silently submit another paid generation after a reload. Speech reads audio bytes rather than JSON. Retrieval keeps vector model/dimensions and maps rerank indexes to the original articles. The [client-tool dispatcher](examples/client-tools.ts) refuses hosted/unknown tool records before local execution.

[Sample setup, flows and limits](examples/README.md) includes exact commands and the distinction between fixture checks and paid inference.

## Verification evidence

| Evidence | Observed result | Limit |
| - | - | - |
| Offline code regressions | **35 passed**: 10 Python, 12 existing helper tests, 13 worked-sample tests | Synthetic fixtures exercising actual code |
| TypeScript and browser code | New samples pass strict type checking; page script parses | Not a production app build |
| Current official docs/inventory | **113 checks passed**, no warnings, on 2026-11-11 | Selected contracts plus page/operation drift, not every schema change |
| Core behavior cohort | Expanded skill **135/135 gates**, previous release **98/135**, no skill **97/135**; 10 cases × 3 trials per variant | Claude Opus 5.5; bounded recommendations, not autonomous execution; snapshot before final targeted refinements |
| First completed held-out cohort | Candidate **27/30 gates**; the missing original cache-MISS billing explanation remains recorded | Separate Codex cohort; not pooled into the core score |
| Final targeted checks | Cache billing **15/15**, policy/beta **12/12**; fresh file-storage holdout **15/15** | Narrow follow-up cohorts; earlier misses are not overwritten |
| Paid OpenRouter inference | **7 flows passed**, 8 requests, **$0.22931826** on 2026-11-12: streaming, MP3 speech, video, embeddings, rerank, client tools, image | One selected model per flow; [redacted results and billing evidence](docs/paid-smoke.json). Not production or all-provider verification |

[Full results, trial-level misses, token/time costs and methodology](docs/evaluation-summary.json). Core model calls used 11,168 mean input tokens and 19.84 seconds median wall time for the expanded skill. More context had a measurable cost; the report includes baseline costs too. These scores are a bounded quality signal, not universal reliability or independent human certification.

Run the local checks:

```bash
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
npx --yes tsx@4.23.15 --test assets/tests/*.test.ts examples/*.test.ts
node --check docs/app.js
bash -n scripts/install_template.sh assets/tests/smoke-curl.sh assets/tests/smoke-catalogs.sh
```

Check the current official docs without a key:

```bash
python3 scripts/check_openrouter_docs.py --quick --inventory --strict
```

The inventory baseline contains 552 indexed Markdown pages and 174 API operations as reviewed on 2026-11-11. It detects additions/removals, not every semantic change to an existing page or schema. New warnings need review, not an automatic baseline update. Use the [full maintenance workflow](references/docs-check-workflow.md) for a capability refresh.

## Behavioral evaluation

The suite contains representative tasks, failure cases, near-neighbor scope boundaries, and held-out tasks. Each has observable outcome gates. Runs use clean contexts, identical task prompts, three trials per case, and no account/tool side effects. The runner does not see the gates. A separate grader receives shuffled answers without variant labels; human review checks reported failures and evidence.

These evaluations measure bounded integration recommendations with supplied reference context. They do not test automatic skill discovery, a full app build, production deployment, or paid OpenRouter inference. A perfect score on this suite would still not establish universal reliability.

See [the eval procedure](evals/README.md), [public cases and gates](evals/evals.json), and [published results](docs/evaluation-summary.json). Previously held-out cases become regressions after publication; future improvement rounds need fresh holdouts.

## Use the right reference

- API formats, schemas and streaming: [requests and responses](references/requests-and-responses.md).
- Speech, video, embeddings/rerank and files: [media and retrieval](references/multimodal-and-retrieval.md).
- Hosted versus client tools, deferred state and SDKs: [tools](references/tools-and-function-calling.md).
- Routers, provider policy and regional limits: [routing](references/routing-and-fallbacks.md).
- Discounts, response/prompt caching and effective caps: [cost controls](references/discounts-and-cost-controls.md).
- Generation audit, metadata, Broadcast, identity and private inference: [operations](references/operations-and-observability-best-practices.md).

Use the smallest relevant piece. Keep secrets server-side, preserve required state, validate outputs and tool arguments, and distinguish local checks from live evidence. Nothing is activated merely by installing this skill.
