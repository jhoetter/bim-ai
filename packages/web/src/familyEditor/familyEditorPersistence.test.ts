import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  FAMILY_EDITOR_DEFINITION_PARAM,
  FAMILY_EDITOR_DOCUMENT_PARAM,
  buildAuthoredFamilyDefinition,
  planAuthoredFamilyLoad,
  readAuthoredFamilyCatalog,
  upsertAuthoredFamilyCatalogDocument,
  writeAuthoredFamilyCatalog,
  type AuthoredFamilyDocument,
} from './familyEditorPersistence';

const BASE_DOCUMENT: AuthoredFamilyDocument = {
  id: 'fam:casework:bench',
  name: 'Parametric Bench',
  template: 'furniture',
  categorySettings: {
    category: 'furniture',
    alwaysVertical: false,
    workPlaneBased: false,
    roomCalculationPoint: false,
    shared: false,
  },
  viewRange: {
    topOffsetMm: 2300,
    cutPlaneOffsetMm: 1200,
    bottomOffsetMm: 0,
    viewDepthOffsetMm: -1200,
  },
  refPlanes: [
    {
      id: 'center-left-right',
      name: 'Center Left/Right',
      isVertical: true,
      offsetMm: 0,
      isSymmetryRef: true,
    },
  ],
  params: [
    {
      key: 'Width',
      label: 'Width',
      type: 'length_mm',
      default: 1200,
      formula: '',
    },
    {
      key: 'ShowSeat',
      label: 'Show Seat',
      type: 'boolean',
      default: true,
      formula: '',
    },
  ],
  familyTypes: [
    {
      id: 'family-type-1',
      name: '1200 Bench',
      values: { Width: 1200 },
    },
  ],
  activeFamilyTypeId: 'family-type-1',
  sweeps: [
    {
      kind: 'sweep',
      pathLines: [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 1200, yMm: 0 } }],
      profile: [
        { startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 40, yMm: 0 } },
        { startMm: { xMm: 40, yMm: 0 }, endMm: { xMm: 40, yMm: 40 } },
        { startMm: { xMm: 40, yMm: 40 }, endMm: { xMm: 0, yMm: 0 } },
      ],
      profilePlane: 'work_plane',
      visibilityBinding: { paramName: 'ShowSeat', whenTrue: true },
    },
  ],
  arrays: [],
  nestedInstances: [],
  symbolicLines: [],
  dimensions: [],
  eqConstraints: [],
  savedAt: 1000,
  version: 'family-editor-1000',
};

function memoryStorage() {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe('family editor persistence planning', () => {
  it('saves and reads authored family documents from the editor catalog', () => {
    const storage = memoryStorage();
    const catalog = upsertAuthoredFamilyCatalogDocument([], BASE_DOCUMENT);

    writeAuthoredFamilyCatalog(catalog, storage);

    expect(readAuthoredFamilyCatalog(storage)).toEqual([BASE_DOCUMENT]);
  });

  it('builds a loadable FamilyDefinition from editor state', () => {
    const definition = buildAuthoredFamilyDefinition(BASE_DOCUMENT);

    expect(definition).toMatchObject({
      id: 'fam:casework:bench',
      name: 'Parametric Bench',
      discipline: 'generic',
      defaultTypes: [{ name: '1200 Bench', parameters: { Width: 1200 } }],
    });
    expect(definition.params).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'Width', default: 1200 })]),
    );
    expect(definition.geometry?.[0]).toMatchObject({
      kind: 'sweep',
      visibilityBinding: { paramName: 'ShowSeat', whenTrue: true },
    });
  });

  it('plans project family_type creation with embedded authored document and definition', () => {
    const plan = planAuthoredFamilyLoad(BASE_DOCUMENT, {}, { now: 2000 });

    expect(plan.reloaded).toBe(false);
    expect(plan.typeId).toBe('ft-fam_casework_bench-1jk');
    expect(plan.command).toMatchObject({
      type: 'upsertFamilyType',
      id: 'ft-fam_casework_bench-1jk',
      name: '1200 Bench',
      familyId: 'fam:casework:bench',
      discipline: 'generic',
    });
    expect(plan.command.parameters[FAMILY_EDITOR_DOCUMENT_PARAM]).toMatchObject({
      id: 'fam:casework:bench',
    });
    expect(plan.command.parameters[FAMILY_EDITOR_DEFINITION_PARAM]).toMatchObject({
      id: 'fam:casework:bench',
    });
  });

  it('keeps existing project parameter values when reloading by default', () => {
    const existing: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-existing-bench',
      name: 'Existing Bench',
      familyId: 'fam:casework:bench',
      discipline: 'generic',
      parameters: {
        name: 'Existing Bench',
        familyId: 'fam:casework:bench',
        Width: 1800,
        [FAMILY_EDITOR_DOCUMENT_PARAM]: BASE_DOCUMENT,
      },
    };

    const plan = planAuthoredFamilyLoad(BASE_DOCUMENT, { [existing.id]: existing });

    expect(plan.reloaded).toBe(true);
    expect(plan.typeId).toBe('ft-existing-bench');
    expect(plan.overwriteOption).toBe('keep-existing-values');
    expect(plan.command.parameters.Width).toBe(1800);
    expect(plan.command.parameters[FAMILY_EDITOR_DEFINITION_PARAM]).toMatchObject({
      id: 'fam:casework:bench',
    });
  });

  it('overwrites existing project parameter values when requested', () => {
    const existing: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-existing-bench',
      name: 'Existing Bench',
      familyId: 'fam:casework:bench',
      discipline: 'generic',
      parameters: {
        name: 'Existing Bench',
        familyId: 'fam:casework:bench',
        Width: 1800,
        [FAMILY_EDITOR_DOCUMENT_PARAM]: BASE_DOCUMENT,
      },
    };

    const plan = planAuthoredFamilyLoad(
      BASE_DOCUMENT,
      { [existing.id]: existing },
      {
        overwriteOption: 'overwrite-parameter-values',
      },
    );

    expect(plan.reloaded).toBe(true);
    expect(plan.command.parameters.Width).toBe(1200);
    expect(plan.command.parameters.name).toBe('1200 Bench');
  });
});
