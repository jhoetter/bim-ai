import { describe, expect, it } from 'vitest';

import {
  closestPointOnPolyline,
  collectWallAnchors,
  extensionPoint,
  infiniteLineIntersection,
  perpendicularFoot,
  produceParallelSnaps,
  produceNearestSnaps,
  produceTangentSnaps,
  produceWorkplaneSnaps,
  snapPlanCandidates,
  snapPlanPoint,
  type SegmentLine,
} from './snapEngine';
import type { Element } from '@bim-ai/core';

describe('snapPlanPoint', () => {
  it('snaps bare cursor to nearest grid crossing', () => {
    const hit = snapPlanPoint({
      cursor: { xMm: 44, yMm: 81 },

      anchors: [],

      orthoHold: false,

      chainAnchor: undefined,

      snapMm: 500,

      gridStepMm: 600,
    });

    expect(hit.kind).toBe('grid');

    expect(hit.point).toEqual({ xMm: 0, yMm: 0 });
  });
});

/* ─── EDT-05 helpers ──────────────────────────────────────────────── */

const HORIZONTAL: SegmentLine = {
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 1000, yMm: 0 },
};
const VERTICAL: SegmentLine = {
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 0, yMm: 1000 },
};
const SLANT: SegmentLine = {
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 1000, yMm: 1000 },
};

describe('EDT-05 — infiniteLineIntersection', () => {
  it('finds the crossing of two non-parallel infinite lines', () => {
    const cross = infiniteLineIntersection(HORIZONTAL, VERTICAL);
    expect(cross).toEqual({ xMm: 0, yMm: 0 });
  });

  it('returns null for parallel lines', () => {
    const a: SegmentLine = { start: { xMm: 0, yMm: 0 }, end: { xMm: 1000, yMm: 0 } };
    const b: SegmentLine = { start: { xMm: 0, yMm: 500 }, end: { xMm: 1000, yMm: 500 } };
    expect(infiniteLineIntersection(a, b)).toBeNull();
  });

  it('extrapolates beyond segment endpoints (truly infinite)', () => {
    // Two segments whose extensions cross at (2000, 0).
    const a: SegmentLine = { start: { xMm: 0, yMm: 0 }, end: { xMm: 1000, yMm: 0 } };
    const b: SegmentLine = { start: { xMm: 2000, yMm: -500 }, end: { xMm: 2000, yMm: 500 } };
    const cross = infiniteLineIntersection(a, b);
    expect(cross).toEqual({ xMm: 2000, yMm: 0 });
  });
});

describe('EDT-05 — perpendicularFoot', () => {
  it('drops a perpendicular onto a horizontal line', () => {
    const foot = perpendicularFoot({ xMm: 400, yMm: 250 }, HORIZONTAL);
    expect(foot).toEqual({ xMm: 400, yMm: 0 });
  });

  it('handles a 45° slanted line', () => {
    const foot = perpendicularFoot({ xMm: 1000, yMm: 0 }, SLANT);
    expect(foot?.xMm).toBeCloseTo(500, 6);
    expect(foot?.yMm).toBeCloseTo(500, 6);
  });

  it('returns null for a degenerate (zero-length) segment', () => {
    const degenerate: SegmentLine = { start: { xMm: 50, yMm: 50 }, end: { xMm: 50, yMm: 50 } };
    expect(perpendicularFoot({ xMm: 0, yMm: 0 }, degenerate)).toBeNull();
  });
});

describe('EDT-05 — extensionPoint', () => {
  it('returns the projection beyond the segment end', () => {
    const ext = extensionPoint({ xMm: 1500, yMm: 5 }, HORIZONTAL);
    expect(ext?.xMm).toBeCloseTo(1500, 6);
    expect(ext?.yMm).toBeCloseTo(0, 6);
  });

  it('returns null when the projection is inside the segment (endpoint/perp covers it)', () => {
    const ext = extensionPoint({ xMm: 500, yMm: 5 }, HORIZONTAL);
    expect(ext).toBeNull();
  });
});

