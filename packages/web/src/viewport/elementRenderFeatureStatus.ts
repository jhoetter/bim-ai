import type { Element, LensMode, ViewLensMode } from '@bim-ai/core';

import { getTypeById } from '../families/familyCatalog';
import type { FamilyDefinition, FamilyParamDef } from '../families/types';
import { familyDefinitionForType } from '../plan/familyInstancePlanRendering';
import {
  auditElementMaterialCoverage,
  type MaterialCoverageEntry,
  type MaterialCoverageSubcomponent,
} from './materialCoverageAudit';
import { LENS_GHOST_OPACITY } from './applyLensGhosting';
import { lensFilterFromMode, resolveLensFilter } from './useLensFilter';

export type RenderFeatureState = 'supported' | 'partial' | 'unsupported' | 'not_applicable';
export type MaterialRenderState = 'resolved' | 'fallback' | 'unresolved' | 'non_rendered';
export type DimensionSource =
  | 'instance'
  | 'override'
  | 'family-type'
  | 'host-fallback'
  | 'family-default'
  | 'not_applicable';

export type ElementMaterialRenderStatus = {
  state: MaterialRenderState;
  source: MaterialCoverageEntry['source'] | 'not-audited';
  materialKey: string | null;
  displayName: string | null;
  fallback: boolean;
  flags: string[];
  slots: Array<{
    slot: string;
    materialKey: string | null;
    source: MaterialCoverageSubcomponent['source'];
    resolved: boolean;
    fallback: boolean;
  }>;
};

export type ElementFamilyRenderStatus = {
  state: RenderFeatureState;
  familyTypeId: string | null;
  familyId: string | null;
  dimensionSource: DimensionSource;
  dimensionsMm: Record<string, number>;
  supportedSlots: string[];
  missingSlots: string[];
  supportedOperations: string[];
  proxyFallback: boolean;
  skippedSubfeatures: string[];
};

export type ElementLensRenderStatus = {
  mode: LensMode | ViewLensMode | 'none';
  source: 'ui-lens' | 'view-lens' | 'none';
  visibility: 'foreground' | 'ghost' | 'not_applicable';
  ghostingSupported: boolean;
  ghostOpacity: number | null;
  skippedSubfeatures: string[];
};

export type ElementRenderFeatureStatus = {
  format: 'elementRenderFeatureStatus_v1';
  elementId: string;
  kind: Element['kind'];
  material: ElementMaterialRenderStatus;
  family: ElementFamilyRenderStatus;
  lens: ElementLensRenderStatus;
  skippedSubfeatures: string[];
};

export type ElementRenderFeatureStatusInput = {
  elements?: readonly Element[] | Record<string, Element | undefined> | null;
  elementsById?: Record<string, Element | undefined> | null;
  elementIds?: readonly string[] | null;
  lensMode?: LensMode | null;
  viewLensMode?: ViewLensMode | null;
};

const DOOR_SLOTS = ['frame', 'panel', 'threshold', 'hardware', 'glass'] as const;
const WINDOW_SLOTS = ['frame', 'sash', 'glass', 'spacer', 'hardware', 'shading'] as const;
const DOOR_OPERATIONS = [
  'swing_single',
  'swing_double',
  'sliding_single',
  'sliding_double',
  'bi_fold',
  'pocket',
  'pivot',
  'automatic_double',
] as const;
const WINDOW_OUTLINES = [
  'rectangle',
  'arched_top',
  'gable_trapezoid',
  'circle',
  'octagon',
  'custom',
];
const DIMENSION_PARAM_HINTS = [
  'widthMm',
  'heightMm',
  'depthMm',
  'lengthMm',
  'leafWidthMm',
  'leafHeightMm',
  'sillMm',
  'sillHeightMm',
  'roughWidthMm',
  'roughHeightMm',
  'diameterMm',
  'radiusMm',
];

