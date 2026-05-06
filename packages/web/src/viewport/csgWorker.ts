/**
 * Web Worker: computes CSG wall-opening cuts (door/window subtractions) off the
 * main thread, then transfers the resulting BufferGeometry attribute arrays back
 * as transferable ArrayBuffers so the main thread can reassemble a Three.js mesh
 * without ever blocking the UI.
 */

import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

// ── Shared types (imported by Viewport.tsx via `import type`) ──────────────

export type DoorCutParams = {
  widthMm: number;
  alongT: number;
  wallHeightMm: number;
};

export type WindowCutParams = {
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
  alongT: number;
  wallHeightMm: number;
};

export type CsgRequest = {
  jobId: string;
  nonce: number;
  /** Wall box dimensions in metres (wall-local space, identity transform). */
  len: number;
  height: number;
  thick: number;
  /** World pose echoed back so the main thread can position the mesh. */
  wcx: number;
  wcy: number;
  wcz: number;
  yaw: number;
  doors: DoorCutParams[];
  windows: WindowCutParams[];
};

export type CsgResponse =
  | {
      ok: true;
      jobId: string;
      nonce: number;
      wcx: number;
      wcy: number;
      wcz: number;
      yaw: number;
      position: Float32Array;
      normal: Float32Array | null;
      uv: Float32Array | null;
      index: Uint32Array | Uint16Array | null;
    }
  | { ok: false; jobId: string; nonce: number };

// ── Cutter geometry helpers (spec R2-01) ──────────────────────────────────

/** Returns wall-local box params for a door cutter (R2-01). */
export function doorCutterGeometry(
  door: DoorCutParams,
  wallLen: number,
  wallHeight: number,
  wallThick: number,
): { cutW: number; cutH: number; cutD: number; localX: number; localY: number } {
  const leafH = THREE.MathUtils.clamp((door.wallHeightMm / 1000) * 0.86, 0.6, 2.5);
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

// ── Worker body ────────────────────────────────────────────────────────────

// Cast self to a typed worker context without needing the WebWorker lib.
const ctx = self as unknown as {
  onmessage: ((evt: MessageEvent<CsgRequest>) => void) | null;
  postMessage(message: CsgResponse, options?: { transfer?: Transferable[] }): void;
};

const evaluator = new Evaluator();

ctx.onmessage = (evt: MessageEvent<CsgRequest>) => {
  const { jobId, nonce, len, height, thick, wcx, wcy, wcz, yaw, doors, windows } = evt.data;

  try {
    let wallBrush = new Brush(new THREE.BoxGeometry(len, height, thick));
    wallBrush.updateMatrixWorld();

    for (const door of doors) {
      const { cutW, cutH, cutD, localX, localY } = doorCutterGeometry(door, len, height, thick);
      const cutter = new Brush(new THREE.BoxGeometry(cutW, cutH, cutD));
      cutter.position.set(localX, localY, 0);
      cutter.updateMatrixWorld();
      wallBrush = evaluator.evaluate(wallBrush, cutter, SUBTRACTION);
      wallBrush.updateMatrixWorld();
    }

    for (const win of windows) {
      const { cutW, cutH, cutD, localX, localY } = windowCutterGeometry(win, len, height, thick);
      const cutter = new Brush(new THREE.BoxGeometry(cutW, cutH, cutD));
      cutter.position.set(localX, localY, 0);
      cutter.updateMatrixWorld();
      wallBrush = evaluator.evaluate(wallBrush, cutter, SUBTRACTION);
      wallBrush.updateMatrixWorld();
    }

    const geom = wallBrush.geometry;

    // Slice each attribute array so we own fresh buffers to transfer.
    const position = (geom.getAttribute('position').array as Float32Array).slice();
    const normalAttr = geom.getAttribute('normal');
    const normal = normalAttr ? (normalAttr.array as Float32Array).slice() : null;
    const uvAttr = geom.getAttribute('uv');
    const uv = uvAttr ? (uvAttr.array as Float32Array).slice() : null;
    const index = geom.index
      ? geom.index.array instanceof Uint16Array
        ? (geom.index.array as Uint16Array).slice()
        : (geom.index.array as Uint32Array).slice()
      : null;

    const transferables: Transferable[] = [position.buffer];
    if (normal) transferables.push(normal.buffer);
    if (uv) transferables.push(uv.buffer);
    if (index) transferables.push(index.buffer);

    const response: CsgResponse = {
      ok: true,
      jobId,
      nonce,
      wcx,
      wcy,
      wcz,
      yaw,
      position,
      normal,
      uv,
      index,
    };
    ctx.postMessage(response, { transfer: transferables });
  } catch {
    const response: CsgResponse = { ok: false, jobId, nonce };
    ctx.postMessage(response);
  }
};
