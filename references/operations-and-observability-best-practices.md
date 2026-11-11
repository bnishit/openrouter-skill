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
- Use `GET /api/v1/key` for current-key headroom, `GET /api/v1/credits` for account-wide balance, and management-key-only `GET /api/v1/activity` for the last 30 completed UTC days grouped by endpoint.
- Alert before a background queue reaches either its daily dollar cap or the account's low-balance threshold.

## Router Decisions And Broadcast

Request `X-OpenRouter-Metadata: enabled` to receive `openrouter_metadata` on supported completion APIs. It explains requested/resolved routing, attempts, candidates, plugins/guardrails, and server-tool work. Read it on errors and terminal stream frames too. Cache hits omit it; never invent a routing decision when it is absent. Decode additive stages/fields permissively. The starter proxies currently do not expose a general metadata/header passthrough.

[Broadcast](https://openrouter.ai/docs/guides/features/broadcast.md) exports traces to destinations such as OpenTelemetry, PostHog, Langfuse, S3, and other supported platforms. It is an alternative to adding every tracing client to your app, not a substitute for storing your business outcome. It supports key filters, sampling, and destination-specific field controls. Privacy Mode removes prompt/completion content and error text, but custom metadata can still disclose private data: review every exported field. Configure only after the destination and data-sharing scope are authorized.

Use [Logs](https://openrouter.ai/docs/guides/features/logs.md) for individual requests, [Activity](https://openrouter.ai/docs/guides/features/activity.md) for usage trends, and `/analytics/meta` + `/analytics/query` for supported programmatic dimensions/metrics. Do not assume dashboard fields are identical to the activity API. Public `/datasets/*` rankings/session-cost data has its own CC BY 4.0 attribution requirement and is not your account billing data.

[Router metadata](https://openrouter.ai/docs/guides/routing/routers/router-metadata.md), [analytics](https://openrouter.ai/docs/api/api-reference/analytics/get-available-analytics-metrics-and-dimensions.md).

## Logging Rules

- Log one canonical line or structured record per request.
- Include enough metadata to explain routing and capability choices later.
- Record whether the request used tools, streaming, files, image input, or image output.
- Record whether a fallback occurred, and which model actually answered.
- Record request id, session id, router, service tier, BYOK state, cache discount, and endpoint promotion when they affect cost or routing.
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
- account activity that does not reconcile to application generation records
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

## Configuration, Identity, And Private Inference

[Presets](https://openrouter.ai/docs/guides/features/presets.md) move prompts, model/router/provider settings, tools, and optional cache settings into named versioned configurations. Reference `@preset/slug` using the chosen API's format. Read merge/override rules before using them; do not silently move a production app to a mutable preset. API creation requires an appropriately scoped management key.

For user-paid inference, [OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth.md) returns a user-controlled OpenRouter key; bind the callback/state and keep the key protected. [Workload identity](https://openrouter.ai/docs/guides/overview/auth/workload-identity-federation.md) exchanges an issuer JWT at `/oauth/token` for short-lived access on eligible plans; it needs configured trust/policies and is separate from the PKCE key flow. [Management keys](https://openrouter.ai/docs/guides/overview/auth/management-api-keys.md) are for administration, not the browser or a general public inference proxy.

[External users](https://openrouter.ai/docs/api/api-reference/external-users/list-registered-external-users.md) attach app end-user identity to keys/requests for attribution and controls. Current routes are `/external-users`; `/end-users` was renamed in October 2026. SSO and SCIM map organization/workspace access; they do not replace your app’s login or record authorization.

[Private endpoints](https://openrouter.ai/docs/guides/routing/private-endpoints.md) and private providers let approved organizations route to their own deployments. They require entitlement and scoped BYOK configuration. Draft → validate → activate is the routing lifecycle; a draft is not live. Use the current merge-patch update API; removed pricing/parameter PUT aliases must not be copied from older examples. Review deployment-region and retention claims yourself for BYOK/private endpoints.
