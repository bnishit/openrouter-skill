# Requests And Responses

## Endpoint Map

- Text, vision input, audio/video input, and PDFs: `POST /api/v1/chat/completions`.
- Image generation: `POST /api/v1/images`.
- Image model discovery: `GET /api/v1/images/models`.

OpenRouter uses an OpenAI-compatible chat schema with OpenRouter-specific extensions such as `plugins`, `models`, `provider`, `transforms`, and extra usage metadata.

## Common Headers

```http
Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json
HTTP-Referer: <your-site-url>
X-OpenRouter-Title: <your-app-name>
```

`X-Title` is still accepted, but the current docs prefer `X-OpenRouter-Title`.

## Text-Only Request

```json
{
  "model": "openai/gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "You are a concise assistant." },
    { "role": "user", "content": "Summarize this invoice in 3 bullets." }
  ],
  "temperature": 0
}
```

## Image Request

For image analysis, send a user message with a content array. Put the text part before the image parts.

```json
{
  "model": "google/gemini-2.5-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Extract all text from this image." },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,<base64>"
          }
        }
      ]
    }
  ]
}
```

Prefer server-generated `data:` URLs for uploads and any untrusted remote asset. Use a remote `http(s)` URL only when the host is explicitly allowlisted and you trust that source not to mutate prompts or content unexpectedly.

## Image Generation Request

For new image-generation work, use the dedicated Image API. Discover models through `GET /api/v1/images/models`, then inspect `GET /api/v1/images/models/:author/:slug/endpoints` because sizes, aspect ratios, streaming, and provider passthrough options differ.

```json
{
  "model": "google/gemini-3.1-flash-image",
  "prompt": "Generate a clean product illustration of a glass teacup on a plain background.",
  "aspect_ratio": "1:1",
  "resolution": "1K",
  "output_format": "png",
  "n": 1
}
```

The buffered response returns `data[*].b64_json`; prepend the reported `media_type` (or `image/png`) to build a preview data URL. Streaming emits typed SSE events and ends with `[DONE]`. Chat-completions image output remains a legacy compatibility path, not the default for new integrations.

## PDF Request

For PDFs, use a `file` content part. Prefer a `data:` URL by default; allow remote `http(s)` URLs only from explicit trusted hosts.

```json
{
  "model": "google/gemini-2.5-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Extract the invoice header and line items." },
        {
          "type": "file",
          "file": {
            "filename": "invoice.pdf",
            "file_data": "data:application/pdf;base64,<base64>"
          }
        }
      ]
    }
  ],
  "plugins": [
    {
      "id": "file-parser",
      "pdf": { "engine": "cloudflare-ai" }
    }
  ]
}
```

If you accept remote PDF URLs, gate them behind a server-side allowlist and log the source host. When the selected model supports file input natively, OpenRouter can pass the file directly; otherwise OpenRouter parses it and forwards parsed content to the model.

## Remote Asset Safety

- Treat remote image and PDF URLs as untrusted input, even when the end user supplied them intentionally.
- Fetch private or user-uploaded assets server-side and convert them to `data:` URLs before forwarding them to OpenRouter.
- If you must support remote `http(s)` asset URLs, use a strict host allowlist such as `OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS=cdn.example.com,images.example.com`.
- Do not let model output or tool output choose a new remote asset URL and then automatically fetch or execute follow-up actions from it without a separate trust check.
- Log the source host, generation id, and downstream action whenever remote content influenced a tool call or structured output.

## PDF Engine Guidance

- `cloudflare-ai`: prefer for clean digital PDFs with extractable text; free. The old `pdf-text` name is deprecated and redirects here.
- `mistral-ocr`: prefer for scanned or image-heavy PDFs; paid.
- `native`: use only when the chosen model supports file input natively.

If you do not specify an engine, OpenRouter defaults first to the model's native file processing when available and otherwise falls back to `mistral-ocr`.

## Reusing PDF Annotations

When a PDF is parsed, the assistant message may include `annotations`. Reuse them on follow-up requests to skip reparsing:

