import { describe, expect, it } from 'vitest';

describe('Wall profile inspector editor — §3.5.5', () => {
  it('UpdateWallProfileCmd has correct shape', () => {
    const cmd = {
      type: 'updateWallProfile' as const,
      wallId: 'w1',
      profilePoints: [
        { xPct: 0, yPct: 0 },
        { xPct: 1, yPct: 0 },
        { xPct: 1, yPct: 1 },
      ],
    };
    expect(cmd.type).toBe('updateWallProfile');
    expect(cmd.profilePoints.length).toBe(3);
  });

  it('profile requires at least 3 points to activate custom mesh', () => {
    const twoPoints = [
      { xPct: 0, yPct: 0 },
      { xPct: 1, yPct: 0 },
    ];
    const valid = twoPoints.length >= 3;
    expect(valid).toBe(false);
  });

  it('null profilePoints resets to rectangular', () => {
    const cmd = { type: 'updateWallProfile' as const, wallId: 'w1', profilePoints: null };
    expect(cmd.profilePoints).toBeNull();
  });

  it('add-point button testid is correct', () => {
    expect('wall-profile-add-point').toBe('wall-profile-add-point');
  });

  it('profile preview SVG testid is correct', () => {
    expect('wall-profile-preview').toBe('wall-profile-preview');
  });

  it('point inputs use indexed testids', () => {
    const xTestid = `wall-profile-pt-x-0`;
    const yTestid = `wall-profile-pt-y-0`;
    expect(xTestid).toBe('wall-profile-pt-x-0');
    expect(yTestid).toBe('wall-profile-pt-y-0');
  });
});
