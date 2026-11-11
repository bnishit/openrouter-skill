# Behavioral Evaluation

This evaluates whether the skill helps an agent recommend the right OpenRouter integration. It is separate from unit tests and live paid inference. The recurring job is API/SDK choice, request/response handling, state, execution ownership, cost and compatibility decisions across projects. It should not activate for unrelated frontend styling or payment-provider work.

The closest alternatives are official Client/Agent SDK skills and OpenRouter docs. This package adds a cross-API choice map, starter/sample boundaries, production failure rules and evidence checks; it should defer to owning official contracts instead of duplicating SDK documentation.

## Suite

`evals.json` contains 13 synthetic, general-purpose cases and 60 outcome gates: ordinary integrations, plausible failures, scope boundaries, and held-out tasks. The initial gates were frozen before running. A fresh file-storage holdout was added and frozen after the two bounded correction rounds; it had not been run or graded before those changes. They test outcomes, not preferred wording. No private prompts, real account identifiers, keys, or transcripts are included.

- A runner receives the exact user task and a context bundle containing the variant's `SKILL.md` and the named available references. It does not receive the gates or expected winner.
- Variants are previous release, candidate, and no skill. Missing references in the previous version stay missing; current docs are not secretly added to its context.
- Skills auto-discovery, tools, network and mutations are disabled. Recommendations/code sketches are the artifacts; this is not an autonomous app-build or automatic-skill-trigger test.
- Each case is repeated three times. A separate clean context sees shuffled A/B/C answers and the rubric, not variant names. It grades each gate with evidence.
- Model grading is a diagnostic, not deterministic truth. The same model family grades each cohort; the author reviews failures, uncertainty and evidence. This is not independent human or cross-model certification.

## Reproduce or extend

Freeze the baseline and candidate skill folders outside the package, preserving `SKILL.md` and `references`. The published record names the original commits and instruction hashes. Use a compatible authenticated Claude Code or Codex CLI. Model CLI calls can consume account quota or API budget; the harness does not ask for or print keys.

Start with a plan (no model called, no output written):

```bash
python3 evals/run.py --output /tmp/openrouter-eval --baseline /path/to/frozen-previous
```

Run the core cases, then blind-grade the saved answers:

```bash
python3 evals/run.py --output /tmp/openrouter-eval --baseline /path/to/frozen-previous --candidate /path/to/frozen-candidate --execute
python3 evals/run.py --output /tmp/openrouter-eval --mode grade --execute
```

Freeze all changes before testing holdouts. Use the same runner/model within each comparison cohort:

```bash
python3 evals/run.py --output /tmp/openrouter-holdout --baseline /path/to/frozen-previous --candidate /path/to/frozen-candidate --runner codex --phase holdout --execute
python3 evals/run.py --output /tmp/openrouter-holdout --runner codex --phase holdout --mode grade --execute
```

Raw prompts, model answers, usage, wall times, CLI errors and grades stay in the chosen work directory, outside the skill. The harness resumes already recorded trials. A runner failure or invalid grading record is an infrastructure issue to investigate, not a failed or passed skill gate. Do not grade quota-limit messages as recommendations. Keep run directories isolated when changing the skill/model; do not replace previous evidence silently.

Both adapters use CLI defaults and record the returned model metadata where exposed. Codex's JSON stream does not expose the resolved model in this harness; record an identical CLI configuration's model header separately before a cohort. Defaults can change. The Codex adapter uses an under-development flag to suppress host skill discovery; verify compatibility after CLI updates and invalidate any trial that uses tools unexpectedly.

## 2026-11-11 release

See [published results](../docs/evaluation-summary.json) for actual scores, cohort models, tokens/time, case-level trials, retained development failures and limits. Core runs used Claude Code 2.1.296. Its quota interrupted the original holdout attempt; failed calls were not scored. Held-out tasks were rerun across all variants in a separate Codex CLI 0.163.0 cohort. The cohorts are reported separately, not mixed into one headline percentage.

One development weakness concerned a generic tool loop without an explicit local-dispatch boundary. The retained change says to run only allowlisted app functions locally and to treat hosted tool records separately; `examples/client-tools.ts` and its fixtures exercise that boundary. A generic all-capabilities proxy was not added: capability guidance and shipped starter scope remain distinct.

A grader initially returned incomplete label sets. Those records were rejected and retried with a constrained label schema; they were not counted as model-quality failures. Paid OpenRouter inference, production end-to-end behavior, automatic skill selection, and broad reliability across agents/models remain unverified. Published holdouts are future regression cases, not reusable “unseen” evidence; add fresh ones for the next improvement round.

## Release gates

Keep a skill change only when affected cases and a small regression set show a gain without a severe new failure. Preserve baseline results, failed trials, token/time costs and any reviewer disagreements. Do not market a passing folder validator or one happy example as proof of behavioral reliability.

Method sources: [Agent Skills evaluation](https://agentskills.io/skill-creation/evaluating-skills), [Anthropic agent evaluations](https://www.anthropic.com/research/demystifying-evals-for-ai-agents).
