import type { Element } from '@bim-ai/core';

import { parseSheetViewRef, type SheetViewRefKind } from './sheetViewRef';

export type DocumentationFidelityRequirementId =
  | 'BIR-R01'
  | 'BIR-R02'
  | 'BIR-R03'
  | 'BIR-R04'
  | 'BIR-R05'
  | 'BIR-R06';

export type DocumentationFidelityStatus = 'pass' | 'warn' | 'fail';
export type DocumentationFidelitySeverity = 'warning' | 'error';
export type DocumentationFidelityDiagnosticCause =
  | 'model_invalidity'
  | 'renderer_unsupported'
  | 'renderer_dropped_visual_geometry'
  | 'export_unsupported'
  | 'export_dropped_visual_geometry'
  | 'evidence_missing';

export type DocumentationFidelityDiagnosticInput =
  | string
  | {
      code?: string;
      message?: string;
      cause?: DocumentationFidelityDiagnosticCause;
      issueClass?: string;
      rendererArea?: string;
      feature?: string;
      elementIds?: string[];
      viewId?: string | null;
      evidence?: Record<string, unknown>;
      trackerItems?: string[];
    };

export type DocumentationFidelityIssue = {
  id: string;
  requirementId: DocumentationFidelityRequirementId;
  severity: DocumentationFidelitySeverity;
  elementId?: string;
  cause?: DocumentationFidelityDiagnosticCause;
  evidence?: Record<string, unknown>;
  message: string;
};

export type DocumentationFidelityRow = {
  requirementId: DocumentationFidelityRequirementId;
  scopeId: string;
  status: DocumentationFidelityStatus;
  checks: Record<string, boolean | number | string | null>;
};

export type DocumentationFidelityContractResult = {
  requirementId: DocumentationFidelityRequirementId;
  status: DocumentationFidelityStatus;
  rows: DocumentationFidelityRow[];
  issues: DocumentationFidelityIssue[];
};

export const DOCUMENTATION_FIDELITY_CONTRACTS: Record<
  DocumentationFidelityRequirementId,
  { title: string; evidenceKey: string }
> = {
  'BIR-R01': {
    title: 'Plan-view fidelity contract',
    evidenceKey: 'planProjectionPrimitives_v1',
  },
  'BIR-R02': {
    title: 'Section/elevation fidelity contract',
    evidenceKey: 'sectionElevationFidelityEvidence_v1',
  },
  'BIR-R03': {
    title: 'Sheet viewport fidelity contract',
    evidenceKey: 'sheetViewportDocumentationFidelity_v1',
  },
  'BIR-R04': {
    title: 'Annotation/dimension integrity contract',
    evidenceKey: 'annotationDimensionIntegrity_v1',
  },
  'BIR-R05': {
    title: 'Documentation export parity contract',
    evidenceKey: 'documentationExportParity_v1',
  },
  'BIR-R06': {
    title: '2D golden fixture readiness contract',
    evidenceKey: 'twoDGoldenFixtureReadiness_v1',
  },
};

export type PlanFidelityFeature =
  | 'wall'
  | 'door'
  | 'window'
  | 'room'
  | 'stair'
  | 'slab_opening'
  | 'railing'
  | 'level'
  | 'annotation'
  | 'hidden_cut_graphics';

export type PlanViewFidelityInput = {
  elementsById: Record<string, Element>;
  primitiveCounts?: Record<string, number>;
  diagnostics?: DocumentationFidelityDiagnosticInput[];
  requiredFeatures?: PlanFidelityFeature[];
};

const PLAN_FEATURE_KIND_MAP: Record<PlanFidelityFeature, string[]> = {
  wall: ['wall'],
  door: ['door'],
  window: ['window'],
  room: ['room'],
  stair: ['stair'],
  slab_opening: ['slab_opening'],
  railing: ['railing'],
  level: ['level'],
  annotation: [
    'placed_tag',
    'text_note',
    'detail_line',
    'detail_region',
    'detail_filled_region',
    'masking_region',
    'spot_elevation',
    'annotation_symbol',
    'dimension',
    'permanent_dimension',
    'callout',
  ],
  hidden_cut_graphics: ['wall', 'floor', 'roof', 'stair', 'slab_opening'],
};

const DEFAULT_PLAN_FEATURES: PlanFidelityFeature[] = [
  'wall',
  'door',
  'window',
  'room',
  'stair',
  'slab_opening',
  'railing',
  'level',
  'annotation',
  'hidden_cut_graphics',
];

