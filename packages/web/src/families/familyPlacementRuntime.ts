import type { Element } from '@bim-ai/core';

import {
  FAMILY_EDITOR_CATEGORY_PARAM,
  FAMILY_EDITOR_DEFINITION_PARAM,
  FAMILY_EDITOR_DOCUMENT_PARAM,
  type AuthoredFamilyCategory,
} from '../familyEditor/familyEditorPersistence';

type FamilyTypeElement = Extract<Element, { kind: 'family_type' }>;
type FamilyInstanceElement = Extract<Element, { kind: 'family_instance' }>;

export type ProjectFamilyCategoryKey =
  | 'door'
  | 'window'
  | 'furniture'
  | 'generic_model'
  | 'detail_component'
  | 'family_instance';

const AUTHORED_CATEGORY_KEYS = new Set<AuthoredFamilyCategory>([
  'generic_model',
  'door',
  'window',
  'profile',
  'furniture',
  'detail_component',
]);

function normalizeAuthoredCategory(value: unknown): AuthoredFamilyCategory | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUTHORED_CATEGORY_KEYS.has(normalized as AuthoredFamilyCategory)
    ? (normalized as AuthoredFamilyCategory)
    : null;
}

function readParamString(type: FamilyTypeElement, keys: string[]): string {
  for (const key of keys) {
    const raw = type.parameters[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase();
  }
  return '';
}

function readAuthoredCategory(type: FamilyTypeElement): AuthoredFamilyCategory | null {
  const direct = type.parameters[FAMILY_EDITOR_CATEGORY_PARAM];
  const directCategory = normalizeAuthoredCategory(direct);
  if (directCategory) return directCategory;
  const settings = type.parameters.familyCategorySettings;
  if (settings && typeof settings === 'object') {
    const category = (settings as { category?: unknown }).category;
    const settingsCategory = normalizeAuthoredCategory(category);
    if (settingsCategory) return settingsCategory;
  }
  const definition = type.parameters[FAMILY_EDITOR_DEFINITION_PARAM];
  if (definition && typeof definition === 'object') {
    const category = (definition as { categorySettings?: { category?: unknown } }).categorySettings
      ?.category;
    const definitionCategory = normalizeAuthoredCategory(category);
    if (definitionCategory) return definitionCategory;
  }
  const raw = type.parameters[FAMILY_EDITOR_DOCUMENT_PARAM];
  if (!raw || typeof raw !== 'object') return null;
  const category = (raw as { categorySettings?: { category?: unknown } }).categorySettings
    ?.category;
  return normalizeAuthoredCategory(category);
}

function readEmbeddedHostType(type: FamilyTypeElement): string {
  const definition = type.parameters[FAMILY_EDITOR_DEFINITION_PARAM];
  if (definition && typeof definition === 'object') {
    const hostType = (definition as { templateMetadata?: { hostType?: unknown } }).templateMetadata
      ?.hostType;
    if (typeof hostType === 'string') return hostType.toLowerCase();
  }
  const document = type.parameters[FAMILY_EDITOR_DOCUMENT_PARAM];
  if (document && typeof document === 'object') {
    const hostType = (document as { templateMetadata?: { hostType?: unknown } }).templateMetadata
      ?.hostType;
    if (typeof hostType === 'string') return hostType.toLowerCase();
  }
  return '';
}

export function familyTypeRequiresWallHost(type: FamilyTypeElement | undefined): boolean {
  if (!type) return false;
  if (type.discipline === 'door' || type.discipline === 'window') return true;
  const embeddedHost = readEmbeddedHostType(type);
  if (embeddedHost === 'wall_hosted' || embeddedHost === 'wall-hosted') return true;
  const host = readParamString(type, ['hostRequirement', 'hostType', 'familyHostRequirement']);
  return host === 'wall' || host === 'wall_hosted' || host === 'wall-hosted';
}

export function familyTypePlacesAsDetailComponent(type: FamilyTypeElement | undefined): boolean {
  if (!type) return false;
  const category = readAuthoredCategory(type);
  if (category === 'detail_component') return true;
  const placement = readParamString(type, ['placementContext', 'familyPlacementContext']);
  return placement === 'detail' || placement === 'annotation' || placement === 'detail_component';
}

export function familyTypeAuthoredCategory(
  type: FamilyTypeElement | undefined,
): AuthoredFamilyCategory | null {
  if (!type) return null;
  return readAuthoredCategory(type);
}

export function familyTypeProjectCategoryKey(
  type: FamilyTypeElement | undefined,
): ProjectFamilyCategoryKey {
  if (!type) return 'family_instance';
  const category = readAuthoredCategory(type);
  if (category === 'door' || category === 'window') return category;
  if (category === 'furniture') return 'furniture';
  if (category === 'detail_component') return 'detail_component';
  if (category === 'generic_model' || category === 'profile') return 'generic_model';
  if (type.discipline === 'door' || type.discipline === 'window') return type.discipline;
  return 'family_instance';
}

export function familyInstanceProjectCategoryKey(
  instance: FamilyInstanceElement,
  elementsById: Record<string, Element>,
): ProjectFamilyCategoryKey {
  const type = elementsById[instance.familyTypeId];
  return familyTypeProjectCategoryKey(type?.kind === 'family_type' ? type : undefined);
}

export function familyTypeProjectCategoryLabel(type: FamilyTypeElement | undefined): string {
  switch (familyTypeProjectCategoryKey(type)) {
    case 'door':
      return 'Doors';
    case 'window':
      return 'Windows';
    case 'furniture':
      return 'Furniture';
    case 'generic_model':
      return 'Generic Models';
    case 'detail_component':
      return 'Detail Components';
    case 'family_instance':
      return 'Loaded Families';
  }
}
