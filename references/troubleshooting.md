# Troubleshooting

## 401 Or 403 Authentication Errors

Symptoms:
- `401 Unauthorized`
- `403 Forbidden`
- error text mentioning invalid credentials or missing key

Checks:
- Confirm the server is sending `Authorization: Bearer <key>`.
- Confirm the key exists in the server environment, not only in client code.
- Confirm the key is for the correct OpenRouter account and has available credits.

## 402, 429, Or 503 Routing And Capacity Errors

Symptoms:
- `402` insufficient credits
- `429` rate limited
- `503` no available provider meets routing requirements

Checks:
- Add credits or switch to a cheaper model when `402` occurs.
- Back off and retry on `429`; do not hammer the same request loop.
- For `503`, relax `provider.only`, `provider.ignore`, `provider.max_price`, or `provider.require_parameters` if they are over-constraining routing.
- If fallbacks are expected, confirm `allow_fallbacks` is not disabled unintentionally.

## 400 Invalid Request Body

Symptoms:
- `400 Bad Request`
- error text mentioning invalid schema, missing messages, or invalid content

Checks:
- Ensure `model` and `messages` are present.
- For multimodal calls, ensure `content` is an array and each part has the expected shape.
- For images, prefer `image_url.url` with a `data:` URL; use remote `http(s)` URLs only from explicit allowlisted hosts.
- For PDFs, use a `file` part with `filename` and `file_data`.

## Structured Output Fails Or Returns Loose JSON

Symptoms:
- model ignores the schema
- provider rejects `response_format`
- JSON object is incomplete or malformed

Checks:
- Confirm the selected model advertises `structured_outputs` or at least `response_format` in `supported_parameters`.
- Prefer `provider.require_parameters: true` so routing excludes providers that cannot honor the requested parameter.
- Fall back from `json_schema` to `json_object` when the model does not support strict schema output.
- Validate the returned JSON with `assets/shared/validate-structured-output.ts` instead of trusting it blindly.
- If the model output is almost-correct but frequently malformed, consider the response-healing feature documented by OpenRouter.

## Tool Calling Does Not Trigger

Symptoms:
- the assistant answers directly instead of emitting `tool_calls`
- provider rejects the request when `tools` are present

Checks:
- Confirm the model supports tools.
- Keep the `tools` array on every request in the loop, including the follow-up after tool execution.
- Use `tool_choice: "auto"` unless forcing a specific tool is intentional.
- Prefer `provider.require_parameters: true` when tools are mandatory.

## Tool Calling Breaks On The Second Request

Symptoms:
- error after sending tool results
- model forgets available tools
- tool messages are ignored

Checks:
- Include the original assistant `tool_calls` message in the next request.
- Add a `tool` role message with the correct `tool_call_id`.
- Keep the original `tools` array in that follow-up request.
- Stringify tool output rather than sending raw objects.

## PDF Parsing Is Slow Or Wrong

Symptoms:
- OCR quality is poor
- digital text PDFs are expensive or slow
- repeated requests re-parse the same file

Checks:
- Use `cloudflare-ai` for clean digital PDFs. The old `pdf-text` name is deprecated.
- Use `mistral-ocr` for scanned or image-heavy PDFs.
- Use `native` only when the chosen model supports file input natively.
- Reuse assistant `annotations` on follow-up PDF requests to avoid reparsing.

## Empty Assistant Text

Symptoms:
- `choices[0].message.content` is empty
- request succeeded but there is no human-readable text

Checks:
- The model may have returned `tool_calls` instead of prose.
- The content may be an array of typed chunks rather than a plain string.
- Use `assets/shared/parse-openrouter-response.ts` to flatten typed content safely.

## Streaming Looks Broken

Symptoms:
- parser crashes on SSE comments
- tokens arrive in partial fragments
- stream ends without obvious `[DONE]`

Checks:
- Ignore SSE comment lines starting with `:`.
- Accumulate `choices[0].delta.content` across events.
- Keep parsing until the response body closes, not only until the first blank line.
- Use `assets/shared/stream-openrouter-sse.ts` instead of ad hoc parsing.

## Fallbacks Make Results Confusing

Symptoms:
- you requested one model but logs show another
- benchmark results look inconsistent

Checks:
- If `models` fallbacks are enabled, log both the requested model and the resolved response `model`.
- When benchmarking, disable fallbacks or record fallback events explicitly.
- When provider routing is constrained, surface the upstream OpenRouter error instead of collapsing it to a generic 500.

## 200 HTTP Response With An Error-Like Payload

Symptoms:
- request returns HTTP 200 but generation content indicates an issue
- streaming includes a terminal error event or refusal-like payload

Checks:
- Inspect `choices`, `finish_reason`, and provider-specific payload details instead of trusting HTTP status alone.
- Log the full response shape during integration.
- For streaming, capture the final event and not just the first content delta.