export function collectElementRenderFeatureStatuses(
  input: ElementRenderFeatureStatusInput,
): ElementRenderFeatureStatus[] {
  const elementsById = compactElementsById(
    normalizeElementsById(input.elementsById ?? input.elements),
  );
  const materialEntries = new Map(
    auditElementMaterialCoverage(elementsById).entries.map((entry) => [entry.elementId, entry]),
  );
  const ids = input.elementIds?.length
    ? [...input.elementIds]
    : Object.keys(elementsById).sort((a, b) => a.localeCompare(b));

  return ids
    .map((id) => elementsById[id])
    .filter((element): element is Element => Boolean(element))
    .map((element) =>
      elementRenderFeatureStatus(element, elementsById, materialEntries.get(element.id), {
        lensMode: input.lensMode ?? null,
        viewLensMode: input.viewLensMode ?? null,
      }),
    )
    .sort((a, b) => `${a.kind}:${a.elementId}`.localeCompare(`${b.kind}:${b.elementId}`));
}

export function elementRenderFeatureStatus(
  element: Element,
  elementsById: Record<string, Element>,
  materialEntry?: MaterialCoverageEntry,
  options: { lensMode?: LensMode | null; viewLensMode?: ViewLensMode | null } = {},
): ElementRenderFeatureStatus {
  const material = materialStatus(materialEntry);
  const family = familyStatus(element, elementsById, materialEntry);
  const lens = lensStatus(element, options);
  const skippedSubfeatures = uniqueSorted([
    ...material.flags.map((flag) => `material.${flag}`),
    ...family.skippedSubfeatures,
    ...lens.skippedSubfeatures,
  ]);

  return {
    format: 'elementRenderFeatureStatus_v1',
    elementId: element.id,
    kind: element.kind,
    material,
    family,
    lens,
    skippedSubfeatures,
  };
}

function normalizeElementsById(
  input: readonly Element[] | Record<string, Element | undefined> | null | undefined,
): Record<string, Element | undefined> {
  if (!input) return {};
  if (Array.isArray(input))
    return Object.fromEntries(input.map((element) => [element.id, element]));
  return input as Record<string, Element | undefined>;
}

function compactElementsById(
  elementsById: Record<string, Element | undefined>,
): Record<string, Element> {
  return Object.fromEntries(
    Object.entries(elementsById).filter((entry): entry is [string, Element] => !!entry[1]),
  );
}

function materialStatus(entry: MaterialCoverageEntry | undefined): ElementMaterialRenderStatus {
  if (!entry) {
    return {
      state: 'fallback',
      source: 'not-audited',
      materialKey: null,
      displayName: null,
      fallback: true,
      flags: ['material-not-audited'],
      slots: [],
    };
  }
  const flags: string[] = [...entry.flags];
  const state: MaterialRenderState =
    entry.source === 'non-rendered'
      ? 'non_rendered'
      : entry.source === 'unresolved' || flags.includes('unresolved-material-key')
        ? 'unresolved'
        : isFallbackMaterialSource(entry.source)
          ? 'fallback'
          : 'resolved';
  const slots = (entry.subcomponents ?? []).map((slot) => ({
    slot: slot.slot,
    materialKey: slot.materialKey,
    source: slot.source,
    resolved: slot.resolved,
    fallback: isFallbackMaterialSource(slot.source) || !slot.materialKey,
  }));
  for (const slot of slots) {
    if (!slot.materialKey) flags.push(`slot-${slot.slot}-unassigned`);
    if (!slot.resolved) flags.push(`slot-${slot.slot}-unresolved`);
  }
  return {
    state,
    source: entry.source,
    materialKey: entry.materialKey,
    displayName: entry.displayName,
    fallback: state === 'fallback' || state === 'unresolved',
    flags: uniqueSorted(flags),
    slots,
  };
}

function isFallbackMaterialSource(source: MaterialCoverageEntry['source']): boolean {
  return (
    source === 'category-fallback' ||
    source === 'family-default' ||
    source === 'subcomponent-default' ||
    source === 'unresolved'
  );
}

function familyStatus(
  element: Element,
  elementsById: Record<string, Element>,
  materialEntry: MaterialCoverageEntry | undefined,
): ElementFamilyRenderStatus {
  if (element.kind === 'door') return hostedOpeningStatus(element, elementsById, materialEntry);
  if (element.kind === 'window') return hostedOpeningStatus(element, elementsById, materialEntry);
  if (element.kind === 'family_instance') return loadedFamilyInstanceStatus(element, elementsById);
  return notApplicableFamilyStatus();
}

