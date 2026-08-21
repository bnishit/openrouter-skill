import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  extractGeneratedImageAssets,
  parseGeneratedImageDataUrl,
  type OpenRouterImageAsset,
  type OpenRouterImagePurpose,
} from "./openrouter-generated-image-assets";
import type { OpenRouterImageResponse } from "./parse-openrouter-response";

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
  response: OpenRouterImageResponse,
  {
    directory,
    purpose = "icon",
    fileStem = "generated-image",
    requestedModel,
    generationId,
  }: {
    directory: string;
    purpose?: OpenRouterImagePurpose;
    fileStem?: string;
    requestedModel: string;
    generationId?: string;
  }
) {
  const assets = extractGeneratedImageAssets(response, {
    purpose,
    fileStem,
    requestedModel,
    generationId,
  });
  return Promise.all(assets.map((asset) => writeGeneratedImageAsset(asset, directory)));
}
