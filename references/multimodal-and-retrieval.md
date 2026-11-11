# Media, Retrieval, And Files

Checked against official docs and OpenAPI on 2026-11-11. These are integration recipes, not extra starter routes. Use a server-held key, inspect `res.ok` before decoding, and discover the chosen model's controls live. Apply the same trusted-asset policy as the chat starter to media URLs.

## Pick the output contract

| Job | Request | Success response | Discovery |
| - | - | - | - |
| Image | `POST /api/v1/images` | JSON `data[*].b64_json`, `media_type`, usage | `/api/v1/images/models` and per-model endpoints |
| Video | `POST /api/v1/videos` | `202`: job `id`, `polling_url`, status | `/api/v1/videos/models` |
| Speak text | `POST /api/v1/audio/speech` | Raw audio bytes; read `Content-Type`, `X-Generation-Id` | `/api/v1/models?output_modalities=speech` |
| Transcribe | `POST /api/v1/audio/transcriptions` | JSON `text`, optional usage/timestamps | Models with audio input and text output |
| Embed | `POST /api/v1/embeddings` | JSON `data[*].embedding` and usage | `/api/v1/embeddings/models` |
| Rerank | `POST /api/v1/rerank` | JSON ranked results with original document indexes | Model catalog, then per-model support |

Do not call `.json()` on a successful speech response. Chat audio is a different API: `modalities`/`audio` and `input_audio` parts belong to its chat contract. Image generation is distinct from image understanding; video generation is distinct from sending a video as input.

## Video: submit → wait → download

1. Inspect supported durations, resolutions, aspect ratios, sizes, audio support, prices, and `allowed_passthrough_parameters` from the video catalog. Validate the chosen controls before submitting.
2. Submit `{ model: selectedModelId, prompt, duration, resolution, aspect_ratio }` to `/videos`. Persist job id, requested model, prompt intent, and eventual `generation_id`.
3. Poll `/videos/{jobId}` with bounded waiting/backoff. `pending` and `in_progress` are not finished. Handle `failed`, `cancelled`, and `expired`, not just `completed`. Start around 30 seconds between polls; do not resubmit because a job is slow.
4. Download `/videos/{jobId}/content?index=0` server-side with the bearer token, or use returned signed `urls` until `expires_at`. `unsigned_urls` require authentication. Do not expose the API key to a video player; signed URLs are also secrets while valid.
5. Save the result and its cost before relying on provider retention.

For exact first/last frames, use `frame_images` with `frame_type`; for visual guidance use `input_references`. If both are sent, frame images take precedence. Veo's provider options nest under `parameters`; other models generally take allowed keys directly under the matched provider slug. Read that model's contract rather than copying Veo's shape.

An HTTPS `callback_url` can replace polling. Verify `X-OpenRouter-Signature` with HMAC-SHA256 over `timestamp + ',' + rawBody`; reject stale **and future** timestamps, compare safely, and deduplicate with `X-OpenRouter-Idempotency-Key`. Keep polling as recovery. No webhook receiver is included here.

Video is not eligible for ZDR (zero data retention). Do not suggest it for a flow that requires ZDR. Review regional availability separately.

## Speech and transcription

Speech request shape:

```ts
const payload = {
  model: selectedSpeechModelId,
  input: "Your booking request has been received.",
  voice: selectedVoice,
  response_format: "mp3", // only if this model supports mp3
};
// POST /api/v1/audio/speech, then read arrayBuffer(), not json().
```

The default format is PCM, not MP3. Voice names, supported formats, instructions, and speed controls vary. Check `supported_voices` and the endpoint. Some models accept multi-speaker `input` turns. Voice cloning/design uses `input_references`; check `supports_voice_cloning`, `supports_multiple_audio_references`, and `supports_image_reference` per endpoint. Do not assume every provider serving the same model supports those features. Only use a reference voice the user is authorized to use.

Transcription JSON shape:

```ts
const payload = {
  model: selectedTranscriptionModelId,
  input_audio: { data: rawBase64Audio, format: "wav" },
  response_format: "verbose_json",
  timestamp_granularities: ["word"],
};
// POST /api/v1/audio/transcriptions. input_audio.data is raw base64, not a data URI.
```

OpenAI-compatible multipart (`file`, `model`, optional language and timestamps) is also supported. JSON `input_audio.url` is provider-dependent. `text`, `srt`, and `vtt` output formats are rejected; use `json` or `verbose_json`. Diarization and word timestamps depend on endpoint support; discover `supports_diarization` and read the selected provider's options. Split long recordings instead of assuming one long request will complete.

Speech/transcription accept privacy controls and provider-specific options, but routing `order`, `only`, and `ignore` are not applied as on Chat Completions. Do not promise that a chat provider-pinning rule also pins audio.

## Embeddings and rerank

Embeddings turn text or supported image content into vectors for search; rerank reorders retrieved candidates for a query. Neither generates an answer.

```ts
const embeddingRequest = { model: selectedEmbeddingModelId, input: ["Venue opening hours", "Parking directions"] };
const rerankRequest = { model: selectedRerankModelId, query: "Where can I park?", documents: ["Venue opening hours", "Parking directions"], top_n: 1 };
```

Discover dimensions, input limits, and multimodal support. Persist the embedding model and dimension with the index; switching models requires checking compatibility or rebuilding the index. Map rerank result indexes back to the original documents. A successful empty retrieval is not evidence for a model-generated answer. Keep provider controls and returned cost with the retrieval request.

## Files and Containers (beta)

The Files API uploads workspace assets, including PDFs, images, Office files, audio, and UTF-8 text; it is not a general backup store. Upload via multipart `POST /files`; preserve your original. Workspace files do not expire. Current limits are 100 MiB per file and 10 GiB per workspace; recheck before designing an upload screen.

An uploaded `or_file_…` is used within supported OpenRouter sandboxes; it is **not** a drop-in replacement for a chat `file_data` PDF or a universally downloadable URL. Uploaded files cannot be downloaded directly. Model-created/promoted files can be downloadable. Discover the file metadata and supported request contract.

Shell/bash containers are isolated Linux environments with persisted files. Keep the returned `container_id` and replay tool state when continuing; do not mix tenants' sessions. Container files expire 30 days after last use; promote needed output via `/containers/{container_id}/files/{file_id}/promote` to workspace storage. Files/hosted containers are global-only; regional endpoints reject them.

## Sources

[Video](https://openrouter.ai/docs/guides/overview/multimodal/video-generation.md), [speech](https://openrouter.ai/docs/guides/overview/multimodal/tts.md), [transcription](https://openrouter.ai/docs/guides/overview/multimodal/stt.md), [chat audio](https://openrouter.ai/docs/guides/overview/multimodal/audio.md), [video input](https://openrouter.ai/docs/guides/overview/multimodal/videos.md), [embeddings](https://openrouter.ai/docs/api_reference/embeddings.md), [rerank](https://openrouter.ai/docs/api/api-reference/rerank/submit-a-rerank-request.md), [Files](https://openrouter.ai/docs/guides/features/files-api.md), [Containers](https://openrouter.ai/docs/guides/features/containers.md).
