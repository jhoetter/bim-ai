import type { Element } from '@bim-ai/core';

import {
  FAMILY_EDITOR_CATEGORY_PARAM,
  FAMILY_EDITOR_DEFINITION_PARAM,
} from '../familyEditor/familyEditorPersistence';
import type { FamilyLibraryPlaceKind } from './familyPlacementAdapters';
import type {
  FamilyDefinition,
  FamilyDefinitionCategory,
  FamilyDefinitionCategorySettings,
  FamilyGeometryNode,
  FamilyParamDef,
  FamilySymbolicLine,
} from './types';

export type FamilyReloadOverwriteOption = 'keep-existing-values' | 'overwrite-parameter-values';

export interface CatalogFamilyTypeCommand extends Record<string, unknown> {
  type: 'upsertFamilyType';
  id: string;
  name: string;
  familyId: string;
  discipline: 'door' | 'window' | 'generic';
  parameters: Record<string, unknown>;
  catalogSource: {
    catalogId: string;
    familyId: string;
    version: string;
  };
}

export interface CatalogFamilyLoadPlan {
  command: CatalogFamilyTypeCommand;
  kind: FamilyLibraryPlaceKind;
  typeId: string;
  reloaded: boolean;
  overwriteOption: FamilyReloadOverwriteOption | null;
}

export type CatalogLoadedFamilyType = Extract<Element, { kind: 'family_type' }>;

export interface CatalogFamilyReloadPlacement {
  catalogId: string;
  catalogVersion: string;
  family: {
    id: string;
    name?: string;
    discipline: 'door' | 'window' | 'generic' | string;
    categorySettings?: FamilyDefinitionCategorySettings;
    params?: FamilyParamDef[];
    defaultTypes?: Array<{
      id: string;
      name: string;
      familyId: string;
      discipline: 'door' | 'window' | 'generic' | string;
      parameters: Record<string, unknown>;
    }>;
    geometry?: FamilyGeometryNode[];
    symbolicLines?: FamilySymbolicLine[];
    nestedDefinitions?: FamilyDefinition[];
  };
  defaultType: {
    id?: string;
    name: string;
    familyId?: string;
    discipline?: 'door' | 'window' | 'generic' | string;
    parameters: Record<string, unknown>;
  };
}

export function findLoadedCatalogFamilyType(
  elementsById: Record<string, Element>,
  placement: CatalogFamilyReloadPlacement,
): CatalogLoadedFamilyType | null {
  for (const element of Object.values(elementsById)) {
    if (
      element.kind === 'family_type' &&
      element.catalogSource?.catalogId === placement.catalogId &&
      element.catalogSource.familyId === placement.family.id
    ) {
      return element;
    }
  }
  return null;
}

export function planCatalogFamilyLoad(
  placement: CatalogFamilyReloadPlacement,
  elementsById: Record<string, Element>,
  options: {
    now?: number;
    overwriteOption?: FamilyReloadOverwriteOption;
  } = {},
): CatalogFamilyLoadPlan {
  const existing = findLoadedCatalogFamilyType(elementsById, placement);
  const overwriteOption = existing ? (options.overwriteOption ?? 'keep-existing-values') : null;
  const kind: FamilyLibraryPlaceKind =
    placement.family.discipline === 'door' || placement.family.discipline === 'window'
      ? placement.family.discipline
      : 'component_family';
  const discipline =
    placement.family.discipline === 'door' || placement.family.discipline === 'window'
      ? placement.family.discipline
      : 'generic';
  const typeId = existing?.id ?? newCatalogFamilyTypeId(placement, options.now ?? Date.now());
  const defaultParameters = {
    name: placement.defaultType.name,
    familyId: placement.family.id,
    [FAMILY_EDITOR_CATEGORY_PARAM]: inferCatalogFamilyCategory(placement),
    [FAMILY_EDITOR_DEFINITION_PARAM]: catalogFamilyDefinition(placement, discipline),
    ...placement.defaultType.parameters,
  };
  const parameters: Record<string, unknown> =
    existing && overwriteOption === 'keep-existing-values'
      ? {
          ...defaultParameters,
          ...existing.parameters,
          familyId: placement.family.id,
          [FAMILY_EDITOR_CATEGORY_PARAM]:
            existing.parameters[FAMILY_EDITOR_CATEGORY_PARAM] ??
            defaultParameters[FAMILY_EDITOR_CATEGORY_PARAM],
          [FAMILY_EDITOR_DEFINITION_PARAM]: defaultParameters[FAMILY_EDITOR_DEFINITION_PARAM],
        }
      : defaultParameters;

  return {
    command: {
      type: 'upsertFamilyType',
      id: typeId,
      name: String(parameters.name ?? placement.defaultType.name),
      familyId: placement.family.id,
      discipline,
      parameters,
      catalogSource: {
        catalogId: placement.catalogId,
        familyId: placement.family.id,
        version: placement.catalogVersion,
      },
    },
    kind,
    typeId,
    reloaded: existing !== null,
    overwriteOption,
  };
}

