import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { makeThreeMaterialForKey } from './threeMaterialFactory';
import { addEdges, categoryColorOr } from './sceneHelpers';
import { yawForPlanSegment } from './planSegmentOrientation';
import type { ViewportPaintBundle } from './materials';

export type BeamSystemElem = Extract<Element, { kind: 'beam_system' }>;

/** Clip a line against a polygon boundary. Returns [tMin, tMax] pairs inside the polygon. */
function clipLineToPolygon(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  poly: { xMm: number; yMm: number }[],
): [number, number][] {
  const intersections: number[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ax = a.xMm / 1000,
      az = a.yMm / 1000;
    const bx = b.xMm / 1000,
      bz = b.yMm / 1000;
    const edgeDx = bx - ax;
    const edgeDz = bz - az;
    const denom = dx * edgeDz - dz * edgeDx;
    if (Math.abs(denom) < 1e-9) continue;
    const t = ((ax - ox) * edgeDz - (az - oz) * edgeDx) / denom;
    const s = ((ax - ox) * dz - (az - oz) * dx) / denom;
    if (s >= 0 && s <= 1) {
      intersections.push(t);
    }
  }
  intersections.sort((a, b) => a - b);
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < intersections.length; i += 2) {
    pairs.push([intersections[i], intersections[i + 1]]);
  }
  return pairs;
}

export function makeBeamSystemMesh(
  sys: BeamSystemElem,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = sys.id;

  const boundary = sys.boundaryPoints;
  if (boundary.length < 3) return group;

  const spacingM = Math.max(0.1, sys.spacingMm / 1000);
  const angleRad = THREE.MathUtils.degToRad(sys.beamDirection ?? 0);
  const dirX = Math.cos(angleRad);
  const dirZ = Math.sin(angleRad);
  const perpX = -dirZ;
  const perpZ = dirX;

  let minPerp = Infinity,
    maxPerp = -Infinity;
  for (const p of boundary) {
    const px = p.xMm / 1000;
    const pz = p.yMm / 1000;
    const proj = px * perpX + pz * perpZ;
    if (proj < minPerp) minPerp = proj;
    if (proj > maxPerp) maxPerp = proj;
  }

  const mat = makeThreeMaterialForKey(sys.materialKey, {
    usage: 'structural',
    fallbackColor: categoryColorOr(paint, 'wall'),
    fallbackRoughness: paint?.categories.wall.roughness ?? 0.8,
    fallbackMetalness: paint?.categories.wall.metalness ?? 0,
  });

  const beamWidthM = 0.2;
  const beamHeightM = 0.4;

  for (let t = minPerp; t <= maxPerp + 1e-6; t += spacingM) {
    const ox = t * perpX;
    const oz = t * perpZ;
    const pairs = clipLineToPolygon(ox, oz, dirX, dirZ, boundary);
    for (const [t0, t1] of pairs) {
      const sx = ox + t0 * dirX;
      const sz = oz + t0 * dirZ;
      const ex = ox + t1 * dirX;
      const ez = oz + t1 * dirZ;
      const len = Math.max(0.001, Math.hypot(ex - sx, ez - sz));
      const geo = new THREE.BoxGeometry(len, beamHeightM, beamWidthM);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sx + (ex - sx) / 2, elevM - beamHeightM / 2, sz + (ez - sz) / 2);
      mesh.rotation.y = yawForPlanSegment(ex - sx, ez - sz);
      addEdges(mesh);
      group.add(mesh);
    }
  }

  return group;
}
