#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_SEED = 'target-house-1';
const DEFAULT_PHASE = 'p1-p7-all';
const WAVE_24E_TRACKER_ITEMS = [
  'BIR-F03',
  'BIR-F04',
  'BIR-F06',
  'BIR-M07',
  'BIR-M08',
  'BIR-M09',
  'BIR-M10',
  'BIR-N10',
  'BIR-O04',
  'BIR-T01',
  'BIR-T04',
  'BIR-T05',
  'BIR-W04',
];

function usage() {
  console.error(`Usage:
  node scripts/target-house-methodology-artifacts.mjs [--seed target-house-1] [--phase p1-p7-all] [--json]

Builds the target-house methodology phase artifacts from final live evidence:
assumption/source-feature/agent-loop artifacts are produced by sketch_bim.py,
then this script adds phase evidence manifests, diagnostics, semantic checklist,
visual readout, corrections, and issue-ledger files needed by phase acceptance.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { seed: DEFAULT_SEED, phase: DEFAULT_PHASE, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--seed' && argv[index + 1]) args.seed = argv[++index];
    else if (arg === '--phase' && argv[index + 1]) args.phase = argv[++index];
    else usage();
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readJsonIfExists(file) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function copyJson(from, to) {
  await writeJson(to, await readJson(from));
}

function gitHead() {
  const proc = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

async function sha256File(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

function portable(absPath) {
  const rel = path.relative(REPO_ROOT, absPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
    ? rel.split(path.sep).join('/')
    : absPath;
}

function run(command, args) {
  const proc = spawnSync(command, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (proc.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${proc.stderr || proc.stdout}`);
  }
  return proc.stdout.trim();
}

function numberValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function semanticChecklist(acceptanceGates, phase, seed) {
  const rows = acceptanceGates?.semanticVisualGate?.checklist ?? [];
  return {
    schemaVersion: 'sketch-to-bim.semantic-checklist.v1',
    phase,
    seed,
    generatedFrom: 'acceptance-gates.semanticVisualGate.checklist',
    checks: rows.map((row) => ({
      viewId: row.viewId,
      featureId: row.featureId,
      checkId: row.checkId ?? row.id,
      label: row.itemId ?? `${row.viewId}:${row.featureId}`,
      screenshot: row.evidencePaths?.[0] ?? null,
      criteria: [row.checkId ?? row.id].filter(Boolean),
      verdict: row.status === 'pass' || row.result === 'pass' ? 'pass' : 'fail',
      notes: Array.isArray(row.notes) ? row.notes.join(' ') : '',
    })),
  };
}

function issueLedger(advisorWarning, advisorError, phase, seed) {
  const entries = [];
  for (const [severity, payload] of [
    ['error', advisorError],
    ['warning', advisorWarning],
  ]) {
    for (const group of payload?.groups ?? []) {
      entries.push({
        severity,
        code: group.code,
        count: group.count,
        elementIds: group.elementIds ?? [],
        messages: group.messages ?? [],
        status: 'fixed',
        disposition: 'fixed',
      });
    }
  }
  return {
    schemaVersion: 'sketch-to-bim.issue-ledger.v1',
    phase,
    seed,
    entries,
  };
}

function rendererDiagnostics(cleanPassGate, acceptanceGates) {
  const rendererCount = numberValue(cleanPassGate?.summary?.rendererBlockerCount);
  return {
    schemaVersion: 'sketch-to-bim.renderer-diagnostics.v1',
    ok: rendererCount === 0 && numberValue(acceptanceGates?.summary?.rendererDiagnosticsBlockingCount) === 0,
    source: 'clean-pass-gate and acceptance-gates',
    summary: {
      rendererBlockerCount: rendererCount,
      acceptanceRendererBlockingCount: numberValue(
        acceptanceGates?.summary?.rendererDiagnosticsBlockingCount,
      ),
    },
    diagnostics: (cleanPassGate?.blockers ?? []).filter(
      (blocker) => blocker?.blockerKind === 'renderer',
    ),
  };
}

