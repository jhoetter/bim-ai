import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const BENCHMARK_ROOT = path.join(REPO_ROOT, 'spec', 'benchmarks');

const SCENARIOS = [
  {
    id: 'documentation-pack',
    requiredCommandTypes: [
      'upsertViewTemplate',
      'applyPlanViewTemplate',
      'createSectionView',
      'createElevationView',
      'createCalloutView',
      'upsertSheet',
      'upsertSheetViewports',
      'create_schedule_view',
      'createRevisionCloud',
      'exportDocumentationPack',
    ],
    requiredSurfaceMinimums: {
      viewTemplates: 2,
      planViews: 2,
      sectionViews: 1,
      elevationViews: 1,
      calloutViews: 1,
      sheets: 2,
      schedules: 3,
      revisions: 2,
      exports: 2,
    },
    expectedCommandCount: 13,
  },
  {
    id: 'presentation-pack',
    requiredCommandTypes: [
      'create_brand_template',
      'create_presentation_canvas',
      'saveViewpoint',
      'create_frame',
      'create_render_bundle',
      'exportPresentationDeck',
      'createShareLink',
    ],
    requiredSurfaceMinimums: {
      brandTemplates: 1,
      presentationCanvases: 1,
      frames: 3,
      savedViews: 3,
      renderBundles: 1,
      exports: 2,
      shareLinks: 1,
    },
    expectedCommandCount: 11,
  },
];

const REQUIRED_EVIDENCE = ['ui', 'cmdK', 'mcpCli', 'advisor', 'visual', 'export', 'semanticDiff'];
const POSITIVE_STATUSES = new Set(['passed-clean', 'validated-replay-clean']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function scenarioDir(id) {
  return path.join(BENCHMARK_ROOT, id);
}

function assertArtifactExists(baseDir, relativePath, label) {
  const artifactPath = path.join(baseDir, relativePath);
  assert.equal(fs.existsSync(artifactPath), true, `${label} missing artifact ${relativePath}`);
  return artifactPath;
}

function assertScenarioEvidence(id, scenario) {
  for (const kind of REQUIRED_EVIDENCE) {
    const entry = scenario.evidence?.[kind];
    assert.ok(entry, `${id}.${kind} evidence missing`);
    assert.ok(
      ['executable', 'validated-replay'].includes(entry.classification),
      `${id}.${kind} must be executable or validated replay`,
    );
    assert.equal(POSITIVE_STATUSES.has(entry.status), true, `${id}.${kind} has weak status`);
    assert.notEqual(entry.pass, false, `${id}.${kind} explicitly failed`);
    assert.ok(Array.isArray(entry.artifacts), `${id}.${kind} artifacts must be an array`);
    assert.ok(entry.artifacts.length > 0, `${id}.${kind} must name deterministic artifacts`);
  }
}

function assertCommandCoverage(config, bundle, expected) {
  assert.equal(bundle.commands.length, config.expectedCommandCount);
  const commandTypes = new Set(bundle.commands.map((command) => command.commandType));
  for (const commandType of config.requiredCommandTypes) {
    assert.equal(commandTypes.has(commandType), true, `${config.id} missing ${commandType}`);
  }

  for (const [surface, minimum] of Object.entries(config.requiredSurfaceMinimums)) {
    const ids = expected.surfaces?.[surface];
    assert.ok(Array.isArray(ids), `${config.id} expectedSemantics.${surface} must be an array`);
    assert.equal(
      ids.length >= minimum,
      true,
      `${config.id} expectedSemantics.${surface} needs at least ${minimum} entries`,
    );
  }
}

function assertValidatedReplay(config, bundle, replay, equivalence) {
  const commandIds = bundle.commands.map((command) => command.id);
  assert.deepEqual(replay.replayCommandIds, commandIds);
  assert.equal(replay.proof.fixtureCommandCount, commandIds.length);
  assert.equal(replay.proof.replayCommandCount, commandIds.length);
  assert.equal(replay.proof.semanticDiffMismatches, 0);
  assert.equal(replay.cmdKBridge.exactFixturePayloadExecutable, true);
  assert.equal(replay.cmdKBridge.activatorOnlyOperationCount, 0);
  assert.equal(equivalence.cmdKBridgeCoverage.exactFixturePayloadExecutable, true);
  assert.equal(equivalence.cmdKBridgeCoverage.activatorOnlyOperationCount, 0);
  assert.equal(equivalence.cmdKBridgeCoverage.exactUiExecutableOperationCount, commandIds.length);
}

function assertQualityEvidence(id, evidenceDir) {
  const advisor = readJson(path.join(evidenceDir, 'advisor-validation.json'));
  assert.deepEqual(advisor.advisor.blockingFindings, []);
  assert.equal(advisor.validation.passed, true);

  const visual = readJson(path.join(evidenceDir, 'visual-evidence.json'));
  assert.equal(visual.blankCaptureCount, 0);
  assert.equal(
    visual.captures.every((capture) => capture.nonBlankPixelRatio > 0.1),
    true,
    `${id} visual evidence must be nonblank`,
  );

  const exportEvidence = readJson(path.join(evidenceDir, 'export-evidence.json'));
  assert.equal(exportEvidence.errorCount, 0);
  assert.equal(
    exportEvidence.exports.every(
      (item) => item.byteLength > 0 && item.manifestStatus === 'passed-clean',
    ),
    true,
    `${id} export evidence must have nonempty passing manifests`,
  );

  const semanticDiff = readJson(path.join(evidenceDir, 'semantic-diff.json'));
  assert.deepEqual(semanticDiff.mismatches, []);

  const renderBundle = readJson(path.join(evidenceDir, 'render-bundle.json'));
  assert.equal(
    renderBundle.renderTargets.every((target) => target.width > 0 && target.height > 0),
    true,
    `${id} render bundle targets must be dimensioned`,
  );
}

test('M4 presentation and documentation scenarios reference parseable evidence artifacts', () => {
  for (const config of SCENARIOS) {
    const dir = scenarioDir(config.id);
    const scenario = readJson(path.join(dir, 'scenario.json'));
    assert.equal(scenario.scenarioId, config.id);
    assertScenarioEvidence(config.id, scenario);

    for (const entry of Object.values(scenario.evidence)) {
      for (const artifact of entry.artifacts) assertArtifactExists(dir, artifact, config.id);
    }
  }
});

test('M4 presentation and documentation command bundles cover expected professional surfaces', () => {
  for (const config of SCENARIOS) {
    const dir = scenarioDir(config.id);
    const bundle = readJson(path.join(dir, 'mcp-cli-command-bundle.json'));
    const expected = readJson(path.join(dir, 'expected-semantics.json'));
    assert.equal(bundle.scenarioId, config.id);
    assert.equal(expected.scenarioId, config.id);
    assertCommandCoverage(config, bundle, expected);
  }
});

test('M4 presentation and documentation UI/Cmd+K replay evidence is exact-payload validated', () => {
  for (const config of SCENARIOS) {
    const dir = scenarioDir(config.id);
    assertValidatedReplay(
      config,
      readJson(path.join(dir, 'mcp-cli-command-bundle.json')),
      readJson(path.join(dir, 'ui-validated-replay.json')),
      readJson(path.join(dir, 'ui-equivalence.json')),
    );
  }
});

test('M4 presentation and documentation quality/export/render/diff evidence is clean', () => {
  for (const config of SCENARIOS) {
    assertQualityEvidence(config.id, path.join(scenarioDir(config.id), 'live-evidence'));
  }
});
