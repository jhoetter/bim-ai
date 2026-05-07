import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

/**
 * KRN-05: project-scope reference plane marker for the 3D viewport.
 *
 * Renders a translucent green vertical plane that spans from the host level's
 * elevation up by the level's height (or a sensible default if the level has
 * no explicit height). The plane is double-sided so it reads from either side
 * and uses depthWrite:false so geometry behind it stays visible. When
 * `isWorkPlane` is true the plane uses a brighter accent color so the active
 * sketch anchor pops in the canvas.
 */

const REF_PLANE_COLOR = 0x00c850; // RGBA per WP: 0,200,80
const REF_PLANE_WORK_COLOR = 0x10b981;
const REF_PLANE_ALPHA = 0.15;
const REF_PLANE_FALLBACK_HEIGHT_M = 3.0;

type ProjectRefPlane = {
  kind: 'reference_plane';
  id: string;
  name?: string;
  levelId: string;
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
  isWorkPlane?: boolean;
};

function isProjectRefPlane(
  el: Extract<Element, { kind: 'reference_plane' }>,
): el is Extract<Element, { kind: 'reference_plane' }> & ProjectRefPlane {
  return 'levelId' in el && typeof (el as { levelId?: unknown }).levelId === 'string';
}

export function makeReferencePlaneMarker(
  el: Extract<Element, { kind: 'reference_plane' }>,
  elementsById: Record<string, Element>,
): THREE.Object3D | null {
  if (!isProjectRefPlane(el)) return null;
  const lvl = elementsById[el.levelId];
  if (!lvl || lvl.kind !== 'level') return null;

  const baseElevM = lvl.elevationMm / 1000;
  const heightMm = (lvl as { heightMm?: number }).heightMm;
  const heightM =
    typeof heightMm === 'number' && heightMm > 0 ? heightMm / 1000 : REF_PLANE_FALLBACK_HEIGHT_M;

  const ax = el.startMm.xMm / 1000;
  const az = el.startMm.yMm / 1000;
  const bx = el.endMm.xMm / 1000;
  const bz = el.endMm.yMm / 1000;
  const dx = bx - ax;
  const dz = bz - az;
  const lenM = Math.hypot(dx, dz);
  if (lenM <= 1e-6) return null;

  const grp = new THREE.Group();

  const planeGeo = new THREE.PlaneGeometry(lenM, heightM);
  const mat = new THREE.MeshBasicMaterial({
    color: el.isWorkPlane ? REF_PLANE_WORK_COLOR : REF_PLANE_COLOR,
    transparent: true,
    opacity: REF_PLANE_ALPHA,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(planeGeo, mat);

  // World pos: midpoint of the line, centered vertically over the level.
  // Model X→world X, model Y→world Z, level elevation→world Y.
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const cy = baseElevM + heightM / 2;
  mesh.position.set(cx, cy, cz);

  // PlaneGeometry's local normal is +Z; we want it to be perpendicular to the
  // line direction in plan (XZ). Rotate around world Y by -atan2(dz, dx).
  mesh.rotation.y = -Math.atan2(dz, dx);

  mesh.userData.bimPickId = el.id;
  mesh.userData.referencePlaneId = el.id;
  grp.add(mesh);

  // Outline edges so the plane is legible even when the alpha washes out.
  const edgeGeo = new THREE.EdgesGeometry(planeGeo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: el.isWorkPlane ? REF_PLANE_WORK_COLOR : REF_PLANE_COLOR,
    transparent: true,
    opacity: 0.55,
  });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  grp.add(edges);

  grp.userData.bimPickId = el.id;
  grp.userData.referencePlaneId = el.id;
  return grp;
}
