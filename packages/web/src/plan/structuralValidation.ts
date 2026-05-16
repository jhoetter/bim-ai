import type { Element } from '@bim-ai/core';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  elementIds: string[];
  message: string;
}

type XY = { xMm: number; yMm: number };
type PolyBoundary = XY[];

// ---------------------------------------------------------------------------
// Polygon helpers
// ---------------------------------------------------------------------------

function segmentsIntersect(a1: XY, a2: XY, b1: XY, b2: XY): boolean {
  const dax = a2.xMm - a1.xMm;
  const day = a2.yMm - a1.yMm;
  const dbx = b2.xMm - b1.xMm;
  const dby = b2.yMm - b1.yMm;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-9) return false;
  const dx = b1.xMm - a1.xMm;
  const dy = b1.yMm - a1.yMm;
  const t = (dx * dby - dy * dbx) / denom;
  const u = (dx * day - dy * dax) / denom;
  const eps = 1e-6;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

/** A boundary polygon is "open" only when it has fewer than 3 vertices.
 * Standard floor/roof/ceiling boundaries are implicitly closed (last vertex
 * connects back to first), so any 3+ point array is a valid closed loop. */
function isOpenLoop(pts: PolyBoundary): boolean {
  return pts.length < 3;
}

function isSelfIntersecting(pts: PolyBoundary): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i]!;
    const a2 = pts[(i + 1) % n]!;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const b1 = pts[j]!;
      const b2 = pts[(j + 1) % n]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function segmentLength(a: XY, b: XY): number {
  return Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
}

function hasTooSmallEdge(pts: PolyBoundary, minMm = 10): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    if (segmentLength(pts[i]!, pts[(i + 1) % n]!) < minMm) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Wall-specific checks
// ---------------------------------------------------------------------------

type WallElem = Extract<Element, { kind: 'wall' }>;
type HostedKind = 'door' | 'window' | 'wall-opening';

function wallLength(w: WallElem): number {
  return Math.hypot(w.end.xMm - w.start.xMm, w.end.yMm - w.start.yMm);
}

function wallsAreDuplicate(a: WallElem, b: WallElem, toleranceMm = 5): boolean {
  const sameForward =
    Math.hypot(a.start.xMm - b.start.xMm, a.start.yMm - b.start.yMm) < toleranceMm &&
    Math.hypot(a.end.xMm - b.end.xMm, a.end.yMm - b.end.yMm) < toleranceMm;
  const sameReversed =
    Math.hypot(a.start.xMm - b.end.xMm, a.start.yMm - b.end.yMm) < toleranceMm &&
    Math.hypot(a.end.xMm - b.start.xMm, a.end.yMm - b.start.yMm) < toleranceMm;
  return sameForward || sameReversed;
}

function hostedElementIsInsideWallSpan(
  hosted: Element & { hostId?: string; offsetAlongHostMm?: number },
  walls: WallElem[],
): boolean {
  const host = walls.find((w) => w.id === hosted.hostId);
  if (!host) return false;
  const len = wallLength(host);
  const offset = hosted.offsetAlongHostMm ?? 0;
  return offset >= 0 && offset <= len;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Check floor/roof/ceiling boundary polygons for structural integrity issues. */
export function validateBoundary(elementId: string, boundary: PolyBoundary): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (isOpenLoop(boundary)) {
    issues.push({
      code: 'open_loop',
      severity: 'error',
      elementIds: [elementId],
      message: 'Boundary has fewer than 3 vertices — cannot form a closed polygon.',
    });
  }
  if (isSelfIntersecting(boundary)) {
    issues.push({
      code: 'self_intersecting',
      severity: 'error',
      elementIds: [elementId],
      message: 'Boundary edges cross each other — sketch is self-intersecting.',
    });
  }
  if (hasTooSmallEdge(boundary)) {
    issues.push({
      code: 'too_small_edge',
      severity: 'warning',
      elementIds: [elementId],
      message: 'Boundary contains an edge shorter than 10 mm — may cause geometry artifacts.',
    });
  }
  return issues;
}

/** Find duplicate (overlapping) walls in a set of wall elements. */
export function findDuplicateWalls(walls: WallElem[], toleranceMm = 5): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      if (wallsAreDuplicate(walls[i]!, walls[j]!, toleranceMm)) {
        issues.push({
          code: 'duplicate_wall',
          severity: 'error',
          elementIds: [walls[i]!.id, walls[j]!.id],
          message: `Walls "${walls[i]!.id}" and "${walls[j]!.id}" are duplicates — they share the same endpoints.`,
        });
      }
    }
  }
  return issues;
}

/** Find hosted elements (door/window/opening) whose host wall does not exist in the element map. */
export function findOrphanedHostedElements(
  elementsById: Record<string, Element>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const HOSTED_KINDS: HostedKind[] = ['door', 'window', 'wall-opening'];
  for (const el of Object.values(elementsById)) {
    if (!HOSTED_KINDS.includes(el.kind as HostedKind)) continue;
    const hosted = el as unknown as { hostId?: string };
    if (!hosted.hostId) {
      issues.push({
        code: 'orphaned_no_host_ref',
        severity: 'error',
        elementIds: [el.id],
        message: `${el.kind} "${el.id}" has no hostId — it is not attached to any wall.`,
      });
    } else if (!elementsById[hosted.hostId]) {
      issues.push({
        code: 'orphaned_host_missing',
        severity: 'error',
        elementIds: [el.id],
        message: `${el.kind} "${el.id}" references wall "${hosted.hostId}" which does not exist.`,
      });
    }
  }
  return issues;
}

/** Check that all hosted elements fall inside their wall's span. */
export function validateHostedElementSpans(
  elementsById: Record<string, Element>,
): ValidationIssue[] {
  const walls = Object.values(elementsById).filter((e): e is WallElem => e.kind === 'wall');
  const HOSTED_KINDS: HostedKind[] = ['door', 'window', 'wall-opening'];
  const issues: ValidationIssue[] = [];
  for (const el of Object.values(elementsById)) {
    if (!HOSTED_KINDS.includes(el.kind as HostedKind)) continue;
    const hosted = el as unknown as { hostId?: string; offsetAlongHostMm?: number };
    if (!hosted.hostId) continue;
    if (!hostedElementIsInsideWallSpan(hosted as Element & typeof hosted, walls)) {
      issues.push({
        code: 'hosted_outside_wall_span',
        severity: 'error',
        elementIds: [el.id],
        message: `${el.kind} "${el.id}" placement is outside its host wall span.`,
      });
    }
  }
  return issues;
}

/** Run all structural validation checks and return a flat list of issues. */
export function runStructuralValidation(elementsById: Record<string, Element>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const walls = Object.values(elementsById).filter((e): e is WallElem => e.kind === 'wall');

  issues.push(...findDuplicateWalls(walls));
  issues.push(...findOrphanedHostedElements(elementsById));
  issues.push(...validateHostedElementSpans(elementsById));

  for (const el of Object.values(elementsById)) {
    const withBoundary = el as unknown as { boundaryMm?: PolyBoundary };
    if (withBoundary.boundaryMm && withBoundary.boundaryMm.length > 0) {
      issues.push(...validateBoundary(el.id, withBoundary.boundaryMm));
    }
  }

  return issues;
}