export function evaluatePlanViewFidelityContract(
  input: PlanViewFidelityInput,
): DocumentationFidelityContractResult {
  const rows: DocumentationFidelityRow[] = [];
  const issues: DocumentationFidelityIssue[] = [];
  const diagnostics = normalizedDiagnostics(input.diagnostics);
  const required = input.requiredFeatures ?? DEFAULT_PLAN_FEATURES;

  for (const feature of required) {
    const modelCount = countKinds(input.elementsById, PLAN_FEATURE_KIND_MAP[feature]);
    const renderedCount = planPrimitiveCount(input.primitiveCounts ?? {}, feature);
    const matchingDiagnostics = diagnosticsForToken(diagnostics, feature);
    const hasDiagnostic = matchingDiagnostics.length > 0;
    const applicable = modelCount > 0 || feature === 'hidden_cut_graphics';
    const cause = strongestDiagnosticCause(matchingDiagnostics);
    const renderedOrDiagnosed =
      renderedCount > 0 || (hasDiagnostic && cause !== 'model_invalidity');
    const satisfied = !applicable || renderedOrDiagnosed;
    const status: DocumentationFidelityStatus =
      !applicable || renderedCount > 0 ? 'pass' : satisfied ? 'warn' : 'fail';
    rows.push({
      requirementId: 'BIR-R01',
      scopeId: feature,
      status,
      checks: {
        modelCount,
        renderedCount,
        diagnosticPresent: hasDiagnostic,
        diagnosticCause: cause ?? null,
        diagnosticCodes: diagnosticCodes(matchingDiagnostics).join(','),
      },
    });
    if (!applicable || renderedCount > 0) {
      continue;
    }
    if (hasDiagnostic && cause !== 'model_invalidity') {
      issues.push(
        issue(
          'BIR-R01',
          'warning',
          `plan_${feature}_covered_by_diagnostic`,
          `Plan feature "${feature}" is not rendered but has explicit renderer/export diagnostic evidence.`,
          undefined,
          cause,
          diagnosticEvidence(matchingDiagnostics),
        ),
      );
    } else if (cause === 'model_invalidity') {
      issues.push(
        issue(
          'BIR-R01',
          'error',
          `plan_${feature}_blocked_by_model_invalidity`,
          `Plan feature "${feature}" cannot be evaluated as renderer fidelity because model invalidity was reported.`,
          undefined,
          cause,
          diagnosticEvidence(matchingDiagnostics),
        ),
      );
    } else {
      issues.push(
        issue(
          'BIR-R01',
          'error',
          `plan_${feature}_missing_render_or_diagnostic`,
          `Plan feature "${feature}" has model coverage but no rendered primitive or diagnostic.`,
          undefined,
          'evidence_missing',
        ),
      );
    }
  }

  return result('BIR-R01', rows, issues);
}

export type SectionElevationEvidenceRow = {
  viewId: string;
  viewKind: 'section' | 'elevation';
  cutPlanePresent?: boolean;
  viewDepthMm?: number | null;
  sectionBoxPresent?: boolean;
  hiddenLineCount?: number;
  openingCutCount?: number;
  stairProjectionCount?: number;
  roofProjectionCount?: number;
  floorProjectionCount?: number;
  materialHatchCount?: number;
  diagnostics?: DocumentationFidelityDiagnosticInput[];
};

export type SectionElevationFidelityInput = {
  elementsById: Record<string, Element>;
  evidenceRows: SectionElevationEvidenceRow[];
};

export function evaluateSectionElevationFidelityContract(
  input: SectionElevationFidelityInput,
): DocumentationFidelityContractResult {
  const rows: DocumentationFidelityRow[] = [];
  const issues: DocumentationFidelityIssue[] = [];
  const evidenceByView = new Map(input.evidenceRows.map((row) => [row.viewId, row]));
  const viewElements = Object.values(input.elementsById)
    .filter((el) => el.kind === 'section_cut' || el.kind === 'elevation_view')
    .sort((a, b) => a.id.localeCompare(b.id));
  const hasOpenings = countKinds(input.elementsById, ['door', 'window', 'slab_opening']) > 0;
  const hasStairs = countKinds(input.elementsById, ['stair']) > 0;
  const hasRoofs = countKinds(input.elementsById, ['roof']) > 0;
  const hasFloors = countKinds(input.elementsById, ['floor']) > 0;
  const hasMaterializedElements = Object.values(input.elementsById).some((el) => {
    const raw = el as Record<string, unknown>;
    return typeof raw.materialKey === 'string' || typeof raw.materialId === 'string';
  });

  for (const view of viewElements) {
    const ev = evidenceByView.get(view.id);
    const diagnostics = normalizedDiagnostics(ev?.diagnostics);
    const isSection = view.kind === 'section_cut';
    const checks = {
      evidencePresent: Boolean(ev),
      cutPlanePresent: isSection ? Boolean(ev?.cutPlanePresent) : true,
      viewDepthPresent: positiveNumber(ev?.viewDepthMm),
      sectionBoxPresent: Boolean(ev?.sectionBoxPresent),
      hiddenLinesHandled:
        positiveNumber(ev?.hiddenLineCount) || diagnosticsCover(diagnostics, 'hidden'),
      openingsHandled:
        !hasOpenings ||
        positiveNumber(ev?.openingCutCount) ||
        diagnosticsCover(diagnostics, 'opening'),
      stairsHandled:
        !hasStairs ||
        positiveNumber(ev?.stairProjectionCount) ||
        diagnosticsCover(diagnostics, 'stair'),
      roofsHandled:
        !hasRoofs ||
        positiveNumber(ev?.roofProjectionCount) ||
        diagnosticsCover(diagnostics, 'roof'),
      floorsHandled:
        !hasFloors ||
        positiveNumber(ev?.floorProjectionCount) ||
        diagnosticsCover(diagnostics, 'floor'),
      materialsHandled:
        !hasMaterializedElements ||
        positiveNumber(ev?.materialHatchCount) ||
        diagnosticsCover(diagnostics, 'material'),
    };
    const failed = Object.values(checks).some((value) => value === false);
    rows.push({
      requirementId: 'BIR-R02',
      scopeId: view.id,
      status: failed ? 'fail' : 'pass',
      checks: {
        ...checks,
        diagnosticCauses: diagnosticCauses(diagnostics).join(','),
        diagnosticCodes: diagnosticCodes(diagnostics).join(','),
      },
    });
    for (const [check, ok] of Object.entries(checks)) {
      if (ok !== false) continue;
      const relatedDiagnostics = diagnosticsForToken(
        diagnostics,
        sectionElevationCheckToken(check),
      );
      const cause = strongestDiagnosticCause(relatedDiagnostics);
      issues.push(
        issue(
          'BIR-R02',
          'error',
          cause === 'model_invalidity'
            ? `section_elevation_${check}_model_invalidity`
            : `section_elevation_${check}`,
          cause === 'model_invalidity'
            ? `Section/elevation view "${view.id}" failed ${check} because related model invalidity was reported.`
            : `Section/elevation view "${view.id}" failed ${check}.`,
          view.id,
          cause ?? 'evidence_missing',
          diagnosticEvidence(relatedDiagnostics),
        ),
      );
    }
  }

  if (!viewElements.length) {
    issues.push(
      issue(
        'BIR-R02',
        'warning',
        'section_elevation_no_views',
        'No section or elevation views are present for the fidelity contract.',
      ),
    );
  }

  return result('BIR-R02', rows, issues);
}

