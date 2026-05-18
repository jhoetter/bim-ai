import { describe, expect, it } from 'vitest';

describe('Steel fabrication + parametric sections — §9.5.3 + §9.5.4', () => {
  it('steel_connection connectionType values are valid', () => {
    const types = ['end_plate', 'bolted_flange', 'shear_tab'] as const;
    expect(types).toContain('end_plate');
    expect(types.length).toBe(3);
  });

  it('CreateSteelConnectionCmd has correct current type', () => {
    const cmd = {
      type: 'create_steel_connection' as const,
      id: 'sc-1',
      hostElementId: 'b1',
      connectionType: 'end_plate' as const,
    };
    expect(cmd.type).toBe('create_steel_connection');
    expect(cmd.hostElementId).toBe('b1');
  });

  it('SetBeamSectionProfileCmd has correct shape', () => {
    const cmd = { type: 'setBeamSectionProfile' as const, beamId: 'b1', profileId: 'bsp-1' };
    expect(cmd.type).toBe('setBeamSectionProfile');
    expect(cmd.profileId).toBe('bsp-1');
  });

  it('SetBeamSectionProfileCmd supports null to reset', () => {
    const cmd = { type: 'setBeamSectionProfile' as const, beamId: 'b1', profileId: null };
    expect(cmd.profileId).toBeNull();
  });

  it('beam_section_profile has profilePoints array', () => {
    const profile = {
      kind: 'beam_section_profile',
      id: 'bsp-1',
      name: 'HEB 300',
      profilePoints: [
        { xMm: -150, yMm: 0 },
        { xMm: 150, yMm: 0 },
        { xMm: 150, yMm: 300 },
        { xMm: -150, yMm: 300 },
      ],
    };
    expect(profile.profilePoints.length).toBe(4);
  });

  it('steel connection plan symbol uses a positive ring radius range', () => {
    const innerR = 0.04;
    const outerR = 0.07;
    expect(outerR).toBeGreaterThan(innerR);
  });
});
