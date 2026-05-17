import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { PLAN_Y, ux, uz } from './symbology';

type GradedRegionElement = Extract<Element, { kind: 'graded_region' }>;

const GRADED_COLOR = '#8fbc8f';
const HATCH_SPACING_M = 0.5; // 500mm hatch line spacing

/**
 * §5.1.6 — Plan symbol for graded_region: hatched polygon with 45° diagonal lines, colour #8fbc8f.
 */
export function gradedRegionPlanThree(el: GradedRegionElement): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = el.id;
  grp.name = `plan-graded-region-${el.id}`;

  const pts = el.perimeterMm ?? el.boundaryMm ?? [];
  if (pts.length < 3) return grp;

  const Y = PLAN_Y + 0.003;

  // Solid closed boundary outline
  const outlinePts: THREE.Vector3[] = pts.map((p) => new THREE.Vector3(ux(p.xMm), Y, uz(p.yMm)));
  outlinePts.push(outlinePts[0]!.clone());
  const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
  const outlineMat = new THREE.LineBasicMaterial({ color: GRADED_COLOR, depthTest: false });
  const outlineLine = new THREE.Line(outlineGeo, outlineMat);
  outlineLine.userData.bimPickId = el.id;
  outlineLine.renderOrder = 5;
  grp.add(outlineLine);

  // Semi-transparent fill
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
      color: GRADED_COLOR,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  fillMesh.userData.bimPickId = el.id;
  fillMesh.renderOrder = 4;
  grp.add(fillMesh);

  // 45° diagonal hatch lines
  const xs = pts.map((p) => p.xMm / 1000);
  const zs = pts.map((p) => p.yMm / 1000);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const diag = Math.max(maxX - minX, maxZ - minZ);

  const hatchMat = new THREE.LineBasicMaterial({
    color: GRADED_COLOR,
    transparent: true,
    opacity: 0.5,
    depthTest: false,
  });

  for (let t = -diag; t <= diag * 2; t += HATCH_SPACING_M) {
    const x0 = minX + t;
    const z0 = minZ;
    const x1 = minX;
    const z1 = minZ + t;
    const hPts = [new THREE.Vector3(x0, Y + 0.001, z0), new THREE.Vector3(x1, Y + 0.001, z1)];
    const hGeo = new THREE.BufferGeometry().setFromPoints(hPts);
    const hLine = new THREE.Line(hGeo, hatchMat);
    hLine.renderOrder = 6;
    grp.add(hLine);
  }

  return grp;
}
