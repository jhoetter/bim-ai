/**
 * Family thumbnail cache (FL-06).
 *
 * Renders a built-in or custom family type into a 128×128 PNG once, then
 * serves the cached blob URL on subsequent calls. Falls back to an inline
 * 1-pixel placeholder when WebGL is unavailable (e.g. jsdom under tests),
 * so callers never need to special-case the test environment.
 */

import * as THREE from 'three';

import type { Element, WallTypeLayer } from '@bim-ai/core';

import { buildDoorGeometry } from './geometryFns/doorGeometry';
import { buildWindowGeometry } from './geometryFns/windowGeometry';
import { buildStairGeometry } from './geometryFns/stairGeometry';
import { buildRailingGeometry } from './geometryFns/railingGeometry';
import { getFamilyById, getTypeById } from './familyCatalog';
import type { WallAssemblyLayer, WallAssemblyLayerFunction } from './wallTypeCatalog';
import { resolveFamilyGeometry, type FamilyCatalogLookup } from './familyResolver';
import type { FamilyDefinition } from './types';
import { makeLayeredWallMesh } from '../viewport/meshBuilders.layeredWall';
import { makeFloorSlabMesh, makeRoofMassMesh } from '../viewport/meshBuilders';
import { makePlacedAssetMesh } from '../viewport/placedAssetRendering';

const SIZE = 128;
const PLACEHOLDER_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>" +
      "<rect width='128' height='128' fill='#e5e5e5'/>" +
      "<rect x='12' y='80' width='104' height='34' fill='#cbd5e1'/>" +
      "<rect x='40' y='40' width='48' height='48' fill='#94a3b8'/>" +
      '</svg>',
  );

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

let renderer: THREE.WebGLRenderer | null = null;
let rendererInitialized = false;

export type WallThumbnailLayerInput = {
  thicknessMm: number;
  materialKey?: string | null;
  function?: WallTypeLayer['function'] | WallAssemblyLayerFunction;
  name?: string;
  exterior?: boolean;
};

export type WallThumbnailInput = {
  id: string;
  name: string;
  layers: WallThumbnailLayerInput[];
  basisLine?: 'center' | 'face_interior' | 'face_exterior';
};

export type AssemblyTypeThumbnailInput = {
  id: string;
  name: string;
  layers: WallThumbnailLayerInput[];
};

export type FamilyTypeThumbnailInput = {
  id: string;
  name: string;
  familyId: string;
  discipline: Extract<Element, { kind: 'family_type' }>['discipline'];
  parameters: Record<string, unknown>;
};

function ensureRenderer(): THREE.WebGLRenderer | null {
  if (rendererInitialized) return renderer;
  rendererInitialized = true;
  if (typeof document === 'undefined') return null;
  // jsdom advertises createElement('canvas') but throws not-implemented from
  // getContext, which we'd otherwise hit inside three.WebGLRenderer. Skip
  // outright when navigator.userAgent identifies jsdom.
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.toLowerCase().includes('jsdom')
  ) {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0xf3f4f6, 1);
    return renderer;
  } catch {
    renderer = null;
    return null;
  }
}

function frameGroup(group: THREE.Object3D, scene: THREE.Scene): THREE.PerspectiveCamera {
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const radius = Math.max(0.5, size.length() / 2);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  const dist = radius * 2.6;
  camera.position.set(center.x + dist * 0.7, center.y + dist * 0.6, center.z + dist * 0.9);
  camera.lookAt(center);

  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(2, 3, 2);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xdde6ff, 0xc8c2b0, 0.55);
  scene.add(hemi);
  return camera;
}

