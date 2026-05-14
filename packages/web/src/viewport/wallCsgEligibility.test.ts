import { describe, expect, it } from 'vitest';
import { shouldRunWallOpeningCsg } from './wallCsgEligibility';

describe('shouldRunWallOpeningCsg', () => {
  it('requires CSG feature flag and at least one hosted cut element', () => {
    expect(
      shouldRunWallOpeningCsg({
        csgEnabled: false,
        hostedDoorCount: 1,
        hostedWindowCount: 0,
        hostedWallOpeningCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldRunWallOpeningCsg({
        csgEnabled: true,
        hostedDoorCount: 0,
        hostedWindowCount: 0,
        hostedWallOpeningCount: 0,
      }),
    ).toBe(false);
  });

  it('keeps roof-attached walls eligible so hosted windows cut through the wall skin', () => {
    expect(
      shouldRunWallOpeningCsg({
        csgEnabled: true,
        hostedDoorCount: 1,
        hostedWindowCount: 0,
        hostedWallOpeningCount: 0,
        roofAttachmentId: 'roof-1',
      }),
    ).toBe(true);
  });

  it('skips curtain walls because curtain panels manage their own openings', () => {
    expect(
      shouldRunWallOpeningCsg({
        csgEnabled: true,
        hostedDoorCount: 0,
        hostedWindowCount: 1,
        hostedWallOpeningCount: 0,
        isCurtainWall: true,
      }),
    ).toBe(false);
  });

  it('allows standard and typed walls with hosted openings', () => {
    expect(
      shouldRunWallOpeningCsg({
        csgEnabled: true,
        hostedDoorCount: 0,
        hostedWindowCount: 1,
        hostedWallOpeningCount: 0,
      }),
    ).toBe(true);

    // Typed walls are eligible too; wall type metadata should not disable carving.
    expect(
      shouldRunWallOpeningCsg({
        csgEnabled: true,
        hostedDoorCount: 0,
        hostedWindowCount: 0,
        hostedWallOpeningCount: 2,
      }),
    ).toBe(true);
  });
});
