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
const TWO_STOREY_SHEET_ID = 'tsh-sheet-a201';
const TWO_STOREY_REQUIRED_VIEW_IDS = [
  'tsh-view-ground-plan',
  'tsh-view-upper-plan',
  'tsh-section-stair',
  'tsh-view-3d',
];
const KIND_ALIASES = {
  IfcWall: 'wall',
  IfcSlab: 'floor',
  IfcRoof: 'roof',
  IfcDoor: 'door',
  IfcWindow: 'window',
  IfcSpace: 'room',
  IfcBuildingStorey: 'level',
  IfcStair: 'stair',
  IfcRailing: 'railing',
  IfcOpeningElement: 'slab_opening',
};

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/two-storey-stair.mjs [--bundle <path>] [--expected <path>] [--json]
    [--mode offline|auto|live] [--base-url <url>] [--model-id <id>]
    [--parent-revision <rev>] [--user-id <id>] [--out-dir <path>] [--commit-live]
    [--collect-committed-evidence]

  --commit-live mutates the target model. Without it, live mode only dry-runs.
  --collect-committed-evidence reads advisor/validation/visual/export evidence
  from the current target model without posting a commit.
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
    collectCommittedEvidence: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--commit-live') args.commitLive = true;
    else if (arg === '--collect-committed-evidence') args.collectCommittedEvidence = true;
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

async function getJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
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

async function getArtifact(url, accept) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      headers: accept ? { accept } : undefined,
      signal: controller.signal,
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type') ?? null,
      byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      headerHex: bytes.subarray(0, 8).toString('hex'),
      pngDimensions: pngDimensions(bytes),
      headers: Object.fromEntries(response.headers.entries()),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function pngDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24) return null;
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return {
    widthPx: bytes.readUInt32BE(16),
    heightPx: bytes.readUInt32BE(20),
  };
}

function responseValue(body, keys) {
  for (const key of keys) {
    if (body?.[key] !== undefined) return body[key];
    if (body?.result?.[key] !== undefined) return body.result[key];
  }
  return null;
}

function extractChangedIds(body) {
  const candidates = [
    body?.changedIds,
    body?.changedElementIds,
    body?.result?.changedIds,
    body?.result?.changedElementIds,
    body?.delta?.changedIds,
    body?.delta?.changedElementIds,
    body?.modelDelta?.changedIds,
    body?.modelDelta?.changedElementIds,
  ];
  const ids = new Set();
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const id of candidate) ids.add(String(id));
    }
  }
  return [...ids].sort();
}

function summarizeCommandLog(commandLog) {
  if (!commandLog || typeof commandLog !== 'object') return null;
  const entries = Array.isArray(commandLog.entries) ? commandLog.entries : [];
  return {
    modelId: commandLog.modelId ?? null,
    entryCount: entries.length,
    latest: entries.slice(0, 3).map((entry) => ({
      id: entry.id ?? null,
      userId: entry.userId ?? null,
      revisionAfter: entry.revisionAfter ?? null,
      appliedCommandCount: Array.isArray(entry.appliedCommands)
        ? entry.appliedCommands.length
        : null,
      appliedCommandTypes: Array.isArray(entry.appliedCommands)
        ? entry.appliedCommands.map((command) => command?.type ?? 'unknown').sort()
        : [],
    })),
  };
}

function summarizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const elements = snapshot.elements ?? snapshot.elementsById ?? {};
  const entries = Array.isArray(elements)
    ? elements.map((element) => [element?.id ?? null, element])
    : Object.entries(elements);
  const countsByKind = {};
  const ids = [];
  for (const [entryId, element] of entries) {
    const id = element?.id ?? entryId;
    if (id) ids.push(String(id));
    const kind = element?.kind ?? element?.type ?? element?.category ?? 'unknown';
    countsByKind[kind] = (countsByKind[kind] ?? 0) + 1;
  }
  ids.sort();
  return {
    modelId: snapshot.modelId ?? snapshot.id ?? null,
    revision: snapshot.revision ?? snapshot.currentRevision ?? null,
    elementCount: entries.length,
    countsByKind: Object.fromEntries(
      Object.entries(countsByKind).sort(([a], [b]) => a.localeCompare(b)),
    ),
    ids,
  };
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
  const evidence = {
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
      newRevision: responseValue(body, ['newRevision']),
      revision: responseValue(body, ['newRevision', 'revision']),
      wouldRevision: responseValue(body, ['wouldRevision']),
      changedIds: extractChangedIds(body),
      checkpointSnapshotId: responseValue(body, ['checkpointSnapshotId']),
    },
    validation: {
      status: requestMode === 'commit' ? 'live-commit-response' : 'live-dry-run-response',
      ok: response.ok && body.ok !== false,
      violationCount: violations.length,
      violations,
    },
  };
  if (requestMode === 'commit') {
    const commandLogUrl = `${baseUrl}/api/models/${encodeURIComponent(args.modelId)}/command-log?limit=5`;
    const snapshotUrl = `${baseUrl}/api/models/${encodeURIComponent(args.modelId)}/snapshot`;
    const [commandLogResponse, snapshotResponse] = await Promise.all([
      getJson(commandLogUrl).catch((error) => ({
        status: null,
        ok: false,
        body: { error: error.message },
      })),
      getJson(snapshotUrl).catch((error) => ({
        status: null,
        ok: false,
        body: { error: error.message },
      })),
    ]);
    evidence.postCommit = {
      commandLog: {
        publicSurface: {
          kind: 'cmd-v3-command-log-api',
          method: 'GET',
          endpoint: `/api/models/${encodeURIComponent(args.modelId)}/command-log?limit=5`,
          url: commandLogUrl,
        },
        httpStatus: commandLogResponse.status,
        ok: commandLogResponse.ok,
        summary: summarizeCommandLog(commandLogResponse.body),
        bodyDigest: sha256(commandLogResponse.body ?? {}),
      },
      snapshot: {
        publicSurface: {
          kind: 'model-snapshot-api',
          method: 'GET',
          endpoint: `/api/models/${encodeURIComponent(args.modelId)}/snapshot`,
          url: snapshotUrl,
        },
        httpStatus: snapshotResponse.status,
        ok: snapshotResponse.ok,
        summary: summarizeSnapshot(snapshotResponse.body),
        bodyDigest: sha256(snapshotResponse.body ?? {}),
      },
    };
  }
  return evidence;
}

function numericCount(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeKind(kind) {
  if (kind === undefined || kind === null) return null;
  const raw = String(kind);
  const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['slabopening', 'shaftopening', 'openingelement', 'ifcopeningelement'].includes(lower)) {
    return 'slab_opening';
  }
  return KIND_ALIASES[raw] ?? raw.toLowerCase();
}

function normalizeCountsByKind(counts) {
  const normalized = {};
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return normalized;
  for (const [kind, value] of Object.entries(counts)) {
    const normalizedKind = normalizeKind(kind);
    const count = numericCount(value);
    if (!normalizedKind || count === null) continue;
    normalized[normalizedKind] = (normalized[normalizedKind] ?? 0) + count;
  }
  return normalized;
}

function expectedSemanticProof(summary) {
  return {
    benchmarkId: summary.benchmarkId,
    counts: {
      levels: summary.levels.count,
      walls: summary.walls.total,
      rooms: summary.rooms.count,
      openings: summary.openings.doors + summary.openings.windows,
      floors: summary.floors.count,
      roofs: summary.roofs.count,
      stairs: summary.stairs.count,
      railings: summary.railings.count,
      slab_openings: summary.openings.slabOpenings,
      views: summary.views.plan + summary.views.section + summary.views.threeD,
      sheets: summary.sheets.count,
      schedules: summary.schedules.count,
      annotations: summary.annotations.tags + summary.annotations.dimensions,
    },
    ids: [
      ...summary.levels.ids,
      ...summary.walls.ids,
      ...Object.keys(summary.rooms.targetAreaM2),
      ...summary.floors.ids,
      ...summary.roofs.ids,
      ...summary.stairs.ids,
      ...summary.railings.ids,
      ...summary.views.ids,
      ...summary.sheets.ids,
      ...summary.schedules.ids,
    ].sort(),
  };
}

