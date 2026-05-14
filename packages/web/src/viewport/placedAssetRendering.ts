import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import type { ViewportPaintBundle } from './materials';

export type PlacedAssetElement = Extract<Element, { kind: 'placed_asset' }>;
export type AssetLibraryEntryElement = Extract<Element, { kind: 'asset_library_entry' }>;

type AssetSymbolKind =
  | 'bed'
  | 'wardrobe'
  | 'lamp'
  | 'rug'
  | 'fridge'
  | 'oven'
  | 'sink'
  | 'counter'
  | 'sofa'
  | 'table'
  | 'chair'
  | 'toilet'
  | 'bath'
  | 'shower'
  | 'bathroom_layout'
  | 'generic';

type PlacedAssetRenderSpec = {
  symbolKind: AssetSymbolKind;
  widthM: number;
  depthM: number;
  heightM: number;
  color: string;
  sinkOffsetM?: number;
  fridgeOffsetM?: number;
  toiletOffsetM?: number;
  vanityOffsetM?: number;
  showerOffsetM?: number;
  kitchenLayout?: boolean;
};

function textFor(entry: AssetLibraryEntryElement | undefined, asset: PlacedAssetElement): string {
  return [entry?.id, entry?.name, entry?.category, ...(entry?.tags ?? []), asset.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function classifyPlacedAssetSymbol(
  entry: AssetLibraryEntryElement | undefined,
  asset: PlacedAssetElement,
): AssetSymbolKind {
  if (entry?.planSymbolKind) return entry.planSymbolKind;
  if (entry?.renderProxyKind) return entry.renderProxyKind;
  const text = textFor(entry, asset);
  if (/\b(bed|mattress|queen|king|single\s+bed|double\s+bed)\b/.test(text)) return 'bed';
  if (/\b(wardrobe|closet|robe|storage|cupboard)\b/.test(text)) return 'wardrobe';
  if (/\b(lamp|light|floor\s+lamp|table\s+lamp)\b/.test(text)) return 'lamp';
  if (/\b(rug|carpet|mat)\b/.test(text)) return 'rug';
  if (/\b(fridge|refrigerator|freezer)\b/.test(text)) return 'fridge';
  if (/\b(oven|cooker|range|hob|cooktop)\b/.test(text)) return 'oven';
  if (/\b(sink|basin|washbasin)\b/.test(text)) return 'sink';
  if (/\b(counter|cabinet|casework|island|worktop)\b/.test(text)) return 'counter';
  if (/\b(sofa|couch|settee)\b/.test(text)) return 'sofa';
  if (/\b(table|desk)\b/.test(text)) return 'table';
  if (/\b(chair|armchair)\b/.test(text)) return 'chair';
  if (/\b(toilet|wc)\b/.test(text)) return 'toilet';
  if (/\b(bath|bathtub|tub)\b/.test(text)) return 'bath';
  if (/\b(bathroom layout|compact bathroom|toilet sink shower)\b/.test(text))
    return 'bathroom_layout';
  if (/\b(shower)\b/.test(text)) return 'shower';
  return 'generic';
}

function numericParam(
  entry: AssetLibraryEntryElement | undefined,
  asset: PlacedAssetElement,
  keys: string[],
): number | null {
  for (const key of keys) {
    const raw = asset.paramValues?.[key];
    if (Number.isFinite(Number(raw))) return Number(raw);
  }
  for (const key of keys) {
    const schema = entry?.paramSchema?.find((p) => p.key === key);
    if (schema && Number.isFinite(Number(schema.default))) return Number(schema.default);
  }
  return null;
}

function defaultsFor(kind: AssetSymbolKind): {
  widthMm: number;
  depthMm: number;
  heightMm: number;
} {
  switch (kind) {
    case 'fridge':
      return { widthMm: 600, depthMm: 650, heightMm: 1850 };
    case 'bed':
      return { widthMm: 1800, depthMm: 2100, heightMm: 600 };
    case 'wardrobe':
      return { widthMm: 1800, depthMm: 620, heightMm: 2200 };
    case 'lamp':
      return { widthMm: 450, depthMm: 450, heightMm: 1700 };
    case 'rug':
      return { widthMm: 2400, depthMm: 1700, heightMm: 25 };
    case 'oven':
      return { widthMm: 600, depthMm: 600, heightMm: 900 };
    case 'sink':
      return { widthMm: 600, depthMm: 500, heightMm: 900 };
    case 'counter':
      return { widthMm: 2400, depthMm: 600, heightMm: 900 };
    case 'sofa':
      return { widthMm: 2200, depthMm: 950, heightMm: 780 };
    case 'table':
      return { widthMm: 1600, depthMm: 900, heightMm: 740 };
    case 'chair':
      return { widthMm: 850, depthMm: 900, heightMm: 850 };
    case 'toilet':
      return { widthMm: 380, depthMm: 670, heightMm: 760 };
    case 'bath':
      return { widthMm: 1700, depthMm: 750, heightMm: 560 };
    case 'shower':
      return { widthMm: 900, depthMm: 900, heightMm: 80 };
    case 'bathroom_layout':
      return { widthMm: 2400, depthMm: 2200, heightMm: 2100 };
    default:
      return { widthMm: 1000, depthMm: 600, heightMm: 450 };
  }
}

function offsetParamM(
  entry: AssetLibraryEntryElement | undefined,
  asset: PlacedAssetElement,
  key: string,
  defaultMm: number,
): number {
  return (numericParam(entry, asset, [key]) ?? defaultMm) / 1000;
}

function hasParam(
  entry: AssetLibraryEntryElement | undefined,
  asset: PlacedAssetElement,
  key: string,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(asset.paramValues ?? {}, key) ||
    !!entry?.paramSchema?.some((p) => p.key === key)
  );
}

function colorFor(kind: AssetSymbolKind, paint: ViewportPaintBundle | null | undefined): string {
  switch (kind) {
    case 'fridge':
      return '#e5e7eb';
    case 'oven':
      return '#3f3f46';
    case 'sink':
      return '#c7d2fe';
    case 'bed':
      return '#d6d3d1';
    case 'wardrobe':
      return '#d2b48c';
    case 'lamp':
      return '#facc15';
    case 'rug':
      return '#94a3b8';
    case 'counter':
      return paint?.categories.floor.color ?? '#cfc9be';
    case 'sofa':
    case 'chair':
      return '#b8a898';
    case 'table':
      return '#a78b6f';
    case 'toilet':
    case 'bath':
    case 'shower':
    case 'bathroom_layout':
      return '#f8fafc';
    default:
      return '#d6d3d1';
  }
}

export function resolvePlacedAssetRenderSpec(
  asset: PlacedAssetElement,
  entry: AssetLibraryEntryElement | undefined,
  paint?: ViewportPaintBundle | null,
  opts: { prefer?: 'plan' | 'render' } = {},
): PlacedAssetRenderSpec {
  const symbolKind =
    opts.prefer === 'render' && entry?.renderProxyKind
      ? entry.renderProxyKind
      : opts.prefer === 'plan' && entry?.planSymbolKind
        ? entry.planSymbolKind
        : classifyPlacedAssetSymbol(entry, asset);
  const defaults = defaultsFor(symbolKind);
  const widthMm =
    numericParam(entry, asset, ['widthMm', 'lengthMm', 'diameterMm']) ??
    entry?.thumbnailWidthMm ??
    defaults.widthMm;
  const depthMm =
    numericParam(entry, asset, ['depthMm', 'diameterMm']) ??
    entry?.thumbnailHeightMm ??
    defaults.depthMm;
  const heightMm = numericParam(entry, asset, ['heightMm', 'seatHeightMm']) ?? defaults.heightMm;

  return {
    symbolKind,
    widthM: THREE.MathUtils.clamp(widthMm / 1000, 0.05, 20),
    depthM: THREE.MathUtils.clamp(depthMm / 1000, 0.05, 20),
    heightM: THREE.MathUtils.clamp(heightMm / 1000, 0.03, 8),
    color: colorFor(symbolKind, paint),
    sinkOffsetM: offsetParamM(entry, asset, 'sinkOffsetMm', 1200),
    fridgeOffsetM: offsetParamM(entry, asset, 'fridgeOffsetMm', 300),
    toiletOffsetM: offsetParamM(entry, asset, 'toiletOffsetMm', 1180),
    vanityOffsetM: offsetParamM(entry, asset, 'vanityOffsetMm', 1900),
    showerOffsetM: offsetParamM(entry, asset, 'showerOffsetMm', 450),
    kitchenLayout:
      hasParam(entry, asset, 'sinkOffsetMm') || hasParam(entry, asset, 'fridgeOffsetMm'),
  };
}

function lineMaterial(color: string, lineWidth: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    linewidth: lineWidth,
    depthTest: false,
    depthWrite: false,
  });
}

