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

async function cmdInitModel(projectId, slug) {
  const json = await fetchJson('POST', `${base}/api/projects/${encodeURIComponent(projectId)}/models`, {
    slug,
  });
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

function usage() {
  console.error(
    `bim-ai <command> [args]

Commands:
  bootstrap                           GET /api/bootstrap (projects + models)
  init-model --project-id <uuid> [--slug slug]
                                       POST empty model row (agents use BIM_AI_MODEL_ID from output)
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
  watch                               WebSocket watcher (continuous live commits — no Synchronize step required)

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
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--project-id' && rest[i + 1]) pid = rest[++i];
        else if (a === '--slug' && rest[i + 1]) slug = rest[++i];
      }
      if (!pid) {
        console.error('init-model requires --project-id <uuid> (run bim-ai bootstrap first).');
        usage();
      }
      await cmdInitModel(pid, slug);
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

    usage();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