function notApplicableFamilyStatus(): ElementFamilyRenderStatus {
  return {
    state: 'not_applicable',
    familyTypeId: null,
    familyId: null,
    dimensionSource: 'not_applicable',
    dimensionsMm: {},
    supportedSlots: [],
    missingSlots: [],
    supportedOperations: [],
    proxyFallback: false,
    skippedSubfeatures: [],
  };
}

function hostedOpeningStatus(
  element: Extract<Element, { kind: 'door' }> | Extract<Element, { kind: 'window' }>,
  elementsById: Record<string, Element>,
  materialEntry: MaterialCoverageEntry | undefined,
): ElementFamilyRenderStatus {
  const type = familyTypeForElement(element.familyTypeId, elementsById);
  const typeParams = type?.parameters;
  const dimensions =
    element.kind === 'door'
      ? doorDimensions(element, typeParams, elementsById)
      : windowDimensions(element, typeParams);
  const expectedSlots = element.kind === 'door' ? DOOR_SLOTS : WINDOW_SLOTS;
  const slots = slotSupport(expectedSlots, materialEntry);
  const skipped = [...dimensions.skippedSubfeatures];
  if (!element.familyTypeId) skipped.push('family.family_type_unassigned');
  else if (!type) skipped.push('family.family_type_not_found');
  for (const slot of slots.missingSlots) skipped.push(`family.material_slot_${slot}_fallback`);
  if (
    element.kind === 'window' &&
    element.outlineKind === 'gable_trapezoid' &&
    !element.attachedRoofId
  ) {
    skipped.push('family.window_gable_trapezoid_missing_roof_fallback');
  }

  return {
    state: skipped.length > 0 ? 'partial' : 'supported',
    familyTypeId: element.familyTypeId ?? null,
    familyId: type?.familyId ?? null,
    dimensionSource: dimensions.source,
    dimensionsMm: dimensions.dimensionsMm,
    supportedSlots: slots.supportedSlots,
    missingSlots: slots.missingSlots,
    supportedOperations: element.kind === 'door' ? [...DOOR_OPERATIONS] : WINDOW_OUTLINES,
    proxyFallback: false,
    skippedSubfeatures: uniqueSorted(skipped),
  };
}

function loadedFamilyInstanceStatus(
  instance: Extract<Element, { kind: 'family_instance' }>,
  elementsById: Record<string, Element>,
): ElementFamilyRenderStatus {
  const type = elementsById[instance.familyTypeId];
  const skipped: string[] = [];
  if (type?.kind !== 'family_type') {
    return {
      ...notApplicableFamilyStatus(),
      state: 'unsupported',
      familyTypeId: instance.familyTypeId,
      proxyFallback: true,
      skippedSubfeatures: ['family.family_type_not_found', 'family.proxy_fallback'],
    };
  }
  const def = familyDefinitionForType(type);
  if (!def) skipped.push('family.definition_not_found');
  const hasModelGeometry = Boolean(def?.geometry?.length);
  const hasPlanSymbol = Boolean(def?.symbolicLines?.length);
  if (!hasModelGeometry) skipped.push('family.model_geometry_proxy_fallback');
  if (!hasPlanSymbol) skipped.push('family.plan_symbol_footprint_fallback');
  const dimensions = loadedFamilyDimensions(def, type.parameters, instance.paramValues);
  const materialSlots =
    def?.params
      .filter((param) => param.type === 'material_key')
      .map((param) => param.key)
      .sort((a, b) => a.localeCompare(b)) ?? [];
  if (materialSlots.length === 0) skipped.push('family.no_authored_material_slots');

  return {
    state: !def ? 'unsupported' : skipped.length > 0 ? 'partial' : 'supported',
    familyTypeId: instance.familyTypeId,
    familyId: type.familyId,
    dimensionSource: dimensions.source,
    dimensionsMm: dimensions.dimensionsMm,
    supportedSlots: materialSlots,
    missingSlots: [],
    supportedOperations: [],
    proxyFallback: !def || !hasModelGeometry || !hasPlanSymbol,
    skippedSubfeatures: uniqueSorted(skipped),
  };
}

