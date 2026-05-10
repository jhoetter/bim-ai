import { describe, expect, it } from 'vitest';

import { getFamilyPlacementAdapter, placeKindForFamilyDiscipline } from './familyPlacementAdapters';

describe('family placement adapters', () => {
  it('keeps doors and windows as hosted wall-opening semantics', () => {
    expect(getFamilyPlacementAdapter('door')).toMatchObject({
      mode: 'hosted-wall-opening',
      semanticInstanceKind: 'door',
      planTool: 'door',
      hostRequirement: 'wall',
      identifierRole: 'familyTypeId',
    });
    expect(getFamilyPlacementAdapter('window')).toMatchObject({
      mode: 'hosted-wall-opening',
      semanticInstanceKind: 'window',
      planTool: 'window',
      hostRequirement: 'wall',
      identifierRole: 'familyTypeId',
    });
  });

  it('keeps interior assets as free placed components with asset ids', () => {
    expect(getFamilyPlacementAdapter('asset')).toMatchObject({
      mode: 'free-component',
      semanticInstanceKind: 'placed_asset',
      planTool: 'component',
      hostRequirement: 'none',
      identifierRole: 'assetId',
    });
  });

  it('maps family disciplines to explicit placement adapters', () => {
    expect(placeKindForFamilyDiscipline('door')).toBe('door');
    expect(placeKindForFamilyDiscipline('window')).toBe('window');
    expect(placeKindForFamilyDiscipline('generic')).toBe('component_family');
  });
});