function buildFamilyTypeThumbnailScene(input: FamilyTypeThumbnailInput): THREE.Group | null {
  const family = getFamilyById(input.familyId);
  if (!family) return null;

  const fakeWall = {
    kind: 'wall',
    id: 'thumb-wall',
    name: 'thumb-wall',
    levelId: 'thumb-level',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 2400, yMm: 0 },
    thicknessMm: 200,
    heightMm: 2400,
  } as Extract<Element, { kind: 'wall' }>;

  if (input.discipline === 'door') {
    const door = {
      kind: 'door',
      id: 'thumb-door',
      name: 'thumb-door',
      wallId: 'thumb-wall',
      alongT: 0.5,
      widthMm: Number(input.parameters.leafWidthMm ?? 900),
      familyTypeId: input.id,
    } as Extract<Element, { kind: 'door' }>;
    return buildDoorGeometry({ door, wall: fakeWall, elevM: 0, paint: null, familyDef: family });
  }
  if (input.discipline === 'window') {
    const win = {
      kind: 'window',
      id: 'thumb-window',
      name: 'thumb-window',
      wallId: 'thumb-wall',
      alongT: 0.5,
      widthMm: Number(input.parameters.widthMm ?? 1200),
      heightMm: Number(input.parameters.heightMm ?? 1500),
      sillHeightMm: Number(input.parameters.sillMm ?? 900),
      familyTypeId: input.id,
    } as Extract<Element, { kind: 'window' }>;
    return buildWindowGeometry({ win, wall: fakeWall, elevM: 0, paint: null, familyDef: family });
  }
  if (input.discipline === 'stair') {
    const stair = {
      kind: 'stair',
      id: 'thumb-stair',
      name: 'thumb-stair',
      baseLevelId: 'thumb-base',
      topLevelId: 'thumb-top',
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 3000, yMm: 0 },
      widthMm: Number(input.parameters.widthMm ?? 1200),
      riserMm: Number(input.parameters.riserMm ?? 175),
      treadMm: Number(input.parameters.treadMm ?? 280),
      overrideParams: { familyTypeId: input.id },
    } as Extract<Element, { kind: 'stair' }>;
    return buildStairGeometry({
      stair,
      baseLevelElevM: 0,
      topLevelElevM: 3,
      paint: null,
      familyDef: family,
    });
  }
  if (input.discipline === 'railing') {
    const railing = {
      kind: 'railing',
      id: 'thumb-railing',
      name: 'thumb-railing',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2400, yMm: 0 },
      ],
      guardHeightMm: Number(input.parameters.guardHeightMm ?? 1050),
      overrideParams: { familyTypeId: input.id },
    } as Extract<Element, { kind: 'railing' }>;
    return buildRailingGeometry({
      railing,
      baseElevM: 0,
      topElevM: 0,
      paint: null,
      familyDef: family,
    });
  }
  return null;
}

function inferAssetProxyKind(input: FamilyTypeThumbnailInput) {
  const text = `${input.id} ${input.name} ${input.familyId}`.toLowerCase().replace(/[-_:]/g, ' ');
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
  if (/\b(chair|armchair|lounge\s+chair)\b/.test(text)) return 'chair';
  if (/\b(toilet|wc)\b/.test(text)) return 'toilet';
  if (/\b(bath|bathtub|tub)\b/.test(text)) return 'bath';
  if (/\b(shower)\b/.test(text)) return 'shower';
  return 'generic';
}

function buildFamilyTypeFallbackAssetThumbnailScene(input: FamilyTypeThumbnailInput): THREE.Group {
  const proxyKind = inferAssetProxyKind(input);
  return makePlacedAssetMesh(
    {
      kind: 'placed_asset',
      id: `thumbnail-${input.id}`,
      name: input.name,
      assetId: input.id,
      levelId: 'thumbnail-level',
      positionMm: { xMm: 0, yMm: 0 },
      rotationDeg: -25,
      paramValues: {},
    },
    {
      'thumbnail-level': {
        kind: 'level',
        id: 'thumbnail-level',
        name: 'Preview',
        elevationMm: 0,
      },
      [input.id]: {
        kind: 'asset_library_entry',
        id: input.id,
        assetKind: 'family_instance',
        name: input.name,
        tags: [input.discipline, input.familyId],
        category: 'furniture',
        disciplineTags: [],
        thumbnailKind: 'rendered_3d',
        planSymbolKind: proxyKind,
        renderProxyKind: proxyKind,
      },
    },
    null,
  );
}

function buildThumbnailScene(typeId: string): THREE.Group | null {
  const builtin = getTypeById(typeId);
  if (!builtin) return null;
  return buildFamilyTypeThumbnailScene({
    id: builtin.id,
    name: builtin.name,
    familyId: builtin.familyId,
    discipline: builtin.discipline,
    parameters: builtin.parameters,
  });
}

function normalizeWallLayerFunction(
  value: WallThumbnailLayerInput['function'] | undefined,
): WallAssemblyLayerFunction {
  if (
    value === 'structure' ||
    value === 'insulation' ||
    value === 'finish' ||
    value === 'membrane' ||
    value === 'air'
  ) {
    return value;
  }
  return 'structure';
}

function normalizeCoreLayerFunction(
  value: WallThumbnailLayerInput['function'] | undefined,
): WallTypeLayer['function'] {
  if (value === 'structure' || value === 'insulation' || value === 'finish') return value;
  return 'structure';
}

