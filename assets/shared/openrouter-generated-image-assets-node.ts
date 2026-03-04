import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  extractGeneratedImageAssets,
  parseGeneratedImageDataUrl,
  type OpenRouterImageAsset,
  type OpenRouterImagePurpose,
} from "./openrouter-generated-image-assets";
import type { OpenRouterChatResponse } from "./parse-openrouter-response";

export async function writeGeneratedImageAsset(
  asset: OpenRouterImageAsset,
  directory: string
) {
  await mkdir(directory, { recursive: true });
  const outputPath = join(directory, asset.suggestedFileName);
  const parsed = parseGeneratedImageDataUrl(asset.dataUrl);
  const bytes = Buffer.from(parsed.base64, "base64");

  await writeFile(outputPath, bytes);

  return {
    path: outputPath,
    mimeType: asset.mimeType,
    generationId: asset.generationId,
    model: asset.model,
    purpose: asset.purpose,
  };
}

export async function persistGeneratedImages(
  response: OpenRouterChatResponse,
  {
    directory,
    purpose = "icon",
    fileStem = "generated-image",
  }: {
    directory: string;
    purpose?: OpenRouterImagePurpose;
    fileStem?: string;
  }
) {
  const assets = extractGeneratedImageAssets(response, { purpose, fileStem });
  return Promise.all(assets.map((asset) => writeGeneratedImageAsset(asset, directory)));
}
