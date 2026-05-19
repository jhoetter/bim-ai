#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import {
  buildTargetHouseFinalCloseoutManifest,
  buildTargetHousePerformanceEvidence,
} from './target-house-final-package.mjs';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_SEED = 'target-house-1';
const SCHEMA_VERSION = 'target-house-closeout-report.v1';

const EVIDENCE_FILES = [
  ['tool_run_summary', 'tool-run-summary.json'],
  ['evidence_manifest', 'evidence-manifest.json'],
  ['snapshot', 'snapshot.json'],
  ['target_house_evidence_acceptance', 'target-house-evidence-acceptance.json'],
  ['acceptance_gates', 'acceptance-gates.json'],
  ['advisor_all', 'advisor-all.json'],
  ['constructability_report', 'constructability-report.json'],
  ['geometry_diagnostic', 'target-house-geometry-diagnostic.json'],
  ['visual_gate', 'visual-gate.json'],
  ['visual_evidence_contract', 'visual-evidence-contract.json'],
  ['bim_data_quality', 'bim-data-quality.json'],
  ['export_validation', 'export-validation.json'],
  ['tolerance_ledger', 'tolerance-ledger.json'],
  ['screenshot_manifest', 'screenshot-manifest.json'],
  ['clean_pass_gate', 'clean-pass-gate.json'],
];