function normalizeFamilyDiscipline(value: string): 'door' | 'window' | 'generic' {
  return value === 'door' || value === 'window' ? value : 'generic';
}

function inferCatalogFamilyCategory(
  placement: CatalogFamilyReloadPlacement,
): FamilyDefinitionCategory {
  if (placement.family.categorySettings?.category)
    return placement.family.categorySettings.category;
  if (placement.family.discipline === 'door' || placement.family.discipline === 'window') {
    return placement.family.discipline;
  }
  const text =
    `${placement.catalogId} ${placement.family.id} ${placement.family.name ?? ''}`.toLowerCase();
  if (
    text.includes('bath') ||
    text.includes('bathroom') ||
    text.includes('plumbing') ||
    text.includes('toilet') ||
    text.includes('wc') ||
    text.includes('basin') ||
    text.includes('washbasin') ||
    text.includes('shower') ||
    text.includes('tub')
  ) {
    return 'generic_model';
  }
  if (
    text.includes('kitchen') ||
    text.includes('appliance') ||
    text.includes('fridge') ||
    text.includes('oven') ||
    text.includes('sink')
  ) {
    return 'generic_model';
  }
  if (text.includes('casework') || text.includes('counter') || text.includes('cabinet')) {
    return 'generic_model';
  }
  if (
    text.includes('furniture') ||
    text.includes('living-room') ||
    text.includes('sofa') ||
    text.includes('chair') ||
    text.includes('table')
  ) {
    return 'furniture';
  }
  return 'generic_model';
}

function catalogFamilyDefinition(
  placement: CatalogFamilyReloadPlacement,
  discipline: 'door' | 'window' | 'generic',
): FamilyDefinition {
  const category = inferCatalogFamilyCategory(placement);
  const categorySettings: FamilyDefinitionCategorySettings = placement.family.categorySettings ?? {
    category,
    alwaysVertical: true,
    workPlaneBased: false,
    roomCalculationPoint: category === 'furniture',
    shared: false,
  };
  const defaultTypes = (
    placement.family.defaultTypes?.length
      ? placement.family.defaultTypes
      : [
          {
            id: placement.defaultType.id ?? `${placement.family.id}:default`,
            name: placement.defaultType.name,
            familyId: placement.defaultType.familyId ?? placement.family.id,
            discipline: placement.defaultType.discipline ?? discipline,
            parameters: placement.defaultType.parameters,
          },
        ]
  ).map((type) => ({
    id: type.id,
    name: type.name,
    familyId: type.familyId,
    discipline: normalizeFamilyDiscipline(type.discipline),
    parameters: cloneSerializable(type.parameters),
    isBuiltIn: true as const,
  }));

  return {
    id: placement.family.id,
    name: placement.family.name ?? placement.defaultType.name,
    discipline,
    categorySettings,
    params: cloneSerializable(placement.family.params ?? []),
    defaultTypes,
    ...(placement.family.geometry?.length
      ? { geometry: cloneSerializable(placement.family.geometry) }
      : {}),
    ...(placement.family.symbolicLines?.length
      ? { symbolicLines: cloneSerializable(placement.family.symbolicLines) }
      : {}),
    ...(placement.family.nestedDefinitions?.length
      ? { nestedDefinitions: cloneSerializable(placement.family.nestedDefinitions) }
      : {}),
  };
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newCatalogFamilyTypeId(placement: CatalogFamilyReloadPlacement, now: number): string {
  const safeFamId = placement.family.id.replace(/[^A-Za-z0-9_-]/g, '_');
  return `ft-${safeFamId}-${now.toString(36)}`;
}
