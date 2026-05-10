import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  duplicateOpeningFamilyTypeCommand,
  duplicateTypePropertiesCommand,
} from './WorkspaceRightRail';

describe('duplicateTypePropertiesCommand', () => {
  it('duplicates custom family_type parameters and catalog provenance', () => {
    const source = {
      kind: 'family_type',
      id: 'ft-sofa-wide',
      name: 'Wide Sofa',
      familyId: 'catalog:sofa',
      discipline: 'generic',
      parameters: {
        name: 'Wide Sofa',
        widthMm: 2400,
        depthMm: 900,
      },
      catalogSource: {
        catalogId: 'living-room',
        familyId: 'sofa-3-seat',
        version: '1.0.0',
      },
    } satisfies Extract<Element, { kind: 'family_type' }>;

    expect(duplicateTypePropertiesCommand(source, 'ft-sofa-wide-copy')).toEqual({
      type: 'upsertFamilyType',
      id: 'ft-sofa-wide-copy',
      discipline: 'generic',
      parameters: {
        name: 'Wide Sofa Copy',
        widthMm: 2400,
        depthMm: 900,
      },
      catalogSource: {
        catalogId: 'living-room',
        familyId: 'sofa-3-seat',
        version: '1.0.0',
      },
    });
  });

  it('duplicates layered wall type assemblies for Edit Type workflows', () => {
    const source = {
      kind: 'wall_type',
      id: 'wt-core',
      name: 'Core Wall',
      basisLine: 'face_exterior',
      layers: [
        { function: 'finish_1', material: 'gypsum', thicknessMm: 12 },
        { function: 'structure', material: 'concrete', thicknessMm: 200 },
      ],
    } satisfies Extract<Element, { kind: 'wall_type' }>;

    expect(duplicateTypePropertiesCommand(source, 'wt-core-copy')).toEqual({
      type: 'upsertWallType',
      id: 'wt-core-copy',
      name: 'Core Wall Copy',
      basisLine: 'face_exterior',
      layers: [
        { function: 'finish_1', material: 'gypsum', thicknessMm: 12 },
        { function: 'structure', material: 'concrete', thicknessMm: 200 },
      ],
    });
  });

  it('duplicates built-in opening family types for selected door/window instances', () => {
    expect(
      duplicateOpeningFamilyTypeCommand('builtin:door:single:900x2100', 'door', {}, 'ft-door-copy'),
    ).toEqual({
      type: 'upsertFamilyType',
      id: 'ft-door-copy',
      discipline: 'door',
      parameters: {
        name: 'Single 900\u00d72100 Copy',
        familyId: 'builtin:door:single',
        leafWidthMm: 900,
        leafHeightMm: 2100,
      },
    });
  });
});
