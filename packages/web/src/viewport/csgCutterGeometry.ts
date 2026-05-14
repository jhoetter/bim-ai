/**
 * Pure cutter geometry helpers used by csgWorker.ts. Lives in its own module
 * so unit tests can import the math without pulling in three-bvh-csg (which
 * requires a worker / DOM context).
 */

import * as THREE from 'three';

export type DoorCutParams = {
  widthMm: number;
  heightMm?: number;
  alongT: number;
  wallHeightMm: number;
};

export type WindowCutParams = {
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
  alongT: number;
  wallHeightMm: number;
  /**
   * KRN-12: optional outline polygon in wall-face coords (origin at sill-centre,
   * mm). When present, the worker extrudes this polygon through the wall
   * thickness instead of the axis-aligned rectangular cutter.
   */
  outlinePolygonMm?: { xMm: number; yMm: number }[];
};

export type WallOpeningCutParams = {
  alongTStart: number;
  alongTEnd: number;
  sillHeightMm: number;
  headHeightMm: number;
  wallHeightMm: number;
};

/** Returns wall-local box params for a door cutter (R2-01). */
export function doorCutterGeometry(
  door: DoorCutParams,
  wallLen: number,
  wallHeight: number,
  wallThick: number,
): { cutW: number; cutH: number; cutD: number; localX: number; localY: number } {
  const leafH = THREE.MathUtils.clamp((door.heightMm ?? door.wallHeightMm * 0.86) / 1000, 0.6, 2.5);
  const cutW = THREE.MathUtils.clamp(door.widthMm / 1000, 0.35, 4) + 0.04;
  const cutH = Math.min(leafH + 0.01, wallHeight - 0.01);
  const cutD = wallThick + 0.1;
  const localX = (door.alongT - 0.5) * wallLen;
  const localY = cutH / 2 - wallHeight / 2;
  return { cutW, cutH, cutD, localX, localY };
}

/** Returns wall-local box params for a window cutter (R2-01). */
export function windowCutterGeometry(
  win: WindowCutParams,
  wallLen: number,
  wallHeight: number,
  wallThick: number,
): { cutW: number; cutH: number; cutD: number; localX: number; localY: number } {
  const sill = THREE.MathUtils.clamp(win.sillHeightMm / 1000, 0.06, win.wallHeightMm / 1000 - 0.08);
  const outerH = THREE.MathUtils.clamp(
    win.heightMm / 1000,
    0.05,
    win.wallHeightMm / 1000 - sill - 0.06,
  );
  const outerW = THREE.MathUtils.clamp(win.widthMm / 1000, 0.14, 4);
  const cutW = outerW + 0.04;
  const cutH = outerH + 0.02;
  const cutD = wallThick + 0.1;
  const localX = (win.alongT - 0.5) * wallLen;
  const localY = sill + cutH / 2 - wallHeight / 2;
  return { cutW, cutH, cutD, localX, localY };
}

/**
 * KRN-04 frameless wall_opening cutter. Cut spans the wall thickness fully and
 * runs from sill to head along the [alongTStart, alongTEnd] interval.
 */
export function wallOpeningCutterGeometry(
  op: WallOpeningCutParams,
  wallLen: number,
  wallHeight: number,
  wallThick: number,
): { cutW: number; cutH: number; cutD: number; localX: number; localY: number } {
  const tStart = Math.max(0, Math.min(1, Math.min(op.alongTStart, op.alongTEnd)));
  const tEnd = Math.max(0, Math.min(1, Math.max(op.alongTStart, op.alongTEnd)));
  const sill = THREE.MathUtils.clamp(op.sillHeightMm / 1000, 0, wallHeight - 0.02);
  const head = THREE.MathUtils.clamp(op.headHeightMm / 1000, sill + 0.02, wallHeight);
  const cutW = Math.max(0.02, (tEnd - tStart) * wallLen) + 0.04;
  const cutH = Math.max(0.02, head - sill) + 0.02;
  const cutD = wallThick + 0.1;
  const localX = ((tStart + tEnd) / 2 - 0.5) * wallLen;
  const localY = sill + (head - sill) / 2 - wallHeight / 2;
  return { cutW, cutH, cutD, localX, localY };
}
