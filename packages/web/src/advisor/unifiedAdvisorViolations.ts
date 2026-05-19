import { useEffect, useMemo, useState } from 'react';

import type { Violation } from '@bim-ai/core';

import type { ConstructabilityFinding, ConstructabilityReport } from '../lib/api';
import { fetchConstructabilityReport } from '../lib/api';

const CONSTRUCTABILITY_PROFILE = 'construction_readiness';
const SEVERITY_RANK: Record<Violation['severity'], number> = {
  info: 0,
  warning: 1,
  error: 2,
};

export function constructabilityFindingToViolation(finding: ConstructabilityFinding): Violation {
  const severity = normalizeSeverity(finding.severity);
  const recommendation = finding.recommendation?.trim();
  const quickFixCommand = firstContextOnlyCommandHint(finding);
  const violation: Violation = {
    ruleId: finding.ruleId,
    severity,
    message: recommendation
      ? `${finding.message} Recommendation: ${recommendation}`
      : finding.message,
    elementIds: [...(finding.elementIds ?? [])],
    discipline: finding.discipline ?? 'coordination',
    blocking: severity === 'error',
    ...(quickFixCommand ? { quickFixCommand } : {}),
  };
  if (finding.priority) violation.priority = finding.priority;
  if (finding.priorityRank !== undefined) violation.priorityRank = finding.priorityRank;
  if (finding.rootCauseGroupId) violation.rootCauseGroupId = finding.rootCauseGroupId;
  if (finding.rootCauseGroup) violation.rootCauseGroup = finding.rootCauseGroup;
  if (finding.audienceText) violation.audienceText = finding.audienceText;
  return violation;
}

export function mergeAdvisorViolations(
  baseViolations: Violation[],
  constructabilityReport: ConstructabilityReport | null | undefined,
): Violation[] {
  const merged = new Map<string, Violation>();
  for (const violation of baseViolations) {
    merged.set(violationKey(violation), violation);
  }
  for (const finding of constructabilityReport?.findings ?? []) {
    const violation = constructabilityFindingToViolation(finding);
    const key = violationKey(violation);
    const existing = merged.get(key);
    if (!existing || SEVERITY_RANK[violation.severity] > SEVERITY_RANK[existing.severity]) {
      merged.set(key, violation);
    }
  }
  return Array.from(merged.values());
}

export function useUnifiedAdvisorViolations(
  baseViolations: Violation[],
  modelId: string | undefined,
  revision: string | number,
): { violations: Violation[]; report: ConstructabilityReport | null; loading: boolean } {
  const [report, setReport] = useState<ConstructabilityReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!modelId || modelId === 'empty') {
      setReport(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchConstructabilityReport(modelId, CONSTRUCTABILITY_PROFILE)
      .then((nextReport) => {
        if (!cancelled) setReport(nextReport);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, revision]);

  const violations = useMemo(
    () => mergeAdvisorViolations(baseViolations, report),
    [baseViolations, report],
  );

  return { violations, report, loading };
}

function normalizeSeverity(value: string): Violation['severity'] {
  return value === 'error' || value === 'warning' || value === 'info' ? value : 'warning';
}

function violationKey(violation: Violation): string {
  return [violation.ruleId, [...(violation.elementIds ?? [])].sort().join(',')].join('|');
}

function firstContextOnlyCommandHint(
  finding: ConstructabilityFinding,
): Record<string, unknown> | null {
  const hints = finding.safeCommandHints ?? finding.actionability?.safeCommandHints ?? [];
  for (const hint of hints) {
    if (hint?.safety !== 'context_only') continue;
    if (hint.command && typeof hint.command === 'object') return hint.command;
  }
  return null;
}
