import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { makeThreeMaterialForKey } from './threeMaterialFactory';
import { addEdges } from './sceneHelpers';

export type MassBoxElem = Extract<Element, { kind: 'mass_box' }>;

export function makeMassBoxMesh(elem: MassBoxElem): THREE.Mesh {
  const wM = Math.max(0.1, elem.widthMm / 1000);
  const dM = Math.max(0.1, elem.depthMm / 1000);
  const hM = Math.max(0.1, elem.heightMm / 1000);

  const geo = new THREE.BoxGeometry(wM, hM, dM);
  const mat = makeThreeMaterialForKey(elem.materialKey ?? null, {
    usage: 'mass',
    fallbackColor: '#cccccc',
    fallbackRoughness: 0.85,
    fallbackMetalness: 0,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    elem.insertionXMm / 1000 + wM / 2,
    elem.baseElevationMm / 1000 + hM / 2,
    elem.insertionYMm / 1000 + dM / 2,
  );
  mesh.rotation.y = THREE.MathUtils.degToRad(elem.rotationDeg ?? 0);
  mesh.userData.bimPickId = elem.id;
  addEdges(mesh);
  return mesh;
}
