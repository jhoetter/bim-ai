#!/usr/bin/env node
import fs from 'node:fs/promises';
import { openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import { runLiveEvidence } from './simple-house-live-evidence.mjs';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const BENCHMARK_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'simple-single-storey-house');
const DEFAULT_STATE_DIR = path.join(BENCHMARK_DIR, '.local-live-target');
const DEFAULT_BASE_URL = 'http://127.0.0.1:8500';
const REQUIRED_OPENAPI_PATHS = [
  '/api/projects/{project_id}/models',
  '/api/models/{model_id}/bundles',
  '/api/models/{model_id}/validate',
  '/api/models/{model_id}/qa/advisor',
  '/api/models/{model_id}/evidence-package',
  '/api/models/{model_id}/exports/gltf-manifest',
  '/api/models/{model_id}/exports/ifc-manifest',
  '/api/models/{model_id}/exports/sheet-print-raster.png',
];

function usage() {
  console.error(`Usage:
  node scripts/benchmarks/simple-house-local-live-target.mjs [options]

Prepares a local disposable project target for scripts/benchmarks/simple-house-live-evidence.mjs.

Options:
  --base-url <url>              Backend URL. Defaults to ${DEFAULT_BASE_URL}.
  --no-start                    Target an already-running backend; do not start Docker or uvicorn.
  --preflight-only              Check local tooling and backend API surface without DB/project mutation.
  --run-evidence                Run simple-house-live-evidence.mjs after preparing the project.
  --commit-live                 Pass --commit-live to the evidence runner. Requires --run-evidence.
  --project-id <uuid>           Disposable project id to seed. Defaults to a fresh UUID.
  --project-slug <slug>         Disposable project slug. Defaults to m2-wave5-<uuid-prefix>.
  --project-title <title>       Disposable project title.
  --model-slug <slug>           Optional model slug passed to the evidence runner.
  --out-dir <path>              Evidence directory when --run-evidence is set.
  --allow-existing-out-dir      Pass through to the evidence runner.
  --timeout-ms <ms>             Backend health timeout. Defaults to 45000.
  --state-dir <path>            PID/log directory. Defaults to benchmark .local-live-target.
  --json                        Print JSON.

The default command starts local Postgres if needed, starts uvicorn if the
backend is not already healthy, seeds a disposable project row, and prints:
  BIM_AI_BASE_URL
  BIM_AI_PROJECT_ID
`);
  process.exit(2);
}