function familyTypeForElement(
  familyTypeId: string | null | undefined,
  elementsById: Record<string, Element>,
): Extract<Element, { kind: 'family_type' }> | FamilyDefinition['defaultTypes'][number] | null {
  if (!familyTypeId) return null;
  const projectType = elementsById[familyTypeId];
  if (projectType?.kind === 'family_type') return projectType;
  return getTypeById(familyTypeId) ?? null;
}

function slotSupport(
  expectedSlots: readonly string[],
  entry: MaterialCoverageEntry | undefined,
): { supportedSlots: string[]; missingSlots: string[] } {
  const bySlot = new Map((entry?.subcomponents ?? []).map((slot) => [slot.slot, slot]));
  const supportedSlots: string[] = [];
  const missingSlots: string[] = [];
  for (const slotName of expectedSlots) {
    const slot = bySlot.get(slotName);
    if (slot?.materialKey && slot.resolved) supportedSlots.push(slotName);
    else missingSlots.push(slotName);
  }
  return { supportedSlots, missingSlots };
}

function doorDimensions(
  door: Extract<Element, { kind: 'door' }>,
  typeParams: Record<string, unknown> | undefined,
  elementsById: Record<string, Element>,
): { source: DimensionSource; dimensionsMm: Record<string, number>; skippedSubfeatures: string[] } {
  const width = readNumberWithSource([
    {
      source: 'override',
      values: door.overrideParams,
      keys: ['leafWidthMm', 'widthMm', 'roughWidthMm', 'Width', 'Rough Width'],
    },
    {
      source: 'family-type',
      values: typeParams,
      keys: ['leafWidthMm', 'widthMm', 'roughWidthMm', 'Width', 'Rough Width'],
    },
    { source: 'instance', values: door, keys: ['widthMm'] },
  ]);
  const host = elementsById[door.wallId];
  const height = readNumberWithSource([
    {
      source: 'override',
      values: door.overrideParams,
      keys: ['leafHeightMm', 'heightMm', 'roughHeightMm', 'Height', 'Rough Height'],
    },
    {
      source: 'family-type',
      values: typeParams,
      keys: ['leafHeightMm', 'heightMm', 'roughHeightMm', 'Height', 'Rough Height'],
    },
    {
      source: 'host-fallback',
      values: host?.kind === 'wall' ? { heightMm: host.heightMm * 0.86 } : undefined,
      keys: ['heightMm'],
    },
  ]);
  const skipped = [];
  if (height.source === 'host-fallback') skipped.push('family.door_height_host_ratio_fallback');
  if (!height.value) skipped.push('family.door_height_unknown');
  return {
    source: strongerDimensionSource(width.source, height.source),
    dimensionsMm: compactNumberRecord({ widthMm: width.value, heightMm: height.value }),
    skippedSubfeatures: skipped,
  };
}

function windowDimensions(
  win: Extract<Element, { kind: 'window' }>,
  typeParams: Record<string, unknown> | undefined,
): { source: DimensionSource; dimensionsMm: Record<string, number>; skippedSubfeatures: string[] } {
  const width = readNumberWithSource([
    {
      source: 'override',
      values: win.overrideParams,
      keys: ['widthMm', 'roughWidthMm', 'Width', 'Rough Width'],
    },
    {
      source: 'family-type',
      values: typeParams,
      keys: ['widthMm', 'roughWidthMm', 'Width', 'Rough Width'],
    },
    { source: 'instance', values: win, keys: ['widthMm'] },
  ]);
  const height = readNumberWithSource([
    {
      source: 'override',
      values: win.overrideParams,
      keys: ['heightMm', 'roughHeightMm', 'Height', 'Rough Height'],
    },
    {
      source: 'family-type',
      values: typeParams,
      keys: ['heightMm', 'roughHeightMm', 'Height', 'Rough Height'],
    },
    { source: 'instance', values: win, keys: ['heightMm'] },
  ]);
  const sill = readNumberWithSource([
    {
      source: 'override',
      values: win.overrideParams,
      keys: ['sillMm', 'sillHeightMm', 'Sill Height', 'SillHeight'],
    },
    {
      source: 'family-type',
      values: typeParams,
      keys: ['sillMm', 'sillHeightMm', 'Sill Height', 'SillHeight'],
    },
    { source: 'instance', values: win, keys: ['sillHeightMm'] },
  ]);
  return {
    source: strongerDimensionSource(width.source, height.source, sill.source),
    dimensionsMm: compactNumberRecord({
      widthMm: width.value,
      heightMm: height.value,
      sillHeightMm: sill.value,
    }),
    skippedSubfeatures: [],
  };
}

