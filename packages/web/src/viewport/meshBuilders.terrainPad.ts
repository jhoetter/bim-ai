import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

type ToposolidPadEl = Extract<Element, { kind: 'toposolid_pad' }>;

/** Flat polygon at the pad's elevation — represents the flattened terrain surface. */
export function buildTerrainPadMesh(pad: ToposolidPadEl): THREE.Mesh {
  const eM = pad.elevationMm / 1000;
  const pts = pad.boundaryMm;
  if (pts.length < 3) return new THREE.Mesh();

  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, eM, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: '#c8a882',
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bimPickId = pad.id;
  return mesh;
}
