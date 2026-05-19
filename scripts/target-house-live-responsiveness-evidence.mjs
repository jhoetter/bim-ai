#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCHEMA_VERSION = 'target-house-live-responsiveness.v1';
const DEFAULT_OUT =
  'seed-artifacts/target-house-1/evidence/live-run-current/live-responsiveness-evidence.json';

const INTERACTIONS = [
  {
    id: 'orbit',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    budget: { maxLatencyMs: 150, p95LatencyMs: 80, maxLongTaskMs: 80, maxDroppedFramePercent: 5 },
  },
  {
    id: 'select',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    budget: { maxLatencyMs: 250, p95LatencyMs: 160, maxLongTaskMs: 80, maxDroppedFramePercent: 5 },
  },
  {
    id: 'lens-switch',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    budget: {
      maxLatencyMs: 500,
      p95LatencyMs: 300,
      maxLongTaskMs: 120,
      maxDroppedFramePercent: 8,
    },
  },
  {
    id: 'advisor-open',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    budget: {
      maxLatencyMs: 500,
      p95LatencyMs: 300,
      maxLongTaskMs: 120,
      maxDroppedFramePercent: 8,
    },
  },
  {
    id: 'advisor-close',
    trackerRefs: ['BIR-L02', 'BIR-N11'],
    budget: {
      maxLatencyMs: 350,
      p95LatencyMs: 220,
      maxLongTaskMs: 100,
      maxDroppedFramePercent: 6,
    },
  },
];

function usage() {
  console.error(`Usage:
  node scripts/target-house-live-responsiveness-evidence.mjs --print-contract
  node scripts/target-house-live-responsiveness-evidence.mjs --import <metrics.json> [--out <file>]

Imports browser-collected metrics into the target-house live responsiveness evidence shape.
The canonical classifier lives in packages/web/src/lib/liveResponsivenessStability.ts.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { printContract: false, importPath: null, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--print-contract') args.printContract = true;
    else if (arg === '--import' && argv[index + 1]) args.importPath = argv[++index];
    else if (arg === '--out' && argv[index + 1]) args.out = argv[++index];
    else usage();
  }
  if (!args.printContract && !args.importPath) usage();
  return args;
}

function contract() {
  return {
    schemaVersion: SCHEMA_VERSION,
    targetId: 'target-house-1',
    requiredInteractions: INTERACTIONS,
    websocketChurnPolicy: {
      benignViteProxySocketCodes: ['EPIPE', 'ECONNRESET'],
      actionableAppCloseCodes: [4403, 4404],
      exhaustedReconnectBudget: 'actionable',
      unknownChurn: 'actionable',
    },
    canonicalClassifier: 'packages/web/src/lib/liveResponsivenessStability.ts',
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.printContract) {
    console.log(JSON.stringify(contract(), null, 2));
    return;
  }

  const metricsPath = path.resolve(args.importPath);
  const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
  const evidence = {
    schemaVersion: SCHEMA_VERSION,
    targetId: typeof metrics.targetId === 'string' ? metrics.targetId : 'target-house-1',
    generatedAt: new Date(0).toISOString(),
    importedFrom: path.relative(process.cwd(), metricsPath).split(path.sep).join('/'),
    importedMetricsSha256: sha256Json(metrics),
    contract: contract(),
    metrics,
    note: 'Imported metrics are intended for classification by packages/web/src/lib/liveResponsivenessStability.ts.',
  };
  const outPath = path.resolve(args.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(outPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error?.stack ?? error?.message ?? String(error));
    process.exit(1);
  });
}
