import type { Element, LensMode } from '@bim-ai/core';

import {
  createRendererDiagnostic,
  type RendererDiagnostic,
  type RendererDiagnosticEvidence,
} from './rendererDiagnostics';

export const RENDERER_WORKLOAD_KINDS = [
  'orbit',
  'select',
  'lens-switch',
  'advisor-toggle',
  'update',
] as const;

export type RendererWorkloadKind = (typeof RENDERER_WORKLOAD_KINDS)[number];

export type RendererCostStatus = 'within_budget' | 'near_budget' | 'over_budget';

export type RendererStressBudgetThresholds = {
  warningElementCount: number;
  errorElementCount: number;
  warningOpeningCount: number;
  errorOpeningCount: number;
  warningLinkedModelCount: number;
  errorLinkedModelCount: number;
  warningLinkedElementCount: number;
  errorLinkedElementCount: number;
  warningEvidenceViewCount: number;
  errorEvidenceViewCount: number;
  workloadWarningBudgetRatio: number;
  workloadErrorBudgetRatio: number;
};

export type RendererSceneStressCounts = {
  elementCount: number;
  renderedElementCount: number;
  openingCount: number;
  roomCount: number;
  linkedModelCount: number;
  linkedElementCount: number;
  expandedLinkedElementCount: number;
  evidenceViewCount: number;
  materialSlotCount: number;
  faceOverrideCount: number;
  openingElementIds: string[];
  linkedModelIds: string[];
  evidenceViewIds: string[];
};

export type RendererWorkloadCost = {
  workload: RendererWorkloadKind;
  estimatedMs: number;
  budgetMs: number;
  budgetRatio: number;
  status: RendererCostStatus;
  costUnits: number;
  dominantFactors: string[];
};

export type RendererCostProfile = {
  format: 'rendererCostProfile_v1';
  counts: RendererSceneStressCounts;
  workloads: Record<RendererWorkloadKind, RendererWorkloadCost>;
  summary: {
    status: RendererCostStatus;
    maxBudgetRatio: number;
    overBudgetWorkloads: RendererWorkloadKind[];
    nearBudgetWorkloads: RendererWorkloadKind[];
  };
  diagnostics: RendererDiagnostic[];
  context: {
    viewId?: string | null;
    lensMode?: LensMode | string | null;
    previousLensMode?: LensMode | string | null;
    advisorOpen?: boolean | null;
  };
};

export type RendererCostProfileInput = {
  elements?: readonly Element[] | Record<string, Element | undefined> | null;
  visibleElementIds?: readonly string[] | null;
  selectedElementIds?: readonly string[] | null;
  changedElementIds?: readonly string[] | null;
  lensMode?: LensMode | string | null;
  previousLensMode?: LensMode | string | null;
  advisorOpen?: boolean | null;
  advisorFindingCount?: number | null;
  budgetsMs?: Partial<Record<RendererWorkloadKind, number>>;
  stressBudgets?: Partial<RendererStressBudgetThresholds>;
  viewId?: string | null;
  evidence?: RendererDiagnosticEvidence;
};

const DEFAULT_WORKLOAD_BUDGETS_MS: Record<RendererWorkloadKind, number> = {
  orbit: 16.7,
  select: 50,
  'lens-switch': 100,
  'advisor-toggle': 80,
  update: 120,
};

const DEFAULT_STRESS_BUDGETS: RendererStressBudgetThresholds = {
  warningElementCount: 2500,
  errorElementCount: 6000,
  warningOpeningCount: 160,
  errorOpeningCount: 450,
  warningLinkedModelCount: 4,
  errorLinkedModelCount: 10,
  warningLinkedElementCount: 3500,
  errorLinkedElementCount: 12000,
  warningEvidenceViewCount: 18,
  errorEvidenceViewCount: 48,
  workloadWarningBudgetRatio: 0.85,
  workloadErrorBudgetRatio: 1.25,
};

const OPENING_KINDS = new Set(['door', 'window', 'wall_opening', 'roof_opening', 'slab_opening']);
const LINK_KINDS = new Set(['link_model', 'link_ifc', 'link_external', 'link_dxf', 'link_pdf']);
const EVIDENCE_VIEW_KINDS = new Set(['view', 'viewpoint', 'plan_view', 'section_view', 'sheet']);