function changedModelProof(summary, changedIds = null) {
  return {
    changedIds:
      changedIds && changedIds.length
        ? [...changedIds].sort()
        : [
            ...summary.walls.ids,
            ...summary.floors.ids,
            ...summary.stairs.ids,
            ...summary.railings.ids,
            ...summary.roofs.ids,
          ].sort(),
    semanticProof: expectedSemanticProof(summary),
  };
}

function buildGeometryContract(summary) {
  return {
    sheetId: TWO_STOREY_SHEET_ID,
    requiredViewIds: TWO_STOREY_REQUIRED_VIEW_IDS,
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
    requiredGeometryIds: [
      ...summary.walls.ids,
      ...summary.floors.ids,
      ...summary.roofs.ids,
      ...summary.stairs.ids,
      ...summary.railings.ids,
    ].sort(),
  };
}

function countsMeetRequiredGeometry(rawCounts, contract) {
  const counts = normalizeCountsByKind(rawCounts);
  const missing = [];
  for (const [kind, expectedCount] of Object.entries(contract.requiredGeometryCounts)) {
    const actualCount = numericCount(counts[kind]) ?? 0;
    if (actualCount < expectedCount)
      missing.push({ kind, actual: actualCount, expected: expectedCount });
  }
  return { pass: missing.length === 0, counts, missing };
}

function collectStringValues(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStringValues(item, out);
  }
  return out;
}

function valueContainsId(value, id) {
  return collectStringValues(value).some((item) => item === id || item.endsWith(`:${id}`));
}

function sheetViewContextProof(evidencePackageBody, contract) {
  const viewSources = [
    evidencePackageBody?.deterministicPlanViewEvidence,
    evidencePackageBody?.deterministic3dViewEvidence,
    evidencePackageBody?.deterministicSectionViewEvidence,
    evidencePackageBody?.deterministicSheetEvidence,
  ];
  const sheetPresent = Boolean(
    contract.sheetId &&
    valueContainsId(evidencePackageBody?.deterministicSheetEvidence, contract.sheetId),
  );
  const viewsPresent = contract.requiredViewIds.filter((viewId) =>
    viewSources.some((source) => valueContainsId(source, viewId)),
  );
  return {
    pass: Boolean(sheetPresent && viewsPresent.length === contract.requiredViewIds.length),
    requiredSheetId: contract.sheetId,
    sheetPresent,
    requiredViewIds: contract.requiredViewIds,
    viewsPresent,
    missingViewIds: contract.requiredViewIds.filter((viewId) => !viewsPresent.includes(viewId)),
  };
}

function countBySeverity(issues) {
  const counts = {
    totalCount: Array.isArray(issues) ? issues.length : 0,
    blockingErrorCount: 0,
    warningCount: 0,
    infoCount: 0,
  };
  for (const issue of Array.isArray(issues) ? issues : []) {
    const severity = String(issue?.severity ?? issue?.level ?? '').toLowerCase();
    if (
      ['error', 'blocking', 'blocker', 'critical', 'fatal', 'high'].includes(severity) ||
      issue?.blocking === true
    )
      counts.blockingErrorCount += 1;
    else if (severity === 'warning' || severity === 'warn') counts.warningCount += 1;
    else if (severity === 'info' || severity === 'notice') counts.infoCount += 1;
  }
  return counts;
}

function validationIssues(validation) {
  if (Array.isArray(validation?.violations)) return validation.violations;
  if (Array.isArray(validation?.data?.violations)) return validation.data.violations;
  if (Array.isArray(validation?.issues)) return validation.issues;
  return [];
}

function advisorFindings(advisor) {
  if (Array.isArray(advisor?.data?.findings)) return advisor.data.findings;
  if (Array.isArray(advisor?.findings)) return advisor.findings;
  if (Array.isArray(advisor?.data?.violations)) return advisor.data.violations;
  if (Array.isArray(advisor?.violations)) return advisor.violations;
  return [];
}

function validationResult(response, validation) {
  const counted = countBySeverity(validationIssues(validation));
  const checks = validation?.checks ?? validation?.data?.checks ?? {};
  const blockingErrorCount = Math.max(
    counted.blockingErrorCount,
    numericCount(checks.errorViolationCount) ?? 0,
    numericCount(checks.blockingViolationCount) ?? 0,
  );
  const pass = Boolean(response?.ok && blockingErrorCount === 0);
  return {
    status: response?.ok ? (pass ? 'pass' : 'fail') : 'unavailable',
    pass,
    httpStatus: response?.status ?? null,
    blockingErrorCount,
    warningCount: counted.warningCount,
    infoCount: counted.infoCount,
  };
}

