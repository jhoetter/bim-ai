import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

import {
  buildExchangeValidationReport,
  buildToleranceLedgerFromDispositions,
  INITIATION_MODES,
  readJsonFile,
  writeInitiationPacket,
} from './sketch-initiation.mjs';
import { buildVisualGateReport, readTargetMap } from './png-visual-gate.mjs';
import { compileSeedDsl } from './seed-dsl.mjs';
import { base, fetchJson, fetchJsonResponseNoThrow } from './api-client.mjs';
import { advisorFindingRows, advisorSummary, severityRank } from './advisor-summary.mjs';
import {
  currentEvidenceInputs,
  evidenceFreshnessFromDir,
  evidenceFreshnessReport,
  normalizeEvidenceMetadata,
  relativeToCwd,
  writeToolRunSummary,
} from './evidence-freshness.mjs';

function commandsFromBundleJson(blob) {
  if (Array.isArray(blob)) return blob;
  if (blob && typeof blob === 'object' && Array.isArray(blob.commands)) return blob.commands;
  console.error('Bundle must be a JSON array or { "commands": [...] }.');
  process.exit(1);
}

function applyQualityMode(ir, qualityMode) {
  if (!qualityMode) return ir;
  if (!INITIATION_MODES[qualityMode]) {
    console.error(
      `Unknown initiation mode '${qualityMode}'. Use: ${Object.keys(INITIATION_MODES).join(', ')}`,
    );
    process.exit(1);
  }
  return { ...ir, qualityTarget: qualityMode };
}

async function cmdSketchPhaseApply({
  modelId,
  userId,
  bundlePath,
  baseRevision,
  applyMode,
  outPath,
  phaseId,
  featureIds,
}) {
  if (!modelId) {
    console.error('sketch phase apply requires --model <id> or BIM_AI_MODEL_ID.');
    process.exit(1);
  }
  if (!bundlePath) {
    console.error('sketch phase apply requires --bundle <path>.');
    process.exit(1);
  }
  const result = await applyRunnerBundle(modelId, userId, bundlePath, baseRevision, applyMode);
  const payload = {
    schemaVersion: 'sketch.phase.apply.result.v0',
    ok: result.ok,
    phaseId: phaseId ?? null,
    featureIds,
    transaction: result,
  };
  if (outPath) await writeJsonArtifact(outPath, payload);
  console.log(JSON.stringify(payload, null, 2));
  if (!result.ok) process.exit(1);
}

async function loadPhaseFindingDispositions(evidenceDir) {
  if (!evidenceDir) return null;
  const filePath = path.join(evidenceDir, 'finding-dispositions.json');
  try {
    const payload = await readJsonFile(filePath);
    const findings = Array.isArray(payload?.findings) ? payload.findings : [];
    const toleranceLedger = buildToleranceLedgerFromDispositions(payload, {
      phaseId: payload?.phaseId ?? null,
      evidenceDir,
    });
    const unclassifiedBlocking = findings.filter(
      (finding) =>
        ['error', 'warning'].includes(String(finding?.severity ?? '')) &&
        ['unclassified', 'fix-now', 'fix-in-phase', ''].includes(
          String(finding?.disposition ?? 'unclassified'),
        ),
    );
    const blockers = findings.filter(
      (finding) =>
        ['error', 'warning'].includes(String(finding?.severity ?? '')) &&
        String(finding?.disposition ?? '') === 'blocked',
    );
    return {
      path: filePath,
      schemaVersion: payload.schemaVersion ?? null,
      findingCount: findings.length,
      countsBySeverity: findings.reduce((acc, finding) => {
        const severity = String(finding?.severity ?? 'unknown');
        acc[severity] = (acc[severity] ?? 0) + 1;
        return acc;
      }, {}),
      countsByDisposition: findings.reduce((acc, finding) => {
        const disposition = String(finding?.disposition ?? 'unclassified');
        acc[disposition] = (acc[disposition] ?? 0) + 1;
        return acc;
      }, {}),
      toleranceLedger,
      unclassifiedBlocking,
      blockers,
      ok: unclassifiedBlocking.length === 0 && blockers.length === 0 && toleranceLedger.ok,
    };
  } catch (error) {
    return {
      path: filePath,
      ok: false,
      missing: true,
      error: error?.message ?? String(error),
      findingCount: 0,
      countsBySeverity: {},
      countsByDisposition: {},
      toleranceLedger: null,
      unclassifiedBlocking: [],
      blockers: [],
    };
  }
}

async function loadVisualChecklistEvidence(evidenceDir) {
  if (!evidenceDir) return null;
  for (const name of ['visual-checklist.json', 'semantic-checklist.json']) {
    const filePath = path.join(evidenceDir, name);
    try {
      const parsed = await readJsonFile(filePath);
      if (parsed && typeof parsed === 'object') return { ...parsed, sourcePath: filePath };
    } catch {
      // Optional agent-filled artifact. Missing or invalid files leave acceptance unverified.
    }
  }
  return null;
}

