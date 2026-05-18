#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const APP_DIR = path.join(REPO_ROOT, 'app');
const PYTHON =
  process.env.PYTHON ??
  (fs.existsSync(path.join(APP_DIR, '.venv', 'bin', 'python'))
    ? path.join(APP_DIR, '.venv', 'bin', 'python')
    : 'python3');

const checks = [
  {
    label: 'M2 verifier format check',
    command: 'pnpm',
    args: [
      'exec',
      'prettier',
      '--check',
      'package.json',
      'scripts/verify-m2-parity.mjs',
      'scripts/benchmarks/simple-house.mjs',
      'scripts/benchmarks/simple-house.test.mjs',
      'spec/ui-mcp-parity-tracker.md',
    ],
  },
  {
    label: 'M2 script syntax checks',
    command: 'node',
    args: ['--check', 'scripts/audit-ui-mcp-parity.mjs'],
  },
  {
    label: 'Benchmark script syntax check',
    command: 'node',
    args: ['--check', 'scripts/benchmarks/simple-house.mjs'],
  },
  {
    label: 'Architecture guard',
    command: 'pnpm',
    args: ['architecture'],
  },
  {
    label: 'Backend focused M2 tests',
    command: PYTHON,
    cwd: APP_DIR,
    env: { PYTHONPATH: '.' },
    args: [
      '-m',
      'pytest',
      'tests/test_api_v3_registry.py',
      'tests/test_query_resolve.py',
      'tests/api/test_apply_bundle_route.py',
      'tests/cmd/test_apply_bundle_engine.py',
      'tests/cmd/test_apply_bundle_types.py',
      'tests/test_command_schemas.py',
      'tests/test_create_wall_chain.py',
      'tests/test_create_roof_opening.py',
      'tests/test_saved_3d_view_clip_evidence.py',
      'tests/test_constructability_report.py',
      '--no-cov',
      '-q',
    ],
  },
  {
    label: 'CLI M2 parity tests',
    command: 'pnpm',
    args: ['--filter', '@bim-ai/cli', 'test'],
  },
  {
    label: 'UI simple-house traceability tests',
    command: 'pnpm',
    args: [
      '--filter',
      '@bim-ai/web',
      'exec',
      'vitest',
      'run',
      'src/cmdPalette/defaultCommands.test.ts',
      'src/cmdPalette/simpleHouseUiTraceability.test.ts',
    ],
  },
  {
    label: 'Simple-house benchmark offline/live-stub tests',
    command: 'node',
    args: ['--test', 'scripts/benchmarks/simple-house.test.mjs'],
  },
  {
    label: 'Simple-house offline smoke command',
    command: 'pnpm',
    args: ['benchmark:simple-house', '--mode', 'offline'],
  },
  {
    label: 'UI/MCP parity audit generation',
    command: 'pnpm',
    args: ['audit:ui-mcp-parity'],
  },
];

function shellLine(check) {
  const cwd =
    check.cwd && check.cwd !== REPO_ROOT ? `cd ${path.relative(REPO_ROOT, check.cwd)} && ` : '';
  const env = check.env
    ? `${Object.entries(check.env)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')} `
    : '';
  return `${cwd}${env}${[check.command, ...check.args].join(' ')}`;
}

for (const [index, check] of checks.entries()) {
  console.log(`\n[${index + 1}/${checks.length}] ${check.label}`);
  console.log(`$ ${shellLine(check)}`);
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd ?? REPO_ROOT,
    env: { ...process.env, ...(check.env ?? {}) },
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`\n${check.label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\n${check.label} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nverify:m2-parity PASS');
