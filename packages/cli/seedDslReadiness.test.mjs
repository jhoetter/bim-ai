import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'packages/cli/cli.mjs');

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
