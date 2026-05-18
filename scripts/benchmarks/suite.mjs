#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_SUITE = path.join(REPO_ROOT, 'spec', 'benchmarks', 'suite.json');
const REQUIRED_EVIDENCE_KINDS = [
  'ui',
  'cmdK',
  'mcpCli',
  'advisor',
  'visual',
  'export',
  'semanticDiff',
];
const UI_EVIDENCE_CLASSIFICATIONS = [
  'executable',
  'validated-replay',
  'traceability-only',
  'missing',
];

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/suite.mjs [--suite <path>] [--json]

The suite enumerator validates benchmark scenario specs and prints evidence
classification coverage. It does not execute scenario runners.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    suite: DEFAULT_SUITE,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--suite' && argv[i + 1]) args.suite = path.resolve(argv[++i]);
    else usage();
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function assertObject(value, pathName, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${pathName} must be an object`);
    return false;
  }
  return true;
}

function validateEvidence(scenario, requiredEvidenceKinds, errors) {
  if (!assertObject(scenario.evidence, `${scenario.scenarioId}.evidence`, errors)) return;

  for (const kind of requiredEvidenceKinds) {
    const entry = scenario.evidence[kind];
    if (!assertObject(entry, `${scenario.scenarioId}.evidence.${kind}`, errors)) continue;

    if (!UI_EVIDENCE_CLASSIFICATIONS.includes(entry.classification)) {
      errors.push(
        `${scenario.scenarioId}.evidence.${kind}.classification must be one of ${UI_EVIDENCE_CLASSIFICATIONS.join(
          ', ',
        )}`,
      );
    }
    if (typeof entry.status !== 'string' || entry.status.length === 0) {
      errors.push(`${scenario.scenarioId}.evidence.${kind}.status must be a non-empty string`);
    }
    if (!Array.isArray(entry.artifacts)) {
      errors.push(`${scenario.scenarioId}.evidence.${kind}.artifacts must be an array`);
    }
    if (
      entry.classification === 'missing' &&
      Array.isArray(entry.artifacts) &&
      entry.artifacts.length > 0
    ) {
      errors.push(`${scenario.scenarioId}.evidence.${kind} cannot be missing with artifacts`);
    }
    if (
      kind === 'ui' &&
      entry.classification === 'executable' &&
      entry.claim?.includes('not claimed')
    ) {
      errors.push(
        `${scenario.scenarioId}.evidence.ui executable entry must not disclaim execution`,
      );
    }
  }
}

function validateScenario(scenario, suiteEntry, suite, errors) {
  if (!assertObject(scenario, suiteEntry.scenarioId, errors)) return;
  if (scenario.schemaVersion !== 'bim-ai.benchmark.scenario.v1') {
    errors.push(`${suiteEntry.scenarioId}.schemaVersion must be bim-ai.benchmark.scenario.v1`);
  }
  if (scenario.scenarioId !== suiteEntry.scenarioId) {
    errors.push(`${suiteEntry.scenarioId}.scenarioId mismatch: ${scenario.scenarioId}`);
  }
  if (typeof scenario.title !== 'string' || scenario.title.length === 0) {
    errors.push(`${suiteEntry.scenarioId}.title must be a non-empty string`);
  }
  if (!assertObject(scenario.fixtures, `${suiteEntry.scenarioId}.fixtures`, errors)) return;
  if (!assertObject(scenario.runner, `${suiteEntry.scenarioId}.runner`, errors)) return;
  validateEvidence(scenario, suite.requiredEvidenceKinds, errors);
}

export async function loadBenchmarkSuite(suitePath = DEFAULT_SUITE) {
  const suite = await readJson(suitePath);
  const suiteDir = path.dirname(suitePath);
  const scenarios = [];

  for (const entry of suite.scenarios ?? []) {
    const scenarioPath = path.join(suiteDir, entry.directory, entry.scenarioSpec);
    scenarios.push({
      entry,
      path: scenarioPath,
      scenario: await readJson(scenarioPath),
    });
  }

  return { suitePath, suiteDir, suite, scenarios };
}

export function validateBenchmarkSuite(loadedSuite) {
  const { suite, scenarios } = loadedSuite;
  const errors = [];

  if (suite.schemaVersion !== 'bim-ai.benchmark.suite.v1') {
    errors.push('suite.schemaVersion must be bim-ai.benchmark.suite.v1');
  }
  if (!Array.isArray(suite.requiredEvidenceKinds)) {
    errors.push('suite.requiredEvidenceKinds must be an array');
  } else {
    for (const kind of REQUIRED_EVIDENCE_KINDS) {
      if (!suite.requiredEvidenceKinds.includes(kind)) {
        errors.push(`suite.requiredEvidenceKinds must include ${kind}`);
      }
    }
  }
  if (!assertObject(suite.uiEvidenceClassifications, 'suite.uiEvidenceClassifications', errors)) {
    return errors;
  }
  for (const classification of UI_EVIDENCE_CLASSIFICATIONS) {
    if (typeof suite.uiEvidenceClassifications[classification] !== 'string') {
      errors.push(`suite.uiEvidenceClassifications.${classification} must be documented`);
    }
  }
  if (!Array.isArray(suite.scenarios) || suite.scenarios.length === 0) {
    errors.push('suite.scenarios must be a non-empty array');
  }

  const ids = new Set();
  for (const { entry, scenario } of scenarios) {
    if (ids.has(entry.scenarioId)) errors.push(`duplicate scenarioId ${entry.scenarioId}`);
    ids.add(entry.scenarioId);
    validateScenario(scenario, entry, suite, errors);
  }

  return errors;
}

export function summarizeBenchmarkSuite(loadedSuite) {
  const errors = validateBenchmarkSuite(loadedSuite);
  const scenarios = loadedSuite.scenarios.map(({ path: scenarioPath, scenario }) => ({
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    lifecycle: scenario.lifecycle,
    scenarioSpec: path.relative(REPO_ROOT, scenarioPath),
    runner: scenario.runner,
    evidence: Object.fromEntries(
      REQUIRED_EVIDENCE_KINDS.map((kind) => [
        kind,
        {
          classification: scenario.evidence[kind].classification,
          status: scenario.evidence[kind].status,
          artifactCount: scenario.evidence[kind].artifacts.length,
        },
      ]),
    ),
    remainingBlockerCount: scenario.remainingBlockers?.length ?? 0,
  }));

  return {
    schemaVersion: 'bim-ai.benchmark.suite-summary.v1',
    suiteId: loadedSuite.suite.suiteId,
    sourceOfIntent: loadedSuite.suite.sourceOfIntent,
    ok: errors.length === 0,
    errors,
    scenarioCount: scenarios.length,
    requiredEvidenceKinds: loadedSuite.suite.requiredEvidenceKinds,
    uiEvidenceClassifications: Object.keys(loadedSuite.suite.uiEvidenceClassifications),
    scenarios,
  };
}

function printText(summary) {
  console.log(`${summary.suiteId}: ${summary.scenarioCount} scenario(s)`);
  for (const scenario of summary.scenarios) {
    console.log(`- ${scenario.scenarioId} (${scenario.lifecycle})`);
    for (const kind of REQUIRED_EVIDENCE_KINDS) {
      const evidence = scenario.evidence[kind];
      console.log(`  ${kind}: ${evidence.classification} / ${evidence.status}`);
    }
  }
  if (!summary.ok) {
    console.error(summary.errors.join('\n'));
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const loadedSuite = await loadBenchmarkSuite(args.suite);
  const summary = summarizeBenchmarkSuite(loadedSuite);
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else printText(summary);
  return summary.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
