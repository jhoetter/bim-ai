/** Evidence-package baseline lifecycle readout (evidenceBaselineLifecycleReadout_v1). */

export type EvidenceBaselineLifecycleRowWire = {
  baselinePngBasename: string;
  expectedDiffBasename: string;
  committedFixtureStatus: string;
  digestCorrelationStatus: string;
  suggestedNextAction: string;
  ciGateHint: string;
  stagedUploadEligibilityNote?: string;
};

export type EvidenceBaselineLifecycleReadoutWire = {
  format: 'evidenceBaselineLifecycleReadout_v1';
  expectedBaselineIds: string[];
  ingestTargetCount: number;
  rollupDigestCorrelationStatus: string;
  rollupSuggestedNextAction: string;
  rollupCiGateHint: string;
  fixLoopBlockerCodes: string[];
  gateClosed: boolean;
  rows: EvidenceBaselineLifecycleRowWire[];
  stagedUploadEligibilityNote?: string;
};

function isRow(raw: unknown): raw is EvidenceBaselineLifecycleRowWire {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.baselinePngBasename === 'string' &&
    typeof r.expectedDiffBasename === 'string' &&
    typeof r.committedFixtureStatus === 'string' &&
    typeof r.digestCorrelationStatus === 'string' &&
    typeof r.suggestedNextAction === 'string' &&
    typeof r.ciGateHint === 'string'
  );
}

export function parseEvidenceBaselineLifecycleReadoutV1(
  raw: unknown,
): EvidenceBaselineLifecycleReadoutWire | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.format !== 'evidenceBaselineLifecycleReadout_v1') return null;

  const expectedRaw = m.expectedBaselineIds;
  if (!Array.isArray(expectedRaw) || !expectedRaw.every((x) => typeof x === 'string')) {
    return null;
  }

  const codesRaw = m.fixLoopBlockerCodes;
  if (!Array.isArray(codesRaw) || !codesRaw.every((x) => typeof x === 'string')) {
    return null;
  }

  const rowsRaw = m.rows;
  if (!Array.isArray(rowsRaw) || !rowsRaw.every(isRow)) {
    return null;
  }

  const ingestCt = m.ingestTargetCount;
  if (typeof ingestCt !== 'number' || !Number.isFinite(ingestCt)) return null;

  const rollupDig = m.rollupDigestCorrelationStatus;
  const rollupAct = m.rollupSuggestedNextAction;
  const rollupCi = m.rollupCiGateHint;
  if (
    typeof rollupDig !== 'string' ||
    typeof rollupAct !== 'string' ||
    typeof rollupCi !== 'string'
  ) {
    return null;
  }

  const stagedNote =
    typeof m.stagedUploadEligibilityNote === 'string' ? m.stagedUploadEligibilityNote : undefined;

  return {
    format: 'evidenceBaselineLifecycleReadout_v1',
    expectedBaselineIds: [...expectedRaw],
    ingestTargetCount: ingestCt,
    rollupDigestCorrelationStatus: rollupDig,
    rollupSuggestedNextAction: rollupAct,
    rollupCiGateHint: rollupCi,
    fixLoopBlockerCodes: [...codesRaw],
    gateClosed: m.gateClosed === true,
    rows: rowsRaw.map((r) => ({ ...r })),
    ...(stagedNote !== undefined ? { stagedUploadEligibilityNote: stagedNote } : {}),
  };
}

export function EvidenceBaselineLifecycleReadoutV1Table(props: {
  readout: EvidenceBaselineLifecycleReadoutWire;
}) {
  const { readout } = props;
  return (
    <div
      data-testid="evidence-baseline-lifecycle-readout"
      className="mt-2 rounded border border-border/60 bg-background/30 p-2"
    >
      <div className="text-[10px] font-semibold text-muted">
        Evidence baseline lifecycle (
        <code className="text-[9px]">evidenceBaselineLifecycleReadout_v1</code>)
      </div>
      <p className="mt-1 text-[10px] text-muted">
        rollup: <code className="font-mono text-[9px]">{readout.rollupSuggestedNextAction}</code>
        {' · '}digest{' '}
        <code className="font-mono text-[9px]">{readout.rollupDigestCorrelationStatus}</code>
        {' · '}gateClosed <code className="font-mono text-[9px]">{String(readout.gateClosed)}</code>
      </p>
      <p className="mt-0.5 text-[9px] text-muted">
        <code className="break-all font-mono">{readout.rollupCiGateHint}</code>
      </p>
      <p className="mt-1 text-[9px] text-muted">
        blockers: <code className="font-mono">{readout.fixLoopBlockerCodes.join(', ') || '—'}</code>
      </p>
      {readout.stagedUploadEligibilityNote && (
        <p className="mt-0.5 text-[9px] italic text-muted">{readout.stagedUploadEligibilityNote}</p>
      )}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-border/50 text-left text-muted">
              <th className="py-1 pe-2 font-medium">baseline</th>
              <th className="py-1 pe-2 font-medium">diff basename</th>
              <th className="py-1 pe-2 font-medium">committed</th>
              <th className="py-1 pe-2 font-medium">digest</th>
              <th className="py-1 pe-2 font-medium">next action</th>
              <th className="py-1 font-medium">CI gate hint</th>
            </tr>
          </thead>
          <tbody>
            {readout.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-1 text-muted">
                  No ingest checklist targets (noop baseline slice).
                </td>
              </tr>
            ) : (
              readout.rows.map((row) => (
                <tr key={row.baselinePngBasename} className="border-t border-border/35">
                  <td className="py-1 pe-2 align-top font-mono">{row.baselinePngBasename}</td>
                  <td className="py-1 pe-2 align-top font-mono">{row.expectedDiffBasename}</td>
                  <td className="py-1 pe-2 align-top font-mono">{row.committedFixtureStatus}</td>
                  <td className="py-1 pe-2 align-top font-mono">{row.digestCorrelationStatus}</td>
                  <td className="py-1 pe-2 align-top font-mono">{row.suggestedNextAction}</td>
                  <td className="py-1 align-top">
                    <code className="break-all font-mono">{row.ciGateHint}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
