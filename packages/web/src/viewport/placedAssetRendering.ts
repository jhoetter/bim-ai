import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import type { ViewportPaintBundle } from './materials';

export type PlacedAssetElement = Extract<Element, { kind: 'placed_asset' }>;
export type AssetLibraryEntryElement = Extract<Element, { kind: 'asset_library_entry' }>;

type AssetSymbolKind =
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
  | 'generic';

type PlacedAssetRenderSpec = {
  symbolKind: AssetSymbolKind;
  widthM: number;
  depthM: number;
  heightM: number;
  color: string;
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
  if (/\b(fridge|refrigerator|freezer)\b/.test(text)) return 'fridge';
  if (/\b(oven|cooker|range|hob|cooktop)\b/.test(text)) return 'oven';
  if (/\b(sink|basin|washbasin)\b/.test(text)) return 'sink';
  if (/\b(counter|cabinet|casework|island|worktop)\b/.test(text)) return 'counter';
  if (/\b(sofa|couch|settee)\b/.test(text)) return 'sofa';
  if (/\b(table|desk)\b/.test(text)) return 'table';
  if (/\b(chair|armchair)\b/.test(text)) return 'chair';
  if (/\b(toilet|wc)\b/.test(text)) return 'toilet';
  if (/\b(bath|bathtub|tub)\b/.test(text)) return 'bath';
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
    default:
      return { widthMm: 1000, depthMm: 600, heightMm: 450 };
  }
}

function colorFor(kind: AssetSymbolKind, paint: ViewportPaintBundle | null | undefined): string {
  switch (kind) {
    case 'fridge':
      return '#e5e7eb';
    case 'oven':
      return '#3f3f46';
    case 'sink':
      return '#c7d2fe';
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

function addPolyline(
  group: THREE.Group,
  pts: Array<[number, number]>,
  mat: THREE.LineBasicMaterial,
  pickId: string,
): void {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))),
    mat,
  );
  line.userData.bimPickId = pickId;
  line.renderOrder = 980;
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

function addPlacedAssetSymbolLines(
  group: THREE.Group,
  spec: PlacedAssetRenderSpec,
  pickId: string,
  color: string,
): void {
  const mat = lineMaterial(color, 1.5);
  const fine = lineMaterial(color, 1);
  const hw = spec.widthM / 2;
  const hd = spec.depthM / 2;

  addRect(group, hw, hd, mat, pickId);

  switch (spec.symbolKind) {
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

export function makePlacedAssetPlanSymbol(
  asset: PlacedAssetElement,
  entry: AssetLibraryEntryElement | undefined,
  opts: { y: number; color?: string } = { y: 0 },
): THREE.Group {
  const spec = resolvePlacedAssetRenderSpec(asset, entry);
  const group = new THREE.Group();
  group.userData.bimPickId = asset.id;
  group.userData.assetSymbolKind = spec.symbolKind;
  group.position.set(asset.positionMm.xMm / 1000, opts.y, asset.positionMm.yMm / 1000);
  group.rotation.y = -(((asset.rotationDeg ?? 0) * Math.PI) / 180);
  addPlacedAssetSymbolLines(group, spec, asset.id, opts.color ?? '#111827');
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
