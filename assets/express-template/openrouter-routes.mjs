import express from "express";

export const openrouterRouter = express.Router();

const CACHE_MS = 60 * 60 * 1000;
const MAX_MODEL_CACHE_ENTRIES = 100;
const ALLOWED_MODEL_QUERY_PARAMS = new Set([
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
const modelCaches = new Map();
let providersCache = null;

function readModelCache(key) {
  const entry = modelCaches.get(key);
  if (entry && Date.now() - entry.at < CACHE_MS) return entry;
  if (entry) modelCaches.delete(key);
  return null;
}

function writeModelCache(key, models) {
  modelCaches.set(key, { at: Date.now(), models });
  if (modelCaches.size <= MAX_MODEL_CACHE_ENTRIES) return;
  const oldest = [...modelCaches.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
  if (oldest) modelCaches.delete(oldest);
}

function parseAllowedRemoteAssetHosts(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isRemoteHttpUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowlistedRemoteAsset(value, allowedHosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function collectRemoteAssetViolations(input, allowedHosts, path = "messages", violations = []) {
  if (Array.isArray(input)) {
    input.forEach((value, index) => {
      collectRemoteAssetViolations(value, allowedHosts, `${path}[${index}]`, violations);
    });
    return violations;
  }

  if (!input || typeof input !== "object") {
    return violations;
  }

  const imageUrl = input.image_url?.url;
  if (typeof imageUrl === "string" && isRemoteHttpUrl(imageUrl) && !isAllowlistedRemoteAsset(imageUrl, allowedHosts)) {
    violations.push(`${path}.image_url.url -> ${imageUrl}`);
  }

  const fileData = input.file?.file_data;
  if (typeof fileData === "string" && isRemoteHttpUrl(fileData) && !isAllowlistedRemoteAsset(fileData, allowedHosts)) {
    violations.push(`${path}.file.file_data -> ${fileData}`);
  }

  for (const [key, value] of Object.entries(input)) {
    collectRemoteAssetViolations(value, allowedHosts, `${path}.${key}`, violations);
  }

  return violations;
}

function providerFromId(id) {
  return id.split("/")[0] || "unknown";
}

function mapModel(model) {
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

function parsePrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isFreeModel(model) {
  const values = Object.values(model.pricing || {});
  return values.length > 0 && values.every((value) => parsePrice(value) === 0);
}

function buildHeaders() {
  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (process.env.OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }

  if (process.env.OPENROUTER_APP_NAME) {
    headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;
  }

  return headers;
}

openrouterRouter.get("/models", async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    const scope = req.query.scope === "user" ? "user" : "all";
    const visionOnly = req.query.visionOnly === "true";
    const unsupportedUserFilters = Object.keys(req.query).filter(
      (key) => ALLOWED_MODEL_QUERY_PARAMS.has(key) && !USER_MODEL_QUERY_PARAMS.has(key)
    );
    if (scope === "user" && unsupportedUserFilters.length > 0) {
      return res.status(400).json({ error: "User model scope supports only offset and limit filters" });
    }
    const upstreamParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      const allowed = scope === "user" ? USER_MODEL_QUERY_PARAMS : ALLOWED_MODEL_QUERY_PARAMS;
      if (allowed.has(key) && typeof value === "string") {
        upstreamParams.append(key, value);
      }
    }
    upstreamParams.sort();
    const cacheKey = `${scope}:${upstreamParams.toString()}`;
    const modelsCache = readModelCache(cacheKey);

    if (modelsCache) {
      const models = visionOnly
        ? modelsCache.models.filter((model) => model.inputModalities.includes("image"))
        : modelsCache.models;
      return res.json({ models, cached: true });
    }

    const endpointBase = scope === "user"
      ? "https://openrouter.ai/api/v1/models/user"
      : "https://openrouter.ai/api/v1/models";
    const endpoint = upstreamParams.size
      ? `${endpointBase}?${upstreamParams.toString()}`
      : endpointBase;

    const upstream = await fetch(endpoint, { headers: buildHeaders() });
    const json = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }

    const models = (json.data || [])
      .map(mapModel)
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));

    writeModelCache(cacheKey, models);

    return res.json({
      models: visionOnly ? models.filter((model) => model.inputModalities.includes("image")) : models,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message, models: [] });
  }
});

openrouterRouter.get("/providers", async (_req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    if (providersCache && Date.now() - providersCache.at < CACHE_MS) {
      return res.json({ providers: providersCache.providers, cached: true });
    }

    const upstream = await fetch("https://openrouter.ai/api/v1/providers", {
      headers: buildHeaders(),
    });
    const json = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }

    const providers = (json.data || []).sort((a, b) => {
      const left = a.display_name || a.name || a.slug || "";
      const right = b.display_name || b.name || b.slug || "";
      return left.localeCompare(right);
    });

    providersCache = { at: Date.now(), providers };
    return res.json({ providers, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message, providers: [] });
  }
});

openrouterRouter.get("/model-endpoints/:author/:slug", async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }
    const upstream = await fetch(
      `https://openrouter.ai/api/v1/models/${encodeURIComponent(req.params.author)}/${encodeURIComponent(req.params.slug)}/endpoints`,
      { headers: buildHeaders() }
    );
    const json = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }
    return res.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

