#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import {
  resolveTargetHouseSnapshotInput,
  sha256Json,
} from '../packages/cli/lib/target-house-package-inputs.mjs';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_SEED = 'target-house-1';
const DEFAULT_OUT_ROOT = path.join(REPO_ROOT, 'tmp', 'target-house-final-package');
const REQUIRED_LIVE_EVIDENCE = [
  'tool-run-summary.json',
  'snapshot.json',
  'evidence-manifest.json',
  'evidence-package.json',
  'advisor-all.json',
  'constructability-report.json',
  'export-validation.json',
  'tolerance-ledger.json',
  'clean-pass-gate.json',
  'target-house-geometry-diagnostic.json',
  'acceptance-gates.json',
  'visual-gate.json',
  'screenshot-manifest.json',
];
const LIVE_RESPONSIVENESS_EVIDENCE = 'target-house-live-responsiveness.json';
const LIVE_INTERACTIONS = ['orbit', 'select', 'lens-switch', 'advisor-open', 'advisor-close'];

const WORKLOADS = ['orbit', 'select', 'lens-switch', 'advisor-toggle', 'update'];
const TRACKER_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const TRACKER_STATUSES = new Set(['Done', 'Partial', 'Not started', 'Blocked']);
const WORKLOAD_BUDGETS_MS = {
  orbit: 16.7,
  select: 50,
  'lens-switch': 100,
  'advisor-toggle': 80,
  update: 120,
};
const OPENING_KINDS = new Set(['door', 'window', 'wall_opening', 'roof_opening', 'slab_opening']);
const LINK_KINDS = new Set(['link_model', 'link_ifc', 'link_external', 'link_dxf', 'link_pdf']);
const EVIDENCE_VIEW_KINDS = new Set(['view', 'viewpoint', 'plan_view', 'section_view', 'sheet']);
const TARGET_HOUSE_RENDERED_3D_KINDS = new Set([
  'wall',
  'floor',
  'roof',
  'door',
  'window',
  'wall_opening',
  'roof_opening',
  'slab_opening',
  'stair',
  'railing',
  'placed_asset',
  'family_instance',
  'sweep',
]);
const BLOCKING_GEOMETRY_DIAGNOSTIC_SEVERITIES = new Set(['error', 'blocker', 'blocking']);
const BLOCKING_GEOMETRY_DIAGNOSTIC_CATEGORIES = new Set([
  'detached_or_flying',
  'helper_leakage',
  'out_of_envelope',
  'sketch_critical_mismatch',
  'unsupported_renderer_feature',
]);

