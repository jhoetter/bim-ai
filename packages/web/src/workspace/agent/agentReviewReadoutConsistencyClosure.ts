/**
 * Agent Review readout consistency closure — cross-checks field presence, bundle id,
 * and evidence digest drift across the five Agent Review readouts (WP-A02/A04/F02/F03/V01).
 */

export type ReadoutConsistencyToken =
  | 'aligned'
  | 'bundle_id_drift'
  | 'digest_drift'
  | 'missing_fields';

export type ReadoutId =
  | 'briefAcceptance'
  | 'bundleQaChecklist'
  | 'mergePreflight'
  | 'baselineLifecycle'
  | 'browserRenderingBudget';

export const READOUT_ROW_ORDER: readonly ReadoutId[] = [
  'briefAcceptance',
  'bundleQaChecklist',
  'mergePreflight',
  'baselineLifecycle',
  'browserRenderingBudget',
] as const;

export type ReadoutConsistencyRow = {
  readoutId: ReadoutId;
  expectedFieldNames: string[];
  presentFieldNames: string[];
  missingFieldNames: string[];
  bundleIdSeen: string | null;
  evidenceDigestSeen: string | null;
  consistencyToken: ReadoutConsistencyToken;
};

export type AdvisoryFinding = {
  ruleId: string;
  readoutId: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
};

export type AgentReviewReadoutConsistencyClosureV1 = {
  format: 'agentReviewReadoutConsistencyClosure_v1';
  schemaVersion: number;
  semanticDigestExclusionNote: string;
  readoutFieldRefs: Partial<Record<string, string>>;
  rows: ReadoutConsistencyRow[];
  advisoryFindings: AdvisoryFinding[];
  agentReviewReadoutConsistencyClosureDigestSha256: string;
};

function isReadoutConsistencyRow(raw: unknown): raw is ReadoutConsistencyRow {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r['readoutId'] === 'string' &&
    Array.isArray(r['expectedFieldNames']) &&
    Array.isArray(r['presentFieldNames']) &&
    Array.isArray(r['missingFieldNames']) &&
    (r['bundleIdSeen'] === null || typeof r['bundleIdSeen'] === 'string') &&
    (r['evidenceDigestSeen'] === null || typeof r['evidenceDigestSeen'] === 'string') &&
    typeof r['consistencyToken'] === 'string'
  );
}

function isAdvisoryFinding(raw: unknown): raw is AdvisoryFinding {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r['ruleId'] === 'string' &&
    typeof r['readoutId'] === 'string' &&
    typeof r['severity'] === 'string' &&
    typeof r['message'] === 'string'
  );
}

export function parseAgentReviewReadoutConsistencyClosureV1(
  raw: unknown,
): AgentReviewReadoutConsistencyClosureV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r['format'] !== 'agentReviewReadoutConsistencyClosure_v1') return null;
  if (!Array.isArray(r['rows'])) return null;
  const rows = r['rows'] as unknown[];
  if (!rows.every(isReadoutConsistencyRow)) return null;
  const findings = Array.isArray(r['advisoryFindings'])
    ? (r['advisoryFindings'] as unknown[]).filter(isAdvisoryFinding)
    : [];
  return {
    format: 'agentReviewReadoutConsistencyClosure_v1',
    schemaVersion: typeof r['schemaVersion'] === 'number' ? r['schemaVersion'] : 1,
    semanticDigestExclusionNote:
      typeof r['semanticDigestExclusionNote'] === 'string' ? r['semanticDigestExclusionNote'] : '',
    readoutFieldRefs:
      r['readoutFieldRefs'] && typeof r['readoutFieldRefs'] === 'object'
        ? (r['readoutFieldRefs'] as Record<string, string>)
        : {},
    rows: rows as ReadoutConsistencyRow[],
    advisoryFindings: findings,
    agentReviewReadoutConsistencyClosureDigestSha256:
      typeof r['agentReviewReadoutConsistencyClosureDigestSha256'] === 'string'
        ? r['agentReviewReadoutConsistencyClosureDigestSha256']
        : '',
  };
}

const TOKEN_SORT_ORDER: Record<ReadoutConsistencyToken, number> = {
  missing_fields: 0,
  bundle_id_drift: 1,
  digest_drift: 2,
  aligned: 3,
};

/** Sort rows: most-actionable tokens first, then by readout order. */
export function sortConsistencyRows(rows: ReadoutConsistencyRow[]): ReadoutConsistencyRow[] {
  return [...rows].sort((a, b) => {
    const ta = TOKEN_SORT_ORDER[a.consistencyToken as ReadoutConsistencyToken] ?? 99;
    const tb = TOKEN_SORT_ORDER[b.consistencyToken as ReadoutConsistencyToken] ?? 99;
    if (ta !== tb) return ta - tb;
    return READOUT_ROW_ORDER.indexOf(a.readoutId) - READOUT_ROW_ORDER.indexOf(b.readoutId);
  });
}

/** Monospace lines for Agent Review inspector surface. */
export function formatAgentReviewReadoutConsistencyClosureLines(
  closure: AgentReviewReadoutConsistencyClosureV1 | null,
): string[] {
  if (!closure) return ['agentReviewReadoutConsistencyClosure_v1: not available'];
  const lines: string[] = ['agentReviewReadoutConsistencyClosure_v1'];
  for (const row of closure.rows) {
    const missingNote = row.missingFieldNames.length
      ? ` missing=[${row.missingFieldNames.join(',')}]`
      : '';
    const bundleNote = row.bundleIdSeen ? ` bundleId=${row.bundleIdSeen}` : '';
    const digestNote = row.evidenceDigestSeen
      ? ` digest=${row.evidenceDigestSeen.slice(0, 8)}…`
      : '';
    lines.push(`${row.consistencyToken} ${row.readoutId}${missingNote}${bundleNote}${digestNote}`);
  }
  if (closure.advisoryFindings.length) {
    lines.push(`advisories: ${closure.advisoryFindings.length}`);
    for (const f of closure.advisoryFindings) {
      lines.push(`  [${f.severity}] ${f.ruleId} (${f.readoutId}): ${f.message}`);
    }
  } else {
    lines.push('advisories: none');
  }
  lines.push(`digest: ${closure.agentReviewReadoutConsistencyClosureDigestSha256.slice(0, 16)}…`);
  return lines;
}
