import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

export type BeamSystemElem = Extract<Element, { kind: 'beam_system' }>;

export function beamSystemPlanThree(sys: BeamSystemElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = sys.id;

  const boundary = sys.boundaryPoints;
  if (boundary.length < 3) return group;

  const mat = new THREE.LineBasicMaterial({ color: 0x444444 });

  const bPts = [
    ...boundary.map((p) => new THREE.Vector3(p.xMm / 1000, 0, p.yMm / 1000)),
    new THREE.Vector3(boundary[0].xMm / 1000, 0, boundary[0].yMm / 1000),
  ];
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bPts), mat));

  const cx = boundary.reduce((s, p) => s + p.xMm, 0) / boundary.length / 1000;
  const cz = boundary.reduce((s, p) => s + p.yMm, 0) / boundary.length / 1000;
  const angleRad = THREE.MathUtils.degToRad(sys.beamDirection ?? 0);
  const arrowLen = 0.5;
  const arrowEnd = new THREE.Vector3(
    cx + Math.cos(angleRad) * arrowLen,
    0,
    cz + Math.sin(angleRad) * arrowLen,
  );
  const arrowMat = new THREE.LineBasicMaterial({ color: 0x0066cc });
  group.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cx, 0, cz), arrowEnd]),
      arrowMat,
    ),
  );

  return group;
}
