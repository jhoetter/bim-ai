import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { makeThreeMaterialForKey } from './threeMaterialFactory';
import { addEdges } from './sceneHelpers';
import type { ViewportPaintBundle } from './materials';
import { categoryColorOr } from './sceneHelpers';

export type BraceElem = Extract<Element, { kind: 'brace' }>;

export function makeBraceMesh(
  brace: BraceElem,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const sx = brace.startXMm / 1000;
  const sy = brace.startElevationMm / 1000;
  const sz = brace.startYMm / 1000;
  const ex = brace.endXMm / 1000;
  const ey = brace.endElevationMm / 1000;
  const ez = brace.endYMm / 1000;

  const dx = ex - sx;
  const dy = ey - sy;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy + dz * dz));

  // 200mm x 200mm cross-section default
  const wM = 0.2;
  const hM = 0.2;

  const geo = new THREE.BoxGeometry(len, hM, wM);
  const mat = makeThreeMaterialForKey(brace.materialKey, {
    usage: 'structural',
    fallbackColor: categoryColorOr(paint, 'wall'),
    fallbackRoughness: paint?.categories.wall.roughness ?? 0.8,
    fallbackMetalness: paint?.categories.wall.metalness ?? 0,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // Position at midpoint
  mesh.position.set(sx + dx / 2, sy + dy / 2, sz + dz / 2);

  // Rotate to align with diagonal axis
  // The box local X axis is along its length; align to the brace direction vector
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const axis = new THREE.Vector3(1, 0, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir);
  mesh.quaternion.copy(quaternion);

  mesh.userData.bimPickId = brace.id;
  addEdges(mesh);
  return mesh;
}
