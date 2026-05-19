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

export type AdvisorFindingViewpointBridge = {
  schemaVersion: 'advisorFindingViewpointBridge_v1';
  ruleId: string;
  viewId: string;
  viewpointId: string;
  elementIds: string[];
  camera: Record<string, unknown>;
  sectionBoxEnabled: boolean;
  sectionBoxMinMm?: Record<string, unknown>;
  sectionBoxMaxMm?: Record<string, unknown>;
  bboxMm?: Record<string, unknown>;
};

export function constructabilityFindingToViolation(finding: ConstructabilityFinding): Violation {
  const severity = normalizeSeverity(finding.severity);
  const recommendation = finding.recommendation?.trim();
  const quickFixCommand = firstContextOnlyCommandHint(finding);
  const viewpointBridge = advisorFindingViewpointBridge(finding);
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
    ...(viewpointBridge
      ? {
          viewpointRef: viewpointBridge.viewpointId,
          viewpointEvidence: viewpointBridge,
        }
      : {}),
  };
  if (finding.evidenceRefs?.length) violation.evidenceRefs = finding.evidenceRefs;
  if (finding.priority) violation.priority = finding.priority;
  if (finding.priorityRank !== undefined) violation.priorityRank = finding.priorityRank;
  if (finding.rootCauseGroupId) violation.rootCauseGroupId = finding.rootCauseGroupId;
  if (finding.rootCauseGroup) violation.rootCauseGroup = finding.rootCauseGroup;
  if (finding.audienceText) violation.audienceText = finding.audienceText;
  return violation;
}

export function advisorFindingViewpointBridge(
  finding: ConstructabilityFinding,
): AdvisorFindingViewpointBridge | null {
  const hintCommand = firstContextOnlyCommandHint(finding);
  const evidence = finding.viewpointEvidence ?? finding.actionability?.viewpointEvidence ?? {};
  const viewpointId = firstString(
    evidence.viewpointId,
    evidence.viewId,
    finding.viewpointRef,
    finding.actionability?.viewpointRef,
    hintCommand?.id,
  );
  const camera = firstPlainObject(evidence.camera, hintCommand?.camera);
  if (!viewpointId || !camera || !isCameraMm(camera)) return null;
  const elementIds = normalizedStringList(
    evidence.elementIds,
    finding.elementIds,
    hintCommand?.elementIds,
  );
  if (!elementIds.length) return null;
  const sectionBoxMinMm = firstPlainObject(evidence.sectionBoxMinMm, hintCommand?.sectionBoxMinMm);
  const sectionBoxMaxMm = firstPlainObject(evidence.sectionBoxMaxMm, hintCommand?.sectionBoxMaxMm);
  const bboxMm = firstPlainObject(evidence.bboxMm, hintCommand?.bboxMm);
  return {
    schemaVersion: 'advisorFindingViewpointBridge_v1',
    ruleId: finding.ruleId,
    viewId: viewpointId,
    viewpointId,
    elementIds,
    camera,
    sectionBoxEnabled:
      Boolean(evidence.sectionBoxEnabled ?? hintCommand?.sectionBoxEnabled) ||
      Boolean(sectionBoxMinMm && sectionBoxMaxMm),
    ...(sectionBoxMinMm ? { sectionBoxMinMm } : {}),
    ...(sectionBoxMaxMm ? { sectionBoxMaxMm } : {}),
    ...(bboxMm ? { bboxMm } : {}),
  };
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

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstPlainObject(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function normalizedStringList(...values: unknown[]): string[] {
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    const out = [...new Set(value.filter((item): item is string => typeof item === 'string'))]
      .map((item) => item.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (out.length) return out;
  }
  return [];
}

function isCameraMm(camera: Record<string, unknown>): boolean {
  return (
    isVec3Mm(camera.position) &&
    isVec3Mm(camera.target) &&
    (!('up' in camera) || isVec3Mm(camera.up))
  );
}

function isVec3Mm(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return [row.xMm, row.yMm, row.zMm].every((coord) => Number.isFinite(Number(coord)));
}
