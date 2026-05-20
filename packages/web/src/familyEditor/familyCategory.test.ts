import { describe, expect, it } from 'vitest';
import { FAMILY_CATEGORIES } from './familyCategories';

type FamilyDefinitionFixture = { kind: 'family_definition'; id: string; categoryKey?: string };

describe('Family category assignment — §15.1.2', () => {
  it('FAMILY_CATEGORIES has expected entries', () => {
    const keys = FAMILY_CATEGORIES.map((c) => c.key);
    expect(keys).toContain('doors');
    expect(keys).toContain('windows');
    expect(keys).toContain('furniture');
    expect(keys).toContain('generic_models');
  });

  it('SetFamilyCategoryCmd has correct shape', () => {
    const cmd = { type: 'setFamilyCategory' as const, familyId: 'fam-01', categoryKey: 'windows' };
    expect(cmd.type).toBe('setFamilyCategory');
    expect(cmd.categoryKey).toBe('windows');
  });

  it('categoryKey defaults to undefined (uncategorized)', () => {
    const el: FamilyDefinitionFixture = { kind: 'family_definition', id: 'fam-01' };
    expect(el.categoryKey).toBeUndefined();
  });

  it('category label resolves from key', () => {
    const cat = FAMILY_CATEGORIES.find((c) => c.key === 'doors');
    expect(cat?.label).toBe('Doors');
  });
});
