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

- Prefer `response_format: { type: "json_schema", ... }` when the model supports structured outputs.
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
