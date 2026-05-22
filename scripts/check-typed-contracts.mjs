#!/usr/bin/env node
/**
 * BRT-42 — typed-contracts gate.
 *
 * The 2026-05-22 backend audit found 799 functions in app/bim_ai/
 * returning `dict[str, Any]` and 61 FastAPI handlers accepting
 * `body: dict[str, Any]`. The fix is BRT-01..05; this script is the
 * *guard* — it pins the per-file count of each smell and fails when a
 * file's count grows. New files contribute zero allowance, so any
 * `-> dict[str, Any]` in a new module is rejected.
 *
 * Baseline lives at spec/typed-contracts-baseline.json. Refresh it
 * after a legitimate reduction with:
 *   node scripts/check-typed-contracts.mjs --update
 *
 * The two probes:
 *   - `dictReturn` : occurrences of `-> dict[str, Any]` (or `dict[str, Any]:`
 *     in any position on the signature line — function returns and yields)
 *   - `dictBody`   : occurrences of `body: dict[str, Any]` (FastAPI ingress)
 */

import {readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const BACKEND_ROOT = join(REPO_ROOT, 'app', 'bim_ai');
const BASELINE_PATH = join(REPO_ROOT, 'spec', 'typed-contracts-baseline.json');

const RX_DICT_RETURN = /-> dict\[str, Any\]/g;
const RX_DICT_BODY = /body: dict\[str, Any\]/g;

function listPyFiles(root) {
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === '__pycache__') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.py')) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out.sort();
}

function countMatches(text, regex) {
  regex.lastIndex = 0;
  let n = 0;
  while (regex.exec(text) !== null) n += 1;
  return n;
}

function buildCounts() {
  const files = listPyFiles(BACKEND_ROOT);
  const dictReturn = {};
  const dictBody = {};
  let totalReturn = 0;
  let totalBody = 0;
  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
    const text = readFileSync(file, 'utf8');
    const r = countMatches(text, RX_DICT_RETURN);
    const b = countMatches(text, RX_DICT_BODY);
    if (r > 0) {
      dictReturn[rel] = r;
      totalReturn += r;
    }
    if (b > 0) {
      dictBody[rel] = b;
      totalBody += b;
    }
  }
  return {dictReturn, dictBody, totalReturn, totalBody};
}

function loadBaseline() {
  try {
    const raw = readFileSync(BASELINE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return {generatedAt: null, totals: {dictReturn: 0, dictBody: 0}, files: {dictReturn: {}, dictBody: {}}};
    }
    throw err;
  }
}

function writeBaseline(counts) {
  const payload = {
    note:
      'BRT-42 baseline. Counts allowed `-> dict[str, Any]` and `body: dict[str, Any]` per file. ' +
      'Each PR may only DECREASE these. Refresh with `node scripts/check-typed-contracts.mjs --update` ' +
      'after a legitimate fix.',
    generatedAt: new Date().toISOString(),
    totals: {dictReturn: counts.totalReturn, dictBody: counts.totalBody},
    files: {dictReturn: counts.dictReturn, dictBody: counts.dictBody},
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function compare(counts, baseline) {
  const failures = [];
  const probes = [
    {key: 'dictReturn', label: '-> dict[str, Any]', current: counts.dictReturn, allowed: baseline.files?.dictReturn ?? {}},
    {key: 'dictBody', label: 'body: dict[str, Any]', current: counts.dictBody, allowed: baseline.files?.dictBody ?? {}},
  ];
  for (const probe of probes) {
    for (const [file, count] of Object.entries(probe.current)) {
      const ceiling = probe.allowed[file] ?? 0;
      if (count > ceiling) {
        failures.push(
          `${file}: ${count} occurrences of \`${probe.label}\` but baseline allows ${ceiling}. ` +
            (ceiling === 0
              ? 'This file is not in the baseline — either it is new, or the smell was previously zero.'
              : 'Reduce the count, or refresh the baseline with --update if this is a legitimate increase ' +
                '(rare — usually means a refactor split one file into two and counts moved).'),
        );
      }
    }
  }
  return failures;
}

function main() {
  const update = process.argv.includes('--update');
  const counts = buildCounts();
  if (update) {
    writeBaseline(counts);
    console.log(
      `Updated ${relative(REPO_ROOT, BASELINE_PATH)}: ` +
        `${counts.totalReturn} \`-> dict[str, Any]\`, ${counts.totalBody} \`body: dict[str, Any]\`.`,
    );
    return;
  }
  const baseline = loadBaseline();
  const failures = compare(counts, baseline);
  if (failures.length > 0) {
    console.error('typed-contracts gate failed:\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      '\nTo refresh the baseline after a legitimate fix:\n  node scripts/check-typed-contracts.mjs --update\n',
    );
    process.exit(1);
  }
  console.log(
    `typed-contracts: ${counts.totalReturn} \`-> dict[str, Any]\` / ${counts.totalBody} \`body: dict[str, Any]\` ` +
      `≤ baseline (${baseline.totals?.dictReturn ?? 0} / ${baseline.totals?.dictBody ?? 0}).`,
  );
}

main();
