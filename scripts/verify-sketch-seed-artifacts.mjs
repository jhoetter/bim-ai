#!/usr/bin/env node
/**
 * Verify sketch-to-BIM seed artifacts without mutating models.
 *
 * This is the CI-friendly counterpart to the skill helper. It checks artifact
 * structure, manifest hashes, and optional final live evidence freshness. Live
 * model loading is intentionally delegated to sketch_bim.py accept because that
 * path already knows how to seed and run initiation evidence.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_ROOT = path.join(REPO_ROOT, 'seed-artifacts');
const DEFAULT_CAPABILITIES = 'spec/sketch-to-bim-capability-matrix.json';

function usage() {
  console.error(`Usage:
  node scripts/verify-sketch-seed-artifacts.mjs [--root seed-artifacts] [--seed <name>]
    [--require-final-evidence] [--live] [--base-url <url>]

Checks manifest/bundle consistency for seed artifacts. With
--require-final-evidence, also requires evidence/live-run-current/tool-run-summary.json
to match the current git HEAD, bundle, IR, and capability-matrix hashes.
With --live, runs the strict sketch_bim.py accept helper for each seed.
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    root: DEFAULT_ROOT,
    seed: null,
    requireFinalEvidence: false,
    live: false,
    baseUrl: process.env.BIM_AI_BASE_URL || 'http://127.0.0.1:8500',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--require-final-evidence') args.requireFinalEvidence = true;
    else if (arg === '--live') {
      args.live = true;
      args.requireFinalEvidence = true;
    } else if (arg === '--root' && argv[i + 1]) args.root = argv[++i];
    else if (arg === '--seed' && argv[i + 1]) args.seed = argv[++i];
    else if (arg === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i];
    else usage();
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function exists(file) {
  return fs
    .stat(file)
    .then(() => true)
    .catch(() => false);
}

async function sha256File(file) {
  return crypto
    .createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
}

function gitHead() {
  const proc = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

function portable(absPath) {
  const rel = path.relative(REPO_ROOT, absPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
    ? rel.split(path.sep).join('/')
    : absPath;
}

async function commandCount(bundlePath) {
  const bundle = await readJson(bundlePath);
  if (Array.isArray(bundle)) return bundle.length;
  if (bundle && typeof bundle === 'object' && Array.isArray(bundle.commands)) {
    return bundle.commands.length;
  }
  throw new Error(`${portable(bundlePath)} must be a command array or object with commands[].`);
}

async function discover(root, selected) {
  if (selected) return [path.join(root, selected)];
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function addFinding(findings, severity, code, message, details = {}) {
  findings.push({ severity, code, message, ...details });
}

async function verifyArtifact(artifactDir, args, currentHead) {
  const name = path.basename(artifactDir);
  const findings = [];
  const manifestPath = path.join(artifactDir, 'manifest.json');
  if (!(await exists(manifestPath))) {
    addFinding(findings, 'error', 'manifest_missing', 'Seed artifact has no manifest.json.');
    return { name, artifact: portable(artifactDir), ok: false, findings };
  }

  const manifest = await readJson(manifestPath);
  if (manifest.schemaVersion !== 'bim-ai.seed-artifact.v1') {
    addFinding(findings, 'error', 'manifest_schema', 'Manifest schemaVersion is not bim-ai.seed-artifact.v1.');
  }
  const bundleRel = manifest.bundle || 'bundle.json';
  const bundlePath = path.join(artifactDir, bundleRel);
  if (!(await exists(bundlePath))) {
    addFinding(findings, 'error', 'bundle_missing', `Bundle is missing: ${bundleRel}`);
  } else {
    const hash = await sha256File(bundlePath);
    if (manifest.bundleSha256 && manifest.bundleSha256 !== hash) {
      addFinding(findings, 'error', 'bundle_hash_mismatch', 'Manifest bundleSha256 does not match bundle.json.', {
        manifestHash: manifest.bundleSha256,
        currentHash: hash,
      });
    }
    const count = await commandCount(bundlePath);
    if (Number(manifest.commandCount) !== count) {
      addFinding(findings, 'error', 'command_count_mismatch', 'Manifest commandCount does not match bundle commands.', {
        manifestCount: manifest.commandCount,
        currentCount: count,
      });
    }
  }

  const evidenceDir = path.join(artifactDir, 'evidence', 'live-run-current');
  const summaryPath = path.join(evidenceDir, 'tool-run-summary.json');
  const hasSummary = await exists(summaryPath);
  if (args.requireFinalEvidence && !hasSummary) {
    addFinding(findings, 'error', 'final_evidence_missing', 'Missing final live evidence tool-run-summary.json.', {
      expected: portable(summaryPath),
    });
  }
  if (hasSummary) {
    const summary = await readJson(summaryPath);
    const checks = {
      gitHead: currentHead,
      bundleSha256: await sha256File(bundlePath),
      irSha256: await sha256File(path.join(artifactDir, 'evidence', 'sketch-ir.json')).catch(() => null),
      capabilitiesSha256: await sha256File(path.join(REPO_ROOT, summary.capabilitiesPath || DEFAULT_CAPABILITIES)).catch(
        () => null,
      ),
    };
    for (const [key, current] of Object.entries(checks)) {
      if (summary[key] !== current) {
        addFinding(findings, 'error', `${key}_stale`, `Final evidence ${key} does not match current input.`, {
          recorded: summary[key],
          current,
        });
      }
    }
  }

  if (args.live) {
    const proc = spawnSync(
      'python3',
      [
        'claude-skills/sketch-to-bim/sketch_bim.py',
        'accept',
        '--seed',
        name,
        '--clear',
        '--base-url',
        args.baseUrl,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    if (proc.status !== 0) {
      addFinding(findings, 'error', 'live_accept_failed', 'Strict live acceptance failed.', {
        exitCode: proc.status,
        stdout: proc.stdout.slice(-4000),
        stderr: proc.stderr.slice(-4000),
      });
    }
  }

  return {
    name,
    artifact: portable(artifactDir),
    ok: findings.every((finding) => finding.severity !== 'error'),
    findings,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);
  const artifacts = await discover(root, args.seed);
  if (!artifacts.length) {
    throw new Error(`No seed artifacts found at ${portable(root)}.`);
  }
  const currentHead = gitHead();
  const results = [];
  for (const artifact of artifacts) {
    results.push(await verifyArtifact(artifact, args, currentHead));
  }
  const payload = {
    schemaVersion: 'sketch-to-bim.seed-artifact-verification.v1',
    ok: results.every((result) => result.ok),
    gitHead: currentHead,
    artifactCount: results.length,
    results,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
