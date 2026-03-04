# Operations And Observability Best Practices

Use this playbook when OpenRouter is becoming part of a real product surface and the team will later ask what happened, what it cost, or why a request behaved differently.

## Always Persist

- generation id
- requested model
- resolved response model
- provider name when available
- prompt or request intent metadata
- usage and cost from the immediate response
- request timestamp

If the workflow creates a durable artifact such as an extracted record or generated image, link that artifact back to the generation id.

## Cost And Audit Rules

- Use `usage.cost` for immediate UX and quick telemetry.
- Use `GET /api/v1/generation?id=...` for exact post-hoc audit.
- Log both normalized token counts and native token counts when available.
- Do not rely on catalog pricing math when you already have a real generation id.
- Keep pricing dashboards separate from per-request debugging views.

## Logging Rules

- Log one canonical line or structured record per request.
- Include enough metadata to explain routing and capability choices later.
- Record whether the request used tools, streaming, files, image input, or image output.
- Record whether a fallback occurred, and which model actually answered.
- Keep secrets and raw private file payloads out of logs.

## Debugging Rules

- Save raw upstream error bodies from non-2xx responses.
- Distinguish validation failures, provider-routing failures, and model-content failures.
- Keep example failing generation ids around for support and regression checks.
- When a user says "this got expensive," look up the generation first before debating estimates.

## Artifact Workflows

- For structured extraction: persist the raw response plus the validated object.
- For generated images: persist the stored asset location plus generation metadata.
- For PDF workflows: keep any reusable annotations if the app will do follow-up turns on the same file.
- For tool loops: persist tool call names and outputs in a replayable form.

## Reliability Rules

- Keep model lists and provider lists cached server-side.
- Put OpenRouter behind your own server route so keys and retries stay under your control.
- Add timeouts around tool execution and any long-running upstream path.
- Prefer small deterministic workflows for high-volume production paths.

## Dashboards Worth Having

- top models by spend
- top providers by spend
- requests with fallbacks
- requests with empty or invalid structured output
- image generations by purpose such as icon, OG image, or social asset
- requests by modality

## What To Avoid

- Throwing away generation ids.
- Logging only display names instead of exact model ids.
- Mixing audit data and UI-only estimates without labeling them clearly.
- Storing raw secrets or private file data in logs.
- Treating routing behavior as invisible when it materially affects cost or reliability.
