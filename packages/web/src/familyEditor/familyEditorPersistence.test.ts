import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  FAMILY_EDITOR_CATEGORY_PARAM,
  FAMILY_EDITOR_CATEGORY_SETTINGS_PARAM,
  FAMILY_EDITOR_DEFINITION_PARAM,
  FAMILY_EDITOR_DOCUMENT_PARAM,
  FAMILY_EDITOR_NESTED_FAMILY_DEFINITIONS_PARAM,
  FAMILY_EDITOR_NESTED_FAMILY_DOCUMENTS_PARAM,
  FAMILY_EDITOR_NESTED_FAMILY_IDS_PARAM,
  FAMILY_EDITOR_TYPE_ROW_ID_PARAM,
  buildAuthoredFamilyDefinition,
  collectNestedFamilyDependencies,
  planAuthoredFamilyLoad,
  readAuthoredFamilyCatalog,
  upsertAuthoredFamilyCatalogDocument,
  writeAuthoredFamilyCatalog,
  type AuthoredFamilyDocument,
} from './familyEditorPersistence';
import { resolveFamilyGeometry } from '../families/familyResolver';
import {
  buildFamilyTemplateMetadata,
  getFamilyTemplateBrowserEntry,
} from './familyTemplateCatalog';
import type { FamilyDefinition } from '../families/types';

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
      categorySettings: { category: 'furniture', workPlaneBased: false },
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
    const document: AuthoredFamilyDocument = {
      ...BASE_DOCUMENT,
      templateMetadata: buildFamilyTemplateMetadata(getFamilyTemplateBrowserEntry('furniture'), {
        originReferencePlaneIds: ['center-left-right'],
        referencePlaneIds: ['center-left-right'],
        defaultTypeNames: ['1200 Bench'],
      }),
    };
    const plan = planAuthoredFamilyLoad(document, {}, { now: 2000 });

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
      templateMetadata: {
        fileName: 'Metric Furniture.rft',
        hostType: 'standalone',
        category: 'furniture',
      },
    });
    expect(plan.command.parameters[FAMILY_EDITOR_DEFINITION_PARAM]).toMatchObject({
      id: 'fam:casework:bench',
      templateMetadata: {
        fileName: 'Metric Furniture.rft',
      },
    });
    expect(plan.command.parameters).toMatchObject({
      familyTemplateFileName: 'Metric Furniture.rft',
      familyTemplateHostType: 'standalone',
      familyTemplateCategory: 'furniture',
      familyTemplateOriginReferencePlaneIds: ['center-left-right'],
      [FAMILY_EDITOR_CATEGORY_PARAM]: 'furniture',
      [FAMILY_EDITOR_CATEGORY_SETTINGS_PARAM]: {
        category: 'furniture',
        shared: false,
      },
      familyVgCategory: 'loaded_family:furniture',
      familyTagCategory: 'furniture',
      [FAMILY_EDITOR_NESTED_FAMILY_IDS_PARAM]: [],
    });
    expect(plan.commands).toHaveLength(1);
    expect(plan.typeIds).toEqual(['ft-fam_casework_bench-1jk']);
  });

  it('embeds a transitive nested-family manifest for project reloads', () => {
    const childDocument: AuthoredFamilyDocument = {
      ...BASE_DOCUMENT,
      id: 'fam:chair:leg',
      name: 'Chair Leg',
      familyTypes: [{ id: 'family-type-1', name: 'Round Leg', values: { Width: 80 } }],
    };
    const childType: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-chair-leg',
      name: 'Round Leg',
      familyId: childDocument.id,
      discipline: 'generic',
      parameters: {
        name: 'Round Leg',
        familyId: childDocument.id,
        [FAMILY_EDITOR_DOCUMENT_PARAM]: childDocument,
        [FAMILY_EDITOR_DEFINITION_PARAM]: buildAuthoredFamilyDefinition(childDocument),
      },
    };
    const hostDocument: AuthoredFamilyDocument = {
      ...BASE_DOCUMENT,
      id: 'fam:chair:host',
      name: 'Nested Chair',
      nestedInstances: [
        {
          kind: 'family_instance_ref',
          familyId: childDocument.id,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };

    const plan = planAuthoredFamilyLoad(hostDocument, { [childType.id]: childType }, { now: 2000 });

    expect(plan.command.parameters[FAMILY_EDITOR_NESTED_FAMILY_IDS_PARAM]).toEqual([
      'fam:chair:leg',
    ]);
    expect(plan.command.parameters[FAMILY_EDITOR_NESTED_FAMILY_DEFINITIONS_PARAM]).toEqual([
      expect.objectContaining({ id: 'fam:chair:leg', name: 'Chair Leg' }),
    ]);
    expect(plan.command.parameters[FAMILY_EDITOR_DEFINITION_PARAM]).toEqual(
      expect.objectContaining({
        id: 'fam:chair:host',
        nestedDefinitions: [expect.objectContaining({ id: 'fam:chair:leg' })],
      }),
    );
    expect(plan.command.parameters[FAMILY_EDITOR_NESTED_FAMILY_DOCUMENTS_PARAM]).toEqual([
      expect.objectContaining({ id: 'fam:chair:leg', name: 'Chair Leg' }),
    ]);
  });

  it('persists nested dependencies on authored documents so project resolution can reload them', () => {
    const childDocument: AuthoredFamilyDocument = {
      ...BASE_DOCUMENT,
      id: 'fam:window:glass',
      name: 'Glass Panel',
    };
    const hostDocument: AuthoredFamilyDocument = {
      ...BASE_DOCUMENT,
      id: 'fam:window:host',
      name: 'Nested Window',
      nestedInstances: [
        {
          kind: 'family_instance_ref',
          familyId: childDocument.id,
          positionMm: { xMm: 25, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
    };
    const nestedFamilyDefinitions = collectNestedFamilyDependencies(hostDocument, [
      buildAuthoredFamilyDefinition(childDocument),
    ]);
    const hostDefinition = buildAuthoredFamilyDefinition({
      ...hostDocument,
      nestedFamilyDefinitions,
    });

    expect(hostDefinition.nestedDefinitions).toEqual([
      expect.objectContaining({ id: 'fam:window:glass' }),
    ]);
    const group = resolveFamilyGeometry(
      hostDefinition.id,
      {},
      { [hostDefinition.id]: hostDefinition },
    );
    expect(group.children.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps existing nested parameter defaults on reload unless parameter overwrite is requested', () => {
    const oldChildDocument: AuthoredFamilyDocument = {
      ...BASE_DOCUMENT,
      id: 'fam:window:glass',
      name: 'Glass Panel',
      params: [{ ...BASE_DOCUMENT.params[0]!, default: 6 }],
      familyTypes: [{ id: 'family-type-1', name: '6 mm', values: { Width: 6 } }],
    };
    const newChildDocument: AuthoredFamilyDocument = {
      ...oldChildDocument,
      params: [{ ...oldChildDocument.params[0]!, default: 12 }],
      familyTypes: [{ id: 'family-type-1', name: '12 mm', values: { Width: 12 } }],
    };
    const oldHostDocument: AuthoredFamilyDocument = {
      ...BASE_DOCUMENT,
      id: 'fam:window:host',
      name: 'Nested Window',
      nestedInstances: [
        {
          kind: 'family_instance_ref',
          familyId: oldChildDocument.id,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          parameterBindings: {},
        },
      ],
      nestedFamilyDefinitions: [buildAuthoredFamilyDefinition(oldChildDocument)],
    };
    const newHostDocument: AuthoredFamilyDocument = {
      ...oldHostDocument,
      nestedFamilyDefinitions: [buildAuthoredFamilyDefinition(newChildDocument)],
      savedAt: 2000,
      version: 'family-editor-2000',
    };
    const existing: Extract<Element, { kind: 'family_type' }> = {
      kind: 'family_type',
      id: 'ft-existing-window',
      name: 'Existing Window',
      familyId: oldHostDocument.id,
      discipline: 'generic',
      parameters: {
        name: 'Existing Window',
        familyId: oldHostDocument.id,
        [FAMILY_EDITOR_DOCUMENT_PARAM]: oldHostDocument,
        [FAMILY_EDITOR_DEFINITION_PARAM]: buildAuthoredFamilyDefinition(oldHostDocument),
      },
    };

    const keep = planAuthoredFamilyLoad(newHostDocument, { [existing.id]: existing });
    const overwrite = planAuthoredFamilyLoad(
      newHostDocument,
      { [existing.id]: existing },
      {
        overwriteOption: 'overwrite-parameter-values',
      },
    );

    expect(
      (
        keep.command.parameters[FAMILY_EDITOR_DEFINITION_PARAM] as {
          nestedDefinitions: FamilyDefinition[];
        }
      ).nestedDefinitions[0]!.params[0]!.default,
    ).toBe(6);
    expect(
      (
        overwrite.command.parameters[FAMILY_EDITOR_DEFINITION_PARAM] as {
          nestedDefinitions: FamilyDefinition[];
        }
      ).nestedDefinitions[0]!.params[0]!.default,
    ).toBe(12);
  });

  it('plans every authored family type row as a project family_type catalog entry', () => {
    const document: AuthoredFamilyDocument = {
      ...BASE_DOCUMENT,
      familyTypes: [
        { id: 'family-type-1', name: '1200 Bench', values: { Width: 1200 } },
        { id: 'family-type-2', name: '1800 Bench', values: { Width: 1800 } },
      ],
      activeFamilyTypeId: 'family-type-2',
    };

    const plan = planAuthoredFamilyLoad(document, {}, { now: 2000 });

    expect(plan.commands.map((command) => command.name)).toEqual(['1200 Bench', '1800 Bench']);
    expect(plan.typeId).toBe('ft-fam_casework_bench-family-type-2-1jk');
    expect(plan.typeIds).toEqual([
      'ft-fam_casework_bench-family-type-1-1jk',
      'ft-fam_casework_bench-family-type-2-1jk',
    ]);
    expect(plan.commands[0]!.parameters).toMatchObject({
      Width: 1200,
      [FAMILY_EDITOR_TYPE_ROW_ID_PARAM]: 'family-type-1',
    });
    expect(plan.commands[1]!.parameters).toMatchObject({
      Width: 1800,
      [FAMILY_EDITOR_TYPE_ROW_ID_PARAM]: 'family-type-2',
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
