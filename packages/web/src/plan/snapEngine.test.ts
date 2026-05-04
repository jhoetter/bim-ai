import { describe, expect, it } from 'vitest';

import { snapPlanPoint } from './snapEngine';

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
