#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const BENCHMARK_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'simple-single-storey-house');
const DEFAULT_BUNDLE = path.join(BENCHMARK_DIR, 'mcp-cli-command-bundle.json');
const DEFAULT_EXPECTED = path.join(BENCHMARK_DIR, 'expected-semantics.json');

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/simple-house.mjs [--bundle <path>] [--expected <path>] [--json]
    [--mode offline|auto|live] [--base-url <url>] [--model-id <id>]
    [--parent-revision <rev>] [--user-id <id>] [--out-dir <path>]
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    bundle: DEFAULT_BUNDLE,
    expected: DEFAULT_EXPECTED,
    json: false,
    mode: 'auto',
    baseUrl: process.env.BIM_AI_BASE_URL ?? null,
    modelId: process.env.BIM_AI_MODEL_ID ?? null,
    parentRevision: process.env.BIM_AI_PARENT_REVISION ?? null,
    userId: process.env.BIM_AI_USER_ID ?? 'benchmark-agent',
    outDir: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--bundle' && argv[i + 1]) args.bundle = path.resolve(argv[++i]);
    else if (arg === '--expected' && argv[i + 1]) args.expected = path.resolve(argv[++i]);
    else if (arg === '--mode' && argv[i + 1]) args.mode = argv[++i];
    else if (arg === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i];
    else if (arg === '--model-id' && argv[i + 1]) args.modelId = argv[++i];
    else if (arg === '--parent-revision' && argv[i + 1]) args.parentRevision = argv[++i];
    else if (arg === '--user-id' && argv[i + 1]) args.userId = argv[++i];
    else if (arg === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else usage();
  }
  if (!['offline', 'auto', 'live'].includes(args.mode)) usage();
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function areaM2(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twiceArea += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  return Math.abs(twiceArea) / 2_000_000;
}

function commandList(bundle) {
  if (Array.isArray(bundle)) return bundle;
  if (bundle && Array.isArray(bundle.commands)) return bundle.commands;
  throw new Error('Bundle must be an array or an object with commands[].');
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

function summarize(bundle, expected) {
  const commands = commandList(bundle);
  const exteriorWallTypes = new Set(expected.expected.walls.exteriorWallTypeIds);
  const interiorWallTypes = new Set(expected.expected.walls.interiorWallTypeIds);
  const walls = [];
  const rooms = [];
  const planViewIds = new Set();
  const placedSheetViews = new Map();

  const summary = {
    benchmarkId: bundle?.meta?.benchmarkId ?? null,
    commandCount: commands.length,
    commandSurfaceUsage: {},
    levels: { count: 0, ids: [], elevationsMm: {} },
    walls: { total: 0, exterior: 0, interior: 0, ids: [] },
    rooms: { count: 0, names: [], targetAreaM2: {}, computedAreaM2: {} },
    openings: { doors: 0, windows: 0, hosted: 0, missingHost: [], missingFamilyType: [] },
    floors: { count: 0, ids: [], roomBounded: false },
    roofs: { count: 0, ids: [], geometryModes: [] },
    views: { plan: 0, threeD: 0, ids: [] },
    sheets: { count: 0, ids: [], placedViewsBySheet: {} },
    schedules: { count: 0, ids: [], categories: [] },
    annotations: { tags: 0, dimensions: 0 },
  };

  for (const command of commands) {
    summary.commandSurfaceUsage[command.type] =
      (summary.commandSurfaceUsage[command.type] ?? 0) + 1;

    if (command.type === 'createLevel') {
      summary.levels.count += 1;
      summary.levels.ids.push(command.id);
      summary.levels.elevationsMm[command.id] = command.elevationMm;
      if (command.planViewId) planViewIds.add(command.planViewId);
    } else if (command.type === 'createWall') {
      walls.push({
        id: command.id,
        wallTypeId: command.wallTypeId,
      });
    } else if (command.type === 'createWallChain') {
      for (const segment of command.segments ?? []) {
        walls.push({
          id: segment.id,
          wallTypeId: command.wallTypeId,
        });
      }
    } else if (command.type === 'createRoomOutline') {
      rooms.push(command);
    } else if (command.type === 'insertDoorOnWall') {
      summary.openings.doors += 1;
      if (command.wallId) summary.openings.hosted += 1;
      else summary.openings.missingHost.push(command.id);
      if (!command.familyTypeId) summary.openings.missingFamilyType.push(command.id);
    } else if (command.type === 'insertWindowOnWall') {
      summary.openings.windows += 1;
      if (command.wallId) summary.openings.hosted += 1;
      else summary.openings.missingHost.push(command.id);
      if (!command.familyTypeId) summary.openings.missingFamilyType.push(command.id);
    } else if (command.type === 'createFloor') {
      summary.floors.count += 1;
      summary.floors.ids.push(command.id);
      summary.floors.roomBounded ||= command.roomBounded === true;
    } else if (command.type === 'createRoof') {
      summary.roofs.count += 1;
      summary.roofs.ids.push(command.id);
      summary.roofs.geometryModes.push(command.roofGeometryMode);
    } else if (command.type === 'saveViewpoint') {
      if (command.mode === 'orbit_3d') {
        summary.views.threeD += 1;
        summary.views.ids.push(command.id);
      }
    } else if (command.type === 'CreateSheet') {
      summary.sheets.count += 1;
      summary.sheets.ids.push(command.sheetId);
    } else if (command.type === 'PlaceViewOnSheet') {
      const views = placedSheetViews.get(command.sheetId) ?? [];
      views.push(command.viewId);
      placedSheetViews.set(command.sheetId, views);
    } else if (command.type === 'create_schedule_view') {
      summary.schedules.count += 1;
      summary.schedules.ids.push(command.id);
      summary.schedules.categories.push(command.category);
    } else if (command.type === 'placeTag') {
      summary.annotations.tags += 1;
    } else if (command.type === 'createDimension') {
      summary.annotations.dimensions += 1;
    }
  }

  for (const wall of walls) {
    summary.walls.total += 1;
    summary.walls.ids.push(wall.id);
    if (exteriorWallTypes.has(wall.wallTypeId)) summary.walls.exterior += 1;
    if (interiorWallTypes.has(wall.wallTypeId)) summary.walls.interior += 1;
  }

  summary.views.plan = planViewIds.size;
  summary.views.ids.unshift(...[...planViewIds].sort());

  summary.rooms.count = rooms.length;
  summary.rooms.names = rooms.map((room) => room.name).sort();
  for (const room of rooms) {
    summary.rooms.targetAreaM2[room.id] = room.targetAreaM2;
    summary.rooms.computedAreaM2[room.id] = areaM2(room.outlineMm);
  }

  for (const [sheetId, views] of placedSheetViews) {
    summary.sheets.placedViewsBySheet[sheetId] = views;
  }

  summary.levels.ids.sort();
  summary.walls.ids.sort();
  summary.floors.ids.sort();
  summary.roofs.ids.sort();
  summary.views.ids.sort();
  summary.sheets.ids.sort();
  summary.schedules.ids.sort();
  summary.schedules.categories.sort();

  return summary;
}

function compareScalar(diff, pathName, actual, expected) {
  if (actual !== expected) diff.push({ path: pathName, actual, expected });
}

function compareArray(diff, pathName, actual, expected) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e))
    diff.push({ path: pathName, actual: a, expected: e });
}

