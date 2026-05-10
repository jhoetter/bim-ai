#!/usr/bin/env node
/**
 * BIM AI CLI — agent-facing workflows + snapshot transport.
 * Node 20+ (fetch + WebSocket).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { stdin } from 'node:process';
import { execSync } from 'node:child_process';

import { buildOneFamilyHomeCommands } from './lib/one-family-home-commands.mjs';
import {
  DEFAULT_CAPABILITY_MATRIX_PATH,
  INITIATION_MODES,
  readJsonFile,
  writeInitiationPacket,
} from './lib/sketch-initiation.mjs';
import {
  buildVisualGateReport,
  comparePngFiles,
  readTargetMap,
} from './lib/png-visual-gate.mjs';
import { compileSeedDsl } from './lib/seed-dsl.mjs';

const base = (
  process.env.BIM_AI_BASE_URL ?? process.env.BIM_AI_API_ROOT ?? 'http://127.0.0.1:8500'
).replace(/\/$/, '');

function slurpStdin() {
  return new Promise((resolve, reject) => {
    let d = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (c) => {
      d += c;
    });
    stdin.on('end', () => resolve(d));
    stdin.on('error', reject);
  });
}

async function readPayloadOrStdin(pathArg) {
  if (pathArg && pathArg !== '-') {
    return fs.readFile(pathArg, 'utf8');
  }
  if (stdin.isTTY) {
    console.error('Pass a JSON file path, or pipe JSON on stdin (use - for explicit stdin).');
    process.exit(1);
  }
  return slurpStdin();
}

function commandsFromBundleJson(blob) {
  if (Array.isArray(blob)) return blob;
  if (blob && typeof blob === 'object' && Array.isArray(blob.commands)) return blob.commands;
  console.error('Bundle must be a JSON array or { "commands": [...] }.');
  process.exit(1);
}

function wsUrl(modelId) {
  const u = new URL(base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = `/ws/${encodeURIComponent(modelId)}`;
  u.search = '';
  return u.href;
}

async function fetchJson(method, url, bodyObj) {
  const res = await fetch(url, {
    method,
    headers: bodyObj ? { 'content-type': 'application/json' } : undefined,
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, body: json }, null, 2));
    process.exit(1);
  }
  return json;
}

async function fetchOkText(method, url) {
  const res = await fetch(url, {
    method,
    headers: { accept: 'model/gltf+json,application/json,text/plain;q=0.9,*/*;q=0.1' },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, sample: text.slice(0, 2000) }, null, 2));
    process.exit(1);
  }
  return text;
}

async function fetchOkBytes(method, url) {
  const res = await fetch(url, {
    method,
    headers: {
      accept:
        'application/octet-stream,model/gltf-binary,*/*;q=0.8',
    },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, bytes: buf.length }, null, 2));
    process.exit(1);
  }
  return buf;
}

async function snapshot(modelId) {
  const json = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  console.log(JSON.stringify(json, null, 2));
}

function advisoryCode(v) {
  return v?.advisoryClass ?? v?.ruleId ?? v?.code ?? 'unknown';
}

async function advisorSummary(modelId, { severity = null } = {}) {
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  let violations = Array.isArray(snap.violations) ? snap.violations : [];
  if (severity) violations = violations.filter((v) => String(v?.severity ?? '') === severity);

  const groups = new Map();
  for (const v of violations) {
    const code = advisoryCode(v);
    const key = `${v?.severity ?? 'unknown'}:${code}`;
    const row = groups.get(key) ?? {
      severity: v?.severity ?? 'unknown',
      code,
      count: 0,
      elementIds: new Set(),
      messages: new Set(),
    };
    row.count += 1;
    for (const id of v?.elementIds ?? []) row.elementIds.add(id);
    if (v?.message) row.messages.add(v.message);
    groups.set(key, row);
  }
  const grouped = [...groups.values()]
    .map((g) => ({
      severity: g.severity,
      code: g.code,
      count: g.count,
      elementIds: [...g.elementIds].sort(),
      messages: [...g.messages].slice(0, 3),
    }))
    .sort((a, b) => {
      const rank = { error: 0, warning: 1, info: 2 };
      return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.code.localeCompare(b.code);
    });

  return {
    modelId: snap.modelId,
    revision: snap.revision,
    total: violations.length,
    groups: grouped,
  };
}

async function cmdAdvisor(modelId, { output = 'text', severity = null } = {}) {
  const summary = await advisorSummary(modelId, { severity });

  if (output === 'json') {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`advisor model=${summary.modelId} revision=${summary.revision} findings=${summary.total}`);
  for (const g of summary.groups) {
    const ids = g.elementIds.length ? ` ids=${g.elementIds.join(',')}` : '';
    console.log(`${g.severity}\t${g.code}\t${g.count}${ids}`);
    for (const msg of g.messages) console.log(`  ${msg}`);
  }
}

// FED-01 polish: federation subcommands.

function parseAlignMode(s, fallback = 'origin_to_origin') {
  if (s === 'origin_to_origin' || s === 'project_origin' || s === 'shared_coords') return s;
  if (s == null) return fallback;
  console.error(
    `Unknown --align value: '${s}'. Use origin_to_origin | project_origin | shared_coords.`,
  );
  process.exit(1);
}

function parsePosTriple(s) {
  if (!s) {
    console.error('--pos x,y,z required');
    process.exit(1);
  }
  const parts = String(s)
    .split(',')
    .map((t) => Number(t.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    console.error(`Invalid --pos value: '${s}'. Expected three comma-separated numbers (mm).`);
    process.exit(1);
  }
  return { xMm: parts[0], yMm: parts[1], zMm: parts[2] };
}

async function cmdLinkCreate(modelId, userId, sourceUuid, posTriple, alignMode, name, vis) {
  if (!sourceUuid) {
    console.error('link requires --source <uuid>');
    process.exit(1);
  }
  const command = {
    type: 'createLinkModel',
    sourceModelId: sourceUuid,
    positionMm: posTriple,
    rotationDeg: 0,
    originAlignmentMode: alignMode,
    visibilityMode: vis,
  };
  if (name) command.name = name;
  await postCommand(modelId, userId, command);
}

async function cmdUnlink(modelId, userId, linkId) {
  if (!linkId) {
    console.error('unlink requires <link_id>');
    process.exit(1);
  }
  await postCommand(modelId, userId, { type: 'deleteLinkModel', linkId });
}

async function cmdLinksList(modelId) {
  const snap = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`,
  );
  const els = snap.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const sourceRevisions =
    snap.linkSourceRevisions && typeof snap.linkSourceRevisions === 'object'
      ? snap.linkSourceRevisions
      : {};
  const rows = [];
  for (const id of Object.keys(els)) {
    const row = els[id];
    if (row && typeof row === 'object' && row.kind === 'link_model') {
      const pinnedRev =
        typeof row.sourceModelRevision === 'number' ? row.sourceModelRevision : null;
      const currentRev =
        typeof sourceRevisions[row.sourceModelId] === 'number'
          ? sourceRevisions[row.sourceModelId]
          : null;
      const drift =
        pinnedRev != null && currentRev != null ? Math.max(0, currentRev - pinnedRev) : 0;
      rows.push({
        linkId: id,
        name: row.name ?? null,
        sourceModelId: row.sourceModelId ?? null,
        positionMm: row.positionMm ?? null,
        originAlignmentMode: row.originAlignmentMode ?? 'origin_to_origin',
        visibilityMode: row.visibilityMode ?? 'host_view',
        hidden: !!row.hidden,
        pinned: pinnedRev != null,
        pinnedRevision: pinnedRev,
        currentSourceRevision: currentRev,
        driftCount: drift,
      });
    }
  }
  console.log(JSON.stringify({ modelId, links: rows }, null, 2));
}

async function postCommand(modelId, userId, command) {
  const json = await fetchJson(
    'POST',
    `${base}/api/models/${encodeURIComponent(modelId)}/commands`,
    { command, userId },
  );
  console.log(JSON.stringify(json, null, 2));
}

async function postBundle(modelId, userId, commands) {
  const json = await fetchJson(
    'POST',
    `${base}/api/models/${encodeURIComponent(modelId)}/commands/bundle`,
    { commands, userId },
  );
  console.log(JSON.stringify(json, null, 2));
}

async function dryRunCommand(modelId, userId, command) {
  const json = await fetchJson(
    'POST',
    `${base}/api/models/${encodeURIComponent(modelId)}/commands/dry-run`,
    { command, userId },
  );
  console.log(JSON.stringify(json, null, 2));
}

async function dryRunBundle(modelId, userId, commands) {
  const json = await fetchJson(
    'POST',
    `${base}/api/models/${encodeURIComponent(modelId)}/commands/bundle/dry-run`,
    { commands, userId },
  );
  console.log(JSON.stringify(json, null, 2));
}

async function cmdSchema() {
  const json = await fetchJson('GET', `${base}/api/schema`);
  console.log(JSON.stringify(json, null, 2));
}

async function cmdPresets() {
  const schema = await fetchJson('GET', `${base}/api/schema`);
  const bp = await fetchJson('GET', `${base}/api/building-presets`);
  console.log(
    JSON.stringify(
      {
        schemaVersion: schema.version,
        buildingPresetIds: schema.buildingPresetIds,
        perspectiveIds: schema.perspectiveIds ?? [],
        workspaceLayoutPresetIds: schema.workspaceLayoutPresetIds ?? [],
        presetsDetailKeys: bp.presets ? Object.keys(bp.presets) : [],
      },
      null,
      2,
    ),
  );
}

async function cmdSummary(modelId) {
  const json = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/summary`);
  console.log(JSON.stringify(json, null, 2));
}

async function cmdValidate(modelId) {
  const json = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/validate`);
  console.log(JSON.stringify(json, null, 2));
}

async function cmdEvidence(modelId) {
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const val = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/validate`);
  const els = snap.elements && typeof snap.elements === 'object' ? snap.elements : {};
  /** @type {Record<string, number>} */
  const counts = {};
  for (const id of Object.keys(els)) {
    const row = els[id];
    const k =
      row && typeof row === 'object' && typeof row.kind === 'string'
        ? row.kind
        : '?';
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const out = {
    generatedAt: new Date().toISOString(),
    modelId,
    revision: snap.revision,
    elementCount: Object.keys(els).length,
    countsByKind: counts,
    validate: val,
  };
  console.log(JSON.stringify(out, null, 2));
}

async function cmdEvidencePackage(modelId) {
  const json = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/evidence-package`,
  );
  console.log(JSON.stringify(json, null, 2));
}

async function cmdScheduleTable(modelId, scheduleId, wantCsv, columnsList) {
  const parts = [];
  if (wantCsv) parts.push('format=csv');
  if (columnsList && String(columnsList).trim()) parts.push(`columns=${encodeURIComponent(columnsList)}`);
  const qs = parts.length ? `?${parts.join('&')}` : '';
  const url = `${base}/api/models/${encodeURIComponent(modelId)}/schedules/${encodeURIComponent(scheduleId)}/table${qs}`;
  const res = await fetch(url);
  const text = await res.text();

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }

  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, body: json ?? text }, null, 2));

    process.exit(1);
  }

  if (wantCsv) console.log(text);
  else console.log(JSON.stringify(json ?? { raw: text }, null, 2));
}

async function cmdExportManifests(modelId) {
  const gltf = await fetchJson(
    'GET',

    `${base}/api/models/${encodeURIComponent(modelId)}/exports/gltf-manifest`,
  );

  const ifc = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/exports/ifc-manifest`);
  console.log(JSON.stringify({ gltf, ifc }, null, 2));
}