function usage() {
  console.error(`Usage:
  node scripts/target-house-final-package.mjs [--seed target-house-1] [--out-dir <dir>] [--json] [--require-ready]

Generates:
  <out-dir>/<seed>-performance-evidence.json
  <out-dir>/<seed>-final-closeout-manifest.json
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    seed: DEFAULT_SEED,
    outDir: null,
    json: false,
    requireReady: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--require-ready') args.requireReady = true;
    else if (arg === '--seed' && argv[index + 1]) args.seed = argv[++index];
    else if (arg === '--out-dir' && argv[index + 1]) args.outDir = path.resolve(argv[++index]);
    else usage();
  }
  args.outDir ??= path.join(DEFAULT_OUT_ROOT, args.seed);
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readJsonIfExists(file) {
  return (await exists(file)) ? readJson(file) : null;
}

async function exists(file) {
  return fs
    .stat(file)
    .then(() => true)
    .catch(() => false);
}

async function sha256File(file) {
  return crypto
    .createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function portable(absPath) {
  const rel = path.relative(REPO_ROOT, absPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
    ? rel.split(path.sep).join('/')
    : absPath;
}

function gitHead() {
  const proc = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

async function sourceDigest(sourceDir) {
  const files = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) files.push(abs);
    }
  }
  await walk(sourceDir);
  const h = crypto.createHash('sha256');
  for (const file of files.sort()) {
    h.update(portable(file));
    h.update('\0');
    h.update(await sha256File(file));
    h.update('\0');
  }
  return { digestSha256: h.digest('hex'), fileCount: files.length };
}

function normalizeElements(elements) {
  if (!elements) return [];
  if (Array.isArray(elements)) return [...elements].sort((a, b) => a.id.localeCompare(b.id));
  return Object.values(elements)
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function arraySize(value) {
  return Array.isArray(value) ? value.length : 0;
}

function objectSize(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;
}

function numberValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizedKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function round2(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function linkedSourceElementCount(element) {
  return arraySize(element.linkedElements) + numberValue(element.linkedElementCount);
}

function isExpandedLinkedElement(element) {
  return (
    String(element.id ?? '').includes('::') ||
    typeof element.linkId === 'string' ||
    arraySize(element.linkChain) > 0
  );
}

function isHiddenElement(element) {
  if (element.hidden === true) return true;
  if (element.kind === 'link_ifc' && element.visible === false) return true;
  return false;
}

function estimateElementRenderCostUnits(element) {
  const kind = element.kind;
  const base = (() => {
    if (kind === 'wall') {
      return (
        8 + arraySize(element.recessZones) * 3 + objectSize(element.curtainPanelOverrides) * 0.6
      );
    }
    if (kind === 'floor' || kind === 'roof') return 11 + arraySize(element.openings) * 4;
    if (kind === 'door' || kind === 'window') return 9;
    if (kind === 'wall_opening' || kind === 'roof_opening' || kind === 'slab_opening') return 6;
    if (kind === 'stair') return 18;
    if (kind === 'railing') return 14;
    if (kind === 'family_instance') return 13;
    if (kind === 'room') return 1.5 + arraySize(element.outlineMm) * 0.1;
    if (kind === 'link_ifc') return 4 + linkedSourceElementCount(element) * 0.35;
    if (LINK_KINDS.has(kind)) return 3;
    if (EVIDENCE_VIEW_KINDS.has(kind)) return 0.5;
    return 4;
  })();
  return (
    base +
    objectSize(element.materialSlots) * 0.35 +
    objectSize(element.faceOverrides) * 0.25 +
    arraySize(element.faceMaterialOverrides) * 0.25
  );
}

function sumCostUnits(elements) {
  return elements.reduce((sum, element) => sum + estimateElementRenderCostUnits(element), 0);
}

function dominantFactors(entries) {
  return entries
    .filter(([value]) => value > 0)
    .sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]))
    .slice(0, 3)
    .map(([value, label]) => `${label}:${round2(value)}`);
}

function workloadCost({ workload, estimatedMs, budgetMs, costUnits, dominantFactors: factors }) {
  const roundedEstimate = round2(estimatedMs);
  const roundedBudget = round2(budgetMs);
  const budgetRatio =
    roundedBudget > 0 ? round2(roundedEstimate / roundedBudget) : Number.POSITIVE_INFINITY;
  return {
    workload,
    estimatedMs: roundedEstimate,
    budgetMs: roundedBudget,
    budgetRatio,
    status: budgetRatio > 1 ? 'over_budget' : budgetRatio >= 0.8 ? 'near_budget' : 'within_budget',
    costUnits: round2(costUnits),
    dominantFactors: factors,
  };
}

function countRendererSceneStress(elements, renderedElements) {
  const openingElementIds = [];
  const linkedModelIds = [];
  const evidenceViewIds = [];
  let roomCount = 0;
  let linkedElementCount = 0;
  let expandedLinkedElementCount = 0;
  let materialSlotCount = 0;
  let faceOverrideCount = 0;

  for (const element of elements) {
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
    materialSlotCount += objectSize(element.materialSlots);
    faceOverrideCount +=
      objectSize(element.faceOverrides) + arraySize(element.faceMaterialOverrides);
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

export function profileRendererCostForPackage(input) {
  const elements = normalizeElements(input.elements);
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const visibleIds = input.visibleElementIds ? new Set(input.visibleElementIds) : null;
  const selectedIds = new Set(input.selectedElementIds ?? []);
  const changedIds = new Set(input.changedElementIds ?? []);
  const renderedElements = visibleIds
    ? elements.filter((element) => visibleIds.has(element.id))
    : elements.filter((element) => !isHiddenElement(element));
  const counts = countRendererSceneStress(elements, renderedElements);
  const allCostUnits = sumCostUnits(elements);
  const visibleCostUnits = sumCostUnits(renderedElements);
  const changedElements =
    changedIds.size > 0
      ? [...changedIds].map((id) => elementById.get(id)).filter(Boolean)
      : elements;
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
  const budgetsMs = { ...WORKLOAD_BUDGETS_MS, ...(input.budgetsMs ?? {}) };

  const workloads = {
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
    Math.max(...WORKLOADS.map((workload) => workloads[workload].budgetRatio)),
  );
  return {
    format: 'rendererCostProfile_v1',
    counts,
    workloads,
    summary: {
      status: WORKLOADS.some((workload) => workloads[workload].status === 'over_budget')
        ? 'over_budget'
        : WORKLOADS.some((workload) => workloads[workload].status === 'near_budget')
          ? 'near_budget'
          : 'within_budget',
      maxBudgetRatio,
      overBudgetWorkloads: WORKLOADS.filter(
        (workload) => workloads[workload].status === 'over_budget',
      ),
      nearBudgetWorkloads: WORKLOADS.filter(
        (workload) => workloads[workload].status === 'near_budget',
      ),
    },
    diagnostics: [],
    context: {
      viewId: input.viewId,
      lensMode: input.lensMode,
      previousLensMode: input.previousLensMode,
      advisorOpen: input.advisorOpen,
    },
  };
}

function advisorFindingCount(advisorAll) {
  if (typeof advisorAll?.total === 'number') return Math.max(0, advisorAll.total);
  if (typeof advisorAll?.data?.summary?.findingCount === 'number') {
    return Math.max(0, advisorAll.data.summary.findingCount);
  }
  return 0;
}

export async function buildTargetHousePerformanceEvidence({
  seed = DEFAULT_SEED,
  snapshotInput = null,
} = {}) {
  const artifactDir = path.join(REPO_ROOT, 'seed-artifacts', seed);
  const liveDir = path.join(artifactDir, 'evidence', 'live-run-current');
  const advisorPath = path.join(liveDir, 'advisor-all.json');
  snapshotInput ??= resolveTargetHouseSnapshotInput({ repoRoot: REPO_ROOT, seed });
  const snapshot = snapshotInput.snapshot;
  const advisorAll =
    snapshotInput.snapshotSource.liveEvidenceFresh && (await exists(advisorPath))
      ? await readJson(advisorPath)
      : null;
  const elements = normalizeElements(snapshot.elements);
  const selectedElementId =
    elements.find((element) => element.kind === 'door')?.id ?? elements.find(Boolean)?.id ?? null;
  const visibleElementIds = elements
    .filter((element) => TARGET_HOUSE_RENDERED_3D_KINDS.has(element.kind))
    .filter((element) => !isHiddenElement(element))
    .map((element) => element.id);
  const profile = profileRendererCostForPackage({
    elements,
    visibleElementIds,
    selectedElementIds: selectedElementId ? [selectedElementId] : [],
    changedElementIds: selectedElementId ? [selectedElementId] : [],
    previousLensMode: 'architecture',
    lensMode: 'coordination',
    advisorOpen: true,
    advisorFindingCount: advisorFindingCount(advisorAll),
    viewId: 'main_front_left',
  });
  const interactionWorkloads = ['orbit', 'select', 'lens-switch', 'advisor-toggle'];
  const interactions = interactionWorkloads.map((workload) => {
    const cost = profile.workloads[workload];
    return {
      interaction:
        workload === 'advisor-toggle'
          ? 'advisor-open'
          : workload === 'lens-switch'
            ? 'lens-switch'
            : workload,
      workload,
      accepted: cost.status !== 'over_budget',
      estimatedMs: cost.estimatedMs,
      budgetMs: cost.budgetMs,
      budgetRatio: cost.budgetRatio,
      status: cost.status,
      dominantFactors: cost.dominantFactors,
    };
  });
  const body = {
    schemaVersion: 'target-house-performance-evidence.v1',
    seed,
    generatedFrom: {
      snapshotPath: snapshotInput.snapshotSource.path,
      snapshotSource: snapshotInput.snapshotSource,
      snapshotSha256: snapshotInput.snapshotSource.snapshotSha256 ?? sha256Json(snapshot),
      sourceDigests: snapshotInput.sourceDigests,
      advisorPath: portable(advisorPath),
      advisorFreshnessPolicy: snapshotInput.snapshotSource.liveEvidenceFresh
        ? 'advisor-all.json consumed with fresh live snapshot'
        : 'advisor-all.json ignored because live evidence is stale for the authoritative seed/source',
      rendererProfileHelper: 'packages/web/src/viewport/rendererCostProfile.ts',
      helperFormat: 'rendererCostProfile_v1',
      deterministicPackageMirror: portable(
        path.join(REPO_ROOT, 'scripts', 'target-house-final-package.mjs'),
      ),
    },
    scenario: {
      viewId: 'main_front_left',
      selectedElementIds: selectedElementId ? [selectedElementId] : [],
      previousLensMode: 'architecture',
      lensMode: 'coordination',
      advisorOpen: true,
      advisorFindingCount: advisorFindingCount(advisorAll),
      rendered3dKindFilter: [...TARGET_HOUSE_RENDERED_3D_KINDS].sort(),
      renderedElementCount: visibleElementIds.length,
    },
    budgetsMs: WORKLOAD_BUDGETS_MS,
    liveResponsivenessRequirement: {
      schemaVersion: 'target-house-live-responsiveness.v1',
      requiredEvidencePath: portable(
        path.join(liveDir, LIVE_RESPONSIVENESS_EVIDENCE),
      ),
      requiredInteractions: LIVE_INTERACTIONS,
      websocketPolicy:
        'actionable WebSocket churn or missing Advisor close/open/lens/select/orbit samples blocks final readiness',
      trackerRefs: ['BIR-L02', 'BIR-L03', 'BIR-N07'],
    },
    profile,
    interactions,
    summary: {
      ok: interactions.every((row) => row.accepted),
      acceptedInteractionCount: interactions.filter((row) => row.accepted).length,
      requiredInteractionCount: interactions.length,
      maxBudgetRatio: round2(Math.max(...interactions.map((row) => row.budgetRatio))),
      overBudgetInteractions: interactions
        .filter((row) => row.status === 'over_budget')
        .map((row) => row.interaction),
    },
  };
  return {
    ...body,
    evidenceDigestSha256: sha256Text(stableJson(body)),
  };
}

function parseTrackerRows(markdown, ids) {
  const rows = {};
  const tableRows = markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  for (const id of ids) {
    const cells = tableRows.find((row) => row[0] === `\`${id}\``);
    rows[id] = cells
      ? {
          priority: cells[1] ?? '',
          status: cells[2] ?? '',
          item: cells[3] ?? '',
          acceptance: cells[4] ?? '',
        }
      : null;
  }
  return rows;
}

function parseAllTrackerRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => /^`BIR-[A-Z]\d{2}`$/.test(cells[0] ?? ''))
    .filter((cells) => TRACKER_PRIORITIES.has(cells[1] ?? '') && TRACKER_STATUSES.has(cells[2] ?? ''))
    .map((cells) => ({
      id: cells[0].replaceAll('`', ''),
      priority: cells[1] ?? '',
      status: cells[2] ?? '',
      item: cells[3] ?? '',
      acceptance: cells[4] ?? '',
    }));
}

function trackerCompletionSummary(markdown) {
  const rows = parseAllTrackerRows(markdown);
  const counts = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const incompleteRows = rows.filter((row) => row.status !== 'Done');
  return {
    ok: incompleteRows.length === 0,
    total: rows.length,
    done: counts.Done ?? 0,
    incomplete: incompleteRows.length,
    byStatus: Object.fromEntries(Object.entries(counts).sort()),
    sampleIncompleteRows: incompleteRows
      .slice(0, 20)
      .map((row) => ({ id: row.id, priority: row.priority, status: row.status, item: row.item })),
  };
}

async function requiredEvidenceRows(liveDir) {
  const rows = [];
  for (const relPath of REQUIRED_LIVE_EVIDENCE) {
    const abs = path.join(liveDir, relPath);
    const present = await exists(abs);
    rows.push({
      path: portable(abs),
      present,
      sha256: present ? await sha256File(abs) : null,
    });
  }
  return rows;
}

