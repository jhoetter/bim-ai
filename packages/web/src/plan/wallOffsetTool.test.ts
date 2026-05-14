import { describe, expect, it } from 'vitest';

import { wallOffsetDeltaFromPoint, wallOffsetMoveCommandFromPoint } from './wallOffsetTool';

describe('WP-NEXT-42 wall offset modify helper', () => {
  const wall = {
    id: 'w-1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 4000, yMm: 0 },
  };

  it('computes a perpendicular move delta without reversing wall endpoints', () => {
    expect(wallOffsetDeltaFromPoint(wall, { xMm: 1200, yMm: 750 })).toEqual({
      dxMm: 0,
      dyMm: 750,
      signedOffsetMm: 750,
    });
  });

  it('preserves signed side for negative offsets', () => {
    const delta = wallOffsetDeltaFromPoint(wall, { xMm: 1200, yMm: -500 });

    expect(delta?.dxMm).toBeCloseTo(0);
    expect(delta?.dyMm).toBeCloseTo(-500);
    expect(delta?.signedOffsetMm).toBeCloseTo(-500);
  });

  it('emits a batch moveElementsDelta payload for the selected wall set', () => {
    expect(wallOffsetMoveCommandFromPoint(wall, { xMm: 1200, yMm: 600 }, ['w-1', 'w-2'])).toEqual({
      type: 'moveElementsDelta',
      elementIds: ['w-1', 'w-2'],
      dxMm: 0,
      dyMm: 600,
    });
  });

  it('rejects degenerate walls and zero-distance offsets', () => {
    expect(
      wallOffsetDeltaFromPoint(
        { id: 'zero', start: { xMm: 0, yMm: 0 }, end: { xMm: 0, yMm: 0 } },
        { xMm: 100, yMm: 100 },
      ),
    ).toBeNull();
    expect(wallOffsetDeltaFromPoint(wall, { xMm: 2500, yMm: 0 })).toBeNull();
  });
});
