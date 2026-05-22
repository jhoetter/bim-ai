#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const BUDGET_CONFIG_PATH = 'spec/governance/code-quality-budgets.json';

function parseArgs(argv) {
  const args = { json: false };
  for (const arg of argv) {
    if (arg === '--') continue;
    if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/check-js-lint-budget.mjs [--json]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function loadBudget() {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, BUDGET_CONFIG_PATH), 'utf8'));
  if (!parsed.jsLintBudgets) {
    throw new Error(`${BUDGET_CONFIG_PATH} is missing jsLintBudgets`);
  }
  return parsed.jsLintBudgets;
}

function runEslint() {
  const tempDir = mkdtempSync(join(tmpdir(), 'bim-ai-eslint-'));
  const outPath = join(tempDir, 'eslint.json');
  try {
    const result = spawnSync(
      'pnpm',
      [
        '--filter',
        '@bim-ai/web',
        'exec',
        'eslint',
        'src',
        '--format',
        'json',
        '--output-file',
        outPath,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    if (!existsSync(outPath)) {
      throw new Error(result.stderr || result.stdout || 'ESLint did not produce JSON output');
    }
    const rows = JSON.parse(readFileSync(outPath, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('ESLint JSON output is not an array');
    return rows;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function relativePath(path) {
  return relative(REPO_ROOT, path).replaceAll('\\', '/');
}

function summarize(rows) {
  const ruleCounts = new Map();
  let errorCount = 0;
  let warningCount = 0;
  let fatalCount = 0;
  const affectedFiles = [];

  for (const row of rows) {
    const rowErrors = row.errorCount ?? 0;
    const rowWarnings = row.warningCount ?? 0;
    errorCount += rowErrors;
    warningCount += rowWarnings;
    if (rowErrors > 0 || rowWarnings > 0) affectedFiles.push(relativePath(row.filePath));

    for (const message of row.messages ?? []) {
      const ruleId = message.ruleId || 'fatal';
      ruleCounts.set(ruleId, (ruleCounts.get(ruleId) ?? 0) + 1);
      if (!message.ruleId || message.fatal) fatalCount += 1;
    }
  }

  return {
    errorCount,
    warningCount,
    affectedFileCount: affectedFiles.length,
    fatalCount,
    ruleCounts: Object.fromEntries(
      [...ruleCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    ),
    affectedFiles: affectedFiles.sort(),
  };
}

function compare(summary, budget) {
  const failures = [];
  const checks = [
    ['error_count_over_budget', summary.errorCount, budget.maxErrorCount],
    ['warning_count_over_budget', summary.warningCount, budget.maxWarningCount],
    ['affected_file_count_over_budget', summary.affectedFileCount, budget.maxAffectedFileCount],
    ['fatal_count_over_budget', summary.fatalCount, budget.maxFatalCount],
  ];

  for (const [code, actual, max] of checks) {
    if (typeof max === 'number' && actual > max) {
      failures.push({ code, actual, max });
    }
  }

  const maxRuleCounts = budget.maxRuleCounts ?? {};
  for (const [ruleId, count] of Object.entries(summary.ruleCounts)) {
    const max = maxRuleCounts[ruleId];
    if (typeof max !== 'number') {
      failures.push({ code: 'unbudgeted_rule', ruleId, actual: count, max: 0 });
    } else if (count > max) {
      failures.push({ code: 'rule_count_over_budget', ruleId, actual: count, max });
    }
  }

  return failures;
}

function buildJsLintBudgetGate() {
  const budget = loadBudget();
  const summary = summarize(runEslint());
  const failures = compare(summary, budget);
  return {
    schemaVersion: 'js-lint-budget-gate.v1',
    pass: failures.length === 0,
    budget,
    summary,
    failures,
  };
}

function renderText(gate) {
  const lines = [];
  lines.push(`JavaScript lint budget gate ${gate.pass ? 'OK' : 'FAILED'}`);
  lines.push(
    `Errors: ${gate.summary.errorCount}/${gate.budget.maxErrorCount}; warnings: ${gate.summary.warningCount}/${gate.budget.maxWarningCount}; affected files: ${gate.summary.affectedFileCount}/${gate.budget.maxAffectedFileCount}; fatal: ${gate.summary.fatalCount}/${gate.budget.maxFatalCount}`,
  );
  for (const failure of gate.failures) {
    lines.push(
      `- ${failure.code}${failure.ruleId ? ` ${failure.ruleId}` : ''}: ${failure.actual} > ${failure.max}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const gate = buildJsLintBudgetGate();
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

export { buildJsLintBudgetGate };
