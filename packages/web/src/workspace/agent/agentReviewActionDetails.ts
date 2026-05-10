/** Labeled rows for navigating agentReviewActions_v1 targets (WP-F02). */

export type AgentReviewDetailLine = { label: string; value: string };

const KNOWN_KINDS = [
  'reviewTopic',
  'focusDeterministicEvidenceRow',
  'addressDeviation',
  'addressViolation',
  'remediateEvidenceDiffIngest',
] as const;

export type AgentReviewActionKindV1 = (typeof KNOWN_KINDS)[number];

export function isAgentReviewActionKindV1(k: string): k is AgentReviewActionKindV1 {
  return (KNOWN_KINDS as readonly string[]).includes(k);
}

function str(v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'string') return v.trim() || '—';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function appendIf(lines: AgentReviewDetailLine[], label: string, v: unknown, skipEmpty = true) {
  if (skipEmpty && (v === undefined || v === '' || v === null)) return;
  lines.push({ label, value: str(v) });
}

function linesForReviewTopic(target: Record<string, unknown>): AgentReviewDetailLine[] {
  const out: AgentReviewDetailLine[] = [];
  appendIf(out, 'Topic kind', target.topicKind);
  appendIf(out, 'BCF topic id', target.bcfTopicId);
  appendIf(out, 'Issue id', target.issueId);
  return out.length ? out : [{ label: 'target', value: str(target) }];
}

function linesForFocusDeterministicEvidenceRow(
  target: Record<string, unknown>,
): AgentReviewDetailLine[] {
  const out: AgentReviewDetailLine[] = [];
  appendIf(out, 'Row kind', target.deterministicRowKind);
  appendIf(out, 'Sheet id', target.sheetId);
  appendIf(out, 'Viewpoint id', target.viewpointId);
  appendIf(out, 'Plan view id', target.planViewId);
  appendIf(out, 'Section cut id', target.sectionCutId);
  appendIf(out, 'PNG basename', target.pngBasename);
  appendIf(out, 'PNG viewport hint', target.pngViewport);
  appendIf(out, 'PNG full sheet hint', target.pngFullSheet);
  appendIf(out, 'Plan canvas PNG hint', target.pngPlanCanvas);
  appendIf(out, 'Section viewport PNG hint', target.pngSectionViewport);
  return out.filter((line) => line.value !== '—');
}

function linesForAddressDeviation(target: Record<string, unknown>): AgentReviewDetailLine[] {
  const out: AgentReviewDetailLine[] = [];
  appendIf(out, 'Deviation id', target.agentDeviationId);
  appendIf(out, 'Severity', target.severity);
  appendIf(out, 'Related assumption', target.relatedAssumptionId);
  const eids = target.relatedElementIds;
  if (Array.isArray(eids) && eids.length) {
    out.push({ label: 'Related element ids', value: eids.map((x) => str(x)).join(', ') });
  }
  return out.length ? out : [{ label: 'target', value: str(target) }];
}

function linesForAddressViolation(target: Record<string, unknown>): AgentReviewDetailLine[] {
  const out: AgentReviewDetailLine[] = [];
  appendIf(out, 'Rule id', target.ruleId);
  appendIf(out, 'Severity', target.severity);
  appendIf(out, 'Blocking', target.blocking);
  const eids = target.elementIds;
  if (Array.isArray(eids) && eids.length) {
    out.push({ label: 'Element ids', value: eids.map((x) => str(x)).join(', ') });
  }
  appendIf(out, 'Message', target.message);
  return out.length ? out : [{ label: 'target', value: str(target) }];
}

function linesForRemediateEvidenceDiffIngest(
  target: Record<string, unknown>,
): AgentReviewDetailLine[] {
  const out: AgentReviewDetailLine[] = [];
  appendIf(out, 'Needs fix loop', target.needsFixLoop);
  const blockers = target.blockerCodes;
  if (Array.isArray(blockers) && blockers.length) {
    out.push({ label: 'Blocker codes', value: blockers.map((x) => str(x)).join(', ') });
  }
  appendIf(out, 'Closure review field', target.evidenceClosureReviewField);
  appendIf(out, 'Diff ingest fix-loop field', target.evidenceDiffIngestFixLoopField);
  appendIf(
    out,
    'Artifact ingest manifest digest (manifest)',
    target.artifactIngestManifestDigestSha256,
  );
  appendIf(out, 'Artifact ingest correlation field', target.artifactIngestCorrelationField);
  appendIf(out, 'Expected ingest digest', target.ingestManifestDigestExpectedSha256);
  appendIf(out, 'Actual ingest digest', target.ingestManifestDigestActualSha256);
  appendIf(out, 'Pixel diff ingest checklist field', target.pixelDiffIngestChecklistField);
  appendIf(out, 'Screenshots root hint', target.playwrightEvidenceScreenshotsRootHint);
  return out.length ? out : [{ label: 'target', value: str(target) }];
}

function formatGenericTarget(target: Record<string, unknown>): AgentReviewDetailLine[] {
  const keys = Object.keys(target).sort();
  const cap = 18;
  const lines: AgentReviewDetailLine[] = [];
  for (const k of keys.slice(0, cap)) {
    lines.push({ label: k, value: str(target[k]) });
  }
  if (keys.length > cap) {
    lines.push({ label: '…', value: `${keys.length - cap} more keys` });
  }
  return lines;
}

export function formatAgentReviewActionDetails(
  kind: string,
  target: Record<string, unknown>,
): AgentReviewDetailLine[] {
  if (!isAgentReviewActionKindV1(kind)) {
    return [{ label: 'kind', value: kind }, ...formatGenericTarget(target)];
  }

  switch (kind) {
    case 'reviewTopic':
      return linesForReviewTopic(target);
    case 'focusDeterministicEvidenceRow':
      return linesForFocusDeterministicEvidenceRow(target);
    case 'addressDeviation':
      return linesForAddressDeviation(target);
    case 'addressViolation':
      return linesForAddressViolation(target);
    case 'remediateEvidenceDiffIngest':
      return linesForRemediateEvidenceDiffIngest(target);
    default: {
      const _exhaustive: never = kind;
      return [{ label: 'unreachable', value: str(_exhaustive) }];
    }
  }
}
