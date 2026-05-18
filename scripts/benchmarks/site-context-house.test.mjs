import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runSiteContextBenchmark } from './site-context-house.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BENCHMARK_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'site-and-context-house');

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(BENCHMARK_DIR, relativePath), 'utf8'));
}

test('site/context benchmark runner validates deterministic fixture semantics', async () => {
  const result = await runSiteContextBenchmark();

  assert.equal(result.ok, true);
  assert.equal(result.commandCount, 13);
  assert.deepEqual(result.semanticDiff.differences, []);
  assert.equal(result.semanticCounts.toposolid, 1);
  assert.equal(result.semanticCounts.graded_region, 1);
  assert.equal(result.semanticCounts.property_line, 4);
  assert.equal(result.semanticCounts.context_object, 3);
  assert.equal(result.replay.ok, true);
  assert.equal(result.evidenceHooks.advisor.ok, true);
  assert.equal(result.evidenceHooks.visual.ok, true);
  assert.equal(result.evidenceHooks.export.ok, true);
});

test('site/context scenario evidence points to parseable non-placeholder artifacts', async () => {
  const scenario = await readJson('scenario.json');
  const forbidden = /\b(todo|placeholder|stub|mock|traceability-only|documentation-only)\b/i;

  for (const kind of ['ui', 'cmdK', 'mcpCli', 'advisor', 'visual', 'export', 'semanticDiff']) {
    const entry = scenario.evidence[kind];
    assert.ok(['executable', 'validated-replay'].includes(entry.classification), kind);
    assert.ok(!forbidden.test(`${entry.classification} ${entry.status}`), kind);
    assert.ok(entry.artifacts.length > 0, kind);

    for (const artifact of entry.artifacts) {
      const parsed = await readJson(artifact);
      assert.equal(typeof parsed, 'object', artifact);
      assert.notEqual(parsed.ok, false, artifact);
      assert.ok(!forbidden.test(JSON.stringify(parsed)), artifact);
    }
  }
});

test('site/context Cmd+K replay evidence is direct payload or validated replay only', async () => {
  const traceability = await readJson('ui-cmdk-traceability.json');
  const equivalence = await readJson('ui-equivalence.json');

  assert.equal(traceability.coverage.validatedReplay, true);
  assert.equal(traceability.coverage.unmappedCommandTypes.length, 0);
  assert.equal(equivalence.cmdKBridgeCoverage.validatedReplay, true);
  assert.equal(equivalence.cmdKBridgeCoverage.directPayloadBridge, true);
  assert.equal(equivalence.cmdKBridgeCoverage.blockedOrUnmappedCommandTypes.length, 0);

  for (const row of equivalence.cmdKBridgeCoverage.rows) {
    assert.ok(['direct-payload', 'validated-replay'].includes(row.classification));
    assert.ok(row.coveredCommandTypes.length > 0);
  }
});
