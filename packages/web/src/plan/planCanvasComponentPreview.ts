import type { AssetSymbolKind, Element } from '@bim-ai/core';
import type { PlanTool } from '../state/store';

type ComponentAssetLike = {
  id: string;
  kind?: 'asset_library_entry';
  planSymbolKind?: AssetSymbolKind;
  renderProxyKind?: AssetSymbolKind;
};

type ResolveInput = {
  planTool: PlanTool;
  activeComponentAssetId?: string | null;
  elementsById: Record<string, Element | undefined>;
  previewEntry?: ComponentAssetLike | null;
};

export function resolveActiveComponentAsset({
  planTool,
  activeComponentAssetId,
  elementsById,
  previewEntry,
}: ResolveInput): ComponentAssetLike | null {
  if (planTool !== 'component' || !activeComponentAssetId) return null;
  const storeAsset = elementsById[activeComponentAssetId];
  if (storeAsset?.kind === 'asset_library_entry') return storeAsset;
  return previewEntry?.id === activeComponentAssetId ? previewEntry : null;
}

export function componentPreviewSymbolKind(asset: ComponentAssetLike | null) {
  return asset?.planSymbolKind ?? asset?.renderProxyKind;
}