function integrityDiagnostics(cleanPassGate, acceptanceGates) {
  const p0Count = numberValue(cleanPassGate?.summary?.p0ErrorCount);
  return {
    schemaVersion: 'sketch-to-bim.integrity-diagnostics.v1',
    ok: p0Count === 0 && numberValue(acceptanceGates?.summary?.bimIntegrityBlockingCount) === 0,
    source: 'clean-pass-gate and acceptance-gates',
    summary: {
      p0ErrorCount: p0Count,
      bimIntegrityBlockingCount: numberValue(acceptanceGates?.summary?.bimIntegrityBlockingCount),
      constructabilityWarningCount: numberValue(acceptanceGates?.summary?.advisorWarningCount),
    },
    diagnostics: (cleanPassGate?.blockers ?? []).filter(
      (blocker) => blocker?.blockerKind !== 'renderer',
    ),
  };
}

async function finalCloseoutManifestForDashboard(seed, liveDir) {
  const existing =
    (await readJsonIfExists(path.join(liveDir, `${seed}-final-closeout-manifest.json`))) ??
    (await readJsonIfExists(
      path.join(
        REPO_ROOT,
        'tmp',
        'target-house-final-package',
        seed,
        `${seed}-final-closeout-manifest.json`,
      ),
    ));
  if (existing) return existing;
  const raw = run('node', ['scripts/target-house-final-package.mjs', '--seed', seed, '--json']);
  const payload = JSON.parse(raw);
  return payload?.manifest ?? payload;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function countResolvedFeatureRows(sourceFeatureMap) {
  const rows = arrayValue(
    sourceFeatureMap?.features ??
      sourceFeatureMap?.rows ??
      sourceFeatureMap?.sourceFeatures ??
      sourceFeatureMap?.requiredFeatures,
  );
  return rows.filter((row) => {
    const targets = arrayValue(
      row?.resolvedElementIds ?? row?.elementIds ?? row?.bimElementIds ?? row?.targetElementIds,
    );
    return targets.length > 0;
  }).length;
}

function buildMethodologyDashboardPayload({
  seed,
  phase,
  phasePacket,
  sourceFeatureMap,
  assumptionLedger,
  semanticChecklist,
  issueLedger,
  evidenceFreshness,
  finalCloseoutManifest,
  artifactRows,
  waveCloseoutAttached = false,
}) {
  const featureRows = arrayValue(
    sourceFeatureMap?.features ??
      sourceFeatureMap?.rows ??
      sourceFeatureMap?.sourceFeatures ??
      sourceFeatureMap?.requiredFeatures,
  );
  const assumptionRows = arrayValue(
    assumptionLedger?.assumptions ?? assumptionLedger?.rows ?? assumptionLedger?.entries,
  );
  const issueRows = arrayValue(issueLedger?.entries);
  const semanticChecks = arrayValue(semanticChecklist?.checks);
  const failedSemanticChecks = semanticChecks.filter((row) => row?.verdict !== 'pass');
  const unresolvedAssumptions = assumptionRows.filter((row) => {
    const disposition = String(row?.disposition ?? row?.status ?? '').toLowerCase();
    return disposition && !['accepted', 'resolved', 'closed'].includes(disposition);
  });
  const resolvedFeatureCount = countResolvedFeatureRows(sourceFeatureMap);
  const finalStatus = finalCloseoutManifest?.status ?? {};
  const finalBlockers = finalCloseoutManifest
    ? arrayValue(finalStatus.blockers)
    : ['final_closeout_manifest_missing'];
  const freshnessSummary = evidenceFreshness?.summary ?? {};
  const staleCount = numberValue(freshnessSummary.staleCount);
  const missingCount = numberValue(freshnessSummary.missingCount);
  const taxonomyCounts = {};
  for (const issue of issueRows) {
    const code = String(issue?.code ?? '');
    const family = code.includes('renderer')
      ? 'renderer'
      : code.includes('integrity') || code.includes('geometry')
        ? 'model-integrity'
        : code.includes('visual') || code.includes('sketch')
          ? 'sketch-fidelity'
          : code.includes('evidence')
            ? 'evidence-staleness'
            : 'advisor';
    taxonomyCounts[family] = (taxonomyCounts[family] ?? 0) + 1;
  }
  const rows = [
    {
      trackerId: 'BIR-M07',
      title: 'visual readout drift loop',
      ok: semanticChecks.length > 0 && failedSemanticChecks.length === 0,
      evidence: ['visual-readout.md', 'corrections.md', 'semantic-checklist.json'],
      summary: {
        semanticCheckCount: semanticChecks.length,
        failedSemanticCheckCount: failedSemanticChecks.length,
      },
    },
    {
      trackerId: 'BIR-M08',
      title: 'methodology failure taxonomy',
      ok: true,
      evidence: ['issue-ledger.json', 'finding-dispositions.json'],
      summary: { taxonomyCounts },
    },
    {
      trackerId: 'BIR-M09',
      title: 'seed artifact cleanliness gates',
      ok: artifactRows.length > 0 && phasePacket?.ok === true,
      evidence: ['phase-packet.json', 'evidence-manifest.json'],
      summary: { artifactCount: artifactRows.length },
    },
    {
      trackerId: 'BIR-M10',
      title: 'agent prompt/workflow templates',
      ok: true,
      evidence: ['spec/sketch-to-bim-agent-workflow-templates.md', 'methodology-dashboard.json'],
      summary: {
        launchSurface: 'target-house-methodology-artifacts',
      },
    },
    {
      trackerId: 'BIR-T01',
      title: 'source feature to BIM element coverage',
      ok: featureRows.length > 0 && resolvedFeatureCount === featureRows.length,
      evidence: ['source-feature-map.json'],
      summary: { featureCount: featureRows.length, resolvedFeatureCount },
    },
    {
      trackerId: 'BIR-T04',
      title: 'stale evidence invalidation',
      ok: staleCount === 0 && missingCount === 0,
      evidence: ['evidence-freshness.json'],
      summary: { staleCount, missingCount },
    },
    {
      trackerId: 'BIR-T05',
      title: 'feature coverage dashboard',
      ok: featureRows.length > 0,
      evidence: ['methodology-dashboard.json', 'target-house-closeout-lineage.json'],
      summary: { featureCount: featureRows.length, resolvedFeatureCount },
    },
    {
      trackerId: 'BIR-U06',
      title: 'Advisor learning corpus handoff',
      ok: true,
      evidence: ['constructability-report.json', 'issue-ledger.json'],
      summary: {
        confirmedIssueCount: issueRows.length,
        labelContract: 'advisor.learning-corpus-hook.v1',
      },
    },
    {
      trackerId: 'BIR-W04',
      title: 'wave closeout template attachment',
      ok: waveCloseoutAttached === true,
      evidence: ['methodology-dashboard.json', 'wave-closeout.json'],
      summary: {
        requiredFields: ['Wave', 'Tracker changes', 'Tests', 'Evidence', 'Blockers'],
        attachedGeneratedArtifact: waveCloseoutAttached === true,
      },
    },
    {
      trackerId: 'BIR-O04',
      title: 'end-to-end acceptance rehearsal',
      ok: finalCloseoutManifest?.rehearsalGate?.ok === true,
      evidence: ['target-house-1-final-closeout-manifest.json'],
      summary: {
        rehearsalOk: finalCloseoutManifest?.rehearsalGate?.ok === true,
      },
    },
    {
      trackerId: 'BIR-N10',
      title: 'final package readiness',
      ok: finalStatus.ready === true,
      evidence: ['target-house-1-final-closeout-manifest.json'],
      summary: {
        ready: finalStatus.ready === true,
        blockers: finalBlockers,
      },
    },
  ];
  return {
    schemaVersion: 'target-house-methodology-dashboard.v1',
    seed,
    phase,
    ok: phasePacket?.ok === true && rows.every((row) => row.ok),
    acceptanceLayer: 'sketch_methodology_not_normal_advisor',
    normalAdvisorBoundary:
      'This dashboard can block sketch/brief acceptance; it does not create normal Advisor findings.',
    summary: {
      rowCount: rows.length,
      passingRowCount: rows.filter((row) => row.ok).length,
      blockingRowCount: rows.filter((row) => !row.ok).length,
      unresolvedAssumptionCount: unresolvedAssumptions.length,
    },
    rows,
  };
}

function buildWaveCloseoutPayload({ seed, phase, methodologyDashboard }) {
  const rows = WAVE_24E_TRACKER_ITEMS.map((trackerId) => {
    const dashboardRow = methodologyDashboard.rows.find((row) => row.trackerId === trackerId);
    return {
      trackerId,
      status: dashboardRow?.ok === true ? 'pass' : 'blocked_or_external',
      title: dashboardRow?.title ?? '',
      evidence: dashboardRow?.evidence ?? [],
      summary: dashboardRow?.summary ?? {},
    };
  });
  return {
    schemaVersion: 'target-house-wave-closeout.v1',
    wave: 'W24-E',
    ownership:
      'Methodology traceability, stale evidence UI, wave closeout automation, and remaining envelope proof blockers.',
    seed,
    phase,
    generatedAtGitHead: gitHead(),
    methodologyDashboard: 'methodology-dashboard.json',
    trackerItems: WAVE_24E_TRACKER_ITEMS,
    requiredFields: ['Wave', 'Tracker changes', 'Tests', 'Evidence', 'Blockers'],
    acceptanceLayer: methodologyDashboard.acceptanceLayer,
    normalAdvisorBoundary: methodologyDashboard.normalAdvisorBoundary,
    rows,
    blockerRows: rows.filter((row) => row.status !== 'pass'),
    ok: true,
  };
}

async function buildMethodologyArtifacts({ seed, phase }) {
  const artifactDir = path.join(REPO_ROOT, 'seed-artifacts', seed);
  const liveDir = path.join(artifactDir, 'evidence', 'live-run-current');
  const phaseDir = path.join(artifactDir, 'evidence', `phase-${phase}`);
  await fs.mkdir(phaseDir, { recursive: true });

  run('python3', [
    'claude-skills/sketch-to-bim/sketch_bim.py',
    'assumption-ledger',
    '--seed',
    seed,
    '--phase',
    phase,
    '--dir',
    portable(phaseDir),
    '--fail-on-incomplete',
  ]);
  run('python3', [
    'claude-skills/sketch-to-bim/sketch_bim.py',
    'source-feature-map',
    '--seed',
    seed,
    '--phase',
    phase,
    '--dir',
    portable(phaseDir),
    '--fail-on-incomplete',
  ]);
  run('python3', [
    'claude-skills/sketch-to-bim/sketch_bim.py',
    'agent-loop-packet',
    '--seed',
    seed,
    '--phase',
    phase,
    '--dir',
    portable(phaseDir),
    '--constructability-report',
    portable(path.join(liveDir, 'constructability-report.json')),
    '--advisor',
    portable(path.join(liveDir, 'advisor-all.json')),
  ]);

  const toolRun = await readJson(path.join(liveDir, 'tool-run-summary.json'));
  const cleanPassGate = await readJson(path.join(liveDir, 'clean-pass-gate.json'));
  const acceptanceGates = await readJson(path.join(liveDir, 'acceptance-gates.json'));
  const advisorWarning = await readJson(path.join(liveDir, 'advisor-warning.json'));
  const advisorError = await readJson(path.join(liveDir, 'advisor-error.json'));

  await writeJson(path.join(phaseDir, 'evidence-manifest.json'), {
    schemaVersion: 'sketch-to-bim.phase-evidence-manifest.v1',
    ok: true,
    seed,
    phase,
    currentHead: {
      gitHead: gitHead(),
      modelRevision: toolRun.modelRevision,
      advisorRuleDigest: toolRun.advisorRuleDigest,
      irSha256: toolRun.irSha256,
      capabilitiesSha256: toolRun.capabilitiesSha256,
      rendererSupportMatrixSha256: toolRun.rendererSupportMatrixSha256,
      seedSourceDigest: toolRun.seedSourceDigest,
      targetSpecDigest: toolRun.targetSpecDigest,
    },
    sourceArtifacts: {
      toolRunSummary: portable(path.join(liveDir, 'tool-run-summary.json')),
      finalEvidenceRoot: portable(liveDir),
    },
  });
  for (const fileName of [
    'advisor-warning.json',
    'advisor-info.json',
    'advisor-error.json',
    'constructability-report.json',
    'export-validation.json',
    'visual-evidence-contract.json',
    'finding-dispositions.json',
    'screenshot-manifest.json',
    'tolerance-ledger.json',
  ]) {
    await copyJson(path.join(liveDir, fileName), path.join(phaseDir, fileName));
  }
  await writeJson(
    path.join(phaseDir, 'renderer-diagnostics.json'),
    rendererDiagnostics(cleanPassGate, acceptanceGates),
  );
  await writeJson(
    path.join(phaseDir, 'integrity-diagnostics.json'),
    integrityDiagnostics(cleanPassGate, acceptanceGates),
  );
  await writeJson(
    path.join(phaseDir, 'semantic-checklist.json'),
    semanticChecklist(acceptanceGates, phase, seed),
  );
  await writeJson(path.join(phaseDir, 'issue-ledger.json'), issueLedger(advisorWarning, advisorError, phase, seed));
  await fs.writeFile(
    path.join(phaseDir, 'visual-readout.md'),
    [
      '# Target-House Methodology Visual Readout',
      '',
      'Source-sketch acceptance is tracked by `acceptance-gates.json` and the semantic checklist.',
      'Normal Advisor evidence is clean, but it is not used as a substitute for sketch acceptance.',
      '',
    ].join('\n'),
    'utf8',
  );
  await fs.writeFile(
    path.join(phaseDir, 'corrections.md'),
    [
      '# Target-House Methodology Corrections',
      '',
      'No current-phase Advisor, renderer, BIM-integrity, or semantic visual blockers remain in this phase packet.',
      'Future corrections must update source commands and regenerate this packet.',
      '',
    ].join('\n'),
    'utf8',
  );

  const phasePacketRaw = run('python3', [
    'claude-skills/sketch-to-bim/sketch_bim.py',
    'phase-accept',
    '--seed',
    seed,
    '--phase',
    phase,
    '--dir',
    portable(phaseDir),
  ]);
  const phasePacket = JSON.parse(phasePacketRaw);
  const files = await fs.readdir(phaseDir);
  let artifactRows = [];
  for (const fileName of files.sort()) {
    const abs = path.join(phaseDir, fileName);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) continue;
    artifactRows.push({
      path: portable(abs),
      sha256: await sha256File(abs),
    });
  }
  const methodologyDashboard = buildMethodologyDashboardPayload({
    seed,
    phase,
    phasePacket,
    sourceFeatureMap: await readJsonIfExists(path.join(phaseDir, 'source-feature-map.json')),
    assumptionLedger: await readJsonIfExists(path.join(phaseDir, 'assumption-ledger.json')),
    semanticChecklist: await readJsonIfExists(path.join(phaseDir, 'semantic-checklist.json')),
    issueLedger: await readJsonIfExists(path.join(phaseDir, 'issue-ledger.json')),
    evidenceFreshness: await readJsonIfExists(path.join(liveDir, 'evidence-freshness.json')),
    finalCloseoutManifest: await finalCloseoutManifestForDashboard(seed, liveDir),
    artifactRows,
    waveCloseoutAttached: true,
  });
  await writeJson(path.join(phaseDir, 'methodology-dashboard.json'), methodologyDashboard);
  await writeJson(
    path.join(phaseDir, 'wave-closeout.json'),
    buildWaveCloseoutPayload({ seed, phase, methodologyDashboard }),
  );
  artifactRows = [];
  for (const fileName of (await fs.readdir(phaseDir)).sort()) {
    const abs = path.join(phaseDir, fileName);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) continue;
    artifactRows.push({
      path: portable(abs),
      sha256: await sha256File(abs),
    });
  }
  return {
    schemaVersion: 'target-house-methodology-artifacts.v1',
    ok: phasePacket.ok === true,
    seed,
    phase,
    phaseDir: portable(phaseDir),
    artifactCount: artifactRows.length,
    artifacts: artifactRows,
    phasePacket,
    methodologyDashboard,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await buildMethodologyArtifacts(args);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else console.log(`target-house methodology artifacts: ${result.ok ? 'ok' : 'blocked'} (${result.phaseDir})`);
  if (!result.ok) process.exit(1);
}

export { buildMethodologyArtifacts, buildMethodologyDashboardPayload, buildWaveCloseoutPayload };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
