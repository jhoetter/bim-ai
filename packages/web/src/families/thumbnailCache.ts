/**
 * Family thumbnail cache (FL-06).
 *
 * Renders a built-in or custom family type into a 128×128 PNG once, then
 * serves the cached blob URL on subsequent calls. Falls back to an inline
 * 1-pixel placeholder when WebGL is unavailable (e.g. jsdom under tests),
 * so callers never need to special-case the test environment.
 */

import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { buildDoorGeometry } from './geometryFns/doorGeometry';
import { buildWindowGeometry } from './geometryFns/windowGeometry';
import { buildStairGeometry } from './geometryFns/stairGeometry';
import { buildRailingGeometry } from './geometryFns/railingGeometry';
import { getFamilyById, getTypeById } from './familyCatalog';
import { resolveFamilyGeometry, type FamilyCatalogLookup } from './familyResolver';
import type { FamilyDefinition } from './types';

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

function buildThumbnailScene(typeId: string): THREE.Group | null {
  const builtin = getTypeById(typeId);
  if (!builtin) return null;
  const family = getFamilyById(builtin.familyId);
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

  if (builtin.discipline === 'door') {
    const door = {
      kind: 'door',
      id: 'thumb-door',
      name: 'thumb-door',
      wallId: 'thumb-wall',
      alongT: 0.5,
      widthMm: Number(builtin.parameters.leafWidthMm ?? 900),
      familyTypeId: builtin.id,
    } as Extract<Element, { kind: 'door' }>;
    return buildDoorGeometry({ door, wall: fakeWall, elevM: 0, paint: null, familyDef: family });
  }
  if (builtin.discipline === 'window') {
    const win = {
      kind: 'window',
      id: 'thumb-window',
      name: 'thumb-window',
      wallId: 'thumb-wall',
      alongT: 0.5,
      widthMm: Number(builtin.parameters.widthMm ?? 1200),
      heightMm: Number(builtin.parameters.heightMm ?? 1500),
      sillHeightMm: Number(builtin.parameters.sillMm ?? 900),
      familyTypeId: builtin.id,
    } as Extract<Element, { kind: 'window' }>;
    return buildWindowGeometry({ win, wall: fakeWall, elevM: 0, paint: null, familyDef: family });
  }
  if (builtin.discipline === 'stair') {
    const stair = {
      kind: 'stair',
      id: 'thumb-stair',
      name: 'thumb-stair',
      baseLevelId: 'thumb-base',
      topLevelId: 'thumb-top',
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 3000, yMm: 0 },
      widthMm: Number(builtin.parameters.widthMm ?? 1200),
      riserMm: Number(builtin.parameters.riserMm ?? 175),
      treadMm: Number(builtin.parameters.treadMm ?? 280),
      overrideParams: { familyTypeId: builtin.id },
    } as Extract<Element, { kind: 'stair' }>;
    return buildStairGeometry({
      stair,
      baseLevelElevM: 0,
      topLevelElevM: 3,
      paint: null,
      familyDef: family,
    });
  }
  if (builtin.discipline === 'railing') {
    const railing = {
      kind: 'railing',
      id: 'thumb-railing',
      name: 'thumb-railing',
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 2400, yMm: 0 },
      ],
      guardHeightMm: Number(builtin.parameters.guardHeightMm ?? 1050),
      overrideParams: { familyTypeId: builtin.id },
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
