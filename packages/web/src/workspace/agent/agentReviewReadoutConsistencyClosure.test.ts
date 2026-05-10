import { describe, expect, it } from 'vitest';

import {
  READOUT_ROW_ORDER,
  formatAgentReviewReadoutConsistencyClosureLines,
  parseAgentReviewReadoutConsistencyClosureV1,
  sortConsistencyRows,
} from './agentReviewReadoutConsistencyClosure';
import type {
  AgentReviewReadoutConsistencyClosureV1,
  ReadoutConsistencyRow,
} from './agentReviewReadoutConsistencyClosure';

function minimalRow(
  readoutId: string,
  token = 'aligned',
  overrides: Partial<ReadoutConsistencyRow> = {},
): ReadoutConsistencyRow {
  return {
    readoutId: readoutId as ReadoutConsistencyRow['readoutId'],
    expectedFieldNames: ['format', 'rows'],
    presentFieldNames: ['format', 'rows'],
    missingFieldNames: [],
    bundleIdSeen: null,
    evidenceDigestSeen: null,
    consistencyToken: token as ReadoutConsistencyRow['consistencyToken'],
    ...overrides,
  };
}

function fixture(
  overrides: Partial<AgentReviewReadoutConsistencyClosureV1> = {},
): AgentReviewReadoutConsistencyClosureV1 {
  return {
    format: 'agentReviewReadoutConsistencyClosure_v1',
    schemaVersion: 1,
    semanticDigestExclusionNote: 'excluded from semanticDigestSha256',
    readoutFieldRefs: {
      briefAcceptance: 'agentBriefAcceptanceReadout_v1',
      bundleQaChecklist: 'agentGeneratedBundleQaChecklist_v1',
      baselineLifecycle: 'evidenceBaselineLifecycleReadout_v1',
    },
    rows: READOUT_ROW_ORDER.map((id) => minimalRow(id)),
    advisoryFindings: [],
    agentReviewReadoutConsistencyClosureDigestSha256: 'a'.repeat(64),
    ...overrides,
  };
}

// ─── parseAgentReviewReadoutConsistencyClosureV1 ──────────────────────────────

