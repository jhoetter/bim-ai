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

export type ElementAssetRenderStatus = {
  state: RenderFeatureState;
  assetId: string | null;
  assetKind: string | null;
  renderProxyKind: string | null;
  proxyFallback: boolean;
  skippedSubfeatures: string[];
};

export type ElementGeometryRenderStatus = {
  state: RenderFeatureState;
  feature:
    | 'native-geometry'
    | 'wall-geometry'
    | 'hosted-opening-cut'
    | 'roof-geometry'
    | 'roof-opening-cut'
    | 'slab-opening-cut'
    | 'stair-geometry'
    | 'railing-geometry'
    | 'room-visualization'
    | 'diagnostic-helper'
    | 'not_applicable';
  implementation:
    | 'native'
    | 'analytic-cut'
    | 'diagnostic-overlay'
    | 'procedural-proxy'
    | 'proxy-fallback'
    | 'not_rendered'
    | 'unknown';
  diagnosticCodes: string[];
  blocking: boolean;
  skippedSubfeatures: string[];
};

export type ElementRenderImplementationStatus = {
  state: RenderFeatureState;
  geometryImplementation:
    | 'native'
    | 'analytic-cut'
    | 'diagnostic-overlay'
    | 'procedural-proxy'
    | 'proxy-fallback'
    | 'not_rendered'
    | 'unknown';
  materialImplementation: ElementMaterialRenderStatus['source'];
  skippedSubfeatures: string[];
};

export type ElementExportRenderStatus = {
  state: RenderFeatureState;
  viewport3d: RenderFeatureState;
  plan: RenderFeatureState;
  sheet: RenderFeatureState;
  export: RenderFeatureState;
  skippedSubfeatures: string[];
};

