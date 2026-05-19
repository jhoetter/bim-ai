import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_SEED = 'target-house-1';
const DEFAULT_SOURCE_IR = 'target-house-1-sketch-ir.draft.json';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function sha256Json(value) {
  return sha256Text(stableJson(value));
}

export function sha256FileHex(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function portable(absPath, repoRoot) {
  const rel = path.relative(repoRoot, absPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
    ? rel.split(path.sep).join('/')
    : absPath;
}

export function readJsonFile(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readJsonIfExists(file) {
  return existsSync(file) ? readJsonFile(file) : null;
}

function bundleCommandCount(bundle) {
  if (Array.isArray(bundle)) return bundle.length;
  if (isObject(bundle) && Array.isArray(bundle.commands)) return bundle.commands.length;
  return null;
}

function sourceIrPathForSeed(sourceRoot, seed) {
  const seeded = path.join(sourceRoot, `${seed}-sketch-ir.draft.json`);
  if (existsSync(seeded)) return seeded;
  return path.join(sourceRoot, DEFAULT_SOURCE_IR);
}

export function targetHouseSeedContext({ repoRoot, seed = DEFAULT_SEED } = {}) {
  const artifactDir = path.join(repoRoot, 'seed-artifacts', seed);
  const manifestPath = path.join(artifactDir, 'manifest.json');
  const manifest = readJsonFile(manifestPath);
  const bundlePath = path.join(artifactDir, manifest.bundle ?? 'bundle.json');
  const sourceRoot = path.join(artifactDir, manifest.sourceRoot ?? 'source');
  const sourceIrPath = sourceIrPathForSeed(sourceRoot, seed);
  const requiredFeaturesPath = path.join(repoRoot, 'spec', 'generated', `${seed}-required-features.json`);
  const bundleSha256 = sha256FileHex(bundlePath);
  const sourceIrSha256 = existsSync(sourceIrPath) ? sha256FileHex(sourceIrPath) : null;
  const requiredFeaturesSha256 = existsSync(requiredFeaturesPath)
    ? sha256FileHex(requiredFeaturesPath)
    : null;
  const bundle = readJsonFile(bundlePath);
  return {
    repoRoot,
    seed,
    artifactDir,
    manifest,
    manifestPath,
    bundlePath,
    sourceRoot,
    sourceIrPath,
    requiredFeaturesPath,
    bundleSha256,
    sourceIrSha256,
    requiredFeaturesSha256,
    commandCount: bundleCommandCount(bundle),
  };
}

function snapshotElementCount(snapshot) {
  if (Array.isArray(snapshot?.elements)) return snapshot.elements.length;
  if (isObject(snapshot?.elements)) return Object.keys(snapshot.elements).length;
  return 0;
}

function metadataHead(payload) {
  if (!isObject(payload)) return {};
  return payload.currentHead ?? payload.current ?? payload.recorded ?? payload;
}

function addCheck(checks, ok, code, message, details = {}) {
  checks.push({
    ok,
    status: ok ? 'pass' : 'stale',
    code,
    message,
    ...details,
  });
}

function evaluateSnapshotCandidate({ candidate, context, repoRoot }) {
  const snapshot = readJsonIfExists(candidate.snapshotPath);
  const checks = [];
  if (!snapshot) {
    addCheck(checks, false, 'snapshot_missing', 'Snapshot candidate is missing.', {
      path: portable(candidate.snapshotPath, repoRoot),
    });
    return {
      ...candidate,
      ok: false,
      snapshot: null,
      snapshotSha256: null,
      checks,
    };
  }

  const snapshotModelId = snapshot.modelId ?? null;
  const snapshotRevision = snapshot.revision ?? snapshot.currentRevision ?? null;
  const snapshotCount = snapshotElementCount(snapshot);
  addCheck(checks, snapshotCount > 0, 'snapshot_non_empty', 'Snapshot has model elements.', {
    elementCount: snapshotCount,
  });

  for (const metadataPath of candidate.metadataPaths) {
    const payload = readJsonIfExists(metadataPath);
    if (!payload) {
      addCheck(checks, false, 'metadata_missing', 'Freshness metadata is missing.', {
        path: portable(metadataPath, repoRoot),
      });
      continue;
    }
    const head = metadataHead(payload);
    if (head.modelId != null) {
      addCheck(
        checks,
        String(head.modelId) === String(snapshotModelId),
        'snapshot_model_matches_metadata',
        'Snapshot model id matches adjacent evidence metadata.',
        {
          metadata: portable(metadataPath, repoRoot),
          recorded: head.modelId,
          snapshot: snapshotModelId,
        },
      );
    }
    const headRevision = head.modelRevision ?? head.revision ?? null;
    if (headRevision != null) {
      addCheck(
        checks,
        String(headRevision) === String(snapshotRevision),
        'snapshot_revision_matches_metadata',
        'Snapshot revision matches adjacent evidence metadata.',
        {
          metadata: portable(metadataPath, repoRoot),
          recorded: headRevision,
          snapshot: snapshotRevision,
        },
      );
    }
    if (head.bundleSha256 != null) {
      addCheck(
        checks,
        String(head.bundleSha256) === context.bundleSha256,
        'bundle_digest_current',
        'Evidence bundle digest matches the authoritative seed bundle.',
        {
          metadata: portable(metadataPath, repoRoot),
          recorded: head.bundleSha256,
          current: context.bundleSha256,
        },
      );
    }
    if (head.irSha256 != null && context.sourceIrSha256 != null) {
      addCheck(
        checks,
        String(head.irSha256) === context.sourceIrSha256,
        'source_ir_digest_current',
        'Evidence Sketch IR digest matches the authoritative seed source.',
        {
          metadata: portable(metadataPath, repoRoot),
          recorded: head.irSha256,
          current: context.sourceIrSha256,
        },
      );
    }
    if (payload.schemaVersion === 'sketch.evidence.freshness.v1') {
      addCheck(checks, payload.ok === true, 'freshness_report_ok', 'Evidence freshness report is ok.', {
        metadata: portable(metadataPath, repoRoot),
      });
      for (const key of ['recorded', 'current']) {
        if (payload[key]?.irSha256 != null && context.sourceIrSha256 != null) {
          addCheck(
            checks,
            String(payload[key].irSha256) === context.sourceIrSha256,
            `freshness_${key}_source_ir_current`,
            `Freshness ${key} Sketch IR digest matches authoritative seed source.`,
            {
              metadata: portable(metadataPath, repoRoot),
              recorded: payload[key].irSha256,
              current: context.sourceIrSha256,
            },
          );
        }
      }
    }
  }

  return {
    ...candidate,
    ok: checks.every((check) => check.ok),
    snapshot,
    snapshotSha256: sha256FileHex(candidate.snapshotPath),
    checks,
  };
}

function materializeSeedSnapshot({ context, repoRoot }) {
  const python = process.env.PYTHON ?? 'python';
  const script = `
import json
import sys
from pathlib import Path
from app.scripts.seed import _load_artifact, _materialize

artifact = _load_artifact(Path(sys.argv[1]).resolve())
_doc, wire = _materialize(artifact)
wire["modelId"] = f"{artifact.name}:materialized-bundle"
wire["sourceKind"] = "materialized_seed_bundle"
print(json.dumps(wire, sort_keys=True))
`;
  const env = {
    ...process.env,
    PYTHONPATH: ['app', process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  };
  const result = spawnSync(python, ['-c', script, context.artifactDir], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Failed to materialize ${context.seed} from authoritative seed bundle: ${result.stderr || result.stdout}`,
    );
  }
  const snapshot = JSON.parse(result.stdout);
  return {
    snapshot,
    snapshotSha256: sha256Json(snapshot),
  };
}

function staleSummary(candidates, repoRoot) {
  return candidates.map((candidate) => ({
    kind: candidate.kind,
    path: portable(candidate.snapshotPath, repoRoot),
    ok: candidate.ok,
    snapshotSha256: candidate.snapshotSha256,
    staleChecks: candidate.checks.filter((check) => !check.ok),
  }));
}

export function resolveTargetHouseSnapshotInput({
  repoRoot,
  seed = DEFAULT_SEED,
  forceMaterialized = false,
} = {}) {
  const context = targetHouseSeedContext({ repoRoot, seed });
  const liveDir = path.join(context.artifactDir, 'evidence', 'live-run-current');
  const candidates = [
    {
      kind: 'live_run_current_snapshot',
      snapshotPath: path.join(liveDir, 'snapshot.json'),
      metadataPaths: [
        path.join(liveDir, 'evidence-manifest.json'),
        path.join(liveDir, 'tool-run-summary.json'),
        path.join(liveDir, 'evidence-freshness.json'),
      ],
    },
    {
      kind: 'nested_live_snapshot',
      snapshotPath: path.join(liveDir, 'live', 'snapshot.json'),
      metadataPaths: [
        path.join(liveDir, 'live', 'evidence-manifest.json'),
        path.join(liveDir, 'tool-run-summary.json'),
        path.join(liveDir, 'evidence-freshness.json'),
      ],
    },
  ].map((candidate) => evaluateSnapshotCandidate({ candidate, context, repoRoot }));

  const freshLive = candidates.find((candidate) => candidate.ok);
  const baseSourceDigests = {
    [portable(context.bundlePath, repoRoot)]: `sha256:${context.bundleSha256}`,
    [portable(context.sourceIrPath, repoRoot)]: context.sourceIrSha256
      ? `sha256:${context.sourceIrSha256}`
      : 'missing',
    [portable(context.requiredFeaturesPath, repoRoot)]: context.requiredFeaturesSha256
      ? `sha256:${context.requiredFeaturesSha256}`
      : 'missing',
  };

  if (freshLive && !forceMaterialized) {
    return {
      context,
      snapshot: freshLive.snapshot,
      snapshotSource: {
        kind: 'fresh_live_snapshot',
        path: portable(freshLive.snapshotPath, repoRoot),
        snapshotSha256: freshLive.snapshotSha256,
        regenerated: false,
        liveEvidenceFresh: true,
        staleCandidates: staleSummary(candidates.filter((candidate) => candidate !== freshLive), repoRoot),
      },
      sourceDigests: {
        ...baseSourceDigests,
        [portable(freshLive.snapshotPath, repoRoot)]: `sha256:${freshLive.snapshotSha256}`,
      },
    };
  }

  const materialized = materializeSeedSnapshot({ context, repoRoot });
  return {
    context,
    snapshot: materialized.snapshot,
    snapshotSource: {
      kind: 'materialized_seed_bundle',
      path: null,
      snapshotSha256: materialized.snapshotSha256,
      regenerated: true,
      liveEvidenceFresh: false,
      staleCandidates: staleSummary(candidates, repoRoot),
    },
    sourceDigests: {
      ...baseSourceDigests,
      [`materialized:${seed}:bundle-snapshot`]: `sha256:${materialized.snapshotSha256}`,
    },
  };
}
