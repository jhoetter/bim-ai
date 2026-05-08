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
  /** EDT-05 closeout — tangent point on a curved element (sweep path /
   *  dormer / curtain panel arc) closest to the cursor. Fires only
   *  when an active draft anchor is being placed. */
  | 'tangent'
  /** EDT-05 closeout — projection onto a direction parallel to a
   *  hovered wall, anchored at the active draft start. */
  | 'parallel'
  /** EDT-05 closeout — perpendicular foot of the cursor onto the active
   *  workplane (3D reference plane flagged `isWorkPlane`). */
  | 'workplane';

export type SnapHit = { point: XY; kind: SnapKind };

/** Two-point line segment used by the EDT-05 snap kinds. */
export interface SegmentLine {
  start: XY;
  end: XY;
}

/** EDT-05 closeout — polyline approximation of a curved element used by
 *  the tangent producer. Sweeps' `pathMm`, dormer curved segments, and
 *  curtain-panel arcs are all flattened to a polyline before being fed
 *  in so the producer stays geometry-shape agnostic. */
export interface CurveSegment {
  pathMm: XY[];
}

/** EDT-05 closeout — active workplane in plan-trace form (the vertical
 *  plane projects to a line in the plan view). */
export interface ActiveWorkplane {
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

/** EDT-05 closeout — closest point on a polyline curve to the cursor.
 *  Returns the segment-local foot when the projection lies inside a
 *  segment, otherwise the nearest endpoint. */
export function closestPointOnPolyline(p: XY, path: XY[]): XY | null {
  if (path.length < 2) return null;
  let best: XY | null = null;
  let bestD = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const dx = b.xMm - a.xMm;
    const dy = b.yMm - a.yMm;
    const denom = dx * dx + dy * dy;
    let candidate: XY;
    if (denom === 0) {
      candidate = a;
    } else {
      const t = ((p.xMm - a.xMm) * dx + (p.yMm - a.yMm) * dy) / denom;
      const tc = Math.max(0, Math.min(1, t));
      candidate = { xMm: a.xMm + tc * dx, yMm: a.yMm + tc * dy };
    }
    const d = dist2(p.xMm, p.yMm, candidate.xMm, candidate.yMm);
    if (d < bestD) {
      bestD = d;
      best = candidate;
    }
  }
  return best;
}

/** EDT-05 closeout — Tangent producer.
 *
 *  Fires only when a draft anchor is active and the cursor is near a
 *  curved element. Returns the closest tangent-fit point on each curve
 *  inside `snapMm`. (For polyline curves the closest point is the
 *  tangent point — the local segment direction is the curve tangent.) */
export function produceTangentSnaps(opts: {
  cursor: XY;
  curves: CurveSegment[];
  draftAnchor?: XY;
  snapMm: number;
}): SnapHit[] {
  if (!opts.draftAnchor) return [];
  const tol2 = opts.snapMm * opts.snapMm;
  const out: SnapHit[] = [];
  for (const curve of opts.curves) {
    const pt = closestPointOnPolyline(opts.cursor, curve.pathMm);
    if (!pt) continue;
    if (dist2(opts.cursor.xMm, opts.cursor.yMm, pt.xMm, pt.yMm) <= tol2) {
      out.push({ point: pt, kind: 'tangent' });
    }
  }
  return out;
}

/** EDT-05 closeout — Parallel producer.
 *
 *  Fires when the cursor is near a wall and an active draft anchor
 *  exists. Snaps the draft direction to be parallel to the hovered
 *  wall; the snap point projects the cursor onto that direction line
 *  through the anchor. */
