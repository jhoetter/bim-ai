import type { Element } from '@bim-ai/core';

import {
  FAMILY_EDITOR_DEFINITION_PARAM,
  FAMILY_EDITOR_DOCUMENT_PARAM,
} from '../familyEditor/familyEditorPersistence';

type FamilyTypeElement = Extract<Element, { kind: 'family_type' }>;

function readParamString(type: FamilyTypeElement, keys: string[]): string {
  for (const key of keys) {
    const raw = type.parameters[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase();
  }
  return '';
}

function readAuthoredCategory(type: FamilyTypeElement): string {
  const raw = type.parameters[FAMILY_EDITOR_DOCUMENT_PARAM];
  if (!raw || typeof raw !== 'object') return '';
  const category = (raw as { categorySettings?: { category?: unknown } }).categorySettings
    ?.category;
  return typeof category === 'string' ? category : '';
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
