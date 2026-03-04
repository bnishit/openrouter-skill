import express from "express";

export const openrouterRouter = express.Router();

const CACHE_MS = 60 * 60 * 1000;
let modelsCache = null;
let providersCache = null;

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
    const visionOnly = req.query.visionOnly !== "false";

    if (modelsCache && Date.now() - modelsCache.at < CACHE_MS) {
      const models = visionOnly
        ? modelsCache.models.filter((model) => model.inputModalities.includes("image"))
        : modelsCache.models;
      return res.json({ models, cached: true });
    }

    const endpoint = scope === "user"
      ? "https://openrouter.ai/api/v1/models/user"
      : "https://openrouter.ai/api/v1/models";

    const upstream = await fetch(endpoint, { headers: buildHeaders() });
    const json = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: json?.error || `OpenRouter error ${upstream.status}` });
    }

    const models = (json.data || [])
      .map(mapModel)
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));

    modelsCache = { at: Date.now(), models };

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

openrouterRouter.get("/free-models", async (_req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    if (!modelsCache || Date.now() - modelsCache.at >= CACHE_MS) {
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

      modelsCache = { at: Date.now(), models };
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

openrouterRouter.post("/chat", async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    const {
      model = "openai/gpt-4o-mini",
      models,
      messages,
      response_format,
      provider,
      plugins,
      tools,
      tool_choice,
      parallel_tool_calls,
      temperature = 0,
      stream = false,
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    const payload = {
      model,
      ...(Array.isArray(models) && models.length ? { models } : {}),
      messages,
      ...(response_format ? { response_format } : {}),
      ...(provider ? { provider } : {}),
      ...(plugins ? { plugins } : {}),
      ...(tools ? { tools } : {}),
      ...(tool_choice ? { tool_choice } : {}),
      ...(typeof parallel_tool_calls === "boolean" ? { parallel_tool_calls } : {}),
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});
