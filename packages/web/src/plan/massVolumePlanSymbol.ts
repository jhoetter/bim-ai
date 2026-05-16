import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

export type MassBoxElem = Extract<Element, { kind: 'mass_box' }>;
export type MassExtrusionElem = Extract<Element, { kind: 'mass_extrusion' }>;
export type MassRevolutionElem = Extract<Element, { kind: 'mass_revolution' }>;

function addDiagonalCross(
  group: THREE.Group,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): void {
  const mat = new THREE.LineBasicMaterial({ color: 0x888888 });
  group.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, 0, z1),
        new THREE.Vector3(x2, 0, z2),
      ]),
      mat,
    ),
  );
  group.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x2, 0, z1),
        new THREE.Vector3(x1, 0, z2),
      ]),
      mat,
    ),
  );
}

export function massBoxPlanThree(elem: MassBoxElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = elem.id;

  const x1 = elem.insertionXMm / 1000;
  const z1 = elem.insertionYMm / 1000;
  const x2 = x1 + elem.widthMm / 1000;
  const z2 = z1 + elem.depthMm / 1000;

  const mat = new THREE.LineBasicMaterial({ color: 0x555555 });
  const rectPts = [
    new THREE.Vector3(x1, 0, z1),
    new THREE.Vector3(x2, 0, z1),
    new THREE.Vector3(x2, 0, z2),
    new THREE.Vector3(x1, 0, z2),
    new THREE.Vector3(x1, 0, z1),
  ];
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rectPts), mat));
  addDiagonalCross(group, x1, z1, x2, z2);
  return group;
}

export function massExtrusionPlanThree(elem: MassExtrusionElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = elem.id;

  const pts = elem.profilePoints;
  if (pts.length < 3) return group;

  const mat = new THREE.LineBasicMaterial({ color: 0x555555 });
  const bPts = [
    ...pts.map((p) => new THREE.Vector3(p.xMm / 1000, 0, p.yMm / 1000)),
    new THREE.Vector3(pts[0].xMm / 1000, 0, pts[0].yMm / 1000),
  ];
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bPts), mat));

  // Diagonal cross on bounding box
  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.xMm / 1000);
    minZ = Math.min(minZ, p.yMm / 1000);
    maxX = Math.max(maxX, p.xMm / 1000);
    maxZ = Math.max(maxZ, p.yMm / 1000);
  }
  addDiagonalCross(group, minX, minZ, maxX, maxZ);
  return group;
}

export function massRevolutionPlanThree(elem: MassRevolutionElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = elem.id;

  const mat = new THREE.LineBasicMaterial({ color: 0x555555 });
  const cx = elem.axisPt1.xMm / 1000;
  const cz = elem.axisPt1.yMm / 1000;
  // Show profile points in plan
  if (elem.profilePoints.length >= 2) {
    const pPts = elem.profilePoints.map(
      (p) => new THREE.Vector3(cx + p.xMm / 1000, 0, cz + p.yMm / 1000),
    );
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pPts), mat));
  }
  return group;
}
