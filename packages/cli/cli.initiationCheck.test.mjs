import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI = path.join(__dirname, 'cli.mjs');

function runCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args], {
      env: { ...process.env, ...env },
      cwd: path.resolve(__dirname, '../..'),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c.toString();
    });
    child.stderr.on('data', (c) => {
      stderr += c.toString();
    });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

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

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function validIr() {
  return {
    schemaVersion: 'sketch-understanding-ir.v0',
    projectType: 'single_family_house',
    qualityTarget: 'project_initiation_bim',
    sourceInputs: {
      images: ['spec/target-house/target-house-1.png'],
      userInstruction: 'Create a BIM seed model from this sketch.',
    },
    visualRead: {
      primaryView: 'front-left axonometric',
      dominantVolumes: [
        {
          id: 'upper_wrapper',
          description: 'white folded upper shell',
          priority: 'critical',
        },
      ],
      nonNegotiables: ['embedded roof terrace'],
    },
    programme: [
      {
        name: 'Living',
        level: 'ground',
        programmeCode: 'living',
      },
    ],
    features: [
      {
        id: 'roof_terrace',
        kind: 'roof_opening_with_occupied_terrace',
        visualPriority: 'critical',
        mustRenderInViews: ['main', 'roof'],
        capabilityNeeds: ['real roof void', 'guard rail', 'access door'],
      },
    ],
    requiredViews: [
      {
        id: 'main',
        kind: '3d',
        purpose: 'sketch match',
      },
      {
        id: 'roof',
        kind: '3d',
        purpose: 'prove roof cutout',
      },
      {
        id: 'plan',
        kind: 'diagnostic',
        purpose: 'prove room and stair topology',
      },
    ],
    assumptions: [
      {
        id: 'scale',
        statement: 'Scale estimated from image proportions.',
        confidence: 'medium',
        validation: 'compare screenshots',
      },
    ],
  };
}

function validMatrix() {
  return {
    schemaVersion: 'sketch-to-bim-capability-matrix.v0',
    capabilities: [
      {
        id: 'cap.roof_opening_occupied_terrace',
        title: 'Roof opening with occupied terrace',
        featureKinds: ['roof_opening_with_occupied_terrace'],
        status: 'supported',
        commandSurface: ['createRoofOpening'],
        rendererSurface: ['roof mesh subtraction'],
        advisorCoverage: ['opening host warnings'],
        knownFailureModes: ['metadata-only roof opening'],
        requiredEvidence: ['roof screenshot', 'advisor warning JSON'],
        fallback: 'Stop and file a renderer gap.',
      },
    ],
  };
}

test('initiation-check writes coverage and visual checklist for a valid IR', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-ok-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());

  const res = await runCli([
    'initiation-check',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
  ]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.summary.errorCount, 0);

  const coverage = JSON.parse(
    await fs.readFile(path.join(outDir, 'capability-coverage.json'), 'utf8'),
  );
  assert.equal(coverage.features[0].readiness, 'ready');

  const checklist = JSON.parse(
    await fs.readFile(path.join(outDir, 'visual-checklist.json'), 'utf8'),
  );
  assert.ok(checklist.items.some((item) => item.id === 'roof:roof_terrace'));

  const status = await fs.readFile(path.join(outDir, 'status.md'), 'utf8');
  assert.match(status, /Sketch-to-BIM Initiation Check/);
});

test('initiation-check blocks a critical feature with no capability route', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-blocked-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  const ir = validIr();
  ir.features[0].kind = 'unsupported_magic_roof';
  await writeJson(irPath, ir);
  await writeJson(matrixPath, validMatrix());

  const res = await runCli([
    'initiate-check',
    '--ir',
    irPath,
    '--capabilities',
    matrixPath,
    '--out',
    outDir,
  ]);

  assert.equal(res.code, 2);
  const coverage = JSON.parse(
    await fs.readFile(path.join(outDir, 'capability-coverage.json'), 'utf8'),
  );
  assert.equal(coverage.summary.errorCount, 1);
  assert.equal(coverage.features[0].readiness, 'blocked');
  assert.equal(coverage.issues[0].code, 'capability_missing');
  const gaps = JSON.parse(await fs.readFile(path.join(outDir, 'capability-gaps.json'), 'utf8'));
  assert.equal(gaps.taskCount, 1);
  assert.equal(gaps.tasks[0].featureKind, 'unsupported_magic_roof');
});

