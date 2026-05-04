#!/usr/bin/env node
/**
 * Rebuild the demo model into a cleaner single-storey "one family" footprint.
 *
 * Important: Static JSON bundles cannot safely list deleteElements IDs (snapshot drift aborts commits).
 * This script deletes ALL element ids returned by snapshot, then applies a fixed command list.
 *
 * Usage:
 *   BIM_AI_BASE_URL=http://127.0.0.1:8500 \
 *   BIM_AI_MODEL_ID=<uuid> \
 *   node scripts/apply-one-family-home.mjs --dry-run
 *
 *   # then apply:
 *   node scripts/apply-one-family-home.mjs
 */
import { buildOneFamilyHomeCommands } from '../packages/cli/lib/one-family-home-commands.mjs';

const base = (process.env.BIM_AI_BASE_URL ?? 'http://127.0.0.1:8500').replace(/\/$/, '');
const modelId = process.env.BIM_AI_MODEL_ID;

const dry = process.argv.includes('--dry-run');

if (!modelId) {
  console.error('Set BIM_AI_MODEL_ID');
  process.exit(1);
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, body }, null, 2));
    process.exit(1);
  }
  return body;
}

async function main() {
  const snapUrl = `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`;
  const snap = await fetchJson(snapUrl);
  const ids = Object.keys(snap.elements ?? {});
  if (!ids.length) {
    console.error('Snapshot has no elements — unexpected');
    process.exit(1);
  }

  const commands = [{ type: 'deleteElements', elementIds: ids }, ...buildOneFamilyHomeCommands()];

  const url = dry
    ? `${base}/api/models/${encodeURIComponent(modelId)}/commands/bundle/dry-run`
    : `${base}/api/models/${encodeURIComponent(modelId)}/commands/bundle`;

  const out = await fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ commands, userId: process.env.BIM_AI_USER_ID ?? 'local-dev' }),
  });

  console.log(JSON.stringify({ dry, ok: out.ok, revision: out.revision ?? out.wouldRevision, violations: out.violations?.length }, null, 2));
  if (out.violations?.length) {
    console.log(JSON.stringify(out.violations, null, 2));
  }
  if (dry && out.summaryAfter) {
    console.log(JSON.stringify({ summaryAfter: out.summaryAfter }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
