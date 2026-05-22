#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const API_DESCRIPTOR_ROOT = join(REPO_ROOT, 'app', 'bim_ai', 'api');
const CLI_ROOT = join(REPO_ROOT, 'packages', 'cli');
const BASELINE_PATH = join(REPO_ROOT, 'spec', 'governance', 'contract-parity-baseline.json');

function readText(path) {
  return readFileSync(path, 'utf8');
}

function uniqueSorted(rows) {
  return [...new Set(rows)].sort();
}

function pythonFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return pythonFiles(path);
    return entry.isFile() && entry.name.endsWith('.py') ? [path] : [];
  });
}

function cliRuntimeFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return cliRuntimeFiles(path);
    return entry.isFile() && entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs')
      ? [path]
      : [];
  });
}

function readApiDescriptorText() {
  return pythonFiles(API_DESCRIPTOR_ROOT)
    .map((path) => readText(path))
    .join('\n');
}

function readCliRuntimeText() {
  return cliRuntimeFiles(CLI_ROOT)
    .map((path) => readText(path))
    .join('\n');
}

function extractApiToolNames(apiText) {
  return uniqueSorted(
    [...apiText.matchAll(/\bname\s*=\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
  );
}

function extractCliToolIds(cliText) {
  return uniqueSorted(
    [...cliText.matchAll(/\btoolId\s*[:=]\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
  );
}

function duplicateRows(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row, (counts.get(row) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([row]) => row)
    .sort();
}

function loadBaseline() {
  const baseline = JSON.parse(readText(BASELINE_PATH));
  if (baseline.schemaVersion !== 1) {
    throw new Error(`Unsupported ${BASELINE_PATH} schemaVersion: ${baseline.schemaVersion}`);
  }
  if (baseline.owner !== 'CQ-2026-14') {
    throw new Error(`${BASELINE_PATH} must be owned by CQ-2026-14`);
  }
  if (!baseline.reason || typeof baseline.reason !== 'string') {
    throw new Error(`${BASELINE_PATH} needs a reason`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(baseline.targetResolutionDate))) {
    throw new Error(`${BASELINE_PATH} needs targetResolutionDate in YYYY-MM-DD format`);
  }
  return {
    ...baseline,
    cliToolIdsMissingApiDescriptors: uniqueSorted(
      baseline.cliToolIdsMissingApiDescriptors ?? [],
    ),
  };
}

function main() {
  const apiDescriptorText = readApiDescriptorText();
  const cliText = readCliRuntimeText();
  const baseline = loadBaseline();

  const allRegistryNames = [...apiDescriptorText.matchAll(/\bname\s*=\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  const apiToolNames = extractApiToolNames(apiDescriptorText);
  const cliToolIds = extractCliToolIds(cliText);
  const baselineMissing = new Set(baseline.cliToolIdsMissingApiDescriptors);
  const apiToolNameSet = new Set(apiToolNames);

  const missingDescriptors = cliToolIds.filter(
    (toolId) => !apiToolNameSet.has(toolId) && !baselineMissing.has(toolId),
  );
  const staleBaseline = baseline.cliToolIdsMissingApiDescriptors.filter((toolId) =>
    apiToolNameSet.has(toolId),
  );
  const unusedBaseline = baseline.cliToolIdsMissingApiDescriptors.filter(
    (toolId) => !cliToolIds.includes(toolId),
  );
  const duplicateRegistryNames = duplicateRows(allRegistryNames);
  const missingIntrospection = ['api-list-tools', 'api-inspect', 'api-version'].filter(
    (name) => !apiToolNameSet.has(name),
  );
  const missingCliApiUsage = [
    ['api list-tools', /api list-tools/],
    ['api inspect', /api inspect <name>/],
    ['api version', /api version/],
  ].filter(([, pattern]) => !pattern.test(cliText));

  const failures = [];
  if (duplicateRegistryNames.length) {
    failures.push(`Duplicate API descriptor names: ${duplicateRegistryNames.join(', ')}`);
  }
  if (missingIntrospection.length) {
    failures.push(`Missing API introspection descriptors: ${missingIntrospection.join(', ')}`);
  }
  if (missingCliApiUsage.length) {
    failures.push(
      `Missing CLI usage rows for API introspection: ${missingCliApiUsage
        .map(([label]) => label)
        .join(', ')}`,
    );
  }
  if (missingDescriptors.length) {
    failures.push(
      `CLI tool IDs missing API descriptors and baseline entries: ${missingDescriptors.join(', ')}`,
    );
  }
  if (staleBaseline.length) {
    failures.push(`Baseline entries now have descriptors and must be removed: ${staleBaseline.join(', ')}`);
  }
  if (unusedBaseline.length) {
    failures.push(`Baseline entries are no longer emitted by CLI and must be removed: ${unusedBaseline.join(', ')}`);
  }

  const report = {
    schemaVersion: 1,
    apiDescriptorCount: apiToolNames.length,
    cliToolIdCount: cliToolIds.length,
    baselineMissingDescriptorCount: baseline.cliToolIdsMissingApiDescriptors.length,
    missingDescriptors,
    staleBaseline,
    unusedBaseline,
    duplicateRegistryNames,
    ok: failures.length === 0,
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  }

  if (failures.length) {
    if (!process.argv.includes('--json')) {
      console.error('Contract parity check failed:');
      for (const failure of failures) console.error(`  x ${failure}`);
    }
    process.exit(1);
  }

  if (!process.argv.includes('--json')) {
    console.log(
      `Contract parity OK (${report.apiDescriptorCount} descriptors, ${report.cliToolIdCount} CLI tool IDs, ${report.baselineMissingDescriptorCount} tracked gaps)`,
    );
  }
}

main();