test('initiation-run captures live advisor and evidence artifacts without screenshots', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-initiation-run-'));
  const irPath = path.join(dir, 'ir.json');
  const matrixPath = path.join(dir, 'matrix.json');
  const outDir = path.join(dir, 'packet');
  await writeJson(irPath, validIr());
  await writeJson(matrixPath, validMatrix());
  const snapshotBody = {
    modelId: 'model-1',
    revision: 7,
    elements: {
      'vp-main': { kind: 'viewpoint', id: 'main' },
      'wall-1': { kind: 'wall', id: 'wall-1' },
    },
    violations: [],
  };
  const { server, base } = await startStubServer((req) => {
    if (req.url?.endsWith('/snapshot')) return { body: snapshotBody };
    if (req.url?.endsWith('/validate')) {
      return {
        body: {
          modelId: 'model-1',
          revision: 7,
          violations: [],
          checks: { errorViolationCount: 0, blockingViolationCount: 0 },
        },
      };
    }
    if (req.url?.endsWith('/evidence-package')) {
      return {
        body: {
          format: 'evidencePackage_v1',
          modelId: 'model-1',
          revision: 7,
          elementCount: 2,
        },
      };
    }
    return { status: 404, body: { error: req.url } };
  });

  const res = await runCli(
    [
      'initiation-run',
      '--ir',
      irPath,
      '--capabilities',
      matrixPath,
      '--model',
      'model-1',
      '--out',
      outDir,
      '--no-screenshots',
    ],
    { BIM_AI_BASE_URL: base },
  );
  server.close();

  assert.equal(res.code, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.liveArtifacts.snapshot.endsWith('live/snapshot.json'), true);

  const warning = JSON.parse(
    await fs.readFile(path.join(outDir, 'live', 'advisor-warning.json'), 'utf8'),
  );
  assert.equal(warning.total, 0);
  const stats = JSON.parse(
    await fs.readFile(path.join(outDir, 'live', 'model-stats.json'), 'utf8'),
  );
  assert.equal(stats.countsByKind.wall, 1);
  const status = await fs.readFile(path.join(outDir, 'status.md'), 'utf8');
  assert.match(status, /Live Artifacts/);
  assert.match(status, /advisorWarning/);
});

test('initiation-compare scores identical PNGs as passing', async () => {
  const fixture = path.resolve(
    __dirname,
    '../web/e2e/__screenshots__/ui-redesign-baselines.spec.ts/darwin/top-bar.png',
  );
  const res = await runCli([
    'initiation-compare',
    '--actual',
    fixture,
    '--target',
    fixture,
    '--threshold',
    '0.99',
  ]);

  assert.equal(res.code, 0, res.stderr);
  const report = JSON.parse(res.stdout);
  assert.equal(report.thresholdPassed, true);
  assert.ok(report.visualSimilarity >= 0.999);
});

test('seed-dsl compile writes a deterministic command bundle', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-seed-dsl-'));
  const outPath = path.join(dir, 'bundle.json');
  const recipePath = path.resolve(
    __dirname,
    '../../spec/examples/seed-dsl-modern-house.example.json',
  );

  const res = await runCli(['seed-dsl', 'compile', '--recipe', recipePath, '--out', outPath]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.ok, true);
  const bundle = JSON.parse(await fs.readFile(outPath, 'utf8'));
  assert.equal(bundle.schemaVersion, 'cmd-v3.0');
  assert.ok(bundle.commands.some((command) => command.type === 'createRoofOpening'));
  assert.ok(bundle.commands.some((command) => command.type === 'saveViewpoint'));
  assert.ok(bundle.commands.some((command) => command.type === 'IndexAsset'));
  assert.ok(bundle.commands.some((command) => command.type === 'PlaceAsset'));
  assert.ok(bundle.commands.some((command) => command.type === 'createRailing'));
  assert.ok(bundle.commands.some((command) => command.id === 'upper-terrace-loggia-floor'));
  assert.ok(
    bundle.commands.some(
      (command) =>
        command.type === 'updateElementProperty' &&
        command.key === 'materialKey' &&
        command.elementId === 'ground-base-floor',
    ),
  );
  assert.ok(Array.isArray(bundle.meta.materialIntent));
});