function loadedFamilyDimensions(
  def: FamilyDefinition | null,
  typeParams: Record<string, unknown>,
  instanceParams: Record<string, unknown> | undefined,
): { source: DimensionSource; dimensionsMm: Record<string, number> } {
  const merged = { ...defaultLengthParams(def), ...typeParams, ...(instanceParams ?? {}) };
  const out: Record<string, number> = {};
  for (const key of Object.keys(merged).sort((a, b) => a.localeCompare(b))) {
    if (!isDimensionParamKey(key, def?.params)) continue;
    const value = numberValue(merged[key]);
    if (value != null) out[key] = value;
  }
  const instanceKeys = new Set(Object.keys(instanceParams ?? {}));
  const typeKeys = new Set(Object.keys(typeParams));
  const source = Object.keys(out).some((key) => instanceKeys.has(key))
    ? 'override'
    : Object.keys(out).some((key) => typeKeys.has(key))
      ? 'family-type'
      : Object.keys(out).length
        ? 'family-default'
        : 'not_applicable';
  return { source, dimensionsMm: out };
}

function defaultLengthParams(def: FamilyDefinition | null): Record<string, unknown> {
  if (!def) return {};
  return Object.fromEntries(
    def.params
      .filter((param) => param.type === 'length_mm')
      .map((param) => [param.key, param.default]),
  );
}

function isDimensionParamKey(key: string, params: FamilyParamDef[] | undefined): boolean {
  if (params?.some((param) => param.key === key && param.type === 'length_mm')) return true;
  return (
    DIMENSION_PARAM_HINTS.includes(key) ||
    /(?:Width|Height|Depth|Length|Radius|Diameter)Mm$/.test(key)
  );
}

function readNumberWithSource(
  candidates: Array<{
    source: DimensionSource;
    values: Record<string, unknown> | undefined;
    keys: string[];
  }>,
): { value: number | null; source: DimensionSource } {
  for (const candidate of candidates) {
    for (const key of candidate.keys) {
      const value = numberValue(candidate.values?.[key]);
      if (value != null) return { value, source: candidate.source };
    }
  }
  return { value: null, source: 'not_applicable' };
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactNumberRecord(values: Record<string, number | null>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, number] => entry[1] != null),
  );
}

function strongerDimensionSource(...sources: DimensionSource[]): DimensionSource {
  const rank: Record<DimensionSource, number> = {
    override: 0,
    'family-type': 1,
    instance: 2,
    'family-default': 3,
    'host-fallback': 4,
    not_applicable: 5,
  };
  return [...sources].sort((a, b) => rank[a] - rank[b])[0] ?? 'not_applicable';
}

function lensStatus(
  element: Element,
  options: { lensMode?: LensMode | null; viewLensMode?: ViewLensMode | null },
): ElementLensRenderStatus {
  if (options.viewLensMode) {
    const visibility = resolveLensFilter({ defaultLens: options.viewLensMode })(element);
    return {
      mode: options.viewLensMode,
      source: 'view-lens',
      visibility,
      ghostingSupported: true,
      ghostOpacity: visibility === 'ghost' ? LENS_GHOST_OPACITY : null,
      skippedSubfeatures: [],
    };
  }
  if (options.lensMode) {
    const visibility = lensFilterFromMode(options.lensMode)(element);
    return {
      mode: options.lensMode,
      source: 'ui-lens',
      visibility,
      ghostingSupported: true,
      ghostOpacity: visibility === 'ghost' ? LENS_GHOST_OPACITY : null,
      skippedSubfeatures: [],
    };
  }
  return {
    mode: 'none',
    source: 'none',
    visibility: 'not_applicable',
    ghostingSupported: false,
    ghostOpacity: null,
    skippedSubfeatures: ['lens.no_lens_context'],
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