export type SheetViewportEvidenceHint = {
  viewportId?: unknown;
  planProjectionSegment?: unknown;
  sectionDocumentationSegment?: unknown;
  scheduleDocumentationSegment?: unknown;
  evidenceHref?: unknown;
};

export type SheetViewportFidelityInput = {
  elementsById: Record<string, Element>;
  sheetId: string;
  evidenceHints?: SheetViewportEvidenceHint[];
  diagnostics?: DocumentationFidelityDiagnosticInput[];
};

export function evaluateSheetViewportFidelityContract(
  input: SheetViewportFidelityInput,
): DocumentationFidelityContractResult {
  const rows: DocumentationFidelityRow[] = [];
  const issues: DocumentationFidelityIssue[] = [];
  const diagnostics = normalizedDiagnostics(input.diagnostics);
  const sheet = input.elementsById[input.sheetId];
  if (!sheet || sheet.kind !== 'sheet') {
    return result('BIR-R03', rows, [
      issue(
        'BIR-R03',
        'error',
        'sheet_missing',
        `Sheet "${input.sheetId}" is missing.`,
        input.sheetId,
        'model_invalidity',
      ),
    ]);
  }

  const hints = new Map(
    (input.evidenceHints ?? [])
      .map((hint) => [String(hint.viewportId ?? '').trim(), hint] as const)
      .filter(([viewportId]) => Boolean(viewportId)),
  );
  const viewports = Array.isArray(sheet.viewportsMm) ? sheet.viewportsMm : [];
  viewports.forEach((rawViewport, index) => {
    const vp = rawViewport as Record<string, unknown>;
    const viewportId = String(vp.viewportId ?? vp.viewport_id ?? `viewport-${index}`);
    const parsed = parseSheetViewRef(vp.viewRef ?? vp.view_ref);
    const refElement = parsed?.refId ? input.elementsById[parsed.refId] : undefined;
    const cropMin = vp.cropMinMm ?? vp.crop_min_mm;
    const cropMax = vp.cropMaxMm ?? vp.crop_max_mm;
    const hint = hints.get(viewportId);
    const isSchedule = parsed?.kind === 'schedule';
    const evidenceLinked = viewportEvidenceLinked(parsed?.kind, hint);
    const checks = {
      viewRefResolved: Boolean(parsed && parsed.kind !== 'unknown' && refElement),
      positiveExtent:
        positiveNumber(vp.widthMm ?? vp.width_mm) && positiveNumber(vp.heightMm ?? vp.height_mm),
      scalePreserved:
        isSchedule || Boolean(String(vp.scale ?? vp.scaleDenom ?? vp.scale_denom ?? '').trim()),
      cropPreserved: isSchedule || (isPlainObject(cropMin) && isPlainObject(cropMax)),
      disciplineOrLensPreserved: Boolean(
        String(
          vp.discipline ??
            vp.lens ??
            (refElement as Record<string, unknown> | undefined)?.discipline ??
            '',
        ).trim(),
      ),
      graphicsModePreserved: Boolean(
        String(
          vp.graphicsMode ??
            vp.graphics_mode ??
            (refElement as Record<string, unknown> | undefined)?.graphicsMode ??
            '',
        ).trim(),
      ),
      titlePreserved: Boolean(
        String(
          vp.label ?? vp.title ?? (refElement as { name?: unknown } | undefined)?.name ?? '',
        ).trim(),
      ),
      schedulePlacementPreserved:
        !isSchedule || Boolean(refElement && refElement.kind === 'schedule'),
      evidenceLinked,
    };
    const failed = Object.values(checks).some((value) => value === false);
    rows.push({
      requirementId: 'BIR-R03',
      scopeId: viewportId,
      status: failed ? 'fail' : 'pass',
      checks: {
        ...checks,
        normalizedRef: parsed?.normalizedRef ?? '',
        diagnosticCauses: diagnosticCauses(diagnosticsForToken(diagnostics, viewportId)).join(','),
        diagnosticCodes: diagnosticCodes(diagnosticsForToken(diagnostics, viewportId)).join(','),
      },
    });
    for (const [check, ok] of Object.entries(checks)) {
      if (ok !== false) continue;
      const relatedDiagnostics = [
        ...diagnosticsForToken(diagnostics, viewportId),
        ...diagnosticsForToken(diagnostics, 'sheet-viewport'),
      ];
      const cause =
        strongestDiagnosticCause(relatedDiagnostics) ??
        (check === 'evidenceLinked' ? 'evidence_missing' : 'model_invalidity');
      issues.push(
        issue(
          'BIR-R03',
          'error',
          `sheet_viewport_${check}`,
          `Sheet viewport "${viewportId}" failed ${check}.`,
          viewportId,
          cause,
          diagnosticEvidence(relatedDiagnostics),
        ),
      );
    }
  });

  if (!viewports.length) {
    issues.push(
      issue(
        'BIR-R03',
        'warning',
        'sheet_viewport_none',
        `Sheet "${sheet.id}" has no viewports.`,
        sheet.id,
        'evidence_missing',
      ),
    );
  }

  return result('BIR-R03', rows, issues);
}