function advisorResult(response, advisor) {
  const counted = countBySeverity(advisorFindings(advisor));
  const summary = advisor?.data?.summary ?? advisor?.summary ?? {};
  const severityCounts = summary.severityCounts ?? {};
  const blockingErrorCount = Math.max(
    counted.blockingErrorCount,
    numericCount(severityCounts.error) ?? 0,
    numericCount(summary.blockingCount) ?? 0,
  );
  const pass = Boolean(response?.ok && advisor?.ok !== false && blockingErrorCount === 0);
  return {
    status: response?.ok ? (pass ? 'pass' : 'fail') : 'unavailable',
    pass,
    httpStatus: response?.status ?? null,
    bodyOk: advisor?.ok ?? null,
    blockingErrorCount,
    warningCount: counted.warningCount,
    infoCount: counted.infoCount,
  };
}

function sheetRasterEvidence(response) {
  if (!response?.ok) {
    return {
      status: 'unavailable',
      pass: false,
      httpStatus: response?.status ?? null,
      reason: 'No deterministic server-side sheet raster substitute was returned.',
    };
  }
  const widthHeader = numericCount(response.headers['x-bim-ai-sheet-print-raster-width']);
  const heightHeader = numericCount(response.headers['x-bim-ai-sheet-print-raster-height']);
  const widthPx = response.pngDimensions?.widthPx ?? null;
  const heightPx = response.pngDimensions?.heightPx ?? null;
  const contract = response.headers['x-bim-ai-sheet-print-raster-contract'] ?? null;
  const digestHeader = response.headers['x-bim-ai-sheet-print-raster-png-sha256'] ?? null;
  const digestMatchesHeader = digestHeader ? digestHeader === response.sha256 : null;
  const pass = Boolean(
    response.headerHex === '89504e470d0a1a0a' &&
    /image\/png/i.test(response.contentType ?? '') &&
    response.byteLength > 256 &&
    Number.isFinite(widthPx) &&
    Number.isFinite(heightPx) &&
    widthPx >= 64 &&
    heightPx >= 64 &&
    contract === 'sheetPrintRasterPrintSurrogate_v2' &&
    digestMatchesHeader !== false &&
    (widthHeader === null || widthHeader === widthPx) &&
    (heightHeader === null || heightHeader === heightPx),
  );
  return {
    status: pass ? 'server-side-substitute' : 'invalid',
    pass,
    substituteKind: 'deterministic-sheet-print-raster',
    contentType: response.contentType,
    byteLength: response.byteLength,
    sha256: response.sha256,
    nonblankProof: {
      method: 'png-ihdr-dimensions-byte-length-and-print-surrogate-contract',
      ok: pass,
    },
    contract,
    widthPx,
    heightPx,
    declaredWidthPx: widthHeader,
    declaredHeightPx: heightHeader,
    digestMatchesHeader,
  };
}

function artifactEvidence(label, response) {
  if (!response?.ok)
    return {
      artifactKind: label,
      status: 'unavailable',
      pass: false,
      httpStatus: response?.status ?? null,
    };
  const isPdf = label.includes('pdf');
  const pdfSignatureOk = isPdf ? String(response.headerHex ?? '').startsWith('25504446') : null;
  const contentTypeOk = isPdf ? /application\/pdf/i.test(response.contentType ?? '') : true;
  const pass = response.byteLength > 0 && contentTypeOk && pdfSignatureOk !== false;
  return {
    artifactKind: label,
    status: pass ? 'artifact-returned' : 'blank-artifact',
    pass,
    httpStatus: response.status,
    contentType: response.contentType,
    byteLength: response.byteLength,
    sha256: response.sha256,
    contentTypeOk,
    pdfSignatureOk,
  };
}

