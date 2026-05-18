/**
 * M2-C CLI mirrors for the first MCP query/resolve/authoring pack.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI = path.join(__dirname, 'cli.mjs');

function startStubServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      let parsed;
      try {
        parsed = body ? JSON.parse(body) : null;
      } catch {
        parsed = body;
      }
      const out = handler(req, parsed);
      res.statusCode = out?.status ?? 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(out?.body ?? { ok: true }));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, base: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function runCli(args, env, input = null) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c.toString();
    });
    child.stderr.on('data', (c) => {
      stderr += c.toString();
    });
    if (input != null) {
      child.stdin.end(input);
    }
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

const snapshotBody = {
  modelId: 'model-1',
  revision: 7,
  elements: {
    'lvl-0': { kind: 'level', id: 'lvl-0', name: 'Ground', elevationMm: 0 },
    'plan-lvl-0': { kind: 'plan_view', id: 'plan-lvl-0', name: 'Ground Plan', levelId: 'lvl-0' },
    'wt-ext': { kind: 'wall_type', id: 'wt-ext', name: 'Exterior 200', thicknessMm: 200 },
    'wall-1': {
      kind: 'wall',
      id: 'wall-1',
      name: 'North wall',
      levelId: 'lvl-0',
      wallTypeId: 'wt-ext',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 6000, yMm: 0 },
      heightMm: 2800,
      thicknessMm: 200,
    },
    'floor-1': {
      kind: 'floor',
      id: 'floor-1',
      levelId: 'lvl-0',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 6000, yMm: 0 },
        { xMm: 6000, yMm: 4000 },
      ],
    },
    'roof-1': {
      kind: 'roof',
      id: 'roof-1',
      referenceLevelId: 'lvl-0',
      footprintMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 6000, yMm: 0 },
        { xMm: 6000, yMm: 4000 },
      ],
    },
  },
  violations: [
    {
      severity: 'warning',
      advisoryClass: 'opening_without_host',
      elementIds: ['opening-1'],
      message: 'Opening needs a host.',
    },
  ],
};

test('model dry-run and commit-bundle submit cmd-v3 bundles to transaction endpoint', async () => {
  const requests = [];
  const { server, base } = await startStubServer((req, body) => {
    requests.push({ method: req.method, url: req.url, body });
    return { body: { ok: true, mode: body.mode, revision: body.mode === 'commit' ? 8 : 7 } };
  });
  const bundleJson = JSON.stringify({
    schemaVersion: 'cmd-v3.0',
    commands: [
      { type: 'createWall', levelId: 'lvl-0', start: { xMm: 0, yMm: 0 }, end: { xMm: 1, yMm: 0 } },
    ],
    assumptions: [],
  });
  const env = { BIM_AI_BASE_URL: base, BIM_AI_MODEL_ID: 'model-1', BIM_AI_USER_ID: 'agent-1' };
  const dry = await runCli(['model', 'dry-run', '-', '--parent-revision', '7'], env, bundleJson);
  const commit = await runCli(
    ['model', 'commit-bundle', '-', '--parent-revision', '7'],
    env,
    bundleJson,
  );
  server.close();

  assert.equal(dry.code, 0, dry.stderr);
  assert.equal(commit.code, 0, commit.stderr);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, '/api/models/model-1/bundles');
  assert.equal(requests[0].body.mode, 'dry_run');
  assert.equal(requests[0].body.bundle.parentRevision, 7);
  assert.equal(requests[1].body.mode, 'commit');
  assert.equal(requests[1].body.userId, 'agent-1');
});

test('query elements filters snapshot and emits geometry summaries', async () => {
  const { server, base } = await startStubServer((req) => {
    assert.match(req.url, /\/api\/models\/model-1\/snapshot$/);
    return { body: snapshotBody };
  });
  const res = await runCli(
    ['query', 'elements', '--kind', 'wall', '--include', 'geometrySummary'],
    {
      BIM_AI_BASE_URL: base,
      BIM_AI_MODEL_ID: 'model-1',
    },
  );
  server.close();

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.data.elements.length, 1);
  assert.equal(out.data.elements[0].id, 'wall-1');
  assert.deepEqual(out.data.elements[0].geometrySummary.startMm, [0, 0]);
});

test('query levels, types, and views mirror first read pack from snapshot', async () => {
  const { server, base } = await startStubServer(() => ({ body: snapshotBody }));
  const env = { BIM_AI_BASE_URL: base, BIM_AI_MODEL_ID: 'model-1' };
  const levels = await runCli(['query', 'levels', '--include', 'planViews'], env);
  const types = await runCli(['query', 'types', '--category', 'wall'], env);
  const views = await runCli(['query', 'views', '--level', 'lvl-0'], env);
  server.close();

  assert.equal(levels.code, 0, levels.stderr);
  assert.equal(types.code, 0, types.stderr);
  assert.equal(views.code, 0, views.stderr);
  assert.deepEqual(JSON.parse(levels.stdout).data.levels[0].planViewIds, ['plan-lvl-0']);
  assert.equal(JSON.parse(types.stdout).data.types[0].id, 'wt-ext');
  assert.equal(JSON.parse(views.stdout).data.views[0].id, 'plan-lvl-0');
});

test('author wall-chain --json generates a cmd-v3 bundle without network apply', async () => {
  const res = await runCli(
    [
      'author',
      'wall-chain',
      '--level',
      'lvl-0',
      '--points',
      '0,0;6000,0;6000,4000',
      '--closed',
      '--id-prefix',
      'wall',
      '--parent-revision',
      '7',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.body.mode, 'dry_run');
  assert.equal(out.body.bundle.parentRevision, 7);
  assert.equal(out.body.bundle.commands[0].type, 'createWallChain');
  assert.equal(out.body.bundle.commands[0].segments.length, 3);
  assert.equal(out.body.bundle.commands[0].segments[0].id, 'wall-1');
});

test('author wall --json generates deterministic createWall payload', async () => {
  const res = await runCli(
    [
      'author',
      'wall',
      '--level',
      'lvl-0',
      '--line',
      '0,0;6000,0',
      '--id',
      'wall-north',
      '--wall-type',
      'wt-ext',
      '--height',
      '3000',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const command = JSON.parse(res.stdout).body.bundle.commands[0];
  assert.equal(command.type, 'createWall');
  assert.equal(command.id, 'wall-north');
  assert.equal(command.wallTypeId, 'wt-ext');
  assert.deepEqual(command.start, { xMm: 0, yMm: 0 });
  assert.deepEqual(command.end, { xMm: 6000, yMm: 0 });
  assert.equal(command.heightMm, 3000);
});

test('structure column and beam --json generate typed structural payloads', async () => {
  const env = { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' };
  const column = await runCli(
    [
      'structure',
      'column',
      '--level',
      'lvl-0',
      '--position',
      '1200,2400',
      '--id',
      'col-s1',
      '--b',
      '350',
      '--h',
      '450',
      '--json',
    ],
    env,
  );
  const beam = await runCli(
    [
      'structure',
      'beam',
      '--level',
      'lvl-0',
      '--line',
      '0,5000;6000,5000',
      '--id',
      'beam-s1',
      '--width',
      '220',
      '--height',
      '500',
      '--json',
    ],
    env,
  );

  assert.equal(column.code, 0, column.stderr);
  assert.equal(beam.code, 0, beam.stderr);
  const columnOut = JSON.parse(column.stdout);
  const beamOut = JSON.parse(beam.stdout);
  assert.equal(columnOut.body.bundle.assumptions[0].value, 'structure.column');
  assert.deepEqual(columnOut.body.bundle.commands[0], {
    type: 'createColumn',
    levelId: 'lvl-0',
    positionMm: { xMm: 1200, yMm: 2400 },
    name: 'Column',
    bMm: 350,
    hMm: 450,
    heightMm: 2800,
    rotationDeg: 0,
    id: 'col-s1',
  });
  assert.equal(beamOut.body.bundle.commands[0].type, 'createBeam');
  assert.deepEqual(beamOut.body.bundle.commands[0].startMm, { xMm: 0, yMm: 5000 });
  assert.deepEqual(beamOut.body.bundle.commands[0].endMm, { xMm: 6000, yMm: 5000 });
  assert.equal(beamOut.body.bundle.commands[0].heightMm, 500);
});

test('structure constraint and construction lite --json generate typed payloads', async () => {
  const env = { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' };
  const constraint = await runCli(
    [
      'structure',
      'constraint',
      '--rule',
      'parallel',
      '--refs-a',
      '[{"elementId":"beam-s1","anchor":"start"}]',
      '--refs-b',
      '[{"elementId":"beam-s2","anchor":"start"}]',
      '--json',
    ],
    env,
  );
  const pack = await runCli(
    ['construction', 'package', '--id', 'pkg-structure', '--name', 'Structure shell', '--json'],
    env,
  );
  const logistics = await runCli(
    [
      'construction',
      'logistics',
      '--id',
      'log-crane',
      '--name',
      'Tower crane swing',
      '--kind',
      'crane_zone',
      '--boundary',
      '0,0;8000,0;8000,5000;0,5000',
      '--package',
      'pkg-structure',
      '--json',
    ],
    env,
  );
  const checklist = await runCli(
    [
      'construction',
      'qa-checklist',
      '--id',
      'qa-structure',
      '--name',
      'Structure pour QA',
      '--targets',
      'col-s1,beam-s1',
      '--checklist',
      '[{"id":"rebar","label":"Rebar inspected"}]',
      '--json',
    ],
    env,
  );

  assert.equal(constraint.code, 0, constraint.stderr);
  assert.equal(pack.code, 0, pack.stderr);
  assert.equal(logistics.code, 0, logistics.stderr);
  assert.equal(checklist.code, 0, checklist.stderr);
  assert.equal(JSON.parse(constraint.stdout).body.bundle.commands[0].type, 'createConstraint');
  assert.equal(JSON.parse(pack.stdout).body.bundle.commands[0].type, 'createConstructionPackage');
  assert.equal(
    JSON.parse(logistics.stdout).body.bundle.commands[0].type,
    'createConstructionLogistics',
  );
  assert.deepEqual(JSON.parse(checklist.stdout).body.bundle.commands[0].targetElementIds, [
    'col-s1',
    'beam-s1',
  ]);
});

test('author stair-between-levels --json generates typed createStair payload', async () => {
  const res = await runCli(
    [
      'author',
      'stair-between-levels',
      '--base-level',
      'lvl-0',
      '--top-level',
      'lvl-1',
      '--run',
      '1000,1000;1000,4200',
      '--id',
      'stair-main',
      '--width',
      '1100',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  const command = out.body.bundle.commands[0];
  assert.equal(out.body.bundle.assumptions[0].value, 'author.stair_between_levels');
  assert.equal(command.type, 'createStair');
  assert.equal(command.id, 'stair-main');
  assert.equal(command.baseLevelId, 'lvl-0');
  assert.equal(command.topLevelId, 'lvl-1');
  assert.deepEqual(command.runStartMm, { xMm: 1000, yMm: 1000 });
  assert.deepEqual(command.runEndMm, { xMm: 1000, yMm: 4200 });
  assert.equal(command.widthMm, 1100);
});

test('mep route --json commands expose geometry elevation system and service metadata', async () => {
  const env = { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' };
  const pipe = await runCli(
    [
      'mep',
      'pipe-route',
      '--level',
      'lvl-0',
      '--line',
      '0,100;3000,100',
      '--id',
      'pipe-cw-1',
      '--elevation',
      '2600',
      '--diameter',
      '40',
      '--system',
      'domestic_water',
      '--system-name',
      'CW-1',
      '--flow',
      'supply',
      '--service-level',
      'Level 1 ceiling',
      '--json',
    ],
    env,
  );
  const duct = await runCli(
    [
      'mep',
      'duct-route',
      '--level',
      'lvl-0',
      '--line',
      '0,800;3000,800',
      '--id',
      'duct-sa-1',
      '--elevation',
      '2800',
      '--width',
      '500',
      '--height',
      '250',
      '--system',
      'hvac_supply',
      '--service-level',
      'ceiling plenum',
      '--json',
    ],
    env,
  );

  assert.equal(pipe.code, 0, pipe.stderr);
  assert.equal(duct.code, 0, duct.stderr);
  const pipeCommand = JSON.parse(pipe.stdout).body.bundle.commands[0];
  const ductCommand = JSON.parse(duct.stdout).body.bundle.commands[0];
  assert.equal(pipeCommand.type, 'createPipe');
  assert.deepEqual(pipeCommand.startMm, { xMm: 0, yMm: 100 });
  assert.equal(pipeCommand.elevationMm, 2600);
  assert.equal(pipeCommand.systemType, 'domestic_water');
  assert.equal(pipeCommand.serviceLevel, 'Level 1 ceiling');
  assert.equal(ductCommand.type, 'createDuct');
  assert.equal(ductCommand.widthMm, 500);
  assert.equal(ductCommand.heightMm, 250);
  assert.equal(ductCommand.serviceLevel, 'ceiling plenum');
});

test('mep equipment fixture terminal and opening request --json generate typed payloads', async () => {
  const env = { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' };
  const equipment = await runCli(
    [
      'mep',
      'equipment',
      '--level',
      'lvl-0',
      '--position',
      '500,500',
      '--id',
      'ahu-1',
      '--equipment-type',
      'AHU',
      '--system',
      'hvac_supply',
      '--service-level',
      'mechanical room',
      '--electrical-load',
      '900',
      '--json',
    ],
    env,
  );
  const fixture = await runCli(
    [
      'mep',
      'fixture',
      '--level',
      'lvl-0',
      '--position',
      '1200,900',
      '--id',
      'sink-1',
      '--room',
      'room-1',
      '--fixture-type',
      'sink',
      '--system',
      'domestic_water',
      '--json',
    ],
    env,
  );
  const terminal = await runCli(
    [
      'mep',
      'terminal',
      '--level',
      'lvl-0',
      '--position',
      '1800,900',
      '--id',
      'diffuser-1',
      '--terminal-kind',
      'diffuser',
      '--system',
      'hvac_supply',
      '--service-level',
      'ceiling',
      '--json',
    ],
    env,
  );
  const opening = await runCli(
    [
      'mep',
      'opening-request',
      '--host',
      'wall-1',
      '--level',
      'lvl-0',
      '--requester',
      'duct-sa-1',
      '--opening-kind',
      'wall',
      '--position',
      '1500,800',
      '--width',
      '600',
      '--height',
      '320',
      '--system',
      'hvac_supply',
      '--json',
    ],
    env,
  );

  assert.equal(equipment.code, 0, equipment.stderr);
  assert.equal(fixture.code, 0, fixture.stderr);
  assert.equal(terminal.code, 0, terminal.stderr);
  assert.equal(opening.code, 0, opening.stderr);
  assert.equal(JSON.parse(equipment.stdout).body.bundle.commands[0].type, 'createMepEquipment');
  assert.equal(JSON.parse(equipment.stdout).body.bundle.commands[0].equipmentType, 'AHU');
  assert.equal(JSON.parse(fixture.stdout).body.bundle.commands[0].type, 'createFixture');
  assert.equal(JSON.parse(fixture.stdout).body.bundle.commands[0].roomId, 'room-1');
  assert.equal(JSON.parse(terminal.stdout).body.bundle.commands[0].type, 'createMepTerminal');
  assert.equal(JSON.parse(terminal.stdout).body.bundle.commands[0].terminalKind, 'diffuser');
  assert.equal(JSON.parse(opening.stdout).body.bundle.commands[0].type, 'createMepOpeningRequest');
  assert.deepEqual(JSON.parse(opening.stdout).body.bundle.commands[0].requesterElementIds, [
    'duct-sa-1',
  ]);
});

test('opening shaft-opening --json generates typed createSlabOpening payload', async () => {
  const res = await runCli(
    [
      'opening',
      'shaft-opening',
      '--floor',
      'floor-l1',
      '--boundary',
      '1000,1000;2200,1000;2200,2200;1000,2200',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const command = JSON.parse(res.stdout).body.bundle.commands[0];
  assert.equal(command.type, 'createSlabOpening');
  assert.equal(command.hostFloorId, 'floor-l1');
  assert.equal(command.isShaft, true);
});

test('author railing --json generates typed createRailing payload', async () => {
  const res = await runCli(
    [
      'author',
      'railing',
      '--hosted-stair',
      'stair-main',
      '--path',
      '1000,1000;1000,4200',
      '--baluster-pattern',
      '{"rule":"regular","spacingMm":120}',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const command = JSON.parse(res.stdout).body.bundle.commands[0];
  assert.equal(command.type, 'createRailing');
  assert.equal(command.hostedStairId, 'stair-main');
  assert.deepEqual(command.pathMm, [
    { xMm: 1000, yMm: 1000 },
    { xMm: 1000, yMm: 4200 },
  ]);
  assert.deepEqual(command.balusterPattern, { rule: 'regular', spacingMm: 120 });
});

test('family upsert/place --json generate first-class M4-D bundles', async () => {
  const env = { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' };
  const upsert = await runCli(
    [
      'family',
      'upsert-type',
      '--id',
      'ft-chair',
      '--name',
      'Chair',
      '--family-id',
      'fam-chair',
      '--parameters',
      '{"widthMm":500,"materialKey":"oak"}',
      '--json',
    ],
    env,
  );
  const place = await runCli(
    [
      'family',
      'place-instance',
      '--id',
      'chair-1',
      '--family-type',
      'ft-chair',
      '--level',
      'lvl-0',
      '--pos',
      '1200,900',
      '--param-values',
      '{"seatHeightMm":450}',
      '--json',
    ],
    env,
  );

  assert.equal(upsert.code, 0, upsert.stderr);
  assert.equal(place.code, 0, place.stderr);
  const upsertCommand = JSON.parse(upsert.stdout).body.bundle.commands[0];
  const placeCommand = JSON.parse(place.stdout).body.bundle.commands[0];
  assert.equal(JSON.parse(upsert.stdout).body.bundle.assumptions[0].value, 'family.upsert_type');
  assert.deepEqual(upsertCommand, {
    type: 'upsertFamilyType',
    id: 'ft-chair',
    discipline: 'generic',
    parameters: { widthMm: 500, materialKey: 'oak' },
    name: 'Chair',
    familyId: 'fam-chair',
  });
  assert.equal(JSON.parse(place.stdout).body.bundle.assumptions[0].value, 'family.place_instance');
  assert.deepEqual(placeCommand, {
    type: 'placeFamilyInstance',
    familyTypeId: 'ft-chair',
    positionMm: { xMm: 1200, yMm: 900 },
    rotationDeg: 0,
    paramValues: { seatHeightMm: 450 },
    id: 'chair-1',
    levelId: 'lvl-0',
  });
});

test('asset place and kitchen kit --json generate typed M4-D bundles', async () => {
  const env = { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' };
  const asset = await runCli(
    [
      'asset',
      'place',
      '--id',
      'sofa-1',
      '--asset',
      'asset-sofa',
      '--level',
      'lvl-0',
      '--pos',
      '2500,1400,0',
      '--rotation',
      '90',
      '--json',
    ],
    env,
  );
  const kit = await runCli(
    [
      'place-kitchen-kit',
      '--id',
      'kit-1',
      '--host-wall',
      'wall-1',
      '--start',
      '200',
      '--end',
      '3600',
      '--components',
      '[{"componentKind":"base","widthMm":600},{"componentKind":"sink"}]',
      '--json',
    ],
    env,
  );

  assert.equal(asset.code, 0, asset.stderr);
  assert.equal(kit.code, 0, kit.stderr);
  assert.deepEqual(JSON.parse(asset.stdout).body.bundle.commands[0], {
    type: 'PlaceAsset',
    id: 'sofa-1',
    assetId: 'asset-sofa',
    levelId: 'lvl-0',
    positionMm: { xMm: 2500, yMm: 1400 },
    rotationDeg: 90,
  });
  assert.deepEqual(JSON.parse(kit.stdout).body.bundle.commands[0], {
    type: 'place_kit',
    id: 'kit-1',
    kitId: 'kitchen_modular',
    hostWallId: 'wall-1',
    startMm: 200,
    endMm: 3600,
    components: [{ componentKind: 'base', widthMm: 600 }, { componentKind: 'sink' }],
    countertopDepthMm: 600,
  });
});

test('material and decal --json expose M4-D typed assignment surfaces', async () => {
  const env = { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' };
  const pbr = await runCli(
    [
      'material',
      'update-pbr',
      '--id',
      'mat-oak',
      '--albedo-map',
      'img-oak-albedo',
      '--normal-map',
      'img-oak-normal',
      '--uv-scale',
      '{"u":600,"v":600}',
      '--json',
    ],
    env,
  );
  const assign = await runCli(
    ['material', 'assign', '--element', 'wall-1', '--material', 'brick_red', '--json'],
    env,
  );
  const paint = await runCli(
    [
      'material',
      'paint-face',
      '--element',
      'wall-1',
      '--face',
      'exterior',
      '--material',
      'brick_red',
      '--json',
    ],
    env,
  );
  const decal = await runCli(
    [
      'decal',
      'create',
      '--id',
      'decal-logo',
      '--parent',
      'wall-1',
      '--surface',
      'front',
      '--image-asset',
      'img-logo',
      '--json',
    ],
    env,
  );

  assert.equal(pbr.code, 0, pbr.stderr);
  assert.equal(assign.code, 0, assign.stderr);
  assert.equal(paint.code, 0, paint.stderr);
  assert.equal(decal.code, 0, decal.stderr);
  assert.deepEqual(JSON.parse(pbr.stdout).body.bundle.commands[0], {
    type: 'update_material_pbr',
    id: 'mat-oak',
    albedoMapId: 'img-oak-albedo',
    normalMapId: 'img-oak-normal',
    uvScaleMm: { u: 600, v: 600 },
  });
  assert.deepEqual(JSON.parse(assign.stdout).body.bundle.commands[0], {
    type: 'set_element_prop',
    elementId: 'wall-1',
    key: 'materialKey',
    value: 'brick_red',
  });
  assert.deepEqual(JSON.parse(paint.stdout).body.bundle.commands[0], {
    type: 'set_element_prop',
    elementId: 'wall-1',
    key: 'faceMaterialOverrides',
    value: [{ faceKind: 'exterior', materialKey: 'brick_red', source: 'paint' }],
  });
  assert.deepEqual(JSON.parse(decal.stdout).body.bundle.commands[0], {
    type: 'create_decal',
    parentElementId: 'wall-1',
    parentSurface: 'front',
    imageAssetId: 'img-logo',
    uvRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
    opacity: 1,
    id: 'decal-logo',
  });
});

test('author floor-boundary --json generates createFloor payload', async () => {
  const res = await runCli(
    [
      'author',
      'floor-boundary',
      '--level',
      'lvl-0',
      '--boundary',
      '0,0;6000,0;6000,4000;0,4000',
      '--floor-type',
      'ft-slab',
      '--thickness',
      '240',
      '--id',
      'floor-ground',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const command = JSON.parse(res.stdout).body.bundle.commands[0];
  assert.equal(command.type, 'createFloor');
  assert.equal(command.id, 'floor-ground');
  assert.equal(command.floorTypeId, 'ft-slab');
  assert.equal(command.thicknessMm, 240);
  assert.equal(command.boundaryMm.length, 4);
});

test('opening roof-opening --json generates createRoofOpening payload', async () => {
  const res = await runCli(
    [
      'opening',
      'roof-opening',
      '--roof',
      'roof-1',
      '--boundary',
      '1000,1000;2000,1000;2000,2000;1000,2000',
      '--id',
      'roof-open-1',
      '--parent-revision',
      '7',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.body.bundle.parentRevision, 7);
  assert.deepEqual(out.body.bundle.commands[0], {
    type: 'createRoofOpening',
    hostRoofId: 'roof-1',
    boundaryMm: [
      { xMm: 1000, yMm: 1000 },
      { xMm: 2000, yMm: 1000 },
      { xMm: 2000, yMm: 2000 },
      { xMm: 1000, yMm: 2000 },
    ],
    name: 'Roof opening',
    id: 'roof-open-1',
  });
});

test('site setup --json generates deterministic georeference/site baseline bundle', async () => {
  const propertyLines = JSON.stringify([
    {
      id: 'pl-street',
      name: 'Street boundary',
      start: [0, 0],
      end: [20000, 0],
      setbackMm: 4500,
      classification: 'street',
    },
  ]);
  const contextObjects = JSON.stringify([
    {
      id: 'ctx-tree',
      contextType: 'tree',
      label: 'Existing tree',
      positionMm: { xMm: 12000, yMm: 6000 },
      scale: 1.2,
    },
  ]);
  const res = await runCli(
    [
      'site',
      'setup',
      '--site-id',
      'site-a',
      '--reference-level',
      'lvl-0',
      '--boundary',
      '0,0;20000,0;20000,12000;0,12000',
      '--lat',
      '48.13',
      '--lon',
      '11.58',
      '--true-north',
      '12.5',
      '--time',
      '09:30',
      '--property-lines',
      propertyLines,
      '--context-objects',
      contextObjects,
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  const commands = out.body.bundle.commands;
  assert.equal(out.body.bundle.assumptions[0].value, 'site.setup_georeference');
  assert.deepEqual(
    commands.map((command) => command.type),
    [
      'createProjectBasePoint',
      'createSurveyPoint',
      'createSunSettings',
      'upsertSite',
      'CreateToposolid',
      'createPropertyLine',
    ],
  );
  assert.equal(commands[0].angleToTrueNorthDeg, 12.5);
  assert.equal(commands[2].latitudeDeg, 48.13);
  assert.deepEqual(commands[2].timeOfDay, { hours: 9, minutes: 30 });
  assert.equal(commands[3].referenceLevelId, 'lvl-0');
  assert.equal(commands[3].contextObjects.length, 1);
  assert.equal(commands[4].toposolidId, 'site-a-toposolid');
  assert.equal(commands[5].classification, 'street');
});

test('site focused commands generate typed grading/property/origin/sun/excavation payloads', async () => {
  const env = { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' };
  const graded = await runCli(
    [
      'site',
      'graded-region',
      'update',
      'gr-1',
      '--target-mode',
      'slope',
      '--slope-axis',
      '90',
      '--slope-percent',
      '4',
      '--json',
    ],
    env,
  );
  const propertyLine = await runCli(
    [
      'site',
      'property-line',
      'create',
      '--line',
      '0,0;25000,0',
      '--classification',
      'street',
      '--setback',
      '4500',
      '--json',
    ],
    env,
  );
  const basePoint = await runCli(
    ['site', 'base-point', 'rotate', '--true-north', '15', '--json'],
    env,
  );
  const surveyPoint = await runCli(
    [
      'site',
      'survey-point',
      'move',
      '--position',
      '1000,2000,0',
      '--shared-elevation',
      '510000',
      '--json',
    ],
    env,
  );
  const sun = await runCli(
    ['site', 'sun-settings', 'update', '--date', '2026-12-21', '--time', '9:00', '--json'],
    env,
  );
  const excavation = await runCli(
    [
      'site',
      'excavation',
      'create',
      '--id',
      'ex-1',
      '--host-toposolid',
      'topo-1',
      '--cutter',
      'floor-1',
      '--cut-mode',
      'custom_depth',
      '--custom-depth',
      '1200',
      '--json',
    ],
    env,
  );

  for (const res of [graded, propertyLine, basePoint, surveyPoint, sun, excavation]) {
    assert.equal(res.code, 0, res.stderr);
  }
  assert.equal(JSON.parse(graded.stdout).body.bundle.commands[0].type, 'UpdateGradedRegion');
  assert.equal(JSON.parse(propertyLine.stdout).body.bundle.commands[0].type, 'createPropertyLine');
  assert.equal(JSON.parse(basePoint.stdout).body.bundle.commands[0].type, 'rotateProjectBasePoint');
  assert.equal(JSON.parse(surveyPoint.stdout).body.bundle.commands[0].type, 'moveSurveyPoint');
  assert.equal(JSON.parse(sun.stdout).body.bundle.commands[0].type, 'updateSunSettings');
  assert.equal(
    JSON.parse(excavation.stdout).body.bundle.commands[0].type,
    'CreateToposolidExcavation',
  );
});

test('view save-3d --json generates saveViewpoint payload with camera', async () => {
  const res = await runCli(
    [
      'view',
      'save-3d',
      '--id',
      'vp-1',
      '--name',
      'Southwest axo',
      '--position',
      '8000,-8000,5000',
      '--target',
      '3000,2000,0',
      '--hidden-kinds',
      'analytical,grid',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const command = JSON.parse(res.stdout).body.bundle.commands[0];
  assert.equal(command.type, 'saveViewpoint');
  assert.equal(command.id, 'vp-1');
  assert.equal(command.mode, 'orbit_3d');
  assert.deepEqual(command.camera.position, { xMm: 8000, yMm: -8000, zMm: 5000 });
  assert.deepEqual(command.camera.target, { xMm: 3000, yMm: 2000, zMm: 0 });
  assert.deepEqual(command.hiddenSemanticKinds3d, ['analytical', 'grid']);
});

test('documentation pack --json generates complete drawing set bundle', async () => {
  const res = await runCli(
    [
      'documentation',
      'pack',
      '--sheet-id',
      'A101',
      '--sheet-name',
      'GA Plan',
      '--title-block',
      'A1-titleblock',
      '--viewports',
      '[{"viewportId":"vp-plan","viewRef":"plan:plan-gf","label":"Ground","xMm":20,"yMm":20,"widthMm":160,"heightMm":110}]',
      '--schedule-id',
      'sch-rooms',
      '--schedule-name',
      'Room Schedule',
      '--schedule-category',
      'room',
      '--place-schedule',
      '--tags',
      '[{"id":"tag-room-101","hostElementId":"room-101","hostViewId":"plan-gf","positionMm":{"xMm":1500,"yMm":1200},"textOverride":"101"}]',
      '--dimensions',
      '[{"id":"dim-overall","levelId":"lvl-0","aMm":{"xMm":0,"yMm":0},"bMm":{"xMm":6000,"yMm":0},"offsetMm":{"xMm":0,"yMm":-500}}]',
      '--parent-revision',
      '7',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.body.mode, 'dry_run');
  assert.equal(out.body.bundle.parentRevision, 7);
  assert.equal(out.body.bundle.assumptions[0].value, 'document.create_drawing_set');
  assert.deepEqual(
    out.body.bundle.commands.map((command) => command.type),
    ['upsertSheet', 'upsertSchedule', 'upsertSheetViewports', 'placeTag', 'createDimension'],
  );
  assert.equal(out.body.bundle.commands[0].titleBlock, 'A1-titleblock');
  assert.equal(out.body.bundle.commands[1].sheetId, 'A101');
  assert.equal(out.body.bundle.commands[2].viewportsMm.length, 2);
  assert.equal(out.body.bundle.commands[3].hostElementId, 'room-101');
  assert.equal(out.body.bundle.commands[4].levelId, 'lvl-0');
});

test('documentation presentation-pack --json generates branded deck and advanced docs bundle', async () => {
  const res = await runCli(
    [
      'documentation',
      'presentation-pack',
      '--sheet-id',
      'A101',
      '--canvas-id',
      'deck-client',
      '--view-id',
      'plan-gf',
      '--brand-template-id',
      'bt-client',
      '--schedule-id',
      'sch-rooms',
      '--schedule-category',
      'room',
      '--parent-revision',
      '7',
      '--json',
    ],
    { BIM_AI_BASE_URL: 'http://127.0.0.1:1', BIM_AI_MODEL_ID: 'model-1' },
  );

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.body.mode, 'dry_run');
  assert.equal(out.body.bundle.parentRevision, 7);
  assert.equal(out.body.bundle.assumptions[0].value, 'presentation.documentation_pack');
  assert.equal(
    out.body.bundle.assumptions[1].value.presentation,
    '/api/v3/models/model-1/presentation-canvases/deck-client/export',
  );
  assert.deepEqual(
    out.body.bundle.commands.map((command) => command.type),
    [
      'create_brand_template',
      'upsertViewTemplate',
      'applyPlanViewTemplate',
      'upsertSheet',
      'upsertSchedule',
      'create_schedule_view',
      'upsertSheetViewports',
      'createRevisionCloud',
      'create_presentation_canvas',
      'create_frame',
      'create_frame',
    ],
  );
  assert.equal(out.body.bundle.commands[0].id, 'bt-client');
  assert.equal(out.body.bundle.commands[2].planViewId, 'plan-gf');
  assert.equal(out.body.bundle.commands[5].category, 'room');
  assert.equal(out.body.bundle.commands[6].viewportsMm.length, 2);
  assert.equal(out.body.bundle.commands[9].presentationCanvasId, 'deck-client');
  assert.equal(out.body.bundle.commands[9].brandTemplateId, 'bt-client');
});

test('export pdf downloads sheet artifact route with sheet id', async () => {
  const requests = [];
  const { server, base } = await startStubServer((req) => {
    requests.push({ method: req.method, url: req.url });
    return { body: { pdf: true } };
  });
  const res = await runCli(['export', 'pdf', '--sheet-id', 'A101', '--out', '-'], {
    BIM_AI_BASE_URL: base,
    BIM_AI_MODEL_ID: 'model-1',
  });
  server.close();

  assert.equal(res.code, 0, res.stderr);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].url, '/api/models/model-1/exports/sheet-preview.pdf?sheetId=A101');
  assert.match(res.stdout, /pdf/);
});

test('opening door-on-wall --commit posts generated bundle to bundles endpoint', async () => {
  const requests = [];
  const { server, base } = await startStubServer((req, body) => {
    requests.push({ method: req.method, url: req.url, body });
    return { body: { ok: true, revision: 8 } };
  });
  const res = await runCli(
    [
      'opening',
      'door-on-wall',
      '--wall',
      'wall-1',
      '--along-t',
      '0.4',
      '--width',
      '1000',
      '--family-type',
      'door-single',
      '--commit',
      '--parent-revision',
      '7',
    ],
    { BIM_AI_BASE_URL: base, BIM_AI_MODEL_ID: 'model-1', BIM_AI_USER_ID: 'agent-1' },
  );
  server.close();

  assert.equal(res.code, 0, res.stderr);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST');
  assert.match(requests[0].url, /\/api\/models\/model-1\/bundles$/);
  assert.equal(requests[0].body.mode, 'commit');
  assert.equal(requests[0].body.userId, 'agent-1');
  assert.deepEqual(requests[0].body.bundle.commands[0], {
    type: 'insertDoorOnWall',
    wallId: 'wall-1',
    alongT: 0.4,
    widthMm: 1000,
    name: 'Door',
    familyTypeId: 'door-single',
  });
});

test('query nearest-wall reports missing planned backend route clearly', async () => {
  const { server, base } = await startStubServer(() => ({
    status: 404,
    body: { detail: 'not found' },
  }));
  const res = await runCli(['query', 'nearest-wall', '--point', '3000,100,0'], {
    BIM_AI_BASE_URL: base,
    BIM_AI_MODEL_ID: 'model-1',
  });
  server.close();

  assert.equal(res.code, 2);
  const err = JSON.parse(res.stderr);
  assert.equal(err.code, 'backend_route_missing');
  assert.equal(err.toolId, 'query.nearest_wall');
  assert.match(err.endpoint, /query\/nearest-wall/);
});

test('qa advisor aliases grouped advisor JSON evidence', async () => {
  const { server, base } = await startStubServer((req) => {
    assert.match(req.url, /\/api\/models\/model-1\/snapshot$/);
    return { body: snapshotBody };
  });
  const res = await runCli(['qa', 'advisor', '--severity', 'warning'], {
    BIM_AI_BASE_URL: base,
    BIM_AI_MODEL_ID: 'model-1',
  });
  server.close();

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.total, 1);
  assert.equal(out.groups[0].code, 'opening_without_host');
  assert.deepEqual(out.groups[0].elementIds, ['opening-1']);
});

test('resolve wall reports missing planned backend route clearly', async () => {
  const { server, base } = await startStubServer(() => ({
    status: 404,
    body: { detail: 'not found' },
  }));
  const res = await runCli(['resolve', 'wall', '--line', '0,0;6000,0'], {
    BIM_AI_BASE_URL: base,
    BIM_AI_MODEL_ID: 'model-1',
  });
  server.close();

  assert.equal(res.code, 2);
  const err = JSON.parse(res.stderr);
  assert.equal(err.code, 'backend_route_missing');
  assert.equal(err.toolId, 'resolve.wall_by_line');
  assert.match(err.endpoint, /resolve\/wall-by-line/);
});

test('resolve host-face posts to the M2 backend resolver route', async () => {
  const requests = [];
  const { server, base } = await startStubServer((req, body) => {
    requests.push({ method: req.method, url: req.url, body });
    return {
      body: {
        ok: true,
        data: {
          host: { elementId: 'wall-1', kind: 'wall' },
          placement: { u: 0.4 },
        },
      },
    };
  });
  const res = await runCli(
    ['resolve', 'host-face', '--point', '3000,0,1000', '--for-kind', 'door', '--level', 'lvl-0'],
    {
      BIM_AI_BASE_URL: base,
      BIM_AI_MODEL_ID: 'model-1',
    },
  );
  server.close();

  assert.equal(res.code, 0, res.stderr);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].url, '/api/models/model-1/resolve/host-face');
  assert.deepEqual(requests[0].body.pointMm, [3000, 0, 1000]);
  assert.deepEqual(requests[0].body.hostKinds, ['wall']);
  assert.equal(JSON.parse(res.stdout).data.host.elementId, 'wall-1');
});