function fillMaterial(color: string, opacity = 0.16): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function addFilledRect(
  group: THREE.Group,
  pickId: string,
  width: number,
  depth: number,
  cx: number,
  cz: number,
  color: string,
  opacity = 0.14,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), fillMaterial(color, opacity));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, -0.004, cz);
  mesh.renderOrder = 990;
  mesh.userData.bimPickId = pickId;
  group.add(mesh);
  return mesh;
}

function addFilledCircle(
  group: THREE.Group,
  pickId: string,
  radius: number,
  cx: number,
  cz: number,
  color: string,
  opacity = 0.14,
  segments = 32,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, segments),
    fillMaterial(color, opacity),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, -0.003, cz);
  mesh.renderOrder = 991;
  mesh.userData.bimPickId = pickId;
  group.add(mesh);
  return mesh;
}

function addPolyline(
  group: THREE.Group,
  pts: Array<[number, number]>,
  mat: THREE.LineBasicMaterial,
  pickId: string,
  renderOrder = 995,
): void {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))),
    mat,
  );
  line.userData.bimPickId = pickId;
  line.renderOrder = renderOrder;
  group.add(line);
}

function addCircle(
  group: THREE.Group,
  cx: number,
  cz: number,
  radius: number,
  mat: THREE.LineBasicMaterial,
  pickId: string,
  segments = 28,
): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
  }
  addPolyline(group, pts, mat, pickId);
}