describe('parseAgentReviewReadoutConsistencyClosureV1', () => {
  it('parses a valid fixture', () => {
    const p = parseAgentReviewReadoutConsistencyClosureV1(fixture());
    expect(p).not.toBeNull();
    expect(p!.format).toBe('agentReviewReadoutConsistencyClosure_v1');
    expect(p!.rows).toHaveLength(READOUT_ROW_ORDER.length);
  });

  it('returns null for non-object input', () => {
    expect(parseAgentReviewReadoutConsistencyClosureV1(null)).toBeNull();
    expect(parseAgentReviewReadoutConsistencyClosureV1('string')).toBeNull();
    expect(parseAgentReviewReadoutConsistencyClosureV1(42)).toBeNull();
  });

  it('returns null when format is wrong', () => {
    const raw = { ...fixture(), format: 'other' };
    expect(parseAgentReviewReadoutConsistencyClosureV1(raw)).toBeNull();
  });

  it('returns null when rows array is missing', () => {
    const raw = { ...fixture(), rows: undefined };
    expect(parseAgentReviewReadoutConsistencyClosureV1(raw)).toBeNull();
  });

  it('returns null when a row is malformed', () => {
    const raw = fixture({
      rows: [{ readoutId: 'briefAcceptance' }] as unknown as ReadoutConsistencyRow[],
    });
    expect(parseAgentReviewReadoutConsistencyClosureV1(raw)).toBeNull();
  });

  it('parses advisory findings', () => {
    const f = fixture({
      advisoryFindings: [
        {
          ruleId: 'agent_review_readout_missing_fields',
          readoutId: 'mergePreflight',
          severity: 'info',
          message: "Readout 'mergePreflight' is missing fields: format",
        },
      ],
    });
    const p = parseAgentReviewReadoutConsistencyClosureV1(f);
    expect(p!.advisoryFindings).toHaveLength(1);
    expect(p!.advisoryFindings[0]!.ruleId).toBe('agent_review_readout_missing_fields');
    expect(p!.advisoryFindings[0]!.readoutId).toBe('mergePreflight');
  });

  it('handles empty advisory findings array', () => {
    const p = parseAgentReviewReadoutConsistencyClosureV1(fixture());
    expect(p!.advisoryFindings).toHaveLength(0);
  });

  it('preserves bundleIdSeen and evidenceDigestSeen', () => {
    const rows = READOUT_ROW_ORDER.map((id) =>
      minimalRow(id, 'aligned', {
        bundleIdSeen: id === 'briefAcceptance' ? 'bim-ai-evidence-abc-r1.png' : null,
        evidenceDigestSeen: id === 'mergePreflight' ? 'a'.repeat(64) : null,
      }),
    );
    const p = parseAgentReviewReadoutConsistencyClosureV1(fixture({ rows }));
    const briefRow = p!.rows.find((r) => r.readoutId === 'briefAcceptance');
    const mpRow = p!.rows.find((r) => r.readoutId === 'mergePreflight');
    expect(briefRow!.bundleIdSeen).toBe('bim-ai-evidence-abc-r1.png');
    expect(mpRow!.evidenceDigestSeen).toBe('a'.repeat(64));
  });

  it('preserves readoutFieldRefs', () => {
    const p = parseAgentReviewReadoutConsistencyClosureV1(fixture());
    expect(p!.readoutFieldRefs['briefAcceptance']).toBe('agentBriefAcceptanceReadout_v1');
    expect(p!.readoutFieldRefs['bundleQaChecklist']).toBe('agentGeneratedBundleQaChecklist_v1');
    expect(p!.readoutFieldRefs['baselineLifecycle']).toBe('evidenceBaselineLifecycleReadout_v1');
  });
});

// ─── sortConsistencyRows ──────────────────────────────────────────────────────

describe('sortConsistencyRows', () => {
  it('sorts missing_fields before aligned', () => {
    const rows = [
      minimalRow('briefAcceptance', 'aligned'),
      minimalRow('mergePreflight', 'missing_fields'),
    ];
    const sorted = sortConsistencyRows(rows);
    expect(sorted[0]!.consistencyToken).toBe('missing_fields');
    expect(sorted[1]!.consistencyToken).toBe('aligned');
  });

  it('sorts bundle_id_drift before digest_drift', () => {
    const rows = [
      minimalRow('baselineLifecycle', 'digest_drift'),
      minimalRow('briefAcceptance', 'bundle_id_drift'),
    ];
    const sorted = sortConsistencyRows(rows);
    expect(sorted[0]!.consistencyToken).toBe('bundle_id_drift');
    expect(sorted[1]!.consistencyToken).toBe('digest_drift');
  });

  it('within same token sorts by READOUT_ROW_ORDER', () => {
    const rows = [
      minimalRow('baselineLifecycle', 'missing_fields'),
      minimalRow('briefAcceptance', 'missing_fields'),
    ];
    const sorted = sortConsistencyRows(rows);
    expect(sorted[0]!.readoutId).toBe('briefAcceptance');
    expect(sorted[1]!.readoutId).toBe('baselineLifecycle');
  });

  it('does not mutate the original array', () => {
    const rows = [
      minimalRow('mergePreflight', 'missing_fields'),
      minimalRow('briefAcceptance', 'aligned'),
    ];
    const original = [...rows];
    sortConsistencyRows(rows);
    expect(rows[0]!.readoutId).toBe(original[0]!.readoutId);
  });
});

// ─── formatAgentReviewReadoutConsistencyClosureLines ─────────────────────────