function acceptanceSummary(acceptanceGates) {
  const blockers = Array.isArray(acceptanceGates?.blockers) ? acceptanceGates.blockers : [];
  const blockerCodes = uniqueSorted(blockers.map((blocker) => blocker?.code).filter(Boolean));
  const semanticVisualBlockerCodes = new Set(['semantic_visual_checklist_failures']);
  const otherBlockers = blockers.filter(
    (blocker) => !semanticVisualBlockerCodes.has(blocker?.code),
  );
  return {
    ok: acceptanceGates?.ok === true,
    blockerCount: Number(acceptanceGates?.summary?.blockerCount ?? 0),
    toleranceCount: Number(acceptanceGates?.summary?.toleranceCount ?? 0),
    visualFailCount: Number(acceptanceGates?.summary?.visualFailCount ?? 0),
    semanticVisualFailureCount: Number(acceptanceGates?.summary?.semanticVisualFailureCount ?? 0),
    semanticVisualRequiredCount: Number(acceptanceGates?.summary?.semanticVisualRequiredCount ?? 0),
    otherBlockerCount: otherBlockers.length,
    blockerCodes,
    otherBlockerCodes: uniqueSorted(otherBlockers.map((blocker) => blocker?.code).filter(Boolean)),
  };
}

function cleanPassGateSummary(cleanPassGate) {
  return {
    ok: cleanPassGate?.ok === true,
    blockerCount: Number(cleanPassGate?.summary?.blockerCount ?? 0),
    p0ErrorCount: Number(cleanPassGate?.summary?.p0ErrorCount ?? 0),
    rendererBlockerCount: Number(cleanPassGate?.summary?.rendererBlockerCount ?? 0),
    unresolvedWarningGroupCount: Number(cleanPassGate?.summary?.unresolvedWarningGroupCount ?? 0),
    blockerKinds: uniqueSorted(
      (Array.isArray(cleanPassGate?.blockers) ? cleanPassGate.blockers : [])
        .map((blocker) => blocker?.blockerKind)
        .filter(Boolean),
    ),
  };
}