export function produceParallelSnaps(opts: {
  cursor: XY;
  lines: SegmentLine[];
  draftAnchor?: XY;
  snapMm: number;
}): SnapHit[] {
  if (!opts.draftAnchor) return [];
  const tol2 = opts.snapMm * opts.snapMm;
  const out: SnapHit[] = [];
  for (const line of opts.lines) {
    // Hover gate: cursor must be within snap tolerance of the wall.
    const hoverFoot = perpendicularFoot(opts.cursor, line);
    if (!hoverFoot) continue;
    if (dist2(opts.cursor.xMm, opts.cursor.yMm, hoverFoot.xMm, hoverFoot.yMm) > tol2) continue;
    // Direction line: parallel to the wall, passing through the anchor.
    const dirLine: SegmentLine = {
      start: opts.draftAnchor,
      end: {
        xMm: opts.draftAnchor.xMm + (line.end.xMm - line.start.xMm),
        yMm: opts.draftAnchor.yMm + (line.end.yMm - line.start.yMm),
      },
    };
    const projected = perpendicularFoot(opts.cursor, dirLine);
    if (!projected) continue;
    out.push({ point: projected, kind: 'parallel' });
  }
  return out;
}

/** EDT-05 closeout — Workplane producer.
 *
 *  3D-only conceptually: given the active reference plane, project the
 *  cursor onto the plane. Plan-canvas trace of a vertical plane is a
 *  line, so we fall back to the perpendicular foot of cursor onto the
 *  plane's plan line. The 3D viewport supplies an active workplane
 *  derived from the reference plane element flagged `isWorkPlane`. */
export function produceWorkplaneSnaps(opts: {
  cursor: XY;
  workplane?: ActiveWorkplane;
  snapMm: number;
}): SnapHit[] {
  if (!opts.workplane) return [];
  const tol2 = opts.snapMm * opts.snapMm;
  const foot = perpendicularFoot(opts.cursor, opts.workplane);
  if (!foot) return [];
  if (dist2(opts.cursor.xMm, opts.cursor.yMm, foot.xMm, foot.yMm) > tol2) return [];
  return [{ point: foot, kind: 'workplane' }];
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
   *  extension / parallel snaps against. Optional for backward compat. */
  lines?: SegmentLine[];
  /** EDT-05 closeout — polyline curves used by the tangent producer. */
  curves?: CurveSegment[];
  /** EDT-05 closeout — active workplane (plan trace) for the workplane
   *  producer. Optional; populated only when a reference plane is the
   *  active workplane. */
  workplane?: ActiveWorkplane;
  /** EDT-05 closeout — draft start anchor used by the tangent and
   *  parallel producers; both no-op without it. Distinct from
   *  `chainAnchor` (which carries ortho-hold semantics). */
  draftAnchor?: XY;
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

  // EDT-05 closeout: parallel / tangent / workplane producers.
  if (opts.lines && opts.lines.length > 0 && opts.draftAnchor) {
    for (const h of produceParallelSnaps({
      cursor: p,
      lines: opts.lines,
      draftAnchor: opts.draftAnchor,
      snapMm: opts.snapMm,
    })) {
      hits.push(h);
    }
  }
  if (opts.curves && opts.curves.length > 0 && opts.draftAnchor) {
    for (const h of produceTangentSnaps({
      cursor: p,
      curves: opts.curves,
      draftAnchor: opts.draftAnchor,
      snapMm: opts.snapMm,
    })) {
      hits.push(h);
    }
  }
  if (opts.workplane) {
    for (const h of produceWorkplaneSnaps({
      cursor: p,
      workplane: opts.workplane,
      snapMm: opts.snapMm,
    })) {
      hits.push(h);
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
    // Endpoint > intersection > perpendicular > extension > parallel >
    // tangent > workplane > grid > raw. Matches Revit's "stronger" snap
    // by kind, then proximity inside the same kind. EDT-05 closeout
    // inserts parallel / tangent / workplane between extension and
    // grid per the wave-04 prompt's precedence table.
    const rank = (k: SnapKind) =>
      k === 'endpoint'
        ? 0
        : k === 'intersection'
          ? 1
          : k === 'perpendicular'
            ? 2
            : k === 'extension'
              ? 3
              : k === 'parallel'
                ? 4
                : k === 'tangent'
                  ? 5
                  : k === 'workplane'
                    ? 6
                    : k === 'grid'
                      ? 7
                      : 8;
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
