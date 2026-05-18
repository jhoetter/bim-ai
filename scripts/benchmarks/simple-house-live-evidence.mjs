#!/usr/bin/env node
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import { runBenchmark } from './simple-house.mjs';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const BENCHMARK_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'simple-single-storey-house');
const DEFAULT_OUT_DIR = path.join(BENCHMARK_DIR, 'live-evidence');
const REQUIRED_ARTIFACTS = [
  'benchmark-result.json',
  'execution-evidence.json',
  'live-dry-run-evidence.json',
  'command-log-summary.json',
  'snapshot-summary.json',
];

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/simple-house-live-evidence.mjs --base-url <url> (--project-id <id> | --model-id <id>) [options]

Options:
  --out-dir <path>                 Evidence directory. Defaults to spec/benchmarks/simple-single-storey-house/live-evidence.
  --project-id <id>                Create a disposable model with POST /api/projects/{id}/models.
  --model-id <id>                  Target an existing isolated model.
  --parent-revision <rev>          Required for --commit-live against an existing model.
  --template-id <id>               Optional template id for disposable model creation.
  --slug <slug>                    Optional disposable model slug. Defaults to simple-house-m2p-<uuid>.
  --user-id <id>                   Benchmark user id. Defaults to m2-p-live-evidence-runner.
  --commit-live                    Mutate the isolated target after a clean dry-run.
  --allow-existing-model-commit    Permit --commit-live when --model-id targets an existing model.
  --allow-existing-out-dir         Permit writing into a non-empty evidence directory.
  --json                           Print the runner result as JSON.

Environment:
  BIM_AI_BASE_URL, BIM_AI_PROJECT_ID, BIM_AI_MODEL_ID, BIM_AI_PARENT_REVISION,
  BIM_AI_TEMPLATE_ID, BIM_AI_USER_ID, BIM_AI_SIMPLE_HOUSE_EVIDENCE_DIR
`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.BIM_AI_BASE_URL ?? null,
    projectId: process.env.BIM_AI_PROJECT_ID ?? null,
    modelId: process.env.BIM_AI_MODEL_ID ?? null,
    parentRevision: process.env.BIM_AI_PARENT_REVISION ?? null,
    templateId: process.env.BIM_AI_TEMPLATE_ID ?? null,
    slug: null,
    userId: process.env.BIM_AI_USER_ID ?? 'm2-p-live-evidence-runner',
    outDir: path.resolve(process.env.BIM_AI_SIMPLE_HOUSE_EVIDENCE_DIR ?? DEFAULT_OUT_DIR),
    commitLive: false,
    allowExistingModelCommit: false,
    allowExistingOutDir: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--commit-live') args.commitLive = true;
    else if (arg === '--allow-existing-model-commit') args.allowExistingModelCommit = true;
    else if (arg === '--allow-existing-out-dir') args.allowExistingOutDir = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i];
    else if (arg === '--project-id' && argv[i + 1]) args.projectId = argv[++i];
    else if (arg === '--model-id' && argv[i + 1]) args.modelId = argv[++i];
    else if (arg === '--parent-revision' && argv[i + 1]) args.parentRevision = argv[++i];
    else if (arg === '--template-id' && argv[i + 1]) args.templateId = argv[++i];
    else if (arg === '--slug' && argv[i + 1]) args.slug = argv[++i];
    else if (arg === '--user-id' && argv[i + 1]) args.userId = argv[++i];
    else if (arg === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else usage();
  }
  return args;
}

function normalizeBaseUrl(rawBaseUrl) {
  if (!rawBaseUrl) {
    throw new Error(
      'Missing live backend target: pass --base-url or set BIM_AI_BASE_URL. No dry-run or commit was attempted.',
    );
  }
  let url;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error(`Invalid --base-url: ${rawBaseUrl}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('--base-url must use http or https.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('--base-url must not contain credentials, query parameters, or fragments.');
  }
  return url.href.replace(/\/$/, '');
}

async function readDirIfExists(dir) {
  try {
    return await fs.readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function prepareOutDir(outDir, allowExistingOutDir) {
  const existing = await readDirIfExists(outDir);
  if (existing && existing.length > 0 && !allowExistingOutDir) {
    throw new Error(
      `Evidence directory is not empty: ${outDir}. Pass --allow-existing-out-dir or choose a fresh --out-dir.`,
    );
  }
  await fs.mkdir(outDir, { recursive: true });
}

async function postJson(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: response.status, ok: response.ok, body: json };
  } finally {
    clearTimeout(timeout);
  }
}

function extractCreatedModel(responseBody) {
  return {
    modelId: responseBody?.id ?? responseBody?.modelId ?? responseBody?.model?.id ?? null,
    revision: responseBody?.revision ?? responseBody?.model?.revision ?? null,
    slug: responseBody?.slug ?? responseBody?.model?.slug ?? null,
  };
}