function countByKey(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row?.[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function summaryCount(summary, key) {
  return Number(summary?.[key] ?? 0);
}

export function geometryDiagnosticSummary(geometryDiagnostic) {
  const findings = Array.isArray(geometryDiagnostic?.findings) ? geometryDiagnostic.findings : [];
  const errorLevelFindings = findings.filter((finding) =>
    BLOCKING_GEOMETRY_DIAGNOSTIC_SEVERITIES.has(normalizedKey(finding?.severity)),
  );
  const summaryBySeverity = geometryDiagnostic?.summary?.bySeverity ?? {};
  const summaryErrorCount =
    summaryCount(summaryBySeverity, 'error') +
    summaryCount(summaryBySeverity, 'blocker') +
    summaryCount(summaryBySeverity, 'blocking');
  const errorLevelFindingCount = Math.max(errorLevelFindings.length, summaryErrorCount);
  const computedBlockingByCategory = countByKey(errorLevelFindings, 'category');
  const summaryByCategory = geometryDiagnostic?.summary?.byCategory ?? {};
  const blockingByCategory = {};
  for (const category of BLOCKING_GEOMETRY_DIAGNOSTIC_CATEGORIES) {
    blockingByCategory[category] = Math.max(
      Number(computedBlockingByCategory[category] ?? 0),
      errorLevelFindings.length === 0 && summaryErrorCount > 0
        ? Number(summaryByCategory[category] ?? 0)
        : 0,
    );
  }
  const blockingCategoryCount = Object.values(blockingByCategory).reduce(
    (sum, count) => sum + count,
    0,
  );
  const blockingFindings = errorLevelFindings.map((finding) => ({
    category: finding.category ?? 'unknown',
    code: finding.code ?? 'unknown_geometry_diagnostic',
    severity: finding.severity ?? 'error',
    elementIds: Array.isArray(finding.elementIds) ? finding.elementIds : [],
    message: finding.message ?? '',
  }));
  return {
    ok: errorLevelFindingCount === 0,
    schemaVersion: geometryDiagnostic?.schemaVersion ?? null,
    totalFindingCount: Number(geometryDiagnostic?.summary?.total ?? findings.length),
    errorLevelFindingCount,
    blockingCategoryCount,
    blockingByCategory,
    blockerCodes: uniqueSorted(blockingFindings.map((finding) => finding.code)),
    sampleBlockers: blockingFindings.slice(0, 8),
  };
}

function toleranceSummary(toleranceLedger) {
  return {
    ok: toleranceLedger?.ok === true,
    findingCount: Number(toleranceLedger?.summary?.findingCount ?? 0),
    toleranceCount: Number(toleranceLedger?.summary?.toleranceCount ?? 0),
    blockingFindingCount: Number(toleranceLedger?.summary?.blockingFindingCount ?? 0),
    incompleteToleranceCount: Number(toleranceLedger?.summary?.incompleteToleranceCount ?? 0),
  };
}

function liveResponsivenessSummary(payload, evidencePath) {
  if (!payload) {
    return {
      present: false,
      path: portable(evidencePath),
      ok: false,
      schemaVersion: null,
      reportSchemaVersion: null,
      summary: null,
      missingInteractions: LIVE_INTERACTIONS,
      failedInteractions: [],
      actionableChurnCount: null,
      blockerCodes: ['live_responsiveness_missing'],
    };
  }
  const report =
    payload.responsivenessReport?.schemaVersion === 'target-house-live-responsiveness.v1'
      ? payload.responsivenessReport
      : payload.schemaVersion === 'target-house-live-responsiveness.v1'
        ? payload
        : null;
  const interactionRows = Array.isArray(report?.interactionRows) ? report.interactionRows : [];
  const passedInteractions = new Set(
    interactionRows
      .filter((row) => row?.status === 'pass')
      .map((row) => row.interaction)
      .filter(Boolean),
  );
  const failedInteractions = interactionRows
    .filter((row) => row?.status && row.status !== 'pass')
    .map((row) => row.interaction)
    .filter(Boolean);
  const missingInteractions = LIVE_INTERACTIONS.filter(
    (interaction) => !passedInteractions.has(interaction),
  );
  const blockerCodes = [];
  if (!report) blockerCodes.push('live_responsiveness_report_missing');
  if (report?.ok !== true) blockerCodes.push('live_responsiveness_failed');
  if (missingInteractions.length > 0) blockerCodes.push('live_responsiveness_interactions_missing');
  if (Number(report?.summary?.actionableChurnCount ?? 0) > 0) {
    blockerCodes.push('live_responsiveness_actionable_churn');
  }
  return {
    present: true,
    path: portable(evidencePath),
    ok: blockerCodes.length === 0,
    schemaVersion: payload.schemaVersion ?? null,
    reportSchemaVersion: report?.schemaVersion ?? null,
    summary: report?.summary ?? null,
    missingInteractions,
    failedInteractions,
    actionableChurnCount: Number(report?.summary?.actionableChurnCount ?? 0),
    blockerCodes,
  };
}

function rehearsalGateSummary({
  requiredEvidence,
  liveEvidenceFresh,
  performanceEvidence,
  cleanPassGate,
  geometryDiagnostic,
  acceptance,
  tolerance,
  liveResponsiveness,
}) {
  const stages = [
    {
      id: 'freshness',
      ok: liveEvidenceFresh === true,
      blockerCode: 'stale_evidence',
      detail: 'Live evidence must match current seed/source digests.',
    },
    {
      id: 'required_evidence',
      ok: requiredEvidence.every((row) => row.present),
      blockerCode: 'missing_required_evidence',
      detail: 'All final-package evidence artifacts must be present.',
    },
    {
      id: 'advisor_integrity_renderer',
      ok: cleanPassGate.ok === true && cleanPassGate.blockerCount === 0,
      blockerCode: 'clean_pass_failed',
      detail: 'Advisor, integrity, constructability, renderer, and tolerance clean-pass must be green.',
    },
    {
      id: 'geometry',
      ok: geometryDiagnostic.ok === true,
      blockerCode: 'geometry_diagnostic_failed',
      detail: 'Target-house geometry diagnostics must have zero error-level findings.',
    },
    {
      id: 'visual_acceptance',
      ok:
        acceptance.ok === true &&
        acceptance.semanticVisualFailureCount === 0 &&
        acceptance.visualFailCount === 0,
      blockerCode: 'visual_acceptance_failed',
      detail: 'Semantic visual and screenshot-backed acceptance gates must be green.',
    },
    {
      id: 'exchange_tolerances',
      ok:
        tolerance.ok === true &&
        tolerance.blockingFindingCount === 0 &&
        tolerance.incompleteToleranceCount === 0,
      blockerCode: 'tolerance_ledger_failed',
      detail: 'No blocking or incomplete tolerance rows may remain.',
    },
    {
      id: 'deterministic_performance',
      ok: performanceEvidence.summary.ok === true,
      blockerCode: 'performance_budget_failed',
      detail: 'Deterministic target-house interaction budget evidence must pass.',
    },
    {
      id: 'live_responsiveness',
      ok: liveResponsiveness.ok === true,
      blockerCode: liveResponsiveness.present
        ? 'live_responsiveness_failed'
        : 'live_responsiveness_missing',
      detail: 'Archived live browser responsiveness evidence must cover orbit, select, lens switch, Advisor open/close, and WebSocket churn.',
    },
  ];
  const blockers = stages.filter((stage) => !stage.ok).map((stage) => stage.blockerCode);
  return {
    schemaVersion: 'target-house-acceptance-rehearsal-gate.v1',
    ok: blockers.length === 0,
    blockers,
    stages,
  };
}

function parseGeneratedSectionRollups(markdown) {
  const rows = {};
  const lines = markdown.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      inSection = line.trim() === '## By Tracker Section';
      continue;
    }
    if (!inSection || !line.trim().startsWith('|')) continue;
    const cells = line
      .trim()
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    if (cells.length < 7 || cells[0] === 'Section' || cells[0].startsWith('---')) continue;
    rows[cells[0]] = {
      section: cells[0],
      itemCount: Number(cells[1]),
      done: Number(cells[2]),
      partial: Number(cells[3]),
      notStarted: Number(cells[4]),
      blocked: Number(cells[5]),
      complete: cells[6],
    };
  }
  return rows;
}