openrouterRouter.get("/free-models", async (_req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    let modelsCache = readModelCache("all:");
    if (!modelsCache) {
      const upstream = await fetch("https://openrouter.ai/api/v1/models", {
        headers: buildHeaders(),
      });
      const json = await upstream.json();

      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
      }

      const models = (json.data || [])
        .map(mapModel)
        .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));

      writeModelCache("all:", models);
      modelsCache = readModelCache("all:");
    }

    return res.json({
      models: modelsCache.models.filter(isFreeModel),
      cached: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message, models: [] });
  }
});

openrouterRouter.get("/generation/:id", async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    const generationId = req.params.id;
    if (!generationId) {
      return res.status(400).json({ error: "generation id is required" });
    }

    const params = new URLSearchParams({ id: generationId });
    const upstream = await fetch(`https://openrouter.ai/api/v1/generation?${params.toString()}`, {
      headers: buildHeaders(),
    });
    const json = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }

    return res.json({
      generation: json.data || json,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

openrouterRouter.get("/image-models", async (_req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }
    const upstream = await fetch("https://openrouter.ai/api/v1/images/models", {
      headers: buildHeaders(),
    });
    const json = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }
    return res.json({ data: json.data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message, data: [] });
  }
});

openrouterRouter.get("/image-model-endpoints/:author/:slug", async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }
    const upstream = await fetch(
      `https://openrouter.ai/api/v1/images/models/${encodeURIComponent(req.params.author)}/${encodeURIComponent(req.params.slug)}/endpoints`,
      { headers: buildHeaders() }
    );
    const json = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }
    return res.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

openrouterRouter.post("/images", async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }
    const body = req.body || {};
    if (!body.model || typeof body.prompt !== "string" || !body.prompt.trim()) {
      return res.status(400).json({ error: "model and prompt are required" });
    }
    if (body.input_references && (!Array.isArray(body.input_references) || body.input_references.length > 16)) {
      return res.status(400).json({ error: "input_references must contain at most 16 images" });
    }
    const inputReferenceViolations = collectRemoteAssetViolations(
      body.input_references || [],
      parseAllowedRemoteAssetHosts(process.env.OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS),
      "input_references"
    );
    if (inputReferenceViolations.length > 0) {
      return res.status(400).json({
        error: "Remote input references must use an allowlisted host",
        details: inputReferenceViolations,
      });
    }

    const payload = {
      model: body.model,
      prompt: body.prompt.trim(),
      ...(body.aspect_ratio ? { aspect_ratio: body.aspect_ratio } : {}),
      ...(body.resolution ? { resolution: body.resolution } : {}),
      ...(body.size ? { size: body.size } : {}),
      ...(body.quality ? { quality: body.quality } : {}),
      ...(body.output_format ? { output_format: body.output_format } : {}),
      ...(body.output_compression != null ? { output_compression: body.output_compression } : {}),
      ...(body.background ? { background: body.background } : {}),
      ...(body.n != null ? { n: body.n } : {}),
      ...(body.seed != null ? { seed: body.seed } : {}),
      ...(body.provider ? { provider: body.provider } : {}),
      ...(body.input_references ? { input_references: body.input_references } : {}),
      stream: body.stream ?? false,
    };
    const upstream = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });
    if (payload.stream) {
      res.status(upstream.status);
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      if (upstream.body) {
        for await (const chunk of upstream.body) res.write(chunk);
      }
      return res.end();
    }
    const json = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }
    return res.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

openrouterRouter.post("/chat", async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    const {
      model = "openai/gpt-4o-mini",
      models,
      messages,
      modalities,
      image_config,
      response_format,
      reasoning,
      service_tier,
      session_id,
      provider,
      plugins,
      tools,
      tool_choice,
      parallel_tool_calls,
      temperature = 0,
      max_tokens,
      stream = false,
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    const allowedRemoteAssetHosts = parseAllowedRemoteAssetHosts(
      process.env.OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS
    );
    const remoteAssetViolations = collectRemoteAssetViolations(messages, allowedRemoteAssetHosts);

    if (remoteAssetViolations.length > 0) {
      return res.status(400).json({
        error:
          "Remote asset URLs must be converted to data URLs server-side or come from an allowlisted host in OPENROUTER_ALLOWED_REMOTE_ASSET_HOSTS.",
        details: remoteAssetViolations,
      });
    }

    const payload = {
      model,
      ...(Array.isArray(models) && models.length ? { models } : {}),
      messages,
      ...(Array.isArray(modalities) && modalities.length ? { modalities } : {}),
      ...(image_config ? { image_config } : {}),
      ...(response_format ? { response_format } : {}),
      ...(reasoning ? { reasoning } : {}),
      ...(service_tier ? { service_tier } : {}),
      ...(session_id ? { session_id } : {}),
      ...(provider ? { provider } : {}),
      ...(plugins ? { plugins } : {}),
      ...(tools ? { tools } : {}),
      ...(tool_choice ? { tool_choice } : {}),
      ...(typeof parallel_tool_calls === "boolean" ? { parallel_tool_calls } : {}),
      ...(typeof max_tokens === "number" ? { max_tokens } : {}),
      temperature,
      stream,
    };

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    if (stream) {
      res.status(upstream.status);
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      if (upstream.body) {
        for await (const chunk of upstream.body) {
          res.write(chunk);
        }
      }
      return res.end();
    }

    const json = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }

    return res.json({
      id: json.id,
      model: json.model,
      choices: json.choices || [],
      usage: json.usage || null,
      data: json.data || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});