test('seed-dsl compile emits toposolids, subdivisions, and graded regions in host order', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-seed-dsl-site-'));
  const recipePath = path.join(dir, 'recipe.json');
  const outPath = path.join(dir, 'bundle.json');
  await writeJson(recipePath, {
    schemaVersion: 'seed-dsl.v0',
    id: 'site-seed',
    levels: [{ id: 'eg', name: 'Erdgeschoss', elevationMm: 0 }],
    toposolids: [
      {
        id: 'site-existing',
        name: 'Existing sloped site',
        boundaryMm: [
          { xMm: -5000, yMm: -5000 },
          { xMm: 5000, yMm: -5000 },
          { xMm: 5000, yMm: 5000 },
          { xMm: -5000, yMm: 5000 },
        ],
        heightSamples: [
          { xMm: -5000, yMm: -5000, zMm: -600 },
          { xMm: 5000, yMm: -5000, zMm: -300 },
          { xMm: 5000, yMm: 5000, zMm: 400 },
          { xMm: -5000, yMm: 5000, zMm: 100 },
        ],
        thicknessMm: 1800,
        baseElevationMm: -2200,
        defaultMaterialKey: 'site_grass',
        subdivisions: [
          {
            id: 'entry-paving',
            boundaryMm: [
              { xMm: -1200, yMm: -5000 },
              { xMm: 1200, yMm: -5000 },
              { xMm: 1200, yMm: -2600 },
              { xMm: -1200, yMm: -2600 },
            ],
            finishCategory: 'paving',
            materialKey: 'paving_concrete',
          },
        ],
      },
    ],
    gradedRegions: [
      {
        id: 'building-platform',
        hostToposolidId: 'site-existing',
        boundaryMm: [
          { xMm: -2600, yMm: -2200 },
          { xMm: 2600, yMm: -2200 },
          { xMm: 2600, yMm: 2200 },
          { xMm: -2600, yMm: 2200 },
        ],
        targetMode: 'slope',
        slopeAxisDeg: 90,
        slopeDegPercent: 4,
      },
    ],
    volumes: [
      {
        id: 'site-house',
        levelId: 'eg',
        createWalls: false,
        footprintMm: [
          { xMm: -1200, yMm: -1200 },
          { xMm: 1200, yMm: -1200 },
          { xMm: 1200, yMm: 1200 },
          { xMm: -1200, yMm: 1200 },
        ],
      },
    ],
    toposolidExcavations: [
      {
        id: 'site-house-excavation',
        hostToposolidId: 'site-existing',
        cutterElementId: 'site-house-floor',
        cutMode: 'to_bottom_of_cutter',
        offsetMm: 100,
      },
    ],
    commands: [{ type: 'saveViewpoint', id: 'raw-after-site', name: 'Raw after site' }],
  });

  const res = await runCli(['seed-dsl', 'compile', '--recipe', recipePath, '--out', outPath]);

  assert.equal(res.code, 0, res.stderr);
  const bundle = JSON.parse(await fs.readFile(outPath, 'utf8'));
  const commands = bundle.commands;
  const topIndex = commands.findIndex((command) => command.type === 'CreateToposolid');
  const subdivisionIndex = commands.findIndex(
    (command) => command.type === 'create_toposolid_subdivision',
  );
  const gradedIndex = commands.findIndex((command) => command.type === 'CreateGradedRegion');
  const floorIndex = commands.findIndex((command) => command.id === 'site-house-floor');
  const excavationIndex = commands.findIndex(
    (command) => command.type === 'CreateToposolidExcavation',
  );
  const rawIndex = commands.findIndex((command) => command.id === 'raw-after-site');
  assert.ok(topIndex > -1);
  assert.ok(subdivisionIndex > topIndex);
  assert.ok(gradedIndex > topIndex);
  assert.ok(floorIndex > gradedIndex);
  assert.ok(excavationIndex > floorIndex);
  assert.ok(rawIndex > excavationIndex);
  assert.deepEqual(commands[topIndex].heightSamples[0], {
    xMm: -5000,
    yMm: -5000,
    zMm: -600,
  });
  assert.equal(commands[subdivisionIndex].hostToposolidId, 'site-existing');
  assert.equal(commands[gradedIndex].targetMode, 'slope');
  assert.equal(commands[gradedIndex].slopeDegPercent, 4);
  assert.equal(commands[excavationIndex].hostToposolidId, 'site-existing');
  assert.equal(commands[excavationIndex].cutterElementId, 'site-house-floor');
});

test('seed-dsl compile rejects invalid site grading definitions', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-seed-dsl-site-invalid-'));
  const recipePath = path.join(dir, 'recipe.json');
  const outPath = path.join(dir, 'bundle.json');
  await writeJson(recipePath, {
    schemaVersion: 'seed-dsl.v0',
    toposolids: [
      {
        id: 'site-existing',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 0 },
          { xMm: 0, yMm: 1000 },
        ],
        heightSamples: [{ xMm: 0, yMm: 0, zMm: 0 }],
        heightmapGridMm: { stepMm: 1000, rows: 1, cols: 1, values: [0] },
      },
    ],
    gradedRegions: [
      {
        id: 'bad-flat-platform',
        hostToposolidId: 'site-existing',
        boundaryMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 500, yMm: 0 },
          { xMm: 0, yMm: 500 },
        ],
        targetMode: 'flat',
      },
    ],
  });

  const res = await runCli(['seed-dsl', 'compile', '--recipe', recipePath, '--out', outPath]);

  assert.equal(res.code, 1);
  assert.match(res.stderr, /must not define both heightSamples and heightmapGridMm/);
});

test('initiation-golden runs the preflight golden suite', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-golden-'));
  const manifestPath = path.resolve(__dirname, '../../spec/sketch-to-bim-golden-seeds.json');

  const res = await runCli(['initiation-golden', '--manifest', manifestPath, '--out', dir]);

  assert.equal(res.code, 0, res.stderr);
  const summary = JSON.parse(res.stdout);
  assert.equal(summary.caseCount, 3);
  assert.equal(summary.failCount, 0);
  const written = JSON.parse(await fs.readFile(path.join(dir, 'golden-summary.json'), 'utf8'));
  assert.equal(written.passCount, 3);
});