async function loadJsonEvidenceFile(evidenceDir, names) {
  if (!evidenceDir) return null;
  for (const name of names) {
    const filePath = path.join(evidenceDir, name);
    try {
      const parsed = await readJsonFile(filePath);
      if (parsed && typeof parsed === 'object') return { ...parsed, sourcePath: filePath };
    } catch {
      // Optional evidence channel. Missing files leave the corresponding gate inactive.
    }
  }
  return null;
}

async function loadJsonEvidenceFromDirs(evidenceDir, fallbackDir, names) {
  return (
    (await loadJsonEvidenceFile(evidenceDir, names)) ??
    (await loadJsonEvidenceFile(fallbackDir, names))
  );
}

function driftRowsFromEvidence(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.driftRows)) return payload.driftRows;
  if (Array.isArray(payload?.drift)) return payload.drift;
  return [];
}

async function buildSketchPhaseAcceptance({
  irPath,
  capabilityMatrixPath,
  outDir,
  modelId,
  qualityMode,
  phaseId,
  evidenceDir,
}) {
  const ir = applyQualityMode(await readJsonFile(irPath), qualityMode);
  const matrix = await readJsonFile(capabilityMatrixPath);
  const evidenceFreshness = evidenceDir
    ? await evidenceFreshnessFromDir({
        evidenceDir,
        modelId,
        irPath,
        capabilityMatrixPath,
      })
    : null;
  const defaultEvidenceDir = path.join(outDir, 'live');
  const visualChecklist =
    (await loadVisualChecklistEvidence(evidenceDir)) ??
    (await loadVisualChecklistEvidence(defaultEvidenceDir));
  let dispositionSummary = null;
  if (evidenceDir) {
    dispositionSummary = await loadPhaseFindingDispositions(evidenceDir);
  } else {
    try {
      await fs.access(path.join(defaultEvidenceDir, 'finding-dispositions.json'));
      dispositionSummary = await loadPhaseFindingDispositions(defaultEvidenceDir);
    } catch {
      dispositionSummary = null;
    }
  }
  const rendererDiagnosticsEvidence = await loadJsonEvidenceFromDirs(
    evidenceDir,
    defaultEvidenceDir,
    ['renderer-diagnostics-evidence.json', 'renderer-diagnostics.json'],
  );
  const bimIntegrityEvidence = await loadJsonEvidenceFromDirs(evidenceDir, defaultEvidenceDir, [
    'bim-integrity-evidence.json',
    'model-integrity-evidence.json',
    'integrity-diagnostics.json',
  ]);
  const requiredFeaturePack = await loadJsonEvidenceFromDirs(evidenceDir, defaultEvidenceDir, [
    'required-features.json',
    'target-house-required-features.json',
    'target-house-1-required-features.json',
  ]);
  const visualDriftEvidence = await loadJsonEvidenceFromDirs(evidenceDir, defaultEvidenceDir, [
    'visual-drift.json',
    'semantic-visual-drift.json',
    'readout-drift.json',
  ]);
  const evidenceRun =
    evidenceFreshness ||
    visualChecklist ||
    rendererDiagnosticsEvidence ||
    bimIntegrityEvidence ||
    requiredFeaturePack ||
    visualDriftEvidence ||
    dispositionSummary?.toleranceLedger
      ? {
          evidenceFreshness,
          visualChecklist,
          rendererDiagnosticsEvidence,
          bimIntegrityEvidence,
          requiredFeatures: requiredFeaturePack?.requiredFeatures ?? null,
          visualDriftRows: driftRowsFromEvidence(visualDriftEvidence),
          toleranceLedger: dispositionSummary?.toleranceLedger ?? null,
          phaseId: phaseId ?? null,
        }
      : null;
  const result = await writeInitiationPacket({
    ir,
    matrix,
    outDir,
    irPath,
    capabilityMatrixPath,
    modelId: modelId ?? null,
    evidenceRun,
  });
  if (dispositionSummary) {
    await writeJsonArtifact(path.join(outDir, 'phase-finding-dispositions.json'), {
      schemaVersion: 'sketch.phase.finding-disposition-summary.v1',
      phaseId: phaseId ?? null,
      evidenceDir: evidenceDir ?? defaultEvidenceDir,
      ...dispositionSummary,
    });
    if (dispositionSummary.toleranceLedger) {
      await writeJsonArtifact(
        path.join(outDir, 'phase-tolerance-ledger.json'),
        dispositionSummary.toleranceLedger,
      );
    }
  }
  const payload = {
    schemaVersion: 'sketch.phase.accept.cli-result.v0',
    phaseId: phaseId ?? null,
    findingDispositions: dispositionSummary,
    ...result,
  };
  return payload;
}

async function cmdSketchPhaseAccept({
  irPath,
  capabilityMatrixPath,
  outDir,
  modelId,
  qualityMode,
  failOnAcceptance,
  phaseId,
  evidenceDir,
}) {
  if (!irPath || !outDir) {
    console.error('sketch phase accept requires --ir <path> --out <dir>.');
    process.exit(1);
  }
  const payload = await buildSketchPhaseAcceptance({
    irPath,
    capabilityMatrixPath,
    outDir,
    modelId,
    qualityMode,
    phaseId,
    evidenceDir,
  });
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 2;
    return;
  }
  if (payload.findingDispositions?.ok === false) {
    process.exitCode = 6;
    return;
  }
  if (failOnAcceptance && payload.acceptance?.ok === false) {
    process.exitCode = 5;
  }
}

