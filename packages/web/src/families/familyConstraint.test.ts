import { describe, expect, it } from 'vitest';
import { applyFamilyConstraints } from '../plan/familyParameterEval';
import type { FamilyConstraintElem } from '@bim-ai/core';

const plane1: any = { id: 'rp1', kind: 'reference_plane', xMm: 0, yMm: 0 };
const plane2: any = { id: 'rp2', kind: 'reference_plane', xMm: 500, yMm: 0 };

const elementsById: Record<string, any> = { rp1: plane1, rp2: plane2 };

const constraint: FamilyConstraintElem = {
  id: 'c1',
  kind: 'family_constraint',
  familyId: 'fam1',
  paramName: 'Width',
  refPlaneId1: 'rp1',
  refPlaneId2: 'rp2',
  axis: 'x',
};

describe('applyFamilyConstraints — §15.1.3', () => {
  it('moves refPlane2 x position to match param value', () => {
    const result = applyFamilyConstraints(elementsById, [constraint], { Width: 1200 });
    expect((result['rp2'] as any).xMm).toBe(1200);
  });

  it('does not move plane when param is not in paramValues', () => {
    const result = applyFamilyConstraints(elementsById, [constraint], {});
    expect((result['rp2'] as any).xMm).toBe(500); // unchanged
  });

  it('applies y-axis constraint correctly', () => {
    const yConstraint: FamilyConstraintElem = {
      ...constraint,
      id: 'c2',
      axis: 'y',
      paramName: 'Height',
    };
    const result = applyFamilyConstraints(elementsById, [yConstraint], { Height: 800 });
    expect((result['rp2'] as any).yMm).toBe(800);
  });

  it('skips constraint when refPlane does not exist', () => {
    const broken: FamilyConstraintElem = { ...constraint, refPlaneId1: 'nonexistent' };
    expect(() => applyFamilyConstraints(elementsById, [broken], { Width: 1000 })).not.toThrow();
  });

  it('applies multiple constraints independently', () => {
    const c2: FamilyConstraintElem = {
      id: 'c2',
      kind: 'family_constraint',
      familyId: 'fam1',
      paramName: 'Height',
      refPlaneId1: 'rp1',
      refPlaneId2: 'rp2',
      axis: 'y',
    };
    const result = applyFamilyConstraints(elementsById, [constraint, c2], {
      Width: 1200,
      Height: 900,
    });
    expect((result['rp2'] as any).xMm).toBe(1200);
    expect((result['rp2'] as any).yMm).toBe(900);
  });
});
