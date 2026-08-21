import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const ALLOWED_QUERY_PARAMS = new Set([
  "q",
  "category",
  "input_modalities",
  "output_modalities",
  "supported_parameters",
  "sort",
  "offset",
  "limit",
  "context",
  "min_price",
  "max_price",
  "min_output_price",
  "max_output_price",
  "min_age_days",
  "max_age_days",
  "min_intelligence_index",
  "max_intelligence_index",
  "min_coding_index",
  "max_coding_index",
  "min_agentic_index",
  "max_agentic_index",
  "min_tool_success_rate",
  "max_tool_success_rate",
  "arch",
  "model_authors",
  "providers",
  "distillable",
  "zdr",
  "region",
]);
const USER_MODEL_QUERY_PARAMS = new Set(["offset", "limit"]);

type OpenRouterModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
    [key: string]: unknown;
  };
  supported_parameters?: string[];
};

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
    [key: string]: unknown;
  };
};

const caches = new Map<string, { at: number; models: UiModel[] }>();

function readCache(key: string) {
  const entry = caches.get(key);
  if (entry && Date.now() - entry.at < CACHE_MS) return entry;
  if (entry) caches.delete(key);
  return null;
}

function writeCache(key: string, models: UiModel[]) {
  caches.set(key, { at: Date.now(), models });
  if (caches.size <= MAX_CACHE_ENTRIES) return;
  const oldest = [...caches.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
  if (oldest) caches.delete(oldest);
}

function providerFromId(id: string) {
  return id.split("/")[0] || "unknown";
}

function mapModel(model: OpenRouterModel): UiModel {
  return {
    id: model.id,
    name: model.name || model.id,
    provider: providerFromId(model.id),
    description: model.description || "",
    contextLength: model.context_length || 0,
    inputModalities: model.architecture?.input_modalities || [],
    outputModalities: model.architecture?.output_modalities || [],
    supportedParameters: model.supported_parameters || [],
    pricing: {
      ...(model.pricing || {}),
      prompt: model.pricing?.prompt || "0",
      completion: model.pricing?.completion || "0",
      image: model.pricing?.image || "0",
      request: model.pricing?.request || "0",
    },
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") === "user" ? "user" : "all";
    const visionOnly = searchParams.get("visionOnly") === "true";
    const unsupportedUserFilters = [...searchParams.keys()].filter(
      (key) => ALLOWED_QUERY_PARAMS.has(key) && !USER_MODEL_QUERY_PARAMS.has(key)
    );
    if (scope === "user" && unsupportedUserFilters.length > 0) {
      return NextResponse.json(
        { error: "User model scope supports only offset and limit filters" },
        { status: 400 }
      );
    }
    const upstreamParams = new URLSearchParams();
    for (const [key, value] of searchParams) {
      const allowed = scope === "user" ? USER_MODEL_QUERY_PARAMS : ALLOWED_QUERY_PARAMS;
      if (allowed.has(key)) upstreamParams.append(key, value);
    }
    upstreamParams.sort();
    const cacheKey = `${scope}:${upstreamParams.toString()}`;
    const cache = readCache(cacheKey);

    if (cache) {
      const models = visionOnly
        ? cache.models.filter((model) => model.inputModalities.includes("image"))
        : cache.models;

      return NextResponse.json({ models, cached: true });
    }

    const endpointBase =
      scope === "user"
        ? "https://openrouter.ai/api/v1/models/user"
        : "https://openrouter.ai/api/v1/models";
    const endpoint = upstreamParams.size
      ? `${endpointBase}?${upstreamParams.toString()}`
      : endpointBase;

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    };

    if (process.env.OPENROUTER_SITE_URL) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    }

    if (process.env.OPENROUTER_APP_NAME) {
      headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;
    }

    const res = await fetch(endpoint, { headers, cache: "no-store" });
    const json = (await res.json()) as { data?: OpenRouterModel[]; error?: unknown };

    if (!res.ok) {
      return NextResponse.json(
        { error: json.error || `OpenRouter error ${res.status}` },
        { status: res.status }
      );
    }

    const models = (json.data || [])
      .map(mapModel)
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));

    writeCache(cacheKey, models);

    return NextResponse.json({
      models: visionOnly ? models.filter((model) => model.inputModalities.includes("image")) : models,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, models: [] }, { status: 500 });
  }
}