export function normalizeBaseUrl(rawBaseUrl) {
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

export function parseArgs(argv, env = process.env) {
  const projectId = env.BIM_AI_LOCAL_PROJECT_ID ?? randomUUID();
  const args = {
    baseUrl: normalizeBaseUrl(env.BIM_AI_BASE_URL ?? DEFAULT_BASE_URL),
    start: true,
    preflightOnly: false,
    runEvidence: false,
    commitLive: false,
    allowExistingOutDir: false,
    projectId,
    projectSlug: env.BIM_AI_LOCAL_PROJECT_SLUG ?? `m2-wave5-${projectId.slice(0, 8)}`,
    projectTitle: env.BIM_AI_LOCAL_PROJECT_TITLE ?? 'M2 Wave 5 disposable local evidence project',
    modelSlug: env.BIM_AI_LOCAL_MODEL_SLUG ?? null,
    outDir: env.BIM_AI_SIMPLE_HOUSE_EVIDENCE_DIR
      ? path.resolve(env.BIM_AI_SIMPLE_HOUSE_EVIDENCE_DIR)
      : null,
    timeoutMs: Number(env.BIM_AI_LOCAL_TARGET_TIMEOUT_MS ?? 45_000),
    stateDir: path.resolve(env.BIM_AI_LOCAL_TARGET_STATE_DIR ?? DEFAULT_STATE_DIR),
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-start') args.start = false;
    else if (arg === '--preflight-only') args.preflightOnly = true;
    else if (arg === '--run-evidence') args.runEvidence = true;
    else if (arg === '--commit-live') args.commitLive = true;
    else if (arg === '--allow-existing-out-dir') args.allowExistingOutDir = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--base-url' && argv[i + 1]) args.baseUrl = normalizeBaseUrl(argv[++i]);
    else if (arg === '--project-id' && argv[i + 1]) args.projectId = argv[++i];
    else if (arg === '--project-slug' && argv[i + 1]) args.projectSlug = argv[++i];
    else if (arg === '--project-title' && argv[i + 1]) args.projectTitle = argv[++i];
    else if (arg === '--model-slug' && argv[i + 1]) args.modelSlug = argv[++i];
    else if (arg === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else if (arg === '--timeout-ms' && argv[i + 1]) args.timeoutMs = Number(argv[++i]);
    else if (arg === '--state-dir' && argv[i + 1]) args.stateDir = path.resolve(argv[++i]);
    else usage();
  }

  if (args.commitLive && !args.runEvidence) {
    throw new Error('--commit-live requires --run-evidence.');
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number.');
  }
  return args;
}

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd ?? REPO_ROOT,
      env: options.env ?? process.env,
      shell: false,
    });
    const stdout = [];
    const stderr = [];
    child.stdout?.on('data', (chunk) => stdout.push(chunk));
    child.stderr?.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      resolve({ ok: false, status: null, stdout: '', stderr: error.message });
    });
    child.on('close', (status) => {
      resolve({
        ok: status === 0,
        status,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

async function assertCommandAvailable(command, hint) {
  const result = await runCommand(command, ['--version']);
  if (!result.ok) {
    throw new Error(`Missing local dependency '${command}'. ${hint}`);
  }
}

async function assertLocalToolingAvailable({ start }) {
  await assertCommandAvailable(
    'uv',
    'Install uv or pass --no-start against an already-running backend.',
  );
  if (start) {
    await assertCommandAvailable(
      'docker',
      'Docker is required to start the local Postgres service; pass --no-start to target an existing backend.',
    );
  }
}

async function fetchJson(url, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function isHealthy(baseUrl, options = {}) {
  try {
    const response = await fetchJson(`${baseUrl}/api/health`, options);
    return response.ok && response.body?.status === 'ok';
  } catch {
    return false;
  }
}

async function waitForHealthy(baseUrl, { timeoutMs, fetchImpl = fetch }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isHealthy(baseUrl, { fetchImpl, timeoutMs: 2_000 })) return true;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
}

export function findMissingOpenApiPaths(openapi, requiredPaths = REQUIRED_OPENAPI_PATHS) {
  const paths = openapi?.paths && typeof openapi.paths === 'object' ? openapi.paths : {};
  return requiredPaths.filter((requiredPath) => !Object.hasOwn(paths, requiredPath));
}

export async function preflightBackendCapabilities(baseUrl, { fetchImpl = fetch } = {}) {
  const health = await fetchJson(`${baseUrl}/api/health`, { fetchImpl, timeoutMs: 5_000 });
  if (!health.ok || health.body?.status !== 'ok') {
    throw new Error(
      `Local backend is not healthy at ${baseUrl}/api/health (HTTP ${health.status}). No project or benchmark mutation was attempted.`,
    );
  }

  const openapi = await fetchJson(`${baseUrl}/openapi.json`, { fetchImpl, timeoutMs: 10_000 });
  if (!openapi.ok) {
    throw new Error(
      `Local backend did not expose /openapi.json (HTTP ${openapi.status}). Cannot verify live evidence API surface before mutation.`,
    );
  }

  const missing = findMissingOpenApiPaths(openapi.body);
  if (missing.length > 0) {
    throw new Error(
      `Local backend is missing required live evidence API capabilities: ${missing.join(', ')}. No project or benchmark mutation was attempted.`,
    );
  }

  return {
    ok: true,
    requiredPaths: REQUIRED_OPENAPI_PATHS,
  };
}

async function startLocalBackend(args) {
  if (await isHealthy(args.baseUrl)) {
    return { started: false, reason: 'backend-already-healthy' };
  }

  await fs.mkdir(args.stateDir, { recursive: true });
  const compose = await runCommand('docker', [
    'compose',
    '-f',
    path.join(REPO_ROOT, 'infra', 'docker-compose.yml'),
    'up',
    '-d',
    'postgres',
  ]);
  if (!compose.ok) {
    throw new Error(
      `Failed to start local Postgres with docker compose. No project or benchmark mutation was attempted.\n${compose.stderr.trim()}`,
    );
  }

  const url = new URL(args.baseUrl);
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const logPath = path.join(args.stateDir, 'uvicorn.log');
  const logFd = openSync(logPath, 'a');
  const child = spawn(
    'uv',
    ['run', 'uvicorn', 'bim_ai.main:app', '--host', url.hostname, '--port', port],
    {
      cwd: path.join(REPO_ROOT, 'app'),
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: process.env,
    },
  );
  child.unref();
  await fs.writeFile(path.join(args.stateDir, 'uvicorn.pid'), `${child.pid}\n`, 'utf8');

  const healthy = await waitForHealthy(args.baseUrl, { timeoutMs: args.timeoutMs });
  if (!healthy) {
    throw new Error(
      `Local backend did not become healthy at ${args.baseUrl} within ${args.timeoutMs}ms. ` +
        `No project or benchmark mutation was attempted. Uvicorn log: ${logPath}`,
    );
  }
  return { started: true, logPath, pid: child.pid };
}

const SEED_PROJECT_PY = String.raw`
import asyncio
import json
import sys
import uuid

from sqlalchemy.exc import IntegrityError

from bim_ai.db import SessionMaker, init_db_schema
from bim_ai.tables import ProjectRecord


async def main() -> int:
    project_id_raw, slug, title = sys.argv[1:4]
    project_id = uuid.UUID(project_id_raw)
    await init_db_schema()
    async with SessionMaker() as session:
        existing = await session.get(ProjectRecord, project_id)
        created = False
        if existing is None:
            session.add(ProjectRecord(id=project_id, slug=slug, title=title))
            try:
                await session.commit()
                created = True
            except IntegrityError as exc:
                await session.rollback()
                print(json.dumps({"ok": False, "error": str(exc)}))
                return 3
        print(json.dumps({
            "ok": True,
            "projectId": str(project_id),
            "slug": slug,
            "title": title,
            "created": created,
        }))
    return 0


raise SystemExit(asyncio.run(main()))
`;

async function seedDisposableProject(args) {
  const result = await runCommand(
    'uv',
    ['run', 'python', '-c', SEED_PROJECT_PY, args.projectId, args.projectSlug, args.projectTitle],
    { cwd: path.join(REPO_ROOT, 'app') },
  );
  let body = null;
  try {
    body = result.stdout.trim() ? JSON.parse(result.stdout.trim().split('\n').at(-1)) : null;
  } catch {
    body = null;
  }
  if (!result.ok || body?.ok !== true) {
    throw new Error(
      'Unable to seed a disposable local project in Postgres. Missing capability: the backend can create models only under an existing project, and this repo has no public no-secret project-create endpoint. ' +
        `No benchmark mutation was attempted. Details: ${(body?.error || result.stderr || result.stdout).trim()}`,
    );
  }
  return body;
}

export function renderEnv(result) {
  return {
    BIM_AI_BASE_URL: result.baseUrl,
    BIM_AI_PROJECT_ID: result.project.projectId,
  };
}

function evidenceCommand(result) {
  return [
    'node',
    'scripts/benchmarks/simple-house-live-evidence.mjs',
    '--base-url',
    result.baseUrl,
    '--project-id',
    result.project.projectId,
  ];
}

async function runEvidenceRunner(args, project) {
  const runnerArgs = [
    '--base-url',
    args.baseUrl,
    '--project-id',
    project.projectId,
    '--user-id',
    'm2-u-local-live-target',
  ];
  if (args.modelSlug) runnerArgs.push('--slug', args.modelSlug);
  if (args.outDir) runnerArgs.push('--out-dir', args.outDir);
  if (args.allowExistingOutDir) runnerArgs.push('--allow-existing-out-dir');
  if (args.commitLive) runnerArgs.push('--commit-live');
  return runLiveEvidence(runnerArgs);
}

export async function runLocalLiveTarget(rawArgs = []) {
  const args = parseArgs(rawArgs);
  await assertLocalToolingAvailable(args);
  const startResult = args.start
    ? await startLocalBackend(args)
    : { started: false, reason: '--no-start' };
  const preflight = await preflightBackendCapabilities(args.baseUrl);

  if (args.preflightOnly) {
    return {
      ok: true,
      mode: 'preflight-only',
      baseUrl: args.baseUrl,
      start: startResult,
      preflight,
      mutationAttempted: false,
    };
  }

  const project = await seedDisposableProject(args);
  const prepared = {
    ok: true,
    mode: args.runEvidence ? 'ran-live-evidence' : 'prepared-disposable-project',
    baseUrl: args.baseUrl,
    start: startResult,
    preflight,
    project,
    env: null,
    command: null,
    evidence: null,
  };
  prepared.env = renderEnv(prepared);
  prepared.command = evidenceCommand(prepared);

  if (args.runEvidence) {
    prepared.evidence = await runEvidenceRunner(args, project);
    prepared.ok = prepared.evidence.ok;
  }

  return prepared;
}

function printShellExports(env) {
  for (const [key, value] of Object.entries(env)) {
    console.log(`export ${key}=${value}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runLocalLiveTarget(process.argv.slice(2));
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
    return;
  }

  if (result.mode === 'preflight-only') {
    console.log(`Local live target preflight OK at ${result.baseUrl}. No mutation attempted.`);
    return;
  }

  console.log(`Local disposable live target ready at ${result.baseUrl}.`);
  printShellExports(result.env);
  console.log(result.command.join(' '));
  if (result.evidence) {
    console.log(
      `simple-house live evidence ${result.evidence.ok ? 'OK' : 'BLOCKED'}: ${result.evidence.outDir}`,
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
