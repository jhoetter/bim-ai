#!/usr/bin/env node
/**
 * BIM AI CLI — agent-facing workflows + snapshot transport.
 * Node 20+ (fetch + WebSocket).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { stdin } from 'node:process';
import { execSync } from 'node:child_process';

import {
  DEFAULT_CAPABILITY_MATRIX_PATH,
  INITIATION_MODES,
  readJsonFile,
  writeInitiationPacket,
} from './lib/sketch-initiation.mjs';
import { comparePngFiles } from './lib/png-visual-gate.mjs';
import { compileSeedDsl } from './lib/seed-dsl.mjs';
import {
  base,
  fetchJson,
  fetchJsonResponse,
  fetchJsonResponseNoThrow,
  fetchOkBytes,
  fetchOkText,
  snapshot,
  wsUrl,
} from './lib/api-client.mjs';
import { advisorSummary } from './lib/advisor-summary.mjs';
import {
  flagValue,
  hasFlag,
  parseAlignMode,
  parseCsv,
  parseJsonArrayFlag,
  parseJsonObjectFlag,
  parseNumber,
  parsePoint2List,
  parsePosTriple,
  point2FromPair,
  samePoint2,
} from './lib/cli-args.mjs';
import {
  authorOptions,
  buildGeneratedBundle,
  bundleFromBlob,
  runGeneratedBundle,
} from './lib/generated-bundles.mjs';
import {
  cmdAdvisor,
  cmdAdvisorRules,
  cmdIntegrity,
  cmdProfileComparison,
} from './lib/qa-commands.mjs';
import {
  cmdQueryElements,
  cmdQueryHosts,
  cmdQueryLevels,
  cmdQuerySummary,
  cmdQueryTypes,
  cmdQueryViaBackend,
  cmdQueryViews,
  cmdResolveViaBackend,
} from './lib/query-commands.mjs';
import { cmdDocumentation } from './lib/documentation-commands.mjs';
import { cmdMep } from './lib/mep-commands.mjs';
import { cmdSite } from './lib/site-commands.mjs';
import {
  cmdDecal,
  cmdFamily,
  cmdMaterial,
  cmdPlaceKitchenKit,
} from './lib/family-material-commands.mjs';
import {
  applyQualityMode,
  cmdInitiationRun,
  cmdSketchEvidenceCollect,
  cmdSketchPhaseAccept,
  cmdSketchPhaseApply,
  cmdSketchPhaseRun,
  commandsFromBundleJson,
  safeArtifactName,
  writeJsonArtifact,
} from './lib/sketch-phase-workflows.mjs';

import {
  cmdApiInspect,
  cmdApiListTools,
  cmdApiVersion,
  cmdCheckpoint,
  cmdCompare,
  usage,
} from './lib/agent-api-commands.mjs';

import {
  cmdDiff,
  cmdExport,
  cmdInitiationCheck,
  cmdInitiationCompare,
  cmdInitiationGolden,
  cmdInitiationModes,
} from './lib/initiation-export-commands.mjs';

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

async function readJsonFlagPayload(value, flagName) {
  if (!value) return null;
  const raw = value.trim().startsWith('{') ? value : await fs.readFile(value, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`${flagName} must be JSON or a path to a JSON file: ${err.message}`);
    process.exit(1);
  }
}

// FED-01 polish: federation subcommands.

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
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
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

async function cmdModelBundle(modelId, userId, sub, args) {
  let fileArg;
  let parentRevision;
  let actorKind;
  let dryRunEvidenceArg;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--parent-revision' || arg === '--base') && args[i + 1]) {
      parentRevision = parseNumber(args[++i], arg);
    } else if (arg.startsWith('--parent-revision=')) {
      parentRevision = parseNumber(arg.slice('--parent-revision='.length), '--parent-revision');
    } else if (arg.startsWith('--base=')) {
      parentRevision = parseNumber(arg.slice('--base='.length), '--base');
    } else if (arg === '--actor-kind' && args[i + 1]) {
      actorKind = args[++i];
    } else if (arg.startsWith('--actor-kind=')) {
      actorKind = arg.slice('--actor-kind='.length);
    } else if (arg === '--dry-run-evidence' && args[i + 1]) {
      dryRunEvidenceArg = args[++i];
    } else if (arg.startsWith('--dry-run-evidence=')) {
      dryRunEvidenceArg = arg.slice('--dry-run-evidence='.length);
    } else if (arg === '-' || !arg.startsWith('-')) {
      fileArg = fileArg ?? arg;
    }
  }
  if (!fileArg) {
    console.error(`model ${sub} requires a bundle file path or - for stdin.`);
    process.exit(1);
  }
  const raw = (await readPayloadOrStdin(fileArg)).trim();
  if (!raw) {
    console.error(`Empty JSON for model ${sub}`);
    process.exit(1);
  }
  const bundle = bundleFromBlob(
    JSON.parse(raw),
    parentRevision,
    sub === 'commit-bundle' ? 'model.commit_bundle' : 'model.dry_run',
  );
  const dryRunEvidence = await readJsonFlagPayload(dryRunEvidenceArg, '--dry-run-evidence');
  await runGeneratedBundle(
    modelId,
    userId,
    bundle,
    sub === 'commit-bundle' ? 'commit' : 'dry_run',
    false,
    { actorKind, dryRunEvidence },
  );
}

async function cmdAuthor(modelId, userId, sub, args) {
  const opts = authorOptions(args);
  if (sub === 'wall') {
    const levelId = flagValue(args, '--level');
    const lineArg = flagValue(args, '--line');
    const line = lineArg
      ? parsePoint2List(lineArg, '--line')
      : [point2FromPair(flagValue(args, '--start')), point2FromPair(flagValue(args, '--end'))];
    if (!levelId) {
      console.error('author wall requires --level <id>.');
      process.exit(1);
    }
    if (
      line.length !== 2 ||
      line.some((point) => !Number.isFinite(point.xMm) || !Number.isFinite(point.yMm))
    ) {
      console.error('author wall requires --line "x,y;x,y" or --start x,y --end x,y.');
      process.exit(1);
    }
    const command = {
      type: 'createWall',
      levelId,
      start: line[0],
      end: line[1],
      name: flagValue(args, '--name') ?? 'Wall',
      thicknessMm: parseNumber(flagValue(args, '--thickness'), 200),
      heightMm: parseNumber(flagValue(args, '--height'), 2800),
    };
    const id = flagValue(args, '--id');
    const wallTypeId = flagValue(args, ['--wall-type', '--type']);
    if (id) command.id = id;
    if (wallTypeId) command.wallTypeId = wallTypeId;
    const bundle = buildGeneratedBundle({
      toolId: 'author.wall',
      commands: [command],
      parentRevision: opts.parentRevision,
    });
    await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
    return;
  }
  if (sub === 'wall-chain') {
    const levelId = flagValue(args, '--level');
    const points = parsePoint2List(flagValue(args, ['--points', '--boundary']));
    if (!levelId) {
      console.error('author wall-chain requires --level <id>.');
      process.exit(1);
    }
    const closed = hasFlag(args, '--closed');
    const chain =
      closed && !samePoint2(points[0], points[points.length - 1]) ? [...points, points[0]] : points;
    const heightMm = parseNumber(flagValue(args, '--height'), 2800);
    const thicknessMm = parseNumber(flagValue(args, '--thickness'), 200);
    const idPrefix = flagValue(args, '--id-prefix');
    const segments = [];
    for (let i = 0; i < chain.length - 1; i++) {
      segments.push({
        ...(idPrefix ? { id: `${idPrefix}-${i + 1}` } : {}),
        start: chain[i],
        end: chain[i + 1],
        thicknessMm,
        heightMm,
      });
    }
    const command = {
      type: 'createWallChain',
      levelId,
      namePrefix: flagValue(args, '--name-prefix') ?? 'Wall',
      segments,
    };
    const wallTypeId = flagValue(args, ['--wall-type', '--type']);
    if (wallTypeId) command.wallTypeId = wallTypeId;
    const bundle = buildGeneratedBundle({
      toolId: 'author.wall_chain',
      commands: [command],
      parentRevision: opts.parentRevision,
    });
    await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
    return;
  }
  if (sub === 'floor-boundary') {
    const levelId = flagValue(args, '--level');
    const boundaryMm = parsePoint2List(flagValue(args, ['--boundary', '--points']), '--boundary');
    if (!levelId) {
      console.error('author floor-boundary requires --level <id>.');
      process.exit(1);
    }
    const command = {
      type: 'createFloor',
      levelId,
      boundaryMm,
      name: flagValue(args, '--name') ?? 'Floor',
      thicknessMm: parseNumber(flagValue(args, '--thickness'), 220),
    };
    const id = flagValue(args, '--id');
    const floorTypeId = flagValue(args, ['--floor-type', '--type']);
    if (id) command.id = id;
    if (floorTypeId) command.floorTypeId = floorTypeId;
    const bundle = buildGeneratedBundle({
      toolId: 'author.floor_from_boundary',
      commands: [command],
      parentRevision: opts.parentRevision,
    });
    await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
    return;
  }
  if (sub === 'stair-between-levels') {
    const baseLevelId = flagValue(args, ['--base-level', '--base']);
    const topLevelId = flagValue(args, ['--top-level', '--top']);
    const run = parsePoint2List(flagValue(args, ['--run', '--line']), '--run');
    if (!baseLevelId || !topLevelId) {
      console.error('author stair-between-levels requires --base-level <id> --top-level <id>.');
      process.exit(1);
    }
    if (run.length !== 2) {
      console.error('author stair-between-levels requires --run "x,y;x,y".');
      process.exit(1);
    }
    const command = {
      type: 'createStair',
      baseLevelId,
      topLevelId,
      runStartMm: run[0],
      runEndMm: run[1],
      name: flagValue(args, '--name') ?? 'Stair',
      widthMm: parseNumber(flagValue(args, '--width'), 1000),
      riserMm: parseNumber(flagValue(args, '--riser'), 175),
      treadMm: parseNumber(flagValue(args, '--tread'), 275),
    };
    const id = flagValue(args, '--id');
    if (id) command.id = id;
    const bundle = buildGeneratedBundle({
      toolId: 'author.stair_between_levels',
      commands: [command],
      parentRevision: opts.parentRevision,
    });
    await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
    return;
  }
  if (sub === 'railing') {
    const pathMm = parsePoint2List(flagValue(args, ['--path', '--points']), '--path');
    const command = {
      type: 'createRailing',
      pathMm,
      name: flagValue(args, '--name') ?? 'Railing',
    };
    const id = flagValue(args, '--id');
    const hostedStairId = flagValue(args, ['--hosted-stair', '--stair']);
    const balusterPattern = parseJsonObjectFlag(
      flagValue(args, '--baluster-pattern'),
      '--baluster-pattern',
    );
    const handrailSupports = parseJsonArrayFlag(
      flagValue(args, '--handrail-supports'),
      '--handrail-supports',
    );
    if (id) command.id = id;
    if (hostedStairId) command.hostedStairId = hostedStairId;
    if (balusterPattern) command.balusterPattern = balusterPattern;
    if (handrailSupports.length) command.handrailSupports = handrailSupports;
    const bundle = buildGeneratedBundle({
      toolId: 'author.railing',
      commands: [command],
      parentRevision: opts.parentRevision,
    });
    await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
    return;
  }
  if (sub === 'opening') {
    await cmdOpening(modelId, userId, flagValue(args, '--kind') ?? 'wall-opening', args);
    return;
  }
  console.error(
    `Unknown author subcommand: ${sub ?? '(none)'}. Use wall | wall-chain | floor-boundary | stair-between-levels | railing | opening.`,
  );
  process.exit(1);
}

function defaultSave3dCamera() {
  return {
    position: { xMm: 8000, yMm: -8000, zMm: 5000 },
    target: { xMm: 0, yMm: 0, zMm: 0 },
    up: { xMm: 0, yMm: 0, zMm: 1 },
  };
}

function parseCamera(args) {
  const camera = parseJsonObjectFlag(flagValue(args, '--camera'), '--camera');
  if (camera) return camera;
  const positionArg = flagValue(args, '--position');
  const targetArg = flagValue(args, '--target');
  const upArg = flagValue(args, '--up');
  if (!positionArg && !targetArg && !upArg) return defaultSave3dCamera();
  return {
    position: positionArg ? parsePosTriple(positionArg) : defaultSave3dCamera().position,
    target: targetArg ? parsePosTriple(targetArg) : defaultSave3dCamera().target,
    up: upArg ? parsePosTriple(upArg) : defaultSave3dCamera().up,
  };
}

async function cmdView(modelId, userId, sub, args) {
  if (sub !== 'save-3d') {
    console.error(`Unknown view subcommand: ${sub ?? '(none)'}. Use save-3d.`);
    process.exit(1);
  }
  const opts = authorOptions(args);
  const command = {
    type: 'saveViewpoint',
    name: flagValue(args, '--name') ?? '3D View',
    mode: 'orbit_3d',
    camera: parseCamera(args),
    hiddenSemanticKinds3d: parseCsv(flagValue(args, '--hidden-kinds')),
  };
  const id = flagValue(args, '--id');
  const cutawayStyle = flagValue(args, '--cutaway-style');
  const cap = parseNumber(flagValue(args, '--clip-cap'), undefined);
  const floor = parseNumber(flagValue(args, '--clip-floor'), undefined);
  if (id) command.id = id;
  if (cutawayStyle) command.cutawayStyle = cutawayStyle;
  if (Number.isFinite(cap)) command.viewerClipCapElevMm = cap;
  if (Number.isFinite(floor)) command.viewerClipFloorElevMm = floor;
  const bundle = buildGeneratedBundle({
    toolId: 'view.save_3d',
    commands: [command],
    parentRevision: opts.parentRevision,
  });
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
}

async function cmdOpening(modelId, userId, sub, args) {
  const opts = authorOptions(args);
  let command;
  let toolId;
  if (sub === 'door-on-wall') {
    const wallId = flagValue(args, ['--wall', '--host-wall']);
    if (!wallId) {
      console.error('opening door-on-wall requires --wall <id>.');
      process.exit(1);
    }
    command = {
      type: 'insertDoorOnWall',
      wallId,
      alongT: parseNumber(flagValue(args, '--along-t'), 0.5),
      widthMm: parseNumber(flagValue(args, '--width'), 900),
      name: flagValue(args, '--name') ?? 'Door',
    };
    const id = flagValue(args, '--id');
    const familyTypeId = flagValue(args, ['--family-type', '--type']);
    if (id) command.id = id;
    if (familyTypeId) command.familyTypeId = familyTypeId;
    toolId = 'opening.door_on_wall';
  } else if (sub === 'window-on-wall') {
    const wallId = flagValue(args, ['--wall', '--host-wall']);
    if (!wallId) {
      console.error('opening window-on-wall requires --wall <id>.');
      process.exit(1);
    }
    command = {
      type: 'insertWindowOnWall',
      wallId,
      alongT: parseNumber(flagValue(args, '--along-t'), 0.5),
      widthMm: parseNumber(flagValue(args, '--width'), 1200),
      sillHeightMm: parseNumber(flagValue(args, '--sill-height'), 900),
      heightMm: parseNumber(flagValue(args, '--height'), 1500),
      name: flagValue(args, '--name') ?? 'Window',
    };
    const id = flagValue(args, '--id');
    const familyTypeId = flagValue(args, ['--family-type', '--type']);
    if (id) command.id = id;
    if (familyTypeId) command.familyTypeId = familyTypeId;
    toolId = 'opening.window_on_wall';
  } else if (sub === 'wall-opening') {
    const hostWallId = flagValue(args, ['--wall', '--host-wall']);
    if (!hostWallId) {
      console.error('opening wall-opening requires --wall <id>.');
      process.exit(1);
    }
    command = {
      type: 'createWallOpening',
      hostWallId,
      alongTStart: parseNumber(flagValue(args, '--along-t-start'), 0.4),
      alongTEnd: parseNumber(flagValue(args, '--along-t-end'), 0.6),
      sillHeightMm: parseNumber(flagValue(args, '--sill-height'), 0),
      headHeightMm: parseNumber(flagValue(args, '--head-height'), 2100),
      name: flagValue(args, '--name') ?? 'Wall opening',
    };
    const id = flagValue(args, '--id');
    if (id) command.id = id;
    toolId = 'opening.wall_opening';
  } else if (sub === 'roof-opening') {
    const hostRoofId = flagValue(args, ['--roof', '--host-roof']);
    if (!hostRoofId) {
      console.error('opening roof-opening requires --roof <id>.');
      process.exit(1);
    }
    command = {
      type: 'createRoofOpening',
      hostRoofId,
      boundaryMm: parsePoint2List(flagValue(args, ['--boundary', '--points']), '--boundary'),
      name: flagValue(args, '--name') ?? 'Roof opening',
    };
    const id = flagValue(args, '--id');
    if (id) command.id = id;
    toolId = 'opening.roof_opening';
  } else if (sub === 'slab-opening' || sub === 'shaft-opening') {
    const hostFloorId = flagValue(args, ['--floor', '--host-floor']);
    if (!hostFloorId) {
      console.error(`opening ${sub} requires --floor <id>.`);
      process.exit(1);
    }
    command = {
      type: 'createSlabOpening',
      hostFloorId,
      boundaryMm: parsePoint2List(flagValue(args, ['--boundary', '--points']), '--boundary'),
      isShaft: sub === 'shaft-opening' || hasFlag(args, '--shaft'),
      name:
        flagValue(args, '--name') ?? (sub === 'shaft-opening' ? 'Shaft opening' : 'Slab opening'),
    };
    const id = flagValue(args, '--id');
    if (id) command.id = id;
    toolId = sub === 'shaft-opening' ? 'opening.shaft_opening' : 'opening.slab_opening';
  } else {
    console.error(
      `Unknown opening subcommand: ${sub ?? '(none)'}. Use door-on-wall | window-on-wall | wall-opening | roof-opening | slab-opening | shaft-opening.`,
    );
    process.exit(1);
  }
  const bundle = buildGeneratedBundle({
    toolId,
    commands: [command],
    parentRevision: opts.parentRevision,
  });
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
}

async function cmdStructure(modelId, userId, sub, args) {
  const opts = authorOptions(args);
  let command;
  let toolId;
  if (sub === 'column') {
    const levelId = flagValue(args, '--level');
    if (!levelId) {
      console.error('structure column requires --level <id>.');
      process.exit(1);
    }
    command = {
      type: 'createColumn',
      levelId,
      positionMm: point2FromPair(flagValue(args, ['--position', '--point'])),
      name: flagValue(args, '--name') ?? 'Column',
      bMm: parseNumber(flagValue(args, '--b'), 300),
      hMm: parseNumber(flagValue(args, '--h'), 300),
      heightMm: parseNumber(flagValue(args, '--height'), 2800),
      rotationDeg: parseNumber(flagValue(args, '--rotation'), 0),
    };
    const id = flagValue(args, '--id');
    const materialKey = flagValue(args, '--material-key');
    if (id) command.id = id;
    if (materialKey) command.materialKey = materialKey;
    toolId = 'structure.column';
  } else if (sub === 'beam') {
    const levelId = flagValue(args, '--level');
    const line = parsePoint2List(flagValue(args, ['--line', '--points']), '--line');
    if (!levelId) {
      console.error('structure beam requires --level <id>.');
      process.exit(1);
    }
    if (line.length !== 2) {
      console.error('structure beam requires --line "x,y;x,y".');
      process.exit(1);
    }
    command = {
      type: 'createBeam',
      levelId,
      startMm: line[0],
      endMm: line[1],
      name: flagValue(args, '--name') ?? 'Beam',
      widthMm: parseNumber(flagValue(args, '--width'), 200),
      heightMm: parseNumber(flagValue(args, '--height'), 400),
    };
    const id = flagValue(args, '--id');
    const materialKey = flagValue(args, '--material-key');
    if (id) command.id = id;
    if (materialKey) command.materialKey = materialKey;
    toolId = 'structure.beam';
  } else if (sub === 'column-update') {
    const id = flagValue(args, '--id');
    if (!id) {
      console.error('structure column-update requires --id <column-id>.');
      process.exit(1);
    }
    command = { type: 'updateColumn', id };
    const bMm = parseNumber(flagValue(args, '--b'), undefined);
    const hMm = parseNumber(flagValue(args, '--h'), undefined);
    if (Number.isFinite(bMm)) command.bMm = bMm;
    if (Number.isFinite(hMm)) command.hMm = hMm;
    if (!Number.isFinite(bMm) && !Number.isFinite(hMm)) {
      console.error('structure column-update requires --b or --h.');
      process.exit(1);
    }
    toolId = 'structure.column_update';
  } else if (sub === 'constraint') {
    command = {
      type: 'createConstraint',
      rule: flagValue(args, '--rule') ?? 'equal_distance',
      refsA: parseJsonArrayFlag(flagValue(args, '--refs-a'), '--refs-a'),
      refsB: parseJsonArrayFlag(flagValue(args, '--refs-b'), '--refs-b'),
      name: flagValue(args, '--name') ?? '',
      severity: flagValue(args, '--severity') ?? 'error',
    };
    const id = flagValue(args, '--id');
    const lockedValueMm = parseNumber(flagValue(args, '--locked-value'), undefined);
    if (id) command.id = id;
    if (Number.isFinite(lockedValueMm)) command.lockedValueMm = lockedValueMm;
    toolId = 'structure.constraint';
  } else {
    console.error(
      `Unknown structure subcommand: ${sub ?? '(none)'}. Use column | beam | column-update | constraint.`,
    );
    process.exit(1);
  }
  const bundle = buildGeneratedBundle({
    toolId,
    commands: [command],
    parentRevision: opts.parentRevision,
  });
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
}

async function cmdConstruction(modelId, userId, sub, args) {
  const opts = authorOptions(args);
  let command;
  let toolId;
  if (sub === 'package') {
    const name = flagValue(args, '--name');
    if (!name) {
      console.error('construction package requires --name <name>.');
      process.exit(1);
    }
    command = { type: 'createConstructionPackage', name };
    const id = flagValue(args, '--id');
    const code = flagValue(args, '--code');
    const phaseId = flagValue(args, '--phase');
    const responsibleCompany = flagValue(args, '--responsible-company');
    if (id) command.id = id;
    if (code) command.code = code;
    if (phaseId) command.phaseId = phaseId;
    if (responsibleCompany) command.responsibleCompany = responsibleCompany;
    const plannedStart = flagValue(args, '--planned-start');
    const plannedEnd = flagValue(args, '--planned-end');
    if (plannedStart) command.plannedStart = plannedStart;
    if (plannedEnd) command.plannedEnd = plannedEnd;
    const dependencies = parseCsv(flagValue(args, '--dependencies'));
    if (dependencies.length) command.dependencies = dependencies;
    toolId = 'construction.package';
  } else if (sub === 'logistics') {
    const name = flagValue(args, '--name');
    const logisticsKind = flagValue(args, '--kind');
    if (!name || !logisticsKind) {
      console.error('construction logistics requires --name <name> --kind <kind>.');
      process.exit(1);
    }
    command = {
      type: 'createConstructionLogistics',
      name,
      logisticsKind,
      boundaryMm: flagValue(args, '--boundary')
        ? parsePoint2List(flagValue(args, '--boundary'), '--boundary')
        : [],
      pathMm: flagValue(args, '--path') ? parsePoint2List(flagValue(args, '--path'), '--path') : [],
      progressStatus: flagValue(args, '--progress-status') ?? 'not_started',
    };
    if (!command.boundaryMm.length && !command.pathMm.length) {
      console.error('construction logistics requires --boundary or --path.');
      process.exit(1);
    }
    const id = flagValue(args, '--id');
    const phaseId = flagValue(args, '--phase');
    const constructionPackageId = flagValue(args, ['--package', '--package-id']);
    const responsibleCompany = flagValue(args, '--responsible-company');
    if (id) command.id = id;
    if (phaseId) command.phaseId = phaseId;
    if (constructionPackageId) command.constructionPackageId = constructionPackageId;
    if (responsibleCompany) command.responsibleCompany = responsibleCompany;
    toolId = 'construction.logistics';
  } else if (sub === 'qa-checklist') {
    const name = flagValue(args, '--name');
    if (!name) {
      console.error('construction qa-checklist requires --name <name>.');
      process.exit(1);
    }
    command = {
      type: 'upsertConstructionQaChecklist',
      name,
      targetElementIds: parseCsv(flagValue(args, '--targets')),
      checklist: parseJsonArrayFlag(flagValue(args, '--checklist'), '--checklist'),
      progressStatus: flagValue(args, '--progress-status') ?? 'not_started',
    };
    const id = flagValue(args, '--id');
    const phaseId = flagValue(args, '--phase');
    const constructionPackageId = flagValue(args, ['--package', '--package-id']);
    const responsibleCompany = flagValue(args, '--responsible-company');
    if (id) command.id = id;
    if (phaseId) command.phaseId = phaseId;
    if (constructionPackageId) command.constructionPackageId = constructionPackageId;
    if (responsibleCompany) command.responsibleCompany = responsibleCompany;
    toolId = 'construction.qa_checklist';
  } else {
    console.error(
      `Unknown construction subcommand: ${sub ?? '(none)'}. Use package | logistics | qa-checklist.`,
    );
    process.exit(1);
  }
  const bundle = buildGeneratedBundle({
    toolId,
    commands: [command],
    parentRevision: opts.parentRevision,
  });
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
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
    const k = row && typeof row === 'object' && typeof row.kind === 'string' ? row.kind : '?';
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
  if (columnsList && String(columnsList).trim())
    parts.push(`columns=${encodeURIComponent(columnsList)}`);
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

  const ifc = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/exports/ifc-manifest`,
  );
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
  const widthMm = Math.round(Number(brief.siteWidthM) * 1000);
  const depthMm = Math.round(Number(brief.siteDepthM) * 1000);
  const floors = Math.max(1, Number(brief.floors));
  const levelIds = Array.from({ length: floors }, (_, index) =>
    index === 0 ? 'lvl-ground' : `lvl-${index + 1}`,
  );
  const levels = levelIds.map((id, index) => ({
    id,
    name: index === 0 ? 'Ground Floor' : `Level ${index + 1}`,
    elevationMm: index * 3000,
  }));
  const roomCount = Math.max(1, brief.rooms.length);
  const bayWidthMm = Math.max(1800, Math.floor(widthMm / roomCount));
  const roomDepthMm = Math.max(1800, Math.floor(depthMm * 0.55));
  const rooms = brief.rooms.map((room, index) => {
    const x0 = Math.min(widthMm - 1200, index * bayWidthMm);
    const x1 = Math.min(widthMm, x0 + bayWidthMm);
    const y0 = 0;
    const y1 = Math.min(depthMm, roomDepthMm);
    return {
      id: `room-${index + 1}`,
      name: room.name,
      levelId:
        levelIds[Math.min(levelIds.length - 1, Math.floor(index / Math.ceil(roomCount / floors)))],
      programmeCode: room.programmeCode ?? null,
      targetAreaM2: room.areaTargetM2,
      outlineMm: [
        { xMm: x0, yMm: y0 },
        { xMm: x1, yMm: y0 },
        { xMm: x1, yMm: y1 },
        { xMm: x0, yMm: y1 },
      ],
    };
  });
  const recipe = {
    schemaVersion: 'seed-dsl.v0',
    id: brief.id ?? 'plan-house-starter',
    intent:
      'Neutral plan-house starter bundle. Replace with a named seed artifact for project initiation.',
    levels,
    types: {
      wallTypes: [
        {
          id: 'wt-exterior',
          name: 'Exterior wall',
          layers: [{ thicknessMm: 220, function: 'structure', materialKey: 'concrete_smooth' }],
        },
        {
          id: 'wt-internal',
          name: 'Internal partition',
          layers: [{ thicknessMm: 120, function: 'finish', materialKey: 'plasterboard' }],
        },
      ],
      floorTypes: [
        {
          id: 'ft-slab',
          name: 'Concrete slab',
          layers: [{ thicknessMm: 220, function: 'structure', materialKey: 'concrete_smooth' }],
        },
      ],
    },
    volumes: levels.map((level) => ({
      id: `volume-${level.id}`,
      name: `${level.name} starter envelope`,
      levelId: level.id,
      wallHeightMm: 3000,
      wallTypeId: 'wt-exterior',
      floorTypeId: 'ft-slab',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: widthMm, yMm: 0 },
        { xMm: widthMm, yMm: depthMm },
        { xMm: 0, yMm: depthMm },
      ],
    })),
    rooms,
    viewpoints: [
      {
        id: 'view-main',
        name: 'Main starter view',
        camera: {
          position: { xMm: -widthMm, yMm: -depthMm, zMm: 7000 },
          target: { xMm: widthMm / 2, yMm: depthMm / 2, zMm: 1500 },
          up: { xMm: 0, yMm: 0, zMm: 1 },
        },
      },
    ],
    assumptions: [
      {
        key: 'plan-house-starter',
        value:
          'Generated as a neutral starter only; package real project-initiation seeds as named seed artifacts.',
        confidence: 1,
        source: '@bim-ai/cli plan-house',
      },
    ],
  };
  const bundle = compileSeedDsl(recipe, { modelHint: modelIdPlaceholder });
  return {
    ...bundle,
    meta: {
      ...bundle.meta,
      generatedBy: '@bim-ai/cli plan-house',
      modelIdPlaceholder,
      brief,
    },
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
  console.log(
    JSON.stringify({ ok: true, out: outPath, commandCount: bundle.commands.length }, null, 2),
  );
}

async function cmdSeedDslCompile(recipePath, outPath, modelHint) {
  const recipe = await readJsonFile(recipePath);
  const bundle = compileSeedDsl(recipe, { modelHint });
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify(
      {
        ok: true,
        out: outPath,
        schemaVersion: bundle.schemaVersion,
        commandCount: bundle.commands.length,
      },
      null,
      2,
    ),
  );
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
    if (cmd === 'sketch') {
      const area = argv[1];
      const subcmd = argv[2];
      const rest = argv.slice(3);
      if (area === 'ir' && subcmd === 'validate') {
        let irArg;
        let outArg;
        let capabilityArg = DEFAULT_CAPABILITY_MATRIX_PATH;
        let qualityMode;
        let failOnAcceptance = false;
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '--ir' && rest[i + 1]) irArg = rest[++i];
          else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
          else if (a === '--capabilities' && rest[i + 1]) capabilityArg = rest[++i];
          else if (a === '--capability-matrix' && rest[i + 1]) capabilityArg = rest[++i];
          else if (a === '--model' && rest[i + 1]) modelId = rest[++i];
          else if (a === '--mode' && rest[i + 1]) qualityMode = rest[++i];
          else if (a === '--fail-on-acceptance') failOnAcceptance = true;
        }
        if (!irArg || !outArg) {
          console.error('sketch ir validate requires --ir <path> --out <dir>.');
          usage();
        }
        await cmdInitiationCheck(
          irArg,
          capabilityArg,
          outArg,
          modelId,
          false,
          qualityMode,
          failOnAcceptance,
        );
        return;
      }
      if (area === 'seed' && subcmd === 'compile') {
        let recipeArg;
        let outArg;
        let modelHint;
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '--recipe' && rest[i + 1]) recipeArg = rest[++i];
          else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
          else if (a === '--model-hint' && rest[i + 1]) modelHint = rest[++i];
        }
        if (!recipeArg || !outArg) usage();
        await cmdSeedDslCompile(recipeArg, outArg, modelHint);
        return;
      }
      if (area === 'phase' && subcmd === 'apply') {
        let bundlePath;
        let baseRevision;
        let applyMode = 'dry_run';
        let outPath;
        let phaseId;
        let featureIds = [];
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '--model' && rest[i + 1]) modelId = rest[++i];
          else if (a === '--bundle' && rest[i + 1]) bundlePath = rest[++i];
          else if (a === '--base' && rest[i + 1]) baseRevision = Number(rest[++i]);
          else if (a === '--parent-revision' && rest[i + 1]) baseRevision = Number(rest[++i]);
          else if (a === '--commit') applyMode = 'commit';
          else if (a === '--dry-run') applyMode = 'dry_run';
          else if (a === '--out' && rest[i + 1]) outPath = rest[++i];
          else if (a === '--phase' && rest[i + 1]) phaseId = rest[++i];
          else if (a === '--phase-id' && rest[i + 1]) phaseId = rest[++i];
          else if (a === '--features' && rest[i + 1]) featureIds = parseCsv(rest[++i]);
        }
        await cmdSketchPhaseApply({
          modelId,
          userId,
          bundlePath,
          baseRevision,
          applyMode,
          outPath,
          phaseId,
          featureIds,
        });
        return;
      }
      if (area === 'phase' && subcmd === 'run') {
        let irArg;
        let phasePlanArg;
        let recipeArg;
        let bundlePath;
        let bundleOutPath;
        let baseRevision;
        let applyMode = 'dry_run';
        let outArg;
        let evidenceOutArg;
        let acceptanceOutArg;
        let applyOutPath;
        let capabilityArg = DEFAULT_CAPABILITY_MATRIX_PATH;
        let qualityMode;
        let phaseId;
        let featureIds = [];
        let constructabilityProfile = 'construction_readiness';
        let failOnAcceptance = false;
        let failOnBlockingDispositions = false;
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '--model' && rest[i + 1]) modelId = rest[++i];
          else if (a === '--ir' && rest[i + 1]) irArg = rest[++i];
          else if (a === '--phase-plan' && rest[i + 1]) phasePlanArg = rest[++i];
          else if (a === '--plan' && rest[i + 1]) phasePlanArg = rest[++i];
          else if (a === '--recipe' && rest[i + 1]) recipeArg = rest[++i];
          else if (a === '--bundle' && rest[i + 1]) bundlePath = rest[++i];
          else if (a === '--bundle-out' && rest[i + 1]) bundleOutPath = rest[++i];
          else if (a === '--base' && rest[i + 1]) baseRevision = Number(rest[++i]);
          else if (a === '--parent-revision' && rest[i + 1]) baseRevision = Number(rest[++i]);
          else if (a === '--commit') applyMode = 'commit';
          else if (a === '--dry-run') applyMode = 'dry_run';
          else if (a === '--apply-mode' && rest[i + 1]) {
            const value = rest[++i];
            if (value === 'commit') applyMode = 'commit';
            else if (value === 'dry-run' || value === 'dry_run') applyMode = 'dry_run';
            else {
              console.error('--apply-mode must be dry-run or commit.');
              process.exit(1);
            }
          } else if (a === '--mode' && rest[i + 1]) {
            const value = rest[++i];
            if (value === 'commit') applyMode = 'commit';
            else if (value === 'dry-run' || value === 'dry_run') applyMode = 'dry_run';
            else qualityMode = value;
          } else if (a === '--quality-mode' && rest[i + 1]) qualityMode = rest[++i];
          else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
          else if (a === '--evidence-out' && rest[i + 1]) evidenceOutArg = rest[++i];
          else if (a === '--acceptance-out' && rest[i + 1]) acceptanceOutArg = rest[++i];
          else if (a === '--apply-out' && rest[i + 1]) applyOutPath = rest[++i];
          else if (a === '--capabilities' && rest[i + 1]) capabilityArg = rest[++i];
          else if (a === '--capability-matrix' && rest[i + 1]) capabilityArg = rest[++i];
          else if (a === '--phase' && rest[i + 1]) phaseId = rest[++i];
          else if (a === '--phase-id' && rest[i + 1]) phaseId = rest[++i];
          else if (a === '--features' && rest[i + 1]) featureIds = parseCsv(rest[++i]);
          else if (a === '--constructability-profile' && rest[i + 1])
            constructabilityProfile = rest[++i];
          else if (a === '--profile' && rest[i + 1]) constructabilityProfile = rest[++i];
          else if (a === '--fail-on-acceptance') failOnAcceptance = true;
          else if (a === '--fail-on-blocking-dispositions') failOnBlockingDispositions = true;
        }
        await cmdSketchPhaseRun({
          modelId,
          userId,
          irPath: irArg,
          phasePlanPath: phasePlanArg,
          recipePath: recipeArg,
          bundlePath,
          bundleOutPath,
          baseRevision,
          applyMode,
          outDir: outArg,
          evidenceDir: evidenceOutArg,
          acceptanceOutDir: acceptanceOutArg,
          applyOutPath,
          capabilityMatrixPath: capabilityArg,
          qualityMode,
          phaseId,
          featureIds,
          constructabilityProfile,
          failOnAcceptance,
          failOnBlockingDispositions,
        });
        return;
      }
      if (area === 'phase' && subcmd === 'accept') {
        let irArg;
        let outArg;
        let capabilityArg = DEFAULT_CAPABILITY_MATRIX_PATH;
        let qualityMode;
        let failOnAcceptance = false;
        let phaseId;
        let evidenceDir;
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '--ir' && rest[i + 1]) irArg = rest[++i];
          else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
          else if (a === '--capabilities' && rest[i + 1]) capabilityArg = rest[++i];
          else if (a === '--capability-matrix' && rest[i + 1]) capabilityArg = rest[++i];
          else if (a === '--model' && rest[i + 1]) modelId = rest[++i];
          else if (a === '--mode' && rest[i + 1]) qualityMode = rest[++i];
          else if (a === '--phase' && rest[i + 1]) phaseId = rest[++i];
          else if (a === '--phase-id' && rest[i + 1]) phaseId = rest[++i];
          else if (a === '--evidence-dir' && rest[i + 1]) evidenceDir = rest[++i];
          else if (a === '--fail-on-acceptance') failOnAcceptance = true;
        }
        if (!irArg || !outArg) {
          console.error('sketch phase accept requires --ir <path> --out <dir>.');
          usage();
        }
        await cmdSketchPhaseAccept({
          irPath: irArg,
          capabilityMatrixPath: capabilityArg,
          outDir: outArg,
          modelId,
          qualityMode,
          failOnAcceptance,
          phaseId,
          evidenceDir,
        });
        return;
      }
      if (area === 'evidence' && subcmd === 'collect') {
        let outArg;
        let irArg;
        let capabilityArg = DEFAULT_CAPABILITY_MATRIX_PATH;
        let phaseId;
        let constructabilityProfile = 'construction_readiness';
        let failOnBlockingDispositions = false;
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '--model' && rest[i + 1]) modelId = rest[++i];
          else if (a === '--out' && rest[i + 1]) outArg = rest[++i];
          else if (a === '--ir' && rest[i + 1]) irArg = rest[++i];
          else if (a === '--capabilities' && rest[i + 1]) capabilityArg = rest[++i];
          else if (a === '--capability-matrix' && rest[i + 1]) capabilityArg = rest[++i];
          else if (a === '--phase' && rest[i + 1]) phaseId = rest[++i];
          else if (a === '--phase-id' && rest[i + 1]) phaseId = rest[++i];
          else if (a === '--constructability-profile' && rest[i + 1])
            constructabilityProfile = rest[++i];
          else if (a === '--profile' && rest[i + 1]) constructabilityProfile = rest[++i];
          else if (a === '--fail-on-blocking-dispositions') failOnBlockingDispositions = true;
        }
        await cmdSketchEvidenceCollect({
          modelId,
          outDir: outArg,
          irPath: irArg,
          capabilityMatrixPath: capabilityArg,
          phaseId,
          constructabilityProfile,
          failOnBlockingDispositions,
        });
        return;
      }
      usage();
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
      await cmdInitiationCheck(
        irArg,
        capabilityArg,
        outArg,
        modelId,
        live,
        qualityMode,
        failOnAcceptance,
      );
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
      let sheetIdArg;
      for (let i = 1; i < rest.length; i++) {
        const a = rest[i];
        if ((a === '--out' || a === '-o') && rest[i + 1]) outArg = rest[++i];
        else if (a === '--view' && rest[i + 1]) viewIdArg = rest[++i];
        else if (a === '--sheet-id' && rest[i + 1]) sheetIdArg = rest[++i];
      }
      await cmdExport(k, modelId, outArg, viewIdArg, sheetIdArg);
      return;
    }
    if (cmd === 'documentation') {
      if (!modelId) usage();
      await cmdDocumentation(modelId, userId, argv[1], argv.slice(2));
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
      console.error(
        `Unknown api subcommand: ${sub ?? '(none)'}. Use list-tools | inspect | version.`,
      );
      process.exit(1);
    }

    if (cmd === 'catalog') {
      const subCmd = argv[1];
      if (subCmd === 'query') {
        const rest = argv.slice(2);
        const params = new URLSearchParams();
        const pick = (flag) => rest.find((a) => a.startsWith(`--${flag}=`))?.split('=')[1];
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
        else result.items.forEach((i) => console.log(`${i.id}\t${i.kind}\t${i.widthMm ?? ''}`));
        return;
      } else {
        console.error(
          'Usage: bim-ai catalog query [--kind <kind>] [--max-width <mm>] [--tag <name>] [--style <key>] [--output json|table]',
        );
        process.exit(1);
      }
    }

    if (
      !modelId &&
      cmd !== 'schema' &&
      cmd !== 'presets' &&
      cmd !== 'plan-house' &&
      cmd !== 'bootstrap' &&
      cmd !== 'init-model' &&
      cmd !== 'qa' &&
      cmd !== 'publish'
    )
      usage();

    if (cmd === 'snapshot') {
      await snapshot(modelId);
      return;
    }

    if (cmd === 'advisor') {
      const rest = argv.slice(1);
      const output = rest.includes('--output')
        ? rest[rest.indexOf('--output') + 1]
        : (rest.find((a) => a.startsWith('--output='))?.split('=')[1] ?? 'text');
      const severity = rest.includes('--severity')
        ? rest[rest.indexOf('--severity') + 1]
        : (rest.find((a) => a.startsWith('--severity='))?.split('=')[1] ?? null);
      await cmdAdvisor(modelId, { output, severity });
      return;
    }

    if (cmd === 'model') {
      const sub = argv[1];
      if (sub === 'show' || sub === 'snapshot') {
        await snapshot(modelId);
        return;
      }
      if (sub === 'summary') {
        await cmdSummary(modelId);
        return;
      }
      if (sub === 'dry-run' || sub === 'commit-bundle') {
        await cmdModelBundle(modelId, userId, sub, argv.slice(2));
        return;
      }
      console.error(
        `Unknown model subcommand: ${sub ?? '(none)'}. Use show | summary | dry-run | commit-bundle.`,
      );
      process.exit(1);
    }

    if (cmd === 'qa') {
      const sub = argv[1];
      const rest = argv.slice(2);
      if (sub === 'rules' || sub === 'advisor-rules') {
        await cmdAdvisorRules(rest);
        return;
      }
      if (!modelId) usage();
      if (sub === 'advisor') {
        const output = rest.includes('--output')
          ? rest[rest.indexOf('--output') + 1]
          : (rest.find((a) => a.startsWith('--output='))?.split('=')[1] ?? 'json');
        const severity = rest.includes('--severity')
          ? rest[rest.indexOf('--severity') + 1]
          : (rest.find((a) => a.startsWith('--severity='))?.split('=')[1] ?? null);
        await cmdAdvisor(modelId, { output, severity });
        return;
      }
      if (sub === 'integrity' || sub === 'integrity-preflight') {
        await cmdIntegrity(modelId, userId, rest);
        return;
      }
      if (sub === 'profiles' || sub === 'profile-comparison') {
        await cmdProfileComparison(modelId, rest);
        return;
      }
      console.error(
        `Unknown qa subcommand: ${sub ?? '(none)'}. Use advisor | integrity | profiles | rules.`,
      );
      process.exit(1);
    }

    if (cmd === 'query') {
      const sub = argv[1];
      const rest = argv.slice(2);
      if (sub === 'summary') {
        await cmdQuerySummary(modelId);
        return;
      }
      if (sub === 'elements') {
        await cmdQueryElements(modelId, rest);
        return;
      }
      if (sub === 'levels') {
        await cmdQueryLevels(modelId, rest);
        return;
      }
      if (sub === 'types') {
        await cmdQueryTypes(modelId, rest);
        return;
      }
      if (sub === 'views') {
        await cmdQueryViews(modelId, rest);
        return;
      }
      if (sub === 'hosts') {
        await cmdQueryHosts(modelId, rest);
        return;
      }
      if (sub === 'nearest-wall') {
        const point = parsePosTriple(flagValue(rest, '--point'));
        const payload = {
          modelId,
          pointMm: [point.xMm, point.yMm, point.zMm],
          levelId: flagValue(rest, '--level') ?? null,
          maxDistanceMm: parseNumber(flagValue(rest, '--max-distance'), 1000),
          includeGeometry: hasFlag(rest, '--include-geometry'),
        };
        await cmdQueryViaBackend(modelId, 'query.nearest_wall', 'nearest-wall', payload);
        return;
      }
      console.error(
        `Unknown query subcommand: ${sub ?? '(none)'}. Use summary | elements | levels | types | views | hosts | nearest-wall.`,
      );
      process.exit(1);
    }

    if (cmd === 'resolve') {
      const sub = argv[1];
      const rest = argv.slice(2);
      if (sub === 'wall') {
        const line = parsePoint2List(flagValue(rest, '--line'), '--line');
        if (line.length !== 2) {
          console.error('resolve wall --line must contain exactly two points.');
          process.exit(1);
        }
        const payload = {
          modelId,
          levelId: flagValue(rest, '--level') ?? null,
          lineMm: line.map((point) => [point.xMm, point.yMm]),
          toleranceMm: parseNumber(flagValue(rest, '--tolerance'), 100),
        };
        const prefer = flagValue(rest, '--prefer-nearest');
        if (prefer) {
          const point = parsePosTriple(prefer);
          payload.preferNearestToMm = [point.xMm, point.yMm, point.zMm];
        }
        await cmdResolveViaBackend(modelId, 'resolve.wall_by_line', 'wall-by-line', payload);
        return;
      }
      if (sub === 'host-face') {
        const point = parsePosTriple(flagValue(rest, '--point'));
        const payload = {
          modelId,
          forKind: flagValue(rest, '--for-kind') ?? 'door',
          pointMm: [point.xMm, point.yMm, point.zMm],
          hostKinds: parseCsv(flagValue(rest, '--host-kinds') ?? 'wall'),
          levelId: flagValue(rest, '--level') ?? null,
          maxDistanceMm: parseNumber(flagValue(rest, '--max-distance'), 500),
        };
        const normal = flagValue(rest, '--normal');
        if (normal) {
          const n = parsePosTriple(normal);
          payload.normalHint = [n.xMm, n.yMm, n.zMm];
        }
        await cmdResolveViaBackend(modelId, 'resolve.host_face', 'host-face', payload);
        return;
      }
      console.error(`Unknown resolve subcommand: ${sub ?? '(none)'}. Use wall | host-face.`);
      process.exit(1);
    }

    if (cmd === 'author') {
      await cmdAuthor(modelId, userId, argv[1], argv.slice(2));
      return;
    }

    if (cmd === 'opening') {
      await cmdOpening(modelId, userId, argv[1], argv.slice(2));
      return;
    }

    if (cmd === 'structure') {
      await cmdStructure(modelId, userId, argv[1], argv.slice(2));
      return;
    }

    if (cmd === 'construction') {
      await cmdConstruction(modelId, userId, argv[1], argv.slice(2));
      return;
    }

    if (cmd === 'mep') {
      await cmdMep(modelId, userId, argv[1], argv.slice(2));
      return;
    }

    if (cmd === 'site') {
      if (!modelId) usage();
      const domain = argv[1];
      await cmdSite(
        modelId,
        userId,
        domain,
        domain === 'setup' ? undefined : argv[2],
        domain === 'setup' ? argv.slice(2) : argv.slice(3),
      );
      return;
    }

    if (cmd === 'family') {
      if (!modelId) usage();
      await cmdFamily(modelId, userId, argv[1], argv.slice(2));
      return;
    }

    if (cmd === 'material') {
      if (!modelId) usage();
      await cmdMaterial(modelId, userId, argv[1], argv.slice(2));
      return;
    }

    if (cmd === 'decal') {
      if (!modelId) usage();
      await cmdDecal(modelId, userId, argv[1], argv.slice(2));
      return;
    }

    if (cmd === 'place-kitchen-kit') {
      if (!modelId) usage();
      await cmdPlaceKitchenKit(modelId, userId, argv.slice(1));
      return;
    }

    if (cmd === 'view') {
      await cmdView(modelId, userId, argv[1], argv.slice(2));
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
      let actorKind;
      let dryRunEvidenceArg;

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
        } else if (a === '--actor-kind' && rest[i + 1]) {
          actorKind = rest[++i];
        } else if (a.startsWith('--actor-kind=')) {
          actorKind = a.slice('--actor-kind='.length);
        } else if (a === '--dry-run-evidence' && rest[i + 1]) {
          dryRunEvidenceArg = rest[++i];
        } else if (a.startsWith('--dry-run-evidence=')) {
          dryRunEvidenceArg = a.slice('--dry-run-evidence='.length);
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
      const dryRunEvidence = await readJsonFlagPayload(dryRunEvidenceArg, '--dry-run-evidence');

      const url = `${base}/api/models/${encodeURIComponent(modelId)}/bundles`;
      const body = { bundle, mode, userId };
      if (actorKind) body.actorKind = actorKind;
      if (dryRunEvidence) body.dryRunEvidence = dryRunEvidence;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
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
        visArg === 'linked_view'
          ? 'linked_view'
          : visArg === 'host_view'
            ? 'host_view'
            : 'host_view';
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
        if (!id) {
          console.error('plan-region update: <id> required');
          process.exit(1);
        }
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
        if (!id) {
          console.error('plan-region delete: <id> required');
          process.exit(1);
        }
        await commit(modelId, { type: 'deletePlanRegion', id });
        return;
      }
      console.error(
        `Unknown plan-region subcommand: ${sub ?? '(none)'}. Use create, update, or delete.`,
      );
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
      if (!name || !ordStr) {
        console.error('phase-create requires --name <name> --ord <n>');
        process.exit(1);
      }
      await postCommand(modelId, userId, { type: 'createPhase', name, ord: Number(ordStr) });
      return;
    }

    if (cmd === 'phase-rename') {
      if (!modelId) usage();
      const phaseId = argv[argv.indexOf('--phase-id') + 1];
      const name = argv[argv.indexOf('--name') + 1];
      if (!phaseId || !name) {
        console.error('phase-rename requires --phase-id <id> --name <name>');
        process.exit(1);
      }
      await postCommand(modelId, userId, { type: 'renamePhase', phaseId, name });
      return;
    }

    if (cmd === 'phase-reorder') {
      if (!modelId) usage();
      const phaseId = argv[argv.indexOf('--phase-id') + 1];
      const ordStr = argv[argv.indexOf('--ord') + 1];
      if (!phaseId || !ordStr) {
        console.error('phase-reorder requires --phase-id <id> --ord <n>');
        process.exit(1);
      }
      await postCommand(modelId, userId, { type: 'reorderPhase', phaseId, ord: Number(ordStr) });
      return;
    }

    if (cmd === 'phase-delete') {
      if (!modelId) usage();
      const phaseId = argv[argv.indexOf('--phase-id') + 1];
      if (!phaseId) {
        console.error('phase-delete requires --phase-id <id>');
        process.exit(1);
      }
      const payload = { type: 'deletePhase', phaseId };
      const retargetIdx = argv.indexOf('--retarget-to');
      if (retargetIdx !== -1) payload.retargetToPhaseId = argv[retargetIdx + 1];
      await postCommand(modelId, userId, payload);
      return;
    }

    if (cmd === 'element-set-phase') {
      if (!modelId) usage();
      const elementId = argv[argv.indexOf('--element-id') + 1];
      if (!elementId) {
        console.error('element-set-phase requires --element-id <id>');
        process.exit(1);
      }
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
      if (!viewId || !phaseId) {
        console.error('view-set-phase requires --view-id <id> --phase-id <id>');
        process.exit(1);
      }
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
        if (!boundary) {
          console.error('toposolid create: --boundary <json> required');
          process.exit(1);
        }
        const boundaryMm = JSON.parse(boundary);
        const payload = {
          type: 'CreateToposolid',
          toposolidId: `topo-${Date.now()}`,
          boundaryMm,
          thicknessMm: thickness ?? 1500,
        };
        if (name !== undefined) payload.name = name;
        await commit(modelId, payload);
        return;
      }
      if (sub === 'update') {
        if (!modelId) usage();
        const id = argv[1];
        if (!id) {
          console.error('toposolid update: <id> required');
          process.exit(1);
        }
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
        if (!id) {
          console.error('toposolid delete: <id> required');
          process.exit(1);
        }
        await commit(modelId, { type: 'DeleteToposolid', toposolidId: id });
        return;
      }
      console.error(
        `Unknown toposolid subcommand: ${sub ?? '(none)'}. Use create, update, or delete.`,
      );
      process.exit(1);
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
        if (!kind) {
          console.error('jobs submit requires <kind>');
          process.exit(1);
        }
        const modelArg = argv[argv.indexOf('--model') + 1] ?? modelId;
        if (!modelArg) {
          console.error('jobs submit requires --model <id> or BIM_AI_MODEL_ID');
          process.exit(1);
        }
        const inputsIdx = argv.indexOf('--inputs');
        const inputs = inputsIdx !== -1 ? JSON.parse(argv[inputsIdx + 1]) : {};
        const result = await fetchJson('POST', `${base}/api/jobs`, {
          kind,
          modelId: modelArg,
          inputs,
        });
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (sub === 'list') {
        const modelArg = argv[argv.indexOf('--model') + 1] ?? modelId;
        if (!modelArg) {
          console.error('jobs list requires --model <id> or BIM_AI_MODEL_ID');
          process.exit(1);
        }
        const doWait = argv.includes('--wait');
        let jobs = await fetchJson(
          'GET',
          `${base}/api/jobs?modelId=${encodeURIComponent(modelArg)}`,
        );
        if (doWait) {
          const active = (j) => j.status === 'queued' || j.status === 'running';
          while (jobs.some(active)) {
            await new Promise((r) => setTimeout(r, 2000));
            jobs = await fetchJson(
              'GET',
              `${base}/api/jobs?modelId=${encodeURIComponent(modelArg)}`,
            );
          }
        }
        console.log(JSON.stringify(jobs, null, 2));
        return;
      }
      if (sub === 'cancel') {
        const jobId = argv[2];
        if (!jobId) {
          console.error('jobs cancel requires <job-id>');
          process.exit(1);
        }
        const result = await fetchJson(
          'POST',
          `${base}/api/jobs/${encodeURIComponent(jobId)}/cancel`,
        );
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (sub === 'status') {
        const jobId = argv[2];
        if (!jobId) {
          console.error('jobs status requires <job-id>');
          process.exit(1);
        }
        const result = await fetchJson('GET', `${base}/api/jobs/${encodeURIComponent(jobId)}`);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.error(
        `Unknown jobs subcommand: ${sub ?? '(none)'}. Use submit | list | cancel | status.`,
      );
      process.exit(1);
    }

    // AST-V3-01 — asset library subcommands
    if (cmd === 'asset') {
      const sub = argv[1];
      if (sub === 'index') {
        if (!modelId) usage();
        const opts = authorOptions(argv.slice(2));
        const rest = argv.slice(2);
        let id, name, category, assetKind, tagsArg, description;
        for (let i = 0; i < rest.length; i++) {
          const a = rest[i];
          if (a === '--id' && rest[i + 1]) id = rest[++i];
          else if (a === '--name' && rest[i + 1]) name = rest[++i];
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
          ...(id ? { id } : {}),
          name,
          category,
          ...(assetKind ? { assetKind } : {}),
          ...(tagsArg
            ? {
                tags: tagsArg
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              }
            : {}),
          ...(description ? { description } : {}),
        };
        const bundle = buildGeneratedBundle({
          toolId: 'asset.query_index',
          commands: [command],
          parentRevision: opts.parentRevision,
        });
        await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
        return;
      }
      if (sub === 'place') {
        if (!modelId) usage();
        const opts = authorOptions(argv.slice(2));
        const rest = argv.slice(2);
        const id = rest.find((_, i) => rest[i - 1] === '--id');
        const assetId = rest.find((_, i) => rest[i - 1] === '--asset');
        const levelId = rest.find((_, i) => rest[i - 1] === '--level');
        const posArg = rest.find((_, i) => rest[i - 1] === '--pos');
        const xArg = rest.find((_, i) => rest[i - 1] === '--x');
        const yArg = rest.find((_, i) => rest[i - 1] === '--y');
        const zArg = rest.find((_, i) => rest[i - 1] === '--z');
        const rotationArg = rest.find((_, i) => rest[i - 1] === '--rotation');
        const paramValues = parseJsonObjectFlag(
          rest.find((_, i) => rest[i - 1] === '--param-values'),
          '--param-values',
        );
        const hostElementId = rest.find((_, i) => rest[i - 1] === '--host-element');
        if (!assetId) {
          console.error('asset place requires --asset <asset-id>');
          process.exit(1);
        }
        if (!levelId) {
          console.error('asset place requires --level <level-id>');
          process.exit(1);
        }
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
          ...(id ? { id } : {}),
          assetId,
          levelId,
          positionMm: { xMm: positionMm.xMm, yMm: positionMm.yMm },
          rotationDeg: parseNumber(rotationArg, 0),
          ...(paramValues ? { paramValues } : {}),
          ...(hostElementId ? { hostElementId } : {}),
        };
        const bundle = buildGeneratedBundle({
          toolId: 'asset.place',
          commands: [command],
          parentRevision: opts.parentRevision,
        });
        await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
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
      let lat,
        lon,
        radiusM = 200,
        targetModelId;
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