function addRect(
  group: THREE.Group,
  hw: number,
  hd: number,
  mat: THREE.LineBasicMaterial,
  pickId: string,
): void {
  addPolyline(
    group,
    [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
      [-hw, -hd],
    ],
    mat,
    pickId,
  );
}

function offsetFromLeft(widthM: number, offsetM: number | undefined, fallbackM: number): number {
  return (
    THREE.MathUtils.clamp(offsetM ?? fallbackM, 0.08, Math.max(0.08, widthM - 0.08)) - widthM / 2
  );
}

function addPlacedAssetSymbolLines(
  group: THREE.Group,
  spec: PlacedAssetRenderSpec,
  pickId: string,
  color: string,
): void {
  const mat = lineMaterial(color, 2.5);
  const fine = lineMaterial(color, 1.75);
  const hw = spec.widthM / 2;
  const hd = spec.depthM / 2;

  addPlacedAssetSymbolFills(group, spec, pickId);
  addRect(group, hw, hd, mat, pickId);

  switch (spec.symbolKind) {
    case 'bed':
      addRect(group, hw * 0.82, hd * 0.78, fine, pickId);
      addPolyline(
        group,
        [
          [-hw * 0.72, -hd * 0.82],
          [-hw * 0.12, -hd * 0.82],
          [-hw * 0.12, -hd * 0.48],
          [-hw * 0.72, -hd * 0.48],
          [-hw * 0.72, -hd * 0.82],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [hw * 0.12, -hd * 0.82],
          [hw * 0.72, -hd * 0.82],
          [hw * 0.72, -hd * 0.48],
          [hw * 0.12, -hd * 0.48],
          [hw * 0.12, -hd * 0.82],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [-hw * 0.82, -hd * 0.34],
          [hw * 0.82, hd * 0.72],
        ],
        fine,
        pickId,
      );
      break;
    case 'wardrobe': {
      const bayCount = Math.max(2, Math.min(5, Math.round(spec.widthM / 0.55)));
      for (let i = 1; i < bayCount; i += 1) {
        const x = -hw + (spec.widthM * i) / bayCount;
        addPolyline(
          group,
          [
            [x, -hd],
            [x, hd],
          ],
          fine,
          pickId,
        );
      }
      for (let i = 0; i < bayCount; i += 1) {
        const x = -hw + (spec.widthM * (i + 0.5)) / bayCount;
        addCircle(group, x, hd * 0.58, 0.025, fine, pickId, 12);
      }
      break;
    }
    case 'lamp':
      addCircle(group, 0, 0, Math.min(hw, hd) * 0.72, mat, pickId, 36);
      addCircle(group, 0, 0, Math.min(hw, hd) * 0.22, fine, pickId, 24);
      addPolyline(
        group,
        [
          [0, -hd * 0.72],
          [0, hd * 0.72],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [-hw * 0.72, 0],
          [hw * 0.72, 0],
        ],
        fine,
        pickId,
      );
      break;
    case 'rug':
      addRect(group, hw * 0.92, hd * 0.88, fine, pickId);
      addPolyline(
        group,
        [
          [-hw * 0.72, -hd * 0.55],
          [hw * 0.72, -hd * 0.55],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [-hw * 0.72, hd * 0.55],
          [hw * 0.72, hd * 0.55],
        ],
        fine,
        pickId,
      );
      break;
    case 'fridge':
      addPolyline(
        group,
        [
          [0, -hd],
          [0, hd],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [hw * 0.62, -hd * 0.72],
          [hw * 0.62, hd * 0.72],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [-hw * 0.8, hd * 0.42],
          [hw * 0.8, hd * 0.42],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [-hw * 0.8, hd * 0.62],
          [hw * 0.8, hd * 0.62],
        ],
        fine,
        pickId,
      );
      break;
    case 'oven':
      addRect(group, hw * 0.68, hd * 0.58, fine, pickId);
      for (const x of [-hw * 0.42, -hw * 0.14, hw * 0.14, hw * 0.42]) {
        addCircle(group, x, -hd * 0.58, Math.min(hw, hd) * 0.1, fine, pickId, 18);
      }
      break;
    case 'sink':
      addRect(group, hw * 0.78, hd * 0.58, fine, pickId);
      addCircle(group, 0, 0, Math.min(hw, hd) * 0.08, fine, pickId, 18);
      addPolyline(
        group,
        [
          [hw * 0.34, -hd * 0.2],
          [hw * 0.5, -hd * 0.36],
        ],
        fine,
        pickId,
      );
      break;
    case 'counter': {
      const bayCount = Math.max(2, Math.min(6, Math.round(spec.widthM / 0.6)));
      for (let i = 1; i < bayCount; i += 1) {
        const x = -hw + (spec.widthM * i) / bayCount;
        addPolyline(
          group,
          [
            [x, -hd],
            [x, hd],
          ],
          fine,
          pickId,
        );
      }
      if (spec.kitchenLayout) {
        const sinkX = offsetFromLeft(spec.widthM, spec.sinkOffsetM, spec.widthM * 0.5);
        const fridgeX = offsetFromLeft(spec.widthM, spec.fridgeOffsetM, 0.35);
        const sinkHw = Math.min(0.32, spec.widthM * 0.11);
        const fridgeHw = Math.min(0.34, spec.widthM * 0.12);
        addRect(group, sinkHw, hd * 0.52, fine, pickId);
        group.children[group.children.length - 1]!.position.x = sinkX;
        addCircle(group, sinkX, 0, Math.min(sinkHw, hd * 0.4) * 0.16, fine, pickId, 16);
        addPolyline(
          group,
          [
            [fridgeX - fridgeHw, -hd],
            [fridgeX + fridgeHw, -hd],
            [fridgeX + fridgeHw, hd],
            [fridgeX - fridgeHw, hd],
            [fridgeX - fridgeHw, -hd],
            [fridgeX, -hd],
            [fridgeX, hd],
          ],
          fine,
          pickId,
        );
      }
      break;
    }
    case 'sofa':
      addPolyline(
        group,
        [
          [-hw, -hd * 0.35],
          [hw, -hd * 0.35],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [-hw * 0.78, -hd],
          [-hw * 0.78, hd],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [hw * 0.78, -hd],
          [hw * 0.78, hd],
        ],
        fine,
        pickId,
      );
      break;
    case 'table':
      addRect(group, hw * 0.78, hd * 0.72, fine, pickId);
      for (const x of [-hw * 0.62, hw * 0.62]) {
        for (const z of [-hd * 0.55, hd * 0.55]) addCircle(group, x, z, 0.035, fine, pickId, 12);
      }
      break;
    case 'chair':
      addPolyline(
        group,
        [
          [-hw, -hd * 0.2],
          [hw, -hd * 0.2],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [-hw * 0.65, -hd],
          [-hw * 0.65, hd],
        ],
        fine,
        pickId,
      );
      addPolyline(
        group,
        [
          [hw * 0.65, -hd],
          [hw * 0.65, hd],
        ],
        fine,
        pickId,
      );
      break;
    case 'toilet':
      addCircle(group, 0, hd * 0.1, Math.min(hw, hd) * 0.48, fine, pickId, 32);
      addPolyline(
        group,
        [
          [-hw * 0.55, -hd],
          [hw * 0.55, -hd],
          [hw * 0.55, -hd * 0.45],
          [-hw * 0.55, -hd * 0.45],
          [-hw * 0.55, -hd],
        ],
        fine,
        pickId,
      );
      break;
    case 'bath':
      addRect(group, hw * 0.84, hd * 0.76, fine, pickId);
      addCircle(group, -hw * 0.62, -hd * 0.44, Math.min(hw, hd) * 0.06, fine, pickId, 14);
      break;
    case 'shower':
      addPolyline(
        group,
        [
          [-hw, -hd],
          [hw, hd],
        ],
        fine,
        pickId,
      );
      addCircle(group, hw * 0.48, -hd * 0.48, Math.min(hw, hd) * 0.12, fine, pickId, 16);
      break;
    case 'bathroom_layout': {
      const showerX = offsetFromLeft(spec.widthM, spec.showerOffsetM, 0.45);
      const toiletX = offsetFromLeft(spec.widthM, spec.toiletOffsetM, spec.widthM * 0.5);
      const vanityX = offsetFromLeft(spec.widthM, spec.vanityOffsetM, spec.widthM - 0.45);
      const showerHalf = Math.min(0.46, hd * 0.42);
      addRect(group, showerHalf, showerHalf, fine, pickId);
      group.children[group.children.length - 1]!.position.x = showerX;
      addPolyline(
        group,
        [
          [showerX - showerHalf, -showerHalf],
          [showerX + showerHalf, showerHalf],
        ],
        fine,
        pickId,
      );
      addCircle(group, toiletX, hd * 0.1, Math.min(hw, hd) * 0.1, fine, pickId, 24);
      addRect(group, Math.min(0.32, hw * 0.16), hd * 0.18, fine, pickId);
      group.children[group.children.length - 1]!.position.x = vanityX;
      break;
    }
    default:
      addPolyline(
        group,
        [
          [-hw, -hd],
          [hw, hd],
        ],
        fine,
        pickId,
      );
      break;
  }
}

