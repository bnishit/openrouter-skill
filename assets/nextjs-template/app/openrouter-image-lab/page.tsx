import { OpenRouterImageWorkbench } from "../../components/openrouter-image-workbench";

export default function OpenRouterImageLabPage() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>
          OpenRouter Skill Demo
        </div>
        <h1 style={{ margin: 0, fontSize: 32 }}>Image Lab</h1>
        <p style={{ margin: "8px 0 0", color: "#666", maxWidth: 760 }}>
          Use this starter page to generate icons, OG images, and social assets through the same OpenRouter chat-completions route you already use for text and multimodal requests.
        </p>
      </div>

      <OpenRouterImageWorkbench />
    </main>
  );
}
