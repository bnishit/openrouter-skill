"use client";

import { useEffect, useMemo, useState } from "react";

type UiModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
  inputModalities: string[];
  outputModalities: string[];
  supportedParameters: string[];
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
  };
};

export function OpenRouterModelPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [models, setModels] = useState<UiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/openrouter/models");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load models");
        if (!cancelled) setModels(json.models || []);
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : "Failed to load models");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((model) =>
      [model.id, model.name, model.provider, model.description].some((field) =>
        field.toLowerCase().includes(q)
      )
    );
  }, [models, query]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, UiModel[]>>((acc, model) => {
      (acc[model.provider] ||= []).push(model);
      return acc;
    }, {});
  }, [filtered]);

  function toggle(modelId: string) {
    onChange(value.includes(modelId) ? value.filter((id) => id !== modelId) : [...value, modelId]);
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #d0d7de", borderRadius: 10 }}
      >
        {value.length ? `${value.length} model(s) selected` : "Select models"}
      </button>

      {open && (
        <div style={{ position: "absolute", zIndex: 10, width: "100%", marginTop: 8, background: "#fff", border: "1px solid #d0d7de", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.12)" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #eee" }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models..."
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #d0d7de", borderRadius: 8 }}
            />
          </div>

          <div style={{ maxHeight: 360, overflow: "auto", padding: 8 }}>
            {loading && <div style={{ padding: 12 }}>Loading models...</div>}
            {!loading && error && <div style={{ padding: 12, color: "crimson" }}>{error}</div>}
            {!loading && !error && Object.entries(grouped).map(([provider, providerModels]) => (
              <div key={provider} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#666", padding: "6px 8px" }}>
                  {provider}
                </div>
                {providerModels.map((model) => {
                  const selected = value.includes(model.id);
                  return (
                    <label key={model.id} style={{ display: "block", padding: 8, borderRadius: 8, background: selected ? "#eef6ff" : "transparent", cursor: "pointer" }}>
                      <input type="checkbox" checked={selected} onChange={() => toggle(model.id)} style={{ marginRight: 8 }} />
                      <strong>{model.name}</strong>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{model.id}</div>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
