import { describe, expect, it } from 'vitest';

import { formatAgentReviewActionDetails, isAgentReviewActionKindV1 } from './agentReviewActionDetails';

describe('agentReviewActionDetails', () => {
  it('parses known kinds', () => {
    expect(isAgentReviewActionKindV1('reviewTopic')).toBe(true);
    expect(isAgentReviewActionKindV1('unknownThing')).toBe(false);
  });

  it('renders reviewTopic rows', () => {
    expect(
      formatAgentReviewActionDetails('reviewTopic', {
        topicKind: 'bcf',
        bcfTopicId: 'topic-1',
      }),
    ).toContainEqual(expect.objectContaining({ label: 'BCF topic id', value: 'topic-1' }));
  });

  it('renders focusDeterministicEvidenceRow', () => {
    const rows = formatAgentReviewActionDetails('focusDeterministicEvidenceRow', {
      deterministicRowKind: 'sheet',
      sheetId: 's-a',
      pngViewport: 'x.png',
    });
    expect(rows.map((x) => x.label)).toContain('Row kind');
    expect(rows.some((x) => x.label === 'Sheet id' && x.value === 's-a')).toBe(true);
  });

  it('renders remediateEvidenceDiffIngest', () => {
    const rows = formatAgentReviewActionDetails('remediateEvidenceDiffIngest', {
      needsFixLoop: true,
      blockerCodes: ['artifact_ingest_correlation_digest_mismatch'],
      ingestManifestDigestExpectedSha256: 'a'.repeat(64),
    });
    expect(rows.some((x) => x.label === 'Blocker codes')).toBe(true);
    expect(rows.some((x) => x.label === 'Expected ingest digest')).toBe(true);
  });

  it('falls back for unknown kinds', () => {
    expect(formatAgentReviewActionDetails('legacyKind', { foo: 1 }).length).toBeGreaterThanOrEqual(
      1,
    );
  });
});