async function cmdSketchPhaseRun({
  modelId,
  userId,
  irPath,
  phasePlanPath,
  recipePath,
  bundlePath,
  bundleOutPath,
  baseRevision,
  applyMode,
  outDir,
  evidenceDir,
  acceptanceOutDir,
  applyOutPath,
  capabilityMatrixPath,
  qualityMode,
  phaseId,
  featureIds,
  constructabilityProfile,
  failOnAcceptance,
  failOnBlockingDispositions,
}) {
  if (!modelId) {
    console.error('sketch phase run requires --model <id> or BIM_AI_MODEL_ID.');
    process.exit(1);
  }
  if (!irPath || !phaseId) {
    console.error('sketch phase run requires --ir <path> --phase <id>.');
    process.exit(1);
  }
  if (!bundlePath && !recipePath) {
    console.error('sketch phase run requires --bundle <path> or --recipe <path>.');
    process.exit(1);
  }
  const runRoot = outDir ?? evidenceDir;
  if (!runRoot) {
    console.error('sketch phase run requires --out <dir> or --evidence-out <dir>.');
    process.exit(1);
  }
  const resolvedEvidenceDir = evidenceDir ?? path.join(runRoot, 'evidence');
  const resolvedAcceptanceDir = acceptanceOutDir ?? path.join(runRoot, 'acceptance');
  const resolvedBundlePath =
    bundlePath ??
    bundleOutPath ??
    path.join(runRoot, `phase-${safeArtifactName(phaseId)}.bundle.json`);
  const resolvedApplyOutPath =
    applyOutPath ??
    path.join(runRoot, applyMode === 'commit' ? 'phase-commit.json' : 'phase-dry-run.json');

  await fs.mkdir(runRoot, { recursive: true });
  if (recipePath && !bundlePath) {
    const recipe = await readJsonFile(recipePath);
    const bundle = compileSeedDsl(recipe, { modelHint: modelId });
    await writeJsonArtifact(resolvedBundlePath, bundle);
  }

  const applyResult = await applyRunnerBundle(
    modelId,
    userId,
    resolvedBundlePath,
    baseRevision,
    applyMode,
  );
  const applyPayload = {
    schemaVersion: 'sketch.phase.apply.result.v0',
    ok: applyResult.ok,
    phaseId: phaseId ?? null,
    featureIds,
    transaction: applyResult,
  };
  await writeJsonArtifact(resolvedApplyOutPath, applyPayload);
  if (!applyResult.ok) {
    const payload = {
      schemaVersion: 'sketch.phase.run.result.v0',
      ok: false,
      phaseId,
      modelId,
      applyMode,
      qualityMode: qualityMode ?? null,
      phasePlanPath: relativeToCwd(phasePlanPath),
      paths: {
        runRoot,
        recipe: relativeToCwd(recipePath),
        bundle: relativeToCwd(resolvedBundlePath),
        apply: relativeToCwd(resolvedApplyOutPath),
        evidence: relativeToCwd(resolvedEvidenceDir),
        acceptance: relativeToCwd(resolvedAcceptanceDir),
      },
      apply: applyPayload,
      evidence: null,
      acceptance: null,
    };
    await writeJsonArtifact(path.join(runRoot, 'phase-run.json'), payload);
    console.log(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  const ir = applyQualityMode(await readJsonFile(irPath), qualityMode);
  const evidence = await collectModelEvidenceArtifacts({
    modelId,
    outDir: resolvedEvidenceDir,
    ir,
    irPath,
    capabilityMatrixPath,
    phaseId,
    constructabilityProfile,
  });
  const toolRun = await writeToolRunSummary({
    outDir: resolvedEvidenceDir,
    modelId,
    modelRevision: evidence.snap?.revision ?? null,
    irPath,
    capabilityMatrixPath,
    bundlePath: resolvedBundlePath,
    mode: qualityMode ?? ir.qualityTarget ?? null,
  });
  const acceptance = await buildSketchPhaseAcceptance({
    irPath,
    capabilityMatrixPath,
    outDir: resolvedAcceptanceDir,
    modelId,
    qualityMode,
    phaseId,
    evidenceDir: resolvedEvidenceDir,
  });
  const dispositionsOk = acceptance.findingDispositions?.ok !== false;
  const acceptanceOk = acceptance.ok !== false && acceptance.acceptance?.ok !== false;
  const payload = {
    schemaVersion: 'sketch.phase.run.result.v0',
    ok: applyPayload.ok && dispositionsOk && acceptanceOk,
    phaseId,
    modelId,
    applyMode,
    qualityMode: qualityMode ?? ir.qualityTarget ?? null,
    phasePlanPath: relativeToCwd(phasePlanPath),
    featureIds,
    paths: {
      runRoot: relativeToCwd(runRoot),
      recipe: relativeToCwd(recipePath),
      bundle: relativeToCwd(resolvedBundlePath),
      apply: relativeToCwd(resolvedApplyOutPath),
      evidence: relativeToCwd(resolvedEvidenceDir),
      acceptance: relativeToCwd(resolvedAcceptanceDir),
      toolRunSummary: relativeToCwd(toolRun.summaryPath),
    },
    apply: applyPayload,
    evidence: evidence.manifest,
    acceptance,
  };
  await writeJsonArtifact(path.join(runRoot, 'phase-run.json'), payload);
  console.log(JSON.stringify(payload, null, 2));
  if (!acceptance.ok) {
    process.exitCode = 2;
    return;
  }
  if (failOnBlockingDispositions && !dispositionsOk) {
    process.exitCode = 6;
    return;
  }
  if (failOnAcceptance && acceptance.acceptance?.ok === false) {
    process.exitCode = 5;
  }
}

async function cmdSketchEvidenceCollect({
  modelId,
  outDir,
  irPath,
  capabilityMatrixPath,
  phaseId,
  constructabilityProfile,
  failOnBlockingDispositions,
}) {
  if (!modelId) {
    console.error('sketch evidence collect requires --model <id> or BIM_AI_MODEL_ID.');
    process.exit(1);
  }
  if (!outDir) {
    console.error('sketch evidence collect requires --out <dir>.');
    process.exit(1);
  }
  const ir = irPath ? await readJsonFile(irPath) : null;
  const result = await collectModelEvidenceArtifacts({
    modelId,
    outDir,
    ir,
    irPath,
    capabilityMatrixPath,
    phaseId,
    constructabilityProfile,
  });
  console.log(JSON.stringify(result.manifest, null, 2));
  if (failOnBlockingDispositions && result.manifest.summary.unclassifiedBlockingFindingCount > 0) {
    process.exit(6);
  }
}

function safeArtifactName(value) {
  return (
    String(value || 'view')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'view'
  );
}

function modelStatsFromSnapshot(snap) {
  const elements = snap?.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const countsByKind = {};
  for (const element of Object.values(elements)) {
    const kind =
      element && typeof element === 'object' && typeof element.kind === 'string'
        ? element.kind
        : '?';
    countsByKind[kind] = (countsByKind[kind] ?? 0) + 1;
  }
  return {
    modelId: snap?.modelId ?? null,
    revision: snap?.revision ?? null,
    elementCount: Object.keys(elements).length,
    countsByKind,
  };
}

function visualEvidenceContractFromIr(ir, snap, outDir) {
  const requiredViews = Array.isArray(ir?.requiredViews) ? ir.requiredViews : [];
  const elements = snap?.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const savedViewpoints = new Set(
    Object.values(elements)
      .filter((element) => element && typeof element === 'object' && element.kind === 'viewpoint')
      .map((element) => element.id)
      .filter(Boolean),
  );
  const screenshotsDir = path.join(outDir, 'screenshots');
  return {
    schemaVersion: 'sketch.visual-evidence-contract.v1',
    generatedAt: new Date().toISOString(),
    browserAutomationRequired: false,
    note: 'Screenshots are an evidence capture method. Core snapshot, validate, evidence package, Advisor, constructability, and model stats checks do not require browser automation.',
    inputs: {
      modelId: snap?.modelId ?? null,
      revision: snap?.revision ?? null,
      requiredViews: requiredViews.map((view, index) => {
        const id = view?.id ?? `view-${index + 1}`;
        return {
          id,
          kind: view?.kind ?? 'unknown',
          purpose: view?.purpose ?? '',
          featureIds: view?.featureIds ?? [],
          viewpointId: view?.viewpointId ?? id,
          savedViewpointPresent: savedViewpoints.has(view?.viewpointId ?? id),
          camera: view?.camera ?? null,
          requiredOutput: path.join('screenshots', `${safeArtifactName(id)}.png`),
        };
      }),
    },
    outputs: {
      screenshotsDirectory: screenshotsDir,
      screenshotManifest: path.join(outDir, 'screenshot-manifest.json'),
      visualGateReport: path.join(outDir, 'visual-gate-report.json'),
      semanticChecklist: path.join(outDir, 'semantic-checklist.json'),
    },
    captureMethods: [
      {
        id: 'browser_automation',
        role: 'ui-equivalent screenshot capture',
        requiredForCoreValidation: false,
      },
      {
        id: 'renderer_snapshot',
        role: 'headless or server-side render from snapshot and viewpoint',
        requiredForCoreValidation: false,
      },
      {
        id: 'manual_review_upload',
        role: 'externally captured PNG attached to the manifest',
        requiredForCoreValidation: false,
      },
    ],
    validation: {
      nonBlankImageRequired: true,
      semanticChecklistRequired: true,
      staleModelRevisionMustMatchManifest: true,
    },
  };
}

function constructabilitySummary(report) {
  const body = report?.body && typeof report.body === 'object' ? report.body : {};
  const summary = body.summary && typeof body.summary === 'object' ? body.summary : {};
  const structureScope = body.domainIntegrityScope_v1?.sourceScopes?.structure_mep_lite ?? {};
  const severityCounts =
    summary.severityCounts && typeof summary.severityCounts === 'object'
      ? summary.severityCounts
      : {};
  return {
    ok: !!report?.ok,
    status: report?.status ?? null,
    profile: body.profile ?? body.profileId ?? null,
    certification: structureScope.certification ?? null,
    engineeringDisclaimer: structureScope.engineeringDisclaimer ?? null,
    severityCounts,
    total:
      Number(severityCounts.error ?? 0) +
      Number(severityCounts.warning ?? 0) +
      Number(severityCounts.info ?? 0),
  };
}

function constructabilityFindingRows(report) {
  const body = report?.body && typeof report.body === 'object' ? report.body : {};
  const structureScope = body.domainIntegrityScope_v1?.sourceScopes?.structure_mep_lite ?? {};
  const candidates = [
    ...(Array.isArray(body.findings) ? body.findings : []),
    ...(Array.isArray(body.advisories) ? body.advisories : []),
    ...(Array.isArray(body.violations) ? body.violations : []),
  ];
  return candidates
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const severity = String(row.severity ?? row.level ?? 'warning');
      return {
        source: 'constructability',
        profile: body.profile ?? body.profileId ?? null,
        severity,
        code: row.code ?? row.ruleId ?? row.advisoryClass ?? 'unknown',
        count: row.count ?? 1,
        elementIds: row.elementIds ?? row.elements ?? [],
        messages: [row.message ?? row.title ?? row.description].filter(Boolean),
        certification: structureScope.certification ?? null,
        engineeringDisclaimer: structureScope.engineeringDisclaimer ?? null,
        disposition: severity === 'info' ? 'reviewed' : 'unclassified',
        phaseRationale: '',
        toleranceEvidence: '',
        owner: '',
        expiryCondition: '',
      };
    });
}

