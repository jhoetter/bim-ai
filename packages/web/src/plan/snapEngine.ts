import type { Element, XY } from '@bim-ai/core';

export type SnapKind = 'raw' | 'grid' | 'endpoint';

export type SnapHit = { point: XY; kind: SnapKind };

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

export function snapToGrid(p: XY, stepMm: number): XY {
  const s = Math.max(10, stepMm);

  return {
    xMm: Math.round(p.xMm / s) * s,
    yMm: Math.round(p.yMm / s) * s,
  };
}

/** Multiple snap targets within radius — first is default; Tab-cycle can iterate. */

export function snapPlanCandidates(opts: {
  cursor: XY;
  anchors: XY[];

  gridStepMm: number;
  chainAnchor?: XY;
  snapMm: number;

  orthoHold: boolean;
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

  const seen = new Set<string>();

  const out: SnapHit[] = [];

  for (const h of hits) {
    const k = `${Math.round(h.point.xMm)}:${Math.round(h.point.yMm)}:${h.kind}`;

    if (seen.has(k)) continue;

    seen.add(k);

    out.push(h);
  }

  out.sort((a, b) => {
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
