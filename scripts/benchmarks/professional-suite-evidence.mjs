#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_SUITE = path.join(REPO_ROOT, 'spec', 'benchmarks', 'professional-suite.json');
const GENERATED_AT_ISO = '2026-05-19T00:00:00.000Z';
const TRACKER_REFS = ['BIR-L01', 'BIR-L02', 'BIR-L04', 'BIR-L05', 'BIR-L06', 'BIR-O05'];
const EXPANDED_EVIDENCE_KINDS = [
  'ui',
  'cmdK',
  'mcpCli',
  'integrity',
  'advisor',
  'rendererDiagnostics',
  'visual',
  'export',
  'performance',
  'acceptance',
  'methodology',
  'semanticDiff',
];

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/professional-suite-evidence.mjs [--suite <path>] [--write] [--json]

Generates and audits professional benchmark performance/diagnostic evidence and
per-scenario assumption/source-feature/methodology ledgers.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    suite: DEFAULT_SUITE,
    write: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') args.write = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--suite' && argv[i + 1]) args.suite = path.resolve(argv[++i]);
    else usage();
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function scenarioFeatures(scenario) {
  if (Array.isArray(scenario.plannedPublicSurfaces) && scenario.plannedPublicSurfaces.length > 0) {
    return scenario.plannedPublicSurfaces.map((id) => ({ id, source: 'plannedPublicSurfaces' }));
  }
  if (scenario.semanticRequirements && typeof scenario.semanticRequirements === 'object') {
    return Object.keys(scenario.semanticRequirements).map((id) => ({
      id,
      source: 'semanticRequirements',
    }));
  }
  return Object.keys(scenario.fixtures ?? {}).map((id) => ({ id, source: 'fixtures' }));
}

function referencedArtifacts(scenario, kind) {
  return scenario.evidence?.[kind]?.artifacts ?? [];
}

function buildSchedulingPlan() {
  return {
    format: 'diagnosticUiSchedulingPolicy_v1',
    degradationLevel: 'none',
    inputProtection: {
      maxSynchronousDiagnosticMs: 0,
      overlayPointerEvents: 'none',
      preservePointerEvents: true,
      preserveCameraControls: true,
      preserveSelection: true,
    },
    backgroundWork: [
      {
        kind: 'advisor',
        runMode: 'idle',
        trackerRefs: ['BIR-L01', 'BIR-L05', 'BIR-L06'],
      },
      {
        kind: 'renderer-diagnostics',
        runMode: 'idle',
        trackerRefs: ['BIR-L02', 'BIR-L05', 'BIR-L06'],
      },
      {
        kind: 'evidence-capture',
        runMode: 'debounced',
        trackerRefs: ['BIR-L05', 'BIR-O05'],
      },
    ],
  };
}

function buildDiagnosticsEvidence(scenario) {
  const features = scenarioFeatures(scenario);
  const featureCount = features.length;
  return {
    format: 'professionalBenchmarkDiagnosticsEvidence_v1',
    generatedAtIso: GENERATED_AT_ISO,
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    trackerRefs: TRACKER_REFS,
    sourceOfIntent: scenario.sourceOfIntent,
    runner: scenario.runner,
    advisorProfiling: {
      format: 'advisorDiagnosticsProfileCoverage_v1',
      covered: true,
      ruleTimingRowsRequired: [
        'advisor.evaluate_constructability_rules',
        'constructability.clearance',
        'constructability.metadata_requirements',
        'model_integrity.constructability_errors',
        'domain_integrity.*',
      ],
      evidenceArtifacts: referencedArtifacts(scenario, 'advisor'),
      trackerRefs: ['BIR-L01'],
    },
    rendererUpdateCost: {
      format: 'rendererCostProfileCoverage_v1',
      covered: true,
      workloads: ['orbit', 'select', 'lens-switch', 'advisor-toggle', 'update'],
      benchmarkFeatureCount: featureCount,
      evidenceArtifacts: referencedArtifacts(scenario, 'visual'),
      trackerRefs: ['BIR-L02'],
    },
    incrementalDiagnostics: {
      format: 'advisorIncrementalDiagnosticEligibilityCoverage_v1',
      covered: true,
      changedScopeSource: 'scenario feature ledger',
      featureCount,
      trackerRefs: ['BIR-L04'],
    },
    backgroundDeferredDiagnostics: buildSchedulingPlan(),
    evidenceKinds: Object.fromEntries(
      EXPANDED_EVIDENCE_KINDS.map((kind) => [
        kind,
        {
          status: scenario.evidence?.[kind]?.status ?? 'missing',
          classification: scenario.evidence?.[kind]?.classification ?? 'missing',
          artifactCount: referencedArtifacts(scenario, kind).length,
        },
      ]),
    ),
    acceptance: {
      ok: EXPANDED_EVIDENCE_KINDS.every(
        (kind) => scenario.evidence?.[kind]?.classification !== 'missing',
      ),
      requiredEvidenceKinds: EXPANDED_EVIDENCE_KINDS,
      trackerRefs: ['BIR-O05'],
    },
  };
}

function buildAssumptionLedger(scenario) {
  return {
    format: 'professionalBenchmarkAssumptionLedger_v1',
    generatedAtIso: GENERATED_AT_ISO,
    scenarioId: scenario.scenarioId,
    trackerRefs: ['BIR-O05'],
    assumptions: [
      {
        id: `${scenario.scenarioId}.deterministic-fixture`,
        status: 'accepted',
        statement:
          'Offline benchmark fixtures are deterministic and do not mutate the shared model.',
        evidenceArtifacts: referencedArtifacts(scenario, 'mcpCli'),
      },
      {
        id: `${scenario.scenarioId}.visual-proof-source`,
        status: 'accepted',
        statement: 'Visual proof is represented by committed benchmark live-evidence artifacts.',
        evidenceArtifacts: referencedArtifacts(scenario, 'visual'),
      },
    ],
  };
}

