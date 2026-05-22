#!/usr/bin/env node
/**
 * BRT-14 — duplicate-helper audit.
 *
 * Catalogues private helper definitions (`def _name(...)`) that
 * appear in ≥3 modules under app/bim_ai/. The 2026-05-22 audit
 * pointed out the 16-module `_digest`/`_sha256_json` epidemic;
 * BRT-12/13 closed that, but there's a long tail of smaller
 * duplicates (`_string_list`, `_finding`, `_number`, `_normalize_key`,
 * `_point_in_polygon`, …).
 *
 * Many of those "duplicates" are *not* semantically identical —
 * `_string_list` has 6 implementations that differ on sorted-dedup
 * vs preserve-order, list/scalar/mapping handling. Forcing a single
 * shared impl would change wire output for evidence packs.
 *
 * So this script catalogues, doesn't migrate. The baseline at
 * spec/governance/duplicate-helpers-baseline.json pins per-name occurrence
 * counts. PRs may only DECREASE counts (consolidating duplicates) or
 * leave them unchanged. New duplicates are rejected.
 *
 * Refresh after a legitimate consolidation:
 *   node scripts/check-duplicate-helpers.mjs --update
 */

import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const BACKEND_ROOT = join(REPO_ROOT, 'app', 'bim_ai');
const BASELINE_PATH = join(REPO_ROOT, 'spec', 'governance', 'duplicate-helpers-baseline.json');
const THRESHOLD = 3; // count names appearing in ≥3 modules

// Identifiers that are intentionally shared infrastructure and
// duplicates would be a bug. Their consolidation is enforced by
// other means (BRT-12/13 + the typed-contracts gate).
const KNOWN_SHARED = new Set([
  'digest',
  'sha256_json',
  'sha256_bytes',
  'read_json',
  'write_json',
  'read_json_dict',
  'get_logger',
  'run_subprocess',
]);

const DEF_RX = /^def (_[a-z][a-z0-9_]*)\b/gm;

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

function buildCatalog() {
  const files = listPyFiles(BACKEND_ROOT);
  const byName = new Map(); // name -> sorted array of files
  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
    if (rel.includes('/_io/')) continue;
    const text = readFileSync(file, 'utf8');
    DEF_RX.lastIndex = 0;
    let match;
    const seen = new Set();
    while ((match = DEF_RX.exec(text)) !== null) {
      const name = match[1];
      if (KNOWN_SHARED.has(name) || KNOWN_SHARED.has(name.replace(/^_/, ''))) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(rel);
    }
  }
  const result = {};
  for (const [name, paths] of byName.entries()) {
    if (paths.length >= THRESHOLD) {
      result[name] = paths.sort();
    }
  }
  return result;
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return {note: '', generatedAt: null, helpers: {}};
    throw err;
  }
}

function writeBaseline(catalog) {
  const helpers = {};
  for (const name of Object.keys(catalog).sort()) {
    helpers[name] = catalog[name];
  }
  const payload = {
    note:
      `BRT-14 baseline. Lists private helper names that are defined in ≥${THRESHOLD} modules ` +
      'under app/bim_ai/. Each PR may DECREASE the count for a name (consolidation) or leave it ' +
      'unchanged. New duplicates are rejected. Refresh with `node scripts/check-duplicate-helpers.mjs --update`.',
    generatedAt: new Date().toISOString(),
    threshold: THRESHOLD,
    helpers,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function compare(catalog, baseline) {
  const failures = [];
  const allowed = baseline.helpers || {};
  for (const [name, paths] of Object.entries(catalog)) {
    const allowedCount = (allowed[name] || []).length;
    if (paths.length > allowedCount) {
      failures.push(
        `${name}: defined in ${paths.length} modules but baseline allows ${allowedCount}. ` +
          'Either consolidate into a shared helper, or refresh the baseline if this duplication ' +
          'is intentional (rare — usually means a rename moved a definition).',
      );
      const newSites = paths.filter((p) => !(allowed[name] || []).includes(p));
      for (const p of newSites) failures.push(`    + ${p}`);
    }
  }
  return failures;
}

function main() {
  const update = process.argv.includes('--update');
  const catalog = buildCatalog();
  if (update) {
    writeBaseline(catalog);
    const total = Object.values(catalog).reduce((sum, paths) => sum + paths.length, 0);
    console.log(
      `Updated ${relative(REPO_ROOT, BASELINE_PATH)}: ${Object.keys(catalog).length} helper names ` +
        `with ≥${THRESHOLD} duplicates, ${total} total sites.`,
    );
    return;
  }
  const baseline = loadBaseline();
  const failures = compare(catalog, baseline);
  if (failures.length > 0) {
    console.error('duplicate-helpers gate failed:\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      '\nTo refresh the baseline after a legitimate consolidation or rename:\n' +
        '  node scripts/check-duplicate-helpers.mjs --update\n',
    );
    process.exit(1);
  }
  const names = Object.keys(catalog).length;
  console.log(`duplicate-helpers: ${names} names with ≥${THRESHOLD} duplicates ≤ baseline.`);
}

main();
