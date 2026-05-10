import type { Element, FamilyDiscipline } from '@bim-ai/core';

import {
  placeKindForFamilyDiscipline,
  type FamilyLibraryPlaceKind,
} from '../families/familyPlacementAdapters';
import type {
  ArrayGeometryNode,
  FamilyDefinition,
  FamilyGeometryNode,
  FamilyInstanceRefNode,
  FamilyParamDef,
  SketchLine,
  SweepGeometryNode,
  VisibilityBinding,
  VisibilityByDetailLevel,
} from '../families/types';
import type { FamilyReloadOverwriteOption } from '../families/catalogFamilyReload';

export const FAMILY_EDITOR_CATALOG_STORAGE_KEY = 'bim-ai.family-editor.catalog.v1';
export const FAMILY_EDITOR_CATALOG_ID = 'family-editor';
export const FAMILY_EDITOR_DOCUMENT_PARAM = '__familyEditorDocument';
export const FAMILY_EDITOR_DEFINITION_PARAM = '__familyDefinition';

export type AuthoredFamilyTemplate = 'generic_model' | 'door' | 'window' | 'profile' | 'furniture';
export type AuthoredFamilyCategory = AuthoredFamilyTemplate | 'detail_component';
export type AuthoredFamilyTemplateHostType =
  | 'standalone'
  | 'wall_hosted'
  | 'floor_hosted'
  | 'ceiling_hosted'
  | 'face_based'
  | 'profile_based';

export interface AuthoredFamilyTemplateMetadata {
  templateId: AuthoredFamilyTemplate;
  fileName: string;
  browserPath: string;
  displayName: string;
  category: AuthoredFamilyCategory;
  categoryLabel: string;
  hostType: AuthoredFamilyTemplateHostType;
  hostLabel: string;
  originReferencePlaneIds: string[];
  referencePlaneIds: string[];
  defaultTypeNames: string[];
}

export interface AuthoredFamilyParam {
  key: string;
  label: string;
  type: FamilyParamDef['type'];
  default: unknown;
  formula: string;
}

export interface AuthoredFamilyTypeRow {
  id: string;
  name: string;
  values: Record<string, unknown>;
}

export interface AuthoredFamilyRefPlane {
  id: string;
  name: string;
  isVertical: boolean;
  offsetMm: number;
  isSymmetryRef: boolean;
  referenceType?: 'strong_reference' | 'weak_reference' | 'not_reference';
  locked?: boolean;
}

export interface AuthoredFamilyCategorySettings {
  category: AuthoredFamilyCategory;
  alwaysVertical: boolean;
  workPlaneBased: boolean;
  roomCalculationPoint: boolean;
  shared: boolean;
}

export interface AuthoredFamilyViewRange {
  topOffsetMm: number;
  cutPlaneOffsetMm: number;
  bottomOffsetMm: number;
  viewDepthOffsetMm: number;
}

export interface AuthoredFamilySymbolicLine extends SketchLine {
  subcategory: 'symbolic' | 'opening_projection' | 'hidden_cut';
  alignmentLock?: { refPlaneId: string };
  visibilityBinding?: VisibilityBinding;
  visibilityByDetailLevel?: VisibilityByDetailLevel;
}

export interface AuthoredFamilyDimension {
  id: string;
  refAId: string;
  refBId: string;
  lockedValueMm: number;
  paramKey: string;
  canvasOffsetMm?: number;
}

export interface AuthoredFamilyEqConstraint {
  id: string;
  orientation: 'vertical' | 'horizontal';
  refPlaneIds: string[];
  equalGapMm: number;
}

export interface AuthoredFamilyDocument {
  id: string;
  name: string;
  template: AuthoredFamilyTemplate;
  templateMetadata?: AuthoredFamilyTemplateMetadata;
  categorySettings: AuthoredFamilyCategorySettings;
  viewRange: AuthoredFamilyViewRange;
  refPlanes: AuthoredFamilyRefPlane[];
  params: AuthoredFamilyParam[];
  familyTypes: AuthoredFamilyTypeRow[];
  activeFamilyTypeId: string;
  sweeps: SweepGeometryNode[];
  arrays: ArrayGeometryNode[];
  nestedInstances: FamilyInstanceRefNode[];
  symbolicLines: AuthoredFamilySymbolicLine[];
  dimensions: AuthoredFamilyDimension[];
  eqConstraints: AuthoredFamilyEqConstraint[];
  savedAt: number;
  version: string;
}

