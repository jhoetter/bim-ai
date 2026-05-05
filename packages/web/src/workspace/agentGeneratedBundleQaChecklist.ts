export type AgentGeneratedBundleQaChecklistRowV1 = {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  detail: string;
};

export type AgentGeneratedBundleQaChecklistV1 = {
  format: 'agentGeneratedBundleQaChecklist_v1';
  schemaVersion: number;
  rows: AgentGeneratedBundleQaChecklistRowV1[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function parseRow(raw: unknown): AgentGeneratedBundleQaChecklistRowV1 | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const label = typeof raw.label === 'string' ? raw.label : '';
  const detail = typeof raw.detail === 'string' ? raw.detail : '';
  const st = raw.status;
  if (st !== 'pass' && st !== 'fail' && st !== 'warn' && st !== 'unknown') return null;
  if (!id || !label) return null;
  return { id, label, status: st, detail };
}

export function parseAgentGeneratedBundleQaChecklistV1(
  raw: unknown,
): AgentGeneratedBundleQaChecklistV1 | null {
  if (!isRecord(raw)) return null;
  if (raw.format !== 'agentGeneratedBundleQaChecklist_v1') return null;
  const sv = raw.schemaVersion;
  if (typeof sv !== 'number') return null;
  const rs = raw.rows;
  if (!Array.isArray(rs)) return null;
  const rows: AgentGeneratedBundleQaChecklistRowV1[] = [];
  for (const x of rs) {
    const pr = parseRow(x);
    if (pr !== null) rows.push(pr);
  }
  if (rows.length !== rs.length) return null;
  return {
    format: 'agentGeneratedBundleQaChecklist_v1',
    schemaVersion: sv,
    rows,
  };
}

export function formatAgentGeneratedBundleQaChecklistReadout(
  checklist: AgentGeneratedBundleQaChecklistV1 | null,
): string[] {
  if (checklist === null) return ['(no checklist)'];

  const lines = [
    `format: ${checklist.format}`,
    `schemaVersion: ${checklist.schemaVersion}`,
    'rows:',
  ];

  for (const r of checklist.rows) {
    let st: string;
    switch (r.status) {
      case 'pass':
        st = 'PASS';
        break;
      case 'fail':
        st = 'FAIL';
        break;
      case 'warn':
        st = 'WARN';
        break;
      case 'unknown':
        st = 'UNKNOWN';
        break;
      default: {
        const _exhaustive: never = r.status;
        st = String(_exhaustive);
      }
    }

    lines.push(`  ${r.id} (${st}) — ${r.label}: ${r.detail}`);
  }

  return lines;
}
