/**
 * PLN-02 — pure helpers for the crop-region drag handle protocol.
 *
 * The plan canvas renders a dashed crop frame plus eight drag handles
 * (four corners, four edges) when `plan_view.cropMinMm` and
 * `cropMaxMm` are set. This module owns the geometry math:
 *
 *   - `cropHandlePositions` returns the eight handle anchor points
 *   - `applyCropHandleDrag` computes new (cropMin, cropMax) given the
 *     dragged handle id and a pointer delta in millimetres
 *   - `cropDragCommands` packages the resulting bounds into the two
 *     `updateElementProperty` commands the canvas should commit
 *
 * The frame body itself can be moved by treating `'body'` like a ninth
 * pseudo-handle that translates both corners equally.
 */
import type { XY } from '@bim-ai/core';

export type CropHandleId =
  | 'corner-nw'
  | 'corner-ne'
  | 'corner-sw'
  | 'corner-se'
  | 'edge-n'
  | 'edge-e'
  | 'edge-s'
  | 'edge-w'
  | 'body';

export type CropBounds = { cropMinMm: XY; cropMaxMm: XY };

const MIN_CROP_SPAN_MM = 100;

/** Returns the eight handle anchor points, keyed by handle id. */
export function cropHandlePositions(
  cropMinMm: XY,
  cropMaxMm: XY,
): Record<Exclude<CropHandleId, 'body'>, XY> {
  const cx = (cropMinMm.xMm + cropMaxMm.xMm) / 2;
  const cy = (cropMinMm.yMm + cropMaxMm.yMm) / 2;
  return {
    'corner-nw': { xMm: cropMinMm.xMm, yMm: cropMaxMm.yMm },
    'corner-ne': { xMm: cropMaxMm.xMm, yMm: cropMaxMm.yMm },
    'corner-sw': { xMm: cropMinMm.xMm, yMm: cropMinMm.yMm },
    'corner-se': { xMm: cropMaxMm.xMm, yMm: cropMinMm.yMm },
    'edge-n': { xMm: cx, yMm: cropMaxMm.yMm },
    'edge-e': { xMm: cropMaxMm.xMm, yMm: cy },
    'edge-s': { xMm: cx, yMm: cropMinMm.yMm },
    'edge-w': { xMm: cropMinMm.xMm, yMm: cy },
  };
}

function clampSpan(min: number, max: number): [number, number] {
  if (max - min >= MIN_CROP_SPAN_MM) return [min, max];
  const mid = (min + max) / 2;
  return [mid - MIN_CROP_SPAN_MM / 2, mid + MIN_CROP_SPAN_MM / 2];
}

/**
 * Returns updated crop bounds after a drag of `handle` by `(dxMm, dyMm)`
 * starting from `(cropMinMm, cropMaxMm)`. Crop bounds are kept axis-
 * aligned and never collapse below {@link MIN_CROP_SPAN_MM}.
 */
export function applyCropHandleDrag(
  handle: CropHandleId,
  start: CropBounds,
  dxMm: number,
  dyMm: number,
): CropBounds {
  let xMin = start.cropMinMm.xMm;
  let xMax = start.cropMaxMm.xMm;
  let yMin = start.cropMinMm.yMm;
  let yMax = start.cropMaxMm.yMm;

  // Move the dragged anchor by the pointer delta, then re-establish
  // min/max ordering — that keeps the frame axis-aligned even when the
  // user drags a handle past its opposite side.
  switch (handle) {
    case 'corner-nw':
      xMin += dxMm;
      yMax += dyMm;
      break;
    case 'corner-ne':
      xMax += dxMm;
      yMax += dyMm;
      break;
    case 'corner-sw':
      xMin += dxMm;
      yMin += dyMm;
      break;
    case 'corner-se':
      xMax += dxMm;
      yMin += dyMm;
      break;
    case 'edge-n':
      yMax += dyMm;
      break;
    case 'edge-e':
      xMax += dxMm;
      break;
    case 'edge-s':
      yMin += dyMm;
      break;
    case 'edge-w':
      xMin += dxMm;
      break;
    case 'body':
      xMin += dxMm;
      xMax += dxMm;
      yMin += dyMm;
      yMax += dyMm;
      break;
  }

  // Re-order so min < max even when the user drags through the
  // opposite edge. Then enforce the minimum span.
  const orderedX = xMin <= xMax ? [xMin, xMax] : [xMax, xMin];
  const orderedY = yMin <= yMax ? [yMin, yMax] : [yMax, yMin];
  const [nxMin, nxMax] = clampSpan(orderedX[0]!, orderedX[1]!);
  const [nyMin, nyMax] = clampSpan(orderedY[0]!, orderedY[1]!);
  return {
    cropMinMm: { xMm: nxMin, yMm: nyMin },
    cropMaxMm: { xMm: nxMax, yMm: nyMax },
  };
}

/**
 * Wraps the result of {@link applyCropHandleDrag} into the two
 * `updateElementProperty` commands a plan canvas drag should commit.
 */
export function cropDragCommands(
  planViewId: string,
  next: CropBounds,
): Array<Record<string, unknown>> {
  return [
    {
      type: 'updateElementProperty',
      elementId: planViewId,
      key: 'cropMinMm',
      value: JSON.stringify(next.cropMinMm),
    },
    {
      type: 'updateElementProperty',
      elementId: planViewId,
      key: 'cropMaxMm',
      value: JSON.stringify(next.cropMaxMm),
    },
  ];
}

/**
 * Pixel-radius hit test over the eight handles. Returns the handle id
 * whose anchor lies closest to (xMm, yMm), or `undefined` if no anchor
 * is within `toleranceMm`.
 */
export function pickCropHandle(
  cropMinMm: XY,
  cropMaxMm: XY,
  xMm: number,
  yMm: number,
  toleranceMm: number,
): CropHandleId | undefined {
  const anchors = cropHandlePositions(cropMinMm, cropMaxMm);
  let best: { id: CropHandleId; dist: number } | undefined;
  for (const [id, pos] of Object.entries(anchors) as [CropHandleId, XY][]) {
    const d = Math.hypot(pos.xMm - xMm, pos.yMm - yMm);
    if (d <= toleranceMm && (!best || d < best.dist)) {
      best = { id, dist: d };
    }
  }
  return best?.id;
}

/** Returns true when (xMm, yMm) lies inside the crop frame interior. */
export function pointInsideCrop(cropMinMm: XY, cropMaxMm: XY, xMm: number, yMm: number): boolean {
  return (
    xMm >= cropMinMm.xMm && xMm <= cropMaxMm.xMm && yMm >= cropMinMm.yMm && yMm <= cropMaxMm.yMm
  );
}
