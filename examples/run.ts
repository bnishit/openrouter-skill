import { open, readFile, unlink, writeFile } from "node:fs/promises";
import {
  streamingChat,
  speech,
  submitVideo,
  videoStatus,
  downloadVideo,
  embeddings,
  rerank,
} from "./workflows.ts";

const [command, ...args] = process.argv.slice(2);
function option(name: string, required = true) {
  const index = args.indexOf(`--${name}`);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (required && (!value || value.startsWith("--")))
    throw new Error(`--${name} is required`);
  return value;
}

async function writeNewOutput(
  path: string,
  produce: () => Promise<Uint8Array>,
) {
  const file = await open(path, "wx", 0o600);
  let saved = false;
  try {
    await file.writeFile(await produce());
    saved = true;
  } finally {
    await file.close();
    if (!saved) await unlink(path).catch(() => {});
  }
}

async function main() {
  if (!command || command === "--help") {
    console.log(
      "Samples: stream, speech, video, video-status, embeddings, rerank. Dry-run by default. See examples/README.md for exact commands and limits.",
    );
    return;
  }
  const live = args.includes("--live");
  const model = command === "video-status" ? undefined : option("model");
  const text = ["stream", "speech", "video", "rerank"].includes(command)
    ? option("text")
    : undefined;
  const client = { apiKey: process.env.OPENROUTER_API_KEY || "" };
  let plan: object;
  switch (command) {
    case "stream":
      plan = {
        endpoint: "/chat/completions",
        model,
        prompt: text,
        output: "collected SSE text (128-token cap)",
      };
      break;
    case "speech":
      plan = {
        endpoint: "/audio/speech",
        model,
        input: text,
        voice: option("voice"),
        response_format: "mp3",
        output: option("out"),
      };
      break;
    case "video":
      plan = {
        endpoint: "/videos",
        model,
        prompt: text,
        state: option("state"),
        output: "persist a resumable job id",
      };
      break;
    case "video-status":
      plan = {
        endpoint: "/videos/{saved job id}",
        state: option("state"),
        output: option("out", false) || "status only",
      };
      break;
    case "embeddings":
    case "rerank":
      plan = {
        endpoint: command === "embeddings" ? "/embeddings" : "/rerank",
        model,
        file: option("file"),
        ...(text ? { query: text } : {}),
      };
      break;
    default:
      throw new Error(`Unknown sample: ${command}`);
  }
  if (!live) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          note: "No request sent; no credentials read into output. Add --live to make a paid-capable request.",
          ...plan,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (!client.apiKey)
    throw new Error("OPENROUTER_API_KEY is required for live calls");
  if (command === "stream")
    console.log(JSON.stringify(await streamingChat(model!, text!, client)));
  if (command === "speech") {
    let result: Awaited<ReturnType<typeof speech>> | undefined;
    await writeNewOutput(option("out")!, async () => {
      result = await speech(model!, text!, option("voice")!, client);
      return result.audio;
    });
    console.log(
      JSON.stringify({
        saved: option("out"),
        contentType: result!.contentType,
        generationId: result!.generationId,
      }),
    );
  }
  if (command === "video") {
    const state = option("state")!;
    // Reserve the state file before a paid submission; never overwrite an existing job.
    await writeFile(state, JSON.stringify({ status: "submitting", model }), {
      flag: "wx",
      mode: 0o600,
    });
    const job = await submitVideo(model!, text!, client);
    await writeFile(state, JSON.stringify({ ...job, model }), { mode: 0o600 });
    console.log(
      JSON.stringify({
        saved: state,
        id: job.id,
        status: job.status,
        next: "Resume with video-status; do not submit the same job again.",
      }),
    );
  }
  if (command === "video-status") {
    const state = JSON.parse(await readFile(option("state")!, "utf8"));
    if (!state.id)
      throw new Error(
        "State has no job id. Submission may have been interrupted: inspect account logs before retrying.",
      );
    const job = await videoStatus(state.id, client);
    console.log(
      JSON.stringify({
        id: state.id,
        status: job.status,
        generationId: job.generation_id,
        usage: job.usage,
      }),
    );
    if (job.status === "completed" && option("out", false)) {
      await writeNewOutput(option("out")!, () =>
        downloadVideo(state.id, client),
      );
    }
    if (["failed", "expired", "cancelled"].includes(job.status))
      throw new Error(`Video job ended: ${job.status}`);
  }
  if (command === "embeddings" || command === "rerank") {
    const documents = JSON.parse(await readFile(option("file")!, "utf8"));
    if (
      !Array.isArray(documents) ||
      !documents.length ||
      documents.some((item) => typeof item !== "string")
    )
      throw new Error("--file must contain a non-empty JSON string array");
    const result =
      command === "embeddings"
        ? await embeddings(model!, documents, client)
        : await rerank(model!, text!, documents, client);
    console.log(JSON.stringify(result, null, 2));
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
