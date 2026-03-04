import {
  getGeneratedImageUrls,
  type OpenRouterChatResponse,
} from "./parse-openrouter-response";

export type OpenRouterImagePurpose =
  | "icon"
  | "og-image"
  | "social-post"
  | "story"
  | "banner";

export type OpenRouterImageSize = "1K" | "2K" | "4K";

export type OpenRouterImageAsset = {
  index: number;
  dataUrl: string;
  mimeType: string;
  extension: string;
  generationId: string | null;
  model: string | null;
  purpose: OpenRouterImagePurpose;
  suggestedFileName: string;
};

const PURPOSE_PRESETS: Record<
  OpenRouterImagePurpose,
  { aspectRatio: string; promptPrefix: string }
> = {
  icon: {
    aspectRatio: "1:1",
    promptPrefix:
      "Create a clean, product-ready app icon with a single strong focal subject, bold silhouette, simple background, and no tiny embedded text.",
  },
  "og-image": {
    aspectRatio: "16:9",
    promptPrefix:
      "Create a wide open-graph style image with a strong focal subject, clear composition, and safe negative space for a future headline overlay. Avoid small embedded text.",
  },
  "social-post": {
    aspectRatio: "4:5",
    promptPrefix:
      "Create a polished social media image with a clear focal point, strong contrast, and visual hierarchy that reads well on mobile.",
  },
  story: {
    aspectRatio: "9:16",
    promptPrefix:
      "Create a vertical story-style image designed for mobile viewing with a bold focal area and room for top and bottom overlays.",
  },
  banner: {
    aspectRatio: "21:9",
    promptPrefix:
      "Create a wide banner image with a strong focal subject and generous horizontal breathing room for interface chrome or headline overlays.",
  },
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildImageGenerationPrompt(
  purpose: OpenRouterImagePurpose,
  prompt: string
) {
  const preset = PURPOSE_PRESETS[purpose];
  return `${preset.promptPrefix} ${prompt}`.trim();
}

export function buildImageGenerationRequest({
  model = "google/gemini-3.1-flash-image-preview",
  prompt,
  purpose = "icon",
  imageSize = "1K",
}: {
  model?: string;
  prompt: string;
  purpose?: OpenRouterImagePurpose;
  imageSize?: OpenRouterImageSize;
}) {
  const preset = PURPOSE_PRESETS[purpose];

  return {
    model,
    messages: [
      {
        role: "user" as const,
        content: buildImageGenerationPrompt(purpose, prompt),
      },
    ],
    modalities: ["image", "text"],
    image_config: {
      aspect_ratio: preset.aspectRatio,
      image_size: imageSize,
    },
    temperature: 0,
  };
}

export function parseGeneratedImageDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a base64 data URL");
  }

  const mimeType = match[1];
  const extension = mimeType.split("/")[1] || "bin";

  return {
    mimeType,
    extension,
    base64: match[2],
  };
}

export function extractGeneratedImageAssets(
  response: OpenRouterChatResponse,
  {
    purpose = "icon",
    fileStem = "generated-image",
  }: {
    purpose?: OpenRouterImagePurpose;
    fileStem?: string;
  } = {}
): OpenRouterImageAsset[] {
  const urls = getGeneratedImageUrls(response);
  const generationId = response.id || null;
  const model = response.model || null;
  const stem = slugify(fileStem) || "generated-image";

  return urls.map((dataUrl, index) => {
    const parsed = parseGeneratedImageDataUrl(dataUrl);
    const suffix = String(index + 1).padStart(2, "0");

    return {
      index,
      dataUrl,
      mimeType: parsed.mimeType,
      extension: parsed.extension,
      generationId,
      model,
      purpose,
      suggestedFileName: `${stem}-${purpose}-${suffix}.${parsed.extension}`,
    };
  });
}