async function createDisposableModel({ baseUrl, projectId, templateId, slug }) {
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/models`;
  const body = { slug: slug ?? `simple-house-m2p-${randomUUID()}` };
  if (templateId) body.templateId = templateId;
  const response = await postJson(`${baseUrl}${endpoint}`, body);
  const created = extractCreatedModel(response.body);
  if (!response.ok || !created.modelId) {
    throw new Error(
      `Disposable model creation failed at POST ${endpoint} (HTTP ${response.status}). ` +
        'Provide --model-id for an already isolated target, or enable this backend capability.',
    );
  }
  return {
    mode: 'created-disposable-model',
    publicSurface: {
      kind: 'model-create-api',
      method: 'POST',
      endpoint,
    },
    httpStatus: response.status,
    modelId: String(created.modelId),
    revision: created.revision ?? 1,
    slug: created.slug ?? body.slug,
    templateId: templateId ?? null,
  };
}

function validateTargetConfig(args) {
  const hasModel = Boolean(args.modelId);
  const hasProject = Boolean(args.projectId);
  if (!hasModel && !hasProject) {
    throw new Error(
      'Missing live target: pass --project-id to create a disposable model or --model-id for an isolated existing model. No live request was attempted.',
    );
  }
  if (hasModel && hasProject) {
    throw new Error('Pass only one live target source: --project-id or --model-id.');
  }
  if (hasModel && args.commitLive && !args.allowExistingModelCommit) {
    throw new Error(
      '--commit-live against --model-id is refused unless --allow-existing-model-commit is set. Use --project-id for a disposable target.',
    );
  }
  if (hasModel && args.commitLive && !args.parentRevision) {
    throw new Error(
      '--commit-live against --model-id requires --parent-revision to avoid an underspecified mutation.',
    );
  }
}

async function resolveTarget(args, baseUrl) {
  const hasProject = Boolean(args.projectId);
  if (hasProject) {
    const disposable = await createDisposableModel({
      baseUrl,
      projectId: args.projectId,
      templateId: args.templateId,
      slug: args.slug,
    });
    return {
      baseUrl,
      modelId: disposable.modelId,
      parentRevision: String(disposable.revision ?? 1),
      target: disposable,
    };
  }
  return {
    baseUrl,
    modelId: args.modelId,
    parentRevision: args.parentRevision,
    target: {
      mode: 'existing-isolated-model',
      modelId: args.modelId,
      revision: args.parentRevision ?? null,
      safety: args.commitLive
        ? '--allow-existing-model-commit acknowledged by caller'
        : 'dry-run-only; no live mutation requested',
    },
  };
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function normalizeArtifacts(outDir, result, target) {
  const executionEvidence = result.executionEvidence ?? null;
  const liveDryRun =
    executionEvidence?.liveDryRun ??
    (executionEvidence?.mode === 'live-dry-run' ? executionEvidence : null);
  const liveCommit = executionEvidence?.liveCommit ?? null;
  await writeJson(path.join(outDir, 'live-dry-run-evidence.json'), liveDryRun);
  await writeJson(
    path.join(outDir, 'live-commit-evidence.json'),
    liveCommit ?? {
      mode: 'not-requested',
      ok: false,
      reason: '--commit-live was not set; no live mutation was attempted.',
    },
  );
  await writeJson(
    path.join(outDir, 'command-log-summary.json'),
    liveCommit?.postCommit?.commandLog?.summary ?? null,
  );
  await writeJson(
    path.join(outDir, 'snapshot-summary.json'),
    result.committedEvidence?.snapshotSummary?.snapshot ??
      liveCommit?.postCommit?.snapshot?.summary ??
      null,
  );
  await writeJson(path.join(outDir, 'live-runner-manifest.json'), {
    schemaVersion: 'bim-ai.simple-house-live-evidence-runner.v1',
    benchmarkId: result.benchmarkId,
    target,
    artifacts: Object.fromEntries(
      (
        await Promise.all(
          REQUIRED_ARTIFACTS.map(async (name) => {
            const artifact = await readJsonIfExists(path.join(outDir, name));
            return [name, artifact === undefined ? 'missing' : 'written'];
          }),
        )
      ).sort(([a], [b]) => a.localeCompare(b)),
    ),
    safety: {
      dryRunAlwaysRunsFirst: true,
      commitRequiresFlag: true,
      existingModelCommitRequiresAllowFlag: true,
      secretsRecorded: false,
    },
  });
}

export async function runLiveEvidence(rawArgs = []) {
  const args = parseArgs(rawArgs);
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  validateTargetConfig(args);
  await prepareOutDir(args.outDir, args.allowExistingOutDir);
  const resolved = await resolveTarget(args, baseUrl);
  const benchmarkArgs = [
    '--mode',
    'live',
    '--base-url',
    resolved.baseUrl,
    '--model-id',
    resolved.modelId,
    '--parent-revision',
    resolved.parentRevision ?? '1',
    '--user-id',
    args.userId,
    '--out-dir',
    args.outDir,
  ];
  if (args.commitLive) benchmarkArgs.push('--commit-live');
  const { result } = await runBenchmark(benchmarkArgs);
  await normalizeArtifacts(args.outDir, result, resolved.target);
  return {
    ok: result.ok,
    benchmarkId: result.benchmarkId,
    outDir: args.outDir,
    target: resolved.target,
    mode: result.executionEvidence?.mode ?? null,
    artifactNames: (await fs.readdir(args.outDir)).sort(),
    remainingExitCriteria: result.remainingExitCriteria,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runLiveEvidence(process.argv.slice(2));
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `simple-house live evidence ${result.ok ? 'OK' : 'BLOCKED'}: ${result.mode}, model ${result.target.modelId}, artifacts ${result.outDir}`,
    );
  }
  if (!result.ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