export type AnnotationDimensionIntegrityInput = {
  elementsById: Record<string, Element>;
};

export function evaluateAnnotationDimensionIntegrityContract(
  input: AnnotationDimensionIntegrityInput,
): DocumentationFidelityContractResult {
  const rows: DocumentationFidelityRow[] = [];
  const issues: DocumentationFidelityIssue[] = [];
  const elements = Object.values(input.elementsById).sort((a, b) => a.id.localeCompare(b.id));

  for (const el of elements) {
    const raw = el as Record<string, unknown>;
    if (!isAnnotationOrDimensionKind(el.kind)) continue;
    const viewId = firstString(raw.hostViewId, raw.viewId, raw.levelId);
    const hostElementId = firstString(raw.hostElementId, raw.targetElementId);
    const refIds = referencedElementIds(raw);
    const checks = {
      hostViewResolved: !viewId || Boolean(input.elementsById[viewId]),
      hostElementResolved: !hostElementId || Boolean(input.elementsById[hostElementId]),
      witnessRefsResolved: refIds.every((id) => Boolean(input.elementsById[id])),
      dimensionStateMatchesRefs:
        el.kind !== 'dimension' ||
        refIds.every((id) => Boolean(input.elementsById[id])) ||
        raw.state === 'partial' ||
        raw.state === 'unlinked',
      permanentDimensionHasWitnesses:
        el.kind !== 'permanent_dimension' ||
        (Array.isArray(raw.witnessPointsMm) && raw.witnessPointsMm.length >= 2),
      detailRegionClosed:
        el.kind !== 'detail_region' || raw.closed !== false || Array.isArray(raw.boundaryMm),
    };
    const failed = Object.values(checks).some((value) => value === false);
    rows.push({
      requirementId: 'BIR-R04',
      scopeId: el.id,
      status: failed ? 'fail' : 'pass',
      checks: {
        ...checks,
        kind: el.kind,
        referencedElementCount: refIds.length + (hostElementId ? 1 : 0),
      },
    });
    for (const [check, ok] of Object.entries(checks)) {
      if (ok !== false) continue;
      issues.push(
        issue(
          'BIR-R04',
          'error',
          `annotation_dimension_${check}`,
          `Annotation/dimension "${el.id}" failed ${check}.`,
          el.id,
          'model_invalidity',
          {
            kind: el.kind,
            referencedElementIds: refIds,
            hostElementId: hostElementId || null,
            hostViewId: viewId || null,
          },
        ),
      );
    }
  }

  return result('BIR-R04', rows, issues);
}

export type DocumentationExportParityRow = {
  scopeId: string;
  exportType: 'pdf' | 'render_bundle' | 'sheet_svg' | 'sheet_png' | 'other';
  savedViewDigest: string;
  exportDigest: string;
  unsupportedFeatures?: string[];
  listedUnsupportedFeatures?: string[];
  droppedVisualGeometry?: string[];
  listedDroppedVisualGeometry?: string[];
  modelInvalidFeatures?: string[];
};