export interface AuthoredFamilyLoadCommand extends Record<string, unknown> {
  type: 'upsertFamilyType';
  id: string;
  name: string;
  familyId: string;
  discipline: 'door' | 'window' | 'generic';
  parameters: Record<string, unknown>;
}

export interface AuthoredFamilyLoadPlan {
  command: AuthoredFamilyLoadCommand;
  kind: FamilyLibraryPlaceKind;
  typeId: string;
  familyId: string;
  reloaded: boolean;
  overwriteOption: FamilyReloadOverwriteOption | null;
}

export function authoredFamilyDiscipline(
  template: AuthoredFamilyTemplate,
  category: AuthoredFamilyCategory,
): Extract<FamilyDiscipline, 'door' | 'window' | 'generic'> {
  if (template === 'door' || category === 'door') return 'door';
  if (template === 'window' || category === 'window') return 'window';
  return 'generic';
}

export function buildAuthoredFamilyDefinition(document: AuthoredFamilyDocument): FamilyDefinition {
  const discipline = authoredFamilyDiscipline(
    document.template,
    document.categorySettings.category,
  );
  const params = document.params.map((param): FamilyParamDef => {
    const formula = param.formula.trim();
    return {
      key: param.key,
      label: param.label || param.key,
      type: param.type,
      default: param.default,
      instanceOverridable: true,
      ...(formula ? { formula } : {}),
    };
  });
  const defaultTypes = document.familyTypes.map((row) => ({
    id: `${document.id}:${row.id}`,
    name: row.name,
    familyId: document.id,
    discipline,
    parameters: familyTypeParameters(document.id, row, document.params),
    isBuiltIn: true as const,
  }));
  const geometry: FamilyGeometryNode[] = [
    ...document.sweeps.map((node) => ({ ...node })),
    ...document.nestedInstances.map((node) => ({ ...node })),
    ...document.arrays.map((node) => ({ ...node })),
  ];
  const symbolicLines = document.symbolicLines.map((line) => ({ ...line }));

  return {
    id: document.id,
    name: document.name,
    discipline,
    params,
    defaultTypes,
    ...(document.templateMetadata ? { templateMetadata: document.templateMetadata } : {}),
    ...(geometry.length > 0 ? { geometry } : {}),
    ...(symbolicLines.length > 0 ? { symbolicLines } : {}),
  };
}

export function familyTypeParameters(
  familyId: string,
  row: AuthoredFamilyTypeRow,
  params: AuthoredFamilyParam[],
): Record<string, unknown> {
  const defaults = Object.fromEntries(params.map((param) => [param.key, param.default]));
  return {
    name: row.name,
    familyId,
    ...defaults,
    ...row.values,
  };
}

export function extractAuthoredFamilyDocument(
  element: Extract<Element, { kind: 'family_type' }>,
): AuthoredFamilyDocument | null {
  const raw = element.parameters[FAMILY_EDITOR_DOCUMENT_PARAM];
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<AuthoredFamilyDocument>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.params) ||
    !Array.isArray(candidate.familyTypes)
  ) {
    return null;
  }
  return candidate as AuthoredFamilyDocument;
}

