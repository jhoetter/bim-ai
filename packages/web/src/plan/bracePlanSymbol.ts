import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

export type BraceElem = Extract<Element, { kind: 'brace' }>;

/**
 * Plan symbol for a brace: a dashed diagonal line with a small X mid-span.
 */
export function bracePlanThree(brace: BraceElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = brace.id;

  const sx = brace.startXMm / 1000;
  const sz = brace.startYMm / 1000;
  const ex = brace.endXMm / 1000;
  const ez = brace.endYMm / 1000;

  const mat = new THREE.LineDashedMaterial({
    color: 0x333333,
    dashSize: 0.15,
    gapSize: 0.08,
    linewidth: 1,
  });

  const pts = [new THREE.Vector3(sx, 0, sz), new THREE.Vector3(ex, 0, ez)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  group.add(line);

  // X symbol at mid-span
  const mx = (sx + ex) / 2;
  const mz = (sz + ez) / 2;
  const xSize = 0.15;
  const crossMat = new THREE.LineBasicMaterial({ color: 0x333333 });
  const crossPts1 = [
    new THREE.Vector3(mx - xSize, 0, mz - xSize),
    new THREE.Vector3(mx + xSize, 0, mz + xSize),
  ];
  const crossPts2 = [
    new THREE.Vector3(mx + xSize, 0, mz - xSize),
    new THREE.Vector3(mx - xSize, 0, mz + xSize),
  ];
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(crossPts1), crossMat));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(crossPts2), crossMat));

  return group;
}