function compareApproxMap(diff, pathName, actual, expected, tolerance) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (!Number.isFinite(actualValue) || Math.abs(actualValue - expectedValue) > tolerance) {
      diff.push({ path: `${pathName}.${key}`, actual: actualValue, expected: expectedValue });
    }
  }
}

function diffSummary(summary, expected) {
  const diff = [];
  const exp = expected.expected;
  const tol = expected.tolerances ?? {};

  compareScalar(diff, 'levels.count', summary.levels.count, exp.levels.count);
  compareArray(diff, 'levels.ids', summary.levels.ids, exp.levels.ids);
  compareApproxMap(
    diff,
    'levels.elevationsMm',
    summary.levels.elevationsMm,
    exp.levels.elevationsMm,
    tol.dimensionMm ?? 0,
  );
  compareScalar(diff, 'walls.total', summary.walls.total, exp.walls.total);
  compareScalar(diff, 'walls.exterior', summary.walls.exterior, exp.walls.exterior);
  compareScalar(diff, 'walls.interior', summary.walls.interior, exp.walls.interior);
  compareScalar(diff, 'rooms.count', summary.rooms.count, exp.rooms.count);
  compareArray(diff, 'rooms.names', summary.rooms.names, exp.rooms.names);
  compareApproxMap(
    diff,
    'rooms.targetAreaM2',
    summary.rooms.targetAreaM2,
    exp.rooms.targetAreaM2,
    tol.areaM2 ?? 0,
  );
  compareScalar(diff, 'openings.doors', summary.openings.doors, exp.openings.doors);
  compareScalar(diff, 'openings.windows', summary.openings.windows, exp.openings.windows);
  compareScalar(diff, 'openings.hosted', summary.openings.hosted, exp.openings.hosted);
  compareScalar(
    diff,
    'openings.allHaveHost',
    summary.openings.missingHost.length === 0,
    exp.openings.allHaveHost,
  );
  compareScalar(
    diff,
    'openings.allHaveFamilyType',
    summary.openings.missingFamilyType.length === 0,
    exp.openings.allHaveFamilyType,
  );
  compareScalar(diff, 'floors.count', summary.floors.count, exp.floors.count);
  compareArray(diff, 'floors.ids', summary.floors.ids, exp.floors.ids);
  compareScalar(diff, 'floors.roomBounded', summary.floors.roomBounded, exp.floors.roomBounded);
  compareScalar(diff, 'roofs.count', summary.roofs.count, exp.roofs.count);
  compareArray(diff, 'roofs.ids', summary.roofs.ids, exp.roofs.ids);
  compareArray(diff, 'roofs.geometryModes', summary.roofs.geometryModes, exp.roofs.geometryModes);
  compareScalar(diff, 'views.plan', summary.views.plan, exp.views.plan);
  compareScalar(diff, 'views.threeD', summary.views.threeD, exp.views.threeD);
  compareArray(diff, 'views.ids', summary.views.ids, exp.views.ids);
  compareScalar(diff, 'sheets.count', summary.sheets.count, exp.sheets.count);
  compareArray(diff, 'sheets.ids', summary.sheets.ids, exp.sheets.ids);
  for (const sheetId of exp.sheets.ids) {
    const placed = summary.sheets.placedViewsBySheet[sheetId] ?? [];
    if (placed.length < exp.sheets.minPlacedViews) {
      diff.push({
        path: `sheets.placedViewsBySheet.${sheetId}`,
        actual: placed.length,
        expected: `>= ${exp.sheets.minPlacedViews}`,
      });
    }
  }
  compareScalar(diff, 'schedules.count', summary.schedules.count, exp.schedules.count);
  compareArray(diff, 'schedules.ids', summary.schedules.ids, exp.schedules.ids);
  compareArray(
    diff,
    'schedules.categories',
    summary.schedules.categories,
    exp.schedules.categories,
  );
  compareScalar(diff, 'annotations.tags', summary.annotations.tags, exp.annotations.tags);
  compareScalar(
    diff,
    'annotations.dimensions',
    summary.annotations.dimensions,
    exp.annotations.dimensions,
  );

  const usage = expected.evidenceExpectations.commandSurfaceUsage;
  for (const type of usage.mustInclude) {
    if (!summary.commandSurfaceUsage[type]) {
      diff.push({ path: `commandSurfaceUsage.${type}`, actual: 0, expected: '>= 1' });
    }
  }
  for (const type of usage.forbidden) {
    if (summary.commandSurfaceUsage[type]) {
      diff.push({
        path: `commandSurfaceUsage.${type}`,
        actual: summary.commandSurfaceUsage[type],
        expected: 0,
      });
    }
  }

  return diff;
}