describe('formatAgentReviewReadoutConsistencyClosureLines', () => {
  it('returns unavailable message for null input', () => {
    const lines = formatAgentReviewReadoutConsistencyClosureLines(null);
    expect(lines[0]).toContain('not available');
  });

  it('starts with the format name', () => {
    const lines = formatAgentReviewReadoutConsistencyClosureLines(fixture());
    expect(lines[0]).toBe('agentReviewReadoutConsistencyClosure_v1');
  });

  it('emits one line per row', () => {
    const f = fixture();
    const lines = formatAgentReviewReadoutConsistencyClosureLines(f);
    // header + 5 rows + advisory line + digest line
    expect(lines.length).toBeGreaterThanOrEqual(READOUT_ROW_ORDER.length + 1);
  });

  it('includes token and readoutId in each row line', () => {
    const rows = READOUT_ROW_ORDER.map((id) => minimalRow(id, 'aligned'));
    const lines = formatAgentReviewReadoutConsistencyClosureLines(fixture({ rows }));
    for (const id of READOUT_ROW_ORDER) {
      expect(lines.some((ln) => ln.includes('aligned') && ln.includes(id))).toBe(true);
    }
  });

  it('includes missing field names in the line when present', () => {
    const rows = READOUT_ROW_ORDER.map((id) =>
      id === 'mergePreflight'
        ? minimalRow(id, 'missing_fields', { missingFieldNames: ['format', 'rows'] })
        : minimalRow(id, 'aligned'),
    );
    const lines = formatAgentReviewReadoutConsistencyClosureLines(fixture({ rows }));
    const mpLine = lines.find((ln) => ln.includes('mergePreflight'));
    expect(mpLine).toContain('missing=[format,rows]');
  });

  it('shows advisory count when findings are present', () => {
    const f = fixture({
      advisoryFindings: [
        {
          ruleId: 'agent_review_readout_missing_fields',
          readoutId: 'mergePreflight',
          severity: 'info',
          message: 'missing fields',
        },
      ],
    });
    const lines = formatAgentReviewReadoutConsistencyClosureLines(f);
    expect(lines.some((ln) => ln.includes('advisories: 1'))).toBe(true);
  });

  it('shows "advisories: none" when no findings', () => {
    const lines = formatAgentReviewReadoutConsistencyClosureLines(fixture());
    expect(lines.some((ln) => ln.includes('advisories: none'))).toBe(true);
  });

  it('includes digest tail at end', () => {
    const lines = formatAgentReviewReadoutConsistencyClosureLines(
      fixture({ agentReviewReadoutConsistencyClosureDigestSha256: 'b'.repeat(64) }),
    );
    expect(lines.some((ln) => ln.includes('digest:') && ln.includes('bbbbbbbbbbbbbbbb'))).toBe(
      true,
    );
  });

  it('shows bundleId in row line when present', () => {
    const rows = READOUT_ROW_ORDER.map((id) =>
      id === 'briefAcceptance'
        ? minimalRow(id, 'aligned', { bundleIdSeen: 'bim-ai-evidence-abc-r1.png' })
        : minimalRow(id, 'aligned'),
    );
    const lines = formatAgentReviewReadoutConsistencyClosureLines(fixture({ rows }));
    const briefLine = lines.find((ln) => ln.includes('briefAcceptance'));
    expect(briefLine).toContain('bim-ai-evidence-abc-r1.png');
  });
});

// ─── READOUT_ROW_ORDER ────────────────────────────────────────────────────────

describe('READOUT_ROW_ORDER', () => {
  it('has exactly 5 entries', () => {
    expect(READOUT_ROW_ORDER).toHaveLength(5);
  });

  it('contains all expected readout ids', () => {
    expect(READOUT_ROW_ORDER).toContain('briefAcceptance');
    expect(READOUT_ROW_ORDER).toContain('bundleQaChecklist');
    expect(READOUT_ROW_ORDER).toContain('mergePreflight');
    expect(READOUT_ROW_ORDER).toContain('baselineLifecycle');
    expect(READOUT_ROW_ORDER).toContain('browserRenderingBudget');
  });
});