function generatedRowsForFinalPackage(generatedStatusMarkdown, trackerRows) {
  const generatedItemRows = parseTrackerRows(generatedStatusMarkdown, ['BIR-N07']);
  if (generatedItemRows['BIR-N07']) return generatedItemRows;
  const sectionRows = parseGeneratedSectionRollups(generatedStatusMarkdown);
  return {
    'BIR-N07': {
      source: 'generated_section_rollup',
      trackerRow: trackerRows['BIR-N07'] ?? null,
      sectionRollup: sectionRows['N. Target-House-1 Specific Closure'] ?? null,
    },
  };
}

function trackerNotDoneRows(trackerRows, ids) {
  return ids
    .filter((id) => trackerRows[id]?.status !== 'Done')
    .map((id) => ({
      id,
      status: trackerRows[id]?.status ?? 'missing',
    }));
}

export function closeoutStatus({
  requiredEvidence,
  performanceEvidence,
  cleanPassGate,
  geometryDiagnostic,
  acceptance,
  tolerance,
  trackerRows,
  trackerCompletion = null,
  liveResponsiveness = null,
  rehearsalGate = null,
  liveEvidenceFresh,
}) {
  const missingEvidence = requiredEvidence.filter((row) => !row.present).map((row) => row.path);
  const trackerNotDone = trackerNotDoneRows(trackerRows, [
    'BIR-N04',
    'BIR-N07',
    'BIR-N08',
    'BIR-N10',
  ]);
  const blockers = [];
  const blockerDetails = [];
  if (missingEvidence.length > 0) blockers.push('missing_required_evidence');
  if (!liveEvidenceFresh) blockers.push('live_evidence_freshness');
  if (!performanceEvidence.summary.ok) blockers.push('performance_budget');
  if (!cleanPassGate.ok || cleanPassGate.blockerCount > 0) blockers.push('core_clean_pass');
  if (!geometryDiagnostic.ok || geometryDiagnostic.errorLevelFindingCount > 0) {
    blockers.push('geometry_diagnostic');
  }
  if (
    !tolerance.ok ||
    tolerance.blockingFindingCount > 0 ||
    tolerance.incompleteToleranceCount > 0
  ) {
    blockers.push('tolerance_ledger');
  }
  if (acceptance.semanticVisualFailureCount > 0) blockers.push('semantic_visual');
  if (
    !acceptance.ok &&
    (acceptance.otherBlockerCount > 0 || acceptance.semanticVisualFailureCount === 0)
  ) {
    blockers.push('acceptance_gate_blockers');
  }
  if (liveResponsiveness) {
    if (!liveResponsiveness.present) blockers.push('live_responsiveness_missing');
    else if (!liveResponsiveness.ok) blockers.push('live_responsiveness_failed');
  }
  if (rehearsalGate && !rehearsalGate.ok) blockers.push('acceptance_rehearsal_gate');
  if (trackerNotDone.length > 0) blockers.push('tracker_not_done');
  if (trackerCompletion && !trackerCompletion.ok) blockers.push('tracker_incomplete');
  if (missingEvidence.length > 0) {
    blockerDetails.push({
      code: 'missing_required_evidence',
      category: 'evidence',
      count: missingEvidence.length,
      paths: missingEvidence,
    });
  }
  if (!liveEvidenceFresh) {
    blockerDetails.push({ code: 'live_evidence_freshness', category: 'evidence', count: 1 });
  }
  if (!performanceEvidence.summary.ok) {
    blockerDetails.push({
      code: 'performance_budget',
      category: 'performance',
      count: performanceEvidence.summary.overBudgetInteractions?.length ?? 1,
      interactions: performanceEvidence.summary.overBudgetInteractions ?? [],
    });
  }
  if (!cleanPassGate.ok || cleanPassGate.blockerCount > 0) {
    blockerDetails.push({
      code: 'core_clean_pass',
      category: 'core_advisor_clean_pass',
      count: cleanPassGate.blockerCount,
      p0ErrorCount: cleanPassGate.p0ErrorCount,
      rendererBlockerCount: cleanPassGate.rendererBlockerCount,
      unresolvedWarningGroupCount: cleanPassGate.unresolvedWarningGroupCount,
      blockerKinds: cleanPassGate.blockerKinds,
    });
  }
  if (!geometryDiagnostic.ok || geometryDiagnostic.errorLevelFindingCount > 0) {
    blockerDetails.push({
      code: 'geometry_diagnostic',
      category: 'geometry_diagnostic',
      count: geometryDiagnostic.errorLevelFindingCount,
      byCategory: geometryDiagnostic.blockingByCategory,
      blockerCodes: geometryDiagnostic.blockerCodes,
      sampleBlockers: geometryDiagnostic.sampleBlockers,
    });
  }
  if (
    !tolerance.ok ||
    tolerance.blockingFindingCount > 0 ||
    tolerance.incompleteToleranceCount > 0
  ) {
    blockerDetails.push({
      code: 'tolerance_ledger',
      category: 'tolerance',
      blockingFindingCount: tolerance.blockingFindingCount,
      incompleteToleranceCount: tolerance.incompleteToleranceCount,
    });
  }
  if (acceptance.semanticVisualFailureCount > 0) {
    blockerDetails.push({
      code: 'semantic_visual',
      category: 'semantic_visual',
      count: acceptance.semanticVisualFailureCount,
      requiredCount: acceptance.semanticVisualRequiredCount,
    });
  }
  if (
    !acceptance.ok &&
    (acceptance.otherBlockerCount > 0 || acceptance.semanticVisualFailureCount === 0)
  ) {
    blockerDetails.push({
      code: 'acceptance_gate_blockers',
      category: 'acceptance_gates',
      count: acceptance.otherBlockerCount || acceptance.blockerCount,
      blockerCodes: acceptance.otherBlockerCodes,
    });
  }
  if (liveResponsiveness) {
    if (!liveResponsiveness.present || !liveResponsiveness.ok) {
      blockerDetails.push({
        code: liveResponsiveness.present
          ? 'live_responsiveness_failed'
          : 'live_responsiveness_missing',
        category: 'performance',
        count: liveResponsiveness.present ? liveResponsiveness.blockerCodes.length : 1,
        path: liveResponsiveness.path,
        blockerCodes: liveResponsiveness.blockerCodes,
        missingInteractions: liveResponsiveness.missingInteractions,
        failedInteractions: liveResponsiveness.failedInteractions,
        actionableChurnCount: liveResponsiveness.actionableChurnCount,
      });
    }
  }
  if (rehearsalGate && !rehearsalGate.ok) {
    blockerDetails.push({
      code: 'acceptance_rehearsal_gate',
      category: 'rehearsal',
      count: rehearsalGate.blockers.length,
      blockerCodes: rehearsalGate.blockers,
      stages: rehearsalGate.stages.filter((stage) => !stage.ok),
    });
  }
  if (trackerNotDone.length > 0) {
    blockerDetails.push({
      code: 'tracker_not_done',
      category: 'tracker',
      count: trackerNotDone.length,
      rows: trackerNotDone,
    });
  }
  if (trackerCompletion && !trackerCompletion.ok) {
    blockerDetails.push({
      code: 'tracker_incomplete',
      category: 'tracker',
      count: trackerCompletion.incomplete,
      total: trackerCompletion.total,
      done: trackerCompletion.done,
      byStatus: trackerCompletion.byStatus,
      sampleIncompleteRows: trackerCompletion.sampleIncompleteRows,
    });
  }
  return {
    ready: blockers.length === 0,
    blockers,
    blockerDetails,
    status: blockers.length === 0 ? 'ready' : `blocked_${blockers[0]}`,
  };
}