export function profileRendererCost(input: RendererCostProfileInput): RendererCostProfile {
  const elements = normalizeElements(input.elements);
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const visibleIds = input.visibleElementIds ? new Set(input.visibleElementIds) : null;
  const selectedIds = new Set(input.selectedElementIds ?? []);
  const changedIds = new Set(input.changedElementIds ?? []);
  const renderedElements = visibleIds
    ? elements.filter((element) => visibleIds.has(element.id))
    : elements.filter((element) => !isHiddenElement(element));
  const counts = countRendererSceneStress(elements, renderedElements);
  const budgetsMs = { ...DEFAULT_WORKLOAD_BUDGETS_MS, ...input.budgetsMs };
  const allCostUnits = sumCostUnits(elements);
  const visibleCostUnits = sumCostUnits(renderedElements);
  const changedElements = changedIds.size > 0 ? idsToElements(changedIds, elementById) : elements;
  const changedCostUnits = changedIds.size > 0 ? sumCostUnits(changedElements) : allCostUnits;
  const changedOpeningCount =
    changedIds.size > 0
      ? changedElements.filter((element) => OPENING_KINDS.has(element.kind)).length
      : counts.openingCount;
  const lensChanged =
    input.previousLensMode != null &&
    input.lensMode != null &&
    input.previousLensMode !== input.lensMode;
  const advisorFindingCount = Math.max(0, input.advisorFindingCount ?? 0);

  const workloads: Record<RendererWorkloadKind, RendererWorkloadCost> = {
    orbit: workloadCost({
      workload: 'orbit',
      estimatedMs: 2 + visibleCostUnits * 0.028 + counts.linkedElementCount * 0.0015,
      budgetMs: budgetsMs.orbit,
      costUnits: visibleCostUnits,
      dominantFactors: dominantFactors([
        [counts.renderedElementCount, 'rendered elements'],
        [counts.linkedElementCount, 'linked ghost elements'],
        [counts.materialSlotCount + counts.faceOverrideCount, 'material overrides'],
      ]),
    }),
    select: workloadCost({
      workload: 'select',
      estimatedMs:
        1.5 +
        Math.log2(counts.elementCount + 1) * 0.75 +
        selectedIds.size * 1.4 +
        counts.openingCount * 0.035,
      budgetMs: budgetsMs.select,
      costUnits: counts.elementCount + counts.openingCount * 3,
      dominantFactors: dominantFactors([
        [counts.elementCount, 'pick candidates'],
        [selectedIds.size, 'selected elements'],
        [counts.openingCount, 'hosted openings'],
      ]),
    }),
    'lens-switch': workloadCost({
      workload: 'lens-switch',
      estimatedMs:
        (lensChanged ? 4 : 1.2) +
        counts.elementCount * 0.018 +
        counts.linkedElementCount * 0.004 +
        counts.materialSlotCount * 0.08 +
        counts.faceOverrideCount * 0.08,
      budgetMs: budgetsMs['lens-switch'],
      costUnits: counts.elementCount + counts.linkedElementCount,
      dominantFactors: dominantFactors([
        [counts.elementCount, 'lens classifications'],
        [counts.linkedElementCount, 'linked model visibility'],
        [counts.materialSlotCount + counts.faceOverrideCount, 'material state changes'],
      ]),
    }),
    'advisor-toggle': workloadCost({
      workload: 'advisor-toggle',
      estimatedMs:
        (input.advisorOpen ? 4 : 2) +
        counts.elementCount * 0.012 +
        advisorFindingCount * 0.08 +
        counts.evidenceViewCount * 0.2,
      budgetMs: budgetsMs['advisor-toggle'],
      costUnits: counts.elementCount + advisorFindingCount * 2 + counts.evidenceViewCount * 4,
      dominantFactors: dominantFactors([
        [advisorFindingCount, 'advisor findings'],
        [counts.elementCount, 'element references'],
        [counts.evidenceViewCount, 'evidence views'],
      ]),
    }),
    update: workloadCost({
      workload: 'update',
      estimatedMs:
        6 +
        changedCostUnits * 0.11 +
        changedOpeningCount * 0.18 +
        (changedIds.size > 0 ? changedIds.size * 0.06 : counts.linkedElementCount * 0.002),
      budgetMs: budgetsMs.update,
      costUnits: changedCostUnits,
      dominantFactors: dominantFactors([
        [
          changedIds.size || counts.elementCount,
          changedIds.size > 0 ? 'changed elements' : 'full-scene elements',
        ],
        [changedOpeningCount, 'changed/scene openings'],
        [counts.linkedElementCount, 'linked dependencies'],
      ]),
    }),
  };

  const maxBudgetRatio = round2(
    Math.max(...RENDERER_WORKLOAD_KINDS.map((workload) => workloads[workload].budgetRatio)),
  );
  const overBudgetWorkloads = RENDERER_WORKLOAD_KINDS.filter(
    (workload) => workloads[workload].status === 'over_budget',
  );
  const nearBudgetWorkloads = RENDERER_WORKLOAD_KINDS.filter(
    (workload) => workloads[workload].status === 'near_budget',
  );
  const profileWithoutDiagnostics: RendererCostProfile = {
    format: 'rendererCostProfile_v1',
    counts,
    workloads,
    summary: {
      status:
        overBudgetWorkloads.length > 0
          ? 'over_budget'
          : nearBudgetWorkloads.length > 0
            ? 'near_budget'
            : 'within_budget',
      maxBudgetRatio,
      overBudgetWorkloads,
      nearBudgetWorkloads,
    },
    diagnostics: [],
    context: {
      viewId: input.viewId,
      lensMode: input.lensMode,
      previousLensMode: input.previousLensMode,
      advisorOpen: input.advisorOpen,
    },
  };

  return {
    ...profileWithoutDiagnostics,
    diagnostics: diagnoseRendererStressBudgets(profileWithoutDiagnostics, {
      evidence: input.evidence,
      stressBudgets: input.stressBudgets,
    }),
  };
}

