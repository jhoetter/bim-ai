import type { Element, FamilyDiscipline } from '@bim-ai/core';

import {
  placeKindForFamilyDiscipline,
  type FamilyLibraryPlaceKind,
} from '../families/familyPlacementAdapters';
import type {
  ArrayGeometryNode,
  FamilyDefinition,
  FamilyDefinitionCategory,
  FamilyGeometryNode,
  FamilyInstanceRefNode,
  FamilyParamDef,
  SketchLine,
  SweepGeometryNode,
  VisibilityBinding,
  VisibilityByDetailLevel,
  VisibilityByViewType,
} from '../families/types';
import type { FamilyReloadOverwriteOption } from '../families/catalogFamilyReload';

export const FAMILY_EDITOR_CATALOG_STORAGE_KEY = 'bim-ai.family-editor.catalog.v1';
export const FAMILY_EDITOR_CATALOG_ID = 'family-editor';
export const FAMILY_EDITOR_DOCUMENT_PARAM = '__familyEditorDocument';
export const FAMILY_EDITOR_DEFINITION_PARAM = '__familyDefinition';
export const FAMILY_EDITOR_TYPE_ROW_ID_PARAM = '__familyEditorTypeRowId';
export const FAMILY_EDITOR_CATEGORY_PARAM = 'familyCategory';
export const FAMILY_EDITOR_CATEGORY_SETTINGS_PARAM = 'familyCategorySettings';
export const FAMILY_EDITOR_NESTED_FAMILY_IDS_PARAM = 'familyEditorNestedFamilyIds';
export const FAMILY_EDITOR_NESTED_FAMILY_DEFINITIONS_PARAM = 'familyEditorNestedFamilyDefinitions';
export const FAMILY_EDITOR_NESTED_FAMILY_DOCUMENTS_PARAM = 'familyEditorNestedFamilyDocuments';

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
  instanceOverridable?: boolean;
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
  visibilityByViewType?: VisibilityByViewType;
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
  nestedFamilyDefinitions?: FamilyDefinition[];
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
  commands: AuthoredFamilyLoadCommand[];
  kind: FamilyLibraryPlaceKind;
  typeId: string;
  typeIds: string[];
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
      instanceOverridable: param.instanceOverridable ?? false,
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
    categorySettings: {
      category: document.categorySettings.category as FamilyDefinitionCategory,
      alwaysVertical: document.categorySettings.alwaysVertical,
      workPlaneBased: document.categorySettings.workPlaneBased,
      roomCalculationPoint: document.categorySettings.roomCalculationPoint,
      shared: document.categorySettings.shared,
    },
    params,
    defaultTypes,
    ...(document.templateMetadata ? { templateMetadata: document.templateMetadata } : {}),
    ...(geometry.length > 0 ? { geometry } : {}),
    ...(symbolicLines.length > 0 ? { symbolicLines } : {}),
    ...(document.nestedFamilyDefinitions?.length
      ? { nestedDefinitions: cloneSerializable(document.nestedFamilyDefinitions) }
      : {}),
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
    const embeddedDefinition = familyDefinitionFromElement(element);
    if (document)
      byId.set(document.id, embeddedDefinition ?? buildAuthoredFamilyDefinition(document));
    if (embeddedDefinition) {
      for (const definition of expandFamilyDefinitionsWithNestedDependencies([
        embeddedDefinition,
      ])) {
        byId.set(definition.id, definition);
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function expandFamilyDefinitionsWithNestedDependencies(
  definitions: FamilyDefinition[],
): FamilyDefinition[] {
  const byId = new Map<string, FamilyDefinition>();
  const visit = (definition: FamilyDefinition) => {
    if (byId.has(definition.id)) return;
    byId.set(definition.id, definition);
    for (const nested of definition.nestedDefinitions ?? []) visit(nested);
  };
  for (const definition of definitions) visit(definition);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function collectNestedFamilyDependencies(
  document: Pick<AuthoredFamilyDocument, 'id' | 'nestedInstances' | 'arrays'>,
  availableDefinitions: FamilyDefinition[],
): FamilyDefinition[] {
  const available = new Map<string, FamilyDefinition>();
  for (const definition of expandFamilyDefinitionsWithNestedDependencies(availableDefinitions)) {
    if (definition.id !== document.id) available.set(definition.id, definition);
  }
  const out = new Map<string, FamilyDefinition>();
  const queue = [
    ...document.nestedInstances.map((node) => node.familyId),
    ...document.arrays.map((node) => node.target.familyId),
  ];
  for (let index = 0; index < queue.length; index += 1) {
    const familyId = queue[index]!;
    if (familyId === document.id || out.has(familyId)) continue;
    const definition = available.get(familyId);
    if (!definition) continue;
    out.set(familyId, cloneSerializable(definition));
    for (const nestedId of nestedFamilyIds(definition)) queue.push(nestedId);
    for (const nested of definition.nestedDefinitions ?? []) queue.push(nested.id);
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface AuthoredFamilyDependencyManifest {
  ids: string[];
  definitions: FamilyDefinition[];
  documents: AuthoredFamilyDocument[];
}

export function collectAuthoredFamilyDependencies(
  document: AuthoredFamilyDocument,
  elementsById: Record<string, Element>,
): AuthoredFamilyDependencyManifest {
  const definitions = new Map<string, FamilyDefinition>();
  const documents = new Map<string, AuthoredFamilyDocument>();
  for (const definition of document.nestedFamilyDefinitions ?? []) {
    for (const expanded of expandFamilyDefinitionsWithNestedDependencies([definition])) {
      definitions.set(expanded.id, expanded);
    }
  }
  for (const element of Object.values(elementsById)) {
    if (element.kind !== 'family_type') continue;
    const nestedDocument = extractAuthoredFamilyDocument(element);
    if (nestedDocument) {
      documents.set(nestedDocument.id, nestedDocument);
      definitions.set(nestedDocument.id, buildAuthoredFamilyDefinition(nestedDocument));
    }
    const rawDefinition = element.parameters[FAMILY_EDITOR_DEFINITION_PARAM];
    if (rawDefinition && typeof rawDefinition === 'object') {
      const candidate = rawDefinition as Partial<FamilyDefinition>;
      if (typeof candidate.id === 'string' && typeof candidate.name === 'string') {
        definitions.set(candidate.id, candidate as FamilyDefinition);
      }
    }
  }

  const seen = new Set<string>();
  const queue = nestedFamilyIds(buildAuthoredFamilyDefinition(document));
  for (const id of queue) seen.add(id);
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index]!;
    const def = definitions.get(id);
    if (!def) continue;
    for (const nestedId of nestedFamilyIds(def)) {
      if (seen.has(nestedId)) continue;
      seen.add(nestedId);
      queue.push(nestedId);
    }
  }

  return {
    ids: queue,
    definitions: queue
      .map((id) => definitions.get(id))
      .filter((def): def is FamilyDefinition => Boolean(def)),
    documents: queue
      .map((id) => documents.get(id))
      .filter((dep): dep is AuthoredFamilyDocument => Boolean(dep)),
  };
}

function nestedFamilyIds(definition: FamilyDefinition): string[] {
  const ids: string[] = [];
  for (const node of definition.geometry ?? []) {
    if (node.kind === 'family_instance_ref') ids.push(node.familyId);
    if (node.kind === 'array') ids.push(node.target.familyId);
  }
  return ids;
}

function familyDefinitionFromElement(
  element: Extract<Element, { kind: 'family_type' }>,
): FamilyDefinition | null {
  const embedded = element.parameters[FAMILY_EDITOR_DEFINITION_PARAM];
  if (isFamilyDefinition(embedded)) return embedded;
  const document = extractAuthoredFamilyDocument(element);
  return document ? buildAuthoredFamilyDefinition(document) : null;
}

function isFamilyDefinition(value: unknown): value is FamilyDefinition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    Array.isArray((value as { params?: unknown }).params) &&
    Array.isArray((value as { defaultTypes?: unknown }).defaultTypes),
  );
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

function loadedAuthoredFamilyTypesByRowId(
  elementsById: Record<string, Element>,
  document: AuthoredFamilyDocument,
): Map<string, Extract<Element, { kind: 'family_type' }>> {
  const byRowId = new Map<string, Extract<Element, { kind: 'family_type' }>>();
  const rows = document.familyTypes.length
    ? document.familyTypes
    : [{ id: 'family-type-1', name: `${document.name} Type`, values: {} }];
  for (const element of Object.values(elementsById)) {
    if (element.kind !== 'family_type') continue;
    const savedDocument = extractAuthoredFamilyDocument(element);
    if (savedDocument?.id !== document.id && element.familyId !== document.id) continue;
    const rowId = element.parameters[FAMILY_EDITOR_TYPE_ROW_ID_PARAM];
    if (typeof rowId === 'string' && rowId) {
      byRowId.set(rowId, element);
    } else if (rows.length === 1) {
      byRowId.set(rows[0]!.id, element);
    }
  }
  return byRowId;
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
  const existingByRowId = loadedAuthoredFamilyTypesByRowId(elementsById, document);
  const overwriteOption = existing ? (options.overwriteOption ?? 'keep-existing-values') : null;
  const rows = document.familyTypes.length
    ? document.familyTypes
    : [{ id: 'family-type-1', name: `${document.name} Type`, values: {} }];
  const now = options.now ?? Date.now();
  const templateParameters = document.templateMetadata
    ? {
        familyTemplateMetadata: document.templateMetadata,
        familyTemplateId: document.templateMetadata.templateId,
        familyTemplateFileName: document.templateMetadata.fileName,
        familyTemplateHostType: document.templateMetadata.hostType,
        familyTemplateCategory: document.templateMetadata.category,
        familyTemplateBrowserPath: document.templateMetadata.browserPath,
        familyTemplateOriginReferencePlaneIds: document.templateMetadata.originReferencePlaneIds,
      }
    : {};
  const dependencyManifest = collectAuthoredFamilyDependencies(document, elementsById);
  const projectDefinition: FamilyDefinition = dependencyManifest.definitions.length
    ? { ...definition, nestedDefinitions: dependencyManifest.definitions }
    : definition;
  const categoryParameters = {
    [FAMILY_EDITOR_CATEGORY_PARAM]: document.categorySettings.category,
    [FAMILY_EDITOR_CATEGORY_SETTINGS_PARAM]: document.categorySettings,
    familyAlwaysVertical: document.categorySettings.alwaysVertical,
    familyWorkPlaneBased: document.categorySettings.workPlaneBased,
    familyRoomCalculationPoint: document.categorySettings.roomCalculationPoint,
    familyShared: document.categorySettings.shared,
    familyVgCategory: `loaded_family:${document.categorySettings.category}`,
    familyTagCategory: document.categorySettings.category,
  };
  const nestedFamilyParameters = {
    [FAMILY_EDITOR_NESTED_FAMILY_IDS_PARAM]: dependencyManifest.ids,
    [FAMILY_EDITOR_NESTED_FAMILY_DEFINITIONS_PARAM]: dependencyManifest.definitions,
    [FAMILY_EDITOR_NESTED_FAMILY_DOCUMENTS_PARAM]: dependencyManifest.documents,
  };
  const commands = rows.map((row, index): AuthoredFamilyLoadCommand => {
    const existingForRow = existingByRowId.get(row.id);
    const typeId =
      existingForRow?.id ?? newAuthoredFamilyTypeId(document, now, rows.length > 1 ? row.id : null);
    const existingDefinition = existingForRow ? familyDefinitionFromElement(existingForRow) : null;
    const commandDefinition =
      existingForRow && overwriteOption === 'keep-existing-values' && existingDefinition
        ? mergeKeepExistingFamilyParameterValues(projectDefinition, existingDefinition)
        : projectDefinition;
    const commandNestedDefinitions = commandDefinition.nestedDefinitions ?? [];
    const commandDocument: AuthoredFamilyDocument = {
      ...document,
      ...(commandNestedDefinitions.length
        ? { nestedFamilyDefinitions: commandNestedDefinitions }
        : { nestedFamilyDefinitions: undefined }),
    };
    const commandNestedFamilyParameters = {
      ...nestedFamilyParameters,
      [FAMILY_EDITOR_NESTED_FAMILY_IDS_PARAM]: commandNestedDefinitions.map(
        (definition) => definition.id,
      ),
      [FAMILY_EDITOR_NESTED_FAMILY_DEFINITIONS_PARAM]: commandNestedDefinitions,
    };
    const defaultParameters = {
      ...familyTypeParameters(document.id, row, document.params),
      [FAMILY_EDITOR_DOCUMENT_PARAM]: commandDocument,
      [FAMILY_EDITOR_DEFINITION_PARAM]: commandDefinition,
      [FAMILY_EDITOR_TYPE_ROW_ID_PARAM]: row.id,
      familyEditorCatalogId: FAMILY_EDITOR_CATALOG_ID,
      familyEditorSavedAt: document.savedAt,
      familyEditorVersion: document.version,
      ...templateParameters,
      ...categoryParameters,
      ...commandNestedFamilyParameters,
    };
    const parameters: Record<string, unknown> =
      existingForRow && overwriteOption === 'keep-existing-values'
        ? {
            ...existingForRow.parameters,
            name: existingForRow.parameters.name ?? row.name,
            familyId: document.id,
            [FAMILY_EDITOR_DOCUMENT_PARAM]: commandDocument,
            [FAMILY_EDITOR_DEFINITION_PARAM]: commandDefinition,
            [FAMILY_EDITOR_TYPE_ROW_ID_PARAM]: row.id,
            familyEditorCatalogId: FAMILY_EDITOR_CATALOG_ID,
            familyEditorSavedAt: document.savedAt,
            familyEditorVersion: document.version,
            ...templateParameters,
            ...categoryParameters,
            ...commandNestedFamilyParameters,
          }
        : defaultParameters;
    return {
      type: 'upsertFamilyType',
      id: typeId,
      name: String(parameters.name ?? row.name ?? `${document.name} Type ${index + 1}`),
      familyId: document.id,
      discipline: definition.discipline as 'door' | 'window' | 'generic',
      parameters,
    };
  });
  const activeIndex = Math.max(
    0,
    rows.findIndex((row) => row.id === document.activeFamilyTypeId),
  );
  const command = commands[activeIndex] ?? commands[0]!;

  return {
    command,
    commands,
    kind: placeKindForFamilyDiscipline(definition.discipline),
    typeId: command.id,
    typeIds: commands.map((next) => next.id),
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

function mergeKeepExistingFamilyParameterValues(
  next: FamilyDefinition,
  existing: FamilyDefinition,
): FamilyDefinition {
  const existingDefaults = new Map(existing.params.map((param) => [param.key, param.default]));
  const existingTypes = new Map<string, FamilyDefinition['defaultTypes'][number]>();
  for (const type of existing.defaultTypes) {
    existingTypes.set(type.id, type);
    existingTypes.set(type.name, type);
  }
  const existingNested = new Map((existing.nestedDefinitions ?? []).map((def) => [def.id, def]));

  return {
    ...next,
    params: next.params.map((param) =>
      existingDefaults.has(param.key)
        ? { ...param, default: existingDefaults.get(param.key) }
        : param,
    ),
    defaultTypes: next.defaultTypes.map((type) => {
      const existingType = existingTypes.get(type.id) ?? existingTypes.get(type.name);
      if (!existingType) return type;
      return {
        ...type,
        parameters: {
          ...type.parameters,
          ...existingType.parameters,
          familyId: type.familyId,
        },
      };
    }),
    ...(next.nestedDefinitions?.length
      ? {
          nestedDefinitions: next.nestedDefinitions.map((definition) => {
            const existingDefinition = existingNested.get(definition.id);
            return existingDefinition
              ? mergeKeepExistingFamilyParameterValues(definition, existingDefinition)
              : definition;
          }),
        }
      : {}),
  };
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newAuthoredFamilyTypeId(
  document: AuthoredFamilyDocument,
  now: number,
  rowId: string | null = null,
): string {
  const safeFamId = document.id.replace(/[^A-Za-z0-9_-]/g, '_');
  const safeRowId = rowId ? `-${rowId.replace(/[^A-Za-z0-9_-]/g, '_')}` : '';
  return `ft-${safeFamId}${safeRowId}-${now.toString(36)}`;
}
