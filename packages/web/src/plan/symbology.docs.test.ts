import { describe, expect, it } from 'vitest';

import {
  PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT,
  PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS,
  PLAN_SLICE_ELEVATION_M,
  PLAN_WALL_CENTER_SLICE_HEIGHT_M,
  ROOM_PLAN_OVERLAP_ADVISOR_MM2,
  SECTION_VIEWPORT_SCALE_BASELINE_PX,
  SECTION_VIEWPORT_WALL_HATCH_ALONG_CUT_TILE,
  SECTION_VIEWPORT_WALL_HATCH_EDGE_ON_TILE,
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

  it('exports section viewport scale baseline for sheet nesting (WP-E04/C03)', () => {
    expect(SECTION_VIEWPORT_SCALE_BASELINE_PX).toBe(600);
  });

  it('exports section wall hatch tile sizes (WP-E04/C03)', () => {
    expect(SECTION_VIEWPORT_WALL_HATCH_EDGE_ON_TILE).toBe(10);
    expect(SECTION_VIEWPORT_WALL_HATCH_ALONG_CUT_TILE).toBe(12);
  });
});
