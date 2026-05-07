import type { Element, XY } from '@bim-ai/core';

export type SnapKind =
  | 'raw'
  | 'grid'
  | 'endpoint'
  /** EDT-05 — point where two infinite line extensions cross. */
  | 'intersection'
  /** EDT-05 — foot of perpendicular from cursor onto a line. */
  | 'perpendicular'
  /** EDT-05 — closest point on a line's infinite extension. */
  | 'extension'
  /** EDT-05 — tangent from cursor to a circular element. Reserved
   *  for when arc / circle geometry lands; today's snap engine
   *  produces no `tangent` candidates because no curved elements
   *  exist. The kind is exposed so downstream callers can render
   *  / hotkey-cycle past it without a future schema bump. */
  | 'tangent';

export type SnapHit = { point: XY; kind: SnapKind };

/** Two-point line segment used by the EDT-05 snap kinds. */
export interface SegmentLine {
  start: XY;
  end: XY;
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function midpoint(a: XY, b: XY): XY {
  return { xMm: (a.xMm + b.xMm) / 2, yMm: (a.yMm + b.yMm) / 2 };
}

export function orthoFromAnchor(cursor: XY, anchor: XY | undefined): XY {
  if (!anchor) return cursor;
  const dx = Math.abs(cursor.xMm - anchor.xMm);
  const dy = Math.abs(cursor.yMm - anchor.yMm);
  return dx >= dy ? { xMm: cursor.xMm, yMm: anchor.yMm } : { xMm: anchor.xMm, yMm: cursor.yMm };
}

export function collectWallAnchors(
  els: Record<string, Element>,
  levelId: string | undefined,
): XY[] {
  const pts: XY[] = [];

  for (const e of Object.values(els)) {
    if (e.kind === 'wall') {
      if (levelId && e.levelId !== levelId) continue;

      pts.push(e.start, e.end, midpoint(e.start, e.end));
    } else if (e.kind === 'room') {
      if (levelId && e.levelId !== levelId) continue;

      pts.push(...(e.outlineMm ?? []));
    } else if (e.kind === 'grid_line') {
      // Global grids omit level — level-scoped stay tied to slab
      if (e.levelId && levelId && e.levelId !== levelId) continue;

      pts.push(e.start, e.end, midpoint(e.start, e.end));
    }
  }

  return pts;
}

/** EDT-05 — return wall + grid line segments scoped to a level so the
 *  snap engine can compute intersections / perpendiculars / extensions
 *  against them. */
export function collectSnapLines(
  els: Record<string, Element>,
  levelId: string | undefined,
): SegmentLine[] {
  const out: SegmentLine[] = [];
  for (const e of Object.values(els)) {
    if (e.kind === 'wall') {
      if (levelId && e.levelId !== levelId) continue;
      out.push({ start: e.start, end: e.end });
    } else if (e.kind === 'grid_line') {
      if (e.levelId && levelId && e.levelId !== levelId) continue;
      out.push({ start: e.start, end: e.end });
    }
  }
  return out;
}

export function snapToGrid(p: XY, stepMm: number): XY {
  const s = Math.max(10, stepMm);

  return {
    xMm: Math.round(p.xMm / s) * s,
    yMm: Math.round(p.yMm / s) * s,
  };
}

/* ─── EDT-05 helpers ──────────────────────────────────────────────────── */

/** Intersection of two infinite lines defined by segments. Returns
 *  null when the lines are parallel (or coincident). */
export function infiniteLineIntersection(a: SegmentLine, b: SegmentLine): XY | null {
  const x1 = a.start.xMm;
  const y1 = a.start.yMm;
  const x2 = a.end.xMm;
  const y2 = a.end.yMm;
  const x3 = b.start.xMm;
  const y3 = b.start.yMm;
  const x4 = b.end.xMm;
  const y4 = b.end.yMm;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denom === 0) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return {
    xMm: x1 + t * (x2 - x1),
    yMm: y1 + t * (y2 - y1),
  };
}

/** Foot of perpendicular from `p` onto the infinite line through
 *  `line.start` and `line.end`. */
export function perpendicularFoot(p: XY, line: SegmentLine): XY | null {
  const dx = line.end.xMm - line.start.xMm;
  const dy = line.end.yMm - line.start.yMm;
  const denom = dx * dx + dy * dy;
  if (denom === 0) return null;
  const t = ((p.xMm - line.start.xMm) * dx + (p.yMm - line.start.yMm) * dy) / denom;
  return {
    xMm: line.start.xMm + t * dx,
    yMm: line.start.yMm + t * dy,
  };
}

/** Project the cursor onto the line's infinite extension and only
 *  return a candidate when the projection falls *outside* the
 *  segment endpoints — that's the "extension" snap (an Endpoint snap
 *  would have already fired inside the segment). */
