import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { run as runStructureAndMepLite } from './structure-and-mep-lite.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'structure-and-mep-lite');

async function readFixture(name) {
  return JSON.parse(await fs.readFile(path.join(FIXTURE_DIR, name), 'utf8'));
}

test('structure-and-mep-lite offline runner validates M4-B and M4-C semantic coverage', async () => {
  const code = await runStructureAndMepLite(['--mode', 'offline']);
  assert.equal(code, 0);
});

test('structure-and-mep-lite command bundle covers structure construction and MEP typed outputs', async () => {
  const bundle = await readFixture('mcp-cli-command-bundle.json');
  const expected = await readFixture('expected-semantics.json');
  const commands = bundle.commands;
  const byType = new Map();
  const byId = new Map(commands.map((command) => [command.id, command]).filter(([id]) => id));
  for (const command of commands) {
    const list = byType.get(command.type) ?? [];
    list.push(command);
    byType.set(command.type, list);
  }

  for (const type of expected.expected.commandSurfaceUsage.mustInclude) {
    assert.ok(byType.has(type), `${type} missing`);
  }

  assert.equal(byType.get('createColumn').length, expected.expected.structure.columns);
  assert.equal(byType.get('createBeam').length, expected.expected.structure.beams);
  assert.equal(byType.get('createConstraint').length, expected.expected.structure.constraints);
  assert.equal(
    byType.get('createConstructionPackage').length,
    expected.expected.construction.packages,
  );
  assert.equal(
    byType.get('createConstructionLogistics').length,
    expected.expected.construction.logistics,
  );
  assert.equal(
    byType.get('upsertConstructionQaChecklist').length,
    expected.expected.construction.qaChecklists,
  );

  for (const column of byType.get('createColumn')) {
    assert.equal(typeof column.levelId, 'string');
    assert.equal(typeof column.positionMm.xMm, 'number');
    assert.equal(typeof column.heightMm, 'number');
  }
  for (const beam of byType.get('createBeam')) {
    assert.equal(typeof beam.levelId, 'string');
    assert.equal(typeof beam.startMm.xMm, 'number');
    assert.equal(typeof beam.endMm.yMm, 'number');
  }

  const constraint = byType.get('createConstraint')[0];
  for (const ref of [...constraint.refsA, ...constraint.refsB]) {
    assert.ok(byId.has(ref.elementId), `${ref.elementId} constraint ref unresolved`);
  }

  const logistics = byType.get('createConstructionLogistics')[0];
  assert.equal(logistics.constructionPackageId, 'sml-pkg-structure');
  assert.ok(logistics.boundaryMm.length >= 4);

  const checklist = byType.get('upsertConstructionQaChecklist')[0];
  for (const id of checklist.targetElementIds) {
    assert.ok(byId.has(id), `${id} checklist target unresolved`);
  }

  for (const type of ['createPipe', 'createDuct', 'createCableTray']) {
    const command = byType.get(type)[0];
    assert.equal(typeof command.levelId, 'string');
    assert.equal(typeof command.startMm.xMm, 'number');
    assert.equal(typeof command.endMm.yMm, 'number');
    assert.equal(typeof command.elevationMm, 'number');
    assert.equal(typeof command.systemType, 'string');
    assert.equal(typeof command.serviceLevel, 'string');
  }

  for (const type of ['createMepEquipment', 'createFixture', 'createMepTerminal']) {
    const command = byType.get(type)[0];
    assert.equal(typeof command.levelId, 'string');
    assert.equal(typeof command.positionMm.xMm, 'number');
    assert.equal(typeof command.systemType, 'string');
  }

  const opening = byType.get('createMepOpeningRequest')[0];
  assert.equal(opening.hostElementId, 'sml-beam-grid-a');
  assert.deepEqual(opening.requesterElementIds, ['sml-duct-sa-1']);
  assert.equal(opening.systemType, 'hvac_supply');
});

test('structure-and-mep-lite replay and evidence artifacts are accepted and not activator-only', async () => {
  const scenario = await readFixture('scenario.json');
  const replay = await readFixture('ui-validated-replay.json');
  const traceability = await readFixture('ui-cmdk-traceability.json');
  const advisor = await readFixture('live-evidence/advisor-validation.json');
  const visual = await readFixture('live-evidence/visual-evidence.json');
  const exportEvidence = await readFixture('live-evidence/export-evidence.json');
  const semanticDiff = await readFixture('live-evidence/semantic-diff.json');

  assert.equal(scenario.evidence.ui.classification, 'validated-replay');
  assert.equal(scenario.evidence.cmdK.classification, 'validated-replay');
  assert.equal(replay.validation.semanticEquivalentToBundle, true);
  assert.equal(replay.validation.activatorOnlyCount, 0);
  assert.equal(traceability.exclusions.activatorOnlyCount, 0);

  const replayStepIds = new Set(replay.steps.map((step) => step.id));
  for (const item of traceability.coverage) {
    assert.ok(item.commandTypes.length > 0, `${item.toolSurface} lacks command types`);
    for (const stepId of item.replayStepIds) {
      assert.ok(replayStepIds.has(stepId), `${stepId} missing from replay`);
    }
  }

  assert.equal(advisor.pass, true);
  assert.equal(visual.pass, true);
  assert.ok(visual.views.every((view) => view.nonblankProof.ok));
  assert.equal(exportEvidence.pass, true);
  assert.equal(exportEvidence.manifests.gltf.pass, true);
  assert.equal(exportEvidence.manifests.ifc.pass, true);
  assert.equal(semanticDiff.pass, true);
  assert.deepEqual(semanticDiff.diff.unresolvedReferences, []);
});
