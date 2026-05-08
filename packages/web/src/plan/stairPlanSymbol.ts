import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { getPlanPalette } from './symbology';

type StairElem = Extract<Element, { kind: 'stair' }>;
type Vec2Mm = { xMm: number; yMm: number };

const PLAN_Y_FLOOR = 0;

/**
 * Pure geometry: vertices of one winder-tread wedge in plan (mm).
 *
 * The wedge is bounded by the inner and outer radii of a spiral / winder run
 * over the angular sweep [theta0, theta1] (radians, ccw from +x). Returned
 * polyline is closed (first == last) and ordered ccw when theta1 > theta0.
 */
export function winderWedgePoints(
  center: Vec2Mm,
  innerR: number,
  outerR: number,
  theta0: number,
  theta1: number,
  arcSegments = 8,
): Vec2Mm[] {
  if (innerR < 0) throw new Error('winderWedgePoints: innerR must be ≥ 0');
  if (outerR <= innerR) throw new Error('winderWedgePoints: outerR must exceed innerR');

  const pts: Vec2Mm[] = [];
  for (let s = 0; s <= arcSegments; s++) {
    const t = theta0 + (theta1 - theta0) * (s / arcSegments);
    pts.push({
      xMm: center.xMm + innerR * Math.cos(t),
      yMm: center.yMm + innerR * Math.sin(t),
    });
  }
  for (let s = arcSegments; s >= 0; s--) {
    const t = theta0 + (theta1 - theta0) * (s / arcSegments);
    pts.push({
      xMm: center.xMm + outerR * Math.cos(t),
      yMm: center.yMm + outerR * Math.sin(t),
    });
  }
  pts.push({ ...pts[0] });
  return pts;
}

/**
 * Plan-symbology renderer for spiral stairs (winder treads). Returns a Group
 * of fanned wedge outlines plus an up-arrow at the bottom of the run.
 */
export function spiralStairPlanGroup(
  stair: StairElem,
  yOffset: number = PLAN_Y_FLOOR + 0.018,
): THREE.Group | null {
  if (
    stair.shape !== 'spiral' ||
    stair.centerMm == null ||
    stair.innerRadiusMm == null ||
    stair.outerRadiusMm == null ||
    stair.totalRotationDeg == null
  ) {
    return null;
  }
  const riserCount = Math.max(1, stair.runs?.[0]?.riserCount ?? 12);
  const stepRad = THREE.MathUtils.degToRad(stair.totalRotationDeg) / riserCount;
  const palette = getPlanPalette();

  const g = new THREE.Group();
  const treadMat = new THREE.LineBasicMaterial({
    color: palette.hairlineStrong,
    transparent: true,
    opacity: 0.7,
  });
  const outlineMat = new THREE.LineBasicMaterial({
    color: palette.dimAlt,
    transparent: true,
    opacity: 0.92,
  });

  for (let i = 0; i < riserCount; i++) {
    const theta0 = stepRad * i;
    const theta1 = stepRad * (i + 1);
    const pts = winderWedgePoints(
      stair.centerMm,
      stair.innerRadiusMm,
      stair.outerRadiusMm,
      theta0,
      theta1,
    );
    const v3 = pts.map((p) => new THREE.Vector3(p.xMm / 1000, yOffset, p.yMm / 1000));
    const mat = i === riserCount - 1 ? outlineMat : treadMat;
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(v3), mat));
  }

  const midR = (stair.innerRadiusMm + stair.outerRadiusMm) * 0.5;
  const tail = {
    x: stair.centerMm.xMm + midR * Math.cos(0),
    z: stair.centerMm.yMm + midR * Math.sin(0),
  };
  const tip = {
    x: stair.centerMm.xMm + midR * Math.cos(stepRad * 0.85),
    z: stair.centerMm.yMm + midR * Math.sin(stepRad * 0.85),
  };
  const arrMat = new THREE.LineBasicMaterial({
    color: palette.dimLine,
    transparent: true,
    opacity: 0.85,
  });
  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(tail.x / 1000, yOffset, tail.z / 1000),
        new THREE.Vector3(tip.x / 1000, yOffset, tip.z / 1000),
      ]),
      arrMat,
    ),
  );

  g.userData.bimPickId = stair.id;
  return g;
}

/**
 * Sketch-shape stair plan: render treads as line segments perpendicular to the
 * polyline tangent. Up-arrow placed at the start of the path.
 */
export function sketchStairPlanGroup(
  stair: StairElem,
  yOffset: number = PLAN_Y_FLOOR + 0.018,
): THREE.Group | null {
  if (stair.shape !== 'sketch' || !stair.sketchPathMm || stair.sketchPathMm.length < 2) {
    return null;
  }
  const pts = stair.sketchPathMm.map((p) => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000));
  const cumulative: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cumulative.push(cumulative[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  const totalLen = cumulative[cumulative.length - 1];
  if (totalLen < 1e-6) return null;
  const riserCount = Math.max(1, stair.runs?.[0]?.riserCount ?? pts.length - 1);
  const palette = getPlanPalette();
  const widthM = Math.max(0.3, stair.widthMm / 1000);

  const g = new THREE.Group();
  const treadMat = new THREE.LineBasicMaterial({
    color: palette.hairlineStrong,
    transparent: true,
    opacity: 0.7,
  });

  function pointAt(arc: number): { p: THREE.Vector2; tx: number; tz: number } {
    if (arc <= 0) {
      const tan = pts[1].clone().sub(pts[0]).normalize();
      return { p: pts[0].clone(), tx: tan.x, tz: tan.y };
    }
    if (arc >= totalLen) {
      const last = pts.length - 1;
      const tan = pts[last]
        .clone()
        .sub(pts[last - 1])
        .normalize();
      return { p: pts[last].clone(), tx: tan.x, tz: tan.y };
    }
    for (let i = 1; i < pts.length; i++) {
      if (cumulative[i] >= arc) {
        const segStart = cumulative[i - 1];
        const segLen = cumulative[i] - segStart;
        const t = (arc - segStart) / segLen;
        const p = pts[i - 1].clone().lerp(pts[i], t);
        const tan = pts[i]
          .clone()
          .sub(pts[i - 1])
          .normalize();
        return { p, tx: tan.x, tz: tan.y };
      }
    }
    const last = pts.length - 1;
    const tan = pts[last]
      .clone()
      .sub(pts[last - 1])
      .normalize();
    return { p: pts[last].clone(), tx: tan.x, tz: tan.y };
  }

  for (let i = 0; i <= riserCount; i++) {
    const arc = (i / riserCount) * totalLen;
    const { p, tx, tz } = pointAt(arc);
    const px = -tz * (widthM / 2);
    const pz = tx * (widthM / 2);
    g.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(p.x + px, yOffset, p.y + pz),
          new THREE.Vector3(p.x - px, yOffset, p.y - pz),
        ]),
        treadMat,
      ),
    );
  }

  g.userData.bimPickId = stair.id;
  return g;
}
