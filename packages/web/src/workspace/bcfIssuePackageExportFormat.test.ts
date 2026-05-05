import { describe, expect, it } from 'vitest';

import {
  summarizeBcfIssuePackageExport,
  type BcfIssuePackageExportWire,
} from './bcfIssuePackageExportFormat';

describe('summarizeBcfIssuePackageExport', () => {
  it('returns empty for missing or mismatched format', () => {
    expect(summarizeBcfIssuePackageExport(undefined).lines.length).toBe(0);
    expect(summarizeBcfIssuePackageExport({ format: 'other' }).lines.length).toBe(0);
  });

  it('sorts violation topic lines deterministically', () => {
    const raw: BcfIssuePackageExportWire = {
      format: 'bcfIssuePackageExport_v1',
      counts: {},
      topics: [
        {
          stableTopicId: 'bcf:z',
          violationRuleIds: ['b', 'a'],
        },
        {
          stableTopicId: 'bcf:a',
          violationRuleIds: ['z_rule'],
        },
      ],
      packageManifestDigestSha256: `${'f'.repeat(64)}`,
    };
    const { violationTopicLines } = summarizeBcfIssuePackageExport(raw);
    expect(violationTopicLines).toEqual(['bcf:a -> z_rule', 'bcf:z -> a, b']);
  });

  it('renders rollup, digest prefix, blocker codes, remediation, and anchored rows (bounded)', () => {
    const digest = `${'a'.repeat(64)}`;
    const raw: BcfIssuePackageExportWire = {
      format: 'bcfIssuePackageExport_v1',
      packageManifestDigestSha256: digest,
      counts: {
        topicRowCount: 3,
        resolvedAnchorCount: 1,
        unresolvedAnchorCount: 2,
        staleAnchorCount: 1,
        missingCorrelationAnchorCount: 4,
        evidenceArtifactRefCount: 9,
        remediationHintLinkCount: 7,
      },
      fixLoopBlockerCodesEcho: ['delta', 'alpha', 'alpha'],
      remediationHintRefs: [
        { path: 'beta', hint: 'h' },
        { path: 'alpha' },
      ],
      unresolvedAnchorRows: [
        {
          stableTopicId: 'bcf:t2',
          topicKind: 'bcf',
          topicId: 't2',
          anchorKind: 'bcf_viewpoint_ref',
          resolutionState: 'unresolved_absent_evidence',
        },
      ],
      staleAnchorRows: [
        {
          stableTopicId: 'bcf:t1',
          topicKind: 'bcf',
          topicId: 't1',
          anchorKind: 'bcf_viewpoint_ref',
          correlationRowKind: 'viewpoint',
          correlationRowId: 'vp-x',
          resolutionState: 'stale_correlation_digest',
        },
      ],
      missingCorrelationAnchorRows: [
        {
          stableTopicId: 'bcf:t9',
          topicKind: 'bcf',
          topicId: 't9',
          anchorKind: 'bcf_viewpoint_ref',
          correlationRowKind: 'viewpoint',
          correlationRowId: 'vp-m',
          resolutionState: 'missing_correlation_digest',
        },
      ],
    };
    const { lines, manifestDigestPrefix } = summarizeBcfIssuePackageExport(raw);
    expect(manifestDigestPrefix).toBe('aaaaaaaaaaaaaaaa');
    expect(lines).toEqual([
      'Topics 3 · resolved 1 · unresolved 2 · stale 1 · missing correlation 4 · artifact refs 9 · remediation links 7',
      'Manifest digest: aaaaaaaaaaaaaaaa… (sha256)',
      'Fix-loop blockers: alpha, delta',
      'Remediation hints: alpha · beta[h]',
      'Stale (1):',
      '  · bcf:t1 · bcf_viewpoint_ref · stale_correlation_digest · viewpoint:vp-x',
      'Missing correlation (1):',
      '  · bcf:t9 · bcf_viewpoint_ref · missing_correlation_digest · viewpoint:vp-m',
      'Unresolved (1):',
      '  · bcf:t2 · bcf_viewpoint_ref · unresolved_absent_evidence',
    ]);
  });
});