function buildOfflineExecutionEvidence(bundle, summary) {
  return {
    mode: 'offline-fixture',
    ok: true,
    publicSurface: {
      kind: 'deterministic-fixture',
      cliEquivalent: 'node scripts/benchmarks/simple-house.mjs --mode offline --json',
      apiEquivalent: null,
    },
    bundleDigest: sha256(bundle),
    commandCount: summary.commandCount,
    validation: {
      status: 'fixture-semantic-diff',
      ok: true,
    },
    advisor: {
      status: 'placeholder',
      findings: [],
      todo: 'Run with BIM_AI_BASE_URL and BIM_AI_MODEL_ID to capture live dry-run violations/advisor readouts when available.',
    },
  };
}

function withParentRevision(bundle, parentRevision) {
  if (parentRevision === null || parentRevision === undefined || parentRevision === '')
    return bundle;
  const parsed = Number(parentRevision);
  return {
    ...bundle,
    parentRevision: Number.isFinite(parsed) ? parsed : parentRevision,
  };
}

async function postJson(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: response.status, ok: response.ok, body: json };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeLiveDryRunEvidence({ baseUrl, modelId, userId, bundle, response }) {
  const endpointPath = `/api/models/${encodeURIComponent(modelId)}/bundles`;
  const body = response.body ?? {};
  const violations = body.violations ?? body.result?.violations ?? [];
  return {
    mode: 'live-dry-run',
    ok: response.ok && body.ok !== false,
    publicSurface: {
      kind: 'cmd-v3-api',
      method: 'POST',
      endpoint: endpointPath,
      url: `${baseUrl.replace(/\/$/, '')}${endpointPath}`,
      requestMode: 'dry_run',
      cliEquivalent: `BIM_AI_BASE_URL=${baseUrl} BIM_AI_MODEL_ID=${modelId} pnpm --dir ${REPO_ROOT} --filter @bim-ai/cli exec bim-ai apply-bundle ${path.relative(
        REPO_ROOT,
        DEFAULT_BUNDLE,
      )} --base <parentRevision> --dry-run`,
    },
    request: {
      bundleDigest: sha256(bundle),
      commandCount: commandList(bundle).length,
      userId,
      parentRevision: bundle.parentRevision ?? null,
    },
    response: {
      httpStatus: response.status,
      ok: response.ok,
      bodyOk: body.ok ?? null,
      reason: body.reason ?? body.result?.reason ?? null,
      wouldRevision: body.wouldRevision ?? body.result?.wouldRevision ?? null,
      revision: body.revision ?? body.result?.revision ?? null,
    },
    validation: {
      status: 'live-dry-run-response',
      ok: response.ok && body.ok !== false,
      violationCount: violations.length,
      violations,
      replayDiagnostics: body.replayDiagnostics ?? body.result?.replayDiagnostics ?? null,
    },
    advisor: {
      status: violations.length ? 'live-validation-output' : 'live-validation-empty',
      findings: violations,
      agentBriefCommandProtocol_v1: body.agentBriefCommandProtocol_v1 ?? null,
      agentGeneratedBundleQaChecklist_v1: body.agentGeneratedBundleQaChecklist_v1 ?? null,
      agentBriefAcceptanceReadout_v1: body.agentBriefAcceptanceReadout_v1 ?? null,
    },
  };
}