export function diagnoseRendererStressBudgets(
  profileOrInput: RendererCostProfile | RendererCostProfileInput,
  options: {
    evidence?: RendererDiagnosticEvidence;
    stressBudgets?: Partial<RendererStressBudgetThresholds>;
  } = {},
): RendererDiagnostic[] {
  const profile = isRendererCostProfile(profileOrInput)
    ? profileOrInput
    : profileRendererCost(profileOrInput);
  const stressBudgets = { ...DEFAULT_STRESS_BUDGETS, ...options.stressBudgets };
  const diagnostics: RendererDiagnostic[] = [];
  const counts = profile.counts;
  const evidence =
    options.evidence ??
    (!isRendererCostProfile(profileOrInput) ? profileOrInput.evidence : undefined);

  pushCountDiagnostic(diagnostics, {
    code: 'renderer.stress.element_count',
    ruleId: 'renderer_stress_element_count_budget',
    count: counts.elementCount,
    warning: stressBudgets.warningElementCount,
    error: stressBudgets.errorElementCount,
    messageLabel: 'Scene element count',
    elementIds: sampleIds(counts.openingElementIds, counts.linkedModelIds, counts.evidenceViewIds),
    viewId: profile.context.viewId,
    evidence,
  });
  pushCountDiagnostic(diagnostics, {
    code: 'renderer.stress.opening_count',
    ruleId: 'renderer_stress_opening_count_budget',
    count: counts.openingCount,
    warning: stressBudgets.warningOpeningCount,
    error: stressBudgets.errorOpeningCount,
    messageLabel: 'Hosted opening count',
    elementIds: counts.openingElementIds,
    viewId: profile.context.viewId,
    evidence,
  });
  pushCountDiagnostic(diagnostics, {
    code: 'renderer.stress.linked_model_count',
    ruleId: 'renderer_stress_linked_model_count_budget',
    count: counts.linkedModelCount,
    warning: stressBudgets.warningLinkedModelCount,
    error: stressBudgets.errorLinkedModelCount,
    messageLabel: 'Linked model count',
    elementIds: counts.linkedModelIds,
    viewId: profile.context.viewId,
    evidence,
  });
  pushCountDiagnostic(diagnostics, {
    code: 'renderer.stress.linked_element_count',
    ruleId: 'renderer_stress_linked_element_count_budget',
    count: counts.linkedElementCount,
    warning: stressBudgets.warningLinkedElementCount,
    error: stressBudgets.errorLinkedElementCount,
    messageLabel: 'Linked element count',
    elementIds: counts.linkedModelIds,
    viewId: profile.context.viewId,
    evidence,
  });
  pushCountDiagnostic(diagnostics, {
    code: 'renderer.stress.evidence_view_count',
    ruleId: 'renderer_stress_evidence_view_count_budget',
    count: counts.evidenceViewCount,
    warning: stressBudgets.warningEvidenceViewCount,
    error: stressBudgets.errorEvidenceViewCount,
    messageLabel: 'Evidence view count',
    elementIds: counts.evidenceViewIds,
    viewId: profile.context.viewId,
    evidence,
  });

  for (const workload of RENDERER_WORKLOAD_KINDS) {
    const cost = profile.workloads[workload];
    if (cost.budgetRatio < stressBudgets.workloadWarningBudgetRatio) continue;
    const severity =
      cost.budgetRatio >= stressBudgets.workloadErrorBudgetRatio ? 'error' : 'warning';
    diagnostics.push(
      createRendererDiagnostic({
        ruleId: 'renderer_profile_workload_budget',
        code: `renderer.profile.${workload}.budget_${severity === 'error' ? 'exceeded' : 'near_limit'}`,
        severity,
        issueClass: 'renderer-degraded',
        rendererArea: 'viewport-3d',
        feature: 'renderer-performance',
        message: `${workload} renderer workload is estimated at ${cost.estimatedMs} ms against a ${cost.budgetMs} ms budget.`,
        elementIds: sampleIds(counts.openingElementIds, counts.linkedModelIds),
        viewId: profile.context.viewId,
        trackerItems: ['BIR-L02', 'BIR-J10'],
        evidence: mergeEvidenceDetails(evidence, {
          workload,
          estimatedMs: cost.estimatedMs,
          budgetMs: cost.budgetMs,
          budgetRatio: cost.budgetRatio,
          dominantFactors: cost.dominantFactors.join(', '),
        }),
      }),
    );
  }

  return diagnostics.sort((a, b) =>
    `${a.severity}:${a.code}`.localeCompare(`${b.severity}:${b.code}`),
  );
}

