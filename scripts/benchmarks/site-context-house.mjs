#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BENCHMARK_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'site-and-context-house');

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/site-context-house.mjs [--mode offline] [--json]

Validates the deterministic M4 site/context fixture artifacts. This runner does
not mutate a model; it checks the executable bundle, replay evidence, and
accepted advisor/visual/export evidence for semantic closure.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { mode: 'offline', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--mode' && argv[i + 1]) args.mode = argv[++i];
    else usage();
  }
  if (args.mode !== 'offline') usage();
  return args;
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(BENCHMARK_DIR, relativePath), 'utf8'));
}

function commandType(step) {
  return step?.command?.type;
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function semanticCounts(bundle) {
  const counts = {
    level: 0,
    project_base_point: 0,
    survey_point: 0,
    sun_settings: 0,
    site: 0,
    toposolid: 0,
    toposolid_subdivision: 0,
    graded_region: 0,
    property_line: 0,
    toposolid_excavation: 0,
    context_object: 0,
  };
  for (const step of bundle.commands ?? []) {
    const cmd = step.command ?? {};
    if (cmd.type === 'createLevel') counts.level += 1;
    if (cmd.type === 'createProjectBasePoint') counts.project_base_point += 1;
    if (cmd.type === 'createSurveyPoint') counts.survey_point += 1;
    if (cmd.type === 'createSunSettings') counts.sun_settings += 1;
    if (cmd.type === 'upsertSite') {
      counts.site += 1;
      counts.context_object += Array.isArray(cmd.contextObjects) ? cmd.contextObjects.length : 0;
    }
    if (cmd.type === 'CreateToposolid') counts.toposolid += 1;
    if (cmd.type === 'create_toposolid_subdivision') counts.toposolid_subdivision += 1;
    if (cmd.type === 'CreateGradedRegion') counts.graded_region += 1;
    if (cmd.type === 'createPropertyLine') counts.property_line += 1;
    if (cmd.type === 'CreateToposolidExcavation') counts.toposolid_excavation += 1;
  }
  return counts;
}

function compareCounts(actual, expected) {
  const diff = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = Number(actual[key] ?? 0);
    if (actualValue !== Number(expectedValue)) {
      diff.push({ path: `semanticCounts.${key}`, expected: expectedValue, actual: actualValue });
    }
  }
  return diff;
}

function compareSets(actual, expected, pathName) {
  const actualSet = new Set(actual);
  return expected
    .filter((value) => !actualSet.has(value))
    .map((value) => ({ path: pathName, expected: value, actual: null }));
}

function artifactOk(value) {
  return value?.ok === true && !/fail|error|block|missing/i.test(String(value?.status ?? 'passed'));
}

function replayEvidenceOk(uiEquivalence, traceability, commandTypes) {
  const rows = uiEquivalence?.cmdKBridgeCoverage?.rows ?? [];
  const covered = new Set(rows.flatMap((row) => row.coveredCommandTypes ?? []));
  const coverage = traceability?.coverage ?? {};
  return (
    uiEquivalence?.validatedReplay?.ok === true &&
    uiEquivalence?.semanticDiff?.ok === true &&
    coverage.validatedReplay === true &&
    commandTypes.every((type) => covered.has(type)) &&
    rows.every((row) => ['direct-payload', 'validated-replay'].includes(row.classification))
  );
}

export async function runSiteContextBenchmark() {
  const [
    scenario,
    expected,
    bundle,
    traceability,
    uiEquivalence,
    semanticSummary,
    semanticDiffArtifact,
    advisor,
    visual,
    exportEvidence,
    execution,
  ] = await Promise.all([
    readJson('scenario.json'),
    readJson('expected-semantics.json'),
    readJson('mcp-cli-command-bundle.json'),
    readJson('ui-cmdk-traceability.json'),
    readJson('ui-equivalence.json'),
    readJson('live-evidence/semantic-summary.json'),
    readJson('live-evidence/semantic-diff.json'),
    readJson('live-evidence/advisor-validation.json'),
    readJson('live-evidence/visual-evidence.json'),
    readJson('live-evidence/export-evidence.json'),
    readJson('live-evidence/execution-evidence.json'),
  ]);

  const commands = bundle.commands ?? [];
  const commandTypes = [...new Set(commands.map(commandType).filter(Boolean))].sort();
  const toolIds = [...new Set(commands.map((step) => step.toolId).filter(Boolean))].sort();
  const counts = semanticCounts(bundle);
  const diff = [
    ...compareSets(commandTypes, expected.requiredCommandTypes, 'commandTypes'),
    ...compareSets(toolIds, expected.requiredToolIds, 'toolIds'),
    ...compareCounts(counts, expected.requiredSemanticCounts),
  ];
  const replayOk = replayEvidenceOk(uiEquivalence, traceability, expected.requiredCommandTypes);
  const qualityOk =
    artifactOk(advisor) &&
    advisor.validation?.checks?.blockingViolationCount === 0 &&
    artifactOk(visual) &&
    visual.nonBlank === true &&
    artifactOk(exportEvidence) &&
    semanticDiffArtifact.ok === true &&
    semanticDiffArtifact.mismatchCount === 0 &&
    execution.ok === true;
  const scenarioEvidenceOk = [
    'ui',
    'cmdK',
    'mcpCli',
    'advisor',
    'visual',
    'export',
    'semanticDiff',
  ].every((kind) =>
    ['executable', 'validated-replay'].includes(scenario.evidence?.[kind]?.classification),
  );
  const summaryMatches =
    semanticSummary.commandCount === commands.length &&
    JSON.stringify(semanticSummary.semanticCounts) === JSON.stringify(counts);

  return {
    schemaVersion: 'bim-ai.site-context.benchmark-result.v1',
    scenarioId: 'site-and-context-house',
    ok: diff.length === 0 && replayOk && qualityOk && scenarioEvidenceOk && summaryMatches,
    commandCount: commands.length,
    commandTypes,
    commandTypeCounts: countBy(commands.map(commandType)),
    toolIds,
    semanticCounts: counts,
    semanticDiff: {
      ok: diff.length === 0,
      mismatchCount: diff.length,
      differences: diff,
    },
    replay: {
      ok: replayOk,
      validatedReplay: uiEquivalence.validatedReplay,
      cmdKBridgeCoverage: uiEquivalence.cmdKBridgeCoverage,
    },
    evidenceHooks: {
      advisor: { ok: artifactOk(advisor), artifact: 'live-evidence/advisor-validation.json' },
      visual: { ok: artifactOk(visual), artifact: 'live-evidence/visual-evidence.json' },
      export: { ok: artifactOk(exportEvidence), artifact: 'live-evidence/export-evidence.json' },
      semanticDiff: {
        ok: semanticDiffArtifact.ok === true,
        artifact: 'live-evidence/semantic-diff.json',
      },
      execution: { ok: execution.ok === true, artifact: 'live-evidence/execution-evidence.json' },
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runSiteContextBenchmark();
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(
      `site-and-context-house ${result.ok ? 'OK' : 'BLOCKED'}: ${result.commandCount} commands, ${result.semanticDiff.mismatchCount} semantic mismatch(es)`,
    );
  }
  if (!result.ok) process.exit(1);
}