describe('EDT-05 — snapPlanCandidates kinds', () => {
  it('emits an intersection candidate at the X of two walls', () => {
    const hits = snapPlanCandidates({
      cursor: { xMm: 8, yMm: 8 },
      anchors: [],
      gridStepMm: 100,
      snapMm: 200,
      orthoHold: false,
      lines: [HORIZONTAL, VERTICAL],
    });
    expect(hits.some((h) => h.kind === 'intersection')).toBe(true);
    const intersection = hits.find((h) => h.kind === 'intersection')!;
    expect(intersection.point).toEqual({ xMm: 0, yMm: 0 });
  });

  it('emits a perpendicular candidate when cursor is near the foot', () => {
    const hits = snapPlanCandidates({
      cursor: { xMm: 400, yMm: 50 },
      anchors: [],
      gridStepMm: 100,
      snapMm: 200,
      orthoHold: false,
      lines: [HORIZONTAL],
    });
    expect(hits.some((h) => h.kind === 'perpendicular')).toBe(true);
    const perp = hits.find((h) => h.kind === 'perpendicular')!;
    expect(perp.point).toEqual({ xMm: 400, yMm: 0 });
  });

  it('emits an extension candidate beyond the segment endpoint', () => {
    const hits = snapPlanCandidates({
      cursor: { xMm: 1500, yMm: 30 },
      anchors: [],
      gridStepMm: 100,
      snapMm: 200,
      orthoHold: false,
      lines: [HORIZONTAL],
    });
    expect(hits.some((h) => h.kind === 'extension')).toBe(true);
  });

  it('endpoint outranks intersection when both are within tolerance', () => {
    // Cursor very close to the (0,0) corner where both lines meet —
    // endpoint hit comes from anchors[]; intersection from lines[].
    const hits = snapPlanCandidates({
      cursor: { xMm: 5, yMm: 5 },
      anchors: [{ xMm: 0, yMm: 0 }],
      gridStepMm: 100,
      snapMm: 200,
      orthoHold: false,
      lines: [HORIZONTAL, VERTICAL],
    });
    expect(hits[0]?.kind).toBe('endpoint');
  });

  it('emits midpoint, center, and nearest candidates for SN/SC overrides', () => {
    const hits = snapPlanCandidates({
      cursor: { xMm: 500, yMm: 25 },
      anchors: [{ xMm: 500, yMm: 0, snapKind: 'midpoint' }],
      centers: [{ xMm: 520, yMm: 20, snapKind: 'center' }],
      gridStepMm: 1000,
      snapMm: 100,
      orthoHold: false,
      lines: [HORIZONTAL],
    });
    expect(hits.some((h) => h.kind === 'midpoint')).toBe(true);
    expect(hits.some((h) => h.kind === 'center')).toBe(true);
    expect(hits.some((h) => h.kind === 'nearest')).toBe(true);
  });
});

/* ─── EDT-05 closeout — tangent / parallel / workplane ───────────────── */

describe('EDT-05 closeout — closestPointOnPolyline', () => {
  it('returns the foot when projection lands inside a segment', () => {
    const path = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
    ];
    const pt = closestPointOnPolyline({ xMm: 500, yMm: 200 }, path);
    expect(pt).toEqual({ xMm: 500, yMm: 0 });
  });

  it('clamps to the nearest endpoint when projection falls outside', () => {
    const path = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
    ];
    const pt = closestPointOnPolyline({ xMm: -500, yMm: 50 }, path);
    expect(pt).toEqual({ xMm: 0, yMm: 0 });
  });

  it('returns null for a single-point degenerate path', () => {
    expect(closestPointOnPolyline({ xMm: 0, yMm: 0 }, [{ xMm: 50, yMm: 50 }])).toBeNull();
  });
});

