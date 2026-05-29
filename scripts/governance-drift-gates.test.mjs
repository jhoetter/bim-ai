import assert from 'node:assert/strict';
import test from 'node:test';

import { governanceDriftGateCommands } from './governance-drift-gates.mjs';

test('governance drift gate consolidates generated-doc checks', () => {
  const gates = governanceDriftGateCommands();
  const docs = new Set(gates.flatMap((gate) => gate.generatedDocs));
  const labels = gates.map((gate) => gate.label);

  assert.deepEqual([...docs].sort(), [
    'spec/generated/advisor-rule-ledger.md',
    'spec/generated/renderer-support-matrix.md',
  ]);
  assert.equal(
    labels.some((label) => label.includes('Benchmark suite')),
    true,
  );
  assert.equal(
    gates.find((gate) => gate.label.includes('Advisor rule ledger'))?.env?.PYTEST_ADDOPTS,
    '--no-cov',
  );
  assert.equal(
    gates.every((gate) => gate.command && gate.args.length > 0),
    true,
  );
});