function addPlacedAssetSymbolFills(
  group: THREE.Group,
  spec: PlacedAssetRenderSpec,
  pickId: string,
): void {
  const hw = spec.widthM / 2;
  const hd = spec.depthM / 2;
  const base = spec.color;

  switch (spec.symbolKind) {
    case 'bed':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#d6d3d1', 0.2);
      addFilledRect(
        group,
        pickId,
        spec.widthM * 0.88,
        spec.depthM * 0.72,
        0,
        hd * 0.08,
        '#f5f5f4',
        0.72,
      );
      addFilledRect(
        group,
        pickId,
        spec.widthM * 0.28,
        spec.depthM * 0.16,
        -hw * 0.34,
        -hd * 0.66,
        '#ffffff',
        0.86,
      );
      addFilledRect(
        group,
        pickId,
        spec.widthM * 0.28,
        spec.depthM * 0.16,
        hw * 0.34,
        -hd * 0.66,
        '#ffffff',
        0.86,
      );
      break;
    case 'wardrobe':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#e5d3b3', 0.5);
      break;
    case 'lamp':
      addFilledCircle(group, pickId, Math.min(hw, hd) * 0.72, 0, 0, '#fef3c7', 0.68);
      addFilledCircle(group, pickId, Math.min(hw, hd) * 0.16, 0, 0, '#a1a1aa', 0.45);
      break;
    case 'rug':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#dbeafe', 0.42);
      addFilledRect(group, pickId, spec.widthM * 0.76, spec.depthM * 0.62, 0, 0, '#bfdbfe', 0.38);
      break;
    case 'fridge':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#f8fafc', 0.72);
      break;
    case 'oven':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#52525b', 0.36);
      addFilledRect(
        group,
        pickId,
        spec.widthM * 0.58,
        spec.depthM * 0.32,
        0,
        hd * 0.28,
        '#18181b',
        0.28,
      );
      break;
    case 'sink':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#e0f2fe', 0.48);
      addFilledRect(group, pickId, spec.widthM * 0.62, spec.depthM * 0.42, 0, 0, '#bfdbfe', 0.54);
      break;
    case 'counter':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#e7e5e4', 0.46);
      break;
    case 'sofa':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#d6c7b5', 0.48);
      addFilledRect(
        group,
        pickId,
        spec.widthM * 0.82,
        spec.depthM * 0.46,
        0,
        hd * 0.18,
        '#c4b5a5',
        0.36,
      );
      break;
    case 'table':
      addFilledRect(group, pickId, spec.widthM * 0.82, spec.depthM * 0.74, 0, 0, '#d6b28d', 0.5);
      break;
    case 'chair':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#d6c7b5', 0.44);
      addFilledRect(
        group,
        pickId,
        spec.widthM * 0.7,
        spec.depthM * 0.46,
        0,
        hd * 0.16,
        '#c4b5a5',
        0.42,
      );
      break;
    case 'toilet':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#dbeafe', 0.32);
      addFilledCircle(group, pickId, Math.min(hw, hd) * 0.48, 0, hd * 0.1, '#eff6ff', 0.86);
      addFilledRect(
        group,
        pickId,
        spec.widthM * 0.54,
        spec.depthM * 0.24,
        0,
        -hd * 0.72,
        '#bfdbfe',
        0.72,
      );
      break;
    case 'bath':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#f8fafc', 0.72);
      addFilledRect(group, pickId, spec.widthM * 0.72, spec.depthM * 0.58, 0, 0, '#dbeafe', 0.36);
      break;
    case 'shower':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#e0f2fe', 0.42);
      break;
    case 'bathroom_layout':
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, '#f8fafc', 0.34);
      break;
    default:
      addFilledRect(group, pickId, spec.widthM, spec.depthM, 0, 0, base, 0.18);
      break;
  }
}

