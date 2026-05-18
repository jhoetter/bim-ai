#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BENCHMARK_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'two-storey-house-with-stair');
const DEFAULT_BUNDLE = path.join(BENCHMARK_DIR, 'mcp-cli-command-bundle.json');
const DEFAULT_EXPECTED = path.join(BENCHMARK_DIR, 'expected-semantics.json');

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/two-storey-stair.mjs [--bundle <path>] [--expected <path>] [--json]
    [--mode offline|auto|live] [--base-url <url>] [--model-id <id>]
    [--parent-revision <rev>] [--user-id <id>] [--out-dir <path>] [--commit-live]

  --commit-live mutates the target model. Without it, live mode only dry-runs.
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
    commitLive: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--commit-live') args.commitLive = true;
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
    openings: {
      doors: 0,
      windows: 0,
      hosted: 0,
      missingHost: [],
      missingFamilyType: [],
      slabOpenings: 0,
      shaftOpenings: 0,
    },
    floors: { count: 0, ids: [], roomBounded: false },
    stairs: { count: 0, ids: [], betweenLevels: [] },
    railings: { count: 0, ids: [], hostedOnStairs: 0, missingHostedStair: [] },
    roofs: { count: 0, ids: [], geometryModes: [] },
    views: { plan: 0, section: 0, threeD: 0, ids: [] },
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
      walls.push({ id: command.id, wallTypeId: command.wallTypeId });
    } else if (command.type === 'createWallChain') {
      for (const segment of command.segments ?? []) {
        walls.push({ id: segment.id, wallTypeId: command.wallTypeId });
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
    } else if (command.type === 'createSlabOpening') {
      summary.openings.slabOpenings += 1;
      if (command.isShaft === true) summary.openings.shaftOpenings += 1;
    } else if (command.type === 'createFloor') {
      summary.floors.count += 1;
      summary.floors.ids.push(command.id);
      summary.floors.roomBounded ||= command.roomBounded === true;
    } else if (command.type === 'createStair') {
      summary.stairs.count += 1;
      summary.stairs.ids.push(command.id);
      summary.stairs.betweenLevels.push({
        baseLevelId: command.baseLevelId,
        topLevelId: command.topLevelId,
      });
    } else if (command.type === 'createRailing') {
      summary.railings.count += 1;
      summary.railings.ids.push(command.id);
      if (command.hostedStairId) summary.railings.hostedOnStairs += 1;
      else summary.railings.missingHostedStair.push(command.id);
    } else if (command.type === 'createRoof') {
      summary.roofs.count += 1;
      summary.roofs.ids.push(command.id);
      summary.roofs.geometryModes.push(command.roofGeometryMode);
    } else if (command.type === 'createSectionCut') {
      summary.views.section += 1;
      summary.views.ids.push(command.id);
    } else if (command.type === 'saveViewpoint') {
      if (command.mode === 'orbit_3d') summary.views.threeD += 1;
      summary.views.ids.push(command.id);
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
  for (const [sheetId, views] of placedSheetViews)
    summary.sheets.placedViewsBySheet[sheetId] = views;

  for (const key of [
    'levels',
    'walls',
    'floors',
    'stairs',
    'railings',
    'roofs',
    'views',
    'sheets',
    'schedules',
  ]) {
    summary[key].ids?.sort();
  }
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
  compareScalar(
    diff,
    'openings.slabOpenings',
    summary.openings.slabOpenings,
    exp.openings.slabOpenings,
  );
  compareScalar(
    diff,
    'openings.shaftOpenings',
    summary.openings.shaftOpenings,
    exp.openings.shaftOpenings,
  );
  compareScalar(diff, 'floors.count', summary.floors.count, exp.floors.count);
  compareArray(diff, 'floors.ids', summary.floors.ids, exp.floors.ids);
  compareScalar(diff, 'floors.roomBounded', summary.floors.roomBounded, exp.floors.roomBounded);
  compareScalar(diff, 'stairs.count', summary.stairs.count, exp.stairs.count);
  compareArray(diff, 'stairs.ids', summary.stairs.ids, exp.stairs.ids);
  compareScalar(diff, 'railings.count', summary.railings.count, exp.railings.count);
  compareArray(diff, 'railings.ids', summary.railings.ids, exp.railings.ids);
  compareScalar(
    diff,
    'railings.hostedOnStairs',
    summary.railings.hostedOnStairs,
    exp.railings.hostedOnStairs,
  );
  compareScalar(diff, 'roofs.count', summary.roofs.count, exp.roofs.count);
  compareArray(diff, 'roofs.ids', summary.roofs.ids, exp.roofs.ids);
  compareArray(diff, 'roofs.geometryModes', summary.roofs.geometryModes, exp.roofs.geometryModes);
  compareScalar(diff, 'views.plan', summary.views.plan, exp.views.plan);
  compareScalar(diff, 'views.section', summary.views.section, exp.views.section);
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
    if (!summary.commandSurfaceUsage[type])
      diff.push({ path: `commandSurfaceUsage.${type}`, actual: 0, expected: '>= 1' });
  }
  for (const type of usage.forbidden) {
    if (summary.commandSurfaceUsage[type])
      diff.push({
        path: `commandSurfaceUsage.${type}`,
        actual: summary.commandSurfaceUsage[type],
        expected: 0,
      });
  }
  return diff;
}

