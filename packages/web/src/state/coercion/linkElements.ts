import type { Element } from '@bim-ai/core';

import { coerceNumber, coerceXY, coerceXYZ, type WireRecord } from './primitives';

type LinkElement = Extract<Element, { kind: 'link_model' | 'link_dxf' | 'link_external' }>;
type LinkModelElement = Extract<Element, { kind: 'link_model' }>;
type LinkDxfElement = Extract<Element, { kind: 'link_dxf' }>;
type LinkExternalElement = Extract<Element, { kind: 'link_external' }>;

function coerceOriginAlignment(
  raw: unknown,
): 'origin_to_origin' | 'project_origin' | 'shared_coords' {
  return raw === 'project_origin' || raw === 'shared_coords' ? raw : 'origin_to_origin';
}

function optionalFiniteNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function optionalRecord(raw: unknown): Record<string, unknown> | undefined {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : undefined;
}

function readStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((value) => String(value)) : [];
}

function readDxfUnitOverride(raw: unknown): LinkDxfElement['unitOverride'] | undefined {
  if (raw === null || typeof raw === 'number') return raw;
  if (
    raw === 'source' ||
    raw === 'unitless' ||
    raw === 'inches' ||
    raw === 'feet' ||
    raw === 'millimeters' ||
    raw === 'centimeters' ||
    raw === 'meters'
  ) {
    return raw;
  }
  return undefined;
}

function coerceLinkModel(id: string, name: string, raw: WireRecord): LinkModelElement | null {
  const sourceModelId = String(raw.sourceModelId ?? raw.source_model_id ?? '');
  if (!sourceModelId) return null;
  const sourceModelRevision = optionalFiniteNumber(
    raw.sourceModelRevision ?? raw.source_model_revision,
  );
  const visibilityRaw = raw.visibilityMode ?? raw.visibility_mode;
  const visibilityMode: LinkModelElement['visibilityMode'] =
    visibilityRaw === 'linked_view' ? 'linked_view' : 'host_view';

  return {
    kind: 'link_model',
    id,
    name,
    sourceModelId,
    ...(sourceModelRevision === undefined ? {} : { sourceModelRevision }),
    positionMm: coerceXYZ(raw.positionMm ?? raw.position_mm),
    rotationDeg: coerceNumber(raw.rotationDeg ?? raw.rotation_deg, 0),
    originAlignmentMode: coerceOriginAlignment(
      raw.originAlignmentMode ?? raw.origin_alignment_mode,
    ),
    visibilityMode,
    ...(raw.hidden != null ? { hidden: Boolean(raw.hidden) } : {}),
    ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
  };
}

function coerceLinkDxf(id: string, name: string, raw: WireRecord): LinkDxfElement | null {
  const levelId = String(raw.levelId ?? raw.level_id ?? '');
  if (!levelId) return null;
  const colorRaw = raw.colorMode ?? raw.color_mode;
  const colorMode: LinkDxfElement['colorMode'] =
    colorRaw === 'custom' || colorRaw === 'native' ? colorRaw : 'black_white';
  const unitScaleToMm = optionalFiniteNumber(raw.unitScaleToMm ?? raw.unit_scale_to_mm);
  const overlayOpacity = optionalFiniteNumber(raw.overlayOpacity ?? raw.overlay_opacity);
  const customColor = raw.customColor ?? raw.custom_color;
  const sourcePath = raw.sourcePath ?? raw.source_path;

  return {
    kind: 'link_dxf',
    id,
    name,
    levelId,
    originMm: coerceXY(raw.originMm ?? raw.origin_mm),
    originAlignmentMode: coerceOriginAlignment(
      raw.originAlignmentMode ?? raw.origin_alignment_mode,
    ),
    ...(raw.unitOverride !== undefined || raw.unit_override !== undefined
      ? { unitOverride: readDxfUnitOverride(raw.unitOverride ?? raw.unit_override) }
      : {}),
    ...(unitScaleToMm === undefined ? {} : { unitScaleToMm }),
    rotationDeg: coerceNumber(raw.rotationDeg ?? raw.rotation_deg, 0),
    scaleFactor: coerceNumber(raw.scaleFactor ?? raw.scale_factor, 1),
    linework: (Array.isArray(raw.linework) ? raw.linework : []) as LinkDxfElement['linework'],
    dxfLayers: (Array.isArray(raw.dxfLayers ?? raw.dxf_layers)
      ? (raw.dxfLayers ?? raw.dxf_layers)
      : []) as LinkDxfElement['dxfLayers'],
    hiddenLayerNames: readStringArray(raw.hiddenLayerNames ?? raw.hidden_layer_names),
    colorMode,
    loaded: raw.loaded == null ? true : Boolean(raw.loaded),
    ...(typeof customColor === 'string' ? { customColor } : {}),
    ...(overlayOpacity === undefined ? {} : { overlayOpacity }),
    ...(typeof sourcePath === 'string' ? { sourcePath } : {}),
    ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
  };
}

function coerceLinkExternal(id: string, name: string, raw: WireRecord): LinkExternalElement | null {
  const typeRaw = raw.externalLinkType ?? raw.external_link_type;
  const externalLinkType: LinkExternalElement['externalLinkType'] =
    typeRaw === 'pdf' || typeRaw === 'image' ? typeRaw : 'ifc';
  const sourcePath = String(raw.sourcePath ?? raw.source_path ?? '');
  if (!sourcePath) return null;
  const statusRaw = raw.reloadStatus ?? raw.reload_status;
  const reloadStatus: LinkExternalElement['reloadStatus'] =
    statusRaw === 'ok' || statusRaw === 'source_missing' || statusRaw === 'parse_error'
      ? statusRaw
      : 'not_reloaded';
  const sourceName = raw.sourceName ?? raw.source_name;
  const sourceMetadata = optionalRecord(raw.sourceMetadata ?? raw.source_metadata);
  const lastReloadMessage = raw.lastReloadMessage ?? raw.last_reload_message;
  const overlayOpacity = optionalFiniteNumber(raw.overlayOpacity ?? raw.overlay_opacity);

  return {
    kind: 'link_external',
    id,
    name: name || String(sourceName ?? sourcePath.split('/').pop() ?? ''),
    externalLinkType,
    sourcePath,
    reloadStatus,
    loaded: raw.loaded == null ? true : Boolean(raw.loaded),
    hidden: Boolean(raw.hidden ?? false),
    originAlignmentMode: coerceOriginAlignment(
      raw.originAlignmentMode ?? raw.origin_alignment_mode,
    ),
    rotationDeg: coerceNumber(raw.rotationDeg ?? raw.rotation_deg, 0),
    scaleFactor: coerceNumber(raw.scaleFactor ?? raw.scale_factor, 1),
    ...(typeof sourceName === 'string' ? { sourceName } : {}),
    ...(sourceMetadata ? { sourceMetadata } : {}),
    ...(typeof lastReloadMessage === 'string' ? { lastReloadMessage } : {}),
    ...(raw.originMm != null || raw.origin_mm != null
      ? { originMm: coerceXY(raw.originMm ?? raw.origin_mm) }
      : {}),
    ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
    ...(overlayOpacity === undefined ? {} : { overlayOpacity }),
  };
}

export function coerceLinkElement(id: string, name: string, raw: WireRecord): LinkElement | null {
  switch (raw.kind) {
    case 'link_model':
      return coerceLinkModel(id, name, raw);
    case 'link_dxf':
      return coerceLinkDxf(id, name, raw);
    case 'link_external':
      return coerceLinkExternal(id, name, raw);
    default:
      return null;
  }
}