async function runLiveDryRun(args, bundle) {
  const liveBundle = withParentRevision(bundle, args.parentRevision);
  const baseUrl = args.baseUrl.replace(/\/$/, '');
  const endpointPath = `/api/models/${encodeURIComponent(args.modelId)}/bundles`;
  const response = await postJson(`${baseUrl}${endpointPath}`, {
    bundle: liveBundle,
    mode: 'dry_run',
    userId: args.userId,
    submitter: 'benchmark-agent',
  });
  return normalizeLiveDryRunEvidence({
    baseUrl,
    modelId: args.modelId,
    userId: args.userId,
    bundle: liveBundle,
    response,
  });
}

function shouldRunLive(args) {
  if (args.mode === 'offline') return false;
  if (args.mode === 'live') return true;
  return Boolean(args.baseUrl && args.modelId);
}

function uiEquivalentTodos() {
  return [
    {
      path: 'UI/Cmd+K',
      status: 'todo',
      todo: 'Automate an equivalent human path using Cmd+K/ribbon activators plus canvas or direct commands, then compare its semantic summary against this benchmark.',
    },
    {
      path: 'UI evidence',
      status: 'todo',
      todo: 'Capture nonblank plan and 3D screenshots for ssh-view-ground-plan and ssh-view-3d from the UI-rendered model.',
    },
    {
      path: 'UI documentation/export',
      status: 'todo',
      todo: 'Verify sheet, schedule, tags, dimensions, IFC, and glTF outputs through UI-accessible export/documentation surfaces.',
    },
  ];
}

async function writeEvidence(outDir, result) {
  if (!outDir) return;
  await fs.mkdir(outDir, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(outDir, 'semantic-summary.json'),
      `${JSON.stringify(result.summary, null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(outDir, 'semantic-diff.json'),
      `${JSON.stringify(result.semanticDiff, null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(outDir, 'execution-evidence.json'),
      `${JSON.stringify(result.executionEvidence, null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(outDir, 'benchmark-result.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    ),
  ]);
}

export async function runBenchmark(rawArgs = []) {
  const args = parseArgs(rawArgs);
  const [bundle, expected] = await Promise.all([readJson(args.bundle), readJson(args.expected)]);
  const summary = summarize(bundle, expected);
  const semanticDiff = diffSummary(summary, expected);
  let executionEvidence = buildOfflineExecutionEvidence(bundle, summary);
  if (shouldRunLive(args)) {
    if (!args.baseUrl || !args.modelId) {
      throw new Error(
        '--mode live requires --base-url/--model-id or BIM_AI_BASE_URL/BIM_AI_MODEL_ID.',
      );
    }
    executionEvidence = await runLiveDryRun(args, bundle);
  }
  const result = {
    benchmarkId: expected.benchmarkId,
    path: 'mcp-cli',
    ok: semanticDiff.length === 0 && executionEvidence.ok,
    summary,
    semanticDiff,
    executionEvidence,
    uiEquivalentTodos: uiEquivalentTodos(),
    remainingExitCriteria: [
      'UI/Cmd+K equivalent path',
      'live commit execution through typed MCP/CLI surface after dry-run is clean',
      'advisor/constructability JSON from committed live model',
      'nonblank plan and 3D screenshots',
      'IFC and glTF export evidence',
    ],
  };
  await writeEvidence(args.outDir, result);
  return { args, result };
}

async function main() {
  const { args, result } = await runBenchmark(process.argv.slice(2));
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    const mode = result.executionEvidence.mode;
    console.log(
      `simple-single-storey-house ${mode} OK: ${result.summary.commandCount} commands, ${result.summary.walls.total} walls, ${result.summary.rooms.count} rooms, ${result.summary.openings.doors} doors, ${result.summary.openings.windows} windows.`,
    );
  } else {
    console.error(JSON.stringify(result, null, 2));
  }

  if (!result.ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