export type DocumentationExportParityInput = {
  rows: DocumentationExportParityRow[];
};

export function evaluateDocumentationExportParityContract(
  input: DocumentationExportParityInput,
): DocumentationFidelityContractResult {
  const rows: DocumentationFidelityRow[] = [];
  const issues: DocumentationFidelityIssue[] = [];

  for (const row of [...input.rows].sort((a, b) => a.scopeId.localeCompare(b.scopeId))) {
    const unsupported = [...(row.unsupportedFeatures ?? [])].sort();
    const dropped = [...(row.droppedVisualGeometry ?? [])].sort();
    const modelInvalid = [...(row.modelInvalidFeatures ?? [])].sort();
    const listed = new Set(row.listedUnsupportedFeatures ?? []);
    const listedDropped = new Set(row.listedDroppedVisualGeometry ?? []);
    const unlistedUnsupported = unsupported.filter((feature) => !listed.has(feature));
    const unlistedDropped = dropped.filter((feature) => !listedDropped.has(feature));
    const digestsMatch = row.savedViewDigest === row.exportDigest;
    const unsupportedListed = unlistedUnsupported.length === 0;
    const droppedListed = unlistedDropped.length === 0;
    const explicitDivergenceEvidence =
      unsupported.length > 0 || dropped.length > 0 || modelInvalid.length > 0;
    const checks = {
      digestsMatch,
      unsupportedFeaturesListed: unsupportedListed,
      droppedVisualGeometryListed: droppedListed,
      unsupportedFeatureCount: unsupported.length,
      droppedVisualGeometryCount: dropped.length,
      modelInvalidFeatureCount: modelInvalid.length,
      exportType: row.exportType,
    };
    const status: DocumentationFidelityStatus = modelInvalid.length
      ? 'fail'
      : digestsMatch
        ? 'pass'
        : explicitDivergenceEvidence && unsupportedListed && droppedListed
          ? 'warn'
          : 'fail';
    rows.push({
      requirementId: 'BIR-R05',
      scopeId: row.scopeId,
      status,
      checks,
    });
    if (!unsupportedListed) {
      issues.push(
        issue(
          'BIR-R05',
          'error',
          'documentation_export_unsupported_unlisted',
          `Export "${row.scopeId}" has unsupported features not listed in evidence: ${unlistedUnsupported.join(', ')}.`,
          row.scopeId,
          'export_unsupported',
          { unlistedUnsupported },
        ),
      );
    }
    if (!droppedListed) {
      issues.push(
        issue(
          'BIR-R05',
          'error',
          'documentation_export_dropped_geometry_unlisted',
          `Export "${row.scopeId}" dropped visual geometry not listed in evidence: ${unlistedDropped.join(', ')}.`,
          row.scopeId,
          'export_dropped_visual_geometry',
          { unlistedDropped },
        ),
      );
    }
    if (modelInvalid.length) {
      issues.push(
        issue(
          'BIR-R05',
          'error',
          'documentation_export_blocked_by_model_invalidity',
          `Export "${row.scopeId}" includes model-invalid features: ${modelInvalid.join(', ')}.`,
          row.scopeId,
          'model_invalidity',
          { modelInvalidFeatures: modelInvalid },
        ),
      );
    }
    if (!digestsMatch && !explicitDivergenceEvidence) {
      issues.push(
        issue(
          'BIR-R05',
          'error',
          'documentation_export_digest_mismatch',
          `Export "${row.scopeId}" diverges from the saved view without an unsupported-feature explanation.`,
          row.scopeId,
          'evidence_missing',
        ),
      );
    } else if (
      !digestsMatch &&
      explicitDivergenceEvidence &&
      unsupportedListed &&
      droppedListed &&
      !modelInvalid.length
    ) {
      issues.push(
        issue(
          'BIR-R05',
          'warning',
          'documentation_export_digest_mismatch_supported_by_evidence',
          `Export "${row.scopeId}" diverges only through listed unsupported or dropped visual geometry evidence.`,
          row.scopeId,
          dropped.length > 0 ? 'export_dropped_visual_geometry' : 'export_unsupported',
          { unsupportedFeatures: unsupported, droppedVisualGeometry: dropped },
        ),
      );
    }
  }

  return result('BIR-R05', rows, issues);
}

export type TwoDGoldenSurface = 'plan' | 'section' | 'elevation' | 'sheet';
export type TwoDGoldenFeature =
  | 'hosted_openings'
  | 'roof_cuts'
  | 'stairs'
  | 'rooms'
  | 'annotations'
  | 'lens_modes';

export type TwoDGoldenFixture = {
  id: string;
  surface: TwoDGoldenSurface;
  features: TwoDGoldenFeature[];
  evidencePath?: string;
  diagnosticEvidenceKey?: string;
};

export type TwoDGoldenFixtureReadinessInput = {
  fixtures: TwoDGoldenFixture[];
  requiredSurfaces?: TwoDGoldenSurface[];
  requiredFeatures?: TwoDGoldenFeature[];
  requireEvidencePaths?: boolean;
};

