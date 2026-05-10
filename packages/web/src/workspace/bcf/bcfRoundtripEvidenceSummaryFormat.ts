/**
 * Deterministic readout lines for evidenceAgentFollowThrough_v1.bcfRoundtripEvidenceSummary_v1.
 */

export type BcfRoundtripTopicRuleLink = {
  topicKind: string;
  topicId: string;
  violationRuleIds: string[];
};

export type BcfRoundtripEvidenceSummaryWire = {
  format?: string;
  bcfTopicCount?: number;
  viewpointAndScreenshotRefCount?: number;
  modelElementReferenceCount?: number;
  unresolvedReferenceCount?: number;
  topicsWithLinkedViolationRuleIds?: BcfRoundtripTopicRuleLink[];
};

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

type BcfRoundtripTopicLinkNorm = {
  topicKind: string;
  topicId: string;
  violationRuleIds: string[];
};

/** Sorted join of topic rule link lines for stable snapshots. */
export function formatBcfRoundtripViolationRuleLinks(
  topics: BcfRoundtripTopicRuleLink[] | undefined,
): string[] {
  if (!Array.isArray(topics) || topics.length === 0) {
    return [];
  }
  const rows = topics
    .filter(
      (t): t is BcfRoundtripTopicLinkNorm =>
        typeof t?.topicKind === 'string' &&
        typeof t?.topicId === 'string' &&
        Array.isArray(t.violationRuleIds),
    )
    .map((t) => ({
      topicKind: t.topicKind,
      topicId: t.topicId,
      violationRuleIds: [...t.violationRuleIds]
        .filter((x): x is string => typeof x === 'string')
        .sort(),
    }))
    .sort((a, b) => {
      const k = a.topicKind.localeCompare(b.topicKind);
      if (k !== 0) return k;
      return a.topicId.localeCompare(b.topicId);
    });

  return rows.map((r) => `${r.topicKind}:${r.topicId} -> ${r.violationRuleIds.join(', ') || '—'}`);
}

export function summarizeBcfRoundtripEvidenceSummary(
  raw: BcfRoundtripEvidenceSummaryWire | null | undefined,
): {
  bcfTopicCount: number | null;
  viewpointAndScreenshotRefCount: number | null;
  modelElementReferenceCount: number | null;
  unresolvedReferenceCount: number | null;
  violationRuleLinkLines: string[];
} {
  if (!raw || typeof raw !== 'object') {
    return {
      bcfTopicCount: null,
      viewpointAndScreenshotRefCount: null,
      modelElementReferenceCount: null,
      unresolvedReferenceCount: null,
      violationRuleLinkLines: [],
    };
  }
  return {
    bcfTopicCount: numOrNull(raw.bcfTopicCount),
    viewpointAndScreenshotRefCount: numOrNull(raw.viewpointAndScreenshotRefCount),
    modelElementReferenceCount: numOrNull(raw.modelElementReferenceCount),
    unresolvedReferenceCount: numOrNull(raw.unresolvedReferenceCount),
    violationRuleLinkLines: formatBcfRoundtripViolationRuleLinks(
      raw.topicsWithLinkedViolationRuleIds,
    ),
  };
}
