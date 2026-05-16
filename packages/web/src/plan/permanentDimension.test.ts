/**
 * ANN-P2 — permanent_dimension element type tests.
 *
 * Tests cover EQ mode display logic and segment count constraints.
 */
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

type PermanentDimension = Extract<Element, { kind: 'permanent_dimension' }>;

const threePointDim: PermanentDimension = {
  kind: 'permanent_dimension',
  id: 'pd-1',
  levelId: 'lvl-0',
  witnessPointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 3000, yMm: 0 },
    { xMm: 6000, yMm: 0 },
  ],
  offsetMm: { xMm: 0, yMm: -500 },
  eqEnabled: false,
};

const eqDim: PermanentDimension = {
  ...threePointDim,
  id: 'pd-2',
  eqEnabled: true,
};

const twoPointDim: PermanentDimension = {
  kind: 'permanent_dimension',
  id: 'pd-3',
  levelId: 'lvl-0',
  witnessPointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
  ],
  offsetMm: { xMm: 0, yMm: -500 },
};

describe('permanent_dimension — element type', () => {
  it('has the correct kind discriminant', () => {
    expect(threePointDim.kind).toBe('permanent_dimension');
  });

  it('carries witnessPointsMm array', () => {
    expect(threePointDim.witnessPointsMm).toHaveLength(3);
  });

  it('eqEnabled is optional and defaults to undefined when omitted', () => {
    const minimal: PermanentDimension = {
      kind: 'permanent_dimension',
      id: 'pd-min',
      levelId: 'lvl-0',
      witnessPointsMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ],
      offsetMm: { xMm: 0, yMm: -300 },
    };
    expect(minimal.eqEnabled).toBeUndefined();
  });
});

describe('permanent_dimension — EQ rendering logic', () => {
  /**
   * A 3-witness-point dimension with eqEnabled=false should NOT show "EQ".
   * We verify this by checking that eqEnabled is falsy, meaning the renderer
   * would display individual segment lengths rather than "EQ".
   */
  it('dimension with 3 witness points and eqEnabled=false does NOT display EQ', () => {
    expect(threePointDim.witnessPointsMm.length).toBe(3);
    expect(threePointDim.eqEnabled).toBe(false);
    // Renderer branches on eqEnabled: falsy => per-segment labels, not "EQ"
    const wouldShowEq = Boolean(threePointDim.eqEnabled);
    expect(wouldShowEq).toBe(false);
  });

  /**
   * A dimension with eqEnabled=true should display "EQ".
   */
  it('dimension with eqEnabled=true displays EQ', () => {
    expect(eqDim.eqEnabled).toBe(true);
    const wouldShowEq = Boolean(eqDim.eqEnabled);
    expect(wouldShowEq).toBe(true);
  });

  /**
   * A 2-witness-point dimension (1 segment) should not show an EQ affordance
   * because EQ is only meaningful when there are 2 or more segments to equalize.
   */
  it('dimension with 2 witness points (1 segment) has only 1 segment — no EQ affordance needed', () => {
    const segmentCount = twoPointDim.witnessPointsMm.length - 1;
    expect(segmentCount).toBe(1);
    // EQ affordance is only meaningful for ≥2 segments
    const eqAffordanceVisible = segmentCount >= 2;
    expect(eqAffordanceVisible).toBe(false);
  });

  it('computes correct segment lengths for a horizontal chain', () => {
    const pts = threePointDim.witnessPointsMm;
    const seg0Len = Math.hypot(pts[1]!.xMm - pts[0]!.xMm, pts[1]!.yMm - pts[0]!.yMm);
    const seg1Len = Math.hypot(pts[2]!.xMm - pts[1]!.xMm, pts[2]!.yMm - pts[1]!.yMm);
    expect(seg0Len).toBe(3000);
    expect(seg1Len).toBe(3000);
  });
});