async function cmdBootstrapCli() {
  const json = await fetchJson('GET', `${base}/api/bootstrap`);
  console.log(JSON.stringify(json, null, 2));
}

async function cmdInitModel(projectId, slug, templateId) {
  const body = templateId ? { slug, templateId } : { slug };
  const json = await fetchJson(
    'POST',
    `${base}/api/projects/${encodeURIComponent(projectId)}/models`,
    body,
  );
  console.log(JSON.stringify(json, null, 2));
}

async function cmdListTemplates() {
  const json = await fetchJson('GET', `${base}/api/templates`);
  console.log(JSON.stringify(json, null, 2));
}

async function cmdCommandLog(modelId, limit) {
  const q = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : '';
  const json = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/command-log${q}`,
  );
  console.log(JSON.stringify(json, null, 2));
}

function validateHouseBrief(blob) {
  const errors = [];
  if (!blob || typeof blob !== 'object') {
    errors.push('brief must be a JSON object');
    return errors;
  }
  if (typeof blob.version !== 'string') errors.push('version (string)');
  if (blob.stylePreset != null && typeof blob.stylePreset !== 'string')
    errors.push('stylePreset (optional string)');
  if (!Number.isFinite(blob.siteWidthM)) errors.push('siteWidthM (number)');
  if (!Number.isFinite(blob.siteDepthM)) errors.push('siteDepthM (number)');
  const floors = blob.floors;
  if (!Number.isInteger(floors) || floors < 1) errors.push('floors (int >= 1)');
  const rooms = blob.rooms;
  if (!Array.isArray(rooms) || rooms.length === 0) errors.push('rooms (non-empty array)');
  else {
    rooms.forEach((r, i) => {
      if (!r || typeof r !== 'object') errors.push(`rooms[${i}] object`);
      else {
        if (typeof r.name !== 'string') errors.push(`rooms[${i}].name`);
        if (!Number.isFinite(r.areaTargetM2)) errors.push(`rooms[${i}].areaTargetM2`);
      }
    });
  }
  return errors;
}

function briefToHouseStarterBundle(brief, modelIdPlaceholder) {
  const commands = buildOneFamilyHomeCommands();
  return {
    meta: {
      generatedBy: '@bim-ai/cli plan-house',
      modelIdPlaceholder,
      note:
        'Fixed one-family footprint (shared with scripts/apply-one-family-home.mjs). Use on empty model — do not prepend deleteElements when applying to a seeded demo.',
      brief,
    },
    commands,
  };
}

async function cmdPlanHouse(briefPath, outPath, modelHint) {
  const raw = (await fs.readFile(briefPath, 'utf8')).trim();
  let brief;
  try {
    brief = JSON.parse(raw);
  } catch {
    console.error(`Invalid JSON: ${briefPath}`);
    process.exit(1);
  }
  const err = validateHouseBrief(brief);
  if (err.length) {
    console.error(JSON.stringify({ ok: false, errors: err }, null, 2));
    process.exit(1);
  }
  const bundle = briefToHouseStarterBundle(brief, modelHint ?? '${BIM_AI_MODEL_ID}');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, out: outPath, commandCount: bundle.commands.length }, null, 2));
}

async function cmdSeedDslCompile(recipePath, outPath, modelHint) {
  const recipe = await readJsonFile(recipePath);
  const bundle = compileSeedDsl(recipe, { modelHint });
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    out: outPath,
    schemaVersion: bundle.schemaVersion,
    commandCount: bundle.commands.length,
  }, null, 2));
}

async function cmdInitiationGolden(manifestPath, outDir) {
  const manifest = await readJsonFile(manifestPath);
  if (manifest.schemaVersion !== 'sketch-to-bim-golden-suite.v0' || !Array.isArray(manifest.cases)) {
    throw new Error('Golden manifest must be sketch-to-bim-golden-suite.v0 with cases[].');
  }
  await fs.mkdir(outDir, { recursive: true });
  const rows = [];
  for (const [index, goldenCase] of manifest.cases.entries()) {
    const id = safeArtifactName(goldenCase.id ?? `case-${index + 1}`);
    const caseDir = path.join(outDir, id);
    const irPath = goldenCase.ir;
    const capabilityPath = goldenCase.capabilities ?? DEFAULT_CAPABILITY_MATRIX_PATH;
    const ir = applyQualityMode(await readJsonFile(irPath), goldenCase.mode);
    const matrix = await readJsonFile(capabilityPath);
    let compiledBundle = null;
    if (goldenCase.seedDslRecipe) {
      compiledBundle = compileSeedDsl(await readJsonFile(goldenCase.seedDslRecipe), {
        modelHint: goldenCase.modelHint,
      });
      await writeJsonArtifact(path.join(caseDir, 'compiled-seed-bundle.json'), compiledBundle);
    }
    const result = await writeInitiationPacket({
      ir,
      matrix,
      outDir: caseDir,
      irPath,
      capabilityMatrixPath: capabilityPath,
      modelId: goldenCase.modelId ?? null,
      evidenceRun: {
        acceptanceScope: 'preflight',
        goldenCaseId: id,
        compiledBundleCommandCount: compiledBundle?.commands?.length ?? null,
      },
    });
    const expected = goldenCase.expected ?? {};
    const maxErrors = Number.isFinite(expected.maxCoverageErrors) ? expected.maxCoverageErrors : 0;
    const maxBlocked = Number.isFinite(expected.maxBlockedFeatures) ? expected.maxBlockedFeatures : 0;
    const pass = (
      result.summary.errorCount <= maxErrors &&
      result.summary.blockedCount <= maxBlocked
    );
    rows.push({
      id,
      irPath,
      capabilityPath,
      outDir: caseDir,
      pass,
      coverageOk: result.ok,
      acceptanceOk: result.acceptance?.ok ?? null,
      commandCount: compiledBundle?.commands?.length ?? null,
      summary: result.summary,
    });
  }
  const summary = {
    schemaVersion: 'sketch-to-bim-golden-suite-result.v0',
    generatedAt: new Date().toISOString(),
    manifestPath,
    caseCount: rows.length,
    passCount: rows.filter((row) => row.pass).length,
    failCount: rows.filter((row) => !row.pass).length,
    cases: rows,
  };
  await writeJsonArtifact(path.join(outDir, 'golden-summary.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failCount > 0) process.exit(2);
}

function applyQualityMode(ir, qualityMode) {
  if (!qualityMode) return ir;
  if (!INITIATION_MODES[qualityMode]) {
    console.error(`Unknown initiation mode '${qualityMode}'. Use: ${Object.keys(INITIATION_MODES).join(', ')}`);
    process.exit(1);
  }
  return { ...ir, qualityTarget: qualityMode };
}

async function cmdInitiationModes() {
  console.log(JSON.stringify({ schemaVersion: 'sketch-to-bim-initiation-modes.v0', modes: INITIATION_MODES }, null, 2));
}

async function cmdInitiationCheck(irPath, capabilityMatrixPath, outDir, modelId, live, qualityMode, failOnAcceptance) {
  const ir = applyQualityMode(await readJsonFile(irPath), qualityMode);
  const matrix = await readJsonFile(capabilityMatrixPath);
  let liveAdvisor = null;
  if (live) {
    if (!modelId) {
      console.error('initiation-check --live requires --model <id> or BIM_AI_MODEL_ID.');
      process.exit(1);
    }
    liveAdvisor = {
      warning: await advisorSummary(modelId, { severity: 'warning' }),
      info: await advisorSummary(modelId, { severity: 'info' }),
    };
  }
  const result = await writeInitiationPacket({
    ir,
    matrix,
    outDir,
    irPath,
    capabilityMatrixPath,
    modelId: modelId ?? null,
    liveAdvisor,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(2);
  if (failOnAcceptance && result.acceptance?.ok === false) process.exit(5);
}

function safeArtifactName(value) {
  return String(value || 'view')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'view';
}

function modelStatsFromSnapshot(snap) {
  const elements = snap?.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const countsByKind = {};
  for (const element of Object.values(elements)) {
    const kind = element && typeof element === 'object' && typeof element.kind === 'string'
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
    : (await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`)).revision;
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

async function writeLiveEvidenceArtifacts(modelId, outDir) {
  const liveDir = path.join(outDir, 'live');
  await fs.mkdir(liveDir, { recursive: true });
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const validate = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/validate`);
  const evidencePackage = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/evidence-package`,
  );
  const liveAdvisor = {
    warning: await advisorSummary(modelId, { severity: 'warning' }),
    info: await advisorSummary(modelId, { severity: 'info' }),
  };
  const modelStats = modelStatsFromSnapshot(snap);
  const liveArtifacts = {
    snapshot: await writeJsonArtifact(path.join(liveDir, 'snapshot.json'), snap),
    validate: await writeJsonArtifact(path.join(liveDir, 'validate.json'), validate),
    evidencePackage: await writeJsonArtifact(
      path.join(liveDir, 'evidence-package.json'),
      evidencePackage,
    ),
    advisorWarning: await writeJsonArtifact(
      path.join(liveDir, 'advisor-warning.json'),
      liveAdvisor.warning,
    ),
    advisorInfo: await writeJsonArtifact(path.join(liveDir, 'advisor-info.json'), liveAdvisor.info),
    modelStats: await writeJsonArtifact(path.join(liveDir, 'model-stats.json'), modelStats),
  };
  return { snap, validate, evidencePackage, liveAdvisor, modelStats, liveArtifacts };
}

function screenshotRequiredViews(ir) {
  const supportedKinds = new Set(['3d', 'elevation', 'diagnostic', 'plan', 'floor_plan', 'section']);
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

async function snapshotPathForView({ view, snap, baseSnapshotPath, screenshotDir, hasSavedViewpoint, bounds }) {
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

  const live = await writeLiveEvidenceArtifacts(modelId, outDir);
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
    liveArtifacts: { ...runArtifacts, ...live.liveArtifacts },
    modelStats: live.modelStats,
    screenshotManifest,
    visualGateReport,
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
  if (!result.ok) process.exit(2);
  if (failOnWarning && (live.liveAdvisor.warning?.total ?? 0) > 0) process.exit(3);
  if (failOnVisual && (visualGateReport?.summary?.failCount ?? 0) > 0) process.exit(4);
  if (failOnAcceptance && result.acceptance?.ok === false) process.exit(5);
}

async function cmdInitiationCompare(actualPath, targetPath, outPath, threshold) {
  if (!actualPath || !targetPath) {
    console.error('initiation-compare requires --actual <png> --target <png>.');
    usage();
  }
  const report = await comparePngFiles(actualPath, targetPath, { threshold });
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, text, 'utf8');
  }
  process.stdout.write(text);
  if (!report.thresholdPassed) process.exit(1);
}

