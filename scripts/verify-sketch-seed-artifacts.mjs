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
import { pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_ROOT = path.join(REPO_ROOT, 'seed-artifacts');
const DEFAULT_CAPABILITIES = 'spec/sketch-to-bim-capability-matrix.json';
const DEFAULT_RENDERER_SUPPORT_MATRIX = 'spec/generated/renderer-support-matrix.md';
const DEFAULT_GOLDEN_MANIFEST = 'spec/sketch-to-bim-golden-seeds.json';
const ADVISOR_RULE_FILES = [
  'app/bim_ai/constructability_advisories.py',
  'app/bim_ai/constructability_report.py',
  'app/bim_ai/constraints_metadata.py',
  'app/bim_ai/domain_integrity.py',
  'app/bim_ai/room_access_integrity.py',
  'packages/web/src/advisor/advisorViolationContext.ts',
  'packages/web/src/advisor/perspectiveFilter.ts',
];

function usage() {
  console.error(`Usage:
  node scripts/verify-sketch-seed-artifacts.mjs [--root seed-artifacts] [--seed <name>]
    [--require-final-evidence] [--live] [--base-url <url>]
    [--require-phase-packets] [--require-material-check]
    [--require-methodology-gates]
    [--require-tolerance-ledger] [--require-exchange-validation]
    [--golden-manifest spec/sketch-to-bim-golden-seeds.json]
    [--no-golden-requirements]

Checks manifest/bundle consistency for seed artifacts. With
--require-final-evidence, also requires evidence/live-run-current/tool-run-summary.json
to match the current git HEAD, bundle, IR, and capability-matrix hashes.
Seed artifacts mapped by the golden manifest also require their planned
post-generation live baseline artifacts when the artifact exists.
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
    requirePhasePackets: false,
    requireMaterialCheck: false,
    requireMethodologyGates: false,
    requireToleranceLedger: false,
    requireExchangeValidation: false,
    goldenManifest: DEFAULT_GOLDEN_MANIFEST,
    goldenRequirements: true,
    baseUrl: process.env.BIM_AI_BASE_URL || 'http://127.0.0.1:8500',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--require-final-evidence') args.requireFinalEvidence = true;
    else if (arg === '--require-phase-packets') args.requirePhasePackets = true;
    else if (arg === '--require-material-check') args.requireMaterialCheck = true;
    else if (arg === '--require-methodology-gates') {
      args.requireMethodologyGates = true;
      args.requirePhasePackets = true;
      args.requireToleranceLedger = true;
      args.requireExchangeValidation = true;
    }
    else if (arg === '--require-tolerance-ledger') args.requireToleranceLedger = true;
    else if (arg === '--require-exchange-validation') args.requireExchangeValidation = true;
    else if (arg === '--no-golden-requirements') args.goldenRequirements = false;
    else if (arg === '--live') {
      args.live = true;
      args.requireFinalEvidence = true;
    } else if (arg === '--root' && argv[i + 1]) args.root = argv[++i];
    else if (arg === '--seed' && argv[i + 1]) args.seed = argv[++i];
    else if (arg === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i];
    else if (arg === '--golden-manifest' && argv[i + 1]) args.goldenManifest = argv[++i];
    else usage();
  }
  return args;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function addGoldenName(names, value) {
  if (typeof value !== 'string') return;
  const name = value.trim();
  if (name) names.add(name);
}

async function loadGoldenRequirements(args) {
  if (!args.goldenRequirements) return new Map();
  const manifestPath = path.resolve(args.goldenManifest);
  if (!(await exists(manifestPath))) return new Map();
  const manifest = await readJson(manifestPath);
  const defaults = manifest.liveGoldenDefaults ?? {};
  const requirements = new Map();
  for (const goldenCase of manifest.cases ?? []) {
    if (!goldenCase || typeof goldenCase !== 'object') continue;
    if (!goldenCase.liveGolden || typeof goldenCase.liveGolden !== 'object') continue;
    const liveGolden = { ...defaults, ...goldenCase.liveGolden };
    const acceptance = {
      ...(defaults.acceptance ?? {}),
      ...(goldenCase.liveGolden.acceptance ?? {}),
    };
    const names = new Set();
    for (const key of ['seedArtifactName', 'seedArtifact', 'artifactName', 'slug']) {
      addGoldenName(names, goldenCase[key]);
      addGoldenName(names, liveGolden[key]);
    }
    for (const key of ['seedArtifactNames', 'seedArtifacts', 'artifactNames', 'slugs']) {
      for (const name of asArray(goldenCase[key])) addGoldenName(names, name);
      for (const name of asArray(liveGolden[key])) addGoldenName(names, name);
    }
    if (!names.size) addGoldenName(names, goldenCase.id);
    const requirement = {
      caseId: goldenCase.id,
      manifest: portable(manifestPath),
      status: liveGolden.status ?? 'planned',
      requiredArtifacts: liveGolden.requiredArtifacts ?? [],
      acceptance,
    };
    for (const name of names) requirements.set(name, requirement);
  }
  return requirements;
}

async function readIfExists(file) {
  if (!(await exists(file))) return null;
  return readJson(file);
}

async function verifyRequiredJsonOk(findings, file, codePrefix, label) {
  const payload = await readIfExists(file);
  if (!payload) {
    addFinding(findings, 'error', `${codePrefix}_missing`, `Missing ${label}.`, {
      expected: portable(file),
    });
    return null;
  }
  if (payload.ok !== true) {
    addFinding(findings, 'error', `${codePrefix}_failed`, `${label} is not ok.`, {
      artifact: portable(file),
      summary: payload.summary ?? null,
    });
  }
  return payload;
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

async function digestFiles(files) {
  const h = crypto.createHash('sha256');
  for (const relPath of [...files].sort()) {
    h.update(relPath);
    h.update('\0');
    const abs = path.join(REPO_ROOT, relPath);
    h.update((await exists(abs)) ? await sha256File(abs) : 'missing');
    h.update('\0');
  }
  return h.digest('hex');
}

async function existingFiles(files) {
  const rows = [];
  for (const file of files) {
    if (await exists(path.join(REPO_ROOT, file))) rows.push(file);
  }
  return rows;
}

async function relFilesUnder(dir) {
  const rows = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) rows.push(portable(abs));
    }
  }
  if (await exists(dir)) await walk(dir);
  return rows.sort();
}

async function seedSourceFiles(artifactDir, seedName) {
  return existingFiles([
    portable(path.join(artifactDir, 'manifest.json')),
    portable(path.join(artifactDir, 'bundle.json')),
    portable(path.join(artifactDir, 'evidence', `${seedName}.recipe.json`)),
    portable(path.join(artifactDir, 'evidence', 'sketch-ir.json')),
    ...(await relFilesUnder(path.join(artifactDir, 'source'))),
  ]);
}

async function targetSpecFiles(seedName) {
  return existingFiles([
    `spec/generated/${seedName}-required-features.json`,
    `spec/target-house/${seedName}-acceptance-checklist.md`,
    `spec/target-house/${seedName}-bim-information-requirements.md`,
    `spec/target-house/${seedName}-capability-map.md`,
    `spec/target-house/${seedName}-no-seed-readiness-packet.md`,
    `spec/target-house/${seedName}-phase-plan.md`,
    `spec/target-house/${seedName}-risk-register.md`,
    `spec/target-house/${seedName}-sketch-ir.draft.json`,
    'spec/target-house/target-house-seed.md',
  ]);
}

function gitHead() {
  const proc = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

function gitChangedFilesSince(baseHead, currentHead) {
  if (!baseHead || !currentHead || baseHead === currentHead) return [];
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', baseHead, currentHead], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (ancestor.status !== 0) return null;
  const proc = spawnSync('git', ['diff', '--name-only', `${baseHead}..${currentHead}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (proc.status !== 0) return null;
  return proc.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isPostEvidenceOnlyPath(relPath, { artifactDir = '', summary = {} } = {}) {
  const normalized = relPath.split(path.sep).join('/');
  const artifactRel = artifactDir ? portable(path.resolve(artifactDir)) : '';
  const digestSourceFiles = new Set(asArray(summary.advisorRuleFiles || ADVISOR_RULE_FILES));
  const directDigestFiles = new Set(
    asArray([
      summary.capabilitiesPath || DEFAULT_CAPABILITIES,
      summary.rendererSupportMatrixPath || DEFAULT_RENDERER_SUPPORT_MATRIX,
      summary.bundlePath,
      summary.irPath,
      ...digestSourceFiles,
      ...asArray(summary.seedSourceFiles),
      ...asArray(summary.targetSpecFiles),
    ]).filter(Boolean),
  );
  if (directDigestFiles.has(normalized)) return true;
  if (artifactRel && normalized.startsWith(`${artifactRel}/evidence/`)) return true;
  if (artifactRel && normalized === `${artifactRel}/manifest.json`) return true;
  if (/^app\/tests\//.test(normalized)) return true;
  if (/^packages\/[^/]+\/.*\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return true;
  if (/^scripts\/.*\.(test|spec)\.mjs$/.test(normalized)) return true;
  return false;
}

export function gitHeadMismatchAllowance({
  recordedHead,
  currentHead,
  changedFiles,
  summary,
  artifactDir,
  contentChecksMatch,
}) {
  if (!recordedHead || !currentHead || recordedHead === currentHead) {
    return { allowed: true, reason: 'current_head' };
  }
  if (!contentChecksMatch) return { allowed: false, reason: 'content_digest_mismatch' };
  if (!Array.isArray(changedFiles)) return { allowed: false, reason: 'changed_files_unavailable' };
  const disallowed = changedFiles.filter(
    (file) => !isPostEvidenceOnlyPath(file, { artifactDir, summary }),
  );
  if (disallowed.length) {
    return { allowed: false, reason: 'post_evidence_source_changes', disallowed };
  }
  return { allowed: true, reason: 'post_evidence_digest_or_test_only_changes' };
}

function portable(absPath) {
  const rel = path.relative(REPO_ROOT, absPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
    ? rel.split(path.sep).join('/')
    : absPath;
}

function evidenceArtifactPath(evidenceDir, relPath) {
  if (typeof relPath !== 'string' || !relPath.trim()) return null;
  const normalized = path.normalize(relPath);
  if (path.isAbsolute(normalized) || normalized.startsWith('..')) return null;
  return path.join(evidenceDir, normalized);
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

function findGoldenRequirement(goldenRequirements, seedName, manifest) {
  for (const candidate of [seedName, manifest.name, manifest.slug]) {
    if (typeof candidate === 'string' && goldenRequirements.has(candidate)) {
      return goldenRequirements.get(candidate);
    }
  }
  return null;
}

async function requireGoldenArtifact(findings, evidenceDir, relPath, requirement, seen = null) {
  const artifactPath = evidenceArtifactPath(evidenceDir, relPath);
  if (!artifactPath) {
    addFinding(
      findings,
      'error',
      'live_golden_artifact_path_invalid',
      'Live golden artifact path is invalid.',
      {
        caseId: requirement.caseId,
        artifact: relPath,
      },
    );
    return null;
  }
  if (seen?.has(path.relative(evidenceDir, artifactPath))) return artifactPath;
  seen?.add(path.relative(evidenceDir, artifactPath));
  if (!(await exists(artifactPath))) {
    addFinding(
      findings,
      'error',
      'live_golden_artifact_missing',
      'Missing live golden baseline artifact.',
      {
        caseId: requirement.caseId,
        expected: portable(artifactPath),
      },
    );
    return null;
  }
  return artifactPath;
}

async function verifyGoldenRequiredJsonOk(
  findings,
  evidenceDir,
  relPath,
  codePrefix,
  label,
  requirement,
  seen,
) {
  const artifactPath = evidenceArtifactPath(evidenceDir, relPath);
  if (!artifactPath) {
    addFinding(findings, 'error', `${codePrefix}_path_invalid`, `${label} path is invalid.`, {
      caseId: requirement.caseId,
      artifact: relPath,
    });
    return;
  }
  const rel = path.relative(evidenceDir, artifactPath);
  const alreadyRequired = seen.has(rel);
  if (!alreadyRequired) {
    await requireGoldenArtifact(findings, evidenceDir, relPath, requirement, seen);
  }
  const payload = await readIfExists(artifactPath);
  if (!payload) return;
  if (payload.ok !== true) {
    addFinding(findings, 'error', `${codePrefix}_failed`, `${label} is not ok.`, {
      artifact: portable(artifactPath),
      summary: payload.summary ?? null,
    });
  }
}

const METHODOLOGY_PHASE_REQUIRED_FILES = [
  ['assumption_ledger', 'assumption-ledger.json'],
  ['source_feature_map', 'source-feature-map.json'],
  ['agent_loop_packet', 'agent-loop-packet.json'],
  ['renderer_diagnostics', 'renderer-diagnostics.json'],
  ['integrity_diagnostics', 'integrity-diagnostics.json'],
  ['export_validation', 'export-validation.json'],
  ['tolerance_ledger', 'tolerance-ledger.json'],
  ['screenshot_manifest', 'screenshot-manifest.json'],
];

function numberFrom(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function phasePacketReferencesArtifact(packet, fileName) {
  const text = JSON.stringify(packet ?? {});
  return text.includes(fileName);
}

async function verifyMethodologyPhaseGates(findings, phaseDir, entryName, packet = null) {
  const payloads = {};
  for (const [key, fileName] of METHODOLOGY_PHASE_REQUIRED_FILES) {
    const artifactPath = path.join(phaseDir, fileName);
    if (!(await exists(artifactPath))) {
      addFinding(findings, 'error', `methodology_${key}_missing`, `Missing ${entryName}/${fileName}.`, {
        expected: portable(artifactPath),
      });
      continue;
    }
    const payload = await readIfExists(artifactPath);
    payloads[key] = payload;
    if (payload?.ok === false) {
      addFinding(findings, 'error', `methodology_${key}_failed`, `${entryName}/${fileName} is not ok.`, {
        artifact: portable(artifactPath),
        summary: payload.summary ?? null,
      });
    }
    if (packet && !phasePacketReferencesArtifact(packet, fileName)) {
      addFinding(
        findings,
        'error',
        `methodology_${key}_unreferenced`,
        `${entryName}/phase-packet.json does not reference ${fileName}.`,
        {
          packet: portable(path.join(phaseDir, 'phase-packet.json')),
          artifact: portable(artifactPath),
        },
      );
    }
  }

  const assumptions = payloads.assumption_ledger;
  if (assumptions) {
    const summary = assumptions.summary ?? {};
    if (numberFrom(summary.assumptionCount) <= 0) {
      addFinding(findings, 'error', 'methodology_assumptions_empty', `${entryName} has no recorded assumptions.`);
    }
    if (numberFrom(summary.incompleteAssumptionCount) > 0) {
      addFinding(
        findings,
        'error',
        'methodology_assumptions_incomplete',
        `${entryName} has incomplete assumption rows.`,
        { summary },
      );
    }
    if (numberFrom(summary.unresolvedContestableCount) > 0) {
      addFinding(
        findings,
        'error',
        'methodology_assumptions_unresolved',
        `${entryName} has unresolved contestable assumptions.`,
        { summary },
      );
    }
  }

  const sourceMap = payloads.source_feature_map;
  if (sourceMap) {
    const summary = sourceMap.summary ?? {};
    if (numberFrom(summary.featureCount) <= 0) {
      addFinding(findings, 'error', 'methodology_source_features_empty', `${entryName} has no source-feature rows.`);
    }
    if (numberFrom(summary.incompleteFeatureCount) > 0) {
      addFinding(
        findings,
        'error',
        'methodology_source_features_incomplete',
        `${entryName} has incomplete source-feature mappings.`,
        { summary },
      );
    }
  }

  const loopPacket = payloads.agent_loop_packet;
  if (loopPacket) {
    const summary = loopPacket.summary ?? {};
    if (
      numberFrom(summary.blockingFindingCount) > 0 &&
      numberFrom(summary.untracedFindingCount) > 0
    ) {
      addFinding(
        findings,
        'error',
        'methodology_blocking_findings_untraced',
        `${entryName} has blocking findings without source-command traceability.`,
        { summary },
      );
    }
  }
}

async function verifyLiveGoldenRequirements(findings, evidenceDir, requirement, hasSummary) {
  const seen = new Set();
  for (const relPath of requirement.requiredArtifacts) {
    await requireGoldenArtifact(findings, evidenceDir, relPath, requirement, seen);
  }
  const acceptance = requirement.acceptance ?? {};
  if (acceptance.requireCurrentHead && !hasSummary) {
    addFinding(
      findings,
      'error',
      'live_golden_current_head_missing',
      'Live golden baseline lacks current-head proof.',
      {
        caseId: requirement.caseId,
        expected: portable(path.join(evidenceDir, 'tool-run-summary.json')),
      },
    );
  }
  if (acceptance.requireAdvisorBaseline) {
    await requireGoldenArtifact(findings, evidenceDir, 'advisor-warning.json', requirement, seen);
    await requireGoldenArtifact(findings, evidenceDir, 'advisor-info.json', requirement, seen);
  }
  if (acceptance.requireVisualBaseline) {
    await requireGoldenArtifact(
      findings,
      evidenceDir,
      'visual-evidence-contract.json',
      requirement,
      seen,
    );
    await requireGoldenArtifact(
      findings,
      evidenceDir,
      'screenshot-manifest.json',
      requirement,
      seen,
    );
    await requireGoldenArtifact(findings, evidenceDir, 'visual-gate.json', requirement, seen);
  }
  if (acceptance.requireExchangeValidation) {
    await verifyGoldenRequiredJsonOk(
      findings,
      evidenceDir,
      'export-validation.json',
      'live_golden_exchange_validation',
      `Live golden ${requirement.caseId} export-validation.json`,
      requirement,
      seen,
    );
  }
  if (acceptance.requireToleranceLedger) {
    await verifyGoldenRequiredJsonOk(
      findings,
      evidenceDir,
      'tolerance-ledger.json',
      'live_golden_tolerance_ledger',
      `Live golden ${requirement.caseId} tolerance-ledger.json`,
      requirement,
      seen,
    );
  }
}

async function verifyArtifact(artifactDir, args, currentHead, goldenRequirements) {
  const name = path.basename(artifactDir);
  const findings = [];
  const manifestPath = path.join(artifactDir, 'manifest.json');
  if (!(await exists(manifestPath))) {
    addFinding(findings, 'error', 'manifest_missing', 'Seed artifact has no manifest.json.');
    return { name, artifact: portable(artifactDir), ok: false, findings };
  }

  const manifest = await readJson(manifestPath);
  const goldenRequirement = findGoldenRequirement(goldenRequirements, name, manifest);
  if (manifest.schemaVersion !== 'bim-ai.seed-artifact.v1') {
    addFinding(
      findings,
      'error',
      'manifest_schema',
      'Manifest schemaVersion is not bim-ai.seed-artifact.v1.',
    );
  }
  const bundleRel = manifest.bundle || 'bundle.json';
  const bundlePath = path.join(artifactDir, bundleRel);
  if (!(await exists(bundlePath))) {
    addFinding(findings, 'error', 'bundle_missing', `Bundle is missing: ${bundleRel}`);
  } else {
    const hash = await sha256File(bundlePath);
    if (manifest.bundleSha256 && manifest.bundleSha256 !== hash) {
      addFinding(
        findings,
        'error',
        'bundle_hash_mismatch',
        'Manifest bundleSha256 does not match bundle.json.',
        {
          manifestHash: manifest.bundleSha256,
          currentHash: hash,
        },
      );
    }
    const count = await commandCount(bundlePath);
    if (Number(manifest.commandCount) !== count) {
      addFinding(
        findings,
        'error',
        'command_count_mismatch',
        'Manifest commandCount does not match bundle commands.',
        {
          manifestCount: manifest.commandCount,
          currentCount: count,
        },
      );
    }
  }

  const evidenceDir = path.join(artifactDir, 'evidence', 'live-run-current');
  const summaryPath = path.join(evidenceDir, 'tool-run-summary.json');
  const hasSummary = await exists(summaryPath);
  if (args.requireFinalEvidence && !hasSummary) {
    addFinding(
      findings,
      'error',
      'final_evidence_missing',
      'Missing final live evidence tool-run-summary.json.',
      {
        expected: portable(summaryPath),
      },
    );
  }
  if (hasSummary) {
    const summary = await readJson(summaryPath);
    const recordedSeedFiles = Array.isArray(summary.seedSourceFiles)
      ? summary.seedSourceFiles
      : await seedSourceFiles(artifactDir, name);
    const recordedTargetSpecFiles = Array.isArray(summary.targetSpecFiles)
      ? summary.targetSpecFiles
      : await targetSpecFiles(name);
    const evidenceManifest = await readIfExists(path.join(evidenceDir, 'evidence-manifest.json'));
    const snapshot = await readIfExists(path.join(evidenceDir, 'snapshot.json'));
    const currentModelRevision = evidenceManifest?.revision ?? snapshot?.revision ?? null;
    const checks = {
      gitHead: currentHead,
      modelRevision: currentModelRevision,
      bundleSha256: await sha256File(bundlePath),
      irSha256: await sha256File(path.join(artifactDir, 'evidence', 'sketch-ir.json')).catch(
        () => null,
      ),
      capabilitiesSha256: await sha256File(
        path.join(REPO_ROOT, summary.capabilitiesPath || DEFAULT_CAPABILITIES),
      ).catch(() => null),
      advisorRuleDigest: await digestFiles(summary.advisorRuleFiles || ADVISOR_RULE_FILES),
      rendererSupportMatrixSha256: await sha256File(
        path.join(
          REPO_ROOT,
          summary.rendererSupportMatrixPath || DEFAULT_RENDERER_SUPPORT_MATRIX,
        ),
      ).catch(() => null),
      seedSourceDigest: await digestFiles(recordedSeedFiles),
      targetSpecDigest: await digestFiles(recordedTargetSpecFiles),
    };
    const contentChecksMatch = Object.entries(checks)
      .filter(([key]) => key !== 'gitHead')
      .every(([key, current]) => summary[key] === current);
    for (const [key, current] of Object.entries(checks)) {
      if (key === 'gitHead' && summary[key] !== current) {
        const allowance = gitHeadMismatchAllowance({
          recordedHead: summary[key],
          currentHead: current,
          changedFiles: gitChangedFilesSince(summary[key], current),
          summary,
          artifactDir,
          contentChecksMatch,
        });
        if (allowance.allowed) continue;
      }
      if (summary[key] !== current) {
        addFinding(
          findings,
          'error',
          `${key}_stale`,
          `Final evidence ${key} does not match current input.`,
          {
            recorded: summary[key],
            current,
          },
        );
      }
    }
  }

  if (goldenRequirement) {
    await verifyLiveGoldenRequirements(findings, evidenceDir, goldenRequirement, hasSummary);
  }

  if (args.requirePhasePackets) {
    const evidenceRoot = path.join(artifactDir, 'evidence');
    const entries = await fs.readdir(evidenceRoot, { withFileTypes: true }).catch(() => []);
    const phaseDirs = entries.filter(
      (entry) => entry.isDirectory() && entry.name.startsWith('phase-'),
    );
    if (!phaseDirs.length) {
      addFinding(findings, 'error', 'phase_packets_missing', 'No evidence/phase-* packets found.');
    }
    for (const entry of phaseDirs) {
      const packetPath = path.join(evidenceRoot, entry.name, 'phase-packet.json');
      let packet = null;
      if (!(await exists(packetPath))) {
        addFinding(
          findings,
          'error',
          'phase_packet_missing',
          `Missing ${entry.name}/phase-packet.json.`,
        );
      } else {
        packet = await readJson(packetPath);
        if (!packet.ok) {
          addFinding(findings, 'error', 'phase_packet_failed', `${entry.name} is not accepted.`, {
            packet: portable(packetPath),
          });
        }
      }
      if (args.requireMethodologyGates) {
        await verifyMethodologyPhaseGates(
          findings,
          path.join(evidenceRoot, entry.name),
          entry.name,
          packet,
        );
      }
    }
  }

  if (args.requireMaterialCheck) {
    const materialPath = path.join(artifactDir, 'evidence', 'material-check.json');
    if (!(await exists(materialPath))) {
      addFinding(
        findings,
        'error',
        'material_check_missing',
        'Missing evidence/material-check.json.',
      );
    } else {
      const materialCheck = await readJson(materialPath);
      if (!materialCheck.ok) {
        addFinding(findings, 'error', 'material_check_failed', 'Material intent check failed.', {
          materialCheck: portable(materialPath),
        });
      }
    }
  }

  if (args.requireToleranceLedger) {
    const liveLedgerPath = path.join(evidenceDir, 'tolerance-ledger.json');
    await verifyRequiredJsonOk(
      findings,
      liveLedgerPath,
      'tolerance_ledger',
      'final live evidence tolerance-ledger.json',
    );
    const evidenceRoot = path.join(artifactDir, 'evidence');
    const entries = await fs.readdir(evidenceRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.filter(
      (item) => item.isDirectory() && item.name.startsWith('phase-'),
    )) {
      const phaseLedgerPath = path.join(evidenceRoot, entry.name, 'phase-tolerance-ledger.json');
      const evidenceLedgerPath = path.join(evidenceRoot, entry.name, 'tolerance-ledger.json');
      const payload =
        (await readIfExists(phaseLedgerPath)) ?? (await readIfExists(evidenceLedgerPath));
      if (!payload) {
        addFinding(
          findings,
          'error',
          'phase_tolerance_ledger_missing',
          `Missing ${entry.name} tolerance ledger.`,
          {
            expectedOneOf: [portable(phaseLedgerPath), portable(evidenceLedgerPath)],
          },
        );
      } else if (payload.ok !== true) {
        addFinding(
          findings,
          'error',
          'phase_tolerance_ledger_failed',
          `${entry.name} tolerance ledger is not ok.`,
          {
            summary: payload.summary ?? null,
          },
        );
      }
    }
  }

  if (args.requireExchangeValidation) {
    await verifyRequiredJsonOk(
      findings,
      path.join(evidenceDir, 'export-validation.json'),
      'exchange_validation',
      'final live evidence export-validation.json',
    );
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
    liveGoldenCaseId: goldenRequirement?.caseId ?? null,
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
  const goldenRequirements = await loadGoldenRequirements(args);
  const results = [];
  for (const artifact of artifacts) {
    results.push(await verifyArtifact(artifact, args, currentHead, goldenRequirements));
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

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
