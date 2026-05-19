#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const WAIVER_FILE = join(REPO_ROOT, 'spec', 'quality-waivers.json');
const TODAY = new Date(process.env.QUALITY_WAIVER_TODAY ?? new Date().toISOString().slice(0, 10));
const REQUIRED_FIELDS = [
  'id',
  'check',
  'paths',
  'owner',
  'reason',
  'trackerId',
  'created',
  'expires',
  'severity',
  'replacementPlan',
];
const SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRACKER_ID = /^CQ-\d{4}-\d{2}$/;
const WAIVER_ID = /^CQW-\d{4}-\d{3}$/;

function parseDate(value, label, failures) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    failures.push(`${label} must be an ISO date in YYYY-MM-DD form`);
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    failures.push(`${label} is not a valid calendar date`);
    return null;
  }
  return date;
}

function requireString(waiver, field, failures) {
  if (typeof waiver[field] !== 'string' || waiver[field].trim() === '') {
    failures.push(`${waiver.id ?? '(missing id)'}: ${field} must be a non-empty string`);
  }
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(WAIVER_FILE, 'utf8'));
} catch (error) {
  console.error(`Quality waiver check failed: could not read ${WAIVER_FILE}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const failures = [];
const seenIds = new Set();
const waivers = parsed?.waivers;

if (parsed?.schemaVersion !== 1) {
  failures.push('schemaVersion must be 1');
}
if (!Array.isArray(waivers)) {
  failures.push('waivers must be an array');
}

const active = [];
const expired = [];
const soon = [];

if (Array.isArray(waivers)) {
  for (const waiver of waivers) {
    if (waiver === null || typeof waiver !== 'object' || Array.isArray(waiver)) {
      failures.push('each waiver must be an object');
      continue;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!(field in waiver)) failures.push(`${waiver.id ?? '(missing id)'}: missing ${field}`);
    }

    for (const field of REQUIRED_FIELDS.filter((field) => field !== 'paths')) {
      requireString(waiver, field, failures);
    }

    if (typeof waiver.id === 'string') {
      if (!WAIVER_ID.test(waiver.id)) {
        failures.push(`${waiver.id}: id must match CQW-YYYY-NNN`);
      }
      if (seenIds.has(waiver.id)) {
        failures.push(`${waiver.id}: duplicate waiver id`);
      }
      seenIds.add(waiver.id);
    }

    if (typeof waiver.trackerId === 'string' && !TRACKER_ID.test(waiver.trackerId)) {
      failures.push(`${waiver.id}: trackerId must match CQ-YYYY-NN`);
    }
    if (typeof waiver.severity === 'string' && !SEVERITIES.has(waiver.severity)) {
      failures.push(`${waiver.id}: severity must be one of ${[...SEVERITIES].join(', ')}`);
    }
    if (
      !Array.isArray(waiver.paths) ||
      waiver.paths.length === 0 ||
      waiver.paths.some((path) => typeof path !== 'string' || path.trim() === '')
    ) {
      failures.push(`${waiver.id}: paths must be a non-empty string array`);
    }

    const created = parseDate(waiver.created, `${waiver.id}: created`, failures);
    const expires = parseDate(waiver.expires, `${waiver.id}: expires`, failures);
    if (created && expires && expires < created) {
      failures.push(`${waiver.id}: expires must be on or after created`);
    }

    if (expires) {
      const daysUntilExpiry = Math.floor((expires - TODAY) / 86_400_000);
      const entry = `${waiver.id} ${waiver.severity} ${waiver.check} expires ${waiver.expires} (${waiver.trackerId})`;
      if (daysUntilExpiry < 0) {
        expired.push(entry);
        if (waiver.severity === 'P0' || waiver.severity === 'P1') {
          failures.push(`${waiver.id}: expired ${waiver.severity} waiver blocks the quality gate`);
        }
      } else if (daysUntilExpiry <= 14) {
        soon.push(entry);
        active.push(entry);
      } else {
        active.push(entry);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Quality waiver check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  if (expired.length > 0) {
    console.error('Expired waivers:');
    for (const waiver of expired) console.error(`  - ${waiver}`);
  }
  process.exit(1);
}

console.log('Quality waiver check OK');
console.log(`Active waivers: ${active.length}`);
for (const waiver of active) console.log(`  - ${waiver}`);
console.log(`Expired waivers: ${expired.length}`);
for (const waiver of expired) console.log(`  - ${waiver}`);
console.log(`Expiring within 14 days: ${soon.length}`);
for (const waiver of soon) console.log(`  - ${waiver}`);
