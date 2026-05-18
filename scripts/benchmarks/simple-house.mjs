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
  const pngSignature = '89504e470d0a1a0a';
  if (!Buffer.isBuffer(bytes) || bytes.length < 24) return null;
  if (bytes.subarray(0, 8).toString('hex') !== pngSignature) return null;
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

function normalizeLiveBundleEvidence({ baseUrl, modelId, userId, bundle, response, requestMode }) {
  const endpointPath = `/api/models/${encodeURIComponent(modelId)}/bundles`;
  const body = response.body ?? {};
  const violations = body.violations ?? body.result?.violations ?? [];
  const revision = responseValue(body, ['newRevision', 'revision']);
  const wouldRevision = responseValue(body, ['wouldRevision']);
  return {
    mode: requestMode === 'commit' ? 'live-commit' : 'live-dry-run',
    ok: response.ok && body.ok !== false,
    publicSurface: {
      kind: 'cmd-v3-api',
      method: 'POST',
      endpoint: endpointPath,
      url: `${baseUrl.replace(/\/$/, '')}${endpointPath}`,
      requestMode,
      cliEquivalent: `BIM_AI_BASE_URL=${baseUrl} BIM_AI_MODEL_ID=${modelId} pnpm --dir ${REPO_ROOT} --filter @bim-ai/cli exec bim-ai apply-bundle ${path.relative(
        REPO_ROOT,
        DEFAULT_BUNDLE,
      )} --base <parentRevision> --${requestMode === 'commit' ? 'commit' : 'dry-run'}`,
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
      applied: body.applied ?? body.result?.applied ?? null,
      wouldRevision,
      revision,
      newRevision: responseValue(body, ['newRevision']),
      changedIds: extractChangedIds(body),
      checkpointSnapshotId: responseValue(body, ['checkpointSnapshotId']),
    },
    validation: {
      status: requestMode === 'commit' ? 'live-commit-response' : 'live-dry-run-response',
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
  return normalizeLiveBundleEvidence({
    baseUrl,
    modelId: args.modelId,
    userId: args.userId,
    bundle: liveBundle,
    response,
    requestMode: 'dry_run',
  });
}

async function runLiveCommit(args, bundle) {
  const liveBundle = withParentRevision(bundle, args.parentRevision);
  const baseUrl = args.baseUrl.replace(/\/$/, '');
  const endpointPath = `/api/models/${encodeURIComponent(args.modelId)}/bundles`;
  const response = await postJson(`${baseUrl}${endpointPath}`, {
    bundle: liveBundle,
    mode: 'commit',
    userId: args.userId,
    submitter: 'benchmark-agent',
  });
  const evidence = normalizeLiveBundleEvidence({
    baseUrl,
    modelId: args.modelId,
    userId: args.userId,
    bundle: liveBundle,
    response,
    requestMode: 'commit',
  });

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
  return evidence;
}

function unavailableEvidence(label, response) {
  return {
    status: 'unavailable',
    pass: false,
    httpStatus: response?.status ?? null,
    reason: response?.body?.error ?? `${label} was not returned by the live server.`,
    body: response?.body ?? null,
  };
}

function jsonEvidence(label, response) {
  if (!response?.ok) return unavailableEvidence(label, response);
  return response.body ?? {};
}

function artifactEvidence(label, response) {
  if (!response?.ok) {
    return {
      artifactKind: label,
      status: 'unavailable',
      pass: false,
      httpStatus: response?.status ?? null,
      reason: `${label} was not returned by the live server.`,
    };
  }
  const pdfSignatureOk = label.includes('pdf')
    ? String(response.headerHex ?? '').startsWith('25504446')
    : null;
  const contentTypeOk = label.includes('pdf')
    ? /application\/pdf/i.test(response.contentType ?? '')
    : true;
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

function manifestEvidence(label, response) {
  if (!response?.ok) return unavailableEvidence(label, response);
  const body = response.body ?? {};
  const manifest = manifestProof(label, body);
  return {
    artifactKind: label,
    status: manifest.pass ? 'manifest-returned' : 'invalid-manifest',
    pass: manifest.pass,
    httpStatus: response.status,
    digest: sha256(body),
    summary: manifest.summary,
    body,
  };
}

function countObjectTotal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.values(value).reduce((total, item) => {
    const parsed = Number(item);
    return total + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
}

function manifestProof(label, body) {
  const ids = [
    body?.artifactId,
    body?.id,
    ...(Array.isArray(body?.artifactIds) ? body.artifactIds : []),
    ...(Array.isArray(body?.exportedIds) ? body.exportedIds : []),
  ]
    .filter((id) => id !== undefined && id !== null && String(id).trim() !== '')
    .map(String)
    .sort();
  if (label.includes('gltf')) {
    const ext = body?.extensions?.BIM_AI_exportManifest_v0 ?? body?.BIM_AI_exportManifest_v0 ?? {};
    const countsByKind = ext.countsByKind ?? body?.countsByKind ?? {};
    const exportedGeometryKinds = Array.isArray(ext.exportedGeometryKinds)
      ? ext.exportedGeometryKinds
      : [];
    const closure = ext.gltfExportManifestClosure_v1 ?? {};
    const exportedKindCount = countObjectTotal(countsByKind);
    return {
      pass: Boolean(
        ext &&
        typeof ext === 'object' &&
        (exportedKindCount > 0 ||
          exportedGeometryKinds.length > 0 ||
          closure.gltfExportManifestClosureDigestSha256),
      ),
      summary: {
        manifestKind: 'gltf',
        exportedKindCount,
        exportedGeometryKinds,
        ids,
        closureDigest: closure.gltfExportManifestClosureDigestSha256 ?? null,
      },
    };
  }
  if (label.includes('ifc')) {
    const countsByIfcKind = body?.exportedIfcKindsInArtifact ?? body?.countsByIfcKind ?? {};
    const exportedKindCount = countObjectTotal(countsByIfcKind);
    return {
      pass: Boolean(
        (body?.format || body?.schemaVersion || Object.keys(countsByIfcKind).length > 0) &&
        exportedKindCount > 0,
      ),
      summary: {
        manifestKind: 'ifc',
        exportedKindCount,
        countsByIfcKind,
        ids,
      },
    };
  }
  return {
    pass: Object.keys(body ?? {}).length > 0,
    summary: { manifestKind: label, ids },
  };
}

function numericCount(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function severityOf(issue) {
  return String(issue?.severity ?? issue?.level ?? issue?.kind ?? 'unknown').toLowerCase();
}

function countBySeverity(issues) {
  const counts = {
    totalCount: Array.isArray(issues) ? issues.length : 0,
    errorCount: 0,
    blockingCount: 0,
    warningCount: 0,
    infoCount: 0,
    blockingErrorCount: 0,
  };
  for (const issue of Array.isArray(issues) ? issues : []) {
    const severity = severityOf(issue);
    const isBlockingSeverity = [
      'error',
      'blocking',
      'blocker',
      'critical',
      'fatal',
      'high',
    ].includes(severity);
    const isBlocking = issue?.blocking === true || isBlockingSeverity;
    if (severity === 'error') counts.errorCount += 1;
    if (issue?.blocking === true) counts.blockingCount += 1;
    if (severity === 'warning' || severity === 'warn') counts.warningCount += 1;
    if (severity === 'info' || severity === 'notice') counts.infoCount += 1;
    if (isBlocking) counts.blockingErrorCount += 1;
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

function advisorSeverityCounts(advisor) {
  return advisor?.data?.summary?.severityCounts ?? advisor?.summary?.severityCounts ?? {};
}

function committedValidationResult(response, validation) {
  const issues = validationIssues(validation);
  const counted = countBySeverity(issues);
  const checks = validation?.checks ?? validation?.data?.checks ?? {};
  const errorCount = numericCount(checks.errorViolationCount) ?? counted.errorCount;
  const blockingCount = numericCount(checks.blockingViolationCount) ?? counted.blockingCount;
  const blockingErrorCount = Math.max(counted.blockingErrorCount, errorCount, blockingCount);
  const pass = Boolean(response?.ok && blockingErrorCount === 0);
  return {
    status: response?.ok ? (pass ? 'pass' : 'fail') : 'unavailable',
    pass,
    httpOk: Boolean(response?.ok),
    httpStatus: response?.status ?? null,
    totalCount: issues.length,
    blockingErrorCount,
    errorCount,
    blockingCount,
    warningCount: counted.warningCount,
    infoCount: counted.infoCount,
    source: 'GET /api/models/{model_id}/validate',
  };
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function sourceModelRevision({ args, validation, advisor, snapshot, summary, liveCommitEvidence }) {
  const sourceModelId = firstPresent(
    validation?.modelId,
    validation?.data?.modelId,
    advisor?.modelId,
    advisor?.data?.modelId,
    snapshot?.body?.modelId,
    summary?.body?.modelId,
    args.modelId,
  );
  const sourceRevision = firstPresent(
    validation?.revision,
    validation?.data?.revision,
    advisor?.revision,
    advisor?.data?.revision,
    snapshot?.body?.revision,
    snapshot?.body?.currentRevision,
    summary?.body?.revision,
    summary?.body?.currentRevision,
    liveCommitEvidence?.response?.newRevision,
    liveCommitEvidence?.response?.revision,
  );
  return {
    modelId: sourceModelId,
    revision: sourceRevision,
    requestedModelId: args.modelId,
    hasModelId: Boolean(sourceModelId),
    hasRevision: sourceRevision !== null,
    modelIdMatchesRequest: sourceModelId === null || String(sourceModelId) === String(args.modelId),
  };
}

function committedAdvisorResult(response, advisor) {
  const findings = advisorFindings(advisor);
  const counted = countBySeverity(findings);
  const severityCounts = advisorSeverityCounts(advisor);
  const summary = advisor?.data?.summary ?? advisor?.summary ?? {};
  const errorCount = numericCount(severityCounts.error) ?? counted.errorCount;
  const warningCount =
    numericCount(severityCounts.warning) ??
    numericCount(severityCounts.warn) ??
    counted.warningCount;
  const infoCount =
    numericCount(severityCounts.info) ?? numericCount(severityCounts.notice) ?? counted.infoCount;
  const blockingCount = numericCount(summary.blockingCount) ?? counted.blockingCount;
  const blockingErrorCount = Math.max(counted.blockingErrorCount, errorCount, blockingCount);
  const totalCount = numericCount(summary.findingCount) ?? counted.totalCount;
  const returnedCount = numericCount(summary.returnedCount) ?? findings.length;
  const pass = Boolean(response?.ok && advisor?.ok !== false && blockingErrorCount === 0);
  return {
    status: response?.ok ? (pass ? 'pass' : 'fail') : 'unavailable',
    pass,
    httpOk: Boolean(response?.ok),
    bodyOk: advisor?.ok ?? null,
    httpStatus: response?.status ?? null,
    totalCount,
    returnedCount,
    blockingErrorCount,
    errorCount,
    blockingCount,
    warningCount,
    infoCount,
    source: 'POST /api/models/{model_id}/qa/advisor',
  };
}

function sheetRasterEvidence(response) {
  const pngSignature = '89504e470d0a1a0a';
  if (!response?.ok) {
    return {
      status: 'unavailable',
      pass: false,
      httpStatus: response?.status ?? null,
      reason: 'No deterministic server-side sheet raster substitute was returned.',
    };
  }
  const contract = response.headers['x-bim-ai-sheet-print-raster-contract'] ?? null;
  const widthHeader = numericCount(response.headers['x-bim-ai-sheet-print-raster-width']);
  const heightHeader = numericCount(response.headers['x-bim-ai-sheet-print-raster-height']);
  const widthPx = response.pngDimensions?.widthPx ?? null;
  const heightPx = response.pngDimensions?.heightPx ?? null;
  const pngSignatureOk = response.headerHex === pngSignature;
  const contentTypeOk = /image\/png/i.test(response.contentType ?? '');
  const dimensionHeadersMatch =
    widthHeader === null ||
    heightHeader === null ||
    (widthHeader === widthPx && heightHeader === heightPx);
  const acceptedServerProof = contract === 'sheetPrintRasterPrintSurrogate_v2';
  const placeholderContract = /placeholder|stub/i.test(contract ?? '');
  const dimensionsCredible =
    Number.isFinite(widthPx) && Number.isFinite(heightPx) && widthPx >= 64 && heightPx >= 64;
  const digestHeader = response.headers['x-bim-ai-sheet-print-raster-png-sha256'] ?? null;
  const digestMatchesHeader = digestHeader ? digestHeader === response.sha256 : null;
  const ok = Boolean(
    pngSignatureOk &&
    contentTypeOk &&
    response.byteLength > 256 &&
    dimensionsCredible &&
    dimensionHeadersMatch &&
    acceptedServerProof &&
    !placeholderContract &&
    digestMatchesHeader !== false,
  );
  return {
    status: ok ? 'server-side-substitute' : 'invalid',
    pass: ok,
    substituteKind: 'deterministic-sheet-print-raster',
    explicitLimitation:
      response.headers['x-bim-ai-sheet-print-raster-full-raster-status'] ??
      'server-side substitute; not a browser screenshot',
    contentType: response.contentType,
    byteLength: response.byteLength,
    sha256: response.sha256,
    contentTypeOk,
    pngSignatureOk,
    dimensionsCredible,
    dimensionHeadersMatch,
    digestMatchesHeader,
    nonblankProof: {
      method: 'png-ihdr-dimensions-byte-length-and-print-surrogate-contract',
      ok,
    },
    contract,
    acceptedContracts: ['sheetPrintRasterPrintSurrogate_v2'],
    rejectedContract: placeholderContract ? contract : null,
    widthPx,
    heightPx,
    declaredWidthPx: widthHeader,
    declaredHeightPx: heightHeader,
  };
}

async function collectCommittedEvidence(args, liveCommitEvidence = null) {
  const baseUrl = args.baseUrl.replace(/\/$/, '');
  const modelPath = `/api/models/${encodeURIComponent(args.modelId)}`;
  const sheetId = 'ssh-sheet-a101';
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
    summary,
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
  const advisor = await postJson(urls.advisor, {
    scope: 'committed-model',
    benchmarkId: 'simple-single-storey-house',
  }).catch((error) => ({ ok: false, status: null, body: { error: error.message } }));

  const validation = jsonEvidence('committed validation', validate);
  const advisorBody = jsonEvidence('committed advisor', advisor);
  const validationResult = committedValidationResult(validate, validation);
  const advisorResult = committedAdvisorResult(advisor, advisorBody);
  const evidencePackageBody = jsonEvidence('evidence package', evidencePackage);
  const source = sourceModelRevision({
    args,
    validation,
    advisor: advisorBody,
    snapshot,
    summary,
    liveCommitEvidence,
  });
  const sourcePass = Boolean(
    source.hasModelId && source.hasRevision && source.modelIdMatchesRequest,
  );
  const validationPass = Boolean(validationResult.pass && sourcePass);
  const advisorPass = Boolean(advisorResult.pass && sourcePass);
  const sheetPrintRaster = sheetRasterEvidence(sheetRaster);
  const visual = {
    status:
      sheetPrintRaster.status === 'server-side-substitute'
        ? 'server-side-substitute'
        : sheetPrintRaster.status,
    pass: sheetPrintRaster.pass === true,
    requiredViewIds: ['ssh-view-ground-plan', 'ssh-view-3d'],
    evidencePackageVisualHints: {
      deterministicPlanViewEvidence: evidencePackageBody.deterministicPlanViewEvidence ?? null,
      deterministic3dViewEvidence: evidencePackageBody.deterministic3dViewEvidence ?? null,
      deterministicSheetEvidence: evidencePackageBody.deterministicSheetEvidence ?? null,
      recommendedPngEvidenceBackend: evidencePackageBody.recommendedPngEvidenceBackend ?? null,
      svgRasterBackendAvailable: evidencePackageBody.svgRasterBackendAvailable ?? null,
    },
    sheetPrintRaster,
  };
  const exportManifests = {
    gltf: manifestEvidence('gltf-manifest', gltfManifest),
    ifc: manifestEvidence('ifc-manifest', ifcManifest),
  };
  const exportArtifacts = {
    sheetPdf: artifactEvidence('sheet-preview-pdf', sheetPdf),
  };
  const exportPass = Boolean(
    exportManifests.gltf.pass || exportManifests.ifc.pass || exportArtifacts.sheetPdf.pass,
  );
  const exports = {
    status: exportPass
      ? 'artifact-or-manifest-returned'
      : gltfManifest?.ok || ifcManifest?.ok || sheetPdf?.ok
        ? 'invalid'
        : 'unavailable',
    pass: exportPass,
    manifests: exportManifests,
    artifacts: exportArtifacts,
  };
  const visualOk = visual.pass === true;
  const exportOk = exports.pass === true;

  return {
    mode: liveCommitEvidence ? 'post-commit-live' : 'committed-model-live',
    evidenceKind: 'committed-live-artifact',
    collectionStatus: sourcePass ? 'captured' : 'missing-source-model-revision',
    ok: Boolean(validationPass && advisorPass && visualOk && exportOk),
    validationStatus: validationResult.status,
    validationPass,
    advisorStatus: advisorResult.status,
    advisorPass,
    blockingErrorCounts: {
      validation: validationResult.blockingErrorCount,
      advisor: advisorResult.blockingErrorCount,
    },
    warningCounts: {
      validation: validationResult.warningCount,
      advisor: advisorResult.warningCount,
    },
    infoCounts: {
      validation: validationResult.infoCount,
      advisor: advisorResult.infoCount,
    },
    modelId: args.modelId,
    revision: source.revision,
    source,
    preflight: {
      sourceModelRevisionPresent: sourcePass,
      liveAdvisorValidationCaptured: Boolean(validate?.ok && advisor?.ok),
      validationEndpointOk: Boolean(validate?.ok),
      advisorEndpointOk: Boolean(advisor?.ok),
    },
    commandLog: {
      status: liveCommitEvidence?.postCommit?.commandLog?.ok
        ? 'public-command-log'
        : liveCommitEvidence?.response?.changedIds?.length
          ? 'commit-response-changed-ids'
          : 'unavailable',
      summary: liveCommitEvidence?.postCommit?.commandLog?.summary ?? null,
      changedIds: liveCommitEvidence?.response?.changedIds ?? [],
      note: liveCommitEvidence?.postCommit?.commandLog?.ok
        ? 'Command-log summary was collected from the public command-log endpoint.'
        : 'No public command-log response was available; commit response changed ids and snapshot summary are the fallback.',
    },
    snapshotSummary: {
      snapshot: summarizeSnapshot(snapshot.body),
      summary: summary.body ?? null,
    },
    validation,
    validationResult,
    advisor: advisorBody,
    advisorResult,
    evidencePackage: evidencePackageBody,
    visual,
    exports,
    publicSurfaces: urls,
    remainingConfidenceGaps: [
      'Browser-rendered plan and 3D screenshots are not captured by this server-side helper.',
      'Export confidence checks artifact/manifest presence; it does not round-trip IFC/glTF geometry.',
    ],
  };
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

function missingCommittedAdvisorValidationArtifact(result) {
  return {
    evidenceKind: 'missing-committed-live-artifact',
    mode: result.committedEvidence?.mode ?? 'not-requested',
    collectionStatus: result.committedEvidence?.collectionStatus ?? 'not-requested',
    ok: false,
    validationStatus: result.committedEvidence?.validationStatus ?? 'not-captured',
    validationPass: false,
    advisorStatus: result.committedEvidence?.advisorStatus ?? 'not-captured',
    advisorPass: false,
    blockingErrorCounts: result.committedEvidence?.blockingErrorCounts ?? {
      validation: null,
      advisor: null,
    },
    warningCounts: result.committedEvidence?.warningCounts ?? {
      validation: null,
      advisor: null,
    },
    infoCounts: result.committedEvidence?.infoCounts ?? {
      validation: null,
      advisor: null,
    },
    modelId: result.committedEvidence?.modelId ?? null,
    revision: result.committedEvidence?.revision ?? null,
    source: result.committedEvidence?.source ?? null,
    preflight: {
      sourceModelRevisionPresent: false,
      liveAdvisorValidationCaptured: false,
      reason:
        result.committedEvidence?.preflight?.reason ??
        result.committedEvidence?.todo ??
        'Run live with --commit-live or --collect-committed-evidence to capture committed advisor/validation evidence.',
    },
    validationResult: result.committedEvidence?.validationResult ?? null,
    advisorResult: result.committedEvidence?.advisorResult ?? null,
    validation: null,
    advisor: null,
  };
}

function advisorValidationArtifact(result) {
  if (
    result.committedEvidence?.evidenceKind === 'committed-live-artifact' ||
    /committed|post[-_\s]?commit/i.test(String(result.committedEvidence?.mode ?? ''))
  ) {
    return {
      evidenceKind: 'committed-advisor-validation',
      mode: result.committedEvidence.mode,
      collectionStatus: result.committedEvidence.collectionStatus ?? null,
      ok: Boolean(result.committedEvidence.validationPass && result.committedEvidence.advisorPass),
      validationStatus: result.committedEvidence.validationStatus ?? null,
      validationPass: result.committedEvidence.validationPass ?? false,
      advisorStatus: result.committedEvidence.advisorStatus ?? null,
      advisorPass: result.committedEvidence.advisorPass ?? false,
      blockingErrorCounts: result.committedEvidence.blockingErrorCounts ?? null,
      warningCounts: result.committedEvidence.warningCounts ?? null,
      infoCounts: result.committedEvidence.infoCounts ?? null,
      modelId: result.committedEvidence.modelId ?? null,
      revision: result.committedEvidence.revision ?? null,
      source: result.committedEvidence.source ?? null,
      preflight: result.committedEvidence.preflight ?? null,
      validationResult: result.committedEvidence.validationResult ?? null,
      advisorResult: result.committedEvidence.advisorResult ?? null,
      validation: result.committedEvidence.validation ?? null,
      advisor: result.committedEvidence.advisor ?? null,
    };
  }
  return missingCommittedAdvisorValidationArtifact(result);
}

function visualEvidenceArtifact(result) {
  if (result.committedEvidence?.visual) return result.committedEvidence.visual;
  return {
    status: 'unavailable',
    pass: false,
    reason:
      result.committedEvidence?.todo ??
      'Committed visual/render evidence was not collected. Run live with --commit-live or --collect-committed-evidence against a committed target.',
    requiredViewIds: ['ssh-view-ground-plan', 'ssh-view-3d'],
    sheetPrintRaster: {
      status: 'unavailable',
      pass: false,
      reason: 'No server-side sheet raster artifact was requested or returned.',
    },
  };
}

function exportEvidenceArtifact(result) {
  if (result.committedEvidence?.exports) return result.committedEvidence.exports;
  return {
    status: 'unavailable',
    pass: false,
    reason:
      result.committedEvidence?.todo ??
      'Committed export evidence was not collected. Run live with --commit-live or --collect-committed-evidence against a committed target.',
    manifests: {
      gltf: { artifactKind: 'gltf-manifest', status: 'unavailable', pass: false },
      ifc: { artifactKind: 'ifc-manifest', status: 'unavailable', pass: false },
    },
    artifacts: {
      sheetPdf: { artifactKind: 'sheet-preview-pdf', status: 'unavailable', pass: false },
    },
  };
}

async function writeEvidence(outDir, result) {
  if (!outDir) return;
  await fs.mkdir(outDir, { recursive: true });
  const writes = [
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
      path.join(outDir, 'committed-evidence.json'),
      `${JSON.stringify(result.committedEvidence, null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(outDir, 'advisor-validation.json'),
      `${JSON.stringify(advisorValidationArtifact(result), null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(outDir, 'visual-evidence.json'),
      `${JSON.stringify(visualEvidenceArtifact(result), null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(outDir, 'export-evidence.json'),
      `${JSON.stringify(exportEvidenceArtifact(result), null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(outDir, 'benchmark-result.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    ),
  ];
  if (result.executionEvidence?.liveDryRun) {
    writes.push(
      fs.writeFile(
        path.join(outDir, 'live-dry-run-evidence.json'),
        `${JSON.stringify(result.executionEvidence.liveDryRun, null, 2)}\n`,
      ),
    );
  }
  if (result.executionEvidence?.liveCommit) {
    writes.push(
      fs.writeFile(
        path.join(outDir, 'live-commit-evidence.json'),
        `${JSON.stringify(result.executionEvidence.liveCommit, null, 2)}\n`,
      ),
      fs.writeFile(
        path.join(outDir, 'command-log-summary.json'),
        `${JSON.stringify(result.executionEvidence.liveCommit.postCommit?.commandLog?.summary ?? null, null, 2)}\n`,
      ),
      fs.writeFile(
        path.join(outDir, 'snapshot-summary.json'),
        `${JSON.stringify(
          result.committedEvidence?.snapshotSummary?.snapshot ??
            result.executionEvidence.liveCommit.postCommit?.snapshot?.summary ??
            null,
          null,
          2,
        )}\n`,
      ),
    );
  }
  await Promise.all(writes);
}

export async function runBenchmark(rawArgs = []) {
  const args = parseArgs(rawArgs);
  const [bundle, expected] = await Promise.all([readJson(args.bundle), readJson(args.expected)]);
  const summary = summarize(bundle, expected);
  const semanticDiff = diffSummary(summary, expected);
  let executionEvidence = buildOfflineExecutionEvidence(bundle, summary);
  let committedEvidence = {
    mode: 'not-requested',
    evidenceKind: 'missing-committed-live-artifact',
    collectionStatus: 'not-requested',
    ok: false,
    validationStatus: 'not-captured',
    validationPass: false,
    advisorStatus: 'not-captured',
    advisorPass: false,
    blockingErrorCounts: { validation: null, advisor: null },
    warningCounts: { validation: null, advisor: null },
    infoCounts: { validation: null, advisor: null },
    modelId: args.modelId,
    revision: null,
    source: null,
    preflight: {
      sourceModelRevisionPresent: false,
      liveAdvisorValidationCaptured: false,
      reason: 'Committed evidence collection was not requested.',
    },
    todo: 'Run live with --commit-live or --collect-committed-evidence to capture committed advisor, visual substitute, and export evidence.',
  };
  if (shouldRunLive(args)) {
    if (!args.baseUrl || !args.modelId) {
      throw new Error(
        '--mode live requires --base-url/--model-id or BIM_AI_BASE_URL/BIM_AI_MODEL_ID.',
      );
    }
    const liveDryRun = await runLiveDryRun(args, bundle);
    executionEvidence = liveDryRun;
    if (args.commitLive) {
      const liveCommit = await runLiveCommit(args, bundle);
      committedEvidence = await collectCommittedEvidence(args, liveCommit);
      executionEvidence = {
        mode: 'live-dry-run-and-commit',
        ok: liveDryRun.ok && liveCommit.ok,
        mutationWarning:
          '--commit-live was set; the benchmark posted mode=commit and mutated the target model if the server accepted the bundle.',
        liveDryRun,
        liveCommit,
      };
    } else if (args.collectCommittedEvidence) {
      committedEvidence = await collectCommittedEvidence(args);
    }
  }
  const result = {
    benchmarkId: expected.benchmarkId,
    path: 'mcp-cli',
    ok:
      semanticDiff.length === 0 &&
      executionEvidence.ok &&
      (!args.commitLive && !args.collectCommittedEvidence ? true : committedEvidence.ok),
    summary,
    semanticDiff,
    executionEvidence,
    committedEvidence,
    uiEquivalentTodos: uiEquivalentTodos(),
    remainingExitCriteria: [
      'UI/Cmd+K equivalent path',
      ...(args.commitLive
        ? []
        : ['live commit execution through typed MCP/CLI surface after dry-run is clean']),
      ...(committedEvidence.ok
        ? []
        : [
            'advisor/constructability JSON from committed live model',
            'nonblank plan and 3D screenshots or accepted server-side render substitute',
            'IFC/glTF/PDF export artifact or manifest evidence',
          ]),
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