export function authoredFamilyDefinitionsFromElements(
  elementsById: Record<string, Element>,
): FamilyDefinition[] {
  const byId = new Map<string, FamilyDefinition>();
  for (const element of Object.values(elementsById)) {
    if (element.kind !== 'family_type') continue;
    const document = extractAuthoredFamilyDocument(element);
    if (document) byId.set(document.id, buildAuthoredFamilyDefinition(document));
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findLoadedAuthoredFamilyType(
  elementsById: Record<string, Element>,
  document: AuthoredFamilyDocument,
): Extract<Element, { kind: 'family_type' }> | null {
  for (const element of Object.values(elementsById)) {
    if (element.kind !== 'family_type') continue;
    const savedDocument = extractAuthoredFamilyDocument(element);
    if (savedDocument?.id === document.id || element.familyId === document.id) return element;
  }
  return null;
}

export function planAuthoredFamilyLoad(
  document: AuthoredFamilyDocument,
  elementsById: Record<string, Element>,
  options: {
    now?: number;
    overwriteOption?: FamilyReloadOverwriteOption;
  } = {},
): AuthoredFamilyLoadPlan {
  const definition = buildAuthoredFamilyDefinition(document);
  const existing = findLoadedAuthoredFamilyType(elementsById, document);
  const overwriteOption = existing ? (options.overwriteOption ?? 'keep-existing-values') : null;
  const activeType = document.familyTypes.find((row) => row.id === document.activeFamilyTypeId) ??
    document.familyTypes[0] ?? { id: 'family-type-1', name: `${document.name} Type`, values: {} };
  const typeId = existing?.id ?? newAuthoredFamilyTypeId(document, options.now ?? Date.now());
  const defaultParameters = {
    ...familyTypeParameters(document.id, activeType, document.params),
    [FAMILY_EDITOR_DOCUMENT_PARAM]: document,
    [FAMILY_EDITOR_DEFINITION_PARAM]: definition,
    familyEditorCatalogId: FAMILY_EDITOR_CATALOG_ID,
    familyEditorSavedAt: document.savedAt,
    familyEditorVersion: document.version,
    ...(document.templateMetadata
      ? {
          familyTemplateMetadata: document.templateMetadata,
          familyTemplateId: document.templateMetadata.templateId,
          familyTemplateFileName: document.templateMetadata.fileName,
          familyTemplateHostType: document.templateMetadata.hostType,
          familyTemplateCategory: document.templateMetadata.category,
          familyTemplateBrowserPath: document.templateMetadata.browserPath,
          familyTemplateOriginReferencePlaneIds: document.templateMetadata.originReferencePlaneIds,
        }
      : {}),
  };
  const parameters: Record<string, unknown> =
    existing && overwriteOption === 'keep-existing-values'
      ? {
          ...existing.parameters,
          familyId: document.id,
          [FAMILY_EDITOR_DOCUMENT_PARAM]: document,
          [FAMILY_EDITOR_DEFINITION_PARAM]: definition,
          familyEditorCatalogId: FAMILY_EDITOR_CATALOG_ID,
          familyEditorSavedAt: document.savedAt,
          familyEditorVersion: document.version,
          ...(document.templateMetadata
            ? {
                familyTemplateMetadata: document.templateMetadata,
                familyTemplateId: document.templateMetadata.templateId,
                familyTemplateFileName: document.templateMetadata.fileName,
                familyTemplateHostType: document.templateMetadata.hostType,
                familyTemplateCategory: document.templateMetadata.category,
                familyTemplateBrowserPath: document.templateMetadata.browserPath,
                familyTemplateOriginReferencePlaneIds:
                  document.templateMetadata.originReferencePlaneIds,
              }
            : {}),
        }
      : defaultParameters;

  return {
    command: {
      type: 'upsertFamilyType',
      id: typeId,
      name: String(parameters.name ?? document.name),
      familyId: document.id,
      discipline: definition.discipline as 'door' | 'window' | 'generic',
      parameters,
    },
    kind: placeKindForFamilyDiscipline(definition.discipline),
    typeId,
    familyId: document.id,
    reloaded: existing !== null,
    overwriteOption,
  };
}

export function readAuthoredFamilyCatalog(
  storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.localStorage,
): AuthoredFamilyDocument[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(FAMILY_EDITOR_CATALOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAuthoredFamilyDocument);
  } catch {
    return [];
  }
}

export function writeAuthoredFamilyCatalog(
  documents: AuthoredFamilyDocument[],
  storage: Pick<Storage, 'setItem'> | null | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  storage.setItem(FAMILY_EDITOR_CATALOG_STORAGE_KEY, JSON.stringify(documents));
}

export function upsertAuthoredFamilyCatalogDocument(
  documents: AuthoredFamilyDocument[],
  document: AuthoredFamilyDocument,
): AuthoredFamilyDocument[] {
  const next = documents.filter((candidate) => candidate.id !== document.id);
  next.push(document);
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

function isAuthoredFamilyDocument(value: unknown): value is AuthoredFamilyDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthoredFamilyDocument>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.template === 'string' &&
    Array.isArray(candidate.refPlanes) &&
    Array.isArray(candidate.params) &&
    Array.isArray(candidate.familyTypes)
  );
}

function newAuthoredFamilyTypeId(document: AuthoredFamilyDocument, now: number): string {
  const safeFamId = document.id.replace(/[^A-Za-z0-9_-]/g, '_');
  return `ft-${safeFamId}-${now.toString(36)}`;
}