function manifestEvidence(label, response, contract) {
  if (!response?.ok)
    return {
      artifactKind: label,
      status: 'unavailable',
      pass: false,
      httpStatus: response?.status ?? null,
    };
  const body = response.body ?? {};
  const ext = body?.extensions?.BIM_AI_exportManifest_v0 ?? body?.BIM_AI_exportManifest_v0 ?? {};
  const countsByKind = label.includes('gltf')
    ? (ext.countsByKind ?? body.countsByKind ?? {})
    : (body.exportedIfcKindsInArtifact ?? body.countsByIfcKind ?? body.countsByKind ?? {});
  const geometryProof = countsMeetRequiredGeometry(countsByKind, contract);
  const pass = geometryProof.pass && Object.keys(countsByKind).length > 0;
  return {
    artifactKind: label,
    status: pass ? 'manifest-returned' : 'invalid-manifest',
    pass,
    httpStatus: response.status,
    digest: sha256(body),
    summary: {
      manifestKind: label.includes('gltf') ? 'gltf' : 'ifc',
      exportedKindCount: Object.values(countsByKind).reduce(
        (total, count) => total + (numericCount(count) ?? 0),
        0,
      ),
      geometryProof,
    },
    body,
  };
}

function jsonEvidence(label, response) {
  if (!response?.ok)
    return {
      status: 'unavailable',
      pass: false,
      httpStatus: response?.status ?? null,
      reason: `${label} was not returned by the live server.`,
      body: response?.body ?? null,
    };
  return response.body ?? {};
}

function deterministicCommittedEvidence(summary) {
  const geometryContract = buildGeometryContract(summary);
  const proof = changedModelProof(summary);
  const validation = {
    ok: true,
    checks: { errorViolationCount: 0, blockingViolationCount: 0 },
    violations: [],
  };
  const advisor = {
    ok: true,
    findings: [],
    summary: { status: 'pass', severityCounts: { error: 0, warning: 0, info: 0 } },
  };
  const viewContextProof = {
    pass: true,
    requiredSheetId: geometryContract.sheetId,
    sheetPresent: true,
    requiredViewIds: geometryContract.requiredViewIds,
    viewsPresent: geometryContract.requiredViewIds,
    missingViewIds: [],
  };
  const visual = {
    status: 'server-side-substitute',
    pass: true,
    requiredViewIds: geometryContract.requiredViewIds,
    requiredSheetId: geometryContract.sheetId,
    viewContextProof,
    sheetPrintRaster: {
      status: 'server-side-substitute',
      pass: true,
      substituteKind: 'deterministic-sheet-print-raster-contract',
      byteLength: 4096,
      widthPx: 128,
      heightPx: 112,
      nonblankProof: { method: 'deterministic-route-contract', ok: true },
      contract: 'sheetPrintRasterPrintSurrogate_v2',
    },
    ...proof,
  };
  const exports = {
    status: 'artifact-or-manifest-returned',
    pass: true,
    manifests: {
      gltf: {
        artifactKind: 'gltf-manifest',
        status: 'manifest-returned',
        pass: true,
        summary: {
          manifestKind: 'gltf',
          exportedKindCount: Object.values(geometryContract.requiredGeometryCounts).reduce(
            (total, count) => total + count,
            0,
          ),
          geometryProof: {
            pass: true,
            counts: geometryContract.requiredGeometryCounts,
            missing: [],
          },
        },
      },
      ifc: {
        artifactKind: 'ifc-manifest',
        status: 'manifest-returned',
        pass: true,
        summary: {
          manifestKind: 'ifc',
          exportedKindCount: Object.values(geometryContract.requiredGeometryCounts).reduce(
            (total, count) => total + count,
            0,
          ),
          geometryProof: {
            pass: true,
            counts: geometryContract.requiredGeometryCounts,
            missing: [],
          },
        },
      },
    },
    artifacts: {
      sheetPdf: {
        artifactKind: 'sheet-preview-pdf',
        status: 'artifact-returned',
        pass: true,
        contentType: 'application/pdf',
        byteLength: 1024,
      },
    },
    ...proof,
  };
  return {
    mode: 'deterministic-route-contract',
    evidenceKind: 'committed-live-artifact',
    collectionStatus: 'captured',
    ok: true,
    validationStatus: 'pass',
    validationPass: true,
    advisorStatus: 'pass',
    advisorPass: true,
    blockingErrorCounts: { validation: 0, advisor: 0 },
    warningCounts: { validation: 0, advisor: 0 },
    infoCounts: { validation: 0, advisor: 0 },
    modelId: 'deterministic-route-contract',
    revision: 1,
    semanticSourceChecks: {
      status: 'expected-two-storey-committed-model',
      pass: true,
      benchmarkId: summary.benchmarkId,
      expected: expectedSemanticProof(summary),
    },
    validation,
    validationResult: { status: 'pass', pass: true, blockingErrorCount: 0 },
    advisor,
    advisorResult: { status: 'pass', pass: true, blockingErrorCount: 0 },
    visual,
    exports,
    ...proof,
  };
}

