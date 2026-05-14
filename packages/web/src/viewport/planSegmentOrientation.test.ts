import { describe, expect, it } from 'vitest';

import { localPlanOffsetToWorld, yawForPlanSegment } from './planSegmentOrientation';

describe('planSegmentOrientation', () => {
  it('maps a plan segment direction onto Three.js local +X', () => {
    const yaw = yawForPlanSegment(3000, 4000);
    const world = localPlanOffsetToWorld(yaw, 1, 0);

    expect(world.xM).toBeCloseTo(0.6, 5);
    expect(world.zM).toBeCloseTo(0.8, 5);
  });

  it('maps local +Z to the left normal of the plan segment', () => {
    const yaw = yawForPlanSegment(3000, 4000);
    const world = localPlanOffsetToWorld(yaw, 0, 1);

    expect(world.xM).toBeCloseTo(-0.8, 5);
    expect(world.zM).toBeCloseTo(0.6, 5);
  });
});