describe('EDT-05 closeout — produceTangentSnaps', () => {
  it('test_tangent_snap_on_curved_segment — emits a tangent at the closest curve point', () => {
    // Polyline that approximates a curved sweep path. Cursor sits just
    // off the curve; tangent point is the perpendicular foot on the
    // local segment (which is the polyline's tangent direction).
    const curve = {
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 500, yMm: 0 },
        { xMm: 1000, yMm: 200 },
      ],
    };
    const hits = produceTangentSnaps({
      cursor: { xMm: 250, yMm: 30 },
      curves: [curve],
      draftAnchor: { xMm: -500, yMm: -500 },
      snapMm: 100,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.kind).toBe('tangent');
    expect(hits[0]!.point).toEqual({ xMm: 250, yMm: 0 });
  });

  it('produces no tangent without an active draft anchor', () => {
    const curve = {
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ],
    };
    const hits = produceTangentSnaps({
      cursor: { xMm: 500, yMm: 5 },
      curves: [curve],
      draftAnchor: undefined,
      snapMm: 100,
    });
    expect(hits).toHaveLength(0);
  });

  it('skips curves outside snap tolerance', () => {
    const curve = {
      pathMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ],
    };
    const hits = produceTangentSnaps({
      cursor: { xMm: 500, yMm: 5000 },
      curves: [curve],
      draftAnchor: { xMm: 0, yMm: 0 },
      snapMm: 100,
    });
    expect(hits).toHaveLength(0);
  });
});

describe('F-080 — produceNearestSnaps', () => {
  it('returns the closest point on a segment inside tolerance', () => {
    const hits = produceNearestSnaps({
      cursor: { xMm: 400, yMm: 25 },
      lines: [HORIZONTAL],
      snapMm: 100,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.kind).toBe('nearest');
    expect(hits[0]!.point).toEqual({ xMm: 400, yMm: 0 });
  });
});

describe('EDT-05 closeout — produceParallelSnaps', () => {
  it('test_parallel_snap_aligns_to_hovered_wall_direction — projects cursor onto draft direction parallel to wall', () => {
    // Hovered wall points along +x. Draft anchor at (0, 500). The
    // parallel direction line is horizontal through (0, 500); the
    // cursor's projection lands at (350, 500).
    const wall: SegmentLine = {
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
    };
    const hits = produceParallelSnaps({
      cursor: { xMm: 350, yMm: 60 },
      lines: [wall],
      draftAnchor: { xMm: 0, yMm: 500 },
      snapMm: 100,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.kind).toBe('parallel');
    expect(hits[0]!.point.xMm).toBeCloseTo(350, 6);
    expect(hits[0]!.point.yMm).toBeCloseTo(500, 6);
  });

  it('produces no parallel snap when cursor is not near a wall', () => {
    const wall: SegmentLine = {
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
    };
    const hits = produceParallelSnaps({
      cursor: { xMm: 350, yMm: 5000 },
      lines: [wall],
      draftAnchor: { xMm: 0, yMm: 500 },
      snapMm: 100,
    });
    expect(hits).toHaveLength(0);
  });

  it('produces no parallel snap without an active draft anchor', () => {
    const wall: SegmentLine = {
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
    };
    const hits = produceParallelSnaps({
      cursor: { xMm: 350, yMm: 60 },
      lines: [wall],
      draftAnchor: undefined,
      snapMm: 100,
    });
    expect(hits).toHaveLength(0);
  });
});

describe('EDT-05 closeout — produceWorkplaneSnaps', () => {
  it('test_workplane_snap_projects_pointer_onto_active_plane — perpendicular foot on plan-trace', () => {
    // Active workplane is a vertical plane whose plan trace is the
    // horizontal segment y=0. Cursor at (400, 250) projects onto (400,
    // 0). Tolerance must include the offset.
    const hits = produceWorkplaneSnaps({
      cursor: { xMm: 400, yMm: 250 },
      workplane: {
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1000, yMm: 0 },
      },
      snapMm: 500,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.kind).toBe('workplane');
    expect(hits[0]!.point).toEqual({ xMm: 400, yMm: 0 });
  });

  it('returns no candidate when no workplane is active', () => {
    const hits = produceWorkplaneSnaps({
      cursor: { xMm: 400, yMm: 250 },
      workplane: undefined,
      snapMm: 500,
    });
    expect(hits).toHaveLength(0);
  });

  it('skips when cursor is outside snap tolerance', () => {
    const hits = produceWorkplaneSnaps({
      cursor: { xMm: 400, yMm: 5000 },
      workplane: {
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1000, yMm: 0 },
      },
      snapMm: 500,
    });
    expect(hits).toHaveLength(0);
  });
});

describe('EDT-05 closeout — snapPlanCandidates wiring', () => {
  it('rank order: parallel > tangent > workplane > grid', () => {
    const wall: SegmentLine = {
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 2000, yMm: 0 },
    };
    const curve = {
      pathMm: [
        { xMm: 1500, yMm: 50 },
        { xMm: 1500, yMm: 300 },
      ],
    };
    const hits = snapPlanCandidates({
      cursor: { xMm: 1500, yMm: 60 },
      anchors: [],
      gridStepMm: 1000,
      snapMm: 200,
      orthoHold: false,
      lines: [wall],
      curves: [curve],
      workplane: { start: { xMm: 0, yMm: 50 }, end: { xMm: 2000, yMm: 50 } },
      draftAnchor: { xMm: 0, yMm: 500 },
    });
    const order = hits.map((h) => h.kind);
    // Parallel must come before tangent / workplane / grid.
    const par = order.indexOf('parallel');
    const tan = order.indexOf('tangent');
    const wp = order.indexOf('workplane');
    const grid = order.indexOf('grid');
    expect(par).toBeGreaterThanOrEqual(0);
    expect(tan).toBeGreaterThanOrEqual(0);
    expect(wp).toBeGreaterThanOrEqual(0);
    expect(grid).toBeGreaterThanOrEqual(0);
    expect(par).toBeLessThan(tan);
    expect(tan).toBeLessThan(wp);
    expect(wp).toBeLessThan(grid);
  });
});

