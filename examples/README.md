# Worked Samples

Run from the skill directory. These are server/CLI examples, not browser code. Each command starts in **dry-run** mode: no network request, API key or generated-asset claim. Add `--live` only when you intend to use your own server-held `OPENROUTER_API_KEY` and accept the provider cost. No key is bundled.

Choose real model ids from the live catalog; placeholders below are deliberately not defaults. Check endpoint capabilities and prices before live use. Node 22+ and `tsx` are used by the examples and CI.

| Sample | What it demonstrates | Offline test |
| - | - | - |
| Streaming chat | SSE comments/chunks, terminal errors, a small output cap and generation id | Successful text and a 200 in-stream failure |
| Read-aloud | TTS returns audio bytes, not JSON | Audio result, HTTP failure, wrong content type |
| Generate/resume video | Persist one job id and check it later without duplicate submissions | Submission, polling, trusted download URL construction |
| Article embeddings | Keep vector model/dimensions and original document ordering | Reordered results and invalid dimensions/indexes |
| Client-tool dispatch | Validate and allowlist local function execution; reject hosted/unknown records | Hosted calls and invalid arguments never reach the executor |
| Rerank articles | Rank candidate documents by their original indexes | Out-of-order ranks and invalid/duplicate result indexes |

```bash
npx --yes tsx examples/run.ts stream --model MODEL_ID --text "Explain a response cache in one sentence."
npx --yes tsx examples/run.ts speech --model SPEECH_MODEL_ID --voice SUPPORTED_VOICE --text "Your export is ready." --out reply.mp3
npx --yes tsx examples/run.ts video --model VIDEO_MODEL_ID --text "A paper boat crossing a still pond." --state video-job.json
npx --yes tsx examples/run.ts video-status --state video-job.json --out clip.mp4
npx --yes tsx examples/run.ts embeddings --model EMBEDDING_MODEL_ID --file examples/articles.json
npx --yes tsx examples/run.ts rerank --model RERANK_MODEL_ID --text "Where can I download a CSV?" --file examples/articles.json
```

To make a real request, add `--live` to the chosen command. Output files use exclusive creation and must not already exist. Video submission reserves its state file before sending the paid request, then saves the job id. Resume that file with `video-status`; the sample checks once per invocation rather than hiding an unbounded polling loop. If submission was interrupted before saving an id, inspect your account logs before retrying. A state file is not an upstream idempotency guarantee.

Speech asks for MP3, so choose a model/voice that supports MP3. Some speech models only return PCM. Video options use provider defaults; check durations, references and other controls before extending the payload. Video is not eligible for ZDR.

The examples do not implement a browser login, public proxy authorization, production quotas, durable queueing, callback signature verification, or tenant isolation. They return upstream usage when available; exact billing still needs generation/account evidence.

Run the fixtures:

```bash
npx --yes tsx --test examples/workflows.test.ts
```

Those tests inject synthetic responses into the **actual sample functions**. They prove the local request/response handling exercised by the fixtures. They do not prove a paid model generated speech or video.
