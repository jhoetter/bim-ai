import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  DRIFT_BADGE_FILL,
  DRIFT_BADGE_STROKE,
  driftBadgeTooltip,
  driftedFieldCount,
  elementBadgeAnchorMm,
  elementHasDrift,
  pickDriftBadgeAt,
  renderMonitorDriftBadge,
  selectDriftedElements,
} from './monitorDriftBadge';

function makeMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('FED-03 — elementHasDrift', () => {
  it('returns true for a monitorSource that drifted on at least one field', () => {
    const elem = {
      kind: 'level' as const,
      id: 'lvl-1',
      monitorSource: {
        elementId: 'src-1',
        sourceRevisionAtCopy: 0,
        drifted: true,
        driftedFields: ['elevationMm'],
      },
    };
    expect(elementHasDrift(elem)).toBe(true);
  });

  it('returns false when no monitorSource pointer exists', () => {
    const elem = { kind: 'level' as const, id: 'lvl-1' };
    expect(elementHasDrift(elem)).toBe(false);
  });

  it('returns false when drifted=true but driftedFields is empty', () => {
    const elem = {
      kind: 'level' as const,
      id: 'lvl-1',
      monitorSource: {
        elementId: 'src-1',
        sourceRevisionAtCopy: 0,
        drifted: true,
        driftedFields: [],
      },
    };
    expect(elementHasDrift(elem)).toBe(false);
  });
});

describe('FED-03 — renderMonitorDriftBadge', () => {
  it('emits a yellow triangle with stroke at the supplied centre', () => {
    const ctx = makeMockContext();
    const rect = renderMonitorDriftBadge(ctx, { xPx: 100, yPx: 100 });
    expect(rect).toEqual({ xPx: 92, yPx: 92, widthPx: 16, heightPx: 16 });
    expect(ctx.fillStyle).toBe(DRIFT_BADGE_FILL);
    expect(ctx.strokeStyle).toBe(DRIFT_BADGE_STROKE);
    const moveCalls = (ctx.moveTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(moveCalls).toEqual([[100, 92]]);
    const lineCalls = (ctx.lineTo as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(lineCalls).toEqual([
      [108, 108],
      [92, 108],
    ]);
    expect((ctx.fill as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('honors a custom sizePx option', () => {
    const ctx = makeMockContext();
    const rect = renderMonitorDriftBadge(ctx, { xPx: 0, yPx: 0 }, { sizePx: 32 });
    expect(rect).toEqual({ xPx: -16, yPx: -16, widthPx: 32, heightPx: 32 });
  });
});

describe('FED-03 — driftedFieldCount + driftBadgeTooltip', () => {
  it('counts driftedFields entries', () => {
    expect(
      driftedFieldCount({
        monitorSource: {
          elementId: 'src',
          sourceRevisionAtCopy: 0,
          drifted: true,
          driftedFields: ['a', 'b', 'c'],
        },
      }),
    ).toBe(3);
  });

  it('formats the tooltip as "N field(s) differ"', () => {
    expect(
      driftBadgeTooltip({
        monitorSource: {
          elementId: 'src',
          sourceRevisionAtCopy: 0,
          drifted: true,
          driftedFields: ['elevationMm', 'name'],
        },
      }),
    ).toBe('Monitored source has drifted — 2 field(s) differ');
  });
});

describe('FED-03 — elementBadgeAnchorMm', () => {
  it('returns positionMm for point-style elements', () => {
    const elem = {
      kind: 'placed_tag',
      positionMm: { xMm: 100, yMm: 200 },
    } as unknown as Element;
    expect(elementBadgeAnchorMm(elem)).toEqual({ xMm: 100, yMm: 200 });
  });

  it('returns the midpoint of start/end for line-style elements', () => {
    const elem = {
      kind: 'grid_line',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 1000, yMm: 0 },
    } as unknown as Element;
    expect(elementBadgeAnchorMm(elem)).toEqual({ xMm: 500, yMm: 0 });
  });

  it('returns the centroid of a polygon for footprint-style elements', () => {
    const elem = {
      kind: 'mass',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 0 },
        { xMm: 100, yMm: 100 },
        { xMm: 0, yMm: 100 },
      ],
    } as unknown as Element;
    expect(elementBadgeAnchorMm(elem)).toEqual({ xMm: 50, yMm: 50 });
  });

  it('returns null when the element has no plan-space geometry', () => {
    const elem = { kind: 'level', id: 'lvl-1', name: 'L1' } as unknown as Element;
    expect(elementBadgeAnchorMm(elem)).toBeNull();
  });
});

describe('FED-03 — pickDriftBadgeAt', () => {
  it('returns the element id when point is inside a hit rect', () => {
    const id = pickDriftBadgeAt({ xPx: 100, yPx: 100 }, [
      { elementId: 'el-1', rect: { xPx: 90, yPx: 90, widthPx: 20, heightPx: 20 } },
    ]);
    expect(id).toBe('el-1');
  });

  it('returns null when point is outside every rect', () => {
    const id = pickDriftBadgeAt({ xPx: 200, yPx: 200 }, [
      { elementId: 'el-1', rect: { xPx: 0, yPx: 0, widthPx: 20, heightPx: 20 } },
    ]);
    expect(id).toBeNull();
  });
});

describe('FED-03 — selectDriftedElements', () => {
  it('returns only elements whose monitorSource has drifted', () => {
    const elementsById = {
      a: {
        kind: 'level',
        id: 'a',
        monitorSource: {
          elementId: 's',
          sourceRevisionAtCopy: 0,
          drifted: true,
          driftedFields: ['elevationMm'],
        },
      },
      b: { kind: 'level', id: 'b' },
    } as unknown as Record<string, Element>;
    const drifted = selectDriftedElements(elementsById);
    expect(drifted.map((e) => e.id)).toEqual(['a']);
  });
});
