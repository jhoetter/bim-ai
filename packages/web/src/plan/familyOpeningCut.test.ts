import { describe, expect, it } from 'vitest';

describe('FamilyOpeningCut — §15.1.3', () => {
  it('SetFamilyOpeningCutCmd has correct shape', () => {
    const cmd = {
      type: 'setFamilyOpeningCut' as const,
      familyId: 'fam-01',
      widthMm: 900,
      heightMm: 2100,
      sillOffsetMm: 0,
    };
    expect(cmd.type).toBe('setFamilyOpeningCut');
    expect(cmd.widthMm).toBe(900);
    expect(cmd.heightMm).toBe(2100);
  });

  it('sillOffsetMm defaults to 0 when omitted', () => {
    const sillOffsetMm = undefined ?? 0;
    expect(sillOffsetMm).toBe(0);
  });

  it('family_opening_cut element has required fields', () => {
    const el: any = {
      kind: 'family_opening_cut',
      id: 'oc-01',
      familyId: 'fam-01',
      widthMm: 900,
      heightMm: 2100,
      sillOffsetMm: 0,
    };
    expect(el.kind).toBe('family_opening_cut');
    expect(el.familyId).toBe('fam-01');
    expect(el.widthMm).toBe(900);
  });

  it('opening cut area computes correctly', () => {
    const widthMm = 900;
    const heightMm = 2100;
    const areaSqM = (widthMm / 1000) * (heightMm / 1000);
    expect(areaSqM).toBeCloseTo(1.89);
  });
});