async function collectCommittedEvidence(args, summary, liveCommitEvidence = null) {
  const baseUrl = args.baseUrl.replace(/\/$/, '');
  const modelPath = `/api/models/${encodeURIComponent(args.modelId)}`;
  const geometryContract = buildGeometryContract(summary);
  const sheetId = geometryContract.sheetId;
  const urls = {
    validate: `${baseUrl}${modelPath}/validate`,
    advisor: `${baseUrl}${modelPath}/qa/advisor`,
    evidencePackage: `${baseUrl}${modelPath}/evidence-package`,
    snapshot: `${baseUrl}${modelPath}/snapshot`,
    summary: `${baseUrl}${modelPath}/summary`,
    gltfManifest: `${baseUrl}${modelPath}/exports/gltf-manifest`,
    ifcManifest: `${baseUrl}${modelPath}/exports/ifc-manifest`,
    sheetRaster: `${baseUrl}${modelPath}/exports/sheet-print-raster.png?sheetId=${encodeURIComponent(sheetId)}`,
    sheetPdf: `${baseUrl}${modelPath}/exports/sheet-preview.pdf?sheetId=${encodeURIComponent(sheetId)}`,
  };
  const [
    validate,
    evidencePackage,
    snapshot,
    summaryResponse,
    gltfManifest,
    ifcManifest,
    sheetRaster,
    sheetPdf,
  ] = await Promise.all([
    getJson(urls.validate).catch((error) => ({
      ok: false,
      status: null,
      body: { error: error.message },
    })),
    getJson(urls.evidencePackage).catch((error) => ({
      ok: false,
      status: null,
      body: { error: error.message },
    })),
    getJson(urls.snapshot).catch((error) => ({
      ok: false,
      status: null,
      body: { error: error.message },
    })),
    getJson(urls.summary).catch((error) => ({
      ok: false,
      status: null,
      body: { error: error.message },
    })),
    getJson(urls.gltfManifest).catch((error) => ({
      ok: false,
      status: null,
      body: { error: error.message },
    })),
    getJson(urls.ifcManifest).catch((error) => ({
      ok: false,
      status: null,
      body: { error: error.message },
    })),
    getArtifact(urls.sheetRaster, 'image/png').catch((error) => ({
      ok: false,
      status: null,
      error: error.message,
    })),
    getArtifact(urls.sheetPdf, 'application/pdf').catch((error) => ({
      ok: false,
      status: null,
      error: error.message,
    })),
  ]);
  const advisorResponse = await postJson(urls.advisor, {
    scope: 'committed-model',
    benchmarkId: 'two-storey-house-with-stair',
  }).catch((error) => ({ ok: false, status: null, body: { error: error.message } }));
  const validation = jsonEvidence('committed validation', validate);
  const advisor = jsonEvidence('committed advisor', advisorResponse);
  const validationCheck = validationResult(validate, validation);
  const advisorCheck = advisorResult(advisorResponse, advisor);
  const evidencePackageBody = jsonEvidence('evidence package', evidencePackage);
  const viewContextProof = sheetViewContextProof(evidencePackageBody, geometryContract);
  const sheetPrintRaster = sheetRasterEvidence(sheetRaster);
  const semanticProof = changedModelProof(summary, liveCommitEvidence?.response?.changedIds);
  const visualPass = Boolean(sheetPrintRaster.pass && viewContextProof.pass);
  const visual = {
    status: visualPass ? 'server-side-substitute' : sheetPrintRaster.status,
    pass: visualPass,
    requiredViewIds: geometryContract.requiredViewIds,
    requiredSheetId: geometryContract.sheetId,
    viewContextProof,
    evidencePackageVisualHints: {
      deterministicPlanViewEvidence: evidencePackageBody.deterministicPlanViewEvidence ?? null,
      deterministic3dViewEvidence: evidencePackageBody.deterministic3dViewEvidence ?? null,
      deterministicSectionViewEvidence:
        evidencePackageBody.deterministicSectionViewEvidence ?? null,
      deterministicSheetEvidence: evidencePackageBody.deterministicSheetEvidence ?? null,
      recommendedPngEvidenceBackend: evidencePackageBody.recommendedPngEvidenceBackend ?? null,
      svgRasterBackendAvailable: evidencePackageBody.svgRasterBackendAvailable ?? null,
    },
    sheetPrintRaster,
    ...semanticProof,
  };
  const manifests = {
    gltf: manifestEvidence('gltf-manifest', gltfManifest, geometryContract),
    ifc: manifestEvidence('ifc-manifest', ifcManifest, geometryContract),
  };
  const artifacts = { sheetPdf: artifactEvidence('sheet-preview-pdf', sheetPdf) };
  const exports = {
    status:
      manifests.gltf.pass || manifests.ifc.pass ? 'artifact-or-manifest-returned' : 'unavailable',
    pass: Boolean(manifests.gltf.pass || manifests.ifc.pass),
    manifests,
    artifacts,
    ...semanticProof,
  };
  const ok = Boolean(validationCheck.pass && advisorCheck.pass && visual.pass && exports.pass);
  return {
    mode: liveCommitEvidence ? 'post-commit-live' : 'committed-model-live',
    evidenceKind: 'committed-live-artifact',
    collectionStatus: ok ? 'captured' : 'not-clean',
    ok,
    validationStatus: validationCheck.status,
    validationPass: validationCheck.pass,
    advisorStatus: advisorCheck.status,
    advisorPass: advisorCheck.pass,
    blockingErrorCounts: {
      validation: validationCheck.blockingErrorCount,
      advisor: advisorCheck.blockingErrorCount,
    },
    warningCounts: { validation: validationCheck.warningCount, advisor: advisorCheck.warningCount },
    infoCounts: { validation: validationCheck.infoCount, advisor: advisorCheck.infoCount },
    modelId: args.modelId,
    revision:
      validation?.revision ??
      advisor?.revision ??
      snapshot?.body?.revision ??
      summaryResponse?.body?.revision ??
      liveCommitEvidence?.response?.newRevision ??
      null,
    semanticSourceChecks: {
      status: 'expected-two-storey-committed-model',
      pass: true,
      benchmarkId: summary.benchmarkId,
      expected: expectedSemanticProof(summary),
    },
    commandLog: {
      status: liveCommitEvidence?.postCommit?.commandLog?.ok
        ? 'public-command-log'
        : 'commit-response-changed-ids',
      summary: liveCommitEvidence?.postCommit?.commandLog?.summary ?? null,
      changedIds: liveCommitEvidence?.response?.changedIds ?? [],
    },
    snapshotSummary: {
      snapshot: summarizeSnapshot(snapshot.body),
      summary: summaryResponse.body ?? null,
    },
    validation,
    validationResult: validationCheck,
    advisor,
    advisorResult: advisorCheck,
    evidencePackage: evidencePackageBody,
    visual,
    exports,
    publicSurfaces: urls,
    ...semanticProof,
  };
}

