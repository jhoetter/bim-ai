import { describe, expect, it } from 'vitest';

import {
  extensionPoint,
  infiniteLineIntersection,
  perpendicularFoot,
  snapPlanCandidates,
  snapPlanPoint,
  type SegmentLine,
} from './snapEngine';

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
});
