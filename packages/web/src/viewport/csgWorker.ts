/**
 * Web Worker: computes CSG wall-opening cuts (door/window subtractions) off the
 * main thread, then transfers the resulting BufferGeometry attribute arrays back
 * as transferable ArrayBuffers so the main thread can reassemble a Three.js mesh
 * without ever blocking the UI.
 */

import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import {
  doorCutterGeometry,
  wallOpeningCutterGeometry,
  windowCutterGeometry,
  type DoorCutParams,
  type WallOpeningCutParams,
  type WindowCutParams,
} from './csgCutterGeometry';
import { wallBaseGeometryForCsg, type CsgBaseFootprintPoint } from './csgWallBaseGeometry';

export {
  doorCutterGeometry,
  wallOpeningCutterGeometry,
  windowCutterGeometry,
} from './csgCutterGeometry';
export type { DoorCutParams, WallOpeningCutParams, WindowCutParams } from './csgCutterGeometry';
export type { CsgBaseFootprintPoint } from './csgWallBaseGeometry';

// ── Shared types (imported by Viewport.tsx via `import type`) ──────────────

export type CsgRequest = {
  jobId: string;
  nonce: number;
  /** Wall box dimensions in metres (wall-local space, identity transform). */
  len: number;
  height: number;
  thick: number;
  /** Optional cleaned wall footprint(s) in wall-local metres. */
  baseFootprints?: CsgBaseFootprintPoint[][];
  /** World pose echoed back so the main thread can position the mesh. */
  wcx: number;
  wcy: number;
  wcz: number;
  yaw: number;
  doors: DoorCutParams[];
  windows: WindowCutParams[];
  wallOpenings?: WallOpeningCutParams[];
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

// ── Worker body ────────────────────────────────────────────────────────────

// Cast self to a typed worker context without needing the WebWorker lib.
const ctx = self as unknown as {
  onmessage: ((evt: MessageEvent<CsgRequest>) => void) | null;
  postMessage(message: CsgResponse, options?: { transfer?: Transferable[] }): void;
};

const evaluator = new Evaluator();

ctx.onmessage = (evt: MessageEvent<CsgRequest>) => {
  const {
    jobId,
    nonce,
    len,
    height,
    thick,
    baseFootprints,
    wcx,
    wcy,
    wcz,
    yaw,
    doors,
    windows,
    wallOpenings,
  } = evt.data;

  try {
    let wallBrush = new Brush(wallBaseGeometryForCsg(len, height, thick, baseFootprints));
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
      let cutter: InstanceType<typeof Brush>;
      if (win.outlinePolygonMm && win.outlinePolygonMm.length >= 3) {
        // KRN-12: extrude the outline polygon through the wall thickness.
        const shape = new THREE.Shape();
        const sillM = THREE.MathUtils.clamp(win.sillHeightMm / 1000, 0, height - 0.02);
        const localOriginY = sillM - height / 2;
        const localOriginX = (win.alongT - 0.5) * len;
        const poly = win.outlinePolygonMm;
        shape.moveTo(poly[0].xMm / 1000, poly[0].yMm / 1000);
        for (let i = 1; i < poly.length; i++) {
          shape.lineTo(poly[i].xMm / 1000, poly[i].yMm / 1000);
        }
        const cutD = thick + 0.1;
        const geom = new THREE.ExtrudeGeometry(shape, {
          depth: cutD,
          bevelEnabled: false,
        });
        // ExtrudeGeometry extrudes along +Z; centre on wall thickness axis.
        geom.translate(localOriginX, localOriginY, -cutD / 2);
        cutter = new Brush(geom);
      } else {
        const { cutW, cutH, cutD, localX, localY } = windowCutterGeometry(win, len, height, thick);
        cutter = new Brush(new THREE.BoxGeometry(cutW, cutH, cutD));
        cutter.position.set(localX, localY, 0);
      }
      cutter.updateMatrixWorld();
      wallBrush = evaluator.evaluate(wallBrush, cutter, SUBTRACTION);
      wallBrush.updateMatrixWorld();
    }

    for (const op of wallOpenings ?? []) {
      const { cutW, cutH, cutD, localX, localY } = wallOpeningCutterGeometry(
        op,
        len,
        height,
        thick,
      );
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
