import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'families-assets-materials');

async function readFixture(relativePath) {
  return JSON.parse(await fs.readFile(path.join(FIXTURE_DIR, relativePath), 'utf8'));
}

function commandRefs(bundle) {
  return new Set(bundle.commands.map((command) => command.type));
}

test('families-assets-materials scenario evidence points at parseable deterministic artifacts', async () => {
  const scenario = await readFixture('scenario.json');
  assert.equal(scenario.lifecycle, 'm4-d-evidence-collected');
  assert.deepEqual(scenario.remainingBlockers, []);

  for (const key of ['ui', 'cmdK']) {
    assert.equal(scenario.evidence[key].classification, 'validated-replay');
    assert.equal(scenario.evidence[key].status, 'validated');
  }
  for (const key of ['mcpCli', 'advisor', 'visual', 'export', 'semanticDiff']) {
    assert.equal(scenario.evidence[key].classification, 'executable');
  }

  const artifactPaths = new Set([
    ...Object.values(scenario.fixtures).filter(
      (value) => typeof value === 'string' && value.endsWith('.json'),
    ),
    ...Object.values(scenario.evidence).flatMap((entry) => entry.artifacts ?? []),
  ]);
  for (const artifactPath of artifactPaths) {
    await readFixture(artifactPath);
  }
});

test('families-assets-materials command bundle covers M4-D executable MCP and CLI surfaces', async () => {
  const bundle = await readFixture('mcp-cli-command-bundle.json');
  const expected = await readFixture('expected-semantics.json');
  const types = commandRefs(bundle);

  for (const type of expected.expected.commandSurfaceUsage.mustInclude) {
    assert.ok(types.has(type), `${type} missing from command bundle`);
  }
  for (const toolId of expected.expected.commandSurfaceUsage.toolIds) {
    assert.ok(
      toolId === 'catalog-query' || bundle.meta.toolSequence.includes(toolId),
      `${toolId} missing from deterministic tool sequence`,
    );
  }

  const byId = new Map(
    bundle.commands.filter((command) => command.id).map((command) => [command.id, command]),
  );
  assert.equal(byId.get('fam-chair-lounge-m4d').type, 'upsertFamilyType');
  assert.equal(byId.get('inst-lounge-chair-01').familyTypeId, 'fam-chair-lounge-m4d');
  assert.equal(byId.get('asset-planter-01').type, 'PlaceAsset');
  assert.equal(byId.get('kit-kitchen-west-01').type, 'place_kit');
  assert.equal(byId.get('decal-menu-board-01').type, 'create_decal');

  const materialUpdates = bundle.commands.filter(
    (command) => command.type === 'update_material_pbr',
  );
  assert.equal(materialUpdates.length, expected.expected.counts.pbrMaterials);
  for (const material of materialUpdates) {
    assert.equal(typeof material.albedoMapId, 'string');
    assert.equal(typeof material.normalMapId, 'string');
    assert.equal(typeof material.roughnessMapId, 'string');
    assert.ok(material.uvScaleMm.uMm > 0);
    assert.ok(material.uvScaleMm.vMm > 0);
  }

  const assignments = bundle.commands.filter(
    (command) => command.type === 'set_element_prop' && command.key === 'materialKey',
  );
  const paintCommands = bundle.commands.filter(
    (command) => command.type === 'set_element_prop' && command.key === 'faceMaterialOverrides',
  );
  assert.equal(assignments.length, expected.expected.counts.materialAssignments);
  assert.equal(paintCommands.length, expected.expected.counts.paintedFaces);
  assert.equal(paintCommands[0].value[0].generatedFaceId, 'fam-wall-west:face:interior');
});

test('families-assets-materials replay, catalog, material quality, and export fixtures are consistent', async () => {
  const bundle = await readFixture('mcp-cli-command-bundle.json');
  const catalog = await readFixture('catalog-evidence.json');
  const materialQuality = await readFixture('material-quality.json');
  const replay = await readFixture('ui-validated-replay.json');
  const cmdK = await readFixture('ui-cmdk-traceability.json');
  const exportEvidence = await readFixture('live-evidence/export-evidence.json');
  const semanticDiff = await readFixture('live-evidence/semantic-diff.json');

  assert.ok(catalog.queries.every((query) => query.toolId === 'catalog-query'));
  assert.deepEqual(
    catalog.queries.map((query) => query.selectedItemId),
    ['seating/lounge-chair-parametric', 'decor/indoor-planter-600', 'kitchen_modular_linear_v2'],
  );

  const materialIds = new Set(materialQuality.materials.map((material) => material.id));
  for (const command of bundle.commands.filter((item) => item.type === 'update_material_pbr')) {
    assert.ok(materialIds.has(command.id), `${command.id} missing material quality evidence`);
  }
  assert.equal(materialQuality.acceptance.allReferencedTextureIdsResolved, true);
  assert.equal(materialQuality.acceptance.allSwatchesNonblank, true);

  const replayToolIds = new Set(replay.steps.map((step) => step.toolId));
  const cmdKToolIds = new Set(cmdK.entries.map((entry) => entry.toolId));
  for (const toolId of bundle.meta.toolSequence) {
    assert.ok(replayToolIds.has(toolId), `${toolId} missing from UI replay`);
    assert.ok(cmdKToolIds.has(toolId), `${toolId} missing from Cmd+K traceability`);
  }
  assert.ok(replay.steps.every((step) => step.activatorOnly === false));
  assert.ok(cmdK.entries.every((entry) => entry.activatorOnly === false));

  const exported = exportEvidence.manifest.extensions.BIM_AI_exportManifest_v0;
  assert.equal(exported.countsByKind.family_type, 2);
  assert.equal(exported.countsByKind.material, 2);
  assert.equal(exported.countsByKind.decal, 1);
  for (const id of semanticDiff.changedIds) {
    assert.ok(
      exported.exportedIds.includes(id) || id === 'fam-wall-west',
      `${id} missing from export evidence`,
    );
  }
});
