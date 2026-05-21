// Agent-iterate, agent loop, API tool registry, checkpoint, compare,
// and usage helpers extracted from cli.mjs.

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stdin } from 'node:process';

import { base, fetchJson } from './api-client.mjs';
import { comparePngFiles } from './png-visual-gate.mjs';

function slurpStdin() {
  return new Promise((resolve, reject) => {
    let s = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (c) => (s += c));
    stdin.on('end', () => resolve(s));
    stdin.on('error', reject);
  });
}

export async function readGoalText(goalArg) {
  if (!goalArg) return '';
  if (goalArg === '-') return slurpStdin();
  return fs.readFile(goalArg, 'utf8');
}

export function summariseValidate(val) {
  const violations = Array.isArray(val?.violations) ? val.violations : [];
  let blocking = 0;
  for (const v of violations) {
    const sev = String(v?.severity ?? v?.level ?? '').toLowerCase();
    if (['blocking', 'block', 'error', 'critical', 'high'].includes(sev)) blocking++;
  }
  return { violationCount: violations.length, blockingCount: blocking };
}

export function progressScore(goalText, snap, val) {
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

export async function agentIterate(modelId, goalText, snap, val, evidence, iteration, backendOverride) {
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

export async function cmdAgentLoop(modelId, goalPath, maxIter, evidenceOut, backendOverride) {
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

    const snap = await fetchJson(
      'GET',
      `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`,
    );
    const val = await fetchJson(
      'GET',
      `${base}/api/models/${encodeURIComponent(modelId)}/validate`,
    );
    const evidence = {
      revision: snap.revision ?? null,
      elementCount: snap.elements ? Object.keys(snap.elements).length : 0,
      validate: summariseValidate(val),
    };
    await fs.writeFile(path.join(iterDir, 'snapshot.json'), JSON.stringify(snap, null, 2));
    await fs.writeFile(path.join(iterDir, 'validate.json'), JSON.stringify(val, null, 2));
    await fs.writeFile(path.join(iterDir, 'evidence.json'), JSON.stringify(evidence, null, 2));

    const baselineScore = progressScore(goalText, snap, val);

    const patchResp = await agentIterate(
      modelId,
      goalText,
      snap,
      val,
      evidence,
      iter,
      backendOverride,
    );
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
      console.log(
        JSON.stringify({ ok: false, iteration: iter, status: 'dry-run-failed' }, null, 2),
      );
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

export async function cmdApiListTools(outputFormat) {
  const json = await fetchJson('GET', `${base}/api/v3/tools`);
  if (outputFormat === 'json') {
    console.log(JSON.stringify(json, null, 2));
  } else {
    for (const t of json.tools ?? []) {
      console.log(`${t.name}  [${t.category}]  ${t.restEndpoint?.method} ${t.restEndpoint?.path}`);
    }
  }
}

export async function cmdApiInspect(name, outputFormat) {
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

export async function cmdApiVersion() {
  const json = await fetchJson('GET', `${base}/api/v3/version`);
  console.log(JSON.stringify(json, null, 2));
}

export async function cmdCheckpoint(modelId, targetPath, viewpointId, threshold, outPath) {
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
    console.error(
      `[skb-03] Rendering snapshot via Playwright (viewpoint: ${viewpointId ?? 'fit'})...`,
    );
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

export async function cmdCompare(pathA, pathB, rest) {
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

export function usage() {
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
  model show|summary                  Model-scoped snapshot/summary aliases.
  model dry-run <bundle|-> [--parent-revision <rev>] [--actor-kind human|agent|mcp-client|ci]
                                      MCP-M2-H: submit cmd-v3 bundle to /bundles in dry_run mode.
  model commit-bundle <bundle|-> [--parent-revision <rev>] [--actor-kind human|agent|mcp-client|ci]
                     [--dry-run-evidence <json-or-path>]
                                      MCP-M2-H: submit cmd-v3 bundle to /bundles in commit mode.
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
  export pdf [--sheet-id <id>] [--out <path>]
                                      download sheet-preview.pdf (default: stdout; needs BIM_AI_MODEL_ID)
  export json [--out <path>]           snapshot JSON (full elements + violations; default: stdout; needs BIM_AI_MODEL_ID)
  documentation pack --sheet-id <id> [--sheet-name <n>] [--viewports <json-array>]
                     [--schedule-id <id> --schedule-category <kind> --place-schedule]
                     [--tags <json-array>] [--dimensions <json-array>] [--dry-run|--commit|--json]
                                      M3-B: generate a drawing-set cmd-v3 bundle for sheet,
                                      viewport, schedule, tag, dimension authoring.
  documentation presentation-pack --sheet-id <id> --canvas-id <id> --view-id <id>
                     [--brand-template-id <id>] [--schedule-id <id>] [--frames <json-array>]
                                      M4-E: generate a client presentation/documentation bundle
                                      with branded template, advanced docs, frames, and export evidence hooks.
  summary                             GET model summary rollup
  validate                            GET violations + summary + counts
  command-log [limit]                  GET undo/command history with full commands JSON
  apply [file|-]                       POST single command (server-authoritative; commits + broadcasts)
  apply-bundle [file|-] --base <rev> [--dry-run | --commit]
                                       CMD-V3-01: submit a cmd-v3.0 CommandBundle.
                                       Default: --dry-run (agent safety — force explicit --commit).
                                       [--tolerate <advisory-class>]... explicit override(s)
                                       [--assumptions <file>] load assumptions from JSON file
                                       [--actor-kind human|agent|mcp-client|ci]
                                       [--dry-run-evidence <json-or-path>] replay dry-run evidence on commit
                                       Exit: 0 ok, 2 revision_conflict, 3 assumption_log_*
  dry-run [file|-]                     POST single command dry-run
  plan-house --brief <path> --out <path> [--model-hint id]
                                       validate brief JSON → write neutral DSL starter bundle
  seed-dsl compile --recipe <path> --out <path> [--model-hint id]
                                       SKB: compile architectural seed DSL intent into a deterministic cmd-v3.0 bundle.
  sketch ir validate --ir <path> --out <dir> [--capabilities <path>]
                                       M3-F: validate Sketch Understanding IR and write an evidence packet.
  sketch seed compile --recipe <path> --out <path> [--model-hint id]
                                       M3-F: compile seed DSL through the product seed compiler.
  sketch phase apply --model <id> --bundle <path> --base <rev> [--dry-run|--commit] [--out <path>]
                                       M3-F: submit a phase bundle through the transaction route.
  sketch phase run --model <id> --ir <path> --phase <id> (--bundle <path>|--recipe <path>)
                   --base <rev> --out <dir> [--phase-plan <path>] [--mode <quality>]
                   [--dry-run|--commit] [--evidence-out <dir>] [--acceptance-out <dir>]
                                       SKB: one-command phase loop: apply, collect product
                                       evidence, and write the phase acceptance packet. Default
                                       apply mode is --dry-run; commits require explicit --commit.
  sketch phase accept --ir <path> --out <dir> [--capabilities <path>] [--evidence-dir <dir>] [--fail-on-acceptance]
                                       M3-F: evaluate phase packet acceptance gates and finding dispositions.
  sketch evidence collect --model <id> --out <dir> [--ir <path>] [--capabilities <path>] [--phase <id>] [--profile <name>]
                                       SKB: collect snapshot, validate, evidence package, Advisor
                                       warning/info/error, constructability, model stats, visual
                                       evidence contract, tolerance ledger, IFC/exchange
                                       validation, and manifest without browser automation.
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
                                       manifest, visual-gate scoring, exchange validation, and
                                       populated status/checklist artifacts.
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
  query summary                       MCP-M2-C: GET model summary.
  query elements [--kind wall] [--level <id>] [--include geometrySummary,hostRefs,raw]
                                      MCP-M2-C: snapshot-backed element discovery.
  query levels|types|views            MCP-M2-C: snapshot-backed level/type/view discovery.
  query hosts [--host-kind wall] [--level <id>]
                                      MCP-M2-C: host candidate discovery; local mirror until API v3 query routes land.
  query nearest-wall --point x,y,z [--level <id>] [--max-distance <mm>]
                                      MCP-M2-H: calls POST /api/models/:id/query/nearest-wall.
  resolve wall --line "x,y;x,y" [--level <id>] [--tolerance <mm>]
                                      MCP-M2-C: calls POST /api/models/:id/resolve/wall-by-line.
  resolve host-face --point x,y,z [--for-kind door] [--level <id>]
                                      MCP-M2-C: calls POST /api/models/:id/resolve/host-face.
  author wall --level <id> --line "x,y;x,y" [--dry-run|--commit|--json]
                                      MCP-M2-H: generate createWall cmd-v3 bundle.
  author wall-chain --level <id> --points "x,y;x,y;..." [--closed] [--dry-run|--commit|--json]
                                      MCP-M2-C: generate createWallChain cmd-v3 bundle.
  author floor-boundary --level <id> --boundary "x,y;x,y;..." [--dry-run|--commit|--json]
                                      MCP-M2-C: generate createFloor cmd-v3 bundle.
  author stair-between-levels --base-level <id> --top-level <id> --run "x,y;x,y" [--json]
                                      MCP-M3-K: generate typed createStair cmd-v3 bundle.
  author railing --path "x,y;x,y;..." [--hosted-stair <id>] [--json]
                                      MCP-M3-K: generate typed createRailing cmd-v3 bundle.
  opening door-on-wall|window-on-wall|wall-opening|roof-opening|slab-opening|shaft-opening ...
                                      MCP-M2/M3-K: generate hosted/opening cmd-v3 bundles.
  structure column|beam|column-update|constraint ...
                                      MCP-M4-B: generate structure typed cmd-v3 bundles.
  construction package|logistics|qa-checklist ...
                                      MCP-M4-B: generate construction-lite typed cmd-v3 bundles.
  site setup --reference-level <id> --boundary "x,y;..." [--json|--dry-run|--commit]
                                      M4-A: generate georeference/site context baseline bundle.
  site graded-region create|update|delete ...
  site property-line create|update|delete ...
  site base-point create|move|rotate ...
  site survey-point create|move ...
  site sun-settings create|update ...
  site excavation create|update|delete ...
  site subdivision update|delete ...
                                      M4-A: typed site/context cmd-v3 bundle mirrors.
  family upsert-type --id <id> [--name <n>] [--family-id <id>] [--parameters <json>] [--json]
                                      M4-D: generate upsertFamilyType cmd-v3 bundle.
  family place-instance --family-type <id> (--pos x,y | --x <n> --y <n>) [--level <id>] [--json]
                                      M4-D: generate placeFamilyInstance cmd-v3 bundle.
  material update-pbr --id <material-id> [--albedo-map <id>] [--normal-map <id>] [--json]
                                      M4-D: generate update_material_pbr cmd-v3 bundle.
  material assign --element <id> --material <key> [--json]
                                      M4-D: assign an element-level materialKey via typed bundle.
  material paint-face --element <id> --face <kind> --material <key> [--json]
                                      M4-D: set faceMaterialOverrides for supported wall faces.
  decal create --parent <id> --image-asset <id> [--surface front] [--uv-rect <json>] [--json]
                                      M4-D: generate create_decal cmd-v3 bundle.
  place-kitchen-kit --id <id> --host-wall <id> --start <mm> --end <mm> [--components <json>] [--json]
                                      M4-D: generate place_kit cmd-v3 bundle.
  view save-3d [--id <id>] [--name <n>] [--camera <json>] [--dry-run|--commit|--json]
                                      MCP-M2-H: generate saveViewpoint cmd-v3 bundle.
  qa advisor [--output json] [--severity info|warning|error]
                                      MCP-M2-H: advisor alias for agent evidence.
  qa integrity [--output json] [--changed-ids ids] [--dry-run-fixes|--commit-fixes]
                                      Profile-independent BIM integrity preflight and remediation loop.
  qa profiles [--profiles a,b,c] [--changed-ids ids]
                                      Compare Advisor profiles with timing/incremental diagnostics.
  qa rules [--output json] [--profile name] [--surface ui|api|cli|mcp|docs]
                                      List canonical Advisor rule metadata shared by UI/API/CLI/MCP.
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