export type ElementRenderFeatureStatus = {
  format: 'elementRenderFeatureStatus_v1';
  elementId: string;
  kind: Element['kind'];
  material: ElementMaterialRenderStatus;
  geometry: ElementGeometryRenderStatus;
  family: ElementFamilyRenderStatus;
  asset: ElementAssetRenderStatus;
  lens: ElementLensRenderStatus;
  implementation: ElementRenderImplementationStatus;
  exportSupport: ElementExportRenderStatus;
  diagnosticCodes: string[];
  blocking: boolean;
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
  const geometry = geometryStatus(element);
  const family = familyStatus(element, elementsById, materialEntry);
  const asset = assetStatus(element, elementsById);
  const lens = lensStatus(element, options);
  const skippedSubfeatures = uniqueSorted([
    ...geometry.skippedSubfeatures,
    ...material.flags.map((flag) => `material.${flag}`),
    ...family.skippedSubfeatures,
    ...asset.skippedSubfeatures,
    ...lens.skippedSubfeatures,
  ]);
  const implementation = implementationStatus(
    material,
    geometry,
    family,
    asset,
    skippedSubfeatures,
  );
  const exportSupport = exportStatus(element, geometry, implementation);
  const diagnosticCodes = diagnosticCodesFor(material, geometry, family, asset);

  return {
    format: 'elementRenderFeatureStatus_v1',
    elementId: element.id,
    kind: element.kind,
    material,
    geometry,
    family,
    asset,
    lens,
    implementation,
    exportSupport,
    diagnosticCodes,
    blocking:
      geometry.blocking ||
      material.state === 'unresolved' ||
      family.state === 'unsupported' ||
      asset.state === 'unsupported',
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

function notApplicableAssetStatus(): ElementAssetRenderStatus {
  return {
    state: 'not_applicable',
    assetId: null,
    assetKind: null,
    renderProxyKind: null,
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

function assetStatus(
  element: Element,
  elementsById: Record<string, Element>,
): ElementAssetRenderStatus {
  if (element.kind !== 'placed_asset') return notApplicableAssetStatus();
  const entry = elementsById[element.assetId];
  if (entry?.kind !== 'asset_library_entry') {
    return {
      state: 'unsupported',
      assetId: element.assetId,
      assetKind: null,
      renderProxyKind: null,
      proxyFallback: true,
      skippedSubfeatures: ['asset.asset_entry_not_found', 'asset.proxy_fallback'],
    };
  }
  const renderProxyKind = (entry as { renderProxyKind?: string | null }).renderProxyKind ?? null;
  const assetKind = (entry as { assetKind?: string | null }).assetKind ?? null;
  const skipped: string[] = [];
  if (!renderProxyKind) skipped.push('asset.render_proxy_kind_missing');
  if (assetKind !== 'family_instance') skipped.push('asset.procedural_proxy_render');
  return {
    state: renderProxyKind ? (skipped.length ? 'partial' : 'supported') : 'unsupported',
    assetId: element.assetId,
    assetKind,
    renderProxyKind,
    proxyFallback: !renderProxyKind,
    skippedSubfeatures: uniqueSorted(skipped),
  };
}

function geometryStatus(element: Element): ElementGeometryRenderStatus {
  const markers = unsupportedRenderFeatureMarkers(element);
  const markerDiagnostics = markers.length ? [geometryUnsupportedCode(element)] : [];
  const markerSkipped = markers.map((marker) => `geometry.unsupported.${marker}`);
  const props = (element as { props?: Record<string, unknown> }).props ?? {};

  switch (element.kind) {
    case 'wall': {
      const length = distance(element.start, element.end);
      const invalid =
        length < 1 || !positiveNumber(element.thicknessMm) || !positiveNumber(element.heightMm);
      return geometryResult({
        state: invalid || markers.length ? 'unsupported' : 'supported',
        feature: 'wall-geometry',
        implementation: 'native',
        diagnosticCodes: [
          ...(invalid ? ['renderer.wall_geometry.degenerate'] : []),
          ...markerDiagnostics,
        ],
        blocking: invalid || markers.length > 0,
        skippedSubfeatures: [...(invalid ? ['geometry.wall_degenerate'] : []), ...markerSkipped],
      });
    }

    case 'door':
    case 'window':
    case 'wall_opening':
      return geometryResult({
        state: markers.length ? 'unsupported' : 'partial',
        feature: 'hosted-opening-cut',
        implementation: 'analytic-cut',
        diagnosticCodes: markerDiagnostics,
        blocking: markers.length > 0,
        skippedSubfeatures: ['geometry.hosted_opening_cut_parity_partial', ...markerSkipped],
      });

    case 'roof': {
      const mode = String(
        (element as { roofGeometryMode?: unknown; shape?: unknown }).roofGeometryMode ??
          (element as { shape?: unknown }).shape ??
          'flat',
      );
      const unsupportedMode = !knownRoofGeometryMode(mode);
      const partialMode = mode !== 'flat';
      return geometryResult({
        state:
          unsupportedMode || markers.length ? 'unsupported' : partialMode ? 'partial' : 'supported',
        feature: 'roof-geometry',
        implementation: 'native',
        diagnosticCodes: [
          ...(unsupportedMode ? ['renderer.roof_geometry.unsupported'] : []),
          ...markerDiagnostics,
        ],
        blocking: unsupportedMode || markers.length > 0,
        skippedSubfeatures: [
          ...(partialMode && !unsupportedMode ? [`geometry.roof_${mode}_parity_partial`] : []),
          ...(unsupportedMode ? [`geometry.roof_${mode}_unsupported`] : []),
          ...markerSkipped,
        ],
      });
    }

    case 'roof_opening':
      return geometryResult({
        state: markers.length ? 'unsupported' : 'partial',
        feature: 'roof-opening-cut',
        implementation: 'analytic-cut',
        diagnosticCodes: markerDiagnostics,
        blocking: markers.length > 0,
        skippedSubfeatures: ['geometry.roof_opening_cut_parity_partial', ...markerSkipped],
      });

    case 'slab_opening':
      return geometryResult({
        state: markers.length ? 'unsupported' : 'partial',
        feature: 'slab-opening-cut',
        implementation: 'analytic-cut',
        diagnosticCodes: markerDiagnostics,
        blocking: markers.length > 0,
        skippedSubfeatures: ['geometry.slab_opening_cut_parity_partial', ...markerSkipped],
      });

    case 'stair': {
      const shape = (element as { shape?: string }).shape;
      const unsupportedShape = !knownStairShape(shape);
      return geometryResult({
        state: unsupportedShape || markers.length ? 'unsupported' : 'partial',
        feature: 'stair-geometry',
        implementation: 'native',
        diagnosticCodes: [
          ...(unsupportedShape ? ['renderer.stair_geometry.unsupported_shape'] : []),
          ...markerDiagnostics,
        ],
        blocking: unsupportedShape || markers.length > 0,
        skippedSubfeatures: [
          'geometry.stair_export_parity_partial',
          ...(unsupportedShape ? [`geometry.stair_shape_${shape ?? 'unknown'}_unsupported`] : []),
          ...markerSkipped,
        ],
      });
    }

    case 'railing': {
      const balusterRule = (element as { balusterPattern?: { rule?: string } }).balusterPattern
        ?.rule;
      const unsupportedBaluster = !knownBalusterRule(balusterRule);
      const requiresHostedEdge =
        props.requiresHostedEdge === true ||
        (element as { requiresHostedEdge?: boolean }).requiresHostedEdge === true;
      const missingHostEdge = requiresHostedEdge && !hasRailingHostEdgeEvidence(element);
      return geometryResult({
        state: unsupportedBaluster || missingHostEdge || markers.length ? 'unsupported' : 'partial',
        feature: 'railing-geometry',
        implementation: 'native',
        diagnosticCodes: [
          ...(unsupportedBaluster
            ? ['renderer.railing_geometry.unsupported_baluster_pattern']
            : []),
          ...(missingHostEdge ? ['renderer.railing_geometry.missing_host_edge'] : []),
          ...markerDiagnostics,
        ],
        blocking: unsupportedBaluster || missingHostEdge || markers.length > 0,
        skippedSubfeatures: [
          'geometry.railing_export_parity_partial',
          ...(unsupportedBaluster
            ? [`geometry.railing_baluster_${balusterRule ?? 'unknown'}_unsupported`]
            : []),
          ...(missingHostEdge ? ['geometry.railing_host_edge_missing'] : []),
          ...markerSkipped,
        ],
      });
    }

    case 'room': {
      const unsupportedVolume = props.render3dVolume === true || props.showRoomVolume === true;
      return geometryResult({
        state: unsupportedVolume || markers.length ? 'partial' : 'supported',
        feature: 'room-visualization',
        implementation: 'diagnostic-overlay',
        diagnosticCodes: [
          ...(unsupportedVolume ? ['renderer.room_visualization.volume_unsupported'] : []),
          ...markerDiagnostics,
        ],
        blocking: markers.length > 0,
        skippedSubfeatures: [
          ...(unsupportedVolume ? ['geometry.room_3d_volume_unsupported'] : []),
          ...markerSkipped,
        ],
      });
    }

    case 'room_separation':
      return geometryResult({
        state: markers.length ? 'unsupported' : 'supported',
        feature: 'diagnostic-helper',
        implementation: 'diagnostic-overlay',
        diagnosticCodes: markerDiagnostics,
        blocking: markers.length > 0,
        skippedSubfeatures: markerSkipped,
      });

    case 'family_instance':
    case 'placed_asset':
      return geometryResult({
        state: 'not_applicable',
        feature: 'not_applicable',
        implementation: 'not_rendered',
        diagnosticCodes: [],
        blocking: false,
        skippedSubfeatures: [],
      });

    default:
      return geometryResult({
        state: markers.length ? 'unsupported' : 'supported',
        feature: 'native-geometry',
        implementation: 'native',
        diagnosticCodes: markerDiagnostics,
        blocking: markers.length > 0,
        skippedSubfeatures: markerSkipped,
      });
  }
}

function geometryResult(status: ElementGeometryRenderStatus): ElementGeometryRenderStatus {
  return {
    ...status,
    diagnosticCodes: uniqueSorted(status.diagnosticCodes),
    skippedSubfeatures: uniqueSorted(status.skippedSubfeatures),
  };
}

function implementationStatus(
  material: ElementMaterialRenderStatus,
  geometry: ElementGeometryRenderStatus,
  family: ElementFamilyRenderStatus,
  asset: ElementAssetRenderStatus,
  skippedSubfeatures: string[],
): ElementRenderImplementationStatus {
  const state = strongestFeatureState([
    geometry.state,
    materialFeatureState(material),
    family.state,
    asset.state,
  ]);
  return {
    state,
    geometryImplementation: geometryImplementationFor(geometry, family, asset),
    materialImplementation: material.source,
    skippedSubfeatures,
  };
}

function exportStatus(
  element: Element,
  geometry: ElementGeometryRenderStatus,
  implementation: ElementRenderImplementationStatus,
): ElementExportRenderStatus {
  const booleanCutKinds = new Set([
    'door',
    'window',
    'wall_opening',
    'slab_opening',
    'roof_opening',
  ]);
  const partialKinds = new Set(['stair', 'railing', 'family_instance', 'placed_asset']);
  const state: RenderFeatureState =
    implementation.state === 'unsupported'
      ? 'unsupported'
      : booleanCutKinds.has(element.kind) || partialKinds.has(element.kind)
        ? 'partial'
        : geometry.state === 'partial'
          ? 'partial'
          : 'supported';
  const skippedSubfeatures = state === 'partial' ? [`export.${element.kind}_parity_partial`] : [];
  return {
    state,
    viewport3d: implementation.state,
    plan: state === 'unsupported' ? 'unsupported' : 'partial',
    sheet: state,
    export: state,
    skippedSubfeatures,
  };
}

function diagnosticCodesFor(
  material: ElementMaterialRenderStatus,
  geometry: ElementGeometryRenderStatus,
  family: ElementFamilyRenderStatus,
  asset: ElementAssetRenderStatus,
): string[] {
  const codes: string[] = [...geometry.diagnosticCodes];
  if (material.state === 'fallback') codes.push('renderer.material.fallback');
  if (material.state === 'unresolved') codes.push('renderer.material.unresolved');
  if (family.state === 'unsupported') codes.push('renderer.family_instance.unsupported');
  else if (family.proxyFallback) codes.push('renderer.family_instance.proxy_fallback');
  if (asset.state === 'unsupported') codes.push('renderer.asset_instance.unsupported');
  else if (asset.proxyFallback) codes.push('renderer.asset_instance.proxy_fallback');
  return uniqueSorted(codes);
}

function materialFeatureState(material: ElementMaterialRenderStatus): RenderFeatureState {
  if (material.state === 'unresolved') return 'unsupported';
  if (material.state === 'fallback') return 'partial';
  if (material.state === 'non_rendered') return 'not_applicable';
  return 'supported';
}

function strongestFeatureState(states: RenderFeatureState[]): RenderFeatureState {
  const rank: Record<RenderFeatureState, number> = {
    unsupported: 0,
    partial: 1,
    supported: 2,
    not_applicable: 3,
  };
  return [...states].sort((a, b) => rank[a] - rank[b])[0] ?? 'not_applicable';
}

function geometryImplementationFor(
  geometry: ElementGeometryRenderStatus,
  family: ElementFamilyRenderStatus,
  asset: ElementAssetRenderStatus,
): ElementRenderImplementationStatus['geometryImplementation'] {
  if (asset.state !== 'not_applicable') {
    return asset.proxyFallback ? 'proxy-fallback' : 'procedural-proxy';
  }
  if (family.state !== 'not_applicable') {
    return family.proxyFallback ? 'proxy-fallback' : 'native';
  }
  if (geometry.state !== 'not_applicable') return geometry.implementation;
  return 'native';
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

function unsupportedRenderFeatureMarkers(element: Element): string[] {
  const record = element as Element & {
    props?: Record<string, unknown>;
    unsupportedRenderFeatures?: unknown;
    rendererUnsupportedFeatures?: unknown;
  };
  const values = [
    record.unsupportedRenderFeatures,
    record.rendererUnsupportedFeatures,
    record.props?.unsupportedRenderFeatures,
    record.props?.rendererUnsupportedFeatures,
    nestedRecordValue(record.props?.renderDiagnostics, 'unsupportedFeatures'),
  ];
  return uniqueSorted(values.flatMap(normalizeMarkerList));
}

function geometryUnsupportedCode(element: Element): string {
  if (element.kind === 'wall') return 'renderer.wall_geometry.unsupported';
  if (element.kind === 'door' || element.kind === 'window' || element.kind === 'wall_opening') {
    return 'renderer.wall_cut.unsupported';
  }
  if (element.kind === 'roof') return 'renderer.roof_geometry.unsupported';
  if (element.kind === 'roof_opening') return 'renderer.roof_opening.unsupported';
  if (element.kind === 'slab_opening') return 'renderer.slab_opening.unsupported';
  if (element.kind === 'stair') return 'renderer.stair_geometry.unsupported';
  if (element.kind === 'railing') return 'renderer.railing_geometry.unsupported';
  if (element.kind === 'room' || element.kind === 'room_separation') {
    return 'renderer.room_visualization.unsupported';
  }
  return 'renderer.element_geometry.unsupported';
}

function nestedRecordValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[key];
}

function normalizeMarkerList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

function knownRoofGeometryMode(mode: string): boolean {
  return [
    'flat',
    'mass_box',
    'shed',
    'gable',
    'gable_pitched_rectangle',
    'gable_pitched_l_shape',
    'asymmetric_gable',
    'hip',
    'hip_like',
    'mono_slope',
    'terrace',
    'sketch',
  ].includes(mode);
}

function knownStairShape(shape: string | undefined): boolean {
  return (
    shape === undefined ||
    shape === 'straight' ||
    shape === 'l_shape' ||
    shape === 'u_shape' ||
    shape === 'spiral' ||
    shape === 'sketch'
  );
}

function knownBalusterRule(rule: string | undefined): boolean {
  return (
    rule === undefined ||
    rule === 'regular' ||
    rule === 'glass_panel' ||
    rule === 'cable' ||
    rule === 'vertical'
  );
}

function hasRailingHostEdgeEvidence(railing: Extract<Element, { kind: 'railing' }>): boolean {
  if (railing.hostedStairId) return true;
  const direct = railing as {
    hostEdgeId?: string | null;
    hostedEdgeId?: string | null;
    floorEdgeId?: string | null;
    hostFloorId?: string | null;
    edgeRef?: string | null;
  };
  const hostEvidenceKeys = [
    'hostEdgeId',
    'hostedEdgeId',
    'floorEdgeId',
    'hostFloorId',
    'edgeRef',
  ] as const;
  if (hostEvidenceKeys.some((key) => typeof direct[key] === 'string' && direct[key]!.length > 0)) {
    return true;
  }
  const props = (railing as { props?: Record<string, unknown> }).props ?? {};
  return hostEvidenceKeys.some(
    (key) => typeof props[key] === 'string' && String(props[key]).length > 0,
  );
}

function positiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function distance(left: { xMm: number; yMm: number }, right: { xMm: number; yMm: number }): number {
  return Math.hypot(left.xMm - right.xMm, left.yMm - right.yMm);
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
