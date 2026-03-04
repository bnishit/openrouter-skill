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
- Choose image-output models from the live model catalog by checking `architecture.output_modalities` for `image`.
- Persist the top-level generation id every time. Later cost audit, support triage, or asset provenance work all depend on it.
- Keep the original prompt and the final stored asset record together. Without that, the generated file becomes operationally opaque.

## Recommended Workflow

1. Discover current image-output models from `/api/v1/models`.
2. Build the request on `POST /api/v1/chat/completions` with:
   - normal `messages`
   - `modalities` that include `image`
   - `image_config` for output shape and quality-related settings supported by the model
3. Read generated images from `choices[0].message.images`.
4. Show the returned data URL immediately for preview or human approval.
5. Persist the approved asset to durable storage.
6. Save generation metadata alongside the stored asset.
7. Use `GET /api/v1/generation?id=...` later when exact cost or provider attribution matters.

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
- `assets/nextjs-template/components/openrouter-image-workbench.tsx`
  - starter UI for prompt, preview, generation id, and download
- `assets/nextjs-template/app/openrouter-image-lab/page.tsx`
  - sample page that uses the image workbench immediately after install

## Practical Rule

Use generated images for speed, exploration, and adaptable content creation. For permanent core brand assets, treat generation as the first draft, not the final source of truth.
