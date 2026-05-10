import { describe, expect, it } from 'vitest';

import { moveDeltaMm } from './moveTool';

describe('moveTool orthogonal constraint', () => {
  it('returns the raw two-point delta when unconstrained', () => {
    expect(moveDeltaMm({ xMm: 100, yMm: 200 }, { xMm: 350, yMm: -50 }, false)).toEqual({
      dxMm: 250,
      dyMm: -250,
    });
  });

  it('locks to the dominant horizontal axis when Shift-constrained', () => {
    expect(moveDeltaMm({ xMm: 0, yMm: 0 }, { xMm: 900, yMm: 300 }, true)).toEqual({
      dxMm: 900,
      dyMm: 0,
    });
  });

  it('locks to the dominant vertical axis when Shift-constrained', () => {
    expect(moveDeltaMm({ xMm: 0, yMm: 0 }, { xMm: -200, yMm: 700 }, true)).toEqual({
      dxMm: 0,
      dyMm: 700,
    });
  });
});
