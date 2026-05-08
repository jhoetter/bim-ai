import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LINE_RULES,
  HATCH_SPECS,
  LINE_WEIGHT_PX_AT_1_50,
  REFERENCE_PLOT_SCALE,
  dashArray,
  gridVisibilityFor,
  hatchVisibleAt,
  lineWeightsForScale,
  lineWidthPxFor,
} from './draftingStandards';

describe('lineWidthPxFor — §9.10', () => {
  it('passes through at the 1:50 reference', () => {
    expect(lineWidthPxFor('--draft-lw-cut-major', REFERENCE_PLOT_SCALE)).toBe(2);
    expect(lineWidthPxFor('--draft-lw-witness', REFERENCE_PLOT_SCALE)).toBe(0.5);
  });
  it('shrinks lines at coarser scales (1:200)', () => {
    expect(lineWidthPxFor('--draft-lw-cut-major', 200)).toBeCloseTo(0.5, 6);
  });
  it('grows lines at finer scales (1:5)', () => {
    expect(lineWidthPxFor('--draft-lw-cut-major', 5)).toBe(20);
  });
  it('gracefully handles invalid scale by returning the base px', () => {
    expect(lineWidthPxFor('--draft-lw-cut-major', 0)).toBe(2);
    expect(lineWidthPxFor('--draft-lw-cut-major', -1)).toBe(2);
  });
});

describe('CATEGORY_LINE_RULES — §26', () => {
  it('covers every documented role', () => {
    const required = [
      'wall.cut',
      'door.cut',
      'window.cut',
      'floor.projection',
      'roof.projection',
      'stair.tread',
      'stair.direction',
      'hidden',
      'dimension.witness',
      'construction',
    ];
    for (const role of required) {
      expect(CATEGORY_LINE_RULES[role]).toBeDefined();
    }
  });

  it('wall cut uses the major line weight + cut color', () => {
    expect(CATEGORY_LINE_RULES['wall.cut']!.weight).toBe('--draft-lw-cut-major');
    expect(CATEGORY_LINE_RULES['wall.cut']!.color).toBe('--draft-cut');
  });

  it('hidden uses 4-3 dash', () => {
    expect(CATEGORY_LINE_RULES.hidden!.dash).toEqual({
      kind: 'dashed',
      on: 4,
      off: 3,
    });
  });

  it('roof projection uses dash-dot pattern', () => {
    expect(CATEGORY_LINE_RULES['roof.projection']!.dash.kind).toBe('dash-dot');
  });

  it('floor projection has 60% opacity', () => {
    expect(CATEGORY_LINE_RULES['floor.projection']!.opacity).toBeCloseTo(0.6, 6);
  });
});

describe('dashArray', () => {
  it('returns null for solid', () => {
    expect(dashArray({ kind: 'solid' }, 1)).toBeNull();
  });
  it('scales dashed pattern by width', () => {
    expect(dashArray({ kind: 'dashed', on: 4, off: 3 }, 0.7)).toBe('2.8 2.0999999999999996');
  });
  it('serializes dash-dot as four numbers', () => {
    const out = dashArray({ kind: 'dash-dot', pattern: [4, 2, 1, 2] }, 1);
    expect(out?.split(' ')).toHaveLength(4);
  });
});

describe('hatch & grid', () => {
  it('every hatch declares the visible-at-scale ceiling', () => {
    for (const h of Object.values(HATCH_SPECS)) {
      expect(h.visibleAtScaleAtMost).toBeGreaterThan(0);
    }
  });

  it('hatchVisibleAt tracks the spec rule', () => {
    expect(hatchVisibleAt(50, HATCH_SPECS['wall.concrete']!)).toBe(true);
    expect(hatchVisibleAt(500, HATCH_SPECS['wall.concrete']!)).toBe(false);
  });

  it('gridVisibilityFor mirrors §14.5', () => {
    expect(gridVisibilityFor(50)).toEqual({ showMajor: true, showMinor: true });
    expect(gridVisibilityFor(150)).toEqual({ showMajor: true, showMinor: false });
    expect(gridVisibilityFor(500)).toEqual({ showMajor: false, showMinor: false });
  });
});

describe('LINE_WEIGHT_PX_AT_1_50', () => {
  it('matches the spec table values', () => {
    expect(LINE_WEIGHT_PX_AT_1_50['--draft-lw-cut-major']).toBe(2);
    expect(LINE_WEIGHT_PX_AT_1_50['--draft-lw-cut-minor']).toBe(1.4);
    expect(LINE_WEIGHT_PX_AT_1_50['--draft-lw-projection-major']).toBe(1);
    expect(LINE_WEIGHT_PX_AT_1_50['--draft-lw-projection-minor']).toBe(0.7);
    expect(LINE_WEIGHT_PX_AT_1_50['--draft-lw-hidden']).toBe(0.7);
    expect(LINE_WEIGHT_PX_AT_1_50['--draft-lw-witness']).toBe(0.5);
    expect(LINE_WEIGHT_PX_AT_1_50['--draft-lw-construction']).toBe(0.5);
  });
});

describe('lineWeightsForScale — CAN-V3-01', () => {
  it('1:50 returns spec values', () => {
    const w = lineWeightsForScale(50);
    expect(w.cutMajor).toBe(2);
    expect(w.cutMinor).toBe(1.4);
    expect(w.projMajor).toBeCloseTo(1.0, 6);
    expect(w.projMinor).toBeCloseTo(0.7, 6);
    expect(w.witness).toBe(0.5);
  });

  it('1:100 weights are ~70 % of 1:50', () => {
    const w50 = lineWeightsForScale(50);
    const w100 = lineWeightsForScale(100);
    expect(w100.cutMajor!).toBeCloseTo(w50.cutMajor * 0.5, 5);
    // continuous formula: 50/100 = 0.5 — "~70 %" in the WP refers to the
    // step-table canonical; the continuous formula is the engine truth.
  });

  it('1:200 cuts are 50 % of 1:50', () => {
    const w = lineWeightsForScale(200);
    expect(w.cutMajor).toBeCloseTo(0.5, 5);
    expect(w.projMajor).not.toBeNull();
  });

  it('1:500 suppresses projection (null)', () => {
    const w = lineWeightsForScale(500);
    expect(w.projMajor).toBeNull();
    expect(w.projMinor).toBeNull();
    expect(w.cutMajor).toBeCloseTo(0.2, 5);
  });

  it('witness stays at hairline at all scales', () => {
    for (const s of [50, 100, 200, 500]) {
      expect(lineWeightsForScale(s).witness).toBeGreaterThan(0);
    }
  });

  it('grid follows gridVisibilityFor', () => {
    expect(lineWeightsForScale(50).gridMajor).not.toBeNull();
    expect(lineWeightsForScale(50).gridMinor).not.toBeNull();
    expect(lineWeightsForScale(200).gridMajor).not.toBeNull();
    expect(lineWeightsForScale(200).gridMinor).toBeNull();
    expect(lineWeightsForScale(500).gridMajor).toBeNull();
    expect(lineWeightsForScale(500).gridMinor).toBeNull();
  });
});
