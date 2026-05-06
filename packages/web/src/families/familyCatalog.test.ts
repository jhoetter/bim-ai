import { describe, expect, it } from 'vitest';

import { BUILT_IN_FAMILIES, getFamilyById, getTypeById } from './familyCatalog';

describe('getFamilyById', () => {
  it('returns the family for a known id', () => {
    const family = getFamilyById('builtin:door:single');
    expect(family).toBeDefined();
    expect(family?.name).toBe('Single Leaf Door');
    expect(family?.discipline).toBe('door');
  });

  it('returns undefined for an unknown id', () => {
    expect(getFamilyById('unknown:id')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getFamilyById('')).toBeUndefined();
  });

  it('returns the double door family', () => {
    const family = getFamilyById('builtin:door:double');
    expect(family).toBeDefined();
    expect(family?.discipline).toBe('door');
  });

  it('returns a window family', () => {
    const family = getFamilyById('builtin:window:casement');
    expect(family).toBeDefined();
    expect(family?.discipline).toBe('window');
  });
});

describe('getTypeById', () => {
  it('returns the type for a known type id', () => {
    const type = getTypeById('builtin:door:single:900x2100');
    expect(type).toBeDefined();
    expect(type?.name).toBe('Single 900×2100');
    expect(type?.familyId).toBe('builtin:door:single');
  });

  it('returns undefined for an unknown type id', () => {
    expect(getTypeById('unknown:type:id')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getTypeById('')).toBeUndefined();
  });

  it('resolves a type from a non-door family', () => {
    const stairFamily = getFamilyById('builtin:stair:straight');
    const firstTypeId = stairFamily?.defaultTypes[0]?.id;
    if (firstTypeId) {
      const type = getTypeById(firstTypeId);
      expect(type).toBeDefined();
      expect(type?.familyId).toBe('builtin:stair:straight');
    }
  });
});

describe('BUILT_IN_FAMILIES', () => {
  it('contains at least one door family', () => {
    const doors = BUILT_IN_FAMILIES.filter((f) => f.discipline === 'door');
    expect(doors.length).toBeGreaterThan(0);
  });

  it('contains at least one window family', () => {
    const windows = BUILT_IN_FAMILIES.filter((f) => f.discipline === 'window');
    expect(windows.length).toBeGreaterThan(0);
  });

  it('all families have unique ids', () => {
    const ids = BUILT_IN_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all defaultTypes have unique ids across all families', () => {
    const typeIds = BUILT_IN_FAMILIES.flatMap((f) => f.defaultTypes.map((t) => t.id));
    expect(new Set(typeIds).size).toBe(typeIds.length);
  });

  it('each defaultType references its parent familyId', () => {
    for (const family of BUILT_IN_FAMILIES) {
      for (const type of family.defaultTypes) {
        expect(type.familyId).toBe(family.id);
      }
    }
  });

  it('each defaultType is marked isBuiltIn', () => {
    for (const family of BUILT_IN_FAMILIES) {
      for (const type of family.defaultTypes) {
        expect(type.isBuiltIn).toBe(true);
      }
    }
  });
});
