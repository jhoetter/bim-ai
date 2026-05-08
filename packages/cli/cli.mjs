#!/usr/bin/env node
/**
 * BIM AI CLI — agent-facing workflows + snapshot transport.
 * Node 20+ (fetch + WebSocket).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { stdin } from 'node:process';

import { buildOneFamilyHomeCommands } from './lib/one-family-home-commands.mjs';

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

async function cmdExport(kind, modelId, outPath) {
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
  apply-bundle [file|-]                POST bundle (atomic, server-ordered; see docs/collaboration-model.md)
  apply-bundle --dry-run [file|-]      POST bundle dry-run (no commit)
  dry-run [file|-]                     POST single command dry-run
  plan-house --brief <path> --out <path> [--model-hint id]
                                       validate brief JSON → write starter command bundle (one-family preset)
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
  watch                               WebSocket watcher (continuous live commits — no Synchronize step required)
  api list-tools [--output json]      API-V3-01: list all registered tool descriptors
  api inspect <name> [--output json]  API-V3-01: print one ToolDescriptor
  api version                         API-V3-01: print { schemaVersion, buildRef }

  phase-create --name <name> --ord <n>        KRN-V3-01: create a new phase (ord = ordinal position)
  phase-rename --phase-id <id> --name <name>   KRN-V3-01: rename an existing phase
  phase-reorder --phase-id <id> --ord <n>      KRN-V3-01: change a phase ordinal
  phase-delete --phase-id <id> [--retarget-to <id>] KRN-V3-01: delete a phase (retarget elements if needed)
  element-set-phase --element-id <id> [--phase-created-id <id>] [--phase-demolished-id <id>] [--clear-demolished]
                                                KRN-V3-01: set phase lifecycle on an element
  view-set-phase --view-id <id> --phase-id <id> KRN-V3-01: set the as-of phase for a plan view
  view-set-phase-filter --view-id <id> --phase-filter <filter>
                                                KRN-V3-01: set phase filter (show_all|show_new_plus_existing|show_demolition_only|show_existing_only|show_new_only)

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

  if (argv[0] === 'apply-bundle' && argv[1] === '--dry-run') {
    cmd = '__apply-bundle-dry';
    argv = argv.slice(2);
  }

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

    const pathArgFirst = argv[1];
    const pathArgDry = argv[1];

    if (cmd === 'export') {
      const rest = argv.slice(1);
      const k = rest[0];
      if (!k) usage();
      let outArg;
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] === '--out' && rest[i + 1]) outArg = rest[++i];
      }
      await cmdExport(k, modelId, outArg);
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

    if (!modelId && cmd !== 'schema' && cmd !== 'presets' && cmd !== 'plan-house' && cmd !== 'bootstrap' && cmd !== 'init-model')
      usage();

    if (cmd === 'snapshot') {
      await snapshot(modelId);
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
      const raw = (await readPayloadOrStdin(pathArgFirst)).trim();
      if (!raw) {
        console.error('Empty JSON for apply-bundle');
        process.exit(1);
      }
      const cmds = commandsFromBundleJson(JSON.parse(raw));
      await postBundle(modelId, userId, cmds);
      return;
    }

    if (cmd === '__apply-bundle-dry') {
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
      if (!viewId || !phaseFilter) { console.error('view-set-phase-filter requires --view-id <id> --phase-filter <filter>'); process.exit(1); }
      await postCommand(modelId, userId, { type: 'setViewPhaseFilter', viewId, phaseFilter });
      return;
    }


    usage();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
