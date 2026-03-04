export type OpenRouterPricing = {
  prompt?: string;
  completion?: string;
  image?: string;
  request?: string;
};

export type OpenRouterModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: OpenRouterPricing;
  supported_parameters?: string[];
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
};

export type OpenRouterProvider = {
  slug?: string;
  name?: string;
  display_name?: string;
  status?: string;
  data_collection?: string;
  [key: string]: unknown;
};

export type OpenRouterGeneration = {
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
  [key: string]: unknown;
};

type OpenRouterListResponse<T> = {
  data?: T[];
  error?: unknown;
};

type OpenRouterGenerationResponse = {
  data?: OpenRouterGeneration;
  error?: unknown;
} & OpenRouterGeneration;

export type OpenRouterFetchOptions = {
  apiKey: string;
  siteUrl?: string;
  appName?: string;
  fetchImpl?: typeof fetch;
};

function assertApiKey(apiKey: string) {
  if (!apiKey) {
    throw new Error("OpenRouter API key is required");
  }
}

function createHeaders(options: OpenRouterFetchOptions) {
  assertApiKey(options.apiKey);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    Accept: "application/json",
  };

  if (options.siteUrl) {
    headers["HTTP-Referer"] = options.siteUrl;
  }

  if (options.appName) {
    headers["X-OpenRouter-Title"] = options.appName;
  }

  return headers;
}

async function fetchOpenRouterJson<T>(
  path: string,
  options: OpenRouterFetchOptions
): Promise<T> {
  const fetchImpl = options.fetchImpl || fetch;
  const res = await fetchImpl(`https://openrouter.ai${path}`, {
    headers: createHeaders(options),
    cache: "no-store",
  });

  const json = (await res.json()) as { error?: unknown };
  if (!res.ok) {
    const message =
      typeof json.error === "string"
        ? json.error
        : `OpenRouter request failed with status ${res.status}`;
    throw new Error(message);
  }

  return json as T;
}

function parsePrice(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function isFreeModel(model: OpenRouterModel): boolean {
  const pricing = model.pricing || {};
  const values = [pricing.prompt, pricing.completion, pricing.request, pricing.image].filter(
    (value): value is string => value != null
  );

  if (values.length === 0) return false;
  return values.every((value) => parsePrice(value) === 0);
}

export async function listModels(options: OpenRouterFetchOptions) {
  const json = await fetchOpenRouterJson<OpenRouterListResponse<OpenRouterModel>>(
    "/api/v1/models",
    options
  );
  return json.data || [];
}

export async function listUserModels(options: OpenRouterFetchOptions) {
  const json = await fetchOpenRouterJson<OpenRouterListResponse<OpenRouterModel>>(
    "/api/v1/models/user",
    options
  );
  return json.data || [];
}

export async function listProviders(options: OpenRouterFetchOptions) {
  const json = await fetchOpenRouterJson<OpenRouterListResponse<OpenRouterProvider>>(
    "/api/v1/providers",
    options
  );
  return json.data || [];
}

export async function listFreeModels(options: OpenRouterFetchOptions) {
  const models = await listModels(options);
  return models.filter(isFreeModel);
}

export async function listImageGenerationModels(options: OpenRouterFetchOptions) {
  const models = await listModels(options);
  return models.filter((model) =>
    model.architecture?.output_modalities?.includes("image")
  );
}

export async function getGeneration(
  generationId: string,
  options: OpenRouterFetchOptions
) {
  if (!generationId) {
    throw new Error("generationId is required");
  }

  const params = new URLSearchParams({ id: generationId });
  const json = await fetchOpenRouterJson<OpenRouterGenerationResponse>(
    `/api/v1/generation?${params.toString()}`,
    options
  );

  return json.data || json;
}

export function summarizeGenerationCost(generation: OpenRouterGeneration) {
  return {
    id: generation.id || null,
    model: generation.model || null,
    provider: generation.provider_name || null,
    totalCost: generation.total_cost ?? null,
    promptTokens: generation.tokens_prompt ?? null,
    completionTokens: generation.tokens_completion ?? null,
    nativePromptTokens: generation.native_tokens_prompt ?? null,
    nativeCompletionTokens: generation.native_tokens_completion ?? null,
    createdAt: generation.created_at || null,
    upstreamId: generation.upstream_id || null,
  };
}
