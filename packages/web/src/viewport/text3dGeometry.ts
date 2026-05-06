import * as THREE from 'three';
import { Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import type { Element, Text3dFontFamily } from '@bim-ai/core';

import type { ViewportPaintBundle } from './materials';
import { categoryColorOr, addEdges } from './sceneHelpers';

const FONT_URL: Record<Text3dFontFamily, string> = {
  helvetiker: '/fonts/helvetiker_regular.typeface.json',
  optimer: '/fonts/optimer_regular.typeface.json',
  gentilis: '/fonts/gentilis_regular.typeface.json',
};

const fontCache = new Map<Text3dFontFamily, Promise<Font>>();
const resolvedFontCache = new Map<Text3dFontFamily, Font>();

export function loadText3dFont(family: Text3dFontFamily): Promise<Font> {
  const cached = fontCache.get(family);
  if (cached) return cached;
  const url = FONT_URL[family] ?? FONT_URL.helvetiker;
  const loader = new FontLoader();
  const promise = new Promise<Font>((resolve, reject) => {
    loader.load(
      url,
      (f) => {
        resolvedFontCache.set(family, f);
        resolve(f);
      },
      undefined,
      (err) => reject(err),
    );
  });
  fontCache.set(family, promise);
  return promise;
}

/** Synchronous lookup — returns null until `loadText3dFont` has resolved. */
export function getResolvedText3dFont(family: Text3dFontFamily): Font | null {
  return resolvedFontCache.get(family) ?? null;
}

/** Test/SSR helper — pre-seed the cache with a Font already constructed from JSON. */
export function _setText3dFontForTesting(family: Text3dFontFamily, font: Font): void {
  fontCache.set(family, Promise.resolve(font));
  resolvedFontCache.set(family, font);
}

export function _clearText3dFontCache(): void {
  fontCache.clear();
  resolvedFontCache.clear();
}

/**
 * Build a 3D extruded text mesh from a `text_3d` element + a pre-loaded Font.
 *
 * Caller is responsible for resolving the font (`loadText3dFont`) — this lets
 * tests inject a Font instance synchronously and lets the scene manager
 * reuse cached fonts without re-fetching per element.
 */
export function makeText3dMesh(
  el: Extract<Element, { kind: 'text_3d' }>,
  font: Font,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const sizeM = Math.max(0.001, el.fontSizeMm / 1000);
  const depthM = Math.max(0.001, el.depthMm / 1000);
  const text = el.text || ' ';

  // TextGeometry curveSegments default 12 is good for letterforms; reduce a touch
  // to keep tri-count modest at typical 200 mm font sizes.
  const geo = new TextGeometry(text, {
    font,
    size: sizeM,
    depth: depthM,
    curveSegments: 8,
    bevelEnabled: false,
  });
  geo.computeBoundingBox();

  const mat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'wall'),
    roughness: paint?.categories.wall.roughness ?? 0.7,
    metalness: paint?.categories.wall.metalness ?? 0,
  });
  const mesh = new THREE.Mesh(geo, mat);

  // Position: model XY → world XZ, model Z (up) → world Y. Match the rest of meshBuilders.
  // TextGeometry baseline is at y=0; treat positionMm.zMm as the baseline elevation
  // (in mm), so the bottom of the letterforms sits at that elevation.
  mesh.position.set(el.positionMm.xMm / 1000, el.positionMm.zMm / 1000, el.positionMm.yMm / 1000);
  mesh.rotation.y = THREE.MathUtils.degToRad(el.rotationDeg ?? 0);

  mesh.userData.bimPickId = el.id;
  addEdges(mesh, 30);
  return mesh;
}
