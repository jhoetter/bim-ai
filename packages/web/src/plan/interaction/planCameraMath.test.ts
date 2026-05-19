import { describe, expect, it } from 'vitest';

import { HALF_MAX, HALF_MIN, orthoExtents, SLICE_Y } from './planCameraMath';

describe('plan camera math', () => {
  it('keeps the plan slice and scale bounds stable', () => {
    expect(SLICE_Y).toBe(0.02);
    expect(HALF_MIN).toBe(2.5);
    expect(HALF_MAX).toBe(2500);
  });

  it('chooses grid and snap spacing from the current orthographic half extent', () => {
    expect(orthoExtents(4.9)).toEqual({ stepMm: 250, snapMm: 750 });
    expect(orthoExtents(11.9)).toEqual({ stepMm: 500, snapMm: 1500 });
    expect(orthoExtents(23.9)).toEqual({ stepMm: 1000, snapMm: 3000 });
    expect(orthoExtents(24)).toEqual({ stepMm: 2000, snapMm: 6000 });
  });
});
