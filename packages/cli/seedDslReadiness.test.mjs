import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'packages/cli/cli.mjs');
const TARGET_HOUSE_RECIPE = path.join(
  ROOT,
  'seed-artifacts/target-house-1/evidence/target-house-1.recipe.json',
);

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args], { cwd: ROOT, env: process.env });
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

test('seed-dsl modern house example covers readiness macros D07-D10 and real BIM data', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-seed-dsl-readiness-'));
  const outPath = path.join(dir, 'bundle.json');
  const recipePath = path.join(ROOT, 'spec/examples/seed-dsl-modern-house.example.json');

  const res = await runCli(['seed-dsl', 'compile', '--recipe', recipePath, '--out', outPath]);

  assert.equal(res.code, 0, res.stderr);
  const bundle = JSON.parse(await fs.readFile(outPath, 'utf8'));
  assert.equal(bundle.schemaVersion, 'cmd-v3.0');
  assert.ok(bundle.commands.some((command) => command.type === 'insertWindowOnWall'));
  assert.ok(bundle.commands.some((command) => command.type === 'upsertFloorType'));
  assert.ok(bundle.commands.some((command) => command.type === 'upsertRoofType'));
  assert.ok(
    bundle.commands.some(
      (command) => command.type === 'updateElementProperty' && command.key === 'bimTypeIntent',
    ),
  );
  assert.ok(
    bundle.commands.some(
      (command) =>
        command.type === 'updateElementProperty' && command.key === 'openingScheduleMetadata',
    ),
  );
  assert.ok(
    bundle.commands.some(
      (command) => command.type === 'updateElementProperty' && command.key === 'roomBimIntent',
    ),
  );
  assert.ok(
    bundle.commands.some(
      (command) => command.type === 'PlaceAsset' && command.paramValues?.roomId === 'room-living',
    ),
  );
  assert.ok(bundle.commands.some((command) => command.type === 'createElevationView'));
  assert.ok(bundle.commands.some((command) => command.type === 'createSectionCut'));
  assert.ok(bundle.commands.some((command) => command.type === 'upsertSheet'));
  assert.ok(bundle.commands.some((command) => command.type === 'upsertSchedule'));
  assert.ok(bundle.commands.some((command) => command.type === 'create_schedule_view'));
  assert.ok(bundle.commands.some((command) => command.type === 'upsertSheetViewports'));
});

test(
  'target house recipe compiles front loggia wrapper without cleanup deletes',
  { skip: existsSync(TARGET_HOUSE_RECIPE) ? false : 'target-house-1 seed artifact not present' },
  async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bim-ai-target-house-seed-dsl-'));
    const outPath = path.join(dir, 'bundle.json');
    const recipePath = TARGET_HOUSE_RECIPE;

    const res = await runCli(['seed-dsl', 'compile', '--recipe', recipePath, '--out', outPath]);

    assert.equal(res.code, 0, res.stderr);
    const bundle = JSON.parse(await fs.readFile(outPath, 'utf8'));
    const frontLeft = bundle.commands.find(
      (command) => command.type === 'createWall' && command.id === 'hf-upper-wrapper-shell-wall-01',
    );
    const mainStair = bundle.commands.find(
      (command) => command.type === 'createStair' && command.id === 'main-stair',
    );
    const upperWrapperFloor = bundle.commands.find(
      (command) => command.id === 'upper-wrapper-floor',
    );
    const roofCourtFloor = bundle.commands.find((command) => command.id === 'hf-roof-court-floor');
    const roofCourtRailing = bundle.commands.find(
      (command) => command.id === 'hf-roof-court-railing',
    );
    const frontLoggiaFloor = bundle.commands.find(
      (command) => command.id === 'hf-front-loggia-floor',
    );
    const frontLoggiaRailing = bundle.commands.find(
      (command) => command.id === 'hf-front-loggia-railing',
    );

    assert.equal(
      bundle.commands.some((command) => command.type === 'deleteElement'),
      false,
    );
    assert.equal(
      bundle.commands.some((command) => command.id === 'front-loggia-wide-opening'),
      false,
    );
    assert.deepEqual(frontLeft?.start, { xMm: 0, yMm: -450 });
    assert.deepEqual(frontLeft?.end, { xMm: 1200, yMm: -450 });
    assert.equal(
      bundle.commands.some((command) => command.id === 'hf-upper-wrapper-shell-wall-01-right'),
      true,
    );
    assert.deepEqual(mainStair?.boundaryMm, [
      { xMm: 1300, yMm: 1100 },
      { xMm: 2300, yMm: 1100 },
      { xMm: 2300, yMm: 3200 },
      { xMm: 1300, yMm: 3200 },
    ]);
    assert.deepEqual(upperWrapperFloor?.props?.supportedByIds, [
      'ground-base-wall-01',
      'ground-base-wall-02',
      'ground-base-wall-03',
      'ground-base-wall-04',
    ]);
    assert.equal(upperWrapperFloor?.props?.isCantilever, true);
    assert.equal(roofCourtFloor?.props?.exteriorSpaceType, 'roof_terrace');
    assert.deepEqual(roofCourtFloor?.props?.supportedByIds, ['upper-wrapper-floor']);
    assert.equal(roofCourtRailing?.hostFloorId, 'hf-roof-court-floor');
    assert.equal(frontLoggiaFloor?.props?.exteriorSpaceType, 'loggia');
    assert.deepEqual(frontLoggiaFloor?.props?.supportedByIds, ['upper-wrapper-floor']);
    assert.equal(frontLoggiaRailing?.hostFloorId, 'hf-front-loggia-floor');
  },
);