async function cmdExport(kind, modelId, outPath, viewId) {
  if (kind === 'gltf') {
    if (!modelId) usage();
    const url = `${base}/api/models/${encodeURIComponent(modelId)}/exports/model.gltf`;
    const text = await fetchOkText('GET', url);
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, text, 'utf8');
      console.log(JSON.stringify({ ok: true, out: outPath, chars: text.length }, null, 2));
    } else {
      process.stdout.write(text);
      if (!text.endsWith('\n')) process.stdout.write('\n');
    }
    return;
  }
  if (kind === 'glb') {
    if (!modelId) usage();
    const url = `${base}/api/models/${encodeURIComponent(modelId)}/exports/model.glb`;
    const buf = await fetchOkBytes('GET', url);
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, buf);
      console.log(JSON.stringify({ ok: true, out: outPath, bytes: buf.length }, null, 2));
    } else {
      process.stdout.write(buf);
    }
    return;
  }
  if (kind === 'ifc') {
    if (!modelId) usage();
    const url = `${base}/api/models/${encodeURIComponent(modelId)}/exports/model.ifc`;
    const buf = await fetchOkBytes('GET', url);
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, buf);
      console.log(JSON.stringify({ ok: true, out: outPath, bytes: buf.length }, null, 2));
    } else {
      process.stdout.write(buf.toString('utf8'));
    }
    return;
  }
  if (kind === 'json') {
    if (!modelId) usage();
    const snap = await fetchJson(
      'GET',
      `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`,
    );
    const doc = {
      _format: 'bimAiSnapshot_v1',
      _revision: snap.revision ?? null,
      modelId: snap.modelId ?? modelId,
      revision: snap.revision ?? null,
      elements: snap.elements ?? {},
      violations: snap.violations ?? [],
    };
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, text, 'utf8');
      console.log(
        JSON.stringify(
          {
            ok: true,
            out: outPath,
            chars: text.length,
            revision: doc.revision,
            elementCount: Object.keys(doc.elements).length,
          },
          null,
          2,
        ),
      );
    } else {
      process.stdout.write(text);
    }
    return;
  }
  // EXP-V3-01 — render-pipeline export formats
  if (kind === 'render-bundle' || kind === 'gltf-pbr' || kind === 'ifc-bundle' || kind === 'metadata-only') {
    if (!modelId) usage();
    const params = new URLSearchParams({ format: kind === 'render-bundle' ? 'metadata-only' : kind });
    if (viewId) params.set('viewId', viewId);
    const url = `${base}/api/v3/models/${encodeURIComponent(modelId)}/export?${params}`;
    const json = await fetchJson('GET', url);
    const text = `${JSON.stringify(json, null, 2)}\n`;
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, text, 'utf8');
      console.log(JSON.stringify({ ok: true, out: outPath, format: json.format }, null, 2));
    } else {
      process.stdout.write(text);
    }
    return;
  }
  console.error(`export ${kind}: not implemented (see spec/workpackage-master-tracker.md backlog).`);
  process.exit(2);
}

