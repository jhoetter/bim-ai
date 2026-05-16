import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { makeThreeMaterialForKey } from './threeMaterialFactory';

export type MassExtrusionElem = Extract<Element, { kind: 'mass_extrusion' }>;

export function makeMassExtrusionMesh(elem: MassExtrusionElem): THREE.Mesh {
  const pts = elem.profilePoints;
  const hM = Math.max(0.1, elem.heightMm / 1000);

  const shape = new THREE.Shape(
    (pts.length >= 3
      ? pts
      : [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 4000 },
          { xMm: 0, yMm: 4000 },
        ]
    ).map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000)),
  );

  const geom = new THREE.ExtrudeGeometry(shape, { depth: hM, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);

  const mat = makeThreeMaterialForKey(elem.materialKey ?? null, {
    usage: 'mass',
    fallbackColor: '#bbccdd',
    fallbackRoughness: 0.85,
    fallbackMetalness: 0,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, elem.baseElevationMm / 1000, 0);
  mesh.userData.bimPickId = elem.id;
  return mesh;
}
