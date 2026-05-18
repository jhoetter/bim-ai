import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'mep-lite');

async function readFixture(name) {
  return JSON.parse(await fs.readFile(path.join(FIXTURE_DIR, name), 'utf8'));
}

test('mep-lite deterministic fixture covers typed M4-C command surface metadata', async () => {
  const bundle = await readFixture('mcp-cli-command-bundle.json');
  const expected = await readFixture('expected-semantics.json');
  const commands = bundle.commands;
  const byType = new Map(commands.map((command) => [command.type, command]));

  for (const type of expected.expected.commandSurfaceUsage.mustInclude) {
    assert.ok(byType.has(type), `${type} missing from MEP-lite fixture`);
  }

  for (const type of ['createPipe', 'createDuct', 'createCableTray']) {
    const command = byType.get(type);
    assert.equal(typeof command.levelId, 'string');
    assert.equal(typeof command.startMm.xMm, 'number');
    assert.equal(typeof command.endMm.yMm, 'number');
    assert.equal(typeof command.elevationMm, 'number');
    assert.equal(typeof command.systemType, 'string');
    assert.equal(typeof command.serviceLevel, 'string');
  }

  for (const type of ['createMepEquipment', 'createFixture', 'createMepTerminal']) {
    const command = byType.get(type);
    assert.equal(typeof command.levelId, 'string');
    assert.equal(typeof command.positionMm.xMm, 'number');
    assert.equal(typeof command.systemType, 'string');
  }

  const opening = byType.get('createMepOpeningRequest');
  assert.equal(opening.hostElementId, 'mep-wall-1');
  assert.deepEqual(opening.requesterElementIds, ['mep-duct-sa-1']);
  assert.equal(opening.systemType, 'hvac_supply');
});