const DEFAULT_GOLDEN_SURFACES: TwoDGoldenSurface[] = ['plan', 'section', 'elevation', 'sheet'];
const DEFAULT_GOLDEN_FEATURES: TwoDGoldenFeature[] = [
  'hosted_openings',
  'roof_cuts',
  'stairs',
  'rooms',
  'annotations',
  'lens_modes',
];

export const TWO_D_DOCUMENTATION_GOLDEN_FIXTURES: TwoDGoldenFixture[] = [
  {
    id: 'e2e-plan-hosted-openings-rooms',
    surface: 'plan',
    features: ['hosted_openings', 'roof_cuts', 'stairs', 'rooms', 'annotations', 'lens_modes'],
    evidencePath: 'packages/web/e2e/evidence-baselines.spec.ts#plan-eg-openings',
    diagnosticEvidenceKey: 'planProjectionPrimitives_v1',
  },
  {
    id: 'e2e-section-stairs-roof-cuts',
    surface: 'section',
    features: ['hosted_openings', 'roof_cuts', 'stairs', 'rooms', 'annotations', 'lens_modes'],
    evidencePath: 'packages/web/e2e/evidence-baselines.spec.ts#sectionProjectionWire_v1',
    diagnosticEvidenceKey: 'sectionElevationFidelityEvidence_v1',
  },
  {
    id: 'unit-elevation-projection-openings',
    surface: 'elevation',
    features: ['hosted_openings', 'roof_cuts', 'stairs', 'rooms', 'annotations', 'lens_modes'],
    evidencePath: 'packages/web/src/plan/elevationProjection.test.ts',
    diagnosticEvidenceKey: 'sectionElevationFidelityEvidence_v1',
  },
  {
    id: 'e2e-sheet-documentation-viewport',
    surface: 'sheet',
    features: ['hosted_openings', 'roof_cuts', 'stairs', 'rooms', 'annotations', 'lens_modes'],
    evidencePath: 'packages/web/e2e/evidence-baselines.spec.ts#coordination-sheet',
    diagnosticEvidenceKey: 'sheetViewportDocumentationFidelity_v1',
  },
];

export function evaluateTwoDGoldenFixtureReadinessContract(
  input: TwoDGoldenFixtureReadinessInput,
): DocumentationFidelityContractResult {
  const rows: DocumentationFidelityRow[] = [];
  const issues: DocumentationFidelityIssue[] = [];
  const requiredSurfaces = input.requiredSurfaces ?? DEFAULT_GOLDEN_SURFACES;
  const requiredFeatures = input.requiredFeatures ?? DEFAULT_GOLDEN_FEATURES;
  const requireEvidencePaths = input.requireEvidencePaths ?? true;
  const featuresBySurface = new Map<TwoDGoldenSurface, Set<TwoDGoldenFeature>>();
  const fixturesBySurface = new Map<TwoDGoldenSurface, TwoDGoldenFixture[]>();
  for (const fixture of input.fixtures) {
    const set = featuresBySurface.get(fixture.surface) ?? new Set<TwoDGoldenFeature>();
    fixture.features.forEach((feature) => set.add(feature));
    featuresBySurface.set(fixture.surface, set);
    const fixtures = fixturesBySurface.get(fixture.surface) ?? [];
    fixtures.push(fixture);
    fixturesBySurface.set(fixture.surface, fixtures);
  }

  for (const surface of requiredSurfaces) {
    const covered = featuresBySurface.get(surface) ?? new Set<TwoDGoldenFeature>();
    const fixtures = fixturesBySurface.get(surface) ?? [];
    const missing = requiredFeatures.filter((feature) => !covered.has(feature));
    const missingEvidence = requireEvidencePaths
      ? fixtures.filter((fixture) => !String(fixture.evidencePath ?? '').trim())
      : [];
    rows.push({
      requirementId: 'BIR-R06',
      scopeId: surface,
      status: missing.length || missingEvidence.length ? 'fail' : 'pass',
      checks: {
        fixtureCount: fixtures.length,
        coveredFeatureCount: covered.size,
        missingFeatures: missing.join(','),
        missingEvidenceFixtureIds: missingEvidence.map((fixture) => fixture.id).join(','),
      },
    });
    if (missing.length) {
      issues.push(
        issue(
          'BIR-R06',
          'error',
          `golden_fixture_${surface}_missing_features`,
          `2D golden surface "${surface}" is missing features: ${missing.join(', ')}.`,
          surface,
          'evidence_missing',
          { missingFeatures: missing },
        ),
      );
    }
    if (missingEvidence.length) {
      issues.push(
        issue(
          'BIR-R06',
          'error',
          `golden_fixture_${surface}_missing_evidence`,
          `2D golden surface "${surface}" has fixtures without evidence paths: ${missingEvidence.map((fixture) => fixture.id).join(', ')}.`,
          surface,
          'evidence_missing',
          { fixtureIds: missingEvidence.map((fixture) => fixture.id) },
        ),
      );
    }
  }

  return result('BIR-R06', rows, issues);
}