function fallbackMaterialKey(layerFunction: WallAssemblyLayerFunction): string {
  switch (layerFunction) {
    case 'insulation':
      return 'timber_frame_insulation';
    case 'finish':
      return 'plasterboard';
    case 'membrane':
      return 'vcl_membrane';
    case 'air':
      return 'air';
    default:
      return 'masonry_block';
  }
}

function wallThumbnailCacheKey(input: WallThumbnailInput): string {
  const layers = input.layers.map((layer) => [
    layer.thicknessMm,
    layer.materialKey ?? '',
    layer.function ?? '',
    layer.exterior ? 1 : 0,
  ]);
  return `wall:${input.id}:${input.basisLine ?? 'center'}:${JSON.stringify(layers)}`;
}

function buildWallTypeThumbnailScene(input: WallThumbnailInput): THREE.Group {
  const layers =
    input.layers.length > 0
      ? input.layers
      : [{ thicknessMm: 200, function: 'structure' as const, materialKey: 'masonry_block' }];

  const assemblyLayers: WallAssemblyLayer[] = layers.map((layer, index) => {
    const layerFunction = normalizeWallLayerFunction(layer.function);
    return {
      name: layer.name ?? `Layer ${index + 1}`,
      thicknessMm: Math.max(1, layer.thicknessMm),
      materialKey: layer.materialKey ?? fallbackMaterialKey(layerFunction),
      function: layerFunction,
      exterior: layer.exterior,
    };
  });

  const wall = {
    kind: 'wall',
    id: `thumb-wall-${input.id}`,
    name: input.name,
    levelId: 'thumbnail-level',
    start: { xMm: -900, yMm: 0 },
    end: { xMm: 900, yMm: 0 },
    thicknessMm: assemblyLayers.reduce((acc, layer) => acc + layer.thicknessMm, 0),
    heightMm: 1200,
  } as Extract<Element, { kind: 'wall' }>;

  return makeLayeredWallMesh(
    wall,
    {
      id: input.id,
      name: input.name,
      basisLine: input.basisLine ?? 'center',
      layers: assemblyLayers,
    },
    0,
    null,
  );
}

function assemblyThicknessMm(input: AssemblyTypeThumbnailInput): number {
  const total = input.layers.reduce((sum, layer) => sum + Math.max(0, layer.thicknessMm), 0);
  return Math.max(80, total || 180);
}

function buildFloorTypeThumbnailScene(input: AssemblyTypeThumbnailInput): THREE.Object3D {
  const level: Extract<Element, { kind: 'level' }> = {
    kind: 'level',
    id: 'thumbnail-level',
    name: 'Preview',
    elevationMm: 0,
  };
  const floorType: Extract<Element, { kind: 'floor_type' }> = {
    kind: 'floor_type',
    id: input.id,
    name: input.name,
    layers: input.layers.map((layer) => ({
      thicknessMm: layer.thicknessMm,
      materialKey: layer.materialKey ?? '',
      function: normalizeCoreLayerFunction(layer.function),
    })),
  };
  const floor: Extract<Element, { kind: 'floor' }> = {
    kind: 'floor',
    id: `thumb-floor-${input.id}`,
    name: input.name,
    levelId: level.id,
    floorTypeId: floorType.id,
    thicknessMm: assemblyThicknessMm(input),
    boundaryMm: [
      { xMm: -1500, yMm: -950 },
      { xMm: 1500, yMm: -950 },
      { xMm: 1500, yMm: 950 },
      { xMm: -1500, yMm: 950 },
    ],
  };
  return makeFloorSlabMesh(floor, { [level.id]: level, [floorType.id]: floorType }, null);
}

function buildRoofTypeThumbnailScene(input: AssemblyTypeThumbnailInput): THREE.Object3D {
  const level: Extract<Element, { kind: 'level' }> = {
    kind: 'level',
    id: 'thumbnail-level',
    name: 'Preview',
    elevationMm: 0,
  };
  const roofType: Extract<Element, { kind: 'roof_type' }> = {
    kind: 'roof_type',
    id: input.id,
    name: input.name,
    layers: input.layers.map((layer) => ({
      thicknessMm: layer.thicknessMm,
      materialKey: layer.materialKey ?? '',
      function: normalizeCoreLayerFunction(layer.function),
    })),
  };
  const roof: Extract<Element, { kind: 'roof' }> = {
    kind: 'roof',
    id: `thumb-roof-${input.id}`,
    name: input.name,
    referenceLevelId: level.id,
    roofTypeId: roofType.id,
    footprintMm: [
      { xMm: -1600, yMm: -950 },
      { xMm: 1600, yMm: -950 },
      { xMm: 1600, yMm: 950 },
      { xMm: -1600, yMm: 950 },
    ],
    overhangMm: 150,
    slopeDeg: 32,
    roofGeometryMode: 'gable_pitched_rectangle',
  };
  return makeRoofMassMesh(roof, { [level.id]: level, [roofType.id]: roofType }, null);
}

function blobUrlFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise<string>((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(canvas.toDataURL('image/png'));
        }
      });
    } else {
      resolve(canvas.toDataURL('image/png'));
    }
  });
}

async function renderTypeThumbnail(typeId: string): Promise<string> {
  const r = ensureRenderer();
  const group = buildThumbnailScene(typeId);
  if (!r || !group) return PLACEHOLDER_DATA_URL;

  const scene = new THREE.Scene();
  scene.add(group);
  const camera = frameGroup(group, scene);
  try {
    r.render(scene, camera);
    const url = await blobUrlFromCanvas(r.domElement);
    return url;
  } catch {
    return PLACEHOLDER_DATA_URL;
  } finally {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose?.();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat?.dispose?.();
      }
    });
  }
}

async function renderWallTypeThumbnail(input: WallThumbnailInput): Promise<string> {
  const r = ensureRenderer();
  if (!r) return PLACEHOLDER_DATA_URL;

  const group = buildWallTypeThumbnailScene(input);
  const scene = new THREE.Scene();
  scene.add(group);
  const camera = frameGroup(group, scene);
  try {
    r.render(scene, camera);
    return await blobUrlFromCanvas(r.domElement);
  } catch {
    return PLACEHOLDER_DATA_URL;
  } finally {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose?.();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat?.dispose?.();
      }
    });
  }
}

async function renderAssemblyTypeThumbnail(
  kind: 'floor_type' | 'roof_type',
  input: AssemblyTypeThumbnailInput,
): Promise<string> {
  const r = ensureRenderer();
  if (!r) return PLACEHOLDER_DATA_URL;

  const group =
    kind === 'floor_type'
      ? buildFloorTypeThumbnailScene(input)
      : buildRoofTypeThumbnailScene(input);
  const scene = new THREE.Scene();
  scene.add(group);
  const camera = frameGroup(group, scene);
  try {
    r.render(scene, camera);
    return await blobUrlFromCanvas(r.domElement);
  } catch {
    return PLACEHOLDER_DATA_URL;
  } finally {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry?.dispose?.();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat?.dispose?.();
      }
    });
  }
}

async function renderFamilyTypeThumbnail(input: FamilyTypeThumbnailInput): Promise<string> {
  const r = ensureRenderer();
  if (!r) return PLACEHOLDER_DATA_URL;

  const group =
    buildFamilyTypeThumbnailScene(input) ?? buildFamilyTypeFallbackAssetThumbnailScene(input);
  const scene = new THREE.Scene();
  scene.add(group);
  const camera = frameGroup(group, scene);
  try {
    r.render(scene, camera);
    return await blobUrlFromCanvas(r.domElement);
  } catch {
    return PLACEHOLDER_DATA_URL;
  } finally {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry?.dispose?.();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat?.dispose?.();
      }
    });
  }
}

export async function getThumbnail(typeId: string): Promise<string> {
  const cached = cache.get(typeId);
  if (cached) return cached;
  const pending = inFlight.get(typeId);
  if (pending) return pending;

  const promise = renderTypeThumbnail(typeId)
    .catch(() => PLACEHOLDER_DATA_URL)
    .then((url) => {
      cache.set(typeId, url);
      inFlight.delete(typeId);
      return url;
    });
  inFlight.set(typeId, promise);
  return promise;
}

function familyTypeThumbnailCacheKey(input: FamilyTypeThumbnailInput): string {
  return `family_type:${input.id}:${input.familyId}:${input.discipline}:${JSON.stringify(
    input.parameters,
  )}`;
}

export async function getFamilyTypeThumbnail(input: FamilyTypeThumbnailInput): Promise<string> {
  const cacheKey = familyTypeThumbnailCacheKey(input);
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = renderFamilyTypeThumbnail(input)
    .catch(() => PLACEHOLDER_DATA_URL)
    .then((url) => {
      cache.set(cacheKey, url);
      inFlight.delete(cacheKey);
      return url;
    });
  inFlight.set(cacheKey, promise);
  return promise;
}