async function collectModelEvidenceArtifacts({
  modelId,
  outDir,
  ir = null,
  irPath = null,
  capabilityMatrixPath = null,
  phaseId = null,
  constructabilityProfile = 'construction_readiness',
}) {
  await fs.mkdir(outDir, { recursive: true });
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const validate = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/validate`,
  );
  const evidencePackage = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/evidence-package`,
  );
  const advisor = {
    error: await advisorSummary(modelId, { severity: 'error' }),
    warning: await advisorSummary(modelId, { severity: 'warning' }),
    info: await advisorSummary(modelId, { severity: 'info' }),
    all: await advisorSummary(modelId),
  };
  const constructability = await fetchJsonResponseNoThrow(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/constructability-report?profile=${encodeURIComponent(
      constructabilityProfile,
    )}`,
  );
  const modelStats = modelStatsFromSnapshot(snap);
  const currentHead = await currentEvidenceInputs({
    modelId,
    modelRevision: snap.revision ?? null,
    irPath,
    capabilityMatrixPath,
  });
  const visualEvidenceContract = visualEvidenceContractFromIr(ir, snap, outDir);
  const findingDispositions = {
    schemaVersion: 'sketch.finding-dispositions.v1',
    generatedAt: new Date().toISOString(),
    modelId,
    revision: snap.revision ?? null,
    phaseId,
    allowedDispositions: [
      'unclassified',
      'fix-now',
      'fix-in-phase',
      'later-phase',
      'tolerated',
      'blocked',
      'fixed',
      'reviewed',
    ],
    findings: [
      ...advisorFindingRows(advisor.error, 'advisor'),
      ...advisorFindingRows(advisor.warning, 'advisor'),
      ...advisorFindingRows(advisor.info, 'advisor'),
      ...constructabilityFindingRows(constructability),
    ].sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        String(a.source).localeCompare(String(b.source)) ||
        String(a.code).localeCompare(String(b.code)),
    ),
  };
  const toleranceLedger = buildToleranceLedgerFromDispositions(findingDispositions, {
    phaseId,
    evidenceDir: outDir,
  });
  const gltfManifest = await fetchJsonResponseNoThrow(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/exports/gltf-manifest`,
  );
  const ifcManifest = await fetchJsonResponseNoThrow(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/exports/ifc-manifest`,
  );
  const exchangeValidationReport = buildExchangeValidationReport({
    ir,
    modelStats,
    validate,
    evidencePackage,
    gltfManifest,
    ifcManifest,
  });
  const artifacts = {
    snapshot: await writeJsonArtifact(path.join(outDir, 'snapshot.json'), snap),
    validate: await writeJsonArtifact(path.join(outDir, 'validate.json'), validate),
    evidencePackage: await writeJsonArtifact(
      path.join(outDir, 'evidence-package.json'),
      evidencePackage,
    ),
    advisorError: await writeJsonArtifact(path.join(outDir, 'advisor-error.json'), advisor.error),
    advisorWarning: await writeJsonArtifact(
      path.join(outDir, 'advisor-warning.json'),
      advisor.warning,
    ),
    advisorInfo: await writeJsonArtifact(path.join(outDir, 'advisor-info.json'), advisor.info),
    advisorAll: await writeJsonArtifact(path.join(outDir, 'advisor-all.json'), advisor.all),
    constructabilityReport: await writeJsonArtifact(
      path.join(outDir, 'constructability-report.json'),
      constructability,
    ),
    modelStats: await writeJsonArtifact(path.join(outDir, 'model-stats.json'), modelStats),
    visualEvidenceContract: await writeJsonArtifact(
      path.join(outDir, 'visual-evidence-contract.json'),
      visualEvidenceContract,
    ),
    findingDispositions: await writeJsonArtifact(
      path.join(outDir, 'finding-dispositions.json'),
      findingDispositions,
    ),
    toleranceLedger: await writeJsonArtifact(
      path.join(outDir, 'tolerance-ledger.json'),
      toleranceLedger,
    ),
    exportValidation: await writeJsonArtifact(
      path.join(outDir, 'export-validation.json'),
      exchangeValidationReport,
    ),
  };
  const manifest = {
    schemaVersion: 'sketch.evidence.collection.v1',
    generatedAt: new Date().toISOString(),
    modelId,
    revision: snap.revision ?? null,
    phaseId,
    baseUrl: base,
    currentHead,
    browserAutomationRequired: false,
    constructabilityProfile,
    artifacts,
    summary: {
      modelStats,
      advisor: {
        error: advisor.error.total,
        warning: advisor.warning.total,
        info: advisor.info.total,
      },
      constructability: constructabilitySummary(constructability),
      requiredVisualViewCount: visualEvidenceContract.inputs.requiredViews.length,
      findingDispositionCount: findingDispositions.findings.length,
      unclassifiedBlockingFindingCount: findingDispositions.findings.filter(
        (finding) =>
          ['error', 'warning'].includes(finding.severity) &&
          ['unclassified', 'fix-now', 'fix-in-phase'].includes(finding.disposition),
      ).length,
      toleranceLedger: toleranceLedger.summary,
      exchangeValidation: exchangeValidationReport.summary,
    },
  };
  artifacts.manifest = await writeJsonArtifact(path.join(outDir, 'evidence-manifest.json'), {
    ...manifest,
    artifacts: { ...artifacts, manifest: path.join(outDir, 'evidence-manifest.json') },
  });
  return {
    snap,
    validate,
    evidencePackage,
    liveAdvisor: { warning: advisor.warning, info: advisor.info, error: advisor.error },
    modelStats,
    constructability,
    visualEvidenceContract,
    findingDispositions,
    toleranceLedger,
    exchangeValidationReport,
    liveArtifacts: artifacts,
    manifest: { ...manifest, artifacts },
  };
}

async function writeJsonArtifact(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

async function applyRunnerBundle(modelId, userId, bundlePath, baseRevision, mode) {
  const raw = (await fs.readFile(bundlePath, 'utf8')).trim();
  if (!raw) throw new Error(`Empty bundle JSON: ${bundlePath}`);
  const blob = JSON.parse(raw);
  const resolvedBaseRevision = Number.isFinite(baseRevision)
    ? baseRevision
    : (await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`))
        .revision;
  let bundle;
  if (blob && typeof blob === 'object' && blob.schemaVersion === 'cmd-v3.0') {
    bundle = { ...blob, parentRevision: resolvedBaseRevision };
  } else {
    bundle = {
      schemaVersion: 'cmd-v3.0',
      commands: commandsFromBundleJson(blob),
      assumptions: [
        {
          key: 'initiation-run-legacy-bundle',
          value: true,
          confidence: 0,
          source: 'cli-initiation-run',
        },
      ],
      parentRevision: resolvedBaseRevision,
    };
  }
  const res = await fetch(`${base}/api/models/${encodeURIComponent(modelId)}/bundles`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundle, mode, userId }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return {
    ok: res.ok,
    status: res.status,
    mode,
    bundlePath,
    baseRevision: resolvedBaseRevision,
    response: json,
  };
}

