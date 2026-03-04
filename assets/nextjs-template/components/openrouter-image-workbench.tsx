"use client";

import { useMemo, useState } from "react";
import { getGeneratedImageUrls } from "../lib/openrouter/parse-openrouter-response";
import {
  buildImageGenerationRequest,
  type OpenRouterImagePurpose,
} from "../lib/openrouter/openrouter-generated-image-assets";

const PURPOSE_OPTIONS: Array<{ value: OpenRouterImagePurpose; label: string }> = [
  { value: "icon", label: "Icon" },
  { value: "og-image", label: "OG Image" },
  { value: "social-post", label: "Social Post" },
  { value: "story", label: "Story" },
  { value: "banner", label: "Banner" },
];

export function OpenRouterImageWorkbench({
  apiPath = "/api/openrouter/chat",
  model = "google/gemini-3.1-flash-image-preview",
}: {
  apiPath?: string;
  model?: string;
}) {
  const [purpose, setPurpose] = useState<OpenRouterImagePurpose>("icon");
  const [prompt, setPrompt] = useState(
    "A modern tea brand mark built around a glass teacup, soft highlights, clean silhouette, premium feel."
  );
  const [imageUrl, setImageUrl] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [cost, setCost] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const downloadName = useMemo(() => `${purpose}-preview.png`, [purpose]);

  async function generate() {
    if (!prompt.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setError("");
      setImageUrl("");
      setGenerationId("");
      setCost("");

      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildImageGenerationRequest({
            model,
            prompt: prompt.trim(),
            purpose,
          })
        ),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || `Request failed with ${response.status}`);
      }

      const nextImageUrl = getGeneratedImageUrls(json)[0] || "";
      if (!nextImageUrl) {
        throw new Error("No generated image returned");
      }

      setImageUrl(nextImageUrl);
      setGenerationId(json.id || "");
      if (json.usage?.cost != null) {
        setCost(String(json.usage.cost));
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Image generation failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ border: "1px solid #d0d7de", borderRadius: 16, padding: 16, background: "#fff" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>
            Image Workbench
          </div>
          <h3 style={{ margin: 0, fontSize: 22 }}>Generate icons, OG images, and social assets</h3>
          <p style={{ margin: "8px 0 0", color: "#666" }}>
            This starter uses the same OpenRouter chat-completions path for image output. Preview the returned data URL immediately, then persist it server-side or upload it to object storage in production.
          </p>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444" }}>Asset Type</span>
            <select
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as OpenRouterImagePurpose)}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #d0d7de" }}
            >
              {PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#444" }}>Prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #d0d7de" }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={generate}
              disabled={isLoading || !prompt.trim()}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d0d7de" }}
            >
              {isLoading ? "Generating..." : "Generate image"}
            </button>
            {imageUrl && (
              <a
                href={imageUrl}
                download={downloadName}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #d0d7de",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                Download image
              </a>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ color: "crimson", border: "1px solid #f4c2c2", borderRadius: 12, padding: 12 }}>
          {error}
        </div>
      )}

      {imageUrl && (
        <div style={{ display: "grid", gap: 12, border: "1px solid #d0d7de", borderRadius: 16, padding: 16, background: "#fff" }}>
          <img
            src={imageUrl}
            alt={`Generated ${purpose}`}
            style={{ width: "100%", maxWidth: 640, borderRadius: 12, border: "1px solid #e5e7eb" }}
          />

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafbfc" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>Generation ID</div>
              <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{generationId || "n/a"}</div>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fafbfc" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>Cost</div>
              <div style={{ fontWeight: 700 }}>{cost || "n/a"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