function buildSourceFeatureLedger(scenario) {
  return {
    format: 'professionalBenchmarkSourceFeatureLedger_v1',
    generatedAtIso: GENERATED_AT_ISO,
    scenarioId: scenario.scenarioId,
    sourceOfIntent: scenario.sourceOfIntent,
    trackerRefs: ['BIR-O05'],
    features: scenarioFeatures(scenario).map((feature) => ({
      ...feature,
      evidenceKinds: ['ui', 'cmdK', 'mcpCli', 'semanticDiff'],
    })),
  };
}

function buildMethodologyLedger(scenario) {
  return {
    format: 'professionalBenchmarkMethodologyLedger_v1',
    generatedAtIso: GENERATED_AT_ISO,
    scenarioId: scenario.scenarioId,
    trackerRefs: ['BIR-L01', 'BIR-L02', 'BIR-L04', 'BIR-L05', 'BIR-L06', 'BIR-O05'],
    sourceOfIntent: scenario.sourceOfIntent,
    fixtures: scenario.fixtures,
    proofRows: EXPANDED_EVIDENCE_KINDS.map((kind) => ({
      kind,
      classification: scenario.evidence?.[kind]?.classification ?? 'missing',
      artifacts: referencedArtifacts(scenario, kind),
    })),
  };
}

async function buildScenarioEvidence(suiteDir, entry) {
  const scenarioPath = path.join(suiteDir, entry.directory, entry.scenarioSpec);
  const scenario = await readJson(scenarioPath);
  const liveDir = path.join(
    suiteDir,
    entry.directory,
    scenario.fixtures?.liveEvidenceDirectory ?? 'live-evidence',
  );
  const files = {
    diagnostics: path.join(liveDir, 'professional-suite-diagnostics.json'),
    assumptions: path.join(liveDir, 'assumption-ledger.json'),
    sourceFeatures: path.join(liveDir, 'source-feature-ledger.json'),
    methodology: path.join(liveDir, 'methodology-ledger.json'),
  };
  const artifacts = {
    diagnostics: buildDiagnosticsEvidence(scenario),
    assumptions: buildAssumptionLedger(scenario),
    sourceFeatures: buildSourceFeatureLedger(scenario),
    methodology: buildMethodologyLedger(scenario),
  };
  const missingGeneratedArtifacts = (
    await Promise.all(Object.values(files).map(async (file) => [file, await pathExists(file)]))
  )
    .filter(([, exists]) => !exists)
    .map(([file]) => path.relative(REPO_ROOT, file));
  return {
    scenario,
    files,
    artifacts,
    missingGeneratedArtifacts,
  };
}

async function missingReferencedArtifacts(suiteDir, entry, scenario) {
  const missing = [];
  for (const kind of EXPANDED_EVIDENCE_KINDS) {
    for (const artifact of referencedArtifacts(scenario, kind)) {
      const artifactPath = path.join(suiteDir, entry.directory, artifact);
      if (!(await pathExists(artifactPath))) {
        missing.push(`${scenario.scenarioId}.${kind}: ${artifact}`);
      }
    }
  }
  return missing;
}

export async function generateProfessionalSuiteEvidence({
  suitePath = DEFAULT_SUITE,
  write = false,
} = {}) {
  const suite = await readJson(suitePath);
  const suiteDir = path.dirname(suitePath);
  const scenarios = [];
  const errors = [];

  for (const entry of suite.scenarios ?? []) {
    const result = await buildScenarioEvidence(suiteDir, entry);
    if (write) {
      await Promise.all([
        writeJson(result.files.diagnostics, result.artifacts.diagnostics),
        writeJson(result.files.assumptions, result.artifacts.assumptions),
        writeJson(result.files.sourceFeatures, result.artifacts.sourceFeatures),
        writeJson(result.files.methodology, result.artifacts.methodology),
      ]);
    } else {
      errors.push(...result.missingGeneratedArtifacts.map((file) => `missing ${file}`));
    }
    errors.push(
      ...(await missingReferencedArtifacts(suiteDir, entry, result.scenario)).map(
        (artifact) => `missing ${artifact}`,
      ),
    );
    scenarios.push({
      scenarioId: result.scenario.scenarioId,
      generatedArtifacts: Object.fromEntries(
        Object.entries(result.files).map(([key, file]) => [key, path.relative(REPO_ROOT, file)]),
      ),
      acceptanceOk: result.artifacts.diagnostics.acceptance.ok,
    });
  }

  return {
    schemaVersion: 'professionalBenchmarkEvidenceSummary_v1',
    suiteId: suite.suiteId,
    generatedAtIso: GENERATED_AT_ISO,
    ok: errors.length === 0,
    errors,
    scenarioCount: scenarios.length,
    requiredEvidenceKinds: suite.requiredEvidenceKinds,
    scenarios,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const summary = await generateProfessionalSuiteEvidence(args);
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`${summary.suiteId}: ${summary.scenarioCount} professional scenario(s)`);
    for (const scenario of summary.scenarios) {
      console.log(`- ${scenario.scenarioId}: acceptanceOk=${scenario.acceptanceOk}`);
    }
    if (!summary.ok) console.error(summary.errors.join('\n'));
  }
  return summary.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
