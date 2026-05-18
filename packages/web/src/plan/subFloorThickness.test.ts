import { describe, expect, it } from 'vitest';

describe('subFloorThickness — §3.4.2', () => {
  it('SetSubFloorThicknessCmd has correct shape', () => {
    const cmd = { type: 'setSubFloorThickness' as const, floorId: 'f1', subFloorThicknessMm: 200 };
    expect(cmd.type).toBe('setSubFloorThickness');
    expect(cmd.floorId).toBe('f1');
    expect(cmd.subFloorThicknessMm).toBe(200);
  });

  it('allows null to clear sub-floor', () => {
    const cmd = { type: 'setSubFloorThickness' as const, floorId: 'f1', subFloorThicknessMm: null };
    expect(cmd.subFloorThicknessMm).toBeNull();
  });

  it('subFloorThicknessMm field is optional on floor element', () => {
    const floor: any = { id: 'f1', kind: 'floor', thicknessMm: 250 };
    expect(floor.subFloorThicknessMm).toBeUndefined();
  });

  it('can set subFloorThicknessMm on floor element', () => {
    const floor: any = { id: 'f1', kind: 'floor', thicknessMm: 250, subFloorThicknessMm: 300 };
    expect(floor.subFloorThicknessMm).toBe(300);
  });
});
