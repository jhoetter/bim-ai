#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BENCHMARK_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'structure-and-mep-lite');
const DEFAULT_BUNDLE = path.join(BENCHMARK_DIR, 'mcp-cli-command-bundle.json');
const DEFAULT_EXPECTED = path.join(BENCHMARK_DIR, 'expected-semantics.json');

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/structure-and-mep-lite.mjs [--bundle <path>] [--expected <path>] [--json]
    [--mode offline]
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { bundle: DEFAULT_BUNDLE, expected: DEFAULT_EXPECTED, json: false, mode: 'offline' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--bundle' && argv[i + 1]) args.bundle = path.resolve(argv[++i]);
    else if (arg === '--expected' && argv[i + 1]) args.expected = path.resolve(argv[++i]);
    else if (arg === '--mode' && argv[i + 1]) args.mode = argv[++i];
    else usage();
  }
  if (args.mode !== 'offline') usage();
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
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

function sha256(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function hasPoint(value) {
  return Number.isFinite(value?.xMm) && Number.isFinite(value?.yMm);
}

function summarize(bundle) {
  const commands = bundle.commands ?? [];
  const byId = new Map(
    commands.filter((command) => command.id).map((command) => [command.id, command]),
  );
  const count = (type) => commands.filter((command) => command.type === type).length;
  const structural = commands.filter((command) =>
    ['createColumn', 'createBeam'].includes(command.type),
  );
  const routes = commands.filter((command) =>
    ['createPipe', 'createDuct', 'createCableTray'].includes(command.type),
  );
  const placed = commands.filter((command) =>
    ['createMepEquipment', 'createFixture', 'createMepTerminal'].includes(command.type),
  );
  const openingRequests = commands.filter((command) => command.type === 'createMepOpeningRequest');
  const constraints = commands.filter((command) => command.type === 'createConstraint');
  const qa = commands.filter((command) => command.type === 'upsertConstructionQaChecklist');

  return {
    benchmarkId: bundle.meta?.benchmarkId ?? null,
    commandCount: commands.length,
    commandDigest: sha256(commands),
    commandSurfaceUsage: Object.fromEntries(
      [...new Set(commands.map((command) => command.type))]
        .sort()
        .map((type) => [type, count(type)]),
    ),
    structure: {
      columns: count('createColumn'),
      columnUpdates: count('updateColumn'),
      beams: count('createBeam'),
      constraints: constraints.length,
      allStructuralMembersHaveLevel: structural.every((command) => Boolean(command.levelId)),
      allStructuralMembersHaveGeometry: structural.every((command) =>
        command.type === 'createColumn'
          ? hasPoint(command.positionMm) && Number.isFinite(command.heightMm)
          : hasPoint(command.startMm) && hasPoint(command.endMm),
      ),
      constraintRefsResolve: constraints.every((command) =>
        [...(command.refsA ?? []), ...(command.refsB ?? [])].every((ref) =>
          byId.has(ref.elementId),
        ),
      ),
    },
    construction: {
      packages: count('createConstructionPackage'),
      logistics: count('createConstructionLogistics'),
      qaChecklists: qa.length,
      allConstructionItemsHavePackageOrPhase: commands
        .filter((command) =>
          [
            'createConstructionPackage',
            'createConstructionLogistics',
            'upsertConstructionQaChecklist',
          ].includes(command.type),
        )
        .every((command) =>
          Boolean(command.phaseId || command.constructionPackageId || command.id),
        ),
      checklistTargetsResolve: qa.every((command) =>
        (command.targetElementIds ?? []).every((id) => byId.has(id)),
      ),
    },
    mep: {
      routes: {
        pipe: count('createPipe'),
        duct: count('createDuct'),
        cableTray: count('createCableTray'),
        allHaveGeometry: routes.every(
          (command) => hasPoint(command.startMm) && hasPoint(command.endMm),
        ),
        allHaveElevation: routes.every((command) => Number.isFinite(command.elevationMm)),
        allHaveSystemType: routes.every((command) => Boolean(command.systemType)),
        allHaveServiceLevel: routes.every((command) => Boolean(command.serviceLevel)),
      },
      placed: {
        equipment: count('createMepEquipment'),
        fixtures: count('createFixture'),
        terminals: count('createMepTerminal'),
        allHaveLevelAndPosition: placed.every(
          (command) => Boolean(command.levelId) && hasPoint(command.positionMm),
        ),
        allHaveSystemType: placed.every((command) => Boolean(command.systemType)),
      },
      openingRequests: {
        count: openingRequests.length,
        allHaveHost: openingRequests.every((command) => Boolean(command.hostElementId)),
        allHaveRequester: openingRequests.every(
          (command) => (command.requesterElementIds ?? []).length > 0,
        ),
        allHaveSystemType: openingRequests.every((command) => Boolean(command.systemType)),
        hostedByStructuralElement: openingRequests.every((command) => {
          const host = byId.get(command.hostElementId);
          return host?.type === 'createBeam' || host?.type === 'createColumn';
        }),
      },
    },
  };
}

function assertEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, got ${actual}`);
}

function validateSummary(summary, expected) {
  const failures = [];
  const requiredTypes = expected.expected.commandSurfaceUsage.mustInclude;
  for (const type of requiredTypes) {
    if (!summary.commandSurfaceUsage[type]) failures.push(`missing command type ${type}`);
  }
  for (const [key, value] of Object.entries(expected.expected.structure)) {
    assertEqual(summary.structure[key], value, `structure.${key}`, failures);
  }
  for (const [key, value] of Object.entries(expected.expected.construction)) {
    assertEqual(summary.construction[key], value, `construction.${key}`, failures);
  }
  for (const [key, value] of Object.entries(expected.expected.mep.routes)) {
    assertEqual(summary.mep.routes[key], value, `mep.routes.${key}`, failures);
  }
  for (const [key, value] of Object.entries(expected.expected.mep.placed)) {
    assertEqual(summary.mep.placed[key], value, `mep.placed.${key}`, failures);
  }
  for (const [key, value] of Object.entries(expected.expected.mep.openingRequests)) {
    assertEqual(summary.mep.openingRequests[key], value, `mep.openingRequests.${key}`, failures);
  }
  return failures;
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const bundle = await readJson(args.bundle);
  const expected = await readJson(args.expected);
  const summary = summarize(bundle);
  const failures = validateSummary(summary, expected);
  const result = {
    schemaVersion: 'bim-ai.benchmark.structure-and-mep-lite-result.v1',
    ok: failures.length === 0,
    mode: args.mode,
    failures,
    summary,
  };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else if (result.ok) console.log('structure-and-mep-lite benchmark passed');
  else console.error(failures.join('\n'));
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await run();
}
