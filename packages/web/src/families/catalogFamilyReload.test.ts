import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import type { ExternalCatalogPlacement } from './FamilyLibraryPanel';
import { findLoadedCatalogFamilyType, planCatalogFamilyLoad } from './catalogFamilyReload';

const PLACEMENT: ExternalCatalogPlacement = {
  catalogId: 'living-room-furniture',
  catalogName: 'Living Room Furniture',
  catalogVersion: '2.0.0',
  family: {
    id: 'catalog:living-room:sofa-3-seat',
    name: '3-Seat Sofa',
    discipline: 'generic',
    defaultTypes: [],
  },
  defaultType: {
    id: 'catalog:living-room:sofa-3-seat:standard',
    name: 'Standard 3-Seat 2200x950',
    familyId: 'catalog:living-room:sofa-3-seat',
    discipline: 'generic',
    parameters: { widthMm: 2200, depthMm: 950 },
  },
};

const EXISTING_TYPE: Extract<Element, { kind: 'family_type' }> = {
  kind: 'family_type',
  id: 'ft-sofa-loaded',
  name: 'Project sofa type',
  familyId: 'catalog:living-room:sofa-3-seat',
  discipline: 'generic',
  parameters: {
    name: 'Project sofa type',
    familyId: 'catalog:living-room:sofa-3-seat',
    widthMm: 2400,
    depthMm: 1000,
  },
  catalogSource: {
    catalogId: 'living-room-furniture',
    familyId: 'catalog:living-room:sofa-3-seat',
    version: '1.0.0',
  },
};

describe('catalog family reload planning', () => {
  it('creates a new family_type command when the catalog family is not loaded', () => {
    const plan = planCatalogFamilyLoad(PLACEMENT, {}, { now: 1000 });

    expect(plan.reloaded).toBe(false);
    expect(plan.typeId).toBe('ft-catalog_living-room_sofa-3-seat-rs');
    expect(plan.command.parameters).toMatchObject({
      name: 'Standard 3-Seat 2200x950',
      familyId: 'catalog:living-room:sofa-3-seat',
      widthMm: 2200,
      depthMm: 950,
    });
  });

  it('keeps existing project parameter values when reloading without parameter overwrite', () => {
    const plan = planCatalogFamilyLoad(
      PLACEMENT,
      { [EXISTING_TYPE.id]: EXISTING_TYPE },
      { overwriteOption: 'keep-existing-values' },
    );

    expect(plan.reloaded).toBe(true);
    expect(plan.typeId).toBe('ft-sofa-loaded');
    expect(plan.command.catalogSource.version).toBe('2.0.0');
    expect(plan.command.parameters).toMatchObject({
      name: 'Project sofa type',
      familyId: 'catalog:living-room:sofa-3-seat',
      widthMm: 2400,
      depthMm: 1000,
    });
  });

  it('resets project parameter values to catalog defaults when requested', () => {
    const plan = planCatalogFamilyLoad(
      PLACEMENT,
      { [EXISTING_TYPE.id]: EXISTING_TYPE },
      { overwriteOption: 'overwrite-parameter-values' },
    );

    expect(plan.reloaded).toBe(true);
    expect(plan.typeId).toBe('ft-sofa-loaded');
    expect(plan.command.parameters).toMatchObject({
      name: 'Standard 3-Seat 2200x950',
      familyId: 'catalog:living-room:sofa-3-seat',
      widthMm: 2200,
      depthMm: 950,
    });
  });

  it('finds loaded catalog families by catalog provenance rather than type id', () => {
    const found = findLoadedCatalogFamilyType({ [EXISTING_TYPE.id]: EXISTING_TYPE }, PLACEMENT);

    expect(found?.id).toBe('ft-sofa-loaded');
  });
});