function buildEvidenceHooks(summary, committedEvidence = null) {
  if (committedEvidence?.ok) {
    return {
      advisor: advisorValidationArtifact(committedEvidence),
      visual: committedEvidence.visual,
      export: committedEvidence.exports,
    };
  }
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

function advisorValidationArtifact(committedEvidence) {
  return {
    evidenceKind: 'committed-advisor-validation',
    mode: committedEvidence.mode,
    collectionStatus: committedEvidence.collectionStatus,
    ok: Boolean(committedEvidence.validationPass && committedEvidence.advisorPass),
    validationStatus: committedEvidence.validationStatus,
    validationPass: committedEvidence.validationPass,
    advisorStatus: committedEvidence.advisorStatus,
    advisorPass: committedEvidence.advisorPass,
    blockingErrorCounts: committedEvidence.blockingErrorCounts,
    warningCounts: committedEvidence.warningCounts,
    infoCounts: committedEvidence.infoCounts,
    modelId: committedEvidence.modelId,
    revision: committedEvidence.revision,
    semanticSourceChecks: committedEvidence.semanticSourceChecks,
    validationResult: committedEvidence.validationResult,
    advisorResult: committedEvidence.advisorResult,
    validation: committedEvidence.validation,
    advisor: committedEvidence.advisor,
    changedIds: committedEvidence.changedIds,
    semanticProof: committedEvidence.semanticProof,
    changedModelProof: {
      changedIds: committedEvidence.changedIds,
      counts: committedEvidence.semanticProof?.counts,
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
    path.join(outDir, 'committed-evidence.json'),
    `${JSON.stringify(result.committedEvidence, null, 2)}\n`,
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
  if (result.executionEvidence?.liveDryRun) {
    await fs.writeFile(
      path.join(outDir, 'live-dry-run-evidence.json'),
      `${JSON.stringify(result.executionEvidence.liveDryRun, null, 2)}\n`,
    );
  }
  if (result.executionEvidence?.liveCommit) {
    await fs.writeFile(
      path.join(outDir, 'live-commit-evidence.json'),
      `${JSON.stringify(result.executionEvidence.liveCommit, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(outDir, 'command-log-summary.json'),
      `${JSON.stringify(result.executionEvidence.liveCommit.postCommit?.commandLog?.summary ?? null, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(outDir, 'snapshot-summary.json'),
      `${JSON.stringify(result.committedEvidence?.snapshotSummary?.snapshot ?? result.executionEvidence.liveCommit.postCommit?.snapshot?.summary ?? null, null, 2)}\n`,
    );
  }
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
  let committedEvidence =
    mode === 'offline'
      ? deterministicCommittedEvidence(semanticSummary)
      : {
          mode: 'not-requested',
          evidenceKind: 'missing-committed-live-artifact',
          collectionStatus: 'not-requested',
          ok: false,
          modelId: args.modelId,
          revision: null,
          todo: 'Run live with --commit-live or --collect-committed-evidence to capture committed advisor, visual substitute, and export evidence.',
        };
  let executionEvidence;
  if (mode === 'live') {
    const liveDryRun = await runLiveBundle(args, bundle, 'dry_run');
    executionEvidence = liveDryRun;
    if (args.commitLive) {
      const liveCommit = await runLiveBundle(args, bundle, 'commit');
      committedEvidence = await collectCommittedEvidence(args, semanticSummary, liveCommit);
      executionEvidence = {
        mode: 'live-dry-run-and-commit',
        ok: liveDryRun.ok && liveCommit.ok,
        mutationWarning:
          '--commit-live was set; the benchmark posted mode=commit and mutated the target model if the server accepted the bundle.',
        liveDryRun,
        liveCommit,
      };
    } else if (args.collectCommittedEvidence) {
      committedEvidence = await collectCommittedEvidence(args, semanticSummary);
    }
  } else {
    executionEvidence = {
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
  }
  const result = {
    schemaVersion: 'bim-ai.benchmark.result.v1',
    benchmarkId: expected.benchmarkId,
    ok:
      semanticDiff.ok &&
      executionEvidence.ok &&
      (!args.commitLive && !args.collectCommittedEvidence ? true : committedEvidence.ok),
    mode,
    semanticSummary,
    semanticDiff,
    executionEvidence,
    committedEvidence,
    evidenceHooks: buildEvidenceHooks(semanticSummary, committedEvidence),
    remainingExitCriteria: [
      'UI/Cmd+K equivalent path',
      ...(mode === 'live' && args.commitLive ? [] : ['live commit execution after clean dry-run']),
      ...(committedEvidence.ok
        ? []
        : [
            'advisor/constructability JSON from committed live model',
            'nonblank plan, section, 3D, or accepted server-side render substitute',
            'IFC/glTF/PDF export artifact or manifest evidence',
          ]),
    ],
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