export function makePlacedAssetPlanSymbol(
  asset: PlacedAssetElement,
  entry: AssetLibraryEntryElement | undefined,
  opts: { y: number; color?: string; minFootprintM?: number } = { y: 0 },
): THREE.Group {
  const spec = resolvePlacedAssetRenderSpec(asset, entry);
  const minFootprintM = Math.max(0, opts.minFootprintM ?? 0);
  const visualSpec =
    minFootprintM > 0
      ? {
          ...spec,
          widthM: Math.max(spec.widthM, minFootprintM),
          depthM: Math.max(spec.depthM, minFootprintM),
        }
      : spec;
  const group = new THREE.Group();
  group.userData.bimPickId = asset.id;
  group.userData.assetSymbolKind = visualSpec.symbolKind;
  group.position.set(asset.positionMm.xMm / 1000, opts.y, asset.positionMm.yMm / 1000);
  group.rotation.y = -(((asset.rotationDeg ?? 0) * Math.PI) / 180);
  addPlacedAssetSymbolLines(group, visualSpec, asset.id, opts.color ?? '#020617');
  return group;
}

function meshMaterial(
  color: string,
  roughness = 0.72,
  metalness = 0.02,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addEdges(mesh: THREE.Mesh, color = '#334155'): void {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }),
  );
  edges.userData.bimPickId = mesh.userData.bimPickId;
  mesh.add(edges);
}

