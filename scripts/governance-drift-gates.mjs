#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function governanceDriftGateCommands() {
  return [
    {
      label: 'Benchmark suite metadata',
      command: 'node',
      args: ['scripts/benchmarks/suite.mjs', '--json'],
      cwd: REPO_ROOT,
      generatedDocs: [],
    },
    {
      label: 'Renderer support matrix generated doc',
      command: 'pnpm',
      args: [
        '--filter',
        '@bim-ai/web',
        'exec',
        'vitest',
        'run',
        'src/viewport/rendererDiagnostics.test.ts',
      ],
      cwd: REPO_ROOT,
      generatedDocs: ['spec/generated/renderer-support-matrix.md'],
    },
    {
      label: 'Advisor rule ledger generated doc',
      command: 'uv',
      args: [
        'run',
        'pytest',
        'tests/test_advisor_rule_registry.py::test_generated_ledger_is_up_to_date',
        '-q',
      ],
      cwd: path.join(REPO_ROOT, 'app'),
      env: { PYTEST_ADDOPTS: '--no-cov' },
      generatedDocs: ['spec/generated/advisor-rule-ledger.md'],
    },
  ];
}

function parseArgs(argv) {
  return {
    list: argv.includes('--list'),
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const gates = governanceDriftGateCommands();

  if (args.list) {
    console.log(JSON.stringify({ gates }, null, 2));
    return 0;
  }

  for (const gate of gates) {
    console.log(`\n== ${gate.label} ==`);
    const result = spawnSync(gate.command, gate.args, {
      cwd: gate.cwd,
      env: { ...process.env, ...(gate.env ?? {}) },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) return result.status ?? 1;
  }

  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
