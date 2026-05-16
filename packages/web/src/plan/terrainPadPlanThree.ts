import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { PLAN_Y, ux, uz } from './symbology';

type ToposolidPadElement = Extract<Element, { kind: 'toposolid_pad' }>;

const PAD_COLOR = '#c8a882';
const PAD_DASH = 0.08;
const PAD_GAP = 0.05;

/** §5.1.4 — Plan symbol for toposolid_pad: dashed boundary + semi-transparent fill + elevation label. */
export function terrainPadPlanThree(pad: ToposolidPadElement): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = pad.id;
  grp.name = `plan-terrain-pad-${pad.id}`;

  const pts = pad.boundaryMm;
  if (pts.length < 3) return grp;

  const Y = PLAN_Y + 0.003;

  // Dashed closed boundary polyline
  const outlinePts: THREE.Vector3[] = pts.map((p) => new THREE.Vector3(ux(p.xMm), Y, uz(p.yMm)));
  outlinePts.push(outlinePts[0]!.clone());
  const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
  const outlineMat = new THREE.LineDashedMaterial({
    color: PAD_COLOR,
    dashSize: PAD_DASH,
    gapSize: PAD_GAP,
    depthTest: false,
  });
  const outlineLine = new THREE.Line(outlineGeo, outlineMat);
  outlineLine.computeLineDistances();
  outlineLine.userData.bimPickId = pad.id;
  outlineLine.renderOrder = 5;
  grp.add(outlineLine);

  // Semi-transparent fill using ShapeGeometry
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
      color: PAD_COLOR,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  fillMesh.userData.bimPickId = pad.id;
  fillMesh.renderOrder = 4;
  grp.add(fillMesh);

  // Elevation label sprite
  const centroidX = pts.reduce((s, p) => s + p.xMm, 0) / pts.length;
  const centroidY = pts.reduce((s, p) => s + p.yMm, 0) / pts.length;
  const label = `${pad.elevationMm} mm`;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = PAD_COLOR;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 16);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(centroidX / 1000, Y + 0.01, centroidY / 1000);
  sprite.scale.set(1.2, 0.3, 1);
  sprite.userData.bimPickId = pad.id;
  grp.add(sprite);

  return grp;
}