function addBox(
  group: THREE.Group,
  pickId: string,
  size: [number, number, number],
  pos: [number, number, number],
  color: string,
  roughness?: number,
  metalness?: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    meshMaterial(color, roughness, metalness),
  );
  mesh.position.set(...pos);
  mesh.userData.bimPickId = pickId;
  addEdges(mesh);
  group.add(mesh);
  return mesh;
}

function addCylinder(
  group: THREE.Group,
  pickId: string,
  radius: number,
  height: number,
  pos: [number, number, number],
  color: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 24),
    meshMaterial(color),
  );
  mesh.position.set(...pos);
  mesh.userData.bimPickId = pickId;
  addEdges(mesh);
  group.add(mesh);
  return mesh;
}

function addCone(
  group: THREE.Group,
  pickId: string,
  radius: number,
  height: number,
  pos: [number, number, number],
  color: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 32), meshMaterial(color));
  mesh.position.set(...pos);
  mesh.userData.bimPickId = pickId;
  addEdges(mesh);
  group.add(mesh);
  return mesh;
}

function addPlacedAssetMeshes(
  group: THREE.Group,
  spec: PlacedAssetRenderSpec,
  pickId: string,
): void {
  const w = spec.widthM;
  const d = spec.depthM;
  const h = spec.heightM;
  const frontZ = -d / 2 - 0.006;

  switch (spec.symbolKind) {
    case 'bed':
      addBox(group, pickId, [w, 0.18, d], [0, 0.09, 0], '#a8a29e');
      addBox(group, pickId, [w * 0.92, 0.18, d * 0.78], [0, 0.28, d * 0.06], '#e7e5e4');
      addBox(group, pickId, [w * 0.42, 0.12, d * 0.2], [-w * 0.24, 0.45, -d * 0.34], '#f8fafc');
      addBox(group, pickId, [w * 0.42, 0.12, d * 0.2], [w * 0.24, 0.45, -d * 0.34], '#f8fafc');
      addBox(group, pickId, [w, 0.85, 0.08], [0, 0.42, -d * 0.48], '#8d6e63');
      break;
    case 'wardrobe': {
      addBox(group, pickId, [w, h, d], [0, h / 2, 0], spec.color, 0.78, 0.02);
      const bayCount = Math.max(2, Math.min(5, Math.round(w / 0.55)));
      for (let i = 1; i < bayCount; i += 1) {
        const x = -w / 2 + (w * i) / bayCount;
        addBox(group, pickId, [0.012, h * 0.9, 0.018], [x, h * 0.5, frontZ], '#8b7355');
      }
      for (let i = 0; i < bayCount; i += 1) {
        const x = -w / 2 + (w * (i + 0.5)) / bayCount;
        addBox(group, pickId, [0.035, h * 0.22, 0.022], [x, h * 0.52, frontZ], '#64748b');
      }
      break;
    }
    case 'lamp':
      addCylinder(group, pickId, Math.min(w, d) * 0.32, 0.04, [0, 0.02, 0], '#78716c');
      addCylinder(group, pickId, 0.025, h * 0.72, [0, h * 0.36, 0], '#71717a');
      addCone(group, pickId, Math.min(w, d) * 0.34, h * 0.26, [0, h * 0.86, 0], '#fde68a');
      break;
    case 'rug':
      addBox(group, pickId, [w, Math.max(h, 0.025), d], [0, Math.max(h, 0.025) / 2, 0], spec.color);
      addBox(
        group,
        pickId,
        [w * 0.82, Math.max(h, 0.025) + 0.004, d * 0.72],
        [0, Math.max(h, 0.025) + 0.006, 0],
        '#cbd5e1',
      );
      break;
    case 'fridge':
      addBox(group, pickId, [w, h, d], [0, h / 2, 0], spec.color, 0.45, 0.08);
      addBox(group, pickId, [0.012, h * 0.82, 0.018], [w * 0.18, h * 0.53, frontZ], '#64748b');
      addBox(group, pickId, [w * 0.82, 0.012, 0.018], [0, h * 0.52, frontZ], '#94a3b8');
      break;
    case 'oven':
      addBox(group, pickId, [w, h, d], [0, h / 2, 0], spec.color, 0.52, 0.12);
      addBox(
        group,
        pickId,
        [w * 0.72, h * 0.34, 0.018],
        [0, h * 0.48, frontZ],
        '#111827',
        0.18,
        0.05,
      );
      for (const x of [-w * 0.28, 0, w * 0.28]) {
        addCylinder(group, pickId, Math.min(w, d) * 0.035, 0.018, [x, h * 0.82, frontZ], '#e5e7eb');
      }
      break;
    case 'sink':
      addBox(group, pickId, [w, h, d], [0, h / 2, 0], '#d6d3d1');
      addBox(group, pickId, [w * 0.62, 0.055, d * 0.56], [0, h + 0.028, 0], '#94a3b8', 0.25, 0.2);
      addCylinder(group, pickId, 0.025, 0.22, [w * 0.32, h + 0.12, -d * 0.15], '#64748b');
      break;
    case 'counter':
      addBox(group, pickId, [w, h * 0.88, d], [0, (h * 0.88) / 2, 0], spec.color);
      addBox(group, pickId, [w, 0.05, d * 1.04], [0, h * 0.9 + 0.025, 0], '#78716c');
      for (let i = 1; i < Math.max(2, Math.min(6, Math.round(w / 0.6))); i += 1) {
        const x = -w / 2 + (w * i) / Math.max(2, Math.min(6, Math.round(w / 0.6)));
        addBox(group, pickId, [0.012, h * 0.66, 0.018], [x, h * 0.43, frontZ], '#a8a29e');
      }
      if (spec.kitchenLayout) {
        const sinkX = offsetFromLeft(w, spec.sinkOffsetM, w * 0.5);
        const fridgeX = offsetFromLeft(w, spec.fridgeOffsetM, 0.35);
        addBox(
          group,
          pickId,
          [Math.min(0.55, w * 0.18), 0.06, d * 0.62],
          [sinkX, h * 0.94, 0],
          '#94a3b8',
          0.25,
          0.2,
        );
        addBox(
          group,
          pickId,
          [Math.min(0.6, w * 0.18), 1.85, d * 0.95],
          [fridgeX, 0.925, 0],
          '#e5e7eb',
          0.45,
          0.08,
        );
      }
      break;
    case 'sofa':
      addBox(group, pickId, [w, h * 0.42, d * 0.72], [0, h * 0.21, d * 0.08], spec.color);
      addBox(group, pickId, [w, h * 0.7, d * 0.18], [0, h * 0.35, d * 0.42], spec.color);
      addBox(group, pickId, [w * 0.08, h * 0.5, d], [-w * 0.46, h * 0.25, 0], spec.color);
      addBox(group, pickId, [w * 0.08, h * 0.5, d], [w * 0.46, h * 0.25, 0], spec.color);
      break;
    case 'table':
      addBox(group, pickId, [w, 0.08, d], [0, h, 0], spec.color);
      for (const x of [-w * 0.38, w * 0.38]) {
        for (const z of [-d * 0.34, d * 0.34])
          addBox(group, pickId, [0.055, h, 0.055], [x, h / 2, z], '#78716c');
      }
      break;
    case 'chair':
      addBox(group, pickId, [w, h * 0.12, d * 0.72], [0, h * 0.46, 0], spec.color);
      addBox(group, pickId, [w, h * 0.55, d * 0.12], [0, h * 0.7, d * 0.38], spec.color);
      for (const x of [-w * 0.34, w * 0.34]) {
        for (const z of [-d * 0.24, d * 0.24]) {
          addBox(group, pickId, [0.045, h * 0.46, 0.045], [x, h * 0.23, z], '#78716c');
        }
      }
      break;
    case 'toilet':
      addBox(group, pickId, [w * 0.82, h * 0.28, d * 0.32], [0, h * 0.66, -d * 0.32], spec.color);
      addCylinder(
        group,
        pickId,
        Math.min(w, d) * 0.32,
        h * 0.22,
        [0, h * 0.36, d * 0.08],
        spec.color,
      );
      break;
    case 'bath':
      addBox(group, pickId, [w, h, d], [0, h / 2, 0], spec.color);
      addBox(group, pickId, [w * 0.78, h * 0.22, d * 0.62], [0, h * 0.83, 0], '#dbeafe');
      break;
    case 'shower':
      addBox(group, pickId, [w, h, d], [0, h / 2, 0], spec.color);
      addBox(group, pickId, [0.025, 1.9, d], [-w / 2, 0.95, 0], '#bfdbfe', 0.1, 0);
      addBox(group, pickId, [w, 0.025, 0.025], [0, 1.85, -d / 2], '#64748b');
      break;
    case 'bathroom_layout': {
      addBox(group, pickId, [w, 0.06, d], [0, 0.03, 0], '#e5e7eb');
      const showerX = offsetFromLeft(w, spec.showerOffsetM, 0.45);
      const toiletX = offsetFromLeft(w, spec.toiletOffsetM, w * 0.5);
      const vanityX = offsetFromLeft(w, spec.vanityOffsetM, w - 0.45);
      addBox(group, pickId, [0.86, 0.08, 0.86], [showerX, 0.1, 0], '#dbeafe');
      addBox(group, pickId, [0.025, 1.9, 0.86], [showerX - 0.43, 0.95, 0], '#bfdbfe', 0.1, 0);
      addCylinder(group, pickId, 0.18, 0.22, [toiletX, 0.28, d * 0.08], '#f8fafc');
      addBox(group, pickId, [0.42, 0.28, 0.28], [toiletX, 0.66, -d * 0.26], '#f8fafc');
      addBox(group, pickId, [0.62, 0.82, 0.48], [vanityX, 0.41, -d * 0.24], '#d6d3d1');
      addBox(group, pickId, [0.48, 0.055, 0.34], [vanityX, 0.85, -d * 0.24], '#94a3b8', 0.25, 0.2);
      break;
    }
    default:
      addBox(group, pickId, [w, h, d], [0, h / 2, 0], spec.color);
      break;
  }
}

export function makePlacedAssetMesh(
  asset: PlacedAssetElement,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const entry = elementsById[asset.assetId];
  const assetEntry = entry?.kind === 'asset_library_entry' ? entry : undefined;
  const spec = resolvePlacedAssetRenderSpec(asset, assetEntry, paint, { prefer: 'render' });
  const level = elementsById[asset.levelId];
  const elevM = level?.kind === 'level' ? level.elevationMm / 1000 : 0;

  const group = new THREE.Group();
  group.userData.bimPickId = asset.id;
  group.userData.assetSymbolKind = spec.symbolKind;
  group.position.set(asset.positionMm.xMm / 1000, elevM, asset.positionMm.yMm / 1000);
  group.rotation.y = -(((asset.rotationDeg ?? 0) * Math.PI) / 180);
  addPlacedAssetMeshes(group, spec, asset.id);
  return group;
}