function result(
  requirementId: DocumentationFidelityRequirementId,
  rows: DocumentationFidelityRow[],
  issues: DocumentationFidelityIssue[],
): DocumentationFidelityContractResult {
  const sortedIssues = [...issues].sort((a, b) => {
    const bySeverity = severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.id.localeCompare(b.id);
  });
  return {
    requirementId,
    status: contractStatus(sortedIssues),
    rows: [...rows].sort((a, b) => a.scopeId.localeCompare(b.scopeId)),
    issues: sortedIssues,
  };
}

function contractStatus(issues: DocumentationFidelityIssue[]): DocumentationFidelityStatus {
  if (issues.some((item) => item.severity === 'error')) return 'fail';
  if (issues.some((item) => item.severity === 'warning')) return 'warn';
  return 'pass';
}

function issue(
  requirementId: DocumentationFidelityRequirementId,
  severity: DocumentationFidelitySeverity,
  id: string,
  message: string,
  elementId?: string,
  cause?: DocumentationFidelityDiagnosticCause,
  evidence?: Record<string, unknown>,
): DocumentationFidelityIssue {
  return {
    requirementId,
    severity,
    id,
    message,
    ...(elementId ? { elementId } : {}),
    ...(cause ? { cause } : {}),
    ...(evidence && Object.keys(evidence).length ? { evidence } : {}),
  };
}

function severityRank(severity: DocumentationFidelitySeverity): number {
  return severity === 'error' ? 2 : 1;
}

function countKinds(elementsById: Record<string, Element>, kinds: string[]): number {
  const allowed = new Set(kinds);
  return Object.values(elementsById).filter((el) => allowed.has(el.kind)).length;
}

function planPrimitiveCount(counts: Record<string, number>, feature: PlanFidelityFeature): number {
  const aliases = new Set<string>([feature, `${feature}s`]);
  if (feature === 'slab_opening') aliases.add('opening');
  if (feature === 'hidden_cut_graphics') {
    ['hiddenLine', 'hidden_line', 'cutEdge', 'cut_edge', 'cut_graphics'].forEach((alias) =>
      aliases.add(alias),
    );
  }
  if (feature === 'annotation') {
    ['tag', 'tags', 'dimension', 'dimensions', 'text_note', 'detail_region'].forEach((alias) =>
      aliases.add(alias),
    );
  }
  let total = 0;
  for (const [key, value] of Object.entries(counts)) {
    if (aliases.has(key) && Number.isFinite(value)) total += value;
  }
  return total;
}

type NormalizedDocumentationDiagnostic = {
  text: string;
  code: string;
  feature: string;
  cause?: DocumentationFidelityDiagnosticCause;
  elementIds: string[];
  viewId?: string;
  evidence?: Record<string, unknown>;
  trackerItems: string[];
};

function normalizedDiagnostics(
  diagnostics: DocumentationFidelityDiagnosticInput[] | undefined,
): NormalizedDocumentationDiagnostic[] {
  return (diagnostics ?? [])
    .map((item): NormalizedDocumentationDiagnostic | null => {
      if (typeof item === 'string') {
        const text = item.trim().toLowerCase();
        return text ? { text, code: text, feature: text, elementIds: [], trackerItems: [] } : null;
      }
      const cause = item.cause ?? causeFromIssueClass(item.issueClass, item.rendererArea);
      const code = String(item.code ?? '').trim();
      const feature = String(item.feature ?? '').trim();
      const message = String(item.message ?? '').trim();
      const rendererArea = String(item.rendererArea ?? '').trim();
      const text = [code, feature, message, rendererArea, ...(item.trackerItems ?? [])]
        .join(' ')
        .trim()
        .toLowerCase();
      if (!text) return null;
      return {
        text,
        code: code || text,
        feature,
        cause,
        elementIds: [...new Set(item.elementIds ?? [])].sort(),
        viewId: item.viewId ?? undefined,
        evidence: item.evidence,
        trackerItems: [...new Set(item.trackerItems ?? [])].sort(),
      };
    })
    .filter((item): item is NormalizedDocumentationDiagnostic => Boolean(item));
}

function diagnosticsCover(
  diagnostics: NormalizedDocumentationDiagnostic[],
  token: string,
): boolean {
  const needle = token.toLowerCase();
  return diagnostics.some(
    (diag) => diag.text.includes(needle) && diag.cause !== 'model_invalidity',
  );
}

function diagnosticsForToken(
  diagnostics: NormalizedDocumentationDiagnostic[],
  token: string,
): NormalizedDocumentationDiagnostic[] {
  const needles = diagnosticTokenAliases(token);
  return diagnostics.filter((diag) => needles.some((needle) => diag.text.includes(needle)));
}