function countRendererSceneStress(
  elements: readonly Element[],
  renderedElements: readonly Element[],
): RendererSceneStressCounts {
  const openingElementIds: string[] = [];
  const linkedModelIds: string[] = [];
  const evidenceViewIds: string[] = [];
  let roomCount = 0;
  let linkedElementCount = 0;
  let expandedLinkedElementCount = 0;
  let materialSlotCount = 0;
  let faceOverrideCount = 0;

  for (const element of elements) {
    const record = element as Record<string, unknown>;
    if (OPENING_KINDS.has(element.kind)) openingElementIds.push(element.id);
    if (element.kind === 'room') roomCount += 1;
    if (LINK_KINDS.has(element.kind)) {
      linkedModelIds.push(element.id);
      linkedElementCount += linkedSourceElementCount(element);
    }
    if (isExpandedLinkedElement(element)) {
      expandedLinkedElementCount += 1;
      linkedElementCount += 1;
    }
    if (EVIDENCE_VIEW_KINDS.has(element.kind)) evidenceViewIds.push(element.id);
    materialSlotCount += objectSize(record.materialSlots);
    faceOverrideCount += objectSize(record.faceOverrides) + arraySize(record.faceMaterialOverrides);
  }

  return {
    elementCount: elements.length,
    renderedElementCount: renderedElements.length,
    openingCount: openingElementIds.length,
    roomCount,
    linkedModelCount: linkedModelIds.length,
    linkedElementCount,
    expandedLinkedElementCount,
    evidenceViewCount: evidenceViewIds.length,
    materialSlotCount,
    faceOverrideCount,
    openingElementIds: uniqueSorted(openingElementIds),
    linkedModelIds: uniqueSorted(linkedModelIds),
    evidenceViewIds: uniqueSorted(evidenceViewIds),
  };
}

function workloadCost(input: {
  workload: RendererWorkloadKind;
  estimatedMs: number;
  budgetMs: number;
  costUnits: number;
  dominantFactors: string[];
}): RendererWorkloadCost {
  const estimatedMs = round2(input.estimatedMs);
  const budgetMs = round2(input.budgetMs);
  const budgetRatio = budgetMs > 0 ? round2(estimatedMs / budgetMs) : Number.POSITIVE_INFINITY;
  return {
    workload: input.workload,
    estimatedMs,
    budgetMs,
    budgetRatio,
    status: budgetRatio > 1 ? 'over_budget' : budgetRatio >= 0.8 ? 'near_budget' : 'within_budget',
    costUnits: round2(input.costUnits),
    dominantFactors: input.dominantFactors,
  };
}

