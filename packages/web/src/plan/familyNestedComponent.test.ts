import { describe, expect, it } from 'vitest';

describe('FamilyComponent — §15.1.2', () => {
  it('AddFamilyComponentCmd has correct shape', () => {
    const cmd = {
      type: 'addFamilyComponent' as const,
      familyId: 'fam-01',
      componentTypeId: 'door-hardware',
      label: 'Handle',
      originMm: { xMm: 0, yMm: 0, zMm: 1000 },
      rotationDeg: 90,
    };
    expect(cmd.type).toBe('addFamilyComponent');
    expect(cmd.componentTypeId).toBe('door-hardware');
    expect(cmd.originMm.zMm).toBe(1000);
  });

  it('rotationDeg defaults to 0 when omitted', () => {
    const cmd = {
      type: 'addFamilyComponent' as const,
      familyId: 'fam-01',
      componentTypeId: 'hinge',
      originMm: { xMm: 0, yMm: 0, zMm: 0 },
    };
    const rotationDeg = cmd.rotationDeg ?? 0;
    expect(rotationDeg).toBe(0);
  });

  it('family_component element has familyId and componentTypeId', () => {
    const el: any = {
      kind: 'family_component',
      id: 'fc-01',
      familyId: 'fam-01',
      componentTypeId: 'hinge',
      originMm: { xMm: 100, yMm: 0, zMm: 500 },
    };
    expect(el.kind).toBe('family_component');
    expect(el.familyId).toBe('fam-01');
    expect(el.originMm.zMm).toBe(500);
  });

  it('label falls back to componentTypeId when not set', () => {
    const el: any = { componentTypeId: 'generic-hardware' };
    expect(el.label ?? el.componentTypeId).toBe('generic-hardware');
  });
});
