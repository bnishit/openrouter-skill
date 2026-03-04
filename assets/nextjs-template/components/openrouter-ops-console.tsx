"use client";

import { useEffect, useMemo, useState } from "react";

type Provider = {
  slug?: string;
  name?: string;
  display_name?: string;
  status?: string;
  data_collection?: string;
};

type Model = {
  id: string;
  name: string;
  provider: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
  };
};

type Generation = {
  id?: string;
  model?: string;
  provider_name?: string;
  total_cost?: number | string;
  tokens_prompt?: number;
  tokens_completion?: number;
  native_tokens_prompt?: number;
  native_tokens_completion?: number;
  created_at?: string;
  upstream_id?: string;
};

export function OpenRouterOpsConsole({
  providersPath = "/api/openrouter/providers",
  freeModelsPath = "/api/openrouter/free-models",
  generationBasePath = "/api/openrouter/generation",
}: {
  providersPath?: string;
  freeModelsPath?: string;
  generationBasePath?: string;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [freeModels, setFreeModels] = useState<Model[]>([]);
  const [generationId, setGenerationId] = useState("");
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loadingGeneration, setLoadingGeneration] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadingCatalogs(true);
        setError("");

        const [providersRes, freeModelsRes] = await Promise.all([
          fetch(providersPath),
          fetch(freeModelsPath),
        ]);

        const providersJson = await providersRes.json();
        const freeModelsJson = await freeModelsRes.json();

        if (!providersRes.ok) {
          throw new Error(providersJson.error || "Failed to load providers");
        }

        if (!freeModelsRes.ok) {
          throw new Error(freeModelsJson.error || "Failed to load free models");
        }

        if (!cancelled) {
          setProviders(providersJson.providers || []);
          setFreeModels(freeModelsJson.models || []);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load ops data");
        }
      } finally {
        if (!cancelled) {
          setLoadingCatalogs(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [providersPath, freeModelsPath]);

  const providerSummary = useMemo(() => providers.slice(0, 8), [providers]);
  const freeModelSummary = useMemo(() => freeModels.slice(0, 10), [freeModels]);

  async function lookupGeneration() {
    const trimmed = generationId.trim();
    if (!trimmed) return;

    try {
      setLoadingGeneration(true);
      setError("");
      setGeneration(null);

      const res = await fetch(`${generationBasePath}/${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load generation");
      }

      setGeneration(json.generation || null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load generation");
    } finally {
      setLoadingGeneration(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          border: "1px solid #d0d7de",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>
              Ops Console
            </div>
            <h3 style={{ margin: 0, fontSize: 22 }}>Providers, free models, and generation cost</h3>
          </div>
          <div style={{ fontSize: 13, color: "#666" }}>
            Use this as a lightweight admin/debug surface for catalog and billing checks.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ color: "crimson", border: "1px solid #f4c2c2", borderRadius: 12, padding: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div style={{ border: "1px solid #d0d7de", borderRadius: 16, padding: 16, background: "#fff" }}>
          <div style={{ marginBottom: 10 }}>
            <strong>Providers</strong>
            <div style={{ color: "#666", fontSize: 13 }}>
              {loadingCatalogs ? "Loading..." : `${providers.length} providers`}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {providerSummary.map((provider) => (
              <div
                key={provider.slug || provider.name || provider.display_name}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fafbfc",
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {provider.display_name || provider.name || provider.slug || "Provider"}
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                  {provider.slug || "no-slug"} · {provider.status || "status-unknown"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid #d0d7de", borderRadius: 16, padding: 16, background: "#fff" }}>
          <div style={{ marginBottom: 10 }}>
            <strong>Free Models</strong>
            <div style={{ color: "#666", fontSize: 13 }}>
              {loadingCatalogs ? "Loading..." : `${freeModels.length} zero-priced models`}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {freeModelSummary.map((model) => (
              <div
                key={model.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fafbfc",
                }}
              >
                <div style={{ fontWeight: 700 }}>{model.name}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{model.id}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid #d0d7de", borderRadius: 16, padding: 16, background: "#fff" }}>
        <div style={{ marginBottom: 12 }}>
          <strong>Generation Lookup</strong>
          <div style={{ color: "#666", fontSize: 13 }}>
            Fetch exact post-hoc cost and token accounting for a completed generation id.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input
            value={generationId}
            onChange={(event) => setGenerationId(event.target.value)}
            placeholder="gen-..."
            style={{
              flex: "1 1 320px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d0d7de",
            }}
          />
          <button
            type="button"
            onClick={lookupGeneration}
            disabled={loadingGeneration || !generationId.trim()}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d0d7de" }}
          >
            {loadingGeneration ? "Loading..." : "Fetch generation"}
          </button>
        </div>

        {generation && (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {[
              ["Generation ID", generation.id || "n/a"],
              ["Model", generation.model || "n/a"],
              ["Provider", generation.provider_name || "n/a"],
              ["Total Cost", generation.total_cost != null ? String(generation.total_cost) : "n/a"],
              ["Prompt Tokens", generation.tokens_prompt != null ? String(generation.tokens_prompt) : "n/a"],
              ["Completion Tokens", generation.tokens_completion != null ? String(generation.tokens_completion) : "n/a"],
              [
                "Native Prompt Tokens",
                generation.native_tokens_prompt != null ? String(generation.native_tokens_prompt) : "n/a",
              ],
              [
                "Native Completion Tokens",
                generation.native_tokens_completion != null
                  ? String(generation.native_tokens_completion)
                  : "n/a",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafbfc",
                }}
              >
                <div style={{ fontSize: 12, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