function pushCountDiagnostic(
  diagnostics: RendererDiagnostic[],
  input: {
    code: string;
    ruleId: string;
    count: number;
    warning: number;
    error: number;
    messageLabel: string;
    elementIds: readonly string[];
    viewId?: string | null;
    evidence?: RendererDiagnosticEvidence;
  },
): void {
  if (input.count < input.warning) return;
  const severity = input.count >= input.error ? 'error' : 'warning';
  diagnostics.push(
    createRendererDiagnostic({
      ruleId: input.ruleId,
      code: `${input.code}.${severity === 'error' ? 'exceeded' : 'near_limit'}`,
      severity,
      issueClass: 'renderer-degraded',
      rendererArea: 'viewport-3d',
      feature: 'renderer-performance',
      message: `${input.messageLabel} is ${input.count}, exceeding the ${severity} stress budget threshold of ${
        severity === 'error' ? input.error : input.warning
      }.`,
      elementIds: sampleIds(input.elementIds),
      viewId: input.viewId,
      trackerItems: ['BIR-J10', 'BIR-L02'],
      evidence: mergeEvidenceDetails(input.evidence, {
        count: input.count,
        warningThreshold: input.warning,
        errorThreshold: input.error,
      }),
    }),
  );
}

function estimateElementRenderCostUnits(element: Element): number {
  const record = element as Record<string, unknown>;
  const kind = element.kind;
  const base = (() => {
    if (kind === 'wall')
      return 8 + arraySize(record.recessZones) * 3 + objectSize(record.curtainPanelOverrides) * 0.6;
    if (kind === 'floor' || kind === 'roof') return 11 + arraySize(record.openings) * 4;
    if (kind === 'door' || kind === 'window') return 9;
    if (kind === 'wall_opening' || kind === 'roof_opening' || kind === 'slab_opening') return 6;
    if (kind === 'stair') return 18;
    if (kind === 'railing') return 14;
    if (kind === 'family_instance') return 13;
    if (kind === 'room') return 1.5 + arraySize(record.outlineMm) * 0.1;
    if (kind === 'link_ifc') return 4 + linkedSourceElementCount(element) * 0.35;
    if (LINK_KINDS.has(kind)) return 3;
    if (EVIDENCE_VIEW_KINDS.has(kind)) return 0.5;
    return 4;
  })();
  return (
    base +
    objectSize(record.materialSlots) * 0.35 +
    objectSize(record.faceOverrides) * 0.25 +
    arraySize(record.faceMaterialOverrides) * 0.25
  );
}

function normalizeElements(
  input: readonly Element[] | Record<string, Element | undefined> | null | undefined,
): Element[] {
  if (!input) return [];
  if (Array.isArray(input)) return [...input].sort((a, b) => a.id.localeCompare(b.id));
  return Object.values(input)
    .filter((element): element is Element => Boolean(element))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function idsToElements(
  ids: ReadonlySet<string>,
  elementById: ReadonlyMap<string, Element>,
): Element[] {
  return [...ids]
    .map((id) => elementById.get(id))
    .filter((element): element is Element => Boolean(element));
}

function isHiddenElement(element: Element): boolean {
  const record = element as Record<string, unknown>;
  if (record.hidden === true) return true;
  if (element.kind === 'link_ifc' && record.visible === false) return true;
  return false;
}

function isExpandedLinkedElement(element: Element): boolean {
  const record = element as Record<string, unknown>;
  return (
    element.id.includes('::') ||
    typeof record.linkId === 'string' ||
    arraySize(record.linkChain) > 0
  );
}

function linkedSourceElementCount(element: Element): number {
  const record = element as Record<string, unknown>;
  return arraySize(record.linkedElements) + numberValue(record.linkedElementCount);
}

function sumCostUnits(elements: readonly Element[]): number {
  return elements.reduce((sum, element) => sum + estimateElementRenderCostUnits(element), 0);
}

function dominantFactors(entries: Array<[number, string]>): string[] {
  return entries
    .filter(([value]) => value > 0)
    .sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]))
    .slice(0, 3)
    .map(([value, label]) => `${label}:${round2(value)}`);
}

function mergeEvidenceDetails(
  evidence: RendererDiagnosticEvidence | undefined,
  details: Record<string, string | number | boolean | null>,
): RendererDiagnosticEvidence {
  return {
    ...evidence,
    source: evidence?.source ?? 'viewport',
    details: {
      ...(evidence?.details ?? {}),
      ...details,
    },
  };
}

function sampleIds(...groups: readonly (readonly string[])[]): string[] {
  return uniqueSorted(groups.flat()).slice(0, 25);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function objectSize(value: unknown): number {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;
}

function arraySize(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function round2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

function isRendererCostProfile(
  value: RendererCostProfile | RendererCostProfileInput,
): value is RendererCostProfile {
  return (value as { format?: unknown }).format === 'rendererCostProfile_v1';
}