function usage() {
  console.error(`Usage:
  node scripts/target-house-closeout-report.mjs [--seed target-house-1] [--repo-root <dir>] [--evidence-dir <dir>] [--out <report.md>] [--lineage-out <lineage.json>] [--json]

Generates:
  seed-artifacts/<seed>/evidence/live-run-current/target-house-closeout-report.md
  seed-artifacts/<seed>/evidence/live-run-current/target-house-closeout-lineage.json
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    seed: DEFAULT_SEED,
    repoRoot: REPO_ROOT,
    evidenceDir: null,
    requiredFeaturesPath: null,
    outPath: null,
    lineageOutPath: null,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--seed' && argv[index + 1]) args.seed = argv[++index];
    else if (arg === '--repo-root' && argv[index + 1]) args.repoRoot = path.resolve(argv[++index]);
    else if (arg === '--evidence-dir' && argv[index + 1])
      args.evidenceDir = path.resolve(argv[++index]);
    else if (arg === '--required-features' && argv[index + 1])
      args.requiredFeaturesPath = path.resolve(argv[++index]);
    else if (arg === '--out' && argv[index + 1]) args.outPath = path.resolve(argv[++index]);
    else if (arg === '--lineage-out' && argv[index + 1])
      args.lineageOutPath = path.resolve(argv[++index]);
    else usage();
  }
  return args;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function sha256File(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

function portable(absPath, repoRoot) {
  const rel = path.relative(repoRoot, absPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
    ? rel.split(path.sep).join('/')
    : absPath;
}

function gitHead(repoRoot) {
  const proc = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

async function exists(file) {
  return fs
    .stat(file)
    .then(() => true)
    .catch(() => false);
}

async function readJsonIfExists(file) {
  if (!(await exists(file))) return null;
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function numberValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function statusFromOk(ok) {
  return ok === true ? 'pass' : ok === false ? 'blocked' : 'present';
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items ?? []) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summarizeEvidenceFile(key, relPath, absPath, payload, digest) {
  const summary = payload?.summary ?? payload?.body?.summary ?? null;
  const ok = payload?.ok ?? payload?.body?.ok ?? summary?.ok ?? null;
  return {
    key,
    path: relPath,
    present: Boolean(payload),
    sha256: digest ? `sha256:${digest}` : null,
    schemaVersion: payload?.schemaVersion ?? payload?.body?.format ?? null,
    status: payload ? statusFromOk(ok) : 'missing',
    summary: summary
      ? Object.fromEntries(
          Object.entries(summary).filter(([, value]) =>
            ['string', 'number', 'boolean'].includes(typeof value),
          ),
        )
      : null,
  };
}

async function collectEvidenceFiles(evidenceDir, repoRoot) {
  const entries = [];
  const payloads = {};
  for (const [key, fileName] of EVIDENCE_FILES) {
    const absPath = path.join(evidenceDir, fileName);
    const payload = await readJsonIfExists(absPath);
    payloads[key] = payload;
    entries.push(
      summarizeEvidenceFile(
        key,
        portable(absPath, repoRoot),
        absPath,
        payload,
        payload ? await sha256File(absPath) : null,
      ),
    );
  }
  return { entries, payloads };
}

function featureRows(requiredFeatures, acceptanceGates) {
  const semanticFailures = acceptanceGates?.semanticVisual?.failures ?? [];
  const failuresByFeature = countBy(semanticFailures, (failure) => failure.featureId);
  return (requiredFeatures?.requiredFeatures ?? []).map((feature) => {
    const semanticFailureCount = failuresByFeature[feature.id] ?? 0;
    return {
      id: feature.id,
      phaseId: feature.phaseId ?? '',
      priority: feature.priority ?? '',
      requiredBimTargets:
        feature.requiredElementIds?.length > 0
          ? feature.requiredElementIds
          : (feature.semanticSelectors ?? []),
      requiredViews: feature.requiredViewIds ?? [],
      evidenceTypes: feature.evidenceTypes ?? [],
      sourceRefs: feature.sourceRefs ?? [],
      status: semanticFailureCount > 0 ? 'blocked_semantic_visual' : 'evidence_linked',
      semanticVisualFailureCount: semanticFailureCount,
    };
  });
}

function screenshotRows(requiredFeatures, evidenceAcceptance, screenshotManifest, evidenceDir, repoRoot) {
  const visualByView = new Map(
    (evidenceAcceptance?.visualRows ?? []).map((row) => [row.viewId, row]),
  );
  const captureByView = new Map((screenshotManifest?.captures ?? []).map((row) => [row.viewId, row]));
  return (requiredFeatures?.requiredViews ?? []).map((view) => {
    const visual = visualByView.get(view.id);
    const capture = captureByView.get(view.id);
    const screenshotPath =
      visual?.screenshot?.path ??
      (capture?.screenshotPath ? path.join(portable(evidenceDir, repoRoot), capture.screenshotPath) : null);
    return {
      viewId: view.id,
      kind: view.kind ?? capture?.viewKind ?? visual?.kind ?? '',
      purpose: view.purpose ?? capture?.purpose ?? '',
      requiredOutput: screenshotPath,
      screenshotSha256: visual?.screenshot?.sha256 ?? null,
      status: visual?.status ?? (capture ? 'captured' : 'missing'),
      savedViewpointPresent: visual?.savedViewpointPresent ?? capture?.syntheticViewpoint === false ?? null,
    };
  });
}

function rendererFeatureForRequiredFeature(feature) {
  const text = [
    feature.id,
    feature.kind,
    ...(feature.semanticSelectors ?? []),
    ...(feature.capabilityNeeds ?? []),
    ...(feature.evidenceTypes ?? []),
  ]
    .join(' ')
    .toLowerCase();
  if (text.includes('roof') && (text.includes('opening') || text.includes('cutout'))) {
    return 'roof-opening';
  }
  if (text.includes('slab') || text.includes('stair opening') || text.includes('shaft')) {
    return 'slab-opening';
  }
  if (text.includes('stair')) return 'stair-geometry';
  if (text.includes('rail') || text.includes('guard')) return 'railing-geometry';
  if (text.includes('room')) return 'room-visualization';
  if (text.includes('material') || text.includes('cladding')) return 'material-resolution';
  if (text.includes('door') || text.includes('window') || text.includes('opening')) return 'wall-cut';
  return 'viewport-3d';
}

function featureCoverageDashboard({
  requiredFeatures,
  acceptanceGates,
  evidenceAcceptance,
  screenshots,
  blockers,
  rendererSupportMatrixDigest,
}) {
  const features = requiredFeatures?.requiredFeatures ?? [];
  const failuresByFeature = countBy(
    acceptanceGates?.semanticVisual?.failures ?? [],
    (failure) => failure.featureId,
  );
  const screenshotByView = new Map(screenshots.map((row) => [row.viewId, row]));
  const rows = features.map((feature) => {
    const requiredViewIds = feature.requiredViewIds ?? [];
    const screenshotRowsForFeature = requiredViewIds
      .map((viewId) => screenshotByView.get(viewId))
      .filter(Boolean);
    const missingScreenshotCount = requiredViewIds.length - screenshotRowsForFeature.length;
    const failingScreenshotCount = screenshotRowsForFeature.filter((row) =>
      ['missing', 'fail', 'blocked'].includes(String(row.status)),
    ).length;
    const openFindingCount = failuresByFeature[feature.id] ?? 0;
    return {
      featureId: feature.id,
      priority: feature.priority ?? '',
      phaseId: feature.phaseId ?? '',
      requiredElementIds: feature.requiredElementIds ?? [],
      semanticSelectors: feature.semanticSelectors ?? [],
      elementCoverageStatus:
        (feature.requiredElementIds ?? []).length > 0
          ? 'explicit_elements'
          : (feature.semanticSelectors ?? []).length > 0
            ? 'semantic_selectors_only'
            : 'missing_element_mapping',
      openFindingCount,
      rendererSupport: {
        matrixDigest: rendererSupportMatrixDigest,
        requiredFeature: rendererFeatureForRequiredFeature(feature),
        status: rendererSupportMatrixDigest ? 'matrix_linked' : 'matrix_missing',
      },
      screenshots: {
        requiredViewCount: requiredViewIds.length,
        linkedCount: screenshotRowsForFeature.length,
        missingCount: missingScreenshotCount,
        failingCount: failingScreenshotCount,
        status:
          missingScreenshotCount > 0 || failingScreenshotCount > 0
            ? 'incomplete'
            : requiredViewIds.length > 0
              ? 'linked'
              : 'not_required',
      },
      blockers: openFindingCount > 0 ? ['semantic_visual_unverified'] : [],
    };
  });
  const screenshotMissingCount = rows.reduce((sum, row) => sum + row.screenshots.missingCount, 0);
  return {
    schemaVersion: 'target-house-feature-coverage-dashboard.v1',
    requiredFeatureCount: rows.length,
    explicitElementCoverageCount: rows.filter(
      (row) => row.elementCoverageStatus === 'explicit_elements',
    ).length,
    semanticSelectorCoverageCount: rows.filter(
      (row) => row.elementCoverageStatus === 'semantic_selectors_only',
    ).length,
    missingElementCoverageCount: rows.filter(
      (row) => row.elementCoverageStatus === 'missing_element_mapping',
    ).length,
    openFindingCount: rows.reduce((sum, row) => sum + row.openFindingCount, 0),
    rendererSupportMatrixDigest,
    screenshotMissingCount,
    blockerCount: blockers.length,
    evidenceAcceptanceOk: evidenceAcceptance?.ok === true,
    rows,
  };
}

function advisorSummary(advisorAll, constructabilityReport) {
  const advisorGroups = advisorAll?.groups ?? [];
  const advisorSeverityCounts = countBy(advisorGroups, (group) => group.severity);
  const constructability = constructabilityReport?.body ?? constructabilityReport;
  const constructabilitySummary = constructability?.summary ?? {};
  return {
    advisorTotal: numberValue(advisorAll?.total),
    advisorSeverityCounts,
    constructabilityFindingCount: numberValue(constructabilitySummary.findingCount),
    constructabilityIssueCount: numberValue(constructabilitySummary.issueCount),
    constructabilitySeverityCounts: constructabilitySummary.severityCounts ?? {},
    advisoryClear:
      numberValue(advisorAll?.total) === 0 &&
      numberValue(constructabilitySummary.findingCount) === 0 &&
      numberValue(constructabilitySummary.issueCount) === 0,
    acceptanceMeaning:
      'Advisor and constructability findings are only one evidence family; target-house acceptance also requires source-feature semantic visual disposition, zero geometry-diagnostic errors, required screenshots/views, exchange/data-quality checks, performance evidence, tolerance closure, and freshness.',
  };
}

function geometrySummary(geometryDiagnostic) {
  const summary = geometryDiagnostic?.summary ?? {};
  return {
    total: numberValue(summary.total),
    bySeverity: summary.bySeverity ?? {},
    byCategory: summary.byCategory ?? {},
    firstBlockers: (geometryDiagnostic?.findings ?? [])
      .filter((finding) => finding.severity === 'error')
      .slice(0, 5)
      .map((finding) => ({
        code: finding.code,
        category: finding.category,
        elementIds: finding.elementIds ?? [],
        message: finding.message,
      })),
  };
}

function visualSummary(acceptanceGates, visualGate, evidenceAcceptance) {
  const gateSummary = acceptanceGates?.summary ?? {};
  const visualGateSummary = visualGate?.summary ?? {};
  const evidenceSummary = evidenceAcceptance?.summary ?? {};
  return {
    evidenceAcceptanceOk: evidenceAcceptance?.ok === true,
    requiredViewCount: numberValue(evidenceSummary.requiredViewCount),
    visualPassCount: numberValue(evidenceSummary.visualPassCount),
    visualFailCount: numberValue(evidenceSummary.visualFailCount),
    screenshotQualityStatus: visualGate
      ? numberValue(visualGateSummary.blockingFailureCount) > 0
        ? 'blocked'
        : numberValue(visualGateSummary.needsReviewCount) > 0
          ? 'needs_review'
          : 'pass'
      : 'missing',
    screenshotNeedsReviewCount: numberValue(visualGateSummary.needsReviewCount),
    semanticVisualRequiredCount: numberValue(gateSummary.semanticVisualRequiredCount),
    semanticVisualFailureCount: numberValue(gateSummary.semanticVisualFailureCount),
    semanticVisualSummary: acceptanceGates?.semanticVisual?.summary ?? null,
  };
}

function dataExchangeSummary(bimDataQuality, exportValidation) {
  const dataSummary = bimDataQuality?.summary ?? {};
  const exportSummary = exportValidation?.summary ?? {};
  return {
    dataQualityOk: bimDataQuality?.ok === true,
    dataQualityErrors: numberValue(dataSummary.errorCount),
    dataQualityWarnings: numberValue(dataSummary.warningCount),
    exchangeOk: exportValidation?.ok === true,
    exchangeErrors: numberValue(exportSummary.errorCount),
    exchangeWarnings: numberValue(exportSummary.warningCount),
    exchangePlanned: numberValue(exportSummary.plannedCount),
  };
}

function toleranceSummary(toleranceLedger) {
  const summary = toleranceLedger?.summary ?? {};
  return {
    ok: toleranceLedger?.ok === true,
    findingCount: numberValue(summary.findingCount),
    toleranceCount: numberValue(summary.toleranceCount),
    blockingFindingCount: numberValue(summary.blockingFindingCount),
    incompleteToleranceCount: numberValue(summary.incompleteToleranceCount),
  };
}

function performanceSummary(performanceEvidence) {
  return {
    present: Boolean(performanceEvidence),
    ok: performanceEvidence?.summary?.ok === true,
    digestSha256: performanceEvidence?.evidenceDigestSha256 ?? null,
    interactions: performanceEvidence?.interactions ?? [],
    maxBudgetRatio: performanceEvidence?.summary?.maxBudgetRatio ?? null,
    overBudgetInteractions: performanceEvidence?.summary?.overBudgetInteractions ?? [],
  };
}

function finalBlockers({ finalManifest, acceptanceGates, geometry, visual, dataExchange, tolerance, performance }) {
  const blockers = [];
  const add = (code, summary) => blockers.push({ code, summary });

  for (const code of finalManifest?.status?.blockers ?? []) {
    add(code, 'Final package manifest reports this blocker.');
  }
  if (numberValue(geometry.bySeverity?.error) > 0) {
    add(
      'geometry_diagnostic_errors',
      `${geometry.bySeverity.error} error finding(s), including ${Object.entries(geometry.byCategory)
        .filter(([, count]) => count > 0)
        .map(([category, count]) => `${category}:${count}`)
        .join(', ')}.`,
    );
  }
  if (acceptanceGates && acceptanceGates.ok !== true) {
    add(
      'acceptance_gates',
      `${numberValue(acceptanceGates.summary?.blockerCount)} gate blocker(s); semantic visual failures: ${numberValue(
        acceptanceGates.summary?.semanticVisualFailureCount,
      )}.`,
    );
  }
  if (visual.semanticVisualFailureCount > 0) {
    add('semantic_visual_unverified', `${visual.semanticVisualFailureCount} required semantic visual row(s) remain unchecked or failed.`);
  }
  if (dataExchange.dataQualityErrors > 0) {
    add('bim_data_quality_errors', `${dataExchange.dataQualityErrors} data-quality error(s).`);
  }
  if (dataExchange.exchangeErrors > 0) {
    add('exchange_validation_errors', `${dataExchange.exchangeErrors} exchange validation error(s).`);
  }
  if (!performance.present) add('performance_evidence_missing', 'No target-house performance evidence was available to the report.');
  else if (!performance.ok) {
    add(
      'performance_budget',
      `Over-budget interactions: ${performance.overBudgetInteractions.join(', ') || 'unspecified'}.`,
    );
  }
  if (!tolerance.ok || tolerance.blockingFindingCount > 0 || tolerance.incompleteToleranceCount > 0) {
    add(
      'tolerance_ledger',
      `${tolerance.blockingFindingCount} blocking finding(s), ${tolerance.incompleteToleranceCount} incomplete tolerance(s).`,
    );
  }

  const byCode = new Map();
  for (const blocker of blockers) if (!byCode.has(blocker.code)) byCode.set(blocker.code, blocker);
  return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
}

async function loadOptionalPerformance({ repoRoot, seed, evidenceDir }) {
  const candidates = [
    path.join(evidenceDir, `${seed}-performance-evidence.json`),
    path.join(repoRoot, 'tmp', 'target-house-final-package', seed, `${seed}-performance-evidence.json`),
  ];
  for (const candidate of candidates) {
    const payload = await readJsonIfExists(candidate);
    if (payload) return { payload, path: candidate };
  }
  if (repoRoot === REPO_ROOT && seed === DEFAULT_SEED) {
    try {
      const payload = await buildTargetHousePerformanceEvidence({ seed });
      return {
        payload,
        path: path.join('scripts', 'target-house-final-package.mjs#buildTargetHousePerformanceEvidence'),
      };
    } catch (error) {
      return {
        payload: null,
        path: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { payload: null, path: null };
}

async function loadOptionalFinalManifest({ repoRoot, seed, evidenceDir, performanceEvidence }) {
  const candidates = [
    path.join(evidenceDir, `${seed}-final-closeout-manifest.json`),
    path.join(repoRoot, 'tmp', 'target-house-final-package', seed, `${seed}-final-closeout-manifest.json`),
  ];
  for (const candidate of candidates) {
    const payload = await readJsonIfExists(candidate);
    if (payload) return { payload, path: candidate };
  }
  if (repoRoot === REPO_ROOT && seed === DEFAULT_SEED) {
    try {
      const payload = await buildTargetHouseFinalCloseoutManifest({ seed, performanceEvidence });
      return {
        payload,
        path: path.join('scripts', 'target-house-final-package.mjs#buildTargetHouseFinalCloseoutManifest'),
      };
    } catch (error) {
      return {
        payload: null,
        path: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { payload: null, path: null };
}

export async function buildTargetHouseCloseoutReport({
  repoRoot = REPO_ROOT,
  seed = DEFAULT_SEED,
  evidenceDir = path.join(repoRoot, 'seed-artifacts', seed, 'evidence', 'live-run-current'),
  requiredFeaturesPath = path.join(repoRoot, 'spec', 'generated', `${seed}-required-features.json`),
  performanceEvidence = null,
  finalManifest = null,
} = {}) {
  const requiredFeatures = await readJsonIfExists(requiredFeaturesPath);
  const { entries: evidenceFiles, payloads } = await collectEvidenceFiles(evidenceDir, repoRoot);
  const performance = performanceEvidence
    ? { payload: performanceEvidence, path: null }
    : await loadOptionalPerformance({ repoRoot, seed, evidenceDir });
  const manifest = finalManifest
    ? { payload: finalManifest, path: null }
    : await loadOptionalFinalManifest({
        repoRoot,
        seed,
        evidenceDir,
        performanceEvidence: performance.payload,
      });

  const features = featureRows(requiredFeatures, payloads.acceptance_gates);
  const screenshots = screenshotRows(
    requiredFeatures,
    payloads.target_house_evidence_acceptance,
    payloads.screenshot_manifest,
    evidenceDir,
    repoRoot,
  );
  const advisor = advisorSummary(payloads.advisor_all, payloads.constructability_report);
  const geometry = geometrySummary(payloads.geometry_diagnostic);
  const visual = visualSummary(
    payloads.acceptance_gates,
    payloads.visual_gate,
    payloads.target_house_evidence_acceptance,
  );
  const dataExchange = dataExchangeSummary(payloads.bim_data_quality, payloads.export_validation);
  const tolerances = toleranceSummary(payloads.tolerance_ledger);
  const perf = performanceSummary(performance.payload);
  const blockers = finalBlockers({
    finalManifest: manifest.payload,
    acceptanceGates: payloads.acceptance_gates,
    geometry,
    visual,
    dataExchange,
    tolerance: tolerances,
    performance: perf,
  });
  const rendererMatrixPath = path.join(repoRoot, 'spec', 'generated', 'renderer-support-matrix.md');
  const rendererSupportMatrixDigest = (await exists(rendererMatrixPath))
    ? `sha256:${await sha256File(rendererMatrixPath)}`
    : null;
  const dashboard = featureCoverageDashboard({
    requiredFeatures,
    acceptanceGates: payloads.acceptance_gates,
    evidenceAcceptance: payloads.target_house_evidence_acceptance,
    screenshots,
    blockers,
    rendererSupportMatrixDigest,
  });

  const lineageBody = {
    schemaVersion: `${SCHEMA_VERSION}.lineage`,
    seed,
    generatedAt: new Date(0).toISOString(),
    git: {
      currentHead: gitHead(repoRoot),
      evidenceHead:
        payloads.tool_run_summary?.gitHead ??
        payloads.evidence_manifest?.currentHead?.gitHead ??
        null,
      dirtyCheckPolicy:
        'Report records source/evidence digests and git heads; concurrent dirty files are not normalized.',
    },
    paths: {
      repoRoot: portable(repoRoot, repoRoot),
      evidenceDir: portable(evidenceDir, repoRoot),
      requiredFeatures: portable(requiredFeaturesPath, repoRoot),
      performanceEvidence: performance.path ? portable(path.resolve(repoRoot, performance.path), repoRoot) : null,
      finalManifest: manifest.path ? portable(path.resolve(repoRoot, manifest.path), repoRoot) : null,
    },
    loadErrors: {
      performanceEvidence: performance.error ?? null,
      finalManifest: manifest.error ?? null,
    },
    sourceDigests: {
      requiredFeatures: requiredFeaturesPath && (await exists(requiredFeaturesPath))
        ? `sha256:${await sha256File(requiredFeaturesPath)}`
        : null,
      ...(requiredFeatures?.sourceDigests ?? {}),
      bundle: payloads.tool_run_summary?.bundleSha256
        ? `sha256:${payloads.tool_run_summary.bundleSha256}`
        : payloads.geometry_diagnostic?.generatedFrom?.sourceDigests?.[
            `seed-artifacts/${seed}/bundle.json`
          ] ?? null,
      snapshot: evidenceFiles.find((entry) => entry.key === 'snapshot')?.sha256 ?? null,
      advisorRuleDigest: payloads.tool_run_summary?.advisorRuleDigest
        ? `sha256:${payloads.tool_run_summary.advisorRuleDigest}`
        : null,
      capabilities: payloads.tool_run_summary?.capabilitiesSha256
        ? `sha256:${payloads.tool_run_summary.capabilitiesSha256}`
        : null,
      rendererSupportMatrix: rendererSupportMatrixDigest,
      finalManifest: manifest.payload?.manifestDigestSha256
        ? `sha256:${manifest.payload.manifestDigestSha256}`
        : null,
      performanceEvidence: performance.payload?.evidenceDigestSha256
        ? `sha256:${performance.payload.evidenceDigestSha256}`
        : null,
    },
    evidenceFiles,
    summaries: {
      advisor,
      geometry,
      visual,
      dataExchange,
      performance: perf,
      tolerances,
      finalPackageStatus: manifest.payload?.status ?? null,
    },
    features,
    screenshots,
    featureCoverageDashboard: dashboard,
    blockers,
    ready: blockers.length === 0,
  };
  const lineage = {
    ...lineageBody,
    lineageDigestSha256: sha256Text(stableJson(lineageBody)),
  };
  const markdown = renderCloseoutMarkdown(lineage);
  return {
    lineage,
    markdown,
    reportDigestSha256: sha256Text(markdown),
  };
}

function tableCell(value) {
  if (Array.isArray(value)) return value.join(', ').replaceAll('|', '\\|');
  if (isObject(value)) return JSON.stringify(value).replaceAll('|', '\\|');
  return String(value ?? '').replaceAll('|', '\\|');
}

function renderKeyValueRows(rows) {
  return rows.map(([key, value]) => `| ${tableCell(key)} | ${tableCell(value)} |`);
}

function renderCloseoutMarkdown(lineage) {
  const lines = [
    '# Target-House Closeout Report',
    '',
    '<!-- generated by scripts/target-house-closeout-report.mjs; do not edit by hand -->',
    '',
    `Target: \`${lineage.seed}\``,
    `Schema: \`${SCHEMA_VERSION}\``,
    `Generated at: \`${lineage.generatedAt}\``,
    `Lineage digest: \`sha256:${lineage.lineageDigestSha256}\``,
    '',
    '## Review Status',
    '',
    lineage.ready
      ? 'Status: `ready` - all closeout evidence families accepted.'
      : `Status: \`blocked\` - ${lineage.blockers.length} closeout blocker(s) remain.`,
    '',
    '| Blocker | Summary |',
    '| ------- | ------- |',
  ];
  if (lineage.blockers.length === 0) lines.push('| none | No blockers reported. |');
  for (const blocker of lineage.blockers) lines.push(`| \`${blocker.code}\` | ${tableCell(blocker.summary)} |`);

  lines.push(
    '',
    '## Advisor Is Not Acceptance',
    '',
    'No Advisor findings is not target-house acceptance. It only means the normal Advisor/constructability evidence family did not report blocking advisory findings. Target-house acceptance also requires source-feature semantic visual disposition, zero geometry-diagnostic errors, required saved views and screenshots, renderer/visual evidence, exchange and BIM data-quality checks, performance evidence, tolerance closure, and current lineage.',
    '',
    '| Evidence family | Current result | Why it matters |',
    '| --------------- | -------------- | -------------- |',
    `| Advisor | ${lineage.summaries.advisor.advisorTotal} Advisor finding(s); ${lineage.summaries.advisor.constructabilityFindingCount} constructability finding(s) | Advisory checks do not prove sketch fidelity or geometric source acceptance. |`,
    `| Geometry diagnostic | ${lineage.summaries.geometry.total} finding(s); errors: ${numberValue(lineage.summaries.geometry.bySeverity.error)} | Detached/flying/out-of-envelope/helper-leakage findings block target-house acceptance even when Advisor is quiet. |`,
    `| Semantic visual gate | ${lineage.summaries.visual.semanticVisualFailureCount} required row(s) unchecked or failed | Screenshots can exist while source-sketch features remain undispositioned. |`,
    `| Exchange/data quality | data errors ${lineage.summaries.dataExchange.dataQualityErrors}; exchange errors ${lineage.summaries.dataExchange.exchangeErrors}; planned exchange checks ${lineage.summaries.dataExchange.exchangePlanned} | Export/readback and information requirements are separate from Advisor findings. |`,
    `| Performance | ${lineage.summaries.performance.present ? (lineage.summaries.performance.ok ? 'pass' : 'blocked') : 'missing'} | Closeout must show the target-house model is usable, not just diagnostically clean. |`,
    `| Tolerances | ${lineage.summaries.tolerances.blockingFindingCount} blocking; ${lineage.summaries.tolerances.incompleteToleranceCount} incomplete | Deferred assumptions need owners, evidence, and expiry before acceptance. |`,
    '',
    '## Lineage',
    '',
    '| Field | Value |',
    '| ----- | ----- |',
    ...renderKeyValueRows([
      ['current git head', lineage.git.currentHead ?? 'unknown'],
      ['evidence git head', lineage.git.evidenceHead ?? 'unknown'],
      ['evidence dir', lineage.paths.evidenceDir],
      ['required features', lineage.paths.requiredFeatures],
      ['performance evidence', lineage.paths.performanceEvidence ?? 'generated in-memory/missing'],
      ['final package manifest', lineage.paths.finalManifest ?? 'generated in-memory/missing'],
      ['performance load error', lineage.loadErrors.performanceEvidence ?? 'none'],
      ['final manifest load error', lineage.loadErrors.finalManifest ?? 'none'],
      ['required features digest', lineage.sourceDigests.requiredFeatures ?? 'missing'],
      ['bundle digest', lineage.sourceDigests.bundle ?? 'missing'],
      ['snapshot digest', lineage.sourceDigests.snapshot ?? 'missing'],
      ['Advisor rule digest', lineage.sourceDigests.advisorRuleDigest ?? 'missing'],
      ['renderer support matrix digest', lineage.sourceDigests.rendererSupportMatrix ?? 'missing'],
      ['performance digest', lineage.sourceDigests.performanceEvidence ?? 'missing'],
      ['final manifest digest', lineage.sourceDigests.finalManifest ?? 'missing'],
    ]),
    '',
    '## Evidence Files',
    '',
    '| Artifact | Path | Status | Digest | Summary |',
    '| -------- | ---- | ------ | ------ | ------- |',
  );
  for (const entry of lineage.evidenceFiles) {
    lines.push(
      `| \`${entry.key}\` | \`${entry.path}\` | ${entry.status} | ${entry.sha256 ? `\`${entry.sha256}\`` : 'missing'} | ${tableCell(entry.summary ?? '')} |`,
    );
  }

  lines.push(
    '',
    '## Source Features And Required BIM Targets',
    '',
    '| Feature | Phase | Priority | Required BIM targets/selectors | Required views | Evidence | Status |',
    '| ------- | ----- | -------- | ----------------------------- | -------------- | -------- | ------ |',
  );
  for (const feature of lineage.features) {
    lines.push(
      `| \`${feature.id}\` | ${feature.phaseId} | ${feature.priority} | ${tableCell(feature.requiredBimTargets)} | ${tableCell(feature.requiredViews)} | ${tableCell(feature.evidenceTypes)} | ${feature.status}${feature.semanticVisualFailureCount ? ` (${feature.semanticVisualFailureCount})` : ''} |`,
    );
  }

  lines.push(
    '',
    '## Saved Views And Screenshots',
    '',
    '| View | Kind | Status | Screenshot | Digest | Purpose |',
    '| ---- | ---- | ------ | ---------- | ------ | ------- |',
  );
  for (const row of lineage.screenshots) {
    lines.push(
      `| \`${row.viewId}\` | ${tableCell(row.kind)} | ${tableCell(row.status)} | ${row.requiredOutput ? `\`${row.requiredOutput}\`` : 'missing'} | ${row.screenshotSha256 ? `\`${row.screenshotSha256}\`` : 'missing'} | ${tableCell(row.purpose)} |`,
    );
  }

  lines.push(
    '',
    '## Feature Coverage Dashboard',
    '',
    '| Metric | Value |',
    '| ------ | ----- |',
    ...renderKeyValueRows([
      ['required features', lineage.featureCoverageDashboard.requiredFeatureCount],
      ['explicit element coverage', lineage.featureCoverageDashboard.explicitElementCoverageCount],
      ['semantic selector coverage', lineage.featureCoverageDashboard.semanticSelectorCoverageCount],
      ['missing element coverage', lineage.featureCoverageDashboard.missingElementCoverageCount],
      ['open feature findings', lineage.featureCoverageDashboard.openFindingCount],
      ['missing screenshots', lineage.featureCoverageDashboard.screenshotMissingCount],
      ['closeout blockers', lineage.featureCoverageDashboard.blockerCount],
      ['renderer support matrix', lineage.featureCoverageDashboard.rendererSupportMatrixDigest ?? 'missing'],
    ]),
    '',
    '| Feature | Elements | Open findings | Renderer support | Screenshots | Blockers |',
    '| ------- | -------- | ------------- | ---------------- | ----------- | -------- |',
  );
  for (const row of lineage.featureCoverageDashboard.rows) {
    lines.push(
      `| \`${row.featureId}\` | ${row.elementCoverageStatus} | ${row.openFindingCount} | ${row.rendererSupport.requiredFeature}:${row.rendererSupport.status} | ${row.screenshots.status} (${row.screenshots.linkedCount}/${row.screenshots.requiredViewCount}) | ${tableCell(row.blockers)} |`,
    );
  }

  lines.push(
    '',
    '## Geometry Diagnostic',
    '',
    '| Metric | Value |',
    '| ------ | ----- |',
    ...renderKeyValueRows([
      ['total findings', lineage.summaries.geometry.total],
      ['by severity', lineage.summaries.geometry.bySeverity],
      ['by category', lineage.summaries.geometry.byCategory],
    ]),
    '',
    '| Code | Category | Elements | Summary |',
    '| ---- | -------- | -------- | ------- |',
  );
  if (lineage.summaries.geometry.firstBlockers.length === 0) {
    lines.push('| none | none | none | No error-level geometry blockers listed. |');
  }
  for (const finding of lineage.summaries.geometry.firstBlockers) {
    lines.push(
      `| \`${finding.code}\` | ${finding.category} | ${tableCell(finding.elementIds)} | ${tableCell(finding.message)} |`,
    );
  }

  lines.push(
    '',
    '## Renderer, Exchange, Performance, And Tolerances',
    '',
    '| Area | Result |',
    '| ---- | ------ |',
    ...renderKeyValueRows([
      ['required screenshot evidence', `${lineage.summaries.visual.visualPassCount}/${lineage.summaries.visual.requiredViewCount} visual rows passed`],
      ['screenshot quality gate', `${lineage.summaries.visual.screenshotQualityStatus}; needs review ${lineage.summaries.visual.screenshotNeedsReviewCount}`],
      ['BIM data quality', `ok=${lineage.summaries.dataExchange.dataQualityOk}; errors=${lineage.summaries.dataExchange.dataQualityErrors}; warnings=${lineage.summaries.dataExchange.dataQualityWarnings}`],
      ['exchange validation', `ok=${lineage.summaries.dataExchange.exchangeOk}; errors=${lineage.summaries.dataExchange.exchangeErrors}; warnings=${lineage.summaries.dataExchange.exchangeWarnings}; planned=${lineage.summaries.dataExchange.exchangePlanned}`],
      ['performance', lineage.summaries.performance.present ? `ok=${lineage.summaries.performance.ok}; max budget ratio=${lineage.summaries.performance.maxBudgetRatio}` : 'missing'],
      ['tolerances', `ok=${lineage.summaries.tolerances.ok}; blocking=${lineage.summaries.tolerances.blockingFindingCount}; incomplete=${lineage.summaries.tolerances.incompleteToleranceCount}`],
    ]),
    '',
  );
  return `${lines.join('\n')}\n`;
}

