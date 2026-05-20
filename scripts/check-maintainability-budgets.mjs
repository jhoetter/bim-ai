#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { buildReport } from './code-quality-report.mjs';

function parseArgs(argv) {
  const args = { json: false };
  for (const arg of argv) {
    if (arg === '--') continue;
    if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/check-maintainability-budgets.mjs [--json]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout;
}

function changedFiles() {
  const files = new Set();
  const candidates = [];
  if (process.env.GITHUB_BASE_REF) {
    candidates.push([`origin/${process.env.GITHUB_BASE_REF}...HEAD`]);
  }
  candidates.push(['HEAD~1...HEAD']);
  candidates.push(['--cached']);
  candidates.push([]);

  for (const range of candidates) {
    const output = git(['diff', '--name-only', '--diff-filter=ACMRT', ...range]);
    if (output == null) continue;
    for (const file of output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)) {
      files.add(file);
    }
  }
  return [...files];
}

function buildBudgetGate() {
  const report = buildReport();
  const changed = new Set(changedFiles());
  const overBudget = report.maintainability.overBudget;
  const changedOverBudget = overBudget.filter((row) => changed.has(row.path));
  const failures = [];

  const blockingWithoutDisposition = overBudget.filter(
    (row) => row.severity === 'blocking' && !row.hasDisposition,
  );
  if (blockingWithoutDisposition.length > 0) {
    failures.push({
      code: 'blocking_budget_without_disposition',
      rows: blockingWithoutDisposition,
    });
  }

  const unownedOverBudget = overBudget.filter(
    (row) => row.owner === 'unowned' && row.severity === 'blocking',
  );
  if (unownedOverBudget.length > 0) {
    failures.push({ code: 'over_budget_without_owner', rows: unownedOverBudget });
  }

  const changedWithoutDisposition = changedOverBudget.filter((row) => !row.hasDisposition);
  if (changedWithoutDisposition.length > 0) {
    failures.push({
      code: 'changed_over_budget_without_disposition',
      rows: changedWithoutDisposition,
    });
  }

  const config = report.maintainability.budgetConfig;
  if (!config.targetBlockingDate || config.ownershipCount === 0 || !config.hasComplexityBudgets) {
    failures.push({
      code: 'budget_config_incomplete',
      rows: [
        {
          path: config.path,
          targetBlockingDate: config.targetBlockingDate,
          hasComplexityBudgets: config.hasComplexityBudgets,
        },
      ],
    });
  }

  return {
    schemaVersion: 'maintainability-budget-gate.v1',
    pass: failures.length === 0,
    changedFiles: [...changed].sort(),
    summary: {
      overBudgetCount: report.maintainability.overBudgetCount,
      changedOverBudgetCount: changedOverBudget.length,
      blockingWithoutDispositionCount: blockingWithoutDisposition.length,
      unownedOverBudgetCount: unownedOverBudget.length,
      failureCount: failures.length,
    },
    failures,
  };
}

function renderText(gate) {
  const lines = [];
  lines.push(`Maintainability budget gate ${gate.pass ? 'OK' : 'FAILED'}`);
  lines.push(
    `Over budget: ${gate.summary.overBudgetCount}; changed over budget: ${gate.summary.changedOverBudgetCount}; failures: ${gate.summary.failureCount}`,
  );
  for (const failure of gate.failures) {
    lines.push(`- ${failure.code}`);
    for (const row of failure.rows.slice(0, 10)) {
      lines.push(`  ${row.path}${row.lines ? ` (${row.lines} lines)` : ''}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const gate = buildBudgetGate();
  process.stdout.write(args.json ? `${JSON.stringify(gate, null, 2)}\n` : renderText(gate));
  if (!gate.pass) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { buildBudgetGate };
