import { describe, expect, it } from 'vitest';

import {
  formatBcfRoundtripViolationRuleLinks,
  summarizeBcfRoundtripEvidenceSummary,
} from './bcfRoundtripEvidenceSummaryFormat';

describe('formatBcfRoundtripViolationRuleLinks', () => {
  it('sorts topics and rule ids deterministically', () => {
    const lines = formatBcfRoundtripViolationRuleLinks([
      { topicKind: 'bcf', topicId: 'b', violationRuleIds: ['z', 'a'] },
      { topicKind: 'bcf', topicId: 'a', violationRuleIds: ['m'] },
      { topicKind: 'issue', topicId: 'i1', violationRuleIds: ['x'] },
    ]);
    expect(lines).toEqual(['bcf:a -> m', 'bcf:b -> a, z', 'issue:i1 -> x']);
  });

  it('returns empty when no topics', () => {
    expect(formatBcfRoundtripViolationRuleLinks(undefined)).toEqual([]);
    expect(formatBcfRoundtripViolationRuleLinks([])).toEqual([]);
  });
});

describe('summarizeBcfRoundtripEvidenceSummary', () => {
  it('normalizes numbers and nested link lines', () => {
    const s = summarizeBcfRoundtripEvidenceSummary({
      format: 'bcfRoundtripEvidenceSummary_v1',
      bcfTopicCount: 2,
      viewpointAndScreenshotRefCount: 3,
      modelElementReferenceCount: 4,
      unresolvedReferenceCount: 1,
      topicsWithLinkedViolationRuleIds: [
        { topicKind: 'bcf', topicId: 't', violationRuleIds: ['b', 'a'] },
      ],
    });
    expect(s.bcfTopicCount).toBe(2);
    expect(s.viewpointAndScreenshotRefCount).toBe(3);
    expect(s.modelElementReferenceCount).toBe(4);
    expect(s.unresolvedReferenceCount).toBe(1);
    expect(s.violationRuleLinkLines).toEqual(['bcf:t -> a, b']);
  });

  it('handles nullish payload', () => {
    expect(summarizeBcfRoundtripEvidenceSummary(null).bcfTopicCount).toBeNull();
  });
});
