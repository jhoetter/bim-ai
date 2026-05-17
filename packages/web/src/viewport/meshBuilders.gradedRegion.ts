import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

/**
 * §5.1.6 — Build a 3D mesh for a graded_region element.
 * Renders as a sloped surface at the average of lowerElevationMm and upperElevationMm,
 * using a green MeshStandardMaterial to indicate the graded terrain region.
 */
export function buildGradedRegionMesh(el: Extract<Element, { kind: 'graded_region' }>): THREE.Mesh {
  const avgElev = ((el.lowerElevationMm ?? 0) + (el.upperElevationMm ?? 500)) / 2;
  const pts = el.perimeterMm ?? el.boundaryMm ?? [];
  if (pts.length === 0) return new THREE.Mesh();

  const shape = new THREE.Shape();
  shape.moveTo(pts[0]!.xMm / 1000, pts[0]!.yMm / 1000);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i]!.xMm / 1000, pts[i]!.yMm / 1000);
  }
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshStandardMaterial({
    color: '#8fbc8f',
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = avgElev / 1000;
  mesh.userData.bimPickId = el.id;
  return mesh;
}
