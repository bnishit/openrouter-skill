export type OpenRouterPricing = {
  prompt?: string;
  completion?: string;
  image?: string;
  audio?: string;
  request?: string;
  web_search?: string;
  internal_reasoning?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  input_audio_cache?: string;
  discount?: number;
  overrides?: Array<{
    min_prompt_tokens?: number;
    min_context?: number;
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
    input_cache_write?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type OpenRouterModel = {
  id: string;
  canonical_slug?: string;
  name?: string;
  description?: string;
  created?: number;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: OpenRouterPricing;
  supported_parameters?: string[];
  default_parameters?: Record<string, unknown> | null;
  knowledge_cutoff?: string | null;
  expiration_date?: string | null;
  supported_voices?: unknown[] | null;
  alias_target?: {
    name?: string;
    slug?: string;
  };
  reasoning?: {
    mandatory?: boolean;
    default_enabled?: boolean;
    supported_efforts?: string[];
    default_effort?: string;
    supports_max_tokens?: boolean;
  };
  links?: {
    details?: string;
  };
  benchmarks?: Record<string, unknown>;
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
};

export type OpenRouterModelEndpoint = {
  name?: string;
  provider_name?: string;
  tag?: string;
  pricing?: OpenRouterPricing;
  supported_parameters?: string[];
  quantization?: string;
  status?: number;
  uptime_last_30m?: number;
  throughput_last_30m?: Record<string, number>;
  latency_last_30m?: Record<string, number>;
  [key: string]: unknown;
};

export type OpenRouterImageModel = {
  id: string;
  name?: string;
  description?: string;
  created?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  endpoints?: string;
  supported_parameters?: Record<string, unknown>;
  supports_streaming?: boolean;
};

export type OpenRouterImageModelEndpoint = {
  provider_name?: string;
  provider_slug?: string;
  provider_tag?: string;
  pricing?: Array<{
    billable?: string;
    cost_usd?: number;
    unit?: string;
  }>;
  supported_parameters?: Record<string, unknown>;
  allowed_passthrough_parameters?: string[];
  supports_streaming?: boolean;
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
  native_tokens_reasoning?: number;
  native_tokens_cached?: number;
  cache_discount?: number;
  num_search_results?: number;
  num_media_prompt?: number;
  num_media_completion?: number;
  num_audio_prompt?: number;
  router?: string;
  service_tier?: string;
  is_byok?: boolean;
  upstream_inference_cost?: number;
  request_id?: string;
  session_id?: string;
  created_at?: string;
  upstream_id?: string;
  [key: string]: unknown;
};

export type OpenRouterActivityItem = {
  date?: string;
  model?: string;
  model_permaslug?: string;
  endpoint_id?: string;
  provider_name?: string;
  usage?: number;
  byok_usage_inference?: number;
  requests?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
  workspace_id?: string;
};

type OpenRouterListResponse<T> = {
  data?: T[];
  total_count?: number;
  links?: {
    next?: string | null;
  };
  error?: unknown;
};

type OpenRouterObjectResponse<T> = {
  data?: T;
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

export type OpenRouterModelQuery = {
  q?: string;
  category?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  supportedParameters?: string[];
  sort?:
    | "pricing-low-to-high"
    | "pricing-high-to-low"
    | "context-high-to-low"
    | "throughput-high-to-low"
    | "latency-low-to-high"
    | "most-popular"
    | "top-weekly"
    | "newest"
    | "intelligence-high-to-low"
    | "coding-high-to-low"
    | "agentic-high-to-low"
    | "design-arena-elo-high-to-low";
  offset?: number;
  limit?: number;
  minContext?: number;
  minPrice?: number;
  maxPrice?: number;
  minOutputPrice?: number;
  maxOutputPrice?: number;
  minAgeDays?: number;
  maxAgeDays?: number;
  minIntelligenceIndex?: number;
  maxIntelligenceIndex?: number;
  minCodingIndex?: number;
  maxCodingIndex?: number;
  minAgenticIndex?: number;
  maxAgenticIndex?: number;
  minToolSuccessRate?: number;
  maxToolSuccessRate?: number;
  architecture?: string;
  authors?: string[];
  providers?: string[];
  distillable?: boolean;
  zdr?: boolean;
  region?: "eu" | "us";
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

export function isDiscountedPricing(pricing: OpenRouterPricing | undefined) {
  const discount = pricing?.discount;
  return typeof discount === "number" && discount > 0 && discount < 1;
}

export function getUndiscountedPrice(
  effectivePrice: string | undefined,
  discount: number | undefined
) {
  if (!effectivePrice || discount == null || discount <= 0 || discount >= 1) {
    return null;
  }
  const effective = parsePrice(effectivePrice);
  return Number.isFinite(effective) ? effective / (1 - discount) : null;
}

function modelPath(modelId: string, suffix = "") {
  const [author, ...slugParts] = modelId.split("/");
  const slug = slugParts.join("/");
  if (!author || !slug) {
    throw new Error("modelId must use author/slug format");
  }
  return `/api/v1/model/${encodeURIComponent(author)}/${encodeURIComponent(slug)}${suffix}`;
}

function endpointPath(modelId: string) {
  return modelPath(modelId).replace("/api/v1/model/", "/api/v1/models/") + "/endpoints";
}

function modelQuery(query: OpenRouterModelQuery = {}) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.inputModalities?.length) params.set("input_modalities", query.inputModalities.join(","));
  if (query.outputModalities?.length) params.set("output_modalities", query.outputModalities.join(","));
  if (query.supportedParameters?.length) params.set("supported_parameters", query.supportedParameters.join(","));
  if (query.sort) params.set("sort", query.sort);
  if (query.offset != null) params.set("offset", String(query.offset));
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.minContext != null) params.set("context", String(query.minContext));
  if (query.minPrice != null) params.set("min_price", String(query.minPrice));
  if (query.maxPrice != null) params.set("max_price", String(query.maxPrice));
  if (query.minOutputPrice != null) params.set("min_output_price", String(query.minOutputPrice));
  if (query.maxOutputPrice != null) params.set("max_output_price", String(query.maxOutputPrice));
  if (query.minAgeDays != null) params.set("min_age_days", String(query.minAgeDays));
  if (query.maxAgeDays != null) params.set("max_age_days", String(query.maxAgeDays));
  if (query.minIntelligenceIndex != null) params.set("min_intelligence_index", String(query.minIntelligenceIndex));
  if (query.maxIntelligenceIndex != null) params.set("max_intelligence_index", String(query.maxIntelligenceIndex));
  if (query.minCodingIndex != null) params.set("min_coding_index", String(query.minCodingIndex));
  if (query.maxCodingIndex != null) params.set("max_coding_index", String(query.maxCodingIndex));
  if (query.minAgenticIndex != null) params.set("min_agentic_index", String(query.minAgenticIndex));
  if (query.maxAgenticIndex != null) params.set("max_agentic_index", String(query.maxAgenticIndex));
  if (query.minToolSuccessRate != null) params.set("min_tool_success_rate", String(query.minToolSuccessRate));
  if (query.maxToolSuccessRate != null) params.set("max_tool_success_rate", String(query.maxToolSuccessRate));
  if (query.architecture) params.set("arch", query.architecture);
  if (query.authors?.length) params.set("model_authors", query.authors.join(","));
  if (query.providers?.length) params.set("providers", query.providers.join(","));
  if (query.distillable != null) params.set("distillable", String(query.distillable));
  if (query.zdr) params.set("zdr", "true");
  if (query.region) params.set("region", query.region);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function isFreeModel(model: OpenRouterModel): boolean {
  const pricing = model.pricing || {};
  const values = [pricing.prompt, pricing.completion, pricing.request, pricing.image].filter(
    (value): value is string => value != null
  );

  if (values.length === 0) return false;
  return values.every((value) => parsePrice(value) === 0);
}

export async function getModelsPage(
  options: OpenRouterFetchOptions,
  query: OpenRouterModelQuery = {}
) {
  const json = await fetchOpenRouterJson<OpenRouterListResponse<OpenRouterModel>>(
    `/api/v1/models${modelQuery(query)}`,
    options
  );
  return {
    data: json.data || [],
    totalCount: json.total_count ?? null,
    next: json.links?.next ?? null,
  };
}

export async function listModels(
  options: OpenRouterFetchOptions,
  query: OpenRouterModelQuery = {}
) {
  return (await getModelsPage(options, query)).data;
}

export async function countModels(
  options: OpenRouterFetchOptions,
  query: OpenRouterModelQuery = {}
) {
  const json = await fetchOpenRouterJson<OpenRouterObjectResponse<{ count?: number }>>(
    `/api/v1/models/count${modelQuery(query)}`,
    options
  );
  return json.data?.count ?? 0;
}

export async function getModel(
  modelId: string,
  options: OpenRouterFetchOptions
) {
  const json = await fetchOpenRouterJson<OpenRouterObjectResponse<OpenRouterModel>>(
    modelPath(modelId),
    options
  );
  if (!json.data) throw new Error("OpenRouter model response did not include data");
  return json.data;
}

export async function getModelEndpoints(
  modelId: string,
  options: OpenRouterFetchOptions
) {
  const json = await fetchOpenRouterJson<
    OpenRouterObjectResponse<{ id?: string; endpoints?: OpenRouterModelEndpoint[] }>
  >(endpointPath(modelId), options);
  return json.data?.endpoints || [];
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
  const json = await fetchOpenRouterJson<OpenRouterListResponse<OpenRouterImageModel>>(
    "/api/v1/images/models",
    options
  );
  return json.data || [];
}

export async function getImageModelEndpoints(
  modelId: string,
  options: OpenRouterFetchOptions
) {
  const [author, ...slugParts] = modelId.split("/");
  const slug = slugParts.join("/");
  if (!author || !slug) throw new Error("modelId must use author/slug format");
  const json = await fetchOpenRouterJson<{
    id?: string;
    endpoints?: OpenRouterImageModelEndpoint[];
    error?: unknown;
  }>(
    `/api/v1/images/models/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`,
    options
  );
  return json.endpoints || [];
}

export async function findDiscountedModels(
  modelIds: string[],
  options: OpenRouterFetchOptions,
  concurrency = 6
) {
  if (concurrency < 1) throw new Error("concurrency must be at least 1");
  const results: Array<{
    modelId: string;
    maxDiscount: number;
    endpoints: OpenRouterModelEndpoint[];
  }> = [];
  const errors: Array<{ modelId: string; message: string }> = [];
  let cursor = 0;

  async function worker() {
    while (cursor < modelIds.length) {
      const modelId = modelIds[cursor++];
      try {
        const endpoints = (await getModelEndpoints(modelId, options)).filter((endpoint) =>
          isDiscountedPricing(endpoint.pricing)
        );
        if (endpoints.length > 0) {
          results.push({
            modelId,
            maxDiscount: Math.max(...endpoints.map((endpoint) => endpoint.pricing?.discount || 0)),
            endpoints,
          });
        }
      } catch (error) {
        errors.push({
          modelId,
          message: error instanceof Error ? error.message : "Endpoint lookup failed",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, modelIds.length) }, () => worker())
  );
  return {
    results: results.sort((a, b) => b.maxDiscount - a.maxDiscount),
    errors,
  };
}

export function estimateTextCost(
  pricing: OpenRouterPricing,
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    requests?: number;
  }
) {
  const line = (tokens: number | undefined, price: unknown) =>
    (tokens || 0) * (typeof price === "string" ? parsePrice(price) : 0);

  return (
    line(usage.promptTokens, pricing.prompt) +
    line(usage.completionTokens, pricing.completion) +
    line(usage.reasoningTokens, pricing.internal_reasoning || pricing.completion) +
    line(usage.cacheReadTokens, pricing.input_cache_read) +
    line(usage.cacheWriteTokens, pricing.input_cache_write) +
    (usage.requests || 0) * (typeof pricing.request === "string" ? parsePrice(pricing.request) : 0)
  );
}

export async function getCurrentKey(options: OpenRouterFetchOptions) {
  const json = await fetchOpenRouterJson<OpenRouterObjectResponse<Record<string, unknown>>>(
    "/api/v1/key",
    options
  );
  return json.data || {};
}

export async function getCredits(options: OpenRouterFetchOptions) {
  const json = await fetchOpenRouterJson<
    OpenRouterObjectResponse<{ total_credits?: number; total_usage?: number }>
  >("/api/v1/credits", options);
  const totalCredits = json.data?.total_credits ?? 0;
  const totalUsage = json.data?.total_usage ?? 0;
  return {
    totalCredits,
    totalUsage,
    remaining: totalCredits - totalUsage,
  };
}

export async function getActivity(
  options: OpenRouterFetchOptions,
  filters: { date?: string; apiKeyHash?: string; userId?: string } = {}
) {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.apiKeyHash) params.set("api_key_hash", filters.apiKeyHash);
  if (filters.userId) params.set("user_id", filters.userId);
  const query = params.size ? `?${params.toString()}` : "";
  const json = await fetchOpenRouterJson<OpenRouterListResponse<OpenRouterActivityItem>>(
    `/api/v1/activity${query}`,
    options
  );
  return json.data || [];
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
    nativeReasoningTokens: generation.native_tokens_reasoning ?? null,
    cacheDiscount: generation.cache_discount ?? null,
    serviceTier: generation.service_tier ?? null,
    router: generation.router ?? null,
    isByok: generation.is_byok ?? null,
    upstreamInferenceCost: generation.upstream_inference_cost ?? null,
    requestId: generation.request_id ?? null,
    sessionId: generation.session_id ?? null,
    createdAt: generation.created_at || null,
    upstreamId: generation.upstream_id || null,
  };
}