describe('WP-NEXT-41 — per-pane work-plane isolation via level-scoped snap anchors', () => {
  function makeWall(
    id: string,
    levelId: string,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
  ): Element {
    return {
      kind: 'wall',
      id,
      levelId,
      start: { xMm: sx, yMm: sy },
      end: { xMm: ex, yMm: ey },
      heightMm: 3000,
    } as unknown as Element;
  }

  const els: Record<string, Element> = {
    w1: makeWall('w1', 'lvl-ground', 0, 0, 4000, 0),
    w2: makeWall('w2', 'lvl-first', 0, 1000, 4000, 1000),
  };

  it('returns only the ground-level wall anchors when scoped to lvl-ground', () => {
    const anchors = collectWallAnchors(els, 'lvl-ground');
    const pts = anchors.map((a) => ({ x: a.xMm, y: a.yMm }));
    expect(pts).toContainEqual({ x: 0, y: 0 });
    expect(pts).toContainEqual({ x: 4000, y: 0 });
    expect(pts).not.toContainEqual({ x: 0, y: 1000 });
  });

  it('returns only the first-floor wall anchors when scoped to lvl-first', () => {
    const anchors = collectWallAnchors(els, 'lvl-first');
    const pts = anchors.map((a) => ({ x: a.xMm, y: a.yMm }));
    expect(pts).toContainEqual({ x: 0, y: 1000 });
    expect(pts).toContainEqual({ x: 4000, y: 1000 });
    expect(pts).not.toContainEqual({ x: 0, y: 0 });
  });

  it('returns anchors from both levels when levelId is undefined (no scope)', () => {
    const anchors = collectWallAnchors(els, undefined);
    const pts = anchors.map((a) => ({ x: a.xMm, y: a.yMm }));
    expect(pts).toContainEqual({ x: 0, y: 0 });
    expect(pts).toContainEqual({ x: 0, y: 1000 });
  });
});