export async function buildTargetHouseFinalCloseoutManifest({
  seed = DEFAULT_SEED,
  snapshotInput = null,
  performanceEvidence = null,
} = {}) {
  const artifactDir = path.join(REPO_ROOT, 'seed-artifacts', seed);
  const manifestPath = path.join(artifactDir, 'manifest.json');
  const manifest = await readJson(manifestPath);
  const bundlePath = path.join(artifactDir, manifest.bundle ?? 'bundle.json');
  const sourceRoot = path.join(artifactDir, manifest.sourceRoot ?? 'source');
  const liveDir = path.join(artifactDir, 'evidence', 'live-run-current');
  const trackerPath = path.join(
    REPO_ROOT,
    'spec',
    'bim-integrity-rendering-sketch-methodology-tracker.md',
  );
  const generatedStatusPath = path.join(
    REPO_ROOT,
    'spec',
    'generated',
    'bim-integrity-tracker-status.md',
  );
  const trackerMarkdown = await fs.readFile(trackerPath, 'utf8');
  const generatedStatusMarkdown = await fs.readFile(generatedStatusPath, 'utf8').catch(() => '');
  snapshotInput ??= resolveTargetHouseSnapshotInput({ repoRoot: REPO_ROOT, seed });
  performanceEvidence ??= await buildTargetHousePerformanceEvidence({ seed, snapshotInput });
  const requiredEvidence = await requiredEvidenceRows(liveDir);
  const cleanPassGate = cleanPassGateSummary(
    await readJson(path.join(liveDir, 'clean-pass-gate.json')),
  );
  const geometryDiagnostic = geometryDiagnosticSummary(
    await readJson(path.join(liveDir, 'target-house-geometry-diagnostic.json')),
  );
  const acceptance = acceptanceSummary(await readJson(path.join(liveDir, 'acceptance-gates.json')));
  const tolerance = toleranceSummary(await readJson(path.join(liveDir, 'tolerance-ledger.json')));
  const liveResponsivenessPath = path.join(liveDir, LIVE_RESPONSIVENESS_EVIDENCE);
  const liveResponsiveness = liveResponsivenessSummary(
    await readJsonIfExists(liveResponsivenessPath),
    liveResponsivenessPath,
  );
  const seedSource = {
    manifestPath: portable(manifestPath),
    sourceRoot: portable(sourceRoot),
    sourceDigest: await sourceDigest(sourceRoot),
    bundlePath: portable(bundlePath),
    bundleSha256: await sha256File(bundlePath),
    manifestBundleSha256: manifest.bundleSha256 ?? null,
    bundleHashMatchesManifest: manifest.bundleSha256 === (await sha256File(bundlePath)),
    commandCount: manifest.commandCount ?? null,
  };
  const trackerRows = parseTrackerRows(trackerMarkdown, [
    'BIR-N04',
    'BIR-N05',
    'BIR-N06',
    'BIR-N07',
    'BIR-N08',
    'BIR-N10',
  ]);
  const trackerCompletion = trackerCompletionSummary(trackerMarkdown);
  const generatedTrackerRows = generatedRowsForFinalPackage(generatedStatusMarkdown, trackerRows);
  const rehearsalGate = rehearsalGateSummary({
    requiredEvidence,
    liveEvidenceFresh: snapshotInput.snapshotSource.liveEvidenceFresh,
    performanceEvidence,
    cleanPassGate,
    geometryDiagnostic,
    acceptance,
    tolerance,
    liveResponsiveness,
  });
  const status = closeoutStatus({
    requiredEvidence,
    performanceEvidence,
    cleanPassGate,
    geometryDiagnostic,
    acceptance,
    tolerance,
    trackerRows,
    trackerCompletion,
    liveResponsiveness,
    rehearsalGate,
    liveEvidenceFresh: snapshotInput.snapshotSource.liveEvidenceFresh,
  });
  const body = {
    schemaVersion: 'target-house-final-closeout-manifest.v1',
    seed,
    generatedAt: new Date(0).toISOString(),
    git: {
      head: gitHead(),
      dirtyCheckPolicy:
        'manifest records head only; parallel worker dirty files are not normalized here',
    },
    seedSource,
    evidence: {
      liveEvidenceRoot: portable(liveDir),
      liveEvidenceFresh: snapshotInput.snapshotSource.liveEvidenceFresh,
      snapshotSource: snapshotInput.snapshotSource,
      requiredEvidence,
      requiredEvidencePresent: requiredEvidence.every((row) => row.present),
    },
    performanceEvidence: {
      summary: performanceEvidence.summary,
      evidenceDigestSha256: performanceEvidence.evidenceDigestSha256,
      interactions: performanceEvidence.interactions,
    },
    tracker: {
      trackerPath: portable(trackerPath),
      generatedStatusPath: portable(generatedStatusPath),
      generatedStatusDigestSha256: generatedStatusMarkdown
        ? sha256Text(generatedStatusMarkdown)
        : null,
      generatedStatusIncludesTargetHouseSection: generatedStatusMarkdown.includes(
        'N. Target-House-1 Specific Closure',
      ),
      rows: trackerRows,
      generatedRows: generatedTrackerRows,
      completion: trackerCompletion,
    },
    tolerances: tolerance,
    cleanPassGate,
    geometryDiagnostic,
    acceptanceGates: acceptance,
    liveResponsiveness,
    rehearsalGate,
    status,
  };
  return {
    ...body,
    manifestDigestSha256: sha256Text(stableJson(body)),
  };
}

