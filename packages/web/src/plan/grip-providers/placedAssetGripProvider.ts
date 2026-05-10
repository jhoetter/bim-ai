/**
 * F-117/F-120 — placed asset resize grips.
 *
 * Built-in family components render from `paramValues`, so plan resize
 * grips only need to update those instance parameters. The asset stays
 * centre-anchored, matching the current renderer and inspector behaviour.
 */
import type { Element, XY } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type PlacedAsset = Extract<Element, { kind: 'placed_asset' }>;
type AssetEntry = Extract<Element, { kind: 'asset_library_entry' }>;

const MIN_SIZE_MM = 50;
const MIN_OFFSET_MM = 80;
const DEFAULT_WIDTH_MM = 1000;
const DEFAULT_DEPTH_MM = 1000;
const OFFSET_PARAM_KEYS = [
  'sinkOffsetMm',
  'fridgeOffsetMm',
  'toiletOffsetMm',
  'vanityOffsetMm',
  'showerOffsetMm',
] as const;

type SizeParamKey = 'widthMm' | 'depthMm';
type OffsetParamKey = (typeof OFFSET_PARAM_KEYS)[number];
type PlacedAssetParamKey = SizeParamKey | OffsetParamKey;

function numberParam(asset: PlacedAsset, entry: AssetEntry | undefined, keys: string[]): number {
  for (const key of keys) {
    const raw = asset.paramValues?.[key];
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  for (const key of keys) {
    const schema = entry?.paramSchema?.find((p) => p.key === key);
    const n = Number(schema?.default);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return keys.includes('depthMm')
    ? entry?.thumbnailHeightMm || DEFAULT_DEPTH_MM
    : entry?.thumbnailWidthMm || DEFAULT_WIDTH_MM;
}

function localAxis(rotationDeg: number, axis: 'width' | 'depth'): XY {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return axis === 'width' ? { xMm: cos, yMm: sin } : { xMm: -sin, yMm: cos };
}

function add(a: XY, b: XY, scalar: number): XY {
  return { xMm: a.xMm + b.xMm * scalar, yMm: a.yMm + b.yMm * scalar };
}

function dot(a: XY, b: XY): number {
  return a.xMm * b.xMm + a.yMm * b.yMm;
}

function paramValuesPatch(
  asset: PlacedAsset,
  key: PlacedAssetParamKey,
  valueMm: number,
  minMm = MIN_SIZE_MM,
  maxMm = Number.POSITIVE_INFINITY,
): GripCommand {
  return {
    type: 'updateElementProperty',
    elementId: asset.id,
    key: 'paramValues',
    value: {
      ...(asset.paramValues ?? {}),
      [key]: Math.min(maxMm, Math.max(minMm, valueMm)),
    },
  };
}

function findAssetEntry(
  asset: PlacedAsset,
  elementsById?: Record<string, Element>,
): AssetEntry | undefined {
  const entry = elementsById?.[asset.assetId];
  return entry?.kind === 'asset_library_entry' ? entry : undefined;
}

function makeSizeGrip(
  asset: PlacedAsset,
  axis: 'width' | 'depth',
  sign: 1 | -1,
  currentMm: number,
  offsetMm: number,
): GripDescriptor {
  const axisVector = localAxis(asset.rotationDeg ?? 0, axis);
  const outward = { xMm: axisVector.xMm * sign, yMm: axisVector.yMm * sign };
  const positionMm = add(asset.positionMm, axisVector, sign * offsetMm);
  const key = axis === 'width' ? 'widthMm' : 'depthMm';
  const label = axis === 'width' ? 'width' : 'depth';
  return {
    id: `${asset.id}:${axis}:${sign > 0 ? 'plus' : 'minus'}`,
    positionMm,
    shape: 'square',
    axis: 'normal_to_element',
    hint: `Drag to resize ${label}`,
    onDrag: () => ({ kind: 'unknown', id: asset.id }),
    onCommit: (delta): GripCommand => {
      const outwardDeltaMm = dot(delta, outward);
      return paramValuesPatch(asset, key, currentMm + outwardDeltaMm * 2);
    },
    onNumericOverride: (absoluteMm): GripCommand => paramValuesPatch(asset, key, absoluteMm),
  };
}

function hasParam(asset: PlacedAsset, entry: AssetEntry | undefined, key: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(asset.paramValues ?? {}, key) ||
    !!entry?.paramSchema?.some((p) => p.key === key)
  );
}

function labelForOffsetParam(key: OffsetParamKey): string {
  switch (key) {
    case 'sinkOffsetMm':
      return 'sink offset';
    case 'fridgeOffsetMm':
      return 'fridge offset';
    case 'toiletOffsetMm':
      return 'toilet offset';
    case 'vanityOffsetMm':
      return 'vanity offset';
    case 'showerOffsetMm':
      return 'shower offset';
  }
}

function defaultOffsetMm(key: OffsetParamKey, widthMm: number): number {
  switch (key) {
    case 'sinkOffsetMm':
    case 'toiletOffsetMm':
      return widthMm / 2;
    case 'fridgeOffsetMm':
    case 'showerOffsetMm':
      return 450;
    case 'vanityOffsetMm':
      return widthMm - 450;
  }
}

function offsetParam(
  asset: PlacedAsset,
  entry: AssetEntry | undefined,
  key: OffsetParamKey,
  widthMm: number,
): number {
  const raw = asset.paramValues?.[key];
  const instanceValue = Number(raw);
  if (Number.isFinite(instanceValue)) return instanceValue;

  const schemaValue = Number(entry?.paramSchema?.find((p) => p.key === key)?.default);
  if (Number.isFinite(schemaValue)) return schemaValue;

  return defaultOffsetMm(key, widthMm);
}

function clampOffsetMm(valueMm: number, widthMm: number): number {
  const maxMm = Math.max(MIN_OFFSET_MM, widthMm - MIN_OFFSET_MM);
  return Math.min(maxMm, Math.max(MIN_OFFSET_MM, valueMm));
}

function makeOffsetGrip(
  asset: PlacedAsset,
  key: OffsetParamKey,
  currentMm: number,
  widthMm: number,
  depthMm: number,
): GripDescriptor {
  const widthAxis = localAxis(asset.rotationDeg ?? 0, 'width');
  const depthAxis = localAxis(asset.rotationDeg ?? 0, 'depth');
  const clampedOffsetMm = clampOffsetMm(currentMm, widthMm);
  const offsetFromCenterMm = clampedOffsetMm - widthMm / 2;
  const depthOffsetMm = key === 'toiletOffsetMm' ? depthMm * 0.1 : 0;
  const positionMm = add(
    add(asset.positionMm, widthAxis, offsetFromCenterMm),
    depthAxis,
    depthOffsetMm,
  );
  const label = labelForOffsetParam(key);
  const maxMm = Math.max(MIN_OFFSET_MM, widthMm - MIN_OFFSET_MM);

  return {
    id: `${asset.id}:${key}`,
    positionMm,
    shape: 'circle',
    axis: 'free',
    hint: `Drag to adjust ${label}`,
    onDrag: () => ({ kind: 'unknown', id: asset.id }),
    onCommit: (delta): GripCommand => {
      const offsetDeltaMm = dot(delta, widthAxis);
      return paramValuesPatch(asset, key, clampedOffsetMm + offsetDeltaMm, MIN_OFFSET_MM, maxMm);
    },
    onNumericOverride: (absoluteMm): GripCommand =>
      paramValuesPatch(asset, key, absoluteMm, MIN_OFFSET_MM, maxMm),
  };
}

export const placedAssetGripProvider: ElementGripProvider<PlacedAsset> = {
  grips(asset: PlacedAsset, context: PlanContext): GripDescriptor[] {
    const entry = findAssetEntry(asset, context.elementsById);
    const widthMm = numberParam(asset, entry, ['widthMm', 'lengthMm', 'diameterMm']);
    const depthMm = numberParam(asset, entry, ['depthMm', 'diameterMm']);
    const offsetGrips = OFFSET_PARAM_KEYS.filter((key) => hasParam(asset, entry, key)).map((key) =>
      makeOffsetGrip(asset, key, offsetParam(asset, entry, key, widthMm), widthMm, depthMm),
    );

    return [
      makeSizeGrip(asset, 'width', 1, widthMm, widthMm / 2),
      makeSizeGrip(asset, 'width', -1, widthMm, widthMm / 2),
      makeSizeGrip(asset, 'depth', 1, depthMm, depthMm / 2),
      makeSizeGrip(asset, 'depth', -1, depthMm, depthMm / 2),
      ...offsetGrips,
    ];
  },
};
