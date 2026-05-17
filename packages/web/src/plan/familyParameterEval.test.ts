import { describe, it, expect } from 'vitest';
import { applyFamilyParameters, validateFamilyParameters } from './familyParameterEval';
import type { Element } from '@bim-ai/core';

type FamilyParam = Extract<Element, { kind: 'family_parameter' }>;

function makeParam(overrides: Partial<FamilyParam> & { id: string; name: string }): FamilyParam {
  return {
    kind: 'family_parameter',
    paramType: 'length',
    defaultValue: 1000,
    isInstance: true,
    familyId: null,
    ...overrides,
  };
}

describe('applyFamilyParameters — §15.1.3', () => {
  it('returns empty object when no parameters have links', () => {
    const params = [
      makeParam({ id: 'p1', name: 'Width' }),
      makeParam({ id: 'p2', name: 'Height', linkedDimensionId: null, linkedProperty: null }),
    ];
    const result = applyFamilyParameters(params, {});
    expect(result).toEqual({});
  });

  it('updates linked element property from parameter value', () => {
    const param = makeParam({
      id: 'p1',
      name: 'Width',
      defaultValue: 2000,
      linkedDimensionId: 'wall-1',
      linkedProperty: 'widthMm',
    });
    const wall = { kind: 'wall', id: 'wall-1' } as unknown as Element;
    const result = applyFamilyParameters([param], { 'wall-1': wall });
    expect(result['wall-1']).toEqual({ widthMm: 2000 });
  });

  it('skips parameters without linkedDimensionId', () => {
    const paramWithLink = makeParam({
      id: 'p1',
      name: 'Width',
      defaultValue: 500,
      linkedDimensionId: 'elem-1',
      linkedProperty: 'widthMm',
    });
    const paramNoLink = makeParam({ id: 'p2', name: 'Height' });
    const elem = { kind: 'wall', id: 'elem-1' } as unknown as Element;
    const result = applyFamilyParameters([paramWithLink, paramNoLink], { 'elem-1': elem });
    expect(Object.keys(result)).toEqual(['elem-1']);
    expect(result['elem-1']).toEqual({ widthMm: 500 });
  });
});

describe('validateFamilyParameters — §15.1.3', () => {
  it('returns no errors for valid unique parameters', () => {
    const params = [
      makeParam({ id: 'p1', name: 'Width' }),
      makeParam({ id: 'p2', name: 'Height' }),
    ];
    expect(validateFamilyParameters(params)).toEqual([]);
  });

  it('returns error for duplicate names', () => {
    const params = [makeParam({ id: 'p1', name: 'Width' }), makeParam({ id: 'p2', name: 'Width' })];
    const errors = validateFamilyParameters(params);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Duplicate parameter name');
  });

  it('returns error for empty name', () => {
    const params = [makeParam({ id: 'p1', name: '' })];
    const errors = validateFamilyParameters(params);
    expect(errors.some((e) => e.includes('empty'))).toBe(true);
  });
});
