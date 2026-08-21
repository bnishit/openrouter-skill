# Image Generation Best Practices

Use OpenRouter image generation when the app needs a generated visual asset on the same integration layer as chat, routing, logging, and cost audit.

## High-Value Use Cases

- App icons and placeholder brand marks
- Open graph images and blog/social preview art
- Social media post visuals and story variants
- Marketing hero art or lightweight campaign banners
- Internal mock visuals for prototypes and admin tooling

## First-Principles Guidance

- Do not treat image generation as a separate vendor path if the app already uses OpenRouter for model discovery and request routing.
- Discover image models from the dedicated Image API catalog and inspect per-endpoint capabilities before exposing controls.
- Persist a returned generation id when available, plus request id, model, provider, usage, and cost. The dedicated Image API does not guarantee a top-level generation id.
- Keep the original prompt and the final stored asset record together. Without that, the generated file becomes operationally opaque.

## Recommended Workflow

1. Discover current image models from `GET /api/v1/images/models`.
2. Inspect `GET /api/v1/images/models/:author/:slug/endpoints` for supported parameters, streaming support, and billable units.
3. Build the request on `POST /api/v1/images` with a model, prompt, and only endpoint-supported controls.
4. Read buffered images from `data[*].b64_json`. For streaming, replace each indexed preview when `image_generation.partial` or `image_generation.completed` arrives, then retain terminal usage.
5. Show the returned data URL immediately for preview or human approval.
6. Persist the approved asset to durable storage.
7. Save generation metadata and returned `usage.cost` alongside the stored asset.
8. Use `GET /api/v1/generation?id=...` later when a generation id is available and exact provider attribution matters.

Chat-completions image output is a legacy compatibility path. Use it only when maintaining an existing integration that depends on a multimodal chat response shape.

## Purpose-Specific Prompting

### Icons

- Ask for a single focal subject and a strong silhouette.
- Avoid tiny text, fine detail, and busy backgrounds.
- Prefer square aspect ratios.
- Expect follow-up manual simplification or vector redraw if the icon becomes a core product asset.

### Open Graph Images

- Leave negative space for the title or product name overlay.
- Prefer wide aspect ratios such as `16:9`, then crop for stricter platform requirements if needed.
- Avoid embedding small text inside the generated image unless the model is being used for text-on-image intentionally and the result will be reviewed.

### Social Images

- Pick the aspect ratio based on destination first, not based on the model default.
- Keep one focal idea per asset. Social images collapse quickly when the prompt tries to do too much.
- Generate several variants when the asset will be user-facing.

## Consumption Pattern

For fast UI feedback:

- Use the returned data URL directly for preview.
- Let a user or calling workflow accept or reject the asset quickly.

For application storage:

- Convert the data URL to bytes.
- Save it to durable object storage or a media service in production.
- Pass the requested model and request or generation id into the persistence helper because the dedicated Image API may omit them from its response.
- Store a metadata row that includes:
  - `generation_id`
  - `model`
  - `prompt`
  - `purpose`
  - `mime_type`
  - `stored_url` or object key
  - `created_at`
  - exact generation cost if later fetched

## Storage Rules

- Do not rely on ephemeral server filesystem storage in production or serverless environments.
- Local disk writes are fine for local development, testing, or short-lived review flows.
- Use stable filenames or object keys derived from purpose plus generation id.
- Keep the original prompt and asset record together so a later regeneration is possible.

## Review And Safety

- Review generated assets before publishing user-facing icons, social cards, or branded materials.
- Keep a human review step for legal marks, logos, product claims, and sensitive imagery.
- Log provider and model choices because image output quality can vary materially across models.

## What Ships In This Skill

- `assets/shared/openrouter-generated-image-assets.ts`
  - request builder for icon, OG image, social post, story, and banner presets
  - data URL parsing and generated asset extraction
- `assets/shared/openrouter-generated-image-assets-node.ts`
  - Node helper for writing approved generated images to disk in local or server-backed flows
- `assets/shared/stream-openrouter-sse.ts`
  - collectors for both chat text streams and dedicated Image API preview/completion events
- `assets/nextjs-template/components/openrouter-image-workbench.tsx`
  - starter UI for prompt, preview, generation id, and download
- `assets/nextjs-template/app/openrouter-image-lab/page.tsx`
  - sample page that uses the image workbench immediately after install

## Practical Rule

Use generated images for speed, exploration, and adaptable content creation. For permanent core brand assets, treat generation as the first draft, not the final source of truth.
