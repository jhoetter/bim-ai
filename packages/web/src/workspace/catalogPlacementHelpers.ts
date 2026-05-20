import type { AssetLibraryEntry, Element } from '@bim-ai/core';

import type { ExternalCatalogPlacement } from '../families/FamilyLibraryPanel';

export function shouldPlaceCatalogFamilyAsAsset(placement: ExternalCatalogPlacement): boolean {
  const category = placement.assetEntry?.category;
  return (
    placement.family.discipline === 'generic' &&
    (category === 'furniture' ||
      category === 'kitchen' ||
      category === 'bathroom' ||
      category === 'casework')
  );
}

export function indexAssetCommandFromEntry(entry: AssetLibraryEntry): Record<string, unknown> {
  return {
    type: 'IndexAsset',
    id: entry.id,
    assetKind: entry.assetKind ?? 'family_instance',
    name: entry.name,
    tags: entry.tags,
    category: entry.category,
    disciplineTags: entry.disciplineTags ?? [],
    thumbnailKind: entry.thumbnailKind,
    ...(entry.thumbnailMm
      ? {
          thumbnailWidthMm: entry.thumbnailMm.widthMm,
          thumbnailHeightMm: entry.thumbnailMm.heightMm,
        }
      : {}),
    ...(entry.planSymbolKind ? { planSymbolKind: entry.planSymbolKind } : {}),
    ...(entry.renderProxyKind ? { renderProxyKind: entry.renderProxyKind } : {}),
    ...(entry.paramSchema ? { paramSchema: entry.paramSchema } : {}),
    ...(entry.publishedFromOrgId ? { publishedFromOrgId: entry.publishedFromOrgId } : {}),
    ...(entry.description ? { description: entry.description } : {}),
  };
}

export function assetPreviewElementFromEntry(
  entry: AssetLibraryEntry,
): Extract<Element, { kind: 'asset_library_entry' }> {
  return {
    kind: 'asset_library_entry',
    id: entry.id,
    assetKind: entry.assetKind ?? 'family_instance',
    name: entry.name,
    tags: entry.tags,
    category: entry.category,
    disciplineTags: entry.disciplineTags ?? [],
    thumbnailKind: entry.thumbnailKind,
    ...(entry.thumbnailMm
      ? {
          thumbnailWidthMm: entry.thumbnailMm.widthMm,
          thumbnailHeightMm: entry.thumbnailMm.heightMm,
        }
      : {}),
    ...(entry.planSymbolKind ? { planSymbolKind: entry.planSymbolKind } : {}),
    ...(entry.renderProxyKind ? { renderProxyKind: entry.renderProxyKind } : {}),
    ...(entry.paramSchema ? { paramSchema: entry.paramSchema } : {}),
    ...(entry.publishedFromOrgId ? { publishedFromOrgId: entry.publishedFromOrgId } : {}),
    ...(entry.description ? { description: entry.description } : {}),
  };
}
