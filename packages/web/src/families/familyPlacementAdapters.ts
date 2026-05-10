import type { AssetCategory, FamilyDiscipline } from '@bim-ai/core';

import type { PlanTool } from '../state/storeTypes';

export type FamilyLibraryPlaceKind =
  | 'asset'
  | 'component_family'
  | 'door'
  | 'window'
  | 'stair'
  | 'railing'
  | 'wall_type'
  | 'floor_type'
  | 'roof_type';

export type FamilyPlacementMode =
  | 'free-component'
  | 'hosted-wall-opening'
  | 'path-or-level-system'
  | 'type-driven-system'
  | 'staged-workbench';

export interface FamilyPlacementAdapter {
  kind: FamilyLibraryPlaceKind;
  label: string;
  mode: FamilyPlacementMode;
  semanticInstanceKind:
    | 'door'
    | 'window'
    | 'stair'
    | 'railing'
    | 'wall'
    | 'floor'
    | 'roof'
    | 'placed_asset'
    | 'family_type_component';
  planTool?: PlanTool;
  hostRequirement?: 'wall' | 'level' | 'path' | 'none';
  identifierRole: 'familyTypeId' | 'assetId';
}

export const FAMILY_PLACEMENT_ADAPTERS: Record<FamilyLibraryPlaceKind, FamilyPlacementAdapter> = {
  door: {
    kind: 'door',
    label: 'Door',
    mode: 'hosted-wall-opening',
    semanticInstanceKind: 'door',
    planTool: 'door',
    hostRequirement: 'wall',
    identifierRole: 'familyTypeId',
  },
  window: {
    kind: 'window',
    label: 'Window',
    mode: 'hosted-wall-opening',
    semanticInstanceKind: 'window',
    planTool: 'window',
    hostRequirement: 'wall',
    identifierRole: 'familyTypeId',
  },
  stair: {
    kind: 'stair',
    label: 'Stair',
    mode: 'path-or-level-system',
    semanticInstanceKind: 'stair',
    hostRequirement: 'level',
    identifierRole: 'familyTypeId',
  },
  railing: {
    kind: 'railing',
    label: 'Railing',
    mode: 'path-or-level-system',
    semanticInstanceKind: 'railing',
    hostRequirement: 'path',
    identifierRole: 'familyTypeId',
  },
  wall_type: {
    kind: 'wall_type',
    label: 'Wall Type',
    mode: 'type-driven-system',
    semanticInstanceKind: 'wall',
    planTool: 'wall',
    hostRequirement: 'none',
    identifierRole: 'familyTypeId',
  },
  floor_type: {
    kind: 'floor_type',
    label: 'Floor Type',
    mode: 'type-driven-system',
    semanticInstanceKind: 'floor',
    planTool: 'floor',
    hostRequirement: 'none',
    identifierRole: 'familyTypeId',
  },
  roof_type: {
    kind: 'roof_type',
    label: 'Roof Type',
    mode: 'type-driven-system',
    semanticInstanceKind: 'roof',
    hostRequirement: 'none',
    identifierRole: 'familyTypeId',
  },
  asset: {
    kind: 'asset',
    label: 'Interior Component',
    mode: 'free-component',
    semanticInstanceKind: 'placed_asset',
    planTool: 'component',
    hostRequirement: 'none',
    identifierRole: 'assetId',
  },
  component_family: {
    kind: 'component_family',
    label: 'Component Family',
    mode: 'free-component',
    semanticInstanceKind: 'family_type_component',
    hostRequirement: 'none',
    identifierRole: 'familyTypeId',
  },
};

export const ASSET_CATEGORY_FAMILY_GROUPS: { id: AssetCategory; label: string }[] = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'kitchen', label: 'Appliances' },
  { id: 'casework', label: 'Casework' },
  { id: 'bathroom', label: 'Plumbing Fixtures' },
  { id: 'door', label: 'Door Components' },
  { id: 'window', label: 'Window Components' },
  { id: 'decal', label: 'Decals' },
  { id: 'profile', label: 'Profiles' },
];

export function getFamilyPlacementAdapter(kind: FamilyLibraryPlaceKind): FamilyPlacementAdapter {
  return FAMILY_PLACEMENT_ADAPTERS[kind];
}

export function placeKindForFamilyDiscipline(discipline: FamilyDiscipline): FamilyLibraryPlaceKind {
  switch (discipline) {
    case 'door':
    case 'window':
    case 'stair':
    case 'railing':
    case 'wall_type':
    case 'floor_type':
    case 'roof_type':
      return discipline;
    case 'generic':
    case 'column':
    case 'beam':
      return 'component_family';
  }
}
