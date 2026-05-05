/**
 * Readout helpers for evidenceAgentFollowThrough_v1.bcfIssuePackageExport_v1.
 */

const ACTIONABLE_EACH = 5;

export type BcfIssuePackageCountsWire = {
  topicRowCount?: number;
  resolvedAnchorCount?: number;
  unresolvedAnchorCount?: number;
  staleAnchorCount?: number;
  missingCorrelationAnchorCount?: number;
  evidenceArtifactRefCount?: number;
  remediationHintLinkCount?: number;
};

export type BcfIssueAnchorSummaryRowWire = {
  stableTopicId?: string;
  topicKind?: string;
  topicId?: string;
  anchorKind?: string;
  resolutionState?: string;
  correlationRowKind?: string | null;
  correlationRowId?: string | null;
};

export type BcfIssueRemediationHintWire = {
  path?: string;
  hint?: string;
};

export type BcfIssueTopicRowWire = {
  stableTopicId?: string;
  topicKind?: string;
  topicId?: string;
  violationRuleIds?: string[];
  anchors?: unknown[];
};

export type BcfIssuePackageExportWire = {
  format?: string;
  packageManifestDigestSha256?: string;
  counts?: BcfIssuePackageCountsWire;
  topics?: BcfIssueTopicRowWire[];
  unresolvedAnchorRows?: BcfIssueAnchorSummaryRowWire[];
  unresolvedAnchorRowsTruncated?: boolean;
  staleAnchorRows?: BcfIssueAnchorSummaryRowWire[];
  staleAnchorRowsTruncated?: boolean;
  missingCorrelationAnchorRows?: BcfIssueAnchorSummaryRowWire[];
  missingCorrelationAnchorRowsTruncated?: boolean;
  evidenceArtifactRefs?: string[];
  remediationHintRefs?: BcfIssueRemediationHintWire[];
  fixLoopBlockerCodesEcho?: string[];
};

function numDash(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '—';
}

function formatAnchorBrief(r: BcfIssueAnchorSummaryRowWire): string {
  const tk = typeof r.topicKind === 'string' ? r.topicKind : '—';
  const tid = typeof r.topicId === 'string' ? r.topicId : '—';
  const ak = typeof r.anchorKind === 'string' ? r.anchorKind : '—';
  const st = typeof r.resolutionState === 'string' ? r.resolutionState : '—';
  const kk = typeof r.correlationRowKind === 'string' ? r.correlationRowKind : '';
  const cid = typeof r.correlationRowId === 'string' ? r.correlationRowId : '';
  const corr = kk || cid ? ` · ${kk || '?'}:${cid || '?'}` : '';
  return `${tk}:${tid} · ${ak} · ${st}${corr}`;
}

/** Deterministic bullets for Agent Review panel. */
export function summarizeBcfIssuePackageExport(raw: BcfIssuePackageExportWire | null | undefined): {
  lines: string[];
  manifestDigestPrefix: string | null;
  violationTopicLines: string[];
} {
  if (!raw || typeof raw !== 'object' || raw.format !== 'bcfIssuePackageExport_v1') {
    return { lines: [], manifestDigestPrefix: null, violationTopicLines: [] };
  }

  const c = raw.counts ?? {};
  const dg = raw.packageManifestDigestSha256;
  const manifestDigestPrefix =
    typeof dg === 'string' && dg.length >= 12 ? dg.slice(0, 16) : null;

  const lines: string[] = [
    [
      `Topics ${numDash(c.topicRowCount)}`,
      `resolved ${numDash(c.resolvedAnchorCount)}`,
      `unresolved ${numDash(c.unresolvedAnchorCount)}`,
      `stale ${numDash(c.staleAnchorCount)}`,
      `missing correlation ${numDash(c.missingCorrelationAnchorCount)}`,
      `artifact refs ${numDash(c.evidenceArtifactRefCount)}`,
      `remediation links ${numDash(c.remediationHintLinkCount)}`,
    ].join(' · '),
  ];
  if (manifestDigestPrefix) {
    lines.push(`Manifest digest: ${manifestDigestPrefix}… (${dg!.length === 64 ? 'sha256' : 'truncated hint'})`);
  }

  const topics = Array.isArray(raw.topics) ? raw.topics : [];
  const violationTopicLines = topics
    .filter((t): t is BcfIssueTopicRowWire => {
      return (
        typeof (t as BcfIssueTopicRowWire).stableTopicId === 'string' &&
        Array.isArray((t as BcfIssueTopicRowWire).violationRuleIds) &&
        ((t as BcfIssueTopicRowWire).violationRuleIds as string[]).length > 0
      );
    })
    .map((t) => ({
      stableTopicId: String((t as BcfIssueTopicRowWire).stableTopicId),
      rules: [...(((t as BcfIssueTopicRowWire).violationRuleIds as string[]) ?? [])].sort(),
    }))
    .sort((a, b) => a.stableTopicId.localeCompare(b.stableTopicId))
    .map((t) => `${t.stableTopicId} -> ${t.rules.join(', ')}`);

  const blk = raw.fixLoopBlockerCodesEcho;
  if (Array.isArray(blk) && blk.length) {
    const codes = [...new Set(blk.filter((x): x is string => typeof x === 'string'))].sort();
    lines.push(`Fix-loop blockers: ${codes.join(', ')}`);
  }

  const rem = raw.remediationHintRefs;
  if (Array.isArray(rem) && rem.length) {
    const paths = [...rem]
      .filter((x): x is BcfIssueRemediationHintWire => typeof x === 'object' && x !== null)
      .map((x) =>
        typeof x.path === 'string' ? (x.hint ? `${x.path}[${x.hint}]` : x.path) : '',
      )
      .filter(Boolean)
      .sort();
    if (paths.length) {
      lines.push(`Remediation hints: ${paths.slice(0, 8).join(' · ')}${paths.length > 8 ? ' …' : ''}`);
    }
  }

  function pushSlice(
    label: string,
    rows: BcfIssueAnchorSummaryRowWire[] | undefined,
    truncated: boolean,
  ) {
    if (!rows?.length) return;
    const slice = rows.slice(0, ACTIONABLE_EACH).map(formatAnchorBrief);
    lines.push(`${label}:${truncated ? ' (truncated)' : ''}`);
    for (const ln of slice) lines.push(`  · ${ln}`);
  }

  pushSlice(`Stale (${raw.staleAnchorRows?.length ?? 0})`, raw.staleAnchorRows, raw.staleAnchorRowsTruncated === true);
  pushSlice(
    `Missing correlation (${raw.missingCorrelationAnchorRows?.length ?? 0})`,
    raw.missingCorrelationAnchorRows,
    raw.missingCorrelationAnchorRowsTruncated === true,
  );
  pushSlice(
    `Unresolved (${raw.unresolvedAnchorRows?.length ?? 0})`,
    raw.unresolvedAnchorRows,
    raw.unresolvedAnchorRowsTruncated === true,
  );

  return { lines, manifestDigestPrefix, violationTopicLines };
}
