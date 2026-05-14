import type { Element, ImageAssetElem, ImageAssetMapUsage } from '@bim-ai/core';

export function listMaterialImageAssets(
  elementsById: Record<string, Element> | null | undefined,
  usage?: ImageAssetMapUsage,
): ImageAssetElem[] {
  if (!elementsById) return [];
  return Object.values(elementsById)
    .filter((element): element is ImageAssetElem => element.kind === 'image_asset')
    .filter((asset) => !usage || asset.mapUsageHint === usage)
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export function missingMaterialImageAssetIds(
  materialMapIds: Array<string | null | undefined>,
  elementsById: Record<string, Element> | null | undefined,
): string[] {
  if (!elementsById) return [];
  return materialMapIds.filter(
    (assetId): assetId is string =>
      !!assetId && !/^(https?:|data:|blob:|\/|library\/)/.test(assetId) && !elementsById[assetId],
  );
}