```json
[
  {
    "role": "user",
    "content": [
      { "type": "text", "text": "Summarize this PDF." },
      {
        "type": "file",
        "file": {
          "filename": "invoice.pdf",
          "file_data": "data:application/pdf;base64,<base64>"
        }
      }
    ]
  },
  {
    "role": "assistant",
    "content": "Previous answer",
    "annotations": [
      { "type": "file", "file": { "hash": "...", "content": [] } }
    ]
  },
  {
    "role": "user",
    "content": "Now extract all totals as JSON."
  }
]
```

## Structured Output

Use `response_format` when the app needs machine-readable output.

Basic JSON mode:

```json
{
  "response_format": { "type": "json_object" }
}
```

Strict schema mode:

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "invoice_extract",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "invoice_number": { "type": "string" },
          "total": { "type": "number" }
        },
        "required": ["invoice_number", "total"],
        "additionalProperties": false
      }
    }
  }
}
```

Prefer `json_schema` when the model advertises `structured_outputs`. Fall back to `json_object` otherwise.

## Reasoning And Service Tier

Use the unified `reasoning` object rather than model-name suffixes:

```json
{
  "reasoning": {
    "effort": "low",
    "exclude": false
  },
  "service_tier": "flex"
}
```

Reasoning effort values and whether reasoning is mandatory vary by model; read the catalog's `reasoning` object. Preserve returned `reasoning_details` unchanged when sending tool results or continuing a reasoning turn. Reasoning tokens are billed as output.

`service_tier: "flex"` trades latency and availability for price; `priority` does the reverse. Log the served tier instead of assuming the requested tier was used.

## Streaming Notes

- OpenRouter streams via SSE.
- Ignore comment lines that start with `:`.
- Expect a terminal `[DONE]` marker.
- Expect the final chunk to include aggregated usage data exactly once when usage information is available.
- A stream can still represent an error case even if the initial HTTP status was `200`; parse the whole stream.

## Response Shape

Non-streaming responses are normalized around:

```json
{
  "id": "gen-...",
  "choices": [
    {
      "finish_reason": "stop",
      "native_finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 20,
    "total_tokens": 120,
    "cost": 0.00014
  },
  "model": "openai/gpt-4o-mini"
}
```

Save the top-level `id` when the app needs later audit, billing, or support lookup. That id is what `/api/v1/generation` expects.

Dedicated image-generation responses return base64 assets in `data[*].b64_json`, with optional `media_type`. Legacy chat image responses may instead include `choices[0].message.images[*].image_url.url`.

## Generation Lookup And Cost Audit

Use the original completion response for immediate UX, then use the generation endpoint for exact post-hoc accounting:

```bash
curl -s "https://openrouter.ai/api/v1/generation?id=$GENERATION_ID" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Accept: application/json"
```

Typical fields worth logging when available:

- `total_cost`
- `tokens_prompt`
- `tokens_completion`
- `native_tokens_prompt`
- `native_tokens_completion`
- `provider_name`
- `upstream_id`
- `created_at`

## Parsing Rules

- Read `choices[0]` first, but do not assume only one choice exists.
- For non-streaming responses, read `choices[0].message.content`.
- For dedicated image generation, inspect `data[*].b64_json`; inspect `choices[0].message.images` only on the legacy chat path.
- Some providers or SDK layers may return `message.content` as arrays of typed chunks; flatten them if needed.
- For chat streams, accumulate `choices[0].delta.content`. For dedicated Image API streams, consume `image_generation.partial` and `image_generation.completed` events by image index and retain final `usage`.
- Ignore SSE comment frames when streaming.
- Check `finish_reason` and `native_finish_reason` when diagnosing truncation or provider behavior.
- Log `usage`, including `cost`, for observability.
- Persist the generation `id` if exact later cost lookup matters.
- Handle provider errors from non-2xx responses and also from streamed or embedded error objects when present.

## Common Integration Choices

- Server proxy route: preferred for browser apps.
- `temperature: 0`: preferred for extraction, OCR, and deterministic transforms.
- `stream: true`: preferred for chat UIs; not usually needed for extraction pipelines.
- `tools`: only send when the chosen model advertises tool support.
- `models`: useful when you want model-level fallbacks.
- `provider`: useful when you want provider-level ordering, privacy rules, or max-price constraints.
- `plugins`: use for PDF parsing or response healing when those features materially help the workflow.
