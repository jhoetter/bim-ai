import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { readToken } from './sceneHelpers';
import { makeThreeMaterialForKey } from './threeMaterialFactory';

export type MassElem = Extract<Element, { kind: 'mass' }>;
export type LevelElem = Extract<Element, { kind: 'level' }>;

/**
 * SKB-02 — translucent volumetric mesh for a `mass` element.
 *
 * The footprint polygon is extruded vertically by `heightMm` and placed
 * at the host level's elevation. The result is rotated by `rotationDeg`
 * around the vertical (Y) axis at the polygon centroid so masses can
 * sit at non-axis-aligned angles before walls are authored.
 *
 * Returns the translucent mesh and a separate outline `LineSegments`
 * (also attached as a child of the mesh) so callers can manipulate the
 * outline independently if needed.
 */
export function buildMassMesh(
  mass: MassElem,
  level: LevelElem,
  elementsById?: Record<string, Element>,
): { mesh: THREE.Mesh; outline: THREE.LineSegments } {
  const fp = mass.footprintMm.length >= 3 ? mass.footprintMm : DEFAULT_FOOTPRINT;
  const heightM = Math.max(mass.heightMm / 1000, 1e-3);

  const shape = new THREE.Shape(fp.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000)));
  const geom = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);

  const mat = makeThreeMaterialForKey(mass.materialKey ?? null, {
    elementsById,
    usage: 'mass',
    fallbackColor: '#cccccc',
    fallbackRoughness: 0.85,
    fallbackMetalness: 0,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, level.elevationMm / 1000, 0);

  const rotDeg = mass.rotationDeg ?? 0;
  if (Math.abs(rotDeg) > 1e-9) {
    const centroid = polygonCentroidM(fp);
    mesh.position.x += centroid.xM;
    mesh.position.z += centroid.zM;
    mesh.rotation.y = THREE.MathUtils.degToRad(rotDeg);
    mesh.translateX(-centroid.xM);
    mesh.translateZ(-centroid.zM);
  }

  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.bimPickId = mass.id;

  const outlineColor = readToken('--color-foreground', '#1a1a1a');
  const edges = new THREE.EdgesGeometry(geom, 1);
  const outline = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: outlineColor, linewidth: 1 }),
  );
  outline.renderOrder = 1;
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);

  return { mesh, outline };
}

const DEFAULT_FOOTPRINT = [
  { xMm: 0, yMm: 0 },
  { xMm: 4000, yMm: 0 },
  { xMm: 4000, yMm: 4000 },
  { xMm: 0, yMm: 4000 },
];

function polygonCentroidM(pts: { xMm: number; yMm: number }[]): { xM: number; zM: number } {
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.xMm;
    sy += p.yMm;
  }
  const n = Math.max(pts.length, 1);
  return { xM: sx / n / 1000, zM: sy / n / 1000 };
}
