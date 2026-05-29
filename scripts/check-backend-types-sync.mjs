#!/usr/bin/env node
/**
 * ARCH-CQ-06 — CI gate for backend Pydantic -> web TypeScript codegen.
 *
 * Regenerates `packages/web/src/generated/backend-types.ts` by invoking
 * `app/scripts/export_schemas.py`, then diffs the result against the
 * committed copy. Fails when they drift so the PR author has to commit
 * the regenerated file.
 *
 * Wiring: chained into `pnpm verify:strict` via the root `package.json`.
 *
 * Usage:
 *   node scripts/check-backend-types-sync.mjs           # check (CI mode)
 *   node scripts/check-backend-types-sync.mjs --write   # regenerate in place
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const APP_ROOT = join(REPO_ROOT, 'app');
// Path note: codegen output lives in packages/core, not packages/web.
// See app/scripts/export_schemas.py header for the layering rationale.
const GENERATED_PATH = join(REPO_ROOT, 'packages', 'core', 'src', 'generated', 'backend-types.ts');

const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');

function fail(message) {
  process.stderr.write(`check-backend-types-sync: ${message}\n`);
  process.exit(1);
}

function runCodegen() {
  // Prefer `uv` (the canonical lane) and fall back to bare python if the
  // dev box has no uv installed. CI always has uv.
  const candidates = [
    ['uv', ['run', 'python', 'scripts/export_schemas.py']],
    ['python3', ['scripts/export_schemas.py']],
    ['python', ['scripts/export_schemas.py']],
  ];
  let lastError = null;
  for (const [cmd, cmdArgs] of candidates) {
    const result = spawnSync(cmd, cmdArgs, {
      cwd: APP_ROOT,
      env: { ...process.env, PYTHONPATH: APP_ROOT },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.error && result.error.code === 'ENOENT') {
      lastError = result.error;
      continue;
    }
    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? '';
      fail(`codegen failed (exit ${result.status}):\n${stderr}`);
    }
    return;
  }
  fail(
    `could not locate a python runner (tried uv, python3, python). ` +
      `Last error: ${lastError?.message ?? 'unknown'}`,
  );
}

function readFileOrEmpty(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const before = readFileOrEmpty(GENERATED_PATH);
runCodegen();
const after = readFileOrEmpty(GENERATED_PATH);

if (before === after) {
  process.stdout.write('check-backend-types-sync: generated file is up-to-date\n');
  process.exit(0);
}

if (writeMode) {
  process.stdout.write('check-backend-types-sync: regenerated (write mode)\n');
  process.exit(0);
}

// Restore the committed copy so the working tree stays clean when the gate
// fails, then print a diff-style hint for the author.
writeFileSync(GENERATED_PATH, before, 'utf8');
process.stderr.write(
  [
    'check-backend-types-sync: backend-types.ts is out of date.',
    '',
    'The committed copy of packages/core/src/generated/backend-types.ts does',
    'not match the codegen output. Regenerate and commit:',
    '',
    '  cd app && PYTHONPATH=. uv run python scripts/export_schemas.py',
    '',
    'Then `git add packages/core/src/generated/backend-types.ts` and re-run',
    '`pnpm verify:strict`.',
    '',
  ].join('\n'),
);
process.exit(1);
