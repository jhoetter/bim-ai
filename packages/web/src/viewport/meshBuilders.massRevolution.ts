import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { makeThreeMaterialForKey } from './threeMaterialFactory';

export type MassRevolutionElem = Extract<Element, { kind: 'mass_revolution' }>;

export function makeMassRevolutionMesh(elem: MassRevolutionElem): THREE.Mesh {
  const pts = elem.profilePoints;
  const startDeg = elem.startAngleDeg ?? 0;
  const endDeg = elem.endAngleDeg ?? 360;
  const phiLength = THREE.MathUtils.degToRad(Math.abs(endDeg - startDeg));
  const phiStart = THREE.MathUtils.degToRad(startDeg);

  // LatheGeometry takes points in the XY plane and revolves around the Y axis.
  // Profile points are in plan (xMm, yMm); we treat xMm as radius, yMm as height.
  const lathePoints =
    pts.length >= 2
      ? pts.map((p) => new THREE.Vector2(Math.max(0, p.xMm / 1000), p.yMm / 1000))
      : [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(2, 0),
          new THREE.Vector2(2, 3),
          new THREE.Vector2(0, 3),
        ];

  const segments = Math.max(8, Math.round(phiLength / (Math.PI / 16)));
  const geom = new THREE.LatheGeometry(lathePoints, segments, phiStart, phiLength);

  const mat = makeThreeMaterialForKey(elem.materialKey ?? null, {
    usage: 'mass',
    fallbackColor: '#ddccbb',
    fallbackRoughness: 0.85,
    fallbackMetalness: 0,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(elem.axisPt1.xMm / 1000, elem.baseElevationMm / 1000, elem.axisPt1.yMm / 1000);
  mesh.userData.bimPickId = elem.id;
  return mesh;
}
