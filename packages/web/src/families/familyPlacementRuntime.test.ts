import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  FAMILY_EDITOR_CATEGORY_PARAM,
  FAMILY_EDITOR_CATEGORY_SETTINGS_PARAM,
  FAMILY_EDITOR_DEFINITION_PARAM,
} from '../familyEditor/familyEditorPersistence';
import {
  familyInstanceProjectCategoryKey,
  familyTypeAuthoredCategory,
  familyTypePlacesAsDetailComponent,
  familyTypeProjectCategoryKey,
  familyTypeProjectCategoryLabel,
} from './familyPlacementRuntime';

describe('familyPlacementRuntime authored categories', () => {
  it('reads persisted category settings from loaded family_type metadata', () => {
    const furnitureType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-chair',
      name: 'Chair Type',
      familyId: 'fam-chair',
      discipline: 'generic',
      parameters: {
        [FAMILY_EDITOR_CATEGORY_PARAM]: 'furniture',
        [FAMILY_EDITOR_CATEGORY_SETTINGS_PARAM]: {
          category: 'furniture',
          shared: false,
        },
      },
    };

    expect(familyTypeAuthoredCategory(furnitureType)).toBe('furniture');
    expect(familyTypeProjectCategoryKey(furnitureType)).toBe('furniture');
    expect(familyTypeProjectCategoryLabel(furnitureType)).toBe('Furniture');
  });

  it('falls back to embedded definition category settings and maps project instances', () => {
    const detailType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-symbol',
      name: 'Symbol Type',
      familyId: 'fam-symbol',
      discipline: 'generic',
      parameters: {
        [FAMILY_EDITOR_DEFINITION_PARAM]: {
          id: 'fam-symbol',
          name: 'Symbol',
          discipline: 'generic',
          categorySettings: { category: 'detail_component' },
          params: [],
          defaultTypes: [],
        },
      },
    };
    const instance: Extract<Element, { kind: 'family_instance' }> = {
      kind: 'family_instance',
      id: 'fi-symbol',
      name: 'Symbol 1',
      familyTypeId: 'ft-symbol',
      hostViewId: 'pv',
      positionMm: { xMm: 0, yMm: 0 },
    };

    expect(familyTypePlacesAsDetailComponent(detailType)).toBe(true);
    expect(
      familyInstanceProjectCategoryKey(instance, {
        'ft-symbol': detailType,
        'fi-symbol': instance,
      }),
    ).toBe('detail_component');
  });
});