export async function writeTargetHouseFinalPackage({ seed = DEFAULT_SEED, outDir } = {}) {
  const resolvedOutDir = path.resolve(outDir ?? path.join(DEFAULT_OUT_ROOT, seed));
  await fs.mkdir(resolvedOutDir, { recursive: true });
  const snapshotInput = resolveTargetHouseSnapshotInput({ repoRoot: REPO_ROOT, seed });
  const performanceEvidence = await buildTargetHousePerformanceEvidence({ seed, snapshotInput });
  const manifest = await buildTargetHouseFinalCloseoutManifest({
    seed,
    snapshotInput,
    performanceEvidence,
  });
  const performancePath = path.join(resolvedOutDir, `${seed}-performance-evidence.json`);
  const manifestPath = path.join(resolvedOutDir, `${seed}-final-closeout-manifest.json`);
  await fs.writeFile(performancePath, `${JSON.stringify(performanceEvidence, null, 2)}\n`, 'utf8');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    ok: manifest.status.ready,
    status: manifest.status.status,
    outDir: portable(resolvedOutDir),
    performancePath: portable(performancePath),
    manifestPath: portable(manifestPath),
    manifest,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await writeTargetHouseFinalPackage(args);
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `target-house final package: ${result.status} (${result.manifestPath}; ${result.performancePath})`,
    );
  }
  if (args.requireReady && !result.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
