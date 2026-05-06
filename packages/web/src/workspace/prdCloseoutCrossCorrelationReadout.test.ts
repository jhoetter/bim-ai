import { describe, expect, it } from 'vitest';

import {
  formatPrdCloseoutCrossCorrelationReadoutLines,
  parsePrdCloseoutCrossCorrelationManifestV1,
  type PrdCloseoutCrossCorrelationManifestWire,
} from './prdCloseoutCrossCorrelationReadout';

function makeRow(overrides: Partial<PrdCloseoutCrossCorrelationManifestWire['rows'][0]> = {}) {
  return {
    prdSectionId: 'prd_s11_sheets',
    prdSection: '§11',
    prdSectionTitle: 'Validation — Sheets',
    advisorMatrixStatus: 'pass',
    crossCorrelationToken: 'aligned',
    readinessGateIds: ['pytest_prd_blocking_advisor_matrix', 'pytest_prd_traceability_matrix'],
    specificReadinessGateIds: ['pytest_prd_traceability_matrix'],
    traceabilityTestIds: ['validation_sheets_advisory'],
    ...overrides,
  };
}

function makeManifest(
  overrides: Partial<PrdCloseoutCrossCorrelationManifestWire> = {},
): PrdCloseoutCrossCorrelationManifestWire {
  return {
    format: 'prdCloseoutCrossCorrelationManifest_v1',
    schemaVersion: 1,
    rows: [makeRow()],
    tokenCounts: {
      aligned: 1,
      advisor_only: 0,
      reason_code_drift: 0,
      readiness_only: 0,
      status_drift: 0,
    },
    allowedTokens: [
      'aligned',
      'advisor_only',
      'readiness_only',
      'reason_code_drift',
      'status_drift',
    ],
    advisoryFindings: [],
    prdCloseoutCrossCorrelationDigestSha256: 'a'.repeat(64),
    ...overrides,
  };
}

describe('parsePrdCloseoutCrossCorrelationManifestV1', () => {
  it('returns null for non-object', () => {
    expect(parsePrdCloseoutCrossCorrelationManifestV1(null)).toBeNull();
    expect(parsePrdCloseoutCrossCorrelationManifestV1('string')).toBeNull();
    expect(parsePrdCloseoutCrossCorrelationManifestV1(42)).toBeNull();
  });

  it('returns null for wrong format', () => {
    expect(parsePrdCloseoutCrossCorrelationManifestV1({ format: 'wrong_format' })).toBeNull();
  });

  it('parses a valid manifest', () => {
    const m = makeManifest();
    const result = parsePrdCloseoutCrossCorrelationManifestV1(m);
    expect(result).not.toBeNull();
    expect(result!.format).toBe('prdCloseoutCrossCorrelationManifest_v1');
    expect(result!.rows).toHaveLength(1);
    expect(result!.rows[0].prdSectionId).toBe('prd_s11_sheets');
  });

  it('parses advisory findings', () => {
    const m = makeManifest({
      advisoryFindings: [
        {
          ruleId: 'prd_closeout_section_missing_in_readiness',
          severity: 'info',
          prdSectionId: 'prd_s11_datum',
          message: 'PRD section has only holistic readiness gate coverage',
        },
      ],
    });
    const result = parsePrdCloseoutCrossCorrelationManifestV1(m);
    expect(result!.advisoryFindings).toHaveLength(1);
    expect(result!.advisoryFindings[0].ruleId).toBe('prd_closeout_section_missing_in_readiness');
  });

  it('returns null when rows have invalid shape', () => {
    const m = { ...makeManifest(), rows: [{ invalid: true }] };
    expect(parsePrdCloseoutCrossCorrelationManifestV1(m)).toBeNull();
  });

  it('returns null when digest is missing', () => {
    const m = { ...makeManifest(), prdCloseoutCrossCorrelationDigestSha256: undefined };
    expect(parsePrdCloseoutCrossCorrelationManifestV1(m)).toBeNull();
  });
});

describe('formatPrdCloseoutCrossCorrelationReadoutLines', () => {
  it('includes summary line with token counts', () => {
    const m = makeManifest();
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    expect(lines[0]).toMatch(/cross_correlation:.*aligned:1.*advisor_only:0/);
  });

  it('includes digest tail in summary line', () => {
    const m = makeManifest({ prdCloseoutCrossCorrelationDigestSha256: 'f'.repeat(64) });
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    expect(lines[0]).toContain('ffffffffffff');
  });

  it('renders one line per row with prdSectionId and token', () => {
    const m = makeManifest();
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    const rowLine = lines.find((l) => l.includes('prd_s11_sheets'));
    expect(rowLine).toBeDefined();
    expect(rowLine).toContain('aligned');
    expect(rowLine).toContain('[pass]');
  });

  it('renders traceability test ids in row line', () => {
    const m = makeManifest();
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    const rowLine = lines.find((l) => l.includes('prd_s11_sheets'));
    expect(rowLine).toContain('validation_sheets_advisory');
  });

  it('renders waiver code for deferred rows', () => {
    const m = makeManifest({
      rows: [
        makeRow({
          prdSectionId: 'prd_s11_roofs',
          advisorMatrixStatus: 'deferred',
          crossCorrelationToken: 'reason_code_drift',
          traceabilityTestIds: [],
          waiverReasonCode: 'no_rule_impl_v1',
        }),
      ],
    });
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    const rowLine = lines.find((l) => l.includes('prd_s11_roofs'));
    expect(rowLine).toContain('waiver:no_rule_impl_v1');
    expect(rowLine).toContain('reason_code_drift');
  });

  it('renders dash for empty traceability test ids', () => {
    const m = makeManifest({
      rows: [
        makeRow({
          prdSectionId: 'prd_s11_datum',
          crossCorrelationToken: 'advisor_only',
          traceabilityTestIds: [],
        }),
      ],
    });
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    const rowLine = lines.find((l) => l.includes('prd_s11_datum'));
    expect(rowLine).toContain('trace:[—]');
  });

  it('renders advisory findings section when findings exist', () => {
    const m = makeManifest({
      advisoryFindings: [
        {
          ruleId: 'prd_closeout_reason_code_drift',
          severity: 'info',
          prdSectionId: 'prd_s11_roofs',
          message: 'waiver code not mirrored',
        },
      ],
    });
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    expect(lines.some((l) => l.includes('advisory_findings: 1'))).toBe(true);
    expect(lines.some((l) => l.includes('prd_closeout_reason_code_drift'))).toBe(true);
  });

  it('omits advisory findings section when empty', () => {
    const m = makeManifest({ advisoryFindings: [] });
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    expect(lines.some((l) => l.includes('advisory_findings'))).toBe(false);
  });

  it('rows are sorted by prdSectionId in output', () => {
    const m = makeManifest({
      rows: [makeRow({ prdSectionId: 'prd_z_last' }), makeRow({ prdSectionId: 'prd_a_first' })],
    });
    const lines = formatPrdCloseoutCrossCorrelationReadoutLines(m);
    const rowLines = lines.filter((l) => l.includes('prd_'));
    expect(rowLines[0]).toContain('prd_z_last');
    expect(rowLines[1]).toContain('prd_a_first');
  });
});
