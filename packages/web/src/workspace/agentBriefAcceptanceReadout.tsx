/** Agent brief acceptance gates (agentBriefAcceptanceReadout_v1) — derivative, digest-excluded. */

export type AgentBriefAcceptanceRowWire = {
  gateId: string;
  label: string;
  status: string;
  failureReasonCode: string;
  requiredAction: string;
  sourceCommandIds: string[];
  affectedWorkpackages: string[];
  expectedEvidenceArtifacts: string[];
  validationCommandLabels: string[];
};

export type AgentBriefAcceptanceReadoutWire = {
  format: 'agentBriefAcceptanceReadout_v1';
  schemaVersion: number;
  rows: AgentBriefAcceptanceRowWire[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((s) => typeof s === 'string');
}

function isRow(raw: unknown): raw is AgentBriefAcceptanceRowWire {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.gateId === 'string' &&
    typeof raw.label === 'string' &&
    typeof raw.status === 'string' &&
    typeof raw.failureReasonCode === 'string' &&
    typeof raw.requiredAction === 'string' &&
    isStringArray(raw.sourceCommandIds) &&
    isStringArray(raw.affectedWorkpackages) &&
    isStringArray(raw.expectedEvidenceArtifacts) &&
    isStringArray(raw.validationCommandLabels)
  );
}

/** Parse server payload field into a typed readout, or null if missing/invalid. */
export function parseAgentBriefAcceptanceReadoutV1(
  raw: unknown,
): AgentBriefAcceptanceReadoutWire | null {
  if (!isRecord(raw)) return null;
  if (raw.format !== 'agentBriefAcceptanceReadout_v1') return null;
  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number') return null;
  const rowsRaw = raw.rows;
  if (!Array.isArray(rowsRaw) || !rowsRaw.every(isRow)) return null;
  return {
    format: 'agentBriefAcceptanceReadout_v1',
    schemaVersion,
    rows: rowsRaw.map((r) => ({ ...r })),
  };
}

/** Deterministic monospace lines for UI + Vitest. */
export function formatAgentBriefAcceptanceReadoutLines(
  readout: AgentBriefAcceptanceReadoutWire | null,
): string[] {
  if (readout === null) return ['(no acceptance readout)'];
  const out: string[] = [
    `format: ${readout.format}`,
    `schemaVersion: ${readout.schemaVersion}`,
    'rows:',
  ];
  for (const r of readout.rows) {
    out.push(`  ${r.gateId}: status=${r.status} code=${r.failureReasonCode} label=${r.label}`);
    if (r.requiredAction) out.push(`    action: ${r.requiredAction}`);
    if (r.sourceCommandIds.length) {
      out.push(`    sourceCommandIds: ${[...r.sourceCommandIds].sort().join(', ')}`);
    }
    if (r.expectedEvidenceArtifacts.length) {
      out.push(`    expectedEvidenceArtifacts: ${[...r.expectedEvidenceArtifacts].join(', ')}`);
    }
    if (r.validationCommandLabels.length) {
      out.push(`    validationCommandLabels: ${[...r.validationCommandLabels].join(', ')}`);
    }
  }
  return out;
}

export function AgentBriefAcceptanceReadoutV1Table(props: {
  title: string;
  readout: AgentBriefAcceptanceReadoutWire | null;
}) {
  const { title, readout } = props;
  if (readout === null) {
    return (
      <div className="mt-2 rounded border border-border/60 bg-background/30 p-2">
        <div className="text-[10px] font-medium text-muted">{title}</div>
        <p className="mt-1 text-[10px] text-muted">(no acceptance readout in payload)</p>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded border border-border/60 bg-background/30 p-2">
      <div className="text-[10px] font-semibold text-muted">{title}</div>
      <p className="mt-1 text-[10px] text-muted">
        <code className="text-[9px]">agentBriefAcceptanceReadout_v1</code> — ordered acceptance
        gates
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-border/50 text-left text-muted">
              <th scope="col" className="py-1 pe-2 font-medium">
                gate
              </th>
              <th scope="col" className="py-1 pe-2 font-medium">
                status
              </th>
              <th scope="col" className="py-1 pe-2 font-medium">
                code
              </th>
              <th scope="col" className="py-1 pe-2 font-medium">
                required action
              </th>
              <th scope="col" className="py-1 font-medium">
                detail
              </th>
            </tr>
          </thead>
          <tbody>
            {readout.rows.map((row) => (
              <tr
                key={row.gateId}
                data-testid={`agent-brief-acceptance-row-${row.gateId}`}
                className="border-t border-border/35"
              >
                <td className="py-1 pe-2 align-top font-mono">{row.gateId}</td>
                <td className="py-1 pe-2 align-top font-mono">{row.status}</td>
                <td className="py-1 pe-2 align-top font-mono">{row.failureReasonCode}</td>
                <td className="py-1 pe-2 align-top">
                  {row.requiredAction ? (
                    <span className="font-mono text-[8px]">{row.requiredAction}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-1 align-top text-[8px] text-muted">
                  {row.sourceCommandIds.length ? (
                    <span className="font-mono">cmds: {row.sourceCommandIds.join(', ')}</span>
                  ) : null}
                  {row.expectedEvidenceArtifacts.length ? (
                    <div className="mt-0.5 font-mono">
                      artifacts: {row.expectedEvidenceArtifacts.join(', ')}
                    </div>
                  ) : null}
                  {row.validationCommandLabels.length ? (
                    <div className="mt-0.5 font-mono">
                      val: {row.validationCommandLabels.join(', ')}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