function diagnosticTokenAliases(token: string): string[] {
  const base = token.toLowerCase().replace(/_/g, '-');
  const aliases = new Set([base, base.replace(/-/g, '_')]);
  if (token === 'door' || token === 'window' || token === 'hidden_cut_graphics') {
    aliases.add('wall-cut');
    aliases.add('hosted-opening');
  }
  if (token === 'slab_opening') aliases.add('slab-opening');
  if (token === 'annotation') aliases.add('tag');
  if (token === 'sheet-viewport') aliases.add('sheet_viewport');
  return [...aliases];
}

function causeFromIssueClass(
  issueClass: string | undefined,
  rendererArea: string | undefined,
): DocumentationFidelityDiagnosticCause | undefined {
  if (issueClass === 'model-invalid') return 'model_invalidity';
  if (issueClass === 'renderer-unsupported') {
    return rendererArea === 'export' ? 'export_unsupported' : 'renderer_unsupported';
  }
  if (issueClass === 'renderer-failed' || issueClass === 'renderer-degraded') {
    return rendererArea === 'export'
      ? 'export_dropped_visual_geometry'
      : 'renderer_dropped_visual_geometry';
  }
  return undefined;
}

function strongestDiagnosticCause(
  diagnostics: NormalizedDocumentationDiagnostic[],
): DocumentationFidelityDiagnosticCause | undefined {
  const causes = new Set(diagnostics.map((diag) => diag.cause).filter(Boolean));
  if (causes.has('model_invalidity')) return 'model_invalidity';
  if (causes.has('renderer_dropped_visual_geometry')) return 'renderer_dropped_visual_geometry';
  if (causes.has('export_dropped_visual_geometry')) return 'export_dropped_visual_geometry';
  if (causes.has('renderer_unsupported')) return 'renderer_unsupported';
  if (causes.has('export_unsupported')) return 'export_unsupported';
  return diagnostics.length ? 'renderer_unsupported' : undefined;
}

function diagnosticCodes(diagnostics: NormalizedDocumentationDiagnostic[]): string[] {
  return [...new Set(diagnostics.map((diag) => diag.code).filter(Boolean))].sort();
}

function diagnosticCauses(diagnostics: NormalizedDocumentationDiagnostic[]): string[] {
  return [
    ...new Set(
      diagnostics
        .map((diag) => diag.cause)
        .filter((cause): cause is DocumentationFidelityDiagnosticCause => Boolean(cause)),
    ),
  ].sort();
}

function diagnosticEvidence(
  diagnostics: NormalizedDocumentationDiagnostic[],
): Record<string, unknown> {
  if (!diagnostics.length) return {};
  return {
    diagnosticCodes: diagnosticCodes(diagnostics),
    diagnosticCauses: diagnosticCauses(diagnostics),
    elementIds: [...new Set(diagnostics.flatMap((diag) => diag.elementIds))].sort(),
    viewIds: [...new Set(diagnostics.map((diag) => diag.viewId).filter(Boolean))].sort(),
    trackerItems: [...new Set(diagnostics.flatMap((diag) => diag.trackerItems))].sort(),
  };
}

function sectionElevationCheckToken(check: string): string {
  if (check.includes('opening')) return 'opening';
  if (check.includes('stair')) return 'stair';
  if (check.includes('roof')) return 'roof';
  if (check.includes('floor')) return 'floor';
  if (check.includes('material')) return 'material';
  if (check.includes('hidden')) return 'hidden';
  if (check.includes('cut')) return 'cut';
  if (check.includes('depth')) return 'depth';
  if (check.includes('sectionBox')) return 'section';
  return check;
}

function positiveNumber(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function isPlainObject(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function viewportEvidenceLinked(
  kind: SheetViewRefKind | undefined,
  hint: SheetViewportEvidenceHint | undefined,
): boolean {
  if (!hint) return false;
  if (kind === 'plan') return Boolean(String(hint.planProjectionSegment ?? '').trim());
  if (kind === 'section') return Boolean(String(hint.sectionDocumentationSegment ?? '').trim());
  if (kind === 'schedule') return Boolean(String(hint.scheduleDocumentationSegment ?? '').trim());
  return Boolean(String(hint.evidenceHref ?? '').trim());
}

function isAnnotationOrDimensionKind(kind: string): boolean {
  return [
    'placed_tag',
    'text_note',
    'detail_line',
    'detail_region',
    'detail_filled_region',
    'masking_region',
    'spot_elevation',
    'spot_coordinate',
    'spot_slope',
    'annotation_symbol',
    'dimension',
    'permanent_dimension',
    'callout',
    'schedule',
  ].includes(kind);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function referencedElementIds(raw: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const key of ['refElementIdA', 'refElementIdB', 'referencedElementId', 'hostElementId']) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) ids.push(value.trim());
  }
  const witnessPoints = raw.witnessPointsMm;
  if (Array.isArray(witnessPoints)) {
    for (const pt of witnessPoints) {
      if (!pt || typeof pt !== 'object') continue;
      const id = (pt as Record<string, unknown>).referencedElementId;
      if (typeof id === 'string' && id.trim()) ids.push(id.trim());
    }
  }
  return [...new Set(ids)].sort();
}