async function writeLiveEvidenceArtifacts(
  modelId,
  outDir,
  { ir = null, irPath = null, capabilityMatrixPath = null, phaseId = null } = {},
) {
  const liveDir = path.join(outDir, 'live');
  return collectModelEvidenceArtifacts({
    modelId,
    outDir: liveDir,
    ir,
    irPath,
    capabilityMatrixPath,
    phaseId,
  });
}

function screenshotRequiredViews(ir) {
  const supportedKinds = new Set([
    '3d',
    'elevation',
    'diagnostic',
    'plan',
    'floor_plan',
    'section',
  ]);
  return (ir.requiredViews ?? []).filter((view) => supportedKinds.has(view?.kind));
}

function collectMmPoints(value, points) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectMmPoints(item, points);
    return;
  }
  if (Number.isFinite(value.xMm) && Number.isFinite(value.yMm)) {
    points.push({
      xMm: value.xMm,
      yMm: value.yMm,
      zMm: Number.isFinite(value.zMm) ? value.zMm : 0,
    });
  }
  for (const child of Object.values(value)) collectMmPoints(child, points);
}

function modelBoundsFromSnapshot(snap) {
  const elements = snap?.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const points = [];
  for (const element of Object.values(elements)) {
    if (!element || typeof element !== 'object' || element.kind === 'viewpoint') continue;
    collectMmPoints(element, points);
    for (const key of ['elevationMm', 'elevMm', 'baseElevationMm', 'topElevationMm']) {
      if (Number.isFinite(element[key])) points.push({ xMm: 0, yMm: 0, zMm: element[key] });
    }
  }
  if (!points.length) {
    return {
      minX: -5000,
      minY: -4000,
      minZ: 0,
      maxX: 5000,
      maxY: 4000,
      maxZ: 6500,
      center: { xMm: 0, yMm: 0, zMm: 3250 },
      span: 10000,
    };
  }
  const minX = Math.min(...points.map((point) => point.xMm));
  const minY = Math.min(...points.map((point) => point.yMm));
  const minZ = Math.min(...points.map((point) => point.zMm));
  const maxX = Math.max(...points.map((point) => point.xMm));
  const maxY = Math.max(...points.map((point) => point.yMm));
  const maxZ = Math.max(...points.map((point) => point.zMm));
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 3000);
  return {
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
    center: {
      xMm: (minX + maxX) / 2,
      yMm: (minY + maxY) / 2,
      zMm: (minZ + maxZ) / 2,
    },
    span,
  };
}