function diffToText(diff) {
  const lines = [];
  lines.push(
    `# bim-ai diff  rev ${diff.fromRevision} -> ${diff.toRevision}  (model ${diff.modelId})`,
  );
  const s = diff.summary ?? {};
  lines.push(
    `# added=${s.addedCount ?? 0} removed=${s.removedCount ?? 0} modified=${s.modifiedCount ?? 0}`,
  );
  for (const a of diff.added ?? []) {
    const name = a && typeof a.name === 'string' ? a.name : '';
    lines.push(`+ ${a?.kind ?? '?'} ${a?.id ?? '?'}${name ? ` (${name})` : ''}`);
  }
  for (const r of diff.removed ?? []) {
    const name = r && typeof r.name === 'string' ? r.name : '';
    lines.push(`- ${r?.kind ?? '?'} ${r?.id ?? '?'}${name ? ` (${name})` : ''}`);
  }
  for (const m of diff.modified ?? []) {
    lines.push(`* ${m?.kind ?? '?'} ${m?.id ?? '?'}`);
    for (const fc of m?.fieldChanges ?? []) {
      lines.push(`    ${fc.field}: ${JSON.stringify(fc.from)} -> ${JSON.stringify(fc.to)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function cmdDiff(modelId, fromRev, toRev, outPath, asText, summaryOnly) {
  if (!modelId) usage();
  const params = [];
  if (fromRev != null) params.push(`fromRev=${encodeURIComponent(String(fromRev))}`);
  if (toRev != null) params.push(`toRev=${encodeURIComponent(String(toRev))}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const url = `${base}/api/models/${encodeURIComponent(modelId)}/diff${qs}`;
  const json = await fetchJson('GET', url);

  let payload = json;
  let text;
  if (asText) {
    text = diffToText(summaryOnly ? { ...json, added: [], removed: [], modified: [] } : json);
  } else {
    if (summaryOnly) {
      payload = {
        modelId: json.modelId,
        fromRevision: json.fromRevision,
        toRevision: json.toRevision,
        summary: json.summary,
      };
    }
    text = `${JSON.stringify(payload, null, 2)}\n`;
  }

  if (outPath && outPath !== '-') {
    await fs.writeFile(outPath, text, 'utf8');
    console.log(JSON.stringify({ ok: true, out: outPath, chars: text.length }, null, 2));
  } else {
    process.stdout.write(text);
  }
}

// ─── AGT-01 — closed iterative-correction agent loop ─────────────────────────

async function readGoalText(goalArg) {
  if (!goalArg) return '';
  if (goalArg === '-') return slurpStdin();
  return fs.readFile(goalArg, 'utf8');
}

function summariseValidate(val) {
  const violations = Array.isArray(val?.violations) ? val.violations : [];
  let blocking = 0;
  for (const v of violations) {
    const sev = String(v?.severity ?? v?.level ?? '').toLowerCase();
    if (['blocking', 'block', 'error', 'critical', 'high'].includes(sev)) blocking++;
  }
  return { violationCount: violations.length, blockingCount: blocking };
}

function progressScore(goalText, snap, val) {
  const summary = summariseValidate(val);
  const elementsBlob = JSON.stringify(snap?.elements ?? {}).toLowerCase();
  const keywords = new Set(
    (goalText.match(/[A-Za-z_][A-Za-z0-9_]{3,}/g) ?? [])
      .filter((w) => !/^\d+$/.test(w))
      .map((w) => w.toLowerCase()),
  );
  let overlap = 0;
  for (const kw of keywords) if (elementsBlob.includes(kw)) overlap++;
  return -summary.blockingCount * 100 + overlap;
}

async function agentIterate(modelId, goalText, snap, val, evidence, iteration, backendOverride) {
  const url = `${base}/api/models/${encodeURIComponent(modelId)}/agent-iterate`;
  const body = {
    goal: goalText,
    currentSnapshot: snap,
    currentValidate: val,
    evidence,
    iteration,
  };
  if (backendOverride) body.backendOverride = backendOverride;
  return fetchJson('POST', url, body);
}

async function cmdAgentLoop(modelId, goalPath, maxIter, evidenceOut, backendOverride) {
  if (!modelId) {
    console.error('agent-loop requires BIM_AI_MODEL_ID');
    process.exit(1);
  }
  if (!goalPath) {
    console.error('agent-loop requires --goal <path>');
    process.exit(1);
  }
  const goalText = await readGoalText(goalPath);
  await fs.mkdir(evidenceOut, { recursive: true });

  let lastScore = -Infinity;
  for (let iter = 1; iter <= maxIter; iter++) {
    const iterDir = path.join(evidenceOut, `iter-${String(iter).padStart(2, '0')}`);
    await fs.mkdir(iterDir, { recursive: true });

    const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
    const val = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/validate`);
    const evidence = {
      revision: snap.revision ?? null,
      elementCount: snap.elements ? Object.keys(snap.elements).length : 0,
      validate: summariseValidate(val),
    };
    await fs.writeFile(path.join(iterDir, 'snapshot.json'), JSON.stringify(snap, null, 2));
    await fs.writeFile(path.join(iterDir, 'validate.json'), JSON.stringify(val, null, 2));
    await fs.writeFile(path.join(iterDir, 'evidence.json'), JSON.stringify(evidence, null, 2));

    const baselineScore = progressScore(goalText, snap, val);

    const patchResp = await agentIterate(modelId, goalText, snap, val, evidence, iter, backendOverride);
    await fs.writeFile(path.join(iterDir, 'patch.json'), JSON.stringify(patchResp, null, 2));

    const commands = Array.isArray(patchResp.patch) ? patchResp.patch : [];
    if (!commands.length) {
      const status = {
        status: 'no-patch',
        iteration: iter,
        rationale: patchResp.rationale ?? '',
        confidence: patchResp.confidence ?? 0,
      };
      await fs.writeFile(path.join(iterDir, 'status.json'), JSON.stringify(status, null, 2));
      console.log(JSON.stringify({ ok: true, iteration: iter, status: 'no-patch' }, null, 2));
      return;
    }

    const dryUrl = `${base}/api/models/${encodeURIComponent(modelId)}/commands/bundle/dry-run`;
    const dryResp = await fetch(dryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commands, userId: 'agent-loop' }),
    });
    const dryText = await dryResp.text();
    let dryJson;
    try {
      dryJson = JSON.parse(dryText);
    } catch {
      dryJson = { raw: dryText };
    }
    await fs.writeFile(path.join(iterDir, 'dry-run.json'), JSON.stringify(dryJson, null, 2));
    if (!dryResp.ok) {
      const status = { status: 'dry-run-failed', iteration: iter, body: dryJson };
      await fs.writeFile(path.join(iterDir, 'status.json'), JSON.stringify(status, null, 2));
      console.log(JSON.stringify({ ok: false, iteration: iter, status: 'dry-run-failed' }, null, 2));
      return;
    }

    const applyResp = await fetchJson(
      'POST',
      `${base}/api/models/${encodeURIComponent(modelId)}/commands/bundle`,
      { commands, userId: 'agent-loop' },
    );
    await fs.writeFile(path.join(iterDir, 'apply.json'), JSON.stringify(applyResp, null, 2));

    const snap2 = await fetchJson(
      'GET',
      `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`,
    );
    const val2 = await fetchJson(
      'GET',
      `${base}/api/models/${encodeURIComponent(modelId)}/validate`,
    );
    await fs.writeFile(path.join(iterDir, 'snapshot.after.json'), JSON.stringify(snap2, null, 2));
    await fs.writeFile(path.join(iterDir, 'validate.after.json'), JSON.stringify(val2, null, 2));

    const newScore = progressScore(goalText, snap2, val2);
    const progressed = newScore > Math.max(baselineScore, lastScore);
    const regressed = newScore < baselineScore;

    const status = {
      status: progressed ? 'progress' : regressed ? 'regression-rolled-back' : 'no-progress',
      iteration: iter,
      baselineScore,
      newScore,
      rationale: patchResp.rationale ?? '',
      confidence: patchResp.confidence ?? 0,
      patchSize: commands.length,
    };
    await fs.writeFile(path.join(iterDir, 'status.json'), JSON.stringify(status, null, 2));

    if (regressed) {
      try {
        const undoResp = await fetchJson(
          'POST',
          `${base}/api/models/${encodeURIComponent(modelId)}/undo`,
          { userId: 'agent-loop' },
        );
        await fs.writeFile(path.join(iterDir, 'undo.json'), JSON.stringify(undoResp, null, 2));
      } catch (e) {
        await fs.writeFile(
          path.join(iterDir, 'undo.error'),
          e instanceof Error ? e.message : String(e),
        );
      }
      console.log(JSON.stringify({ ok: false, iteration: iter, status: status.status }, null, 2));
      return;
    }

    if (!progressed) {
      console.log(JSON.stringify({ ok: false, iteration: iter, status: status.status }, null, 2));
      return;
    }

    lastScore = newScore;
    if (status.status === 'progress' && newScore >= 0 && commands.length === 0) {
      // unreachable but kept for clarity
      break;
    }
  }
  console.log(
    JSON.stringify({ ok: true, iteration: maxIter, status: 'max-iter-reached' }, null, 2),
  );
}

// ─── API-V3-01 — introspection subcommands ───────────────────────────────────

async function cmdApiListTools(outputFormat) {
  const json = await fetchJson('GET', `${base}/api/v3/tools`);
  if (outputFormat === 'json') {
    console.log(JSON.stringify(json, null, 2));
  } else {
    for (const t of json.tools ?? []) {
      console.log(`${t.name}  [${t.category}]  ${t.restEndpoint?.method} ${t.restEndpoint?.path}`);
    }
  }
}

async function cmdApiInspect(name, outputFormat) {
  if (!name) {
    console.error('api inspect requires <name>');
    process.exit(1);
  }
  const json = await fetchJson('GET', `${base}/api/v3/tools/${encodeURIComponent(name)}`);
  if (outputFormat === 'json') {
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log(`name:       ${json.name}`);
    console.log(`category:   ${json.category}`);
    console.log(`sideEffects: ${json.sideEffects}`);
    console.log(`endpoint:   ${json.restEndpoint?.method} ${json.restEndpoint?.path}`);
    console.log(`example:    ${json.cliExample}`);
    if (json.agentSafetyNotes) console.log(`notes:      ${json.agentSafetyNotes}`);
  }
}

async function cmdApiVersion() {
  const json = await fetchJson('GET', `${base}/api/v3/version`);
  console.log(JSON.stringify(json, null, 2));
}

async function cmdCheckpoint(modelId, targetPath, viewpointId, threshold, outPath) {
  if (!modelId) {
    console.error('checkpoint requires BIM_AI_MODEL_ID');
    process.exit(1);
  }
  if (!targetPath) {
    console.error('checkpoint requires --target <path>');
    process.exit(1);
  }

  // 1. Get current model state
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const tmpSnapPath = 'skb-temp-snapshot.json';
  const tmpActualPng = 'skb-temp-actual.png';
  await fs.writeFile(tmpSnapPath, JSON.stringify(snap, null, 2));

  try {
    // 2. Run Playwright headless render
    console.error(`[skb-03] Rendering snapshot via Playwright (viewpoint: ${viewpointId ?? 'fit'})...`);
    const env = {
      ...process.env,
      SKB_SNAPSHOT_PATH: path.resolve(tmpSnapPath),
      SKB_VIEWPOINT_ID: viewpointId ?? '',
      SKB_SCREENSHOT_OUT: path.resolve(tmpActualPng),
    };

    // Find project root (assume we are in packages/cli/ or root)
    const root = process.cwd();
    execSync(
      `pnpm --filter @bim-ai/web exec playwright test packages/web/e2e/skb-checkpoint.spec.ts --config playwright.skb.config.ts`,
      {
        stdio: 'inherit',
        env,
        cwd: root,
      },
    );

    // 3. Call backend for comparison
    console.error(`[skb-03] Comparing actual render against ${targetPath}...`);
    const result = await fetchJson('POST', `${base}/api/v3/skb/checkpoint`, {
      actualPng: path.resolve(tmpActualPng),
      targetPng: path.resolve(targetPath),
      threshold: threshold ? parseFloat(threshold) : 0.05,
    });

    if (outPath) {
      await fs.writeFile(outPath, JSON.stringify(result, null, 2));
    }

    console.log(JSON.stringify(result, null, 2));

    if (result.passed === false) {
      console.error(
        `[skb-03] Visual gate FAILED (delta: ${result.overall_delta_normalised.toFixed(
          4,
        )} > threshold: ${result.threshold})`,
      );
      process.exit(1);
    } else {
      console.error(`[skb-03] Visual gate PASSED`);
    }
  } finally {
    // Cleanup
    await fs.rm(tmpSnapPath).catch(() => {});
  }
}

async function cmdCompare(pathA, pathB, rest) {
  if (!pathA || !pathB) {
    console.error(
      'Usage: bim-ai compare <snapshot-a.json> <snapshot-b.json> [--metric=ssim|mse|pixel-diff] [--threshold=0.7] [--region=<name>]',
    );
    process.exit(1);
  }
  const { readFileSync } = await import('fs');
  const snapshotA = JSON.parse(readFileSync(pathA, 'utf8'));
  const snapshotB = JSON.parse(readFileSync(pathB, 'utf8'));
  const metricArg = rest.find((a) => a.startsWith('--metric='))?.split('=')[1] ?? 'ssim';
  const thresholdArg = rest.find((a) => a.startsWith('--threshold='))?.split('=')[1];
  const regionArg = rest.find((a) => a.startsWith('--region='))?.split('=')[1];
  const result = await fetchJson('POST', `${base}/api/v3/compare`, {
    snapshotA,
    snapshotB,
    metric: metricArg,
    threshold: thresholdArg ? parseFloat(thresholdArg) : undefined,
    region: regionArg,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.thresholdPassed === false) process.exit(1);
}

function usage() {
  console.error(
    `bim-ai <command> [args]

Commands:
  bootstrap                           GET /api/bootstrap (projects + models)
  init-model --project-id <uuid> [--slug slug] [--template <id>]
                                       POST empty model row (agents use BIM_AI_MODEL_ID from output)
                                       --template seeds from app/bim_ai/templates/<id>.json (e.g. residential-eu)
  templates                           GET /api/templates (catalog of project templates)
  schema                              GET /api/schema (commands + presets ids)
  presets                             summarize schema + building presets
  snapshot                            GET snapshot (needs BIM_AI_MODEL_ID)
  advisor [--output json] [--severity info|warning|error]
                                      Group snapshot violations/advisories for agent refinement.
  evidence                            Combined artifact: counts-by-kind + full validate rollup
  evidence-package                    Phase A checklist JSON (captures recommended layouts + manifests)
  schedule-table [--csv] [--columns keys] <scheduleId>   Server-derived rows (optional CSV; columns=comma-separated keys)
  export-manifests                     glTF + IFC exchange-manifest JSON stubs
  export gltf [--out <path>]           download model.gltf JSON (default: stdout; needs BIM_AI_MODEL_ID)
  export glb [--out <path>]            download model.glb binary (default: stdout; needs BIM_AI_MODEL_ID)
  export ifc [--out <path>]            download model.ifc (default: stdout; needs BIM_AI_MODEL_ID)
  export json [--out <path>]           snapshot JSON (full elements + violations; default: stdout; needs BIM_AI_MODEL_ID)
  summary                             GET model summary rollup
  validate                            GET violations + summary + counts
  command-log [limit]                  GET undo/command history with full commands JSON
  apply [file|-]                       POST single command (server-authoritative; commits + broadcasts)
  apply-bundle [file|-] --base <rev> [--dry-run | --commit]
                                       CMD-V3-01: submit a cmd-v3.0 CommandBundle.
                                       Default: --dry-run (agent safety — force explicit --commit).
                                       [--tolerate <advisory-class>]... explicit override(s)
                                       [--assumptions <file>] load assumptions from JSON file
                                       Exit: 0 ok, 2 revision_conflict, 3 assumption_log_*
  dry-run [file|-]                     POST single command dry-run
  plan-house --brief <path> --out <path> [--model-hint id]
                                       validate brief JSON → write starter command bundle (one-family preset)
  seed-dsl compile --recipe <path> --out <path> [--model-hint id]
                                       SKB: compile architectural seed DSL intent into a deterministic cmd-v3.0 bundle.
  initiation-check --ir <path> --out <dir> [--capabilities <path>] [--model <id>] [--live]
                   [--mode massing_only|concept_bim|project_initiation_bim|documentation_ready]
                   [--fail-on-acceptance]
                                       SKB: validate Sketch Understanding IR against capability matrix,
                                       create capability coverage + visual checklist evidence packet.
  initiation-run --ir <path> --out <dir> --model <id> [--capabilities <path>]
                 [--seed-command <cmd>] [--apply-bundle <path> --base <rev> --commit|--dry-run]
                 [--no-screenshots] [--target-image <png>] [--target-map <json>]
                 [--visual-threshold <float>] [--fail-on-warning] [--fail-on-visual]
                 [--mode massing_only|concept_bim|project_initiation_bim|documentation_ready]
                 [--fail-on-acceptance]
                                       SKB: live project-initiation evidence runner. Captures snapshot,
                                       validate, evidence-package, advisor warning/info, screenshot
                                       manifest, visual-gate scoring, and populated status/checklist artifacts.
  initiation-modes                     SKB: print supported sketch-to-BIM quality modes and defaults.
  initiation-compare --actual <png> --target <png> [--threshold <float>] [--out <path>]
                                       SKB: compare a checkpoint screenshot with a target/reference PNG.
  initiation-golden --manifest <path> --out <dir>
                                       SKB: run preflight/evidence packet checks for golden sketch-to-BIM seed cases.
  diff --from <rev> --to <rev> [--out <path>] [--text] [--summary-only]
                                       element-level diff between two revisions of the model
  agent-loop --goal <path|-> --max-iter <n> --evidence-out <dir> [--backend <name>]
                                       AGT-01: read goal markdown → call /api/models/:id/agent-iterate →
                                       dry-run + apply → re-evaluate → rollback on regression. Backend
                                       defaults to BIM_AI_AGENT_BACKEND (test|claude). Per-iter dump
                                       under <evidence-out>/iter-NN/.
  link --source <uuid> --pos x,y,z [--align <mode>] [--name <s>] [--visibility <mode>]
                                       FED-01: insert a link_model into BIM_AI_MODEL_ID. align ∈
                                       origin_to_origin|project_origin|shared_coords (default origin_to_origin).
                                       visibility ∈ host_view|linked_view (default host_view).
  unlink <link_id>                    FED-01: delete the link_model with id <link_id>.
  links                               FED-01: list every link_model in BIM_AI_MODEL_ID with pin/drift status.
  tokens encode                       TKN-V3-01: encode current kernel state → TokenSequence (stdout JSON)
  tokens decode [file|-]              TKN-V3-01: decode TokenSequence → commands (reads JSON from file or stdin)
  tokens diff --a <path> --b <path>   TKN-V3-01: structural diff between two TokenSequence JSON files
  plan-region create --level <id> --cut <mm> [--name <n>] x0 y0 x1 y1
                                      KRN-V3-06: create a cut-plane override region (rectangle, mm).
  plan-region update <id> [--cut <mm>] [--name <n>]
                                      KRN-V3-06: update cut-plane or name of an existing plan region.
  plan-region delete <id>             KRN-V3-06: delete a plan region.
  watch                               WebSocket watcher (continuous live commits — no Synchronize step required)
  checkpoint --target <path> [--viewpoint <id>] [--threshold <float>] [--out <path>]
                                      SKB-03: render current model + compare pixels to target PNG.
  compare <a.json> <b.json> [--metric=ssim|mse|pixel-diff] [--threshold=<float>] [--region=<name>]
                                      VG-V3-01: render-and-compare two snapshots; exit 1 if threshold not met
  api list-tools [--output json]      API-V3-01: list all registered tool descriptors
  api inspect <name> [--output json]  API-V3-01: print one ToolDescriptor
  api version                         API-V3-01: print { schemaVersion, buildRef }
  publish --link --model <id> [--display-name <str>] [--allow-measurement] [--allow-comment] [--expires-at <ms>]
                                      OUT-V3-01: create a live presentation link (prints full URL)
  publish --revoke <link-id> --model <id>
                                      OUT-V3-01: revoke a presentation link
  publish --list --model <id>         OUT-V3-01: list active presentation links for a model

  jobs submit <kind> --model <id> [--inputs <json>]
                                      JOB-V3-01: enqueue a long-running job
  jobs list --model <id> [--wait]     JOB-V3-01: list jobs for model (--wait polls until all active done)
  jobs cancel <job-id>                JOB-V3-01: cancel a queued/running job
  jobs status <job-id>                JOB-V3-01: get current job status

  asset index --name <name> --category <category> [--kind <kind>] [--tags a,b] [--description <s>]
                                      AST-V3-01: index a new asset into the project library (sends IndexAssetCmd)
  asset place --asset <asset-id> --level <level-id> (--pos x,y,z | --x <n> --y <n>)
                                      AST-V3-01: place an asset instance on the canvas (sends PlaceAssetCmd)

  phase-create --name <name> --ord <n>        KRN-V3-01: create a new phase (ord = ordinal position)
  phase-rename --phase-id <id> --name <name>   KRN-V3-01: rename an existing phase
  phase-reorder --phase-id <id> --ord <n>      KRN-V3-01: change a phase ordinal
  phase-delete --phase-id <id> [--retarget-to <id>] KRN-V3-01: delete a phase (retarget elements if needed)
  element-set-phase --element-id <id> [--phase-created-id <id>] [--phase-demolished-id <id>] [--clear-demolished]
                                                KRN-V3-01: set phase lifecycle on an element
  view-set-phase --view-id <id> --phase-id <id> KRN-V3-01: set the as-of phase for a plan view
  view-set-phase-filter --view-id <id> --phase-filter <filter>
                                                KRN-V3-01: set phase filter (show_all|show_new_plus_existing|show_demolition_only|show_existing_only|show_new_only)

  tool-pref set --tool <tool> --pref <key> --value <value>
                                                CHR-V3-08: store a sticky tool-modifier preference (e.g. wall alignment).

Collaboration model:
  Every command is server-authoritative on commit and broadcast over websocket;
  there is no central file to Synchronize. See docs/collaboration-model.md.

Env:
  BIM_AI_MODEL_ID   (required for model-scoped ops)
  BIM_AI_USER_ID    default: local-dev
  BIM_AI_BASE_URL   default: http://127.0.0.1:8500`,
  );
  process.exit(1);
}

async function main() {
  let argv = process.argv.slice(2);
  let modelId = process.env.BIM_AI_MODEL_ID;
  const userId = process.env.BIM_AI_USER_ID ?? 'local-dev';

  if (!argv.length) usage();
  let cmd = argv[0];

  // CMD-V3-01: --dry-run is now parsed inside the apply-bundle handler.

  try {
    if (cmd === 'bootstrap') {
      await cmdBootstrapCli();
      return;
    }
    if (cmd === 'init-model') {
      const rest = argv.slice(1);
      let pid;
      let slug = `empty-${Date.now().toString(36)}`;
      let templateId;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--project-id' && rest[i + 1]) pid = rest[++i];
        else if (a === '--slug' && rest[i + 1]) slug = rest[++i];
        else if (a === '--template' && rest[i + 1]) templateId = rest[++i];
      }
      if (!pid) {
        console.error('init-model requires --project-id <uuid> (run bim-ai bootstrap first).');
        usage();
      }
      await cmdInitModel(pid, slug, templateId);
      return;
    }
    if (cmd === 'templates') {
      await cmdListTemplates();
      return;
    }
    if (cmd === 'schema') {
      await cmdSchema();
      return;
    }
    if (cmd === 'presets') {
      await cmdPresets();
      return;
    }
    if (cmd === 'summary') {
      if (!modelId) usage();
      await cmdSummary(modelId);
      return;
    }
    if (cmd === 'validate') {
      if (!modelId) usage();
      await cmdValidate(modelId);
      return;
    }
    if (cmd === 'evidence') {
      if (!modelId) usage();
      await cmdEvidence(modelId);
      return;
    }
    if (cmd === 'evidence-package') {
      if (!modelId) usage();
      await cmdEvidencePackage(modelId);
      return;
    }
    if (cmd === 'export-manifests') {
      if (!modelId) usage();
      await cmdExportManifests(modelId);
      return;
    }
    if (cmd === 'schedule-table') {
      if (!modelId) usage();
      const args = argv.slice(1);
      let wantCsv = false;
      let columnsArg;
      let sid;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--csv') wantCsv = true;
        else if (a === '--columns' && args[i + 1]) columnsArg = args[++i];
        else if (!a.startsWith('-')) sid = sid ?? a;
      }
      if (!sid) usage();
      await cmdScheduleTable(modelId, sid, wantCsv, columnsArg);
      return;
    }
    if (cmd === 'command-log') {
      if (!modelId) usage();
      const lim = argv[1] ? Number(argv[1]) : undefined;
      await cmdCommandLog(modelId, Number.isFinite(lim) ? lim : undefined);
      return;
    }
    if (cmd === 'plan-house') {
      let briefArg;
      let outArg;
      let modelHint;
      const rest = argv.slice(1);
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--brief' && rest[i + 1]) briefArg = rest[++i];
        else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
        else if (a === '--model-hint' && rest[i + 1]) modelHint = rest[++i];
      }
      if (!briefArg || !outArg) usage();
      await cmdPlanHouse(briefArg, outArg, modelHint);
      return;
    }
    if (cmd === 'seed-dsl') {
      const subcmd = argv[1];
      let recipeArg;
      let outArg;
      let modelHint;
      const rest = argv.slice(2);
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--recipe' && rest[i + 1]) recipeArg = rest[++i];
        else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
        else if (a === '--model-hint' && rest[i + 1]) modelHint = rest[++i];
      }
      if (subcmd !== 'compile' || !recipeArg || !outArg) usage();
      await cmdSeedDslCompile(recipeArg, outArg, modelHint);
      return;
    }
    if (cmd === 'initiation-modes' || cmd === 'initiate-modes') {
      await cmdInitiationModes();
      return;
    }
    if (cmd === 'initiation-check' || cmd === 'initiate-check') {
      let irArg;
      let outArg;
      let capabilityArg = DEFAULT_CAPABILITY_MATRIX_PATH;
      let live = false;
      let qualityMode;
      let failOnAcceptance = false;
      const rest = argv.slice(1);
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--ir' && rest[i + 1]) irArg = rest[++i];
        else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
        else if (a === '--capabilities' && rest[i + 1]) capabilityArg = rest[++i];
        else if (a === '--capability-matrix' && rest[i + 1]) capabilityArg = rest[++i];
        else if (a === '--model' && rest[i + 1]) modelId = rest[++i];
        else if (a === '--mode' && rest[i + 1]) qualityMode = rest[++i];
        else if (a === '--fail-on-acceptance') failOnAcceptance = true;
        else if (a === '--live') live = true;
      }
      if (!irArg || !outArg) {
        console.error('initiation-check requires --ir <path> --out <dir>.');
        usage();
      }
      await cmdInitiationCheck(irArg, capabilityArg, outArg, modelId, live, qualityMode, failOnAcceptance);
      return;
    }
    if (cmd === 'initiation-run' || cmd === 'initiate-run') {
      let irArg;
      let outArg;
      let capabilityArg = DEFAULT_CAPABILITY_MATRIX_PATH;
      let screenshots = true;
      let seedCommand;
      let applyBundlePath;
      let baseRevision;
      let applyMode = 'dry_run';
      let failOnWarning = false;
      let failOnVisual = false;
      let targetImagePath;
      let targetMapPath;
      let visualThreshold = 0.62;
      let qualityMode;
      let failOnAcceptance = false;
      const rest = argv.slice(1);
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--ir' && rest[i + 1]) irArg = rest[++i];
        else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
        else if (a === '--capabilities' && rest[i + 1]) capabilityArg = rest[++i];
        else if (a === '--capability-matrix' && rest[i + 1]) capabilityArg = rest[++i];
        else if (a === '--model' && rest[i + 1]) modelId = rest[++i];
        else if (a === '--seed-command' && rest[i + 1]) seedCommand = rest[++i];
        else if (a === '--apply-bundle' && rest[i + 1]) applyBundlePath = rest[++i];
        else if (a === '--base' && rest[i + 1]) baseRevision = Number(rest[++i]);
        else if (a === '--commit') applyMode = 'commit';
        else if (a === '--dry-run') applyMode = 'dry_run';
        else if (a === '--no-screenshots') screenshots = false;
        else if (a === '--screenshots') screenshots = true;
        else if (a === '--fail-on-warning') failOnWarning = true;
        else if (a === '--fail-on-visual') failOnVisual = true;
        else if (a === '--target-image' && rest[i + 1]) targetImagePath = rest[++i];
        else if (a === '--target-map' && rest[i + 1]) targetMapPath = rest[++i];
        else if (a === '--visual-threshold' && rest[i + 1]) visualThreshold = Number(rest[++i]);
        else if (a === '--mode' && rest[i + 1]) qualityMode = rest[++i];
        else if (a === '--fail-on-acceptance') failOnAcceptance = true;
      }
      if (!irArg || !outArg) {
        console.error('initiation-run requires --ir <path> --out <dir>.');
        usage();
      }
      await cmdInitiationRun({
        irPath: irArg,
        capabilityMatrixPath: capabilityArg,
        outDir: outArg,
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
      });
      return;
    }
    if (cmd === 'initiation-compare' || cmd === 'initiate-compare') {
      let actualPath;
      let targetPath;
      let outPath;
      let threshold = 0.62;
      const rest = argv.slice(1);
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--actual' && rest[i + 1]) actualPath = rest[++i];
        else if (a === '--target' && rest[i + 1]) targetPath = rest[++i];
        else if (a === '--out' && rest[i + 1]) outPath = rest[++i];
        else if (a === '--threshold' && rest[i + 1]) threshold = Number(rest[++i]);
      }
      await cmdInitiationCompare(actualPath, targetPath, outPath, threshold);
      return;
    }
    if (cmd === 'initiation-golden' || cmd === 'initiate-golden') {
      let manifestArg;
      let outArg;
      const rest = argv.slice(1);
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--manifest' && rest[i + 1]) manifestArg = rest[++i];
        else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
      }
      if (!manifestArg || !outArg) usage();
      await cmdInitiationGolden(manifestArg, outArg);
      return;
    }

    const pathArgFirst = argv[1];
    const pathArgDry = argv[1];

    if (cmd === 'export') {
      const rest = argv.slice(1);
      const k = rest[0];
      if (!k) usage();
      let outArg;
      let viewIdArg;
      for (let i = 1; i < rest.length; i++) {
        const a = rest[i];
        if ((a === '--out' || a === '-o') && rest[i + 1]) outArg = rest[++i];
        else if (a === '--view' && rest[i + 1]) viewIdArg = rest[++i];
      }
      await cmdExport(k, modelId, outArg, viewIdArg);
      return;
    }
    if (cmd === 'diff') {
      const rest = argv.slice(1);
      let fromRev;
      let toRev;
      let outArg;
      let asText = false;
      let summaryOnly = false;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--from' && rest[i + 1]) fromRev = rest[++i];
        else if (a === '--to' && rest[i + 1]) toRev = rest[++i];
        else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
        else if (a === '--text') asText = true;
        else if (a === '--summary-only') summaryOnly = true;
      }
      await cmdDiff(modelId, fromRev, toRev, outArg, asText, summaryOnly);
      return;
    }
    if (cmd === 'agent-loop') {
      const rest = argv.slice(1);
      let goalArg;
      let maxIter = 5;
      let evidenceOut;
      let backendOverride;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--goal' && rest[i + 1]) goalArg = rest[++i];
        else if (a === '--max-iter' && rest[i + 1]) maxIter = Number(rest[++i]);
        else if (a === '--evidence-out' && rest[i + 1]) evidenceOut = rest[++i];
        else if (a === '--backend' && rest[i + 1]) backendOverride = rest[++i];
      }
      if (!goalArg || !evidenceOut || !Number.isFinite(maxIter) || maxIter < 1) {
        console.error(
          'agent-loop requires --goal <path|-> --max-iter <n> --evidence-out <dir>',
        );
        process.exit(1);
      }
      await cmdAgentLoop(modelId, goalArg, maxIter, evidenceOut, backendOverride);
      return;
    }

    if (cmd === 'api') {
      const sub = argv[1];
      const rest = argv.slice(2);
      let outputFormat = 'json';
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--output' && rest[i + 1]) outputFormat = rest[++i];
      }
      if (sub === 'list-tools') {
        await cmdApiListTools(outputFormat);
        return;
      }
      if (sub === 'inspect') {
        const name = rest.find((a) => !a.startsWith('-'));
        await cmdApiInspect(name, outputFormat);
        return;
      }
      if (sub === 'version') {
        await cmdApiVersion();
        return;
      }
      console.error(`Unknown api subcommand: ${sub ?? '(none)'}. Use list-tools | inspect | version.`);
      process.exit(1);
    }

    if (cmd === 'catalog') {
      const subCmd = argv[1];
      if (subCmd === 'query') {
        const rest = argv.slice(2);
        const params = new URLSearchParams();
        const pick = (flag) => rest.find(a => a.startsWith(`--${flag}=`))?.split('=')[1];
        if (pick('kind')) params.set('kind', pick('kind'));
        if (pick('max-width')) params.set('maxWidthMm', pick('max-width'));
        if (pick('min-width')) params.set('minWidthMm', pick('min-width'));
        if (pick('tag')) params.set('tag', pick('tag'));
        if (pick('style')) params.set('style', pick('style'));
        if (pick('page')) params.set('page', pick('page'));
        if (pick('page-size')) params.set('pageSize', pick('page-size'));
        const result = await fetchJson('GET', `${base}/api/v3/catalog?${params}`);
        const fmt = pick('output') ?? 'json';
        if (fmt === 'json') console.log(JSON.stringify(result, null, 2));
        else result.items.forEach(i => console.log(`${i.id}\t${i.kind}\t${i.widthMm ?? ''}`));
        return;
      } else {
        console.error('Usage: bim-ai catalog query [--kind <kind>] [--max-width <mm>] [--tag <name>] [--style <key>] [--output json|table]');
        process.exit(1);
      }
    }

    if (!modelId && cmd !== 'schema' && cmd !== 'presets' && cmd !== 'plan-house' && cmd !== 'bootstrap' && cmd !== 'init-model' && cmd !== 'publish')
      usage();

    if (cmd === 'snapshot') {
      await snapshot(modelId);
      return;
    }

    if (cmd === 'advisor') {
      const rest = argv.slice(1);
      const output = rest.includes('--output')
        ? rest[rest.indexOf('--output') + 1]
        : rest.find((a) => a.startsWith('--output='))?.split('=')[1] ?? 'text';
      const severity = rest.includes('--severity')
        ? rest[rest.indexOf('--severity') + 1]
        : rest.find((a) => a.startsWith('--severity='))?.split('=')[1] ?? null;
      await cmdAdvisor(modelId, { output, severity });
      return;
    }

    if (cmd === 'apply') {
      const raw = (await readPayloadOrStdin(pathArgFirst)).trim();
      if (!raw) {
        console.error('Empty JSON for apply');
        process.exit(1);
      }
      await postCommand(modelId, userId, JSON.parse(raw));
      return;
    }

    if (cmd === 'dry-run') {
      const raw = (await readPayloadOrStdin(pathArgDry)).trim();
      if (!raw) {
        console.error('Empty JSON for dry-run');
        process.exit(1);
      }
      await dryRunCommand(modelId, userId, JSON.parse(raw));
      return;
    }

    if (cmd === 'apply-bundle') {
      // CMD-V3-01: full apply-bundle handler (replaces stub)
      const rest = argv.slice(1);
      let baseRevision;
      let mode = 'dry_run'; // default: dry-run (agent safety — force explicit --commit)
      const tolerances = [];
      let assumptionsFile;
      let fileArg;

      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--base' && rest[i + 1]) {
          baseRevision = Number(rest[++i]);
        } else if (a === '--dry-run') {
          mode = 'dry_run';
        } else if (a === '--commit') {
          mode = 'commit';
        } else if (a === '--tolerate' && rest[i + 1]) {
          tolerances.push({ advisoryClass: rest[++i], reason: 'cli-tolerate' });
        } else if (a === '--assumptions' && rest[i + 1]) {
          assumptionsFile = rest[++i];
        } else if (!a.startsWith('-')) {
          fileArg = a;
        }
      }

      if (baseRevision === undefined || !Number.isFinite(baseRevision)) {
        console.error('apply-bundle requires --base <revision>');
        process.exit(1);
      }

      const raw = (await readPayloadOrStdin(fileArg)).trim();
      if (!raw) {
        console.error('Empty JSON for apply-bundle');
        process.exit(1);
      }
      const blob = JSON.parse(raw);

      // Build a cmd-v3.0 CommandBundle
      let bundle;
      if (blob && typeof blob === 'object' && blob.schemaVersion === 'cmd-v3.0') {
        bundle = blob;
      } else {
        // Legacy: bare array or { commands: [] } — auto-inject synthetic assumption
        const legacyCmds = commandsFromBundleJson(blob);
        console.error(
          '[warn] Legacy bundle input (no schemaVersion). ' +
            'Injecting synthetic assumption with confidence:0, source:"cli-legacy". ' +
            'Migrate to cmd-v3.0 bundle format.',
        );
        bundle = {
          schemaVersion: 'cmd-v3.0',
          commands: legacyCmds,
          assumptions: [{ key: 'cli-legacy', value: true, confidence: 0, source: 'cli-legacy' }],
          parentRevision: baseRevision,
        };
      }

      // CLI flags win over bundle fields
      bundle.parentRevision = baseRevision;
      if (tolerances.length) bundle.tolerances = tolerances;
      if (assumptionsFile) {
        const aRaw = await fs.readFile(assumptionsFile, 'utf8');
        bundle.assumptions = JSON.parse(aRaw);
      }

      const url = `${base}/api/models/${encodeURIComponent(modelId)}/bundles`;
      const res = await fetch(url, {
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
      console.log(JSON.stringify(json, null, 2));

      if (res.status === 409) {
        const violations = json?.violations ?? json?.result?.violations ?? [];
        const classes = violations.map((v) => v?.advisoryClass);
        if (classes.includes('revision_conflict')) process.exit(2);
        if (
          classes.includes('assumption_log_required') ||
          classes.includes('assumption_log_malformed') ||
          classes.includes('assumption_log_duplicate_key')
        )
          process.exit(3);
        process.exit(1);
      }
      if (!res.ok) process.exit(1);
      return;
    }

    if (cmd === '__apply-bundle-dry') {
      // Legacy dry-run path kept for backwards compat
      const pathArg = argv[0];
      const raw = (await readPayloadOrStdin(pathArg)).trim();
      if (!raw) {
        console.error('Empty JSON for apply-bundle --dry-run');
        process.exit(1);
      }
      const cmds = commandsFromBundleJson(JSON.parse(raw));
      await dryRunBundle(modelId, userId, cmds);
      return;
    }

    if (cmd === 'link') {
      if (!modelId) usage();
      const rest = argv.slice(1);
      let sourceUuid;
      let posArg;
      let alignArg = 'origin_to_origin';
      let nameArg;
      let visArg = 'host_view';
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--source' && rest[i + 1]) sourceUuid = rest[++i];
        else if (a === '--pos' && rest[i + 1]) posArg = rest[++i];
        else if (a === '--align' && rest[i + 1]) alignArg = rest[++i];
        else if (a === '--name' && rest[i + 1]) nameArg = rest[++i];
        else if (a === '--visibility' && rest[i + 1]) visArg = rest[++i];
      }
      const align = parseAlignMode(alignArg);
      const pos = parsePosTriple(posArg ?? '0,0,0');
      const vis =
        visArg === 'linked_view' ? 'linked_view' : visArg === 'host_view' ? 'host_view' : 'host_view';
      await cmdLinkCreate(modelId, userId, sourceUuid, pos, align, nameArg, vis);
      return;
    }

    if (cmd === 'unlink') {
      if (!modelId) usage();
      const linkId = argv[1];
      await cmdUnlink(modelId, userId, linkId);
      return;
    }

    if (cmd === 'links') {
      if (!modelId) usage();
      await cmdLinksList(modelId);
      return;
    }

    if (cmd === 'tokens') {
      const sub = argv[0];
      if (sub === 'encode') {
        if (!modelId) usage();
        const res = await fetch(`${baseUrl}/models/${modelId}/tokens/encode`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`tokens encode: ${res.status} ${await res.text()}`);
        console.log(JSON.stringify(await res.json(), null, 2));
        return;
      }
      if (sub === 'decode') {
        if (!modelId) usage();
        const filePath = argv[1];
        let seqJson;
        if (!filePath || filePath === '-') {
          const chunks = [];
          for await (const chunk of process.stdin) chunks.push(chunk);
          seqJson = JSON.parse(Buffer.concat(chunks).toString());
        } else {
          const { readFileSync } = await import('fs');
          seqJson = JSON.parse(readFileSync(filePath, 'utf8'));
        }
        const res = await fetch(`${baseUrl}/models/${modelId}/tokens/decode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sequence: seqJson }),
        });
        if (!res.ok) throw new Error(`tokens decode: ${res.status} ${await res.text()}`);
        console.log(JSON.stringify(await res.json(), null, 2));
        return;
      }
      if (sub === 'diff') {
        if (!modelId) usage();
        const aPath = argv.find((_, i) => argv[i - 1] === '--a');
        const bPath = argv.find((_, i) => argv[i - 1] === '--b');
        if (!aPath || !bPath) {
          console.error('Usage: tokens diff --a <path> --b <path>');
          process.exit(1);
        }
        const { readFileSync } = await import('fs');
        const seqA = JSON.parse(readFileSync(aPath, 'utf8'));
        const seqB = JSON.parse(readFileSync(bPath, 'utf8'));
        const res = await fetch(`${baseUrl}/models/${modelId}/tokens/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sequenceA: seqA, sequenceB: seqB }),
        });
        if (!res.ok) throw new Error(`tokens diff: ${res.status} ${await res.text()}`);
        console.log(JSON.stringify(await res.json(), null, 2));
        return;
      }
      console.error(`Unknown tokens subcommand: ${sub ?? '(none)'}. Use encode, decode, or diff.`);
      process.exit(1);
    }

    if (cmd === 'plan-region') {
      const sub = argv[0];
      if (sub === 'create') {
        if (!modelId) usage();
        let levelId, cutPlaneOffsetMm, name, coords;
        const rest = argv.slice(1);
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '--level') levelId = rest[++i];
          else if (rest[i] === '--cut') cutPlaneOffsetMm = Number(rest[++i]);
          else if (rest[i] === '--name') name = rest[++i];
          else coords = rest.slice(i);
        }
        if (!levelId || !coords || coords.length < 4) {
          console.error('plan-region create: --level <id> x0 y0 x1 y1 required');
          process.exit(1);
        }
        const [x0, y0, x1, y1] = coords.map(Number);
        const cmd = {
          type: 'createPlanRegion',
          levelId,
          outlineMm: [
            { xMm: x0, yMm: y0 },
            { xMm: x1, yMm: y0 },
            { xMm: x1, yMm: y1 },
            { xMm: x0, yMm: y1 },
          ],
          ...(cutPlaneOffsetMm !== undefined ? { cutPlaneOffsetMm } : {}),
          ...(name !== undefined ? { name } : {}),
        };
        await commit(modelId, cmd);
        return;
      }
      if (sub === 'update') {
        if (!modelId) usage();
        const id = argv[1];
        if (!id) { console.error('plan-region update: <id> required'); process.exit(1); }
        const rest = argv.slice(2);
        const updates = { type: 'updatePlanRegion', id };
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '--cut') updates.cutPlaneOffsetMm = Number(rest[++i]);
          else if (rest[i] === '--name') updates.name = rest[++i];
        }
        await commit(modelId, updates);
        return;
      }
      if (sub === 'delete') {
        if (!modelId) usage();
        const id = argv[1];
        if (!id) { console.error('plan-region delete: <id> required'); process.exit(1); }
        await commit(modelId, { type: 'deletePlanRegion', id });
        return;
      }
      console.error(`Unknown plan-region subcommand: ${sub ?? '(none)'}. Use create, update, or delete.`);
      process.exit(1);
    }

    if (cmd === 'watch') {
      const url = wsUrl(modelId);
      console.error(`Watching ${url}`);
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => {
        const ping = { type: 'presence_update', peerId: 'cli', userId, name: 'bim-ai-cli' };
        ws.send(JSON.stringify(ping));
        setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(ping));
        }, 25_000);
      });
      ws.addEventListener('message', (ev) => {
        console.log(String(ev.data));
      });
      ws.addEventListener('close', () => process.exit(0));
      ws.addEventListener('error', () => {
        console.error('WebSocket error');
        process.exit(1);
      });
      return;
    }

    if (cmd === 'phase-create') {
      if (!modelId) usage();
      const name = argv[argv.indexOf('--name') + 1];
      const ordStr = argv[argv.indexOf('--ord') + 1];
      if (!name || !ordStr) { console.error('phase-create requires --name <name> --ord <n>'); process.exit(1); }
      await postCommand(modelId, userId, { type: 'createPhase', name, ord: Number(ordStr) });
      return;
    }

    if (cmd === 'phase-rename') {
      if (!modelId) usage();
      const phaseId = argv[argv.indexOf('--phase-id') + 1];
      const name = argv[argv.indexOf('--name') + 1];
      if (!phaseId || !name) { console.error('phase-rename requires --phase-id <id> --name <name>'); process.exit(1); }
      await postCommand(modelId, userId, { type: 'renamePhase', phaseId, name });
      return;
    }

    if (cmd === 'phase-reorder') {
      if (!modelId) usage();
      const phaseId = argv[argv.indexOf('--phase-id') + 1];
      const ordStr = argv[argv.indexOf('--ord') + 1];
      if (!phaseId || !ordStr) { console.error('phase-reorder requires --phase-id <id> --ord <n>'); process.exit(1); }
      await postCommand(modelId, userId, { type: 'reorderPhase', phaseId, ord: Number(ordStr) });
      return;
    }

    if (cmd === 'phase-delete') {
      if (!modelId) usage();
      const phaseId = argv[argv.indexOf('--phase-id') + 1];
      if (!phaseId) { console.error('phase-delete requires --phase-id <id>'); process.exit(1); }
      const payload = { type: 'deletePhase', phaseId };
      const retargetIdx = argv.indexOf('--retarget-to');
      if (retargetIdx !== -1) payload.retargetToPhaseId = argv[retargetIdx + 1];
      await postCommand(modelId, userId, payload);
      return;
    }

    if (cmd === 'element-set-phase') {
      if (!modelId) usage();
      const elementId = argv[argv.indexOf('--element-id') + 1];
      if (!elementId) { console.error('element-set-phase requires --element-id <id>'); process.exit(1); }
      const payload = { type: 'setElementPhase', elementId };
      const pcIdx = argv.indexOf('--phase-created-id');
      if (pcIdx !== -1) payload.phaseCreatedId = argv[pcIdx + 1];
      const pdIdx = argv.indexOf('--phase-demolished-id');
      if (pdIdx !== -1) payload.phaseDemolishedId = argv[pdIdx + 1];
      if (argv.includes('--clear-demolished')) payload.clearDemolished = true;
      await postCommand(modelId, userId, payload);
      return;
    }

    if (cmd === 'view-set-phase') {
      if (!modelId) usage();
      const viewId = argv[argv.indexOf('--view-id') + 1];
      const phaseId = argv[argv.indexOf('--phase-id') + 1];
      if (!viewId || !phaseId) { console.error('view-set-phase requires --view-id <id> --phase-id <id>'); process.exit(1); }
      await postCommand(modelId, userId, { type: 'setViewPhase', viewId, phaseId });
      return;
    }

    if (cmd === 'view-set-phase-filter') {
      if (!modelId) usage();
      const viewId = argv[argv.indexOf('--view-id') + 1];
      const phaseFilter = argv[argv.indexOf('--phase-filter') + 1];
      if (!viewId || !phaseFilter) {
        console.error('view-set-phase-filter requires --view-id <id> --phase-filter <filter>');
        process.exit(1);
      }
      await postCommand(modelId, userId, { type: 'setViewPhaseFilter', viewId, phaseFilter });
      return;
    }

    if (cmd === 'view-set-lens') {
      // DSC-V3-02: set discipline lens on a view
      if (!modelId) usage();
      const viewId = argv[argv.indexOf('--view-id') + 1];
      const lens = argv[argv.indexOf('--lens') + 1];
      if (!viewId || !lens) {
        console.error(
          'view-set-lens requires --view-id <id> --lens <show_arch|show_struct|show_mep|show_all>',
        );
        process.exit(1);
      }
      await postCommand(modelId, userId, { type: 'set_view_lens', viewId, lens });
      return;
    }

    if (cmd === 'detail-region') {
      // ANN-V3-01: draw a detail region polyline or closed hatch region on a view
      const [modelId, viewId, ...rest] = args;
      const vertices = JSON.parse(rest[0] || '[]');
      const closed = rest.includes('--closed');
      const hatchArg = rest.find((a) => a.startsWith('--hatch='));
      const hatchId = hatchArg ? hatchArg.split('=')[1] : null;
      const data = await apiFetch(`/api/v3/models/${modelId}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          commands: [
            {
              type: 'create_detail_region',
              id: crypto.randomUUID(),
              viewId,
              vertices,
              closed,
              hatchId,
            },
          ],
        }),
      });
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (cmd === 'toposolid') {
      const sub = argv[0];
      if (sub === 'create') {
        if (!modelId) usage();
        let boundary, thickness, name;
        const rest = argv.slice(1);
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '--boundary') boundary = rest[++i];
          else if (rest[i] === '--thickness') thickness = Number(rest[++i]);
          else if (rest[i] === '--name') name = rest[++i];
        }
        if (!boundary) { console.error('toposolid create: --boundary <json> required'); process.exit(1); }
        const boundaryMm = JSON.parse(boundary);
        const payload = { type: 'CreateToposolid', toposolidId: `topo-${Date.now()}`, boundaryMm, thicknessMm: thickness ?? 1500 };
        if (name !== undefined) payload.name = name;
        await commit(modelId, payload);
        return;
      }
      if (sub === 'update') {
        if (!modelId) usage();
        const id = argv[1];
        if (!id) { console.error('toposolid update: <id> required'); process.exit(1); }
        const rest = argv.slice(2);
        const payload = { type: 'UpdateToposolid', toposolidId: id };
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '--boundary') payload.boundaryMm = JSON.parse(rest[++i]);
          else if (rest[i] === '--thickness') payload.thicknessMm = Number(rest[++i]);
          else if (rest[i] === '--name') payload.name = rest[++i];
        }
        await commit(modelId, payload);
        return;
      }
      if (sub === 'delete') {
        if (!modelId) usage();
        const id = argv[1];
        if (!id) { console.error('toposolid delete: <id> required'); process.exit(1); }
        await commit(modelId, { type: 'DeleteToposolid', toposolidId: id });
        return;
      }
      console.error(`Unknown toposolid subcommand: ${sub ?? '(none)'}. Use create, update, or delete.`);
      process.exit(1);
    }

    if (cmd === 'trace') {
      const imageIdx = argv.indexOf('--image');
      if (imageIdx === -1) { console.error('trace requires --image <path>'); process.exit(1); }
      const imagePath = argv[imageIdx + 1];
      const briefIdx = argv.indexOf('--brief');
      const briefPath = briefIdx !== -1 ? argv[briefIdx + 1] : null;
      const archetypeIdx = argv.indexOf('--archetype-hint');
      const archetypeHint = archetypeIdx !== -1 ? argv[archetypeIdx + 1] : null;
      const outIdx = argv.indexOf('-o');
      const outPath = outIdx !== -1 ? argv[outIdx + 1] : null;

      const imageBytes = await fs.readFile(imagePath);
      const form = new FormData();
      form.append('image', new Blob([imageBytes]), path.basename(imagePath));
      if (briefPath) {
        const briefText = await fs.readFile(briefPath, 'utf8');
        form.append('brief', briefText);
      }
      let url = `${base}/api/v3/trace`;
      if (archetypeHint) url += `?archetypeHint=${encodeURIComponent(archetypeHint)}`;

      const res = await fetch(url, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        console.error(JSON.stringify(data, null, 2));
        process.exit(1);
      }
      if (data.jobId) {
        console.error(`Image >2MB — enqueued job ${data.jobId}. Poll with: bim-ai jobs get ${data.jobId}`);
        console.log(JSON.stringify(data, null, 2));
        process.exit(0);
      }
      const hasNoWalls = (data.advisories ?? []).some(a => a.code === 'no_walls_detected');
      const output = JSON.stringify(data, null, 2);
      if (outPath) {
        await fs.writeFile(outPath, output);
        console.error(`Wrote ${outPath}`);
      } else {
        console.log(output);
      }
      if (hasNoWalls) process.exit(1);
      return;
    }

    if (cmd === 'publish') {
      // OUT-V3-01: create / revoke / list presentation links
      const rest = argv.slice(1);
      const doLink = rest.includes('--link');
      const revokeIdx = rest.indexOf('--revoke');
      const doList = rest.includes('--list');

      if (doLink) {
        const modelArgIdx = rest.indexOf('--model');
        const modelArg = modelArgIdx !== -1 ? rest[modelArgIdx + 1] : modelId;
        if (!modelArg) {
          console.error('publish --link requires --model <id> or BIM_AI_MODEL_ID');
          process.exit(1);
        }
        const displayNameIdx = rest.indexOf('--display-name');
        const displayName = displayNameIdx !== -1 ? rest[displayNameIdx + 1] : undefined;
        const allowMeasurement = rest.includes('--allow-measurement');
        const allowComment = rest.includes('--allow-comment');
        const expiresAtIdx = rest.indexOf('--expires-at');
        const expiresAt = expiresAtIdx !== -1 ? Number(rest[expiresAtIdx + 1]) : undefined;

        const body = { allowMeasurement, allowComment };
        if (displayName) body.displayName = displayName;
        if (expiresAt) body.expiresAt = expiresAt;

        const result = await fetchJson(
          'POST',
          `${base}/api/models/${encodeURIComponent(modelArg)}/presentations`,
          body,
        );
        // Print the full URL if a relative /p/<token> URL was returned
        if (result.url && result.url.startsWith('/p/')) {
          result.url = `${base}${result.url}`;
        }
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (revokeIdx !== -1) {
        const linkId = rest[revokeIdx + 1];
        if (!linkId) {
          console.error('publish --revoke requires <link-id>');
          process.exit(1);
        }
        const modelArgIdx = rest.indexOf('--model');
        const modelArg = modelArgIdx !== -1 ? rest[modelArgIdx + 1] : modelId;
        if (!modelArg) {
          console.error('publish --revoke requires --model <id> or BIM_AI_MODEL_ID');
          process.exit(1);
        }
        const result = await fetchJson(
          'POST',
          `${base}/api/models/${encodeURIComponent(modelArg)}/presentations/${encodeURIComponent(linkId)}/revoke`,
        );
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (doList) {
        const modelArgIdx = rest.indexOf('--model');
        const modelArg = modelArgIdx !== -1 ? rest[modelArgIdx + 1] : modelId;
        if (!modelArg) {
          console.error('publish --list requires --model <id> or BIM_AI_MODEL_ID');
          process.exit(1);
        }
        const result = await fetchJson(
          'GET',
          `${base}/api/models/${encodeURIComponent(modelArg)}/presentations`,
        );
        for (const p of result.presentations ?? []) {
          const url = p.token ? `${base}/p/${p.token}` : '(no token)';
          const status = p.isRevoked ? '[revoked]' : '[active] ';
          console.log(`${status}  ${p.id}  ${url}  opens=${p.openCount ?? 0}`);
        }
        return;
      }

      console.error('publish: use --link, --revoke <link-id>, or --list');
      process.exit(1);
    }

    if (cmd === 'jobs') {
      const sub = argv[1];
      if (sub === 'submit') {
        const kind = argv[2];
        if (!kind) { console.error('jobs submit requires <kind>'); process.exit(1); }
        const modelArg = argv[argv.indexOf('--model') + 1] ?? modelId;
        if (!modelArg) { console.error('jobs submit requires --model <id> or BIM_AI_MODEL_ID'); process.exit(1); }
        const inputsIdx = argv.indexOf('--inputs');
        const inputs = inputsIdx !== -1 ? JSON.parse(argv[inputsIdx + 1]) : {};
        const result = await fetchJson('POST', `${base}/api/jobs`, { kind, modelId: modelArg, inputs });
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (sub === 'list') {
        const modelArg = argv[argv.indexOf('--model') + 1] ?? modelId;
        if (!modelArg) { console.error('jobs list requires --model <id> or BIM_AI_MODEL_ID'); process.exit(1); }
        const doWait = argv.includes('--wait');
        let jobs = await fetchJson('GET', `${base}/api/jobs?modelId=${encodeURIComponent(modelArg)}`);
        if (doWait) {
          const active = (j) => j.status === 'queued' || j.status === 'running';
          while (jobs.some(active)) {
            await new Promise((r) => setTimeout(r, 2000));
            jobs = await fetchJson('GET', `${base}/api/jobs?modelId=${encodeURIComponent(modelArg)}`);
          }
        }
        console.log(JSON.stringify(jobs, null, 2));
        return;
      }
      if (sub === 'cancel') {
        const jobId = argv[2];
        if (!jobId) { console.error('jobs cancel requires <job-id>'); process.exit(1); }
        const result = await fetchJson('POST', `${base}/api/jobs/${encodeURIComponent(jobId)}/cancel`);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (sub === 'status') {
        const jobId = argv[2];
        if (!jobId) { console.error('jobs status requires <job-id>'); process.exit(1); }
        const result = await fetchJson('GET', `${base}/api/jobs/${encodeURIComponent(jobId)}`);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.error(`Unknown jobs subcommand: ${sub ?? '(none)'}. Use submit | list | cancel | status.`);
      process.exit(1);
    }

    // AST-V3-01 — asset library subcommands
    if (cmd === 'asset') {
      const sub = argv[1];
      if (sub === 'index') {
        if (!modelId) usage();
        const rest = argv.slice(2);
        let name, category, assetKind, tagsArg, description;
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '--name' && rest[i + 1]) name = rest[++i];
          else if (a === '--category' && rest[i + 1]) category = rest[++i];
          else if (a === '--kind' && rest[i + 1]) assetKind = rest[++i];
          else if (a === '--tags' && rest[i + 1]) tagsArg = rest[++i];
          else if (a === '--description' && rest[i + 1]) description = rest[++i];
        }
        if (!name || !category) {
          console.error('asset index requires --name <name> --category <category>');
          process.exit(1);
        }
        const command = {
          type: 'IndexAsset',
          name,
          category,
          ...(assetKind ? { assetKind } : {}),
          ...(tagsArg ? { tags: tagsArg.split(',').map((t) => t.trim()).filter(Boolean) } : {}),
          ...(description ? { description } : {}),
        };
        await postCommand(modelId, userId, command);
        return;
      }
      if (sub === 'place') {
        if (!modelId) usage();
        const rest = argv.slice(2);
        const assetId = rest.find((_, i) => rest[i - 1] === '--asset');
        const levelId = rest.find((_, i) => rest[i - 1] === '--level');
        const posArg = rest.find((_, i) => rest[i - 1] === '--pos');
        const xArg = rest.find((_, i) => rest[i - 1] === '--x');
        const yArg = rest.find((_, i) => rest[i - 1] === '--y');
        const zArg = rest.find((_, i) => rest[i - 1] === '--z');
        if (!assetId) { console.error('asset place requires --asset <asset-id>'); process.exit(1); }
        if (!levelId) { console.error('asset place requires --level <level-id>'); process.exit(1); }
        let positionMm;
        if (posArg) {
          positionMm = parsePosTriple(posArg);
        } else if (xArg !== undefined && yArg !== undefined) {
          positionMm = { xMm: Number(xArg), yMm: Number(yArg), zMm: Number(zArg ?? 0) };
        } else {
          console.error('asset place requires --pos x,y,z or --x <n> --y <n>');
          process.exit(1);
        }
        const command = {
          type: 'PlaceAsset',
          assetId,
          levelId,
          positionMm: { xMm: positionMm.xMm, yMm: positionMm.yMm },
        };
        await postCommand(modelId, userId, command);
        return;
      }
      console.error(`Unknown asset subcommand: ${sub ?? '(none)'}. Use index | place.`);
      process.exit(1);
    }

    if (cmd === 'tool-pref') {
      if (!modelId) usage();
      const sub = argv[1];
      if (sub === 'set') {
        const rest = argv.slice(2);
        let tool, prefKey, prefValue;
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '--tool' && rest[i + 1]) tool = rest[++i];
          else if (rest[i] === '--pref' && rest[i + 1]) prefKey = rest[++i];
          else if (rest[i] === '--value' && rest[i + 1]) prefValue = rest[++i];
        }
        if (!tool || !prefKey || prefValue === undefined) {
          console.error('tool-pref set requires --tool <tool> --pref <key> --value <value>');
          process.exit(1);
        }
        await postCommand(modelId, userId, {
          type: 'setToolPref',
          tool,
          prefKey,
          prefValue,
        });
        return;
      }
      console.error(`Unknown tool-pref subcommand: ${sub ?? '(none)'}. Use set.`);
      process.exit(1);
    }

    if (cmd === 'import-neighborhood') {
      // OSM-V3-01: fetch OSM buildings and upsert into a model as neighborhood_mass elements
      const rest = argv.slice(1);
      let lat, lon, radiusM = 200, targetModelId;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--lat' && rest[i + 1]) lat = parseFloat(rest[++i]);
        else if (a === '--lon' && rest[i + 1]) lon = parseFloat(rest[++i]);
        else if (a === '--radius-m' && rest[i + 1]) radiusM = parseFloat(rest[++i]);
        else if (a === '--model-id' && rest[i + 1]) targetModelId = rest[++i];
      }
      if (lat == null || lon == null) {
        console.error(
          'Usage: bim-ai import-neighborhood --lat <lat> --lon <lon> [--radius-m 200] --model-id <id>',
        );
        process.exit(1);
      }
      const resolvedModelId = targetModelId ?? modelId;
      if (!resolvedModelId) {
        console.error('Provide --model-id <id> or set BIM_AI_MODEL_ID.');
        process.exit(1);
      }
      const result = await fetchJson(
        'POST',
        `${base}/api/v3/models/${encodeURIComponent(resolvedModelId)}/neighborhood-import`,
        { lat, lon, radiusM },
      );
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (cmd === 'compare') {
      // VG-V3-01: render-and-compare two snapshots
      const [pathA, pathB, ...rest] = argv.slice(1);
      await cmdCompare(pathA, pathB, rest);
      return;
    }

    if (cmd === 'checkpoint') {
      const rest = argv.slice(1);
      let targetPath, viewpointId, threshold, outPath;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--target' && rest[i + 1]) targetPath = rest[++i];
        else if (a === '--viewpoint' && rest[i + 1]) viewpointId = rest[++i];
        else if (a === '--threshold' && rest[i + 1]) threshold = rest[++i];
        else if (a === '--out' && rest[i + 1]) outPath = rest[++i];
      }
      await cmdCheckpoint(modelId, targetPath, viewpointId, threshold, outPath);
      return;
    }

    usage();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
