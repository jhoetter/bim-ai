import type { Element } from '@bim-ai/core';

import { coerceNumber, coerceXY, type WireRecord } from './primitives';

type AssetLibraryEntryElement = Extract<Element, { kind: 'asset_library_entry' }>;
type PlacedAssetElement = Extract<Element, { kind: 'placed_asset' }>;
type AssetElement = AssetLibraryEntryElement | PlacedAssetElement;

function listOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function isAssetSymbolKind(value: unknown): value is AssetLibraryEntryElement['planSymbolKind'] {
  return (
    value === 'bed' ||
    value === 'wardrobe' ||
    value === 'lamp' ||
    value === 'rug' ||
    value === 'fridge' ||
    value === 'oven' ||
    value === 'sink' ||
    value === 'counter' ||
    value === 'sofa' ||
    value === 'table' ||
    value === 'chair' ||
    value === 'toilet' ||
    value === 'bath' ||
    value === 'shower' ||
    value === 'bathroom_layout' ||
    value === 'generic'
  );
}

function optionalFiniteNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function coerceAssetLibraryEntry(
  id: string,
  name: string,
  raw: WireRecord,
): AssetLibraryEntryElement {
  const thumbnailWidthMm = optionalFiniteNumber(raw.thumbnailWidthMm ?? raw.thumbnail_width_mm);
  const thumbnailHeightMm = optionalFiniteNumber(raw.thumbnailHeightMm ?? raw.thumbnail_height_mm);
  const planSymbolKind = raw.planSymbolKind ?? raw.plan_symbol_kind;
  const renderProxyKind = raw.renderProxyKind ?? raw.render_proxy_kind;
  const paramSchema = raw.paramSchema ?? raw.param_schema;

  return {
    kind: 'asset_library_entry',
    id,
    name,
    assetKind:
      raw.assetKind === 'family_instance' ||
      raw.assetKind === 'kit' ||
      raw.assetKind === 'decal' ||
      raw.assetKind === 'profile'
        ? raw.assetKind
        : 'block_2d',
    category:
      raw.category === 'kitchen' ||
      raw.category === 'bathroom' ||
      raw.category === 'door' ||
      raw.category === 'window' ||
      raw.category === 'decal' ||
      raw.category === 'profile' ||
      raw.category === 'casework'
        ? raw.category
        : 'furniture',
    tags: listOfStrings(raw.tags),
    disciplineTags: listOfStrings(raw.disciplineTags ?? raw.discipline_tags).filter(
      (x): x is 'arch' | 'struct' | 'mep' => x === 'arch' || x === 'struct' || x === 'mep',
    ),
    thumbnailKind: raw.thumbnailKind === 'rendered_3d' ? 'rendered_3d' : 'schematic_plan',
    ...(thumbnailWidthMm === undefined ? {} : { thumbnailWidthMm }),
    ...(thumbnailHeightMm === undefined ? {} : { thumbnailHeightMm }),
    ...(isAssetSymbolKind(planSymbolKind) ? { planSymbolKind } : {}),
    ...(isAssetSymbolKind(renderProxyKind) ? { renderProxyKind } : {}),
    ...(Array.isArray(paramSchema)
      ? { paramSchema: paramSchema as AssetLibraryEntryElement['paramSchema'] }
      : {}),
    ...(raw.publishedFromOrgId || raw.published_from_org_id
      ? { publishedFromOrgId: String(raw.publishedFromOrgId ?? raw.published_from_org_id) }
      : {}),
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
  };
}

function coercePlacedAsset(id: string, name: string, raw: WireRecord): PlacedAssetElement | null {
  const assetId = raw.assetId ?? raw.asset_id;
  const levelId = raw.levelId ?? raw.level_id;
  if (typeof assetId !== 'string' || typeof levelId !== 'string') return null;
  const paramValues = raw.paramValues ?? raw.param_values;
  return {
    kind: 'placed_asset',
    id,
    name,
    assetId,
    levelId,
    positionMm: coerceXY(raw.positionMm ?? raw.position_mm),
    rotationDeg: coerceNumber(raw.rotationDeg ?? raw.rotation_deg, 0),
    ...(paramValues && typeof paramValues === 'object' && !Array.isArray(paramValues)
      ? { paramValues: paramValues as Record<string, unknown> }
      : {}),
    ...(raw.hostElementId || raw.host_element_id
      ? { hostElementId: String(raw.hostElementId ?? raw.host_element_id) }
      : {}),
  };
}

export function coerceAssetElement(id: string, name: string, raw: WireRecord): AssetElement | null {
  switch (raw.kind) {
    case 'asset_library_entry':
      return coerceAssetLibraryEntry(id, name, raw);
    case 'placed_asset':
      return coercePlacedAsset(id, name, raw);
    default:
      return null;
  }
}
