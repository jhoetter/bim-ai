#!/usr/bin/env node
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import { runBenchmark } from './simple-house.mjs';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const BENCHMARK_DIR = path.join(REPO_ROOT, 'spec', 'benchmarks', 'simple-single-storey-house');
const DEFAULT_OUT_DIR = path.join(BENCHMARK_DIR, 'live-evidence');
const DEFAULT_EXPECTED = path.join(BENCHMARK_DIR, 'expected-semantics.json');
const DEFAULT_BUNDLE = path.join(BENCHMARK_DIR, 'mcp-cli-command-bundle.json');
const REQUIRED_ARTIFACTS = [
  'benchmark-result.json',
  'execution-evidence.json',
  'export-evidence.json',
  'live-dry-run-evidence.json',
  'live-commit-evidence.json',
  'visual-evidence.json',
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

function validateRequiredLiveConfig(args) {
  const missing = [];
  if (!args.baseUrl) missing.push('--base-url or BIM_AI_BASE_URL');
  if (!args.projectId && !args.modelId) {
    missing.push('one of --project-id/BIM_AI_PROJECT_ID or --model-id/BIM_AI_MODEL_ID');
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing live evidence configuration: ${missing.join('; ')}. ` +
        'No dry-run or commit was attempted and no live evidence artifacts were written.',
    );
  }
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
    projectId,
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

async function copyArtifacts(fromDir, toDir) {
  await fs.mkdir(toDir, { recursive: true });
  const names = await fs.readdir(fromDir);
  await Promise.all(
    names.map((name) => fs.copyFile(path.join(fromDir, name), path.join(toDir, name))),
  );
}

async function expectedSemantics() {
  return JSON.parse(await fs.readFile(DEFAULT_EXPECTED, 'utf8'));
}

async function benchmarkBundle() {
  return JSON.parse(await fs.readFile(DEFAULT_BUNDLE, 'utf8'));
}

function numericValue(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pathValue(value, pathParts) {
  let current = value;
  for (const part of pathParts) {
    if (!current || typeof current !== 'object') return null;
    current = current[part];
  }
  return numericValue(current);
}

function maxCount(...values) {
  const numbers = values
    .flat()
    .map((value) => numericValue(value))
    .filter((value) => value !== null);
  return numbers.length ? Math.max(...numbers) : null;
}

function countAliases(countsByKind, aliases) {
  if (!countsByKind || typeof countsByKind !== 'object') return null;
  const normalized = new Map();
  for (const [key, value] of Object.entries(countsByKind)) {
    const normalizedKey = String(key)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    normalized.set(
      normalizedKey,
      (normalized.get(normalizedKey) ?? 0) + (numericValue(value) ?? 0),
    );
  }
  let total = 0;
  let found = false;
  for (const alias of aliases) {
    const key = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.has(key)) {
      total += normalized.get(key);
      found = true;
    }
  }
  return found ? total : null;
}

function expectedIdCount(snapshotIds, expectedIds, prefixPattern) {
  const ids = new Set((snapshotIds ?? []).map(String));
  const exactMatches = (expectedIds ?? []).filter((id) => ids.has(String(id))).length;
  const prefixMatches = prefixPattern ? [...ids].filter((id) => prefixPattern.test(id)).length : 0;
  return Math.max(exactMatches, prefixMatches);
}

function summaryRoots(summaryBody) {
  const roots = [];
  const push = (value) => {
    if (value && typeof value === 'object') roots.push(value);
  };
  push(summaryBody);
  push(summaryBody?.summary);
  push(summaryBody?.semanticSummary);
  push(summaryBody?.counts);
  push(summaryBody?.elementCounts);
  return roots;
}

function rootPathMax(roots, paths) {
  return maxCount(paths.map((parts) => roots.map((root) => pathValue(root, parts))).flat());
}

function committedSemanticCounts(result) {
  const snapshot =
    result.committedEvidence?.snapshotSummary?.snapshot ??
    result.executionEvidence?.liveCommit?.postCommit?.snapshot?.summary ??
    null;
  const summary = result.committedEvidence?.snapshotSummary?.summary ?? null;
  const roots = summaryRoots(summary);
  const countsByKind = snapshot?.countsByKind ?? {};
  const ids = snapshot?.ids ?? [];
  const fixture = result.summary ?? {};
  const walls = maxCount(
    countAliases(countsByKind, ['wall', 'walls', 'basicwall', 'ifcwall', 'ifcwallstandardcase']),
    rootPathMax(roots, [['walls'], ['walls', 'total'], ['walls', 'count'], ['wallCount']]),
    expectedIdCount(ids, fixture.walls?.ids, /^ssh-wall-/),
  );
  const floors = maxCount(
    countAliases(countsByKind, ['floor', 'floors', 'slab', 'slabs', 'ifcslab']),
    rootPathMax(roots, [['floors'], ['floors', 'count'], ['floorCount']]),
    expectedIdCount(ids, fixture.floors?.ids, /^ssh-floor-/),
  );
  const roofs = maxCount(
    countAliases(countsByKind, ['roof', 'roofs', 'ifcroof']),
    rootPathMax(roots, [['roofs'], ['roofs', 'count'], ['roofCount']]),
    expectedIdCount(ids, fixture.roofs?.ids, /^ssh-roof-/),
  );
  const rooms = maxCount(
    countAliases(countsByKind, ['room', 'rooms', 'space', 'spaces', 'ifcspace']),
    rootPathMax(roots, [['rooms'], ['rooms', 'count'], ['roomCount']]),
    expectedIdCount(ids, Object.keys(fixture.rooms?.targetAreaM2 ?? {}), /^ssh-room-/),
  );
  const doors = maxCount(
    countAliases(countsByKind, ['door', 'doors', 'ifcdoor']),
    rootPathMax(roots, [['openings', 'doors'], ['doors'], ['doorCount']]),
    expectedIdCount(ids, [], /^ssh-door-/),
  );
  const windows = maxCount(
    countAliases(countsByKind, ['window', 'windows', 'ifcwindow']),
    rootPathMax(roots, [['openings', 'windows'], ['windows'], ['windowCount']]),
    expectedIdCount(ids, [], /^ssh-window-/),
  );
  const genericOpenings = maxCount(
    countAliases(countsByKind, ['opening', 'openings']),
    rootPathMax(roots, [
      ['openings'],
      ['openings', 'count'],
      ['openings', 'hosted'],
      ['openingCount'],
    ]),
  );
  return {
    sources: {
      snapshotPresent: Boolean(snapshot),
      snapshotElementCount: snapshot?.elementCount ?? null,
      snapshotRevision: snapshot?.revision ?? null,
      summaryPresent: Boolean(summary),
    },
    counts: {
      walls,
      floors,
      roofs,
      rooms,
      openings: maxCount(genericOpenings, (doors ?? 0) + (windows ?? 0)),
      doors,
      windows,
    },
  };
}

function commitRevisionChanged(revision) {
  const parent = numericValue(revision?.parentRevision);
  const candidates = [
    revision?.newRevision,
    revision?.revision,
    revision?.commandLogRevisionAfter,
    revision?.snapshotRevision,
  ].map(numericValue);
  const advanced =
    parent === null ? [] : candidates.filter((value) => value !== null && value > parent);
  return {
    parentRevision: parent,
    candidateRevisions: candidates.filter((value) => value !== null),
    pass: parent !== null && advanced.length > 0,
  };
}

function buildSemanticClosure(result, { dryRunArtifact, commitArtifact, commitRequested }) {
  const expected = result.expectedSemantics?.expected ?? null;
  const checks = [];
  const dryRunCommandCount = numericValue(dryRunArtifact?.request?.commandCount);
  const dryRunWouldRevision = dryRunArtifact?.revision?.wouldRevision ?? null;
  checks.push({
    id: 'dry-run-command-payload',
    pass: dryRunCommandCount !== null && dryRunCommandCount > 0,
    actual: dryRunCommandCount,
    expected: '> 0',
  });
  checks.push({
    id: 'dry-run-revision-intent',
    pass: true,
    actual: dryRunWouldRevision,
    expected: 'optional wouldRevision evidence; dry-run command intent is authoritative',
  });

  if (!commitRequested) {
    const pass = checks.every((check) => check.pass);
    return {
      schemaVersion: 'bim-ai.simple-house-live-evidence-semantic-closure.v1',
      status: pass ? 'dry-run-intent-clean' : 'dry-run-intent-not-clean',
      pass,
      commitRequested: false,
      checks,
      counts: null,
      expected: null,
      note: 'Dry-run-only mode has no committed snapshot; commit semantic closure requires --commit-live.',
    };
  }

  const semanticCounts = committedSemanticCounts(result);
  const revision = commitRevisionChanged(commitArtifact?.revision);
  const changedIds = Array.isArray(commitArtifact?.changedIds) ? commitArtifact.changedIds : [];
  const required = {
    walls: expected?.walls?.total ?? 6,
    floors: expected?.floors?.count ?? 1,
    roofs: expected?.roofs?.count ?? 1,
    rooms: expected?.rooms?.count ?? 3,
    openings:
      expected?.openings?.hosted ??
      (expected?.openings?.doors ?? 0) + (expected?.openings?.windows ?? 0),
  };
  checks.push(
    {
      id: 'commit-changed-ids',
      pass: changedIds.length > 0,
      actual: changedIds.length,
      expected: '> 0',
    },
    {
      id: 'commit-revision-advanced',
      pass: revision.pass,
      actual: revision.candidateRevisions,
      expected: `> parentRevision ${revision.parentRevision}`,
    },
    {
      id: 'committed-snapshot-present',
      pass:
        semanticCounts.sources.snapshotPresent &&
        numericValue(semanticCounts.sources.snapshotElementCount) !== null &&
        semanticCounts.sources.snapshotElementCount > 0,
      actual: semanticCounts.sources.snapshotElementCount,
      expected: '> 0',
    },
    ...Object.entries(required).map(([key, expectedCount]) => ({
      id: `committed-${key}-count`,
      pass:
        numericValue(semanticCounts.counts[key]) !== null &&
        semanticCounts.counts[key] >= expectedCount,
      actual: semanticCounts.counts[key],
      expected: `>= ${expectedCount}`,
    })),
  );
  const pass = checks.every((check) => check.pass);
  return {
    schemaVersion: 'bim-ai.simple-house-live-evidence-semantic-closure.v1',
    status: pass
      ? 'committed-simple-house-semantics-clean'
      : 'committed-simple-house-semantics-not-clean',
    pass,
    commitRequested: true,
    checks,
    counts: semanticCounts.counts,
    countSources: semanticCounts.sources,
    expected: required,
    changedIds,
    revision,
  };
}

function evidenceHttpOk(evidence) {
  const status = Number(evidence?.response?.httpStatus ?? evidence?.httpStatus);
  return !Number.isFinite(status) || (status >= 200 && status < 300);
}

function liveEvidenceClean(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  return (
    evidence.ok === true &&
    evidence.response?.ok !== false &&
    evidence.response?.bodyOk !== false &&
    evidence.validation?.ok !== false &&
    evidenceHttpOk(evidence)
  );
}

function advisoryClasses(body) {
  const violations = body?.violations ?? body?.detail?.violations ?? body?.result?.violations ?? [];
  return Array.isArray(violations)
    ? violations
        .map((violation) => violation?.advisoryClass)
        .filter(Boolean)
        .sort()
    : [];
}

function replayProbePass(response, { expectedRevision, expectedClientOpId, expectedDigest }) {
  const body = response?.body ?? {};
  const match = body.idempotencyMatch ?? body.response?.idempotencyMatch ?? null;
  return (
    response?.ok === true &&
    body.applied === true &&
    body.idempotentReplay === true &&
    (expectedRevision === null || body.newRevision === expectedRevision) &&
    (!expectedClientOpId || match?.clientOpId === expectedClientOpId) &&
    (!expectedDigest || match?.bundleDigestSha256 === expectedDigest)
  );
}

function buildWorkflowMetadataAssertions(commitArtifact) {
  const transactionWorkflow = commitArtifact?.response?.transactionMetadata?.workflow ?? null;
  const transactionIdempotency = commitArtifact?.response?.transactionMetadata?.idempotency ?? null;
  const workflows = {
    sketch: {
      route: '/api/v3/sketch/phase/accept',
      entryPoint: 'sketch-phase-accept',
      surface: 'api-v3',
      metadataRequired: ['route', 'entryPoint', 'surface', 'clientOpId'],
    },
    export: {
      route: '/api/models/{model_id}/exports',
      entryPoint: 'documentation-export',
      surface: 'api-v3',
      metadataRequired: ['route', 'entryPoint', 'surface', 'clientOpId'],
    },
    importLike: {
      route: '/api/models/{model_id}/bundles',
      entryPoint: 'cmd-v3-apply-bundle',
      surface: 'api-v3',
      metadataRequired: ['route', 'entryPoint', 'surface', 'bundleDigestSha256'],
    },
  };
  const assertions = [
    {
      id: 'committed-transaction-workflow-route',
      pass: transactionWorkflow?.route === '/api/models/{model_id}/bundles',
      actual: transactionWorkflow?.route ?? null,
      expected: '/api/models/{model_id}/bundles',
    },
    {
      id: 'committed-transaction-client-op-id',
      pass: Boolean(transactionIdempotency?.clientOpId),
      actual: transactionIdempotency?.clientOpId ?? null,
      expected: 'present',
    },
    {
      id: 'm3-workflow-entry-point-fixtures',
      pass: Object.values(workflows).every(
        (workflow) => workflow.route && workflow.entryPoint && workflow.surface,
      ),
      actual: Object.keys(workflows),
      expected: ['sketch', 'export', 'importLike'],
    },
  ];
  return {
    pass: assertions.every((assertion) => assertion.pass),
    m3SketchExportImportCoverage: assertions.every((assertion) => assertion.pass),
    assertions,
    transactionWorkflow,
    workflows,
  };
}

async function collectTransactionEvidence({ resolved, args, commitArtifact }) {
  if (!args.commitLive || commitArtifact?.pass !== true) {
    return {
      idempotency: { pass: false, status: 'not-requested' },
      staleRevisionProtection: { pass: false, status: 'not-requested' },
      workflowMetadata: buildWorkflowMetadataAssertions(commitArtifact),
    };
  }

  const baseUrl = resolved.baseUrl.replace(/\/$/, '');
  const endpoint = `/api/models/${encodeURIComponent(resolved.modelId)}/bundles`;
  const url = `${baseUrl}${endpoint}`;
  const bundle = await benchmarkBundle();
  const liveBundle =
    resolved.parentRevision === null || resolved.parentRevision === undefined
      ? bundle
      : { ...bundle, parentRevision: Number(resolved.parentRevision) };
  const expectedRevision =
    commitArtifact?.revision?.newRevision ?? commitArtifact?.revision?.revision ?? null;
  const expectedClientOpId =
    commitArtifact?.response?.transactionMetadata?.idempotency?.clientOpId ??
    commitArtifact?.request?.clientOpId ??
    null;
  const expectedDigest =
    commitArtifact?.response?.transactionMetadata?.idempotency?.bundleDigestSha256 ??
    commitArtifact?.request?.bundleDigest ??
    null;

  const clientOpIdReplay = await postJson(url, {
    bundle: liveBundle,
    mode: 'commit',
    userId: args.userId,
    clientOpId: expectedClientOpId,
    submitter: 'benchmark-agent',
  });
  const bundleDigestReplay = await postJson(url, {
    bundle: liveBundle,
    mode: 'commit',
    userId: args.userId,
    submitter: 'benchmark-agent',
  });
  const staleRevision = await postJson(url, {
    bundle: liveBundle,
    mode: 'commit',
    userId: `${args.userId}-stale-revision-probe`,
    submitter: 'stale-revision-probe',
  });

  const clientOpIdReplayPass = replayProbePass(clientOpIdReplay, {
    expectedRevision,
    expectedClientOpId,
    expectedDigest: null,
  });
  const bundleDigestReplayPass = replayProbePass(bundleDigestReplay, {
    expectedRevision,
    expectedClientOpId: null,
    expectedDigest,
  });
  const staleClasses = advisoryClasses(staleRevision.body);
  const stalePass = staleRevision.status === 409 && staleClasses.includes('revision_conflict');

  return {
    idempotency: {
      pass: clientOpIdReplayPass && bundleDigestReplayPass,
      status:
        clientOpIdReplayPass && bundleDigestReplayPass
          ? 'client-op-id-and-bundle-digest-replay-dedup'
          : 'idempotency-probe-failed',
      clientOpIdReplay: {
        pass: clientOpIdReplayPass,
        httpStatus: clientOpIdReplay.status,
        idempotentReplay: clientOpIdReplay.body?.idempotentReplay ?? null,
        newRevision: clientOpIdReplay.body?.newRevision ?? null,
        idempotencyMatch: clientOpIdReplay.body?.idempotencyMatch ?? null,
      },
      bundleDigestReplay: {
        pass: bundleDigestReplayPass,
        httpStatus: bundleDigestReplay.status,
        idempotentReplay: bundleDigestReplay.body?.idempotentReplay ?? null,
        newRevision: bundleDigestReplay.body?.newRevision ?? null,
        idempotencyMatch: bundleDigestReplay.body?.idempotencyMatch ?? null,
      },
    },
    staleRevisionProtection: {
      pass: stalePass,
      status: stalePass ? 'stale-parent-revision-rejected' : 'stale-parent-revision-not-rejected',
      staleParentRevisionRejected: {
        pass: stalePass,
        httpStatus: staleRevision.status,
        advisoryClasses: staleClasses,
        bodyApplied:
          staleRevision.body?.applied ?? staleRevision.body?.detail?.result?.applied ?? null,
      },
    },
    workflowMetadata: buildWorkflowMetadataAssertions(commitArtifact),
  };
}

function sourceTargetMetadata({ baseUrl, target, parentRevision, commitRequested }) {
  const url = new URL(baseUrl);
  return {
    kind: 'live-backend-target',
    targetMode: target.mode,
    modelId: target.modelId ?? null,
    projectId: target.projectId ?? null,
    slug: target.slug ?? null,
    templateId: target.templateId ?? null,
    parentRevision: parentRevision ?? target.revision ?? null,
    baseUrl: {
      origin: url.origin,
      pathname: url.pathname === '/' ? '' : url.pathname,
      credentials: false,
      query: false,
      fragment: false,
    },
    publicSurface: target.publicSurface ?? null,
    commitRequested: Boolean(commitRequested),
  };
}

function revisionEvidence(evidence, parentRevision) {
  return {
    parentRevision: evidence?.request?.parentRevision ?? parentRevision ?? null,
    wouldRevision: evidence?.response?.wouldRevision ?? null,
    revision: evidence?.response?.revision ?? null,
    newRevision: evidence?.response?.newRevision ?? null,
    checkpointSnapshotId: evidence?.response?.checkpointSnapshotId ?? null,
    commandLogRevisionAfter:
      evidence?.postCommit?.commandLog?.summary?.latest?.[0]?.revisionAfter ?? null,
    snapshotRevision: evidence?.postCommit?.snapshot?.summary?.revision ?? null,
  };
}

function classifyLiveEvidence(evidence, { kind, sourceTarget, parentRevision }) {
  const clean = liveEvidenceClean(evidence);
  const changedIds = Array.isArray(evidence?.response?.changedIds)
    ? evidence.response.changedIds.map(String).sort()
    : [];
  return {
    ...evidence,
    liveEvidence: true,
    fixtureEvidence: false,
    evidenceKind: kind,
    status: clean ? `${kind}-clean` : `${kind}-not-clean`,
    auditClassification: clean ? `${kind}-clean` : `${kind}-not-clean`,
    clean,
    pass: clean,
    sourceTarget,
    revision: revisionEvidence(evidence, parentRevision),
    changedIds,
    secrets: {
      containsSecrets: false,
      baseUrlCredentialsAccepted: false,
      requestHeadersRecorded: false,
    },
  };
}

function notRequestedCommitEvidence({ sourceTarget, parentRevision }) {
  return {
    mode: 'not-requested',
    ok: false,
    clean: false,
    pass: false,
    liveEvidence: false,
    fixtureEvidence: false,
    evidenceKind: 'live-commit',
    status: 'not-requested',
    auditClassification: 'not-requested',
    reason: '--commit-live was not set; no live mutation was attempted.',
    sourceTarget,
    revision: revisionEvidence(null, parentRevision),
    changedIds: [],
    secrets: {
      containsSecrets: false,
      baseUrlCredentialsAccepted: false,
      requestHeadersRecorded: false,
    },
  };
}

function buildExecutionEvidence(
  result,
  liveDryRun,
  liveCommit,
  sourceTarget,
  parentRevision,
  semanticClosure,
) {
  const execution = result.executionEvidence ?? {};
  if (execution?.liveDryRun || execution?.liveCommit) {
    const clean =
      liveEvidenceClean(liveDryRun) &&
      liveEvidenceClean(liveCommit) &&
      semanticClosure.pass === true;
    return {
      ...execution,
      liveDryRun,
      liveCommit,
      liveEvidence: true,
      fixtureEvidence: false,
      evidenceKind: 'live-dry-run-and-commit',
      status: clean ? 'live-dry-run-and-commit-clean' : 'live-dry-run-and-commit-not-clean',
      auditClassification: clean
        ? 'live-dry-run-and-commit-clean'
        : 'live-dry-run-and-commit-not-clean',
      clean,
      pass: clean,
      sourceTarget,
      revision: revisionEvidence(liveCommit, parentRevision),
      changedIds: Array.isArray(liveCommit?.changedIds) ? liveCommit.changedIds : [],
      semanticClosure,
      secrets: {
        containsSecrets: false,
        baseUrlCredentialsAccepted: false,
        requestHeadersRecorded: false,
      },
    };
  }
  return { ...liveDryRun, semanticClosure };
}

async function normalizeArtifacts(outDir, result, resolved, args) {
  const executionEvidence = result.executionEvidence ?? null;
  const liveDryRun =
    executionEvidence?.liveDryRun ??
    (executionEvidence?.mode === 'live-dry-run' ? executionEvidence : null);
  const liveCommit = executionEvidence?.liveCommit ?? null;
  const sourceTarget = sourceTargetMetadata({
    baseUrl: resolved.baseUrl,
    target: resolved.target,
    parentRevision: resolved.parentRevision,
    commitRequested: args.commitLive,
  });
  const dryRunArtifact = classifyLiveEvidence(liveDryRun, {
    kind: 'live-dry-run',
    sourceTarget,
    parentRevision: resolved.parentRevision,
  });
  const commitArtifact = liveCommit
    ? classifyLiveEvidence(liveCommit, {
        kind: 'live-commit',
        sourceTarget,
        parentRevision: resolved.parentRevision,
      })
    : notRequestedCommitEvidence({
        sourceTarget,
        parentRevision: resolved.parentRevision,
      });
  const semanticClosure = buildSemanticClosure(result, {
    dryRunArtifact,
    commitArtifact,
    commitRequested: args.commitLive,
  });
  dryRunArtifact.semanticClosure = semanticClosure;
  commitArtifact.semanticClosure = semanticClosure;
  if (semanticClosure.pass !== true) {
    dryRunArtifact.clean = false;
    dryRunArtifact.pass = false;
    dryRunArtifact.status = `${dryRunArtifact.evidenceKind}-not-clean`;
    dryRunArtifact.auditClassification = `${dryRunArtifact.evidenceKind}-not-clean`;
    commitArtifact.clean = false;
    commitArtifact.pass = false;
    commitArtifact.status =
      commitArtifact.mode === 'not-requested'
        ? 'not-requested'
        : `${commitArtifact.evidenceKind}-not-clean`;
    commitArtifact.auditClassification = commitArtifact.status;
  }
  const transactionEvidence = await collectTransactionEvidence({
    resolved,
    args,
    commitArtifact,
  });
  commitArtifact.idempotency = transactionEvidence.idempotency;
  commitArtifact.staleRevisionProtection = transactionEvidence.staleRevisionProtection;
  commitArtifact.workflowMetadata = transactionEvidence.workflowMetadata;
  commitArtifact.transaction = transactionEvidence;
  const executionArtifact = buildExecutionEvidence(
    result,
    dryRunArtifact,
    commitArtifact,
    sourceTarget,
    resolved.parentRevision,
    semanticClosure,
  );
  await writeJson(path.join(outDir, 'live-dry-run-evidence.json'), dryRunArtifact);
  await writeJson(path.join(outDir, 'live-commit-evidence.json'), commitArtifact);
  await writeJson(path.join(outDir, 'execution-evidence.json'), executionArtifact);
  await writeJson(path.join(outDir, 'benchmark-result.json'), {
    ...result,
    executionEvidence: executionArtifact,
  });
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
    status: executionArtifact.status,
    clean: executionArtifact.clean === true,
    pass: executionArtifact.pass === true,
    semanticClosure,
    target: sourceTarget,
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
      baseUrlCredentialsRejected: true,
    },
  });
  return { dryRunArtifact, commitArtifact, executionArtifact };
}

export async function runLiveEvidence(rawArgs = []) {
  const args = parseArgs(rawArgs);
  validateRequiredLiveConfig(args);
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  validateTargetConfig(args);
  await prepareOutDir(args.outDir, args.allowExistingOutDir);
  const resolved = await resolveTarget(args, baseUrl);
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simple-house-live-evidence-stage-'));
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
    stageDir,
  ];
  if (args.commitLive) benchmarkArgs.push('--commit-live');
  try {
    const { result } = await runBenchmark(benchmarkArgs);
    result.expectedSemantics = await expectedSemantics();
    const stagedArtifacts = await normalizeArtifacts(stageDir, result, resolved, args);
    if (stagedArtifacts.executionArtifact.semanticClosure?.pass === true) {
      await copyArtifacts(stageDir, args.outDir);
    }
    const artifactNames = (await fs.readdir(args.outDir)).sort();
    return {
      ok: stagedArtifacts.executionArtifact.pass === true,
      benchmarkId: result.benchmarkId,
      outDir: args.outDir,
      target: resolved.target,
      mode: result.executionEvidence?.mode ?? null,
      clean: stagedArtifacts.executionArtifact.clean === true,
      pass: stagedArtifacts.executionArtifact.pass === true,
      semanticClosure: stagedArtifacts.executionArtifact.semanticClosure,
      artifactNames,
      remainingExitCriteria:
        stagedArtifacts.executionArtifact.semanticClosure?.pass === true
          ? result.remainingExitCriteria
          : [
              'committed simple-house semantic counts from live snapshot/summary',
              ...result.remainingExitCriteria,
            ],
    };
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
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
