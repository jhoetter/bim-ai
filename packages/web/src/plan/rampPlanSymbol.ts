import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { getPlanPalette } from './symbology';

type RampElem = Extract<Element, { kind: 'ramp' }>;

/** Max ADA-compliant slope percent. Steeper ramps emit a console warning. */
const ADA_MAX_SLOPE_PERCENT = 8.33;

/**
 * Build a plan-view symbol for a ramp element. Returns a THREE.Group with:
 *   - Rectangle outline showing the plan footprint
 *   - Diagonal arrow lines pointing uphill (runAngleDeg direction)
 *   - group.userData.bimPickId set to ramp.id
 */
export function rampPlanSymbol(ramp: RampElem): THREE.Group {
  if (ramp.slopePercent > ADA_MAX_SLOPE_PERCENT) {
    console.warn(
      `[ramp] "${ramp.name}" (id=${ramp.id}) slopePercent=${ramp.slopePercent}% exceeds ADA max ${ADA_MAX_SLOPE_PERCENT}%`,
    );
  }

  const palette = getPlanPalette();
  const group = new THREE.Group();

  const Y = 0.018;
  const widthM = ramp.widthMm / 1000;
  const runM = ramp.runMm / 1000;
  const ox = ramp.insertionXMm / 1000;
  const oz = ramp.insertionYMm / 1000;

  const anglRad = THREE.MathUtils.degToRad(ramp.runAngleDeg);
  const cosA = Math.cos(anglRad);
  const sinA = Math.sin(anglRad);
  const hw = widthM / 2;
  const perpX = -sinA;
  const perpZ = cosA;

  const corners: [number, number][] = [
    [ox - hw * perpX, oz - hw * perpZ],
    [ox + hw * perpX, oz + hw * perpZ],
    [ox + hw * perpX + runM * cosA, oz + hw * perpZ + runM * sinA],
    [ox - hw * perpX + runM * cosA, oz - hw * perpZ + runM * sinA],
  ];

  const outlineMat = new THREE.LineBasicMaterial({
    color: palette.hairlineStrong,
    transparent: true,
    opacity: 0.9,
  });
  const outlinePts = [...corners, corners[0]].map(([x, z]) => new THREE.Vector3(x, Y, z));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePts), outlineMat));

  const arrowMat = new THREE.LineBasicMaterial({
    color: palette.dimLine,
    transparent: true,
    opacity: 0.8,
  });

  for (const frac of [0.25, 0.5, 0.75]) {
    const bx = ox + (frac - 0.5) * widthM * perpX;
    const bz = oz + (frac - 0.5) * widthM * perpZ;
    const tx = bx + runM * cosA;
    const tz = bz + runM * sinA;
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(bx, Y, bz),
          new THREE.Vector3(tx, Y, tz),
        ]),
        arrowMat,
      ),
    );
    const arrowLen = Math.min(0.15, runM * 0.15);
    const wingAngle = Math.PI / 6;
    for (const side of [-1, 1]) {
      const wa = anglRad + Math.PI + side * wingAngle;
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(tx, Y, tz),
            new THREE.Vector3(tx + arrowLen * Math.cos(wa), Y, tz + arrowLen * Math.sin(wa)),
          ]),
          arrowMat,
        ),
      );
    }
  }

  group.userData.bimPickId = ramp.id;
  return group;
}