function syntheticCameraForView(view, bounds) {
  const label = `${view?.id ?? ''} ${view?.kind ?? ''} ${view?.purpose ?? ''}`.toLowerCase();
  const dist = bounds.span * 1.8;
  const target = { ...bounds.center };
  let position;
  if (label.includes('plan') || label.includes('top') || label.includes('roof')) {
    position = {
      xMm: target.xMm + dist * 0.12,
      yMm: target.yMm - dist * 0.12,
      zMm: bounds.maxZ + dist * 1.15,
    };
  } else if (label.includes('rear') || label.includes('back') || label.includes('north')) {
    position = { xMm: target.xMm, yMm: target.yMm + dist, zMm: target.zMm + bounds.span * 0.25 };
  } else if (label.includes('east') || label.includes('right') || label.includes('side')) {
    position = { xMm: target.xMm + dist, yMm: target.yMm, zMm: target.zMm + bounds.span * 0.25 };
  } else if (label.includes('west') || label.includes('left')) {
    position = { xMm: target.xMm - dist, yMm: target.yMm, zMm: target.zMm + bounds.span * 0.25 };
  } else if (label.includes('front') || label.includes('south') || label.includes('elevation')) {
    position = { xMm: target.xMm, yMm: target.yMm - dist, zMm: target.zMm + bounds.span * 0.22 };
  } else {
    position = {
      xMm: target.xMm - dist * 0.7,
      yMm: target.yMm - dist,
      zMm: target.zMm + bounds.span * 0.55,
    };
  }
  return { position, target, up: { xMm: 0, yMm: 0, zMm: 1 } };
}

