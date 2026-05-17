import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { PLAN_Y, ux, uz } from './symbology';

type RoofElem = Extract<Element, { kind: 'roof' }>;

const SLOPE_COLOR = '#cc5500';
const ARROW_DASH = 0.1;
const ARROW_GAP = 0.06;
const ARROWHEAD_SIZE = 0.3;

/** §10.1.3 — Plan slope arrow annotation for a roof with useSlopeArrow. */
export function roofSlopeArrowPlanThree(roof: RoofElem): THREE.Group | null {
  if (!roof.useSlopeArrow || !roof.slopeArrow) return null;

  const { tailMm, headMm, slopeRatio } = roof.slopeArrow;

  const group = new THREE.Group();
  group.userData.bimPickId = roof.id;
  group.userData.roofSlopeArrow = true;

  const Y = PLAN_Y + 0.006;
  const tx = ux(tailMm.xMm);
  const tz = uz(tailMm.yMm);
  const hx = ux(headMm.xMm);
  const hz = uz(headMm.yMm);

  const dx = hx - tx;
  const dz = hz - tz;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1e-6) return null;
  const dirX = dx / len;
  const dirZ = dz / len;

  // Dashed arrow shaft
  const lineMat = new THREE.LineDashedMaterial({
    color: SLOPE_COLOR,
    dashSize: ARROW_DASH,
    gapSize: ARROW_GAP,
    depthTest: false,
  });
  const linePts = [new THREE.Vector3(tx, Y, tz), new THREE.Vector3(hx, Y, hz)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  const line = new THREE.Line(lineGeo, lineMat);
  line.computeLineDistances();
  line.userData.bimPickId = roof.id;
  line.userData.roofSlopeArrow = true;
  group.add(line);

  // Arrowhead triangle at head
  const perpX = -dirZ;
  const perpZ = dirX;
  const baseX = hx - dirX * ARROWHEAD_SIZE;
  const baseZ = hz - dirZ * ARROWHEAD_SIZE;
  const halfW = ARROWHEAD_SIZE * 0.4;
  const arrowPts = [
    new THREE.Vector3(hx, Y, hz),
    new THREE.Vector3(baseX + perpX * halfW, Y, baseZ + perpZ * halfW),
    new THREE.Vector3(baseX - perpX * halfW, Y, baseZ - perpZ * halfW),
    new THREE.Vector3(hx, Y, hz),
  ];
  const arrowGeo = new THREE.BufferGeometry().setFromPoints(arrowPts);
  const arrowMat = new THREE.LineBasicMaterial({ color: SLOPE_COLOR, depthTest: false });
  const arrowLine = new THREE.Line(arrowGeo, arrowMat);
  arrowLine.userData.bimPickId = roof.id;
  arrowLine.userData.roofSlopeArrow = true;
  group.add(arrowLine);

  // Label sprite near midpoint
  const mx = (tx + hx) / 2;
  const mz = (tz + hz) / 2;
  const labelText = `${(slopeRatio * 100).toFixed(0)}%`;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = SLOPE_COLOR;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 64, 16);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(mx, Y + 0.01, mz);
  sprite.scale.set(0.5, 0.125, 1);
  sprite.userData.bimPickId = roof.id;
  sprite.userData.roofSlopeArrow = true;
  group.add(sprite);

  return group;
}
