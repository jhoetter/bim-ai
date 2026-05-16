import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

export type WallElem = Extract<Element, { kind: 'wall' }>;

/**
 * Plan symbol for a curtain wall:
 * - Thin center line
 * - Short perpendicular tick marks for each grid division
 */
export function curtainWallPlanThree(wall: WallElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = wall.id;

  const sx = wall.start.xMm / 1000;
  const sz = wall.start.yMm / 1000;
  const ex = wall.end.xMm / 1000;
  const ez = wall.end.yMm / 1000;
  const len = Math.max(0.001, Math.hypot(ex - sx, ez - sz));

  const dirX = (ex - sx) / len;
  const dirZ = (ez - sz) / len;
  const perpX = -dirZ;
  const perpZ = dirX;

  const lineMat = new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 1 });

  // Main center line
  const mainPts = [new THREE.Vector3(sx, 0, sz), new THREE.Vector3(ex, 0, ez)];
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(mainPts), lineMat));

  const tickLen = 0.1; // 100mm tick
  const addTick = (tFrac: number) => {
    const dist = tFrac * len;
    const tx = sx + dist * dirX;
    const tz = sz + dist * dirZ;
    const tickMat = new THREE.LineBasicMaterial({ color: 0x444444 });
    const tickPts = [
      new THREE.Vector3(tx - (perpX * tickLen) / 2, 0, tz - (perpZ * tickLen) / 2),
      new THREE.Vector3(tx + (perpX * tickLen) / 2, 0, tz + (perpZ * tickLen) / 2),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tickPts), tickMat));
  };

  // Custom V-division positions take precedence when present.
  const customDivisions = wall.curtainWallData?.customVDivisions;
  if (customDivisions && customDivisions.length > 0) {
    for (const t of customDivisions) {
      if (t > 0 && t < 1) addTick(t);
    }
  } else {
    // Uniform V grid divisions (V grid = divisions along the wall length)
    const vCount = wall.curtainWallData?.gridV?.count ?? wall.curtainWallVCount ?? 0;
    if (vCount > 0) {
      for (let i = 1; i < vCount; i++) {
        addTick(i / vCount);
      }
    }
  }

  return group;
}