export function extensionPoint(p: XY, line: SegmentLine): XY | null {
  const foot = perpendicularFoot(p, line);
  if (!foot) return null;
  // Parametric position along the segment.
  const dx = line.end.xMm - line.start.xMm;
  const dy = line.end.yMm - line.start.yMm;
  const denom = dx * dx + dy * dy;
  const t = ((p.xMm - line.start.xMm) * dx + (p.yMm - line.start.yMm) * dy) / denom;
  if (t >= 0 && t <= 1) return null; // inside segment — caller has endpoint/perp coverage
  return foot;
}

/** Multiple snap targets within radius — first is default; Tab-cycle can iterate. */

export function snapPlanCandidates(opts: {
  cursor: XY;
  anchors: XY[];

  gridStepMm: number;
  chainAnchor?: XY;
  snapMm: number;

  orthoHold: boolean;

  /** EDT-05 — line segments to compute intersection / perpendicular /
   *  extension snaps against. Optional for backward compatibility. */
  lines?: SegmentLine[];
}): SnapHit[] {
  const p = opts.orthoHold ? orthoFromAnchor(opts.cursor, opts.chainAnchor) : opts.cursor;

  const gridPt = snapToGrid(p, opts.gridStepMm);

  const tol2 = opts.snapMm * opts.snapMm;

  const hits: SnapHit[] = [];

  hits.push({ point: { xMm: gridPt.xMm, yMm: gridPt.yMm }, kind: 'grid' });

  let bestAnch: XY | undefined;

  let bestD = Infinity;

  for (const a of opts.anchors) {
    const da = dist2(p.xMm, p.yMm, a.xMm, a.yMm);

    if (da <= tol2 && da < bestD) {
      bestD = da;

      bestAnch = a;
    }
  }

  if (bestAnch) hits.unshift({ point: { xMm: bestAnch.xMm, yMm: bestAnch.yMm }, kind: 'endpoint' });

  // EDT-05: intersection / perpendicular / extension candidates.
  if (opts.lines && opts.lines.length > 0) {
    // Intersection: pairwise infinite-line cross of every wall/grid pair.
    for (let i = 0; i < opts.lines.length; i++) {
      for (let j = i + 1; j < opts.lines.length; j++) {
        const cross = infiniteLineIntersection(opts.lines[i], opts.lines[j]);
        if (!cross) continue;
        if (dist2(p.xMm, p.yMm, cross.xMm, cross.yMm) <= tol2) {
          hits.push({ point: cross, kind: 'intersection' });
        }
      }
    }
    // Perpendicular: foot of perpendicular from cursor to each segment.
    for (const line of opts.lines) {
      const foot = perpendicularFoot(p, line);
      if (!foot) continue;
      if (dist2(p.xMm, p.yMm, foot.xMm, foot.yMm) <= tol2) {
        hits.push({ point: foot, kind: 'perpendicular' });
      }
    }
    // Extension: projection onto the infinite line outside the segment.
    for (const line of opts.lines) {
      const ext = extensionPoint(p, line);
      if (!ext) continue;
      if (dist2(p.xMm, p.yMm, ext.xMm, ext.yMm) <= tol2) {
        hits.push({ point: ext, kind: 'extension' });
      }
    }
  }

  const seen = new Set<string>();

  const out: SnapHit[] = [];

  for (const h of hits) {
    const k = `${Math.round(h.point.xMm)}:${Math.round(h.point.yMm)}:${h.kind}`;

    if (seen.has(k)) continue;

    seen.add(k);

    out.push(h);
  }

  out.sort((a, b) => {
    // Endpoint > intersection > perpendicular > extension > grid > raw.
    // This matches Revit's "stronger" snap winning by kind, then
    // proximity inside the same kind.
    const rank = (k: SnapKind) =>
      k === 'endpoint'
        ? 0
        : k === 'intersection'
          ? 1
          : k === 'perpendicular'
            ? 2
            : k === 'extension'
              ? 3
              : k === 'tangent'
                ? 4
                : k === 'grid'
                  ? 5
                  : 6;
    const ra = rank(a.kind);
    const rb = rank(b.kind);
    if (ra !== rb) return ra - rb;
    const da = dist2(opts.cursor.xMm, opts.cursor.yMm, a.point.xMm, a.point.yMm);
    const db = dist2(opts.cursor.xMm, opts.cursor.yMm, b.point.xMm, b.point.yMm);
    return da - db;
  });

  return out;
}

export function snapPlanPoint(opts: Parameters<typeof snapPlanCandidates>[0]): SnapHit {
  const c = snapPlanCandidates(opts);

  if (c.length) return c[0]!;

  const p = opts.orthoHold ? orthoFromAnchor(opts.cursor, opts.chainAnchor) : opts.cursor;

  return { point: { xMm: p.xMm, yMm: p.yMm }, kind: 'raw' };
}
