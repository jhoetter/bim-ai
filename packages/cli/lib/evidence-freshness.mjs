import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import { base, fetchJson } from './api-client.mjs';
import { ADVISOR_RULE_FILES } from './advisor-summary.mjs';

export async function fileSha256(filePath) {
  if (!filePath) return null;
  try {
    const data = await fs.readFile(filePath);
    return createHash('sha256').update(data).digest('hex');
  } catch {
    return null;
  }
}

export async function digestFiles(paths) {
  const h = createHash('sha256');
  for (const relPath of [...paths].sort()) {
    h.update(relPath);
    h.update('\0');
    const digest = await fileSha256(path.resolve(process.cwd(), relPath));
    h.update(digest ?? 'missing');
    h.update('\0');
  }
  return h.digest('hex');
}

export function currentGitHead() {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export function relativeToCwd(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  const rel = path.relative(process.cwd(), resolved);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : resolved;
}

export async function currentEvidenceInputs({
  modelId = null,
  modelRevision = null,
  irPath = null,
  capabilityMatrixPath = null,
  fetchModelRevision = false,
} = {}) {
  let resolvedModelRevision = modelRevision ?? null;
  if (resolvedModelRevision == null && fetchModelRevision && modelId) {
    try {
      const snap = await fetchJson(
        'GET',
        `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`,
      );
      resolvedModelRevision = snap?.revision ?? null;
    } catch {
      resolvedModelRevision = null;
    }
  }
  return {
    gitHead: currentGitHead(),
    modelId,
    modelRevision: resolvedModelRevision,
    advisorRuleDigest: await digestFiles(ADVISOR_RULE_FILES),
    advisorRuleFiles: ADVISOR_RULE_FILES,
    irPath: relativeToCwd(irPath),
    irSha256: await fileSha256(irPath),
    capabilitiesPath: relativeToCwd(capabilityMatrixPath),
    capabilitiesSha256: await fileSha256(capabilityMatrixPath),
  };
}

export function normalizeEvidenceMetadata(payload) {
  const currentHead =
    payload?.currentHead && typeof payload.currentHead === 'object' ? payload.currentHead : {};
  const inputs =
    payload?.evidenceInputs && typeof payload.evidenceInputs === 'object'
      ? payload.evidenceInputs
      : {};
  return {
    gitHead: payload?.gitHead ?? currentHead.gitHead ?? inputs.gitHead ?? null,
    modelId: payload?.modelId ?? currentHead.modelId ?? inputs.modelId ?? null,
    modelRevision:
      payload?.modelRevision ??
      payload?.revision ??
      currentHead.modelRevision ??
      inputs.modelRevision ??
      null,
    advisorRuleDigest:
      payload?.advisorRuleDigest ??
      currentHead.advisorRuleDigest ??
      inputs.advisorRuleDigest ??
      null,
    advisorRuleFiles:
      payload?.advisorRuleFiles ?? currentHead.advisorRuleFiles ?? inputs.advisorRuleFiles ?? null,
    irPath: payload?.irPath ?? currentHead.irPath ?? inputs.irPath ?? null,
    irSha256: payload?.irSha256 ?? currentHead.irSha256 ?? inputs.irSha256 ?? null,
    capabilitiesPath:
      payload?.capabilitiesPath ?? currentHead.capabilitiesPath ?? inputs.capabilitiesPath ?? null,
    capabilitiesSha256:
      payload?.capabilitiesSha256 ??
      currentHead.capabilitiesSha256 ??
      inputs.capabilitiesSha256 ??
      null,
  };
}

export function evidenceFreshnessReport({ recorded, current, sourcePath = null } = {}) {
  const fields = [
    {
      id: 'git_head',
      key: 'gitHead',
      missingRecordedCode: 'missing_git_head',
      missingCurrentCode: 'missing_current_git_head',
      staleCode: 'stale_git_head',
      label: 'git head',
    },
    {
      id: 'model_revision',
      key: 'modelRevision',
      missingRecordedCode: 'missing_model_revision',
      missingCurrentCode: 'missing_current_model_revision',
      staleCode: 'stale_model_revision',
      label: 'model revision',
    },
    {
      id: 'advisor_rule_digest',
      key: 'advisorRuleDigest',
      missingRecordedCode: 'missing_advisor_rule_digest',
      missingCurrentCode: 'missing_current_advisor_rule_digest',
      staleCode: 'stale_advisor_rule_digest',
      label: 'Advisor rule digest',
    },
    {
      id: 'ir_sha256',
      key: 'irSha256',
      missingRecordedCode: 'missing_ir_sha256',
      missingCurrentCode: 'missing_current_ir_sha256',
      staleCode: 'stale_ir_sha256',
      label: 'Sketch IR hash',
    },
    {
      id: 'capabilities_sha256',
      key: 'capabilitiesSha256',
      missingRecordedCode: 'missing_capabilities_sha256',
      missingCurrentCode: 'missing_current_capabilities_sha256',
      staleCode: 'stale_capabilities_sha256',
      label: 'capability matrix hash',
    },
  ];
  const checks = fields.map((field) => {
    const recordedValue = recorded?.[field.key] ?? null;
    const currentValue = current?.[field.key] ?? null;
    if (recordedValue == null || recordedValue === '') {
      return {
        id: field.id,
        status: 'missing_recorded',
        code: field.missingRecordedCode,
        message: `Evidence does not record ${field.label}.`,
        recorded: recordedValue,
        current: currentValue,
      };
    }
    if (currentValue == null || currentValue === '') {
      return {
        id: field.id,
        status: 'missing_current',
        code: field.missingCurrentCode,
        message: `Current ${field.label} could not be resolved for stale-evidence validation.`,
        recorded: recordedValue,
        current: currentValue,
      };
    }
    if (String(recordedValue) !== String(currentValue)) {
      return {
        id: field.id,
        status: 'stale',
        code: field.staleCode,
        message: `Evidence ${field.label} is stale: recorded ${recordedValue}, current ${currentValue}.`,
        recorded: recordedValue,
        current: currentValue,
      };
    }
    return {
      id: field.id,
      status: 'pass',
      code: `${field.id}_current`,
      message: `Evidence ${field.label} matches current inputs.`,
      recorded: recordedValue,
      current: currentValue,
    };
  });
  const blockers = checks
    .filter((check) => check.status !== 'pass')
    .map((check) => ({
      code: check.code,
      severity: 'error',
      message: check.message,
      recorded: check.recorded,
      current: check.current,
      sourcePath,
    }));
  return {
    schemaVersion: 'sketch.evidence.freshness.v1',
    generatedAt: new Date().toISOString(),
    ok: blockers.length === 0,
    sourcePath,
    recorded,
    current,
    summary: {
      passCount: checks.filter((check) => check.status === 'pass').length,
      staleCount: checks.filter((check) => check.status === 'stale').length,
      missingCount: checks.filter((check) => check.status.startsWith('missing')).length,
      blockerCount: blockers.length,
    },
    checks,
    blockers,
  };
}

export async function writeToolRunSummary({
  outDir,
  seed = null,
  modelId,
  modelRevision,
  irPath,
  capabilityMatrixPath,
  bundlePath = null,
  mode = null,
} = {}) {
  const current = await currentEvidenceInputs({
    modelId,
    modelRevision,
    irPath,
    capabilityMatrixPath,
  });
  const summary = {
    schemaVersion: 'sketch-to-bim.tool-run.v1',
    generatedAt: new Date().toISOString(),
    seed,
    modelId,
    modelRevision: current.modelRevision,
    gitHead: current.gitHead,
    bundlePath: relativeToCwd(bundlePath),
    bundleSha256: await fileSha256(bundlePath),
    irPath: current.irPath,
    irSha256: current.irSha256,
    capabilitiesPath: current.capabilitiesPath,
    capabilitiesSha256: current.capabilitiesSha256,
    advisorRuleDigest: current.advisorRuleDigest,
    advisorRuleFiles: current.advisorRuleFiles,
    mode,
  };
  const summaryPath = path.join(outDir, 'tool-run-summary.json');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return { summary, summaryPath };
}

export async function readEvidenceMetadataFromDir(evidenceDir) {
  if (!evidenceDir) return null;
  const candidates = [
    path.join(evidenceDir, 'tool-run-summary.json'),
    path.join(evidenceDir, 'evidence-manifest.json'),
    path.join(evidenceDir, 'live', 'evidence-manifest.json'),
  ];
  for (const candidate of candidates) {
    try {
      const payload = JSON.parse(await fs.readFile(candidate, 'utf8'));
      return {
        sourcePath: candidate,
        payload,
        recorded: normalizeEvidenceMetadata(payload),
      };
    } catch {
      // Try the next product-owned evidence metadata file.
    }
  }
  return null;
}

export async function evidenceFreshnessFromDir({
  evidenceDir,
  modelId,
  irPath,
  capabilityMatrixPath,
} = {}) {
  const metadata = await readEvidenceMetadataFromDir(evidenceDir);
  const current = await currentEvidenceInputs({
    modelId: modelId ?? metadata?.recorded?.modelId ?? null,
    irPath,
    capabilityMatrixPath,
    fetchModelRevision: true,
  });
  if (!metadata) {
    return {
      schemaVersion: 'sketch.evidence.freshness.v1',
      generatedAt: new Date().toISOString(),
      ok: false,
      sourcePath: null,
      recorded: null,
      current,
      summary: { passCount: 0, staleCount: 0, missingCount: 1, blockerCount: 1 },
      checks: [],
      blockers: [
        {
          code: 'evidence_freshness_metadata_missing',
          severity: 'error',
          message:
            'Evidence directory is missing tool-run-summary.json or evidence-manifest.json, so current-head evidence cannot be proven.',
          sourcePath: evidenceDir,
        },
      ],
    };
  }
  return evidenceFreshnessReport({
    recorded: metadata.recorded,
    current,
    sourcePath: metadata.sourcePath,
  });
}
