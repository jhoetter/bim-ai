import type { Element, XY } from '@bim-ai/core';

/**
 * VIE-01 — pure detail-level binding for plan-view rendering.
 *
 * Maps `planDetailLevel` to the actual number of plan-projection lines per
 * element so consumers (PlanCanvas, planElementMeshBuilders) can show the
 * three Revit detail-level presets visually.
 *
 *   coarse → minimum: walls = 1 line, doors = single line + swing arc, …
 *   medium → +inner core boundaries / glass lines / simplified treads
 *   fine   → full layer / mullion / tread breakdown
 */

export type PlanDetailLevel = 'coarse' | 'medium' | 'fine';

export type WallElement = Extract<Element, { kind: 'wall' }>;
export type DoorElement = Extract<Element, { kind: 'door' }>;
export type WindowElement = Extract<Element, { kind: 'window' }>;
export type StairElement = Extract<Element, { kind: 'stair' }>;

const WALL_DEFAULT_CORE_FRACTION = 0.6;

/**
 * Wall: one (coarse), two-line core (medium), or layer stack (fine). Every
 * line is a 4-point closed polyline (start-perp / end-perp / corners) so the
 * caller can stroke each as a single path.
 */
export function wallPlanLinesForDetailLevel(wall: WallElement, detail: PlanDetailLevel): XY[][] {
  const dx = wall.end.xMm - wall.start.xMm;
  const dy = wall.end.yMm - wall.start.yMm;
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  const nx = -ty;
  const ny = tx;
  const t = wall.thicknessMm;

  if (detail === 'coarse') {
    // Single centre line.
    return [[wall.start, wall.end]];
  }

  // Inner-core face offsets (medium + fine both render these).
  const half = t / 2;
  const coreHalf = (t * WALL_DEFAULT_CORE_FRACTION) / 2;

  if (detail === 'medium') {
    // Two parallel lines along the core boundaries.
    return [
      [
        { xMm: wall.start.xMm + nx * coreHalf, yMm: wall.start.yMm + ny * coreHalf },
        { xMm: wall.end.xMm + nx * coreHalf, yMm: wall.end.yMm + ny * coreHalf },
      ],
      [
        { xMm: wall.start.xMm - nx * coreHalf, yMm: wall.start.yMm - ny * coreHalf },
        { xMm: wall.end.xMm - nx * coreHalf, yMm: wall.end.yMm - ny * coreHalf },
      ],
    ];
  }

  // Fine: outer faces + core boundaries.
  return [
    [
      { xMm: wall.start.xMm + nx * half, yMm: wall.start.yMm + ny * half },
      { xMm: wall.end.xMm + nx * half, yMm: wall.end.yMm + ny * half },
    ],
    [
      { xMm: wall.start.xMm + nx * coreHalf, yMm: wall.start.yMm + ny * coreHalf },
      { xMm: wall.end.xMm + nx * coreHalf, yMm: wall.end.yMm + ny * coreHalf },
    ],
    [
      { xMm: wall.start.xMm - nx * coreHalf, yMm: wall.start.yMm - ny * coreHalf },
      { xMm: wall.end.xMm - nx * coreHalf, yMm: wall.end.yMm - ny * coreHalf },
    ],
    [
      { xMm: wall.start.xMm - nx * half, yMm: wall.start.yMm - ny * half },
      { xMm: wall.end.xMm - nx * half, yMm: wall.end.yMm - ny * half },
    ],
  ];
}

/**
 * Door / window plan symbols differ by feature count, not exact geometry.
 * Returning the *count* lets renderers swap symbol templates without forcing
 * this module to depend on the symbology pipeline.
 */
export function doorPlanFeatureCount(detail: PlanDetailLevel): {
  hasOpening: boolean;
  hasSwingArc: boolean;
  hasFrame: boolean;
} {
  switch (detail) {
    case 'coarse':
      return { hasOpening: true, hasSwingArc: true, hasFrame: false };
    case 'medium':
      return { hasOpening: true, hasSwingArc: true, hasFrame: true };
    case 'fine':
      return { hasOpening: true, hasSwingArc: true, hasFrame: true };
  }
}

export function windowPlanFeatureCount(detail: PlanDetailLevel): {
  hasOpening: boolean;
  hasGlassLine: boolean;
  hasMullions: boolean;
} {
  switch (detail) {
    case 'coarse':
      return { hasOpening: true, hasGlassLine: false, hasMullions: false };
    case 'medium':
      return { hasOpening: true, hasGlassLine: true, hasMullions: false };
    case 'fine':
      return { hasOpening: true, hasGlassLine: true, hasMullions: true };
  }
}

export function stairPlanFeatureCount(detail: PlanDetailLevel): {
  hasPathArrow: boolean;
  hasTreadOutline: boolean;
  hasFullTreadDetail: boolean;
} {
  switch (detail) {
    case 'coarse':
      return { hasPathArrow: true, hasTreadOutline: false, hasFullTreadDetail: false };
    case 'medium':
      return { hasPathArrow: true, hasTreadOutline: true, hasFullTreadDetail: false };
    case 'fine':
      return { hasPathArrow: true, hasTreadOutline: true, hasFullTreadDetail: true };
  }
}

/** True if the active detail level should render curtain-wall mullions. */
export function showCurtainMullionsForDetail(detail: PlanDetailLevel): boolean {
  return detail === 'fine';
}

/** True if curtain-wall grid lines should render. */
export function showCurtainGridForDetail(detail: PlanDetailLevel): boolean {
  return detail !== 'coarse';
}