async function snapshotPathForView({
  view,
  snap,
  baseSnapshotPath,
  screenshotDir,
  hasSavedViewpoint,
  bounds,
}) {
  if (hasSavedViewpoint) return { path: baseSnapshotPath, syntheticViewpoint: false };
  const elements = snap?.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const syntheticSnapshot = {
    ...snap,
    elements: {
      ...elements,
      [view.id]: {
        kind: 'viewpoint',
        id: view.id,
        name: `SKB ${view.purpose ?? view.id}`,
        mode: 'orbit_3d',
        camera: syntheticCameraForView(view, bounds),
        hiddenSemanticKinds3d: [],
      },
    },
  };
  const syntheticPath = path.join(screenshotDir, `.snapshot-${safeArtifactName(view.id)}.json`);
  await fs.writeFile(syntheticPath, `${JSON.stringify(syntheticSnapshot, null, 2)}\n`, 'utf8');
  return { path: syntheticPath, syntheticViewpoint: true };
}

async function renderInitiationScreenshots(ir, snap, snapshotPath, outDir) {
  const views = screenshotRequiredViews(ir);
  const screenshotDir = path.join(outDir, 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  const elements = snap?.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const savedViewpoints = new Set(
    Object.values(elements)
      .filter((element) => element && typeof element === 'object' && element.kind === 'viewpoint')
      .map((element) => element.id)
      .filter(Boolean),
  );
  const bounds = modelBoundsFromSnapshot(snap);
  const captures = [];
  for (const view of views) {
    const filePath = path.join(screenshotDir, `${safeArtifactName(view.id)}.png`);
    const hasSavedViewpoint = savedViewpoints.has(view.id);
    const viewSnapshot = await snapshotPathForView({
      view,
      snap,
      baseSnapshotPath: snapshotPath,
      screenshotDir,
      hasSavedViewpoint,
      bounds,
    });
    const env = {
      ...process.env,
      SKB_SNAPSHOT_PATH: path.resolve(viewSnapshot.path),
      SKB_VIEWPOINT_ID: view.id,
      SKB_SCREENSHOT_OUT: path.resolve(filePath),
    };
    execSync(
      'pnpm --filter @bim-ai/web exec playwright test packages/web/e2e/skb-checkpoint.spec.ts --config playwright.skb.config.ts',
      { stdio: 'inherit', env, cwd: process.cwd() },
    );
    captures.push({
      viewId: view.id,
      viewKind: view.kind,
      purpose: view.purpose ?? '',
      screenshotPath: filePath,
      usedViewpointId: view.id,
      syntheticViewpoint: viewSnapshot.syntheticViewpoint,
      fallbackFit: false,
    });
  }
  return {
    schemaVersion: 'sketch-to-bim-screenshot-manifest.v0',
    generatedAt: new Date().toISOString(),
    captures,
  };
}

async function cmdInitiationRun({
  irPath,
  capabilityMatrixPath,
  outDir,
  modelId,
  userId,
  screenshots,
  seedCommand,
  applyBundlePath,
  baseRevision,
  applyMode,
  failOnWarning,
  targetImagePath,
  targetMapPath,
  visualThreshold,
  failOnVisual,
  qualityMode,
  failOnAcceptance,
}) {
  if (!modelId) {
    console.error('initiation-run requires --model <id> or BIM_AI_MODEL_ID.');
    process.exit(1);
  }
  const ir = applyQualityMode(await readJsonFile(irPath), qualityMode);
  const matrix = await readJsonFile(capabilityMatrixPath);
  await fs.mkdir(outDir, { recursive: true });

  const runArtifacts = {};
  if (seedCommand) {
    const seedCommandPath = path.join(outDir, 'seed-command.txt');
    await fs.writeFile(seedCommandPath, `${seedCommand}\n`, 'utf8');
    execSync(seedCommand, { stdio: 'inherit', cwd: process.cwd(), shell: true });
    runArtifacts.seedCommand = seedCommandPath;
  }
  if (applyBundlePath) {
    const applyResult = await applyRunnerBundle(
      modelId,
      userId,
      applyBundlePath,
      baseRevision,
      applyMode,
    );
    runArtifacts.bundleApply = await writeJsonArtifact(
      path.join(outDir, applyMode === 'commit' ? 'bundle-apply.json' : 'bundle-dry-run.json'),
      applyResult,
    );
    if (!applyResult.ok) {
      console.log(JSON.stringify({ ok: false, outDir, runArtifacts, applyResult }, null, 2));
      process.exit(1);
    }
  }

  const live = await writeLiveEvidenceArtifacts(modelId, outDir, {
    ir,
    irPath,
    capabilityMatrixPath,
  });
  const toolRun = await writeToolRunSummary({
    outDir,
    modelId,
    modelRevision: live.snap?.revision ?? null,
    irPath,
    capabilityMatrixPath,
    bundlePath: applyBundlePath,
    mode: qualityMode ?? ir.qualityTarget ?? null,
  });
  const evidenceFreshness = evidenceFreshnessReport({
    recorded: normalizeEvidenceMetadata(toolRun.summary),
    current: await currentEvidenceInputs({
      modelId,
      modelRevision: live.snap?.revision ?? null,
      irPath,
      capabilityMatrixPath,
    }),
    sourcePath: toolRun.summaryPath,
  });
  let screenshotManifest = null;
  let visualGateReport = null;
  if (screenshots) {
    screenshotManifest = await renderInitiationScreenshots(
      ir,
      live.snap,
      live.liveArtifacts.snapshot,
      outDir,
    );
    const targetMap = targetMapPath ? await readTargetMap(targetMapPath) : null;
    visualGateReport = await buildVisualGateReport({
      screenshotManifest,
      targetImagePath,
      targetMap,
      threshold: visualThreshold,
    });
  }
  const evidenceRun = {
    liveArtifacts: {
      ...runArtifacts,
      toolRunSummary: toolRun.summaryPath,
      ...live.liveArtifacts,
    },
    modelStats: live.modelStats,
    exchangeValidationReport: live.exchangeValidationReport,
    screenshotManifest,
    visualGateReport,
    evidenceFreshness,
  };
  const result = await writeInitiationPacket({
    ir,
    matrix,
    outDir,
    irPath,
    capabilityMatrixPath,
    modelId,
    liveAdvisor: live.liveAdvisor,
    screenshotManifest,
    visualGateReport,
    evidenceRun,
  });
  const finalResult = {
    ...result,
    liveArtifacts: evidenceRun.liveArtifacts,
    screenshotManifest,
    visualGateReport,
  };
  console.log(JSON.stringify(finalResult, null, 2));
  if (!result.ok) {
    process.exitCode = 2;
    return;
  }
  if (failOnWarning && (live.liveAdvisor.warning?.total ?? 0) > 0) {
    process.exitCode = 3;
    return;
  }
  if (failOnVisual && (visualGateReport?.summary?.failCount ?? 0) > 0) {
    process.exitCode = 4;
    return;
  }
  if (failOnAcceptance && result.acceptance?.ok === false) {
    process.exitCode = 5;
  }
}

export {
  applyQualityMode,
  cmdInitiationRun,
  cmdSketchEvidenceCollect,
  cmdSketchPhaseAccept,
  cmdSketchPhaseApply,
  cmdSketchPhaseRun,
  commandsFromBundleJson,
  safeArtifactName,
  writeJsonArtifact,
};
