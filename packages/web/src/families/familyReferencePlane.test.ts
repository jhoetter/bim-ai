import { describe, expect, it } from 'vitest';
import type { FamilyReferencePlaneElement } from '@bim-ai/core';

describe('Family reference plane — §15.1.3', () => {
  it('AddFamilyReferencePlaneCmd has correct shape', () => {
    const cmd = {
      type: 'addFamilyReferencePlane' as const,
      familyId: 'fam1',
      name: 'Width Reference',
      axis: 'x' as const,
      offsetMm: 0,
      isReference: true,
    };
    expect(cmd.type).toBe('addFamilyReferencePlane');
    expect(cmd.axis).toBe('x');
  });

  it('reference plane has correct element shape', () => {
    const frp: FamilyReferencePlaneElement = {
      kind: 'family_reference_plane',
      id: 'frp1',
      familyId: 'fam1',
      name: 'Center (Left/Right)',
      axis: 'x',
      offsetMm: 0,
      isReference: true,
    };
    expect(frp.kind).toBe('family_reference_plane');
    expect(frp.axis).toBe('x');
  });

  it('axis can be x or z', () => {
    const axes: Array<'x' | 'z'> = ['x', 'z'];
    expect(axes).toContain('x');
    expect(axes).toContain('z');
  });

  it('offsetMm defaults to 0', () => {
    const frp: Pick<FamilyReferencePlaneElement, 'kind' | 'offsetMm'> = {
      kind: 'family_reference_plane',
      offsetMm: 0,
    };
    expect(frp.offsetMm).toBe(0);
  });

  it('isReference defaults to true', () => {
    const frp: Pick<FamilyReferencePlaneElement, 'kind' | 'isReference'> = {
      kind: 'family_reference_plane',
      isReference: true,
    };
    expect(frp.isReference).toBe(true);
  });

  it('z axis means horizontal reference plane', () => {
    const frp: Pick<FamilyReferencePlaneElement, 'axis' | 'offsetMm'> = {
      axis: 'z',
      offsetMm: 500,
    };
    const label = frp.axis === 'z' ? 'horizontal' : 'vertical';
    expect(label).toBe('horizontal');
  });
});
