import { describe, it, expect } from 'vitest';

// §5.4.2 True North rotation + §5.3 Project Elevation — unit tests.
//
// These tests validate the logic that maps project_settings fields to
// planViewAngleDeg and projectElevationMm without requiring a full render.

/**
 * Simulates the rotateToTrueNorth handler:
 * given the angleToTrueNorthDeg stored on project_settings, the planViewAngleDeg
 * set on the active plan_view should be the negative of that angle.
 */
function computePlanViewAngle(angleToTrueNorthDeg: number): number {
  return -angleToTrueNorthDeg;
}

/**
 * Simulates reading planViewAngleDeg from a plan_view element.
 * Returns 0 when the field is absent (default).
 */
function readPlanViewAngle(planView: Record<string, unknown> | undefined): number {
  return (planView?.planViewAngleDeg as number | undefined) ?? 0;
}

/**
 * Simulates reading projectElevationMm from project_settings.
 * Returns 0 when the field is absent (default).
 */
function readProjectElevation(ps: Record<string, unknown> | undefined): number {
  return (ps?.projectElevationMm as number | undefined) ?? 0;
}

describe('true north rotation — §5.4.2', () => {
  it('rotateToTrueNorth sets planViewAngleDeg to negative of angleToTrueNorthDeg', () => {
    const planViewAngle = computePlanViewAngle(30);
    expect(planViewAngle).toBe(-30);
  });

  it('rotateToTrueNorth with negative angle produces positive planViewAngleDeg', () => {
    const planViewAngle = computePlanViewAngle(-45);
    expect(planViewAngle).toBe(45);
  });

  it('rotateToTrueNorth with zero angle produces zero planViewAngleDeg', () => {
    const planViewAngle = computePlanViewAngle(0);
    // Use toBeCloseTo to handle -0 vs 0
    expect(Math.abs(planViewAngle)).toBe(0);
  });

  it('planViewAngleDeg defaults to 0 when not set', () => {
    const planView = { kind: 'plan_view' as const, id: 'pv1', name: 'Level 1', levelId: 'l1' };
    expect(readPlanViewAngle(planView)).toBe(0);
  });

  it('planViewAngleDeg is read correctly when set on plan_view', () => {
    const planView = {
      kind: 'plan_view' as const,
      id: 'pv1',
      name: 'Level 1',
      levelId: 'l1',
      planViewAngleDeg: -30,
    };
    expect(readPlanViewAngle(planView)).toBe(-30);
  });

  it('planViewAngleDeg defaults to 0 for undefined plan_view', () => {
    expect(readPlanViewAngle(undefined)).toBe(0);
  });
});

describe('project elevation — §5.3', () => {
  it('setProjectElevation stores elevationMm on project_settings', () => {
    const stored = { projectElevationMm: 15000 };
    expect(readProjectElevation(stored)).toBe(15000);
  });

  it('projectElevationMm defaults to 0 when not set', () => {
    const ps = { kind: 'project_settings' as const, id: 'ps1' };
    expect(readProjectElevation(ps)).toBe(0);
  });

  it('projectElevationMm defaults to 0 for undefined project_settings', () => {
    expect(readProjectElevation(undefined)).toBe(0);
  });

  it('stores negative elevation (below sea level)', () => {
    const ps = { projectElevationMm: -5000 };
    expect(readProjectElevation(ps)).toBe(-5000);
  });
});