export async function writeTargetHouseCloseoutReport({
  repoRoot = REPO_ROOT,
  seed = DEFAULT_SEED,
  evidenceDir = path.join(repoRoot, 'seed-artifacts', seed, 'evidence', 'live-run-current'),
  requiredFeaturesPath = path.join(repoRoot, 'spec', 'generated', `${seed}-required-features.json`),
  outPath = path.join(evidenceDir, 'target-house-closeout-report.md'),
  lineageOutPath = path.join(evidenceDir, 'target-house-closeout-lineage.json'),
} = {}) {
  const result = await buildTargetHouseCloseoutReport({
    repoRoot,
    seed,
    evidenceDir,
    requiredFeaturesPath,
  });
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(lineageOutPath), { recursive: true });
  await fs.writeFile(outPath, result.markdown, 'utf8');
  await fs.writeFile(lineageOutPath, `${JSON.stringify(result.lineage, null, 2)}\n`, 'utf8');
  return {
    ...result,
    outPath: portable(outPath, repoRoot),
    lineageOutPath: portable(lineageOutPath, repoRoot),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const evidenceDir =
    args.evidenceDir ??
    path.join(args.repoRoot, 'seed-artifacts', args.seed, 'evidence', 'live-run-current');
  const result = await writeTargetHouseCloseoutReport({
    repoRoot: args.repoRoot,
    seed: args.seed,
    evidenceDir,
    requiredFeaturesPath:
      args.requiredFeaturesPath ??
      path.join(args.repoRoot, 'spec', 'generated', `${args.seed}-required-features.json`),
    outPath: args.outPath ?? path.join(evidenceDir, 'target-house-closeout-report.md'),
    lineageOutPath:
      args.lineageOutPath ?? path.join(evidenceDir, 'target-house-closeout-lineage.json'),
  });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `target-house closeout report: ${result.lineage.ready ? 'ready' : 'blocked'} (${result.outPath}; ${result.lineageOutPath})`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
