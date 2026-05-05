/** PRD closeout cross-correlation readout (prdCloseoutCrossCorrelationManifest_v1). */

export type PrdCloseoutCrossCorrelationRowWire = {
  prdSectionId: string;
  prdSection: string;
  prdSectionTitle: string;
  advisorMatrixStatus: string;
  crossCorrelationToken: string;
  readinessGateIds: string[];
  specificReadinessGateIds: string[];
  traceabilityTestIds: string[];
  waiverReasonCode?: string;
};

export type PrdCloseoutAdvisoryFindingWire = {
  ruleId: string;
  severity: string;
  prdSectionId: string;
  message: string;
};

export type PrdCloseoutCrossCorrelationManifestWire = {
  format: 'prdCloseoutCrossCorrelationManifest_v1';
  schemaVersion: number;
  rows: PrdCloseoutCrossCorrelationRowWire[];
  tokenCounts: Record<string, number>;
  allowedTokens: string[];
  advisoryFindings: PrdCloseoutAdvisoryFindingWire[];
  prdCloseoutCrossCorrelationDigestSha256: string;
};

function isRow(raw: unknown): raw is PrdCloseoutCrossCorrelationRowWire {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.prdSectionId === 'string' &&
    typeof r.prdSection === 'string' &&
    typeof r.prdSectionTitle === 'string' &&
    typeof r.advisorMatrixStatus === 'string' &&
    typeof r.crossCorrelationToken === 'string' &&
    Array.isArray(r.readinessGateIds) &&
    Array.isArray(r.traceabilityTestIds)
  );
}

function isFinding(raw: unknown): raw is PrdCloseoutAdvisoryFindingWire {
  if (!raw || typeof raw !== 'object') return false;
  const f = raw as Record<string, unknown>;
  return (
    typeof f.ruleId === 'string' &&
    typeof f.severity === 'string' &&
    typeof f.prdSectionId === 'string' &&
    typeof f.message === 'string'
  );
}

export function parsePrdCloseoutCrossCorrelationManifestV1(
  raw: unknown,
): PrdCloseoutCrossCorrelationManifestWire | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.format !== 'prdCloseoutCrossCorrelationManifest_v1') return null;

  const rowsRaw = m.rows;
  if (!Array.isArray(rowsRaw) || !rowsRaw.every(isRow)) return null;

  const findingsRaw = m.advisoryFindings;
  if (!Array.isArray(findingsRaw) || !findingsRaw.every(isFinding)) return null;

  const digest = m.prdCloseoutCrossCorrelationDigestSha256;
  if (typeof digest !== 'string') return null;

  const tokenCounts = m.tokenCounts;
  if (!tokenCounts || typeof tokenCounts !== 'object') return null;

  const allowedTokens = m.allowedTokens;
  if (!Array.isArray(allowedTokens)) return null;

  const schemaVersion = m.schemaVersion;
  if (typeof schemaVersion !== 'number') return null;

  return {
    format: 'prdCloseoutCrossCorrelationManifest_v1',
    schemaVersion,
    rows: rowsRaw,
    tokenCounts: tokenCounts as Record<string, number>,
    allowedTokens: allowedTokens as string[],
    advisoryFindings: findingsRaw,
    prdCloseoutCrossCorrelationDigestSha256: digest,
  };
}

const TOKEN_LABEL: Record<string, string> = {
  aligned: 'aligned',
  advisor_only: 'advisor_only',
  reason_code_drift: 'reason_code_drift',
  status_drift: 'status_drift',
  readiness_only: 'readiness_only',
};

export function formatPrdCloseoutCrossCorrelationReadoutLines(
  manifest: PrdCloseoutCrossCorrelationManifestWire,
): string[] {
  const lines: string[] = [];

  const totalRows = manifest.rows.length;
  const counts = manifest.tokenCounts;
  const aligned = counts['aligned'] ?? 0;
  const advisorOnly = counts['advisor_only'] ?? 0;
  const reasonDrift = counts['reason_code_drift'] ?? 0;
  const statusDrift = counts['status_drift'] ?? 0;
  const digestTail = manifest.prdCloseoutCrossCorrelationDigestSha256.slice(-12);

  lines.push(
    `cross_correlation: ${totalRows} sections — aligned:${aligned} advisor_only:${advisorOnly} reason_code_drift:${reasonDrift} status_drift:${statusDrift} [${digestTail}]`,
  );

  for (const row of manifest.rows) {
    const token = TOKEN_LABEL[row.crossCorrelationToken] ?? row.crossCorrelationToken;
    const traceIds = row.traceabilityTestIds.length > 0 ? row.traceabilityTestIds.join(',') : '—';
    const waiver = row.waiverReasonCode ? ` waiver:${row.waiverReasonCode}` : '';
    lines.push(
      `  ${row.prdSectionId} [${row.advisorMatrixStatus}] → ${token}${waiver} trace:[${traceIds}]`,
    );
  }

  if (manifest.advisoryFindings.length > 0) {
    lines.push(`advisory_findings: ${manifest.advisoryFindings.length}`);
    for (const f of manifest.advisoryFindings) {
      lines.push(`  ${f.ruleId} (${f.severity}) ${f.prdSectionId}: ${f.message}`);
    }
  }

  return lines;
}
