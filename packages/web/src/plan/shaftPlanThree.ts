import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { PLAN_Y, ux, uz } from './symbology';

type ShaftElement = Extract<Element, { kind: 'shaft' }>;

const SHAFT_COLOR = '#888888';
const SHAFT_DASH = 0.06;
const SHAFT_GAP = 0.04;

/** §2.5.1 — Plan symbol for shaft: dashed boundary + semi-transparent grey fill + X cross lines. */
export function shaftPlanThree(shaft: ShaftElement): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = shaft.id;
  grp.name = `plan-shaft-${shaft.id}`;

  const pts = shaft.boundaryMm;
  if (pts.length < 3) return grp;

  const Y = PLAN_Y + 0.002;

  // Dashed closed boundary polyline
  const outlinePts: THREE.Vector3[] = pts.map((p) => new THREE.Vector3(ux(p.xMm), Y, uz(p.yMm)));
  outlinePts.push(outlinePts[0]!.clone());
  const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
  const outlineMat = new THREE.LineDashedMaterial({
    color: SHAFT_COLOR,
    dashSize: SHAFT_DASH,
    gapSize: SHAFT_GAP,
    depthTest: false,
  });
  const outlineLine = new THREE.Line(outlineGeo, outlineMat);
  outlineLine.computeLineDistances();
  outlineLine.userData.bimPickId = shaft.id;
  outlineLine.renderOrder = 5;
  grp.add(outlineLine);

  // Semi-transparent grey fill
  const shape = new THREE.Shape();
  shape.moveTo(pts[0]!.xMm / 1000, pts[0]!.yMm / 1000);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i]!.xMm / 1000, pts[i]!.yMm / 1000);
  }
  shape.closePath();
  const fillGeom = new THREE.ShapeGeometry(shape);
  fillGeom.rotateX(-Math.PI / 2);
  fillGeom.translate(0, Y - 0.001, 0);
  const fillMesh = new THREE.Mesh(
    fillGeom,
    new THREE.MeshBasicMaterial({
      color: SHAFT_COLOR,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  fillMesh.userData.bimPickId = shaft.id;
  fillMesh.renderOrder = 4;
  grp.add(fillMesh);

  // X cross lines (diagonals of the bounding box)
  const xs = pts.map((p) => p.xMm);
  const ys = pts.map((p) => p.yMm);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const crossMat = new THREE.LineBasicMaterial({ color: SHAFT_COLOR, depthTest: false });

  const cross1Geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(ux(minX), Y + 0.001, uz(minY)),
    new THREE.Vector3(ux(maxX), Y + 0.001, uz(maxY)),
  ]);
  const cross1 = new THREE.Line(cross1Geo, crossMat);
  cross1.userData.bimPickId = shaft.id;
  cross1.renderOrder = 6;
  grp.add(cross1);

  const cross2Geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(ux(maxX), Y + 0.001, uz(minY)),
    new THREE.Vector3(ux(minX), Y + 0.001, uz(maxY)),
  ]);
  const cross2 = new THREE.Line(cross2Geo, crossMat);
  cross2.userData.bimPickId = shaft.id;
  cross2.renderOrder = 6;
  grp.add(cross2);

  return grp;
}