export async function getWallTypeThumbnail(input: WallThumbnailInput): Promise<string> {
  const cacheKey = wallThumbnailCacheKey(input);
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = renderWallTypeThumbnail(input)
    .catch(() => PLACEHOLDER_DATA_URL)
    .then((url) => {
      cache.set(cacheKey, url);
      inFlight.delete(cacheKey);
      return url;
    });
  inFlight.set(cacheKey, promise);
  return promise;
}

function assemblyTypeThumbnailCacheKey(
  kind: 'floor_type' | 'roof_type',
  input: AssemblyTypeThumbnailInput,
): string {
  const layers = input.layers.map((layer) => [
    layer.thicknessMm,
    layer.materialKey ?? '',
    layer.function ?? '',
  ]);
  return `${kind}:${input.id}:${JSON.stringify(layers)}`;
}

export async function getFloorTypeThumbnail(input: AssemblyTypeThumbnailInput): Promise<string> {
  const cacheKey = assemblyTypeThumbnailCacheKey('floor_type', input);
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = renderAssemblyTypeThumbnail('floor_type', input)
    .catch(() => PLACEHOLDER_DATA_URL)
    .then((url) => {
      cache.set(cacheKey, url);
      inFlight.delete(cacheKey);
      return url;
    });
  inFlight.set(cacheKey, promise);
  return promise;
}

export async function getRoofTypeThumbnail(input: AssemblyTypeThumbnailInput): Promise<string> {
  const cacheKey = assemblyTypeThumbnailCacheKey('roof_type', input);
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = renderAssemblyTypeThumbnail('roof_type', input)
    .catch(() => PLACEHOLDER_DATA_URL)
    .then((url) => {
      cache.set(cacheKey, url);
      inFlight.delete(cacheKey);
      return url;
    });
  inFlight.set(cacheKey, promise);
  return promise;
}

/**
 * FAM-01 — render the composed geometry of an authored family (which
 * may contain nested `family_instance_ref` placements) for FL-06's
 * library thumbnail. Walks the catalog through `resolveFamilyGeometry`
 * so nested-family expansion + cycle detection is centralised in the
 * resolver. Falls back to the static placeholder when WebGL is not
 * available (jsdom under tests).
 */
async function renderFamilyComposedThumbnail(
  familyId: string,
  catalog: FamilyCatalogLookup,
): Promise<string> {
  const r = ensureRenderer();
  const def: FamilyDefinition | undefined = catalog[familyId];
  if (!r || !def) return PLACEHOLDER_DATA_URL;

  let group: THREE.Group;
  try {
    const params: Record<string, number | boolean | string> = {};
    for (const p of def.params) {
      const dv = p.default;
      if (typeof dv === 'number' || typeof dv === 'boolean' || typeof dv === 'string') {
        params[p.key] = dv;
      }
    }
    group = resolveFamilyGeometry(familyId, params, catalog);
  } catch {
    return PLACEHOLDER_DATA_URL;
  }
  if (group.children.length === 0) return PLACEHOLDER_DATA_URL;

  const scene = new THREE.Scene();
  scene.add(group);
  const camera = frameGroup(group, scene);
  try {
    r.render(scene, camera);
    return await blobUrlFromCanvas(r.domElement);
  } catch {
    return PLACEHOLDER_DATA_URL;
  } finally {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose?.();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat?.dispose?.();
      }
    });
  }
}

export async function getFamilyComposedThumbnail(
  familyId: string,
  catalog: FamilyCatalogLookup,
): Promise<string> {
  const cacheKey = `family:${familyId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = renderFamilyComposedThumbnail(familyId, catalog)
    .catch(() => PLACEHOLDER_DATA_URL)
    .then((url) => {
      cache.set(cacheKey, url);
      inFlight.delete(cacheKey);
      return url;
    });
  inFlight.set(cacheKey, promise);
  return promise;
}

/** Test-only escape hatch — clears the cache so successive runs render fresh. */
export function __resetThumbnailCacheForTest(): void {
  for (const url of cache.values()) {
    if (url.startsWith('blob:') && typeof URL !== 'undefined') {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* noop */
      }
    }
  }
  cache.clear();
  inFlight.clear();
}

export const PLACEHOLDER_THUMBNAIL = PLACEHOLDER_DATA_URL;