function withParentRevision(bundle, parentRevision) {
  if (parentRevision === null || parentRevision === undefined || parentRevision === '')
    return bundle;
  const parsed = Number(parentRevision);
  return { ...bundle, parentRevision: Number.isFinite(parsed) ? parsed : parentRevision };
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

async function runLiveBundle(args, bundle, requestMode) {
  const liveBundle = withParentRevision(bundle, args.parentRevision);
  const baseUrl = args.baseUrl.replace(/\/$/, '');
  const endpointPath = `/api/models/${encodeURIComponent(args.modelId)}/bundles`;
  const response = await postJson(`${baseUrl}${endpointPath}`, {
    bundle: liveBundle,
    mode: requestMode,
    userId: args.userId,
    submitter: 'benchmark-agent',
  });
  const body = response.body ?? {};
  const violations = body.violations ?? body.result?.violations ?? [];
  return {
    mode: requestMode === 'commit' ? 'live-commit' : 'live-dry-run',
    ok: response.ok && body.ok !== false,
    publicSurface: {
      kind: 'cmd-v3-api',
      method: 'POST',
      endpoint: endpointPath,
      url: `${baseUrl}${endpointPath}`,
      requestMode,
    },
    request: {
      bundleDigest: sha256(liveBundle),
      commandCount: commandList(liveBundle).length,
      userId: args.userId,
      parentRevision: liveBundle.parentRevision ?? null,
    },
    response: {
      httpStatus: response.status,
      ok: response.ok,
      bodyOk: body.ok ?? null,
      applied: body.applied ?? body.result?.applied ?? null,
      newRevision: body.newRevision ?? body.result?.newRevision ?? null,
      wouldRevision: body.wouldRevision ?? body.result?.wouldRevision ?? null,
    },
    validation: {
      status: requestMode === 'commit' ? 'live-commit-response' : 'live-dry-run-response',
      ok: response.ok && body.ok !== false,
      violationCount: violations.length,
      violations,
    },
  };
}

function buildEvidenceHooks(summary) {
  return {
    advisor: {
      status: 'hook-declared-not-collected',
      pass: null,
      requiredChecks: [
        'GET /api/models/{model_id}/validate',
        'POST /api/models/{model_id}/qa/advisor',
      ],
      expectedStairChecks: [
        'stair_floor_penetration_without_slab_opening',
        'stair_guardrail_missing',
        'stair_headroom_clearance_conflict',
      ],
    },
    visual: {
      status: 'hook-declared-not-collected',
      pass: null,
      requiredViewIds: summary.views.ids,
      sheetId: summary.sheets.ids[0] ?? null,
      serverSideSubstitute:
        'GET /api/models/{model_id}/exports/sheet-print-raster.png?sheetId=tsh-sheet-a201',
    },
    export: {
      status: 'hook-declared-not-collected',
      pass: null,
      requiredGeometryCounts: {
        wall: summary.walls.total,
        floor: summary.floors.count,
        stair: summary.stairs.count,
        railing: summary.railings.count,
        slab_opening: summary.openings.slabOpenings,
        roof: summary.roofs.count,
        door: summary.openings.doors,
        window: summary.openings.windows,
        room: summary.rooms.count,
      },
      checks: [
        'GET /api/models/{model_id}/exports/gltf-manifest',
        'GET /api/models/{model_id}/exports/ifc-manifest',
        'GET /api/models/{model_id}/exports/sheet-preview.pdf?sheetId=tsh-sheet-a201',
      ],
    },
  };
}

async function writeArtifacts(outDir, result) {
  if (!outDir) return;
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, 'semantic-summary.json'),
    `${JSON.stringify(result.semanticSummary, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outDir, 'semantic-diff.json'),
    `${JSON.stringify(result.semanticDiff, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outDir, 'execution-evidence.json'),
    `${JSON.stringify(result.executionEvidence, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outDir, 'advisor-validation.json'),
    `${JSON.stringify(result.evidenceHooks.advisor, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outDir, 'visual-evidence.json'),
    `${JSON.stringify(result.evidenceHooks.visual, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outDir, 'export-evidence.json'),
    `${JSON.stringify(result.evidenceHooks.export, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outDir, 'benchmark-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
}

export async function runBenchmark(rawArgs = process.argv.slice(2)) {
  const args = parseArgs(rawArgs);
  const [bundle, expected] = await Promise.all([readJson(args.bundle), readJson(args.expected)]);
  const semanticSummary = summarize(bundle, expected);
  const diff = diffSummary(semanticSummary, expected);
  const semanticDiff = {
    schemaVersion: 'bim-ai.benchmark.semantic-diff.v1',
    benchmarkId: expected.benchmarkId,
    ok: diff.length === 0,
    diff,
  };
  const canRunLive = Boolean(args.baseUrl && args.modelId);
  const mode = args.mode === 'auto' ? (canRunLive ? 'live' : 'offline') : args.mode;
  if (mode === 'live' && !canRunLive) {
    throw new Error(
      'Live mode requires BIM_AI_BASE_URL/--base-url and BIM_AI_MODEL_ID/--model-id.',
    );
  }
  const executionEvidence =
    mode === 'live'
      ? await runLiveBundle(args, bundle, args.commitLive ? 'commit' : 'dry_run')
      : {
          mode: 'offline-fixture',
          ok: semanticDiff.ok,
          publicSurface: {
            kind: 'deterministic-fixture',
            cliEquivalent: 'node scripts/benchmarks/two-storey-stair.mjs --mode offline --json',
          },
          bundleDigest: sha256(bundle),
          commandCount: semanticSummary.commandCount,
          validation: { status: 'fixture-semantic-diff', ok: semanticDiff.ok },
          rawBundleOnlyCapabilities:
            expected.evidenceExpectations.commandSurfaceUsage.rawBundleOnlyForNow,
        };
  const result = {
    schemaVersion: 'bim-ai.benchmark.result.v1',
    benchmarkId: expected.benchmarkId,
    ok: semanticDiff.ok && executionEvidence.ok,
    mode,
    semanticSummary,
    semanticDiff,
    executionEvidence,
    evidenceHooks: buildEvidenceHooks(semanticSummary),
  };
  await writeArtifacts(args.outDir, result);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${result.benchmarkId}: ${result.ok ? 'ok' : 'failed'} (${mode})`);
    console.log(`commands: ${semanticSummary.commandCount}`);
    console.log(`semantic diff: ${semanticDiff.diff.length} issue(s)`);
    console.log(
      `raw-only: ${executionEvidence.rawBundleOnlyCapabilities?.join(', ') ?? 'see live response'}`,
    );
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runBenchmark();
}
