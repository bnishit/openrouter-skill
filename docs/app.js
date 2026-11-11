const sourceRoot =
  "https://github.com/bnishit/skills/blob/main/skills/openrouter-integration/examples/";
const samples = {
  speech: {
    title: "Turn text into playable audio.",
    description:
      "Use the speech endpoint, check its status, and save audio bytes. Choose a model and voice that support MP3.",
    limit:
      "Not every voice supports every format. No paid audio was generated for these tests.",
    command:
      'npx --yes tsx examples/run.ts speech \\\n  --model SPEECH_MODEL_ID --voice SUPPORTED_VOICE \\\n  --text "Your export is ready." --out reply.mp3',
    trace:
      "Dry-run → no request sent. Add --live with your own server-held key to generate audio.",
    source: "workflows.ts",
  },
  video: {
    title: "Resume a job. Don’t buy it twice.",
    description:
      "Save the submitted job id, then check that same job after a reload. Download completed content through the trusted API endpoint.",
    limit:
      "The sample checks status once. An interrupted submission needs account-log review, not a blind resubmit. Video is not eligible for ZDR.",
    command:
      'npx --yes tsx examples/run.ts video \\\n  --model VIDEO_MODEL_ID --text "A paper boat on a pond." \\\n  --state video-job.json\n\nnpx --yes tsx examples/run.ts video-status \\\n  --state video-job.json --out clip.mp4',
    trace:
      "Submit with --live → save job id → resume with video-status --live. A 202 is not a finished video.",
    source: "run.ts",
  },
  search: {
    title: "Find articles before writing answers.",
    description:
      "Create vectors with a recorded model and dimension, retrieve candidates, then map reranked indexes back to the original articles.",
    limit:
      "Changing embedding models may require rebuilding the index. These samples do not add an answer-generation step.",
    command:
      'npx --yes tsx examples/run.ts embeddings \\\n  --model EMBEDDING_MODEL_ID --file examples/articles.json\n\nnpx --yes tsx examples/run.ts rerank \\\n  --model RERANK_MODEL_ID --text "Where is CSV export?" \\\n  --file examples/articles.json',
    trace:
      "Dry-run by default. The fixture tests restore source ordering and reject invalid document indexes.",
    source: "workflows.ts",
  },
  stream: {
    title: "A broken stream must fail clearly.",
    description:
      "Collect Chat Completions text while handling comments, split frames and a provider error inside an HTTP 200 response.",
    limit:
      "The text collector is for Chat Completions. Responses and Messages use different event and content shapes.",
    command:
      'npx --yes tsx examples/run.ts stream \\\n  --model MODEL_ID \\\n  --text "Explain a response cache in one sentence."',
    trace:
      "Dry-run → inspect the plan. The live sample caps output at 128 tokens and retains the generation id.",
    source: "workflows.ts",
  },
  tools: {
    title: "Keep hosted tools off your host.",
    description:
      "Dispatch only registered application functions. Parse and validate arguments before execution. Return the matching tool-call id.",
    limit:
      "This is the local dispatch boundary, not a complete deferred-tool conversation client. Authorization belongs in the application handler.",
    command:
      'import { executeClientFunction } from "./client-tools";\n\n// registry contains only authorized app functions.\nconst result = await executeClientFunction(call, registry);\n\n// Hosted, unknown, or invalid calls never reach execute().',
    trace:
      "Read the actual source and tests. Tool discovery and hosted execution remain separate from local dispatch.",
    source: "client-tools.ts",
    language: "TypeScript · focused source usage",
  },
};
function selectSample(key, focus = false) {
  const sample = samples[key];
  if (!sample) return;
  document.querySelectorAll("[data-sample]").forEach((button) => {
    const selected = button.dataset.sample === key;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  document
    .getElementById("sample-panel")
    .setAttribute("aria-labelledby", `tab-${key}`);
  for (const [id, value] of Object.entries({
    "sample-title": sample.title,
    "sample-description": sample.description,
    "sample-limit": sample.limit,
    "sample-command": sample.command,
    "sample-trace": sample.trace,
    "sample-language": sample.language || "Terminal · from the skill directory",
  }))
    document.getElementById(id).textContent = value;
  document.getElementById("sample-source").href = sourceRoot + sample.source;
}
const tabs = [...document.querySelectorAll("[data-sample]")];
tabs.forEach((button, index) => {
  button.addEventListener("click", () => selectSample(button.dataset.sample));
  button.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectSample(tabs[next].dataset.sample, true);
    }
  });
});
document.querySelectorAll("[data-copy-target]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(
        document.getElementById(button.dataset.copyTarget).textContent,
      );
      const label = button.textContent;
      button.textContent = "Copied";
      document.getElementById("copy-status").textContent = "Command copied";
      setTimeout(() => {
        button.textContent = label;
      }, 1800);
    } catch {
      document.getElementById("copy-status").textContent =
        "Clipboard unavailable. Select and copy the command text.";
    }
  }),
);
fetch("./evaluation-summary.json")
  .then((response) => {
    if (!response.ok) throw new Error("No evaluation record");
    return response.json();
  })
  .then((report) => {
    const chart = document.getElementById("eval-chart");
    chart.replaceChildren();
    for (const variant of ["previous", "no_skill", "candidate"]) {
      const score = report.variants[variant];
      if (
        !score ||
        !Number.isFinite(score.passed_gates) ||
        !Number.isFinite(score.total_gates) ||
        score.total_gates <= 0 ||
        score.passed_gates < 0 ||
        score.passed_gates > score.total_gates
      )
        throw new Error("Invalid evaluation totals");
      const row = document.createElement("div");
      row.className = "eval-bar";
      const label = document.createElement("div");
      label.className = "eval-bar-label";
      const name = document.createElement("span");
      name.textContent = {
        previous: "Previous release",
        no_skill: "No skill",
        candidate: "Expanded skill (core)",
      }[variant];
      const result = document.createElement("span");
      result.textContent = `${score.passed_gates}/${score.total_gates} gates`;
      label.append(name, result);
      const track = document.createElement("div");
      track.className = "eval-track";
      const fill = document.createElement("div");
      fill.className =
        "eval-fill" + (variant === "candidate" ? " candidate" : "");
      fill.style.width = `${(score.passed_gates / score.total_gates) * 100}%`;
      track.append(fill);
      row.append(label, track);
      chart.append(row);
    }
    const note = document.createElement("p");
    note.className = "eval-note";
    note.textContent = `${report.case_count} cases × ${report.trials_per_case} trials × 3 variants. ${report.model}. ${report.reviewed_on}.`;
    chart.append(note);
    const cohorts = report.cohorts;
    const followup = document.createElement("p");
    followup.className = "eval-note";
    const first = cohorts.initial_holdout.variants.candidate;
    const final = cohorts.final_beta_regression.variants.candidate;
    const fresh = cohorts.fresh_holdout.variants.candidate;
    followup.textContent = `Separate Codex checks: first holdout ${first.passed_gates}/${first.total_gates}; final policy/beta ${final.passed_gates}/${final.total_gates}; fresh files holdout ${fresh.passed_gates}/${fresh.total_gates}. Earlier misses remain in the record.`;
    chart.append(followup);
  })
  .catch(() => {
    document.getElementById("eval-chart").textContent =
      "Evaluation record is unavailable. No score is inferred. Inspect the source repository for the release record.";
  });
