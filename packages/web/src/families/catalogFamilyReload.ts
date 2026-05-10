import type { Element } from '@bim-ai/core';

import type { FamilyLibraryPlaceKind } from './familyPlacementAdapters';

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
    discipline: 'door' | 'window' | 'generic' | string;
  };
  defaultType: {
    name: string;
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
    ...placement.defaultType.parameters,
  };
  const parameters: Record<string, unknown> =
    existing && overwriteOption === 'keep-existing-values'
      ? {
          ...existing.parameters,
          familyId: placement.family.id,
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

function newCatalogFamilyTypeId(placement: CatalogFamilyReloadPlacement, now: number): string {
  const safeFamId = placement.family.id.replace(/[^A-Za-z0-9_-]/g, '_');
  return `ft-${safeFamId}-${now.toString(36)}`;
}
