import { describe, expect, it } from 'vitest';

import {
  PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT,
  PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS,
  PLAN_SLICE_ELEVATION_M,
  PLAN_WALL_CENTER_SLICE_HEIGHT_M,
  ROOM_PLAN_OVERLAP_ADVISOR_MM2,
} from './symbology';

describe('plan symbology (WP-C01/C02/C03 projection constants)', () => {
  it('exports overlap threshold aligned with ROOM_PLAN_OVERLAP_THRESHOLD_MM2 (constraints.py)', () => {
    expect(ROOM_PLAN_OVERLAP_ADVISOR_MM2).toBe(50_000);
  });

  it('documents slice elevation + swing defaults', () => {
    expect(PLAN_SLICE_ELEVATION_M).toBeGreaterThan(0);
    expect(PLAN_WALL_CENTER_SLICE_HEIGHT_M).toBeGreaterThan(0.03);
    expect(PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS).toBeLessThan(
      PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT,
    );
  });
});
