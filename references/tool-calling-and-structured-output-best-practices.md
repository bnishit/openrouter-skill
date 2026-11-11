# Tool Calling And Structured Output Best Practices

Use this playbook when the app needs reliable agent behavior, not just a successful single demo response.

## Tool Calling Rules

- Keep tool schemas tight and machine-oriented.
- Set `additionalProperties: false` unless there is a real reason not to.
- Validate parsed arguments before executing the real tool.
- Return structured tool results as JSON strings, not raw objects.
- Keep the same `tools` array on every request in the loop.
- Cap the number of tool turns so a bad loop does not run forever.

## Tool Design Rules

- Prefer narrow tools that do one deterministic job well.
- Keep function names stable and explicit.
- Avoid one giant "do_everything" tool that forces the model to guess too much.
- If the downstream system is high-stakes, let the tool handle retries and timeouts, not the model.
- Surface tool failures back to the model in structured form so the loop can recover or explain itself.

## Structured Output Rules

- For Chat Completions use `response_format.json_schema`; for Responses use `text.format`. Check schema support per endpoint.
- Fall back to `json_object` only when schema enforcement is unavailable or unnecessary.
- Validate the final parsed JSON with a real runtime schema such as `zod`.
- Fail loudly when the model returns empty content instead of pretending the parse succeeded.
- Keep business-critical extraction schemas small and explicit.

## Practical Validation Flow

1. Ask for schema-shaped JSON.
2. Read the assistant content from the response.
3. Parse it as JSON.
4. Validate it with a runtime schema.
5. On failure, either retry with a more constrained instruction or surface the validation error cleanly.

This is the pattern already supported by `assets/shared/validate-structured-output.ts`.

## Production Loop Rules

- Log requested tool names and validated arguments.
- Log the final resolved model because routing can change which model answered.
- Separate tool execution errors from model formatting errors.
- Keep tool-call traces attached to the request or conversation record.
- When the output feeds another system, persist both the raw assistant text and the validated structured object.

## Good Default Policies

- `parallel_tool_calls: false` unless the tools are truly independent and concurrency-safe.
- `temperature: 0` for extraction, tool selection, and deterministic workflow steps.
- `provider.require_parameters: true` when tools or structured outputs are mandatory.
- Schema validation at the app boundary, not only in tests.

## What To Avoid

- Dropping `tools` after the first tool turn.
- Executing unvalidated tool arguments.
- Treating invalid JSON as if it were a successful structured response.
- Returning free-form prose from tools that should return machine-readable data.
- Mixing side-effecting tools with exploratory tools without clear boundaries.

## Current Structured Output And Policy Controls

Responses schema format is `text.format: { type: "json_schema", name, strict, schema }`. Response Healing repairs malformed **non-streaming** JSON; it is not schema/business-rule validation. Keep runtime validation after healing. [Structured output](https://openrouter.ai/docs/guides/features/structured-outputs.md), [healing](https://openrouter.ai/docs/guides/features/plugins/response-healing.md).

**Alignment** (beta since October 2026) checks assistant messages against per-request rules. `audit` reports; `enforce` can block/retry and fail when retries run out. It adds evaluator/retry cost and latency. Keep `alignment` results and handle its 403/stream error path. It evaluates output, so it does not replace input guardrails or deterministic business checks. Recheck its prerequisites and API compatibility before enabling. [Alignment](https://openrouter.ai/docs/guides/features/plugins/alignment.md).

**Armor** (beta since October 2026) classifies tool calls against `hard_deny`, `soft_deny`, and `allow` rules. `audit` releases flagged calls; `enforce` blocks according to its output contract. On Messages in `claude_code_compatibility` mode, a flagged `tool_use` can remain in the response: **your client must inspect `safeguard_results` and refuse execution**. A client that ignores it can still execute the call. Preserve typed `openrouter:armor_blocked` history when using Responses custom items. Classifiers do not replace application authorization. If your design requires Armor approval, a missing, unavailable, unmappable or unknown verdict is not approval. Do not invent a runnable parser from guessed field names: obtain the current response schema first, or show pseudocode that stops safely. [Armor](https://openrouter.ai/docs/guides/features/plugins/armor.md).
