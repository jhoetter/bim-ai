import type { ConstructabilityReport } from '../lib/api';

export type ConstructabilityReportSummary = {
  heading: string;
  lines: string[];
  hasFindings: boolean;
};

export function summarizeConstructabilityReport(
  report: ConstructabilityReport | null | undefined,
): ConstructabilityReportSummary {
  if (!report || report.format !== 'constructabilityReport_v1') {
    return { heading: 'Constructability', lines: [], hasFindings: false };
  }

  const findingCount = finiteCount(report.summary?.findingCount);
  const issueCount = finiteCount(report.summary?.issueCount);
  const severity = sortedCounts(report.summary?.severityCounts);
  const statuses = sortedCounts(report.summary?.statusCounts);
  const topRules = Object.entries(report.summary?.ruleCounts ?? {})
    .filter(([, count]) => Number.isFinite(count))
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([rule, count]) => `${rule}:${count}`);

  const lines = [
    `profile:${report.profile || 'unknown'} revision:${String(report.revision)}`,
    `findings:${findingCount} issues:${issueCount}`,
  ];
  if (severity) lines.push(`severity:${severity}`);
  if (statuses) lines.push(`status:${statuses}`);
  if (topRules.length) lines.push(`top_rules:${topRules.join(',')}`);

  return {
    heading: 'Constructability',
    lines,
    hasFindings: findingCount > 0,
  };
}

function finiteCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function sortedCounts(raw: Record<string, number> | undefined): string {
  const parts = Object.entries(raw ?? {})
    .filter(([, count]) => Number.isFinite(count))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => `${key}:${count}`);
  return parts.join(',');
}
