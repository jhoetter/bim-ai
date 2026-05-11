#!/usr/bin/env node
/**
 * Package a generated seed bundle and its source material into one named,
 * self-contained artifact set.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_OUT = path.join(REPO_ROOT, 'seed-artifacts');
const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const ADVISOR_RULE_FILES = [
  'app/bim_ai/constructability_advisories.py',
  'app/bim_ai/constructability_report.py',
  'app/bim_ai/constraints_metadata.py',
  'packages/web/src/advisor/advisorViolationContext.ts',
  'packages/web/src/advisor/perspectiveFilter.ts',
];

function usage() {
  console.error(`Usage:
  node scripts/create-seed-artifact.mjs \\
    --name <seed-name> \\
    --source <folder-with-user-inputs> \\
    --bundle <cmd-v3-bundle.json> \\
    [--live-evidence <dir>] [--require-live-evidence] \\
    [--title <label>] [--description <text>] [--created-at <iso8601>] \\
    [--out <artifact-root>] [--force]
`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') out.force = true;
    else if (arg === '--require-live-evidence') out.requireLiveEvidence = true;
    else if (arg.startsWith('--') && argv[i + 1]) out[arg.slice(2)] = argv[++i];
    else usage();
  }
  if (!out.name || !out.source || !out.bundle) usage();
  out.name = String(out.name).trim().toLowerCase();
  if (!NAME_RE.test(out.name)) {
    console.error(`Invalid --name '${out.name}'. Use lowercase letters, digits, '.', '_' or '-'.`);
    process.exit(2);
  }
  return out;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function sha256File(file) {
  return crypto
    .createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
}

async function pathExists(file) {
  return fs
    .stat(file)
    .then(() => true)
    .catch(() => false);
}

async function currentGitHead() {
  const { spawnSync } = await import('node:child_process');
  const proc = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

async function digestFiles(files) {
  const h = crypto.createHash('sha256');
  for (const relPath of [...files].sort()) {
    h.update(relPath);
    h.update('\0');
    const abs = path.join(REPO_ROOT, relPath);
    h.update((await pathExists(abs)) ? await sha256File(abs) : 'missing');
    h.update('\0');
  }
  return h.digest('hex');
}

function portablePath(absPath) {
  const relative = path.relative(REPO_ROOT, absPath);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  return path.basename(absPath);
}

function shouldCopy(src) {
  const parts = src.split(path.sep);
  const blockedDirs = new Set([
    '.git',
    '.hg',
    '.svn',
    'node_modules',
    '.venv',
    '.pytest_cache',
    '.ruff_cache',
    '__pycache__',
    'test-results',
    'playwright-report',
  ]);
  if (parts.some((part) => blockedDirs.has(part))) return false;
  if (src.endsWith('.pyc') || src.endsWith('.DS_Store')) return false;
  return true;
}

async function ensureBundle(bundlePath) {
  const bundle = await readJson(bundlePath);
  const commands = Array.isArray(bundle)
    ? bundle
    : bundle && typeof bundle === 'object' && Array.isArray(bundle.commands)
      ? bundle.commands
      : null;
  if (!commands) {
    throw new Error(`${bundlePath} must be a command array or an object with commands[].`);
  }
  return {
    commandCount: commands.length,
    schemaVersion: Array.isArray(bundle) ? 'cmd-array' : String(bundle.schemaVersion ?? 'unknown'),
  };
}

async function ensureLiveEvidence(evidenceDir, bundlePath) {
  if (!evidenceDir) return null;
  const dir = path.resolve(evidenceDir);
  const summaryPath = path.join(dir, 'tool-run-summary.json');
  const summary = await readJson(summaryPath);
  if (summary.schemaVersion !== 'sketch-to-bim.tool-run.v1') {
    throw new Error(`${summaryPath} must use schemaVersion sketch-to-bim.tool-run.v1.`);
  }
  const currentHead = await currentGitHead();
  const bundleHash = await sha256File(bundlePath);
  const advisorRuleDigest = await digestFiles(summary.advisorRuleFiles || ADVISOR_RULE_FILES);
  const mismatches = {};
  if (summary.gitHead !== currentHead) mismatches.gitHead = { recorded: summary.gitHead, current: currentHead };
  if (summary.bundleSha256 !== bundleHash) {
    mismatches.bundleSha256 = { recorded: summary.bundleSha256, current: bundleHash };
  }
  if (summary.advisorRuleDigest !== advisorRuleDigest) {
    mismatches.advisorRuleDigest = { recorded: summary.advisorRuleDigest, current: advisorRuleDigest };
  }
  if (Object.keys(mismatches).length) {
    throw new Error(
      `Live evidence is stale for ${dir}: ${JSON.stringify(mismatches, null, 2)}`,
    );
  }
  return {
    directory: dir,
    summary,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(args.source);
  const bundlePath = path.resolve(args.bundle);
  const outRoot = path.resolve(args.out ?? DEFAULT_OUT);
  const artifactDir = path.join(outRoot, args.name);
  const liveEvidence = args['live-evidence']
    ? await ensureLiveEvidence(args['live-evidence'], bundlePath)
    : null;
  if (args.requireLiveEvidence && !liveEvidence) {
    throw new Error(
      'Final live evidence is required. Run sketch_bim.py accept first and pass --live-evidence <dir>.',
    );
  }

  const sourceStat = await fs.stat(sourceDir).catch(() => null);
  if (!sourceStat?.isDirectory()) throw new Error(`--source must be a directory: ${sourceDir}`);
  const bundleStats = await ensureBundle(bundlePath);

  if (args.force) {
    await fs.rm(artifactDir, { recursive: true, force: true });
  } else if (
    await fs
      .stat(artifactDir)
      .then(() => true)
      .catch(() => false)
  ) {
    throw new Error(`Artifact already exists: ${artifactDir}. Pass --force to replace it.`);
  }

  await fs.mkdir(artifactDir, { recursive: true });
  await fs.cp(sourceDir, path.join(artifactDir, 'source'), {
    recursive: true,
    filter: (src) => shouldCopy(src),
  });
  await fs.copyFile(bundlePath, path.join(artifactDir, 'bundle.json'));
  await fs.mkdir(path.join(artifactDir, 'evidence'), { recursive: true });
  if (liveEvidence) {
    await fs.cp(liveEvidence.directory, path.join(artifactDir, 'evidence', 'live-run-current'), {
      recursive: true,
      filter: (src) => shouldCopy(src),
    });
  }
  await fs.writeFile(
    path.join(artifactDir, 'evidence', 'README.md'),
    '# Evidence\n\nPlace advisor JSON, screenshots, validation output, and acceptance notes here. Keep files portable and scoped to this artifact.\n',
    'utf8',
  );

  const manifest = {
    schemaVersion: 'bim-ai.seed-artifact.v1',
    name: args.name,
    slug: args.name,
    title: args.title ?? args.name,
    description: args.description ?? '',
    bundle: 'bundle.json',
    sourceRoot: 'source',
    evidenceRoot: 'evidence',
    createdAt: args['created-at'] ?? new Date().toISOString(),
    generatedBy: {
      tool: 'scripts/create-seed-artifact.mjs',
      version: 1,
    },
    acceptance: liveEvidence
      ? {
          status: 'accepted',
          evidenceRoot: 'evidence/live-run-current',
          gitHead: liveEvidence.summary.gitHead,
          bundleSha256: liveEvidence.summary.bundleSha256,
          irSha256: liveEvidence.summary.irSha256,
          capabilitiesSha256: liveEvidence.summary.capabilitiesSha256,
          advisorRuleDigest: liveEvidence.summary.advisorRuleDigest,
          generatedAtEpochMs: liveEvidence.summary.generatedAtEpochMs,
        }
      : {
          status: args.requireLiveEvidence ? 'missing' : 'not-provided',
        },
    inputPaths: {
      source: portablePath(sourceDir),
      bundle: portablePath(bundlePath),
    },
    bundleSha256: await sha256File(bundlePath),
    commandCount: bundleStats.commandCount,
    commandSchemaVersion: bundleStats.schemaVersion,
    entryComment: {
      body:
        args.description ?? `Seed artifact '${args.name}' loaded from packaged source material.`,
    },
  };
  await fs.writeFile(
    path.join(artifactDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        artifact: path.relative(REPO_ROOT, artifactDir),
        name: args.name,
        commandCount: bundleStats.commandCount,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
