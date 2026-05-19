import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { loadBenchmarkSuite, summarizeBenchmarkSuite, validateBenchmarkSuite } from './suite.mjs';
import { generateProfessionalSuiteEvidence } from './professional-suite-evidence.mjs';

test('same-house benchmark suite validates and enumerates multiple scenarios', async () => {
  const loadedSuite = await loadBenchmarkSuite();
  const errors = validateBenchmarkSuite(loadedSuite);
  assert.deepEqual(errors, []);

  const summary = summarizeBenchmarkSuite(loadedSuite);
  assert.equal(summary.ok, true);
  assert.equal(summary.scenarioCount >= 2, true);
  assert.deepEqual(summary.requiredEvidenceKinds, [
    'ui',
    'cmdK',
    'mcpCli',
    'integrity',
    'advisor',
    'rendererDiagnostics',
    'visual',
    'export',
    'performance',
    'acceptance',
    'methodology',
    'semanticDiff',
  ]);
});

test('UI evidence classifications distinguish replay, traceability, and missing evidence', async () => {
  const summary = summarizeBenchmarkSuite(await loadBenchmarkSuite());
  assert.deepEqual(summary.uiEvidenceClassifications.sort(), [
    'executable',
    'missing',
    'traceability-only',
    'validated-replay',
  ]);

  const scenarios = new Map(summary.scenarios.map((scenario) => [scenario.scenarioId, scenario]));
  assert.equal(
    scenarios.get('simple-single-storey-house').evidence.ui.classification,
    'validated-replay',
  );
  assert.equal(
    scenarios.get('simple-single-storey-house').evidence.cmdK.classification,
    'validated-replay',
  );
  assert.equal(
    scenarios.get('simple-single-storey-house').evidence.mcpCli.classification,
    'executable',
  );
  assert.equal(
    scenarios.get('simple-single-storey-house').evidence.integrity.classification,
    'executable',
  );
  assert.equal(
    scenarios.get('simple-single-storey-house').evidence.rendererDiagnostics.classification,
    'executable',
  );
  assert.equal(
    scenarios.get('simple-single-storey-house').evidence.performance.classification,
    'executable',
  );
  assert.equal(
    scenarios.get('simple-single-storey-house').evidence.acceptance.classification,
    'executable',
  );
  assert.equal(
    scenarios.get('simple-single-storey-house').evidence.methodology.classification,
    'validated-replay',
  );

  assert.equal(
    scenarios.get('two-storey-house-with-stair').evidence.ui.classification,
    'traceability-only',
  );
  assert.equal(
    scenarios.get('two-storey-house-with-stair').evidence.cmdK.classification,
    'traceability-only',
  );
  assert.equal(
    scenarios.get('two-storey-house-with-stair').evidence.semanticDiff.classification,
    'executable',
  );
  assert.equal(
    scenarios.get('two-storey-house-with-stair').evidence.methodology.classification,
    'traceability-only',
  );
});

test('professional benchmark suite uses expanded evidence kinds and committed diagnostic ledgers', async () => {
  const suitePath = path.resolve('spec/benchmarks/professional-suite.json');
  const loadedSuite = await loadBenchmarkSuite(suitePath);
  assert.deepEqual(validateBenchmarkSuite(loadedSuite), []);

  const summary = summarizeBenchmarkSuite(loadedSuite);
  assert.equal(summary.ok, true);
  assert.equal(summary.scenarioCount, 5);
  assert.deepEqual(summary.requiredEvidenceKinds, [
    'ui',
    'cmdK',
    'mcpCli',
    'integrity',
    'advisor',
    'rendererDiagnostics',
    'visual',
    'export',
    'performance',
    'acceptance',
    'methodology',
    'semanticDiff',
  ]);
  for (const scenario of summary.scenarios) {
    assert.equal(scenario.evidence.integrity.classification, 'executable');
    assert.equal(scenario.evidence.rendererDiagnostics.classification, 'executable');
    assert.equal(scenario.evidence.performance.classification, 'executable');
    assert.equal(scenario.evidence.acceptance.classification, 'executable');
    assert.equal(scenario.evidence.methodology.classification, 'executable');
  }

  const evidence = await generateProfessionalSuiteEvidence({ suitePath });
  assert.equal(evidence.ok, true);
  assert.equal(evidence.scenarioCount, 5);
  assert.equal(
    evidence.scenarios.every((scenario) => scenario.acceptanceOk),
    true,
  );
});
