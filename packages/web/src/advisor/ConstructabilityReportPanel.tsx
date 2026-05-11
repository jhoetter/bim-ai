import { useMemo, useState } from 'react';
import { Download, Focus, RefreshCw } from 'lucide-react';

import type { ConstructabilityFinding, ConstructabilityReport } from '../lib/api';

type GroupBy = 'severity' | 'rule' | 'discipline';

export type ConstructabilityFindingGroup = {
  key: string;
  label: string;
  findings: ConstructabilityFinding[];
};

export function groupConstructabilityFindings(
  findings: ConstructabilityFinding[],
  groupBy: GroupBy,
): ConstructabilityFindingGroup[] {
  const groups = new Map<string, ConstructabilityFinding[]>();
  for (const finding of findings) {
    const key =
      groupBy === 'rule'
        ? finding.ruleId
        : groupBy === 'discipline'
          ? finding.discipline || 'unassigned'
          : finding.severity || 'unknown';
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, groupedFindings]) => ({
      key,
      label: `${key} (${groupedFindings.length})`,
      findings: groupedFindings.sort(
        (a, b) =>
          a.ruleId.localeCompare(b.ruleId) ||
          (a.message || '').localeCompare(b.message || '') ||
          a.elementIds.join(',').localeCompare(b.elementIds.join(',')),
      ),
    }));
}

export function constructabilityReportJsonExport(report: ConstructabilityReport): string {
  return JSON.stringify(report, null, 2);
}

export function ConstructabilityReportPanel(props: {
  report: ConstructabilityReport | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onIsolateElementIds?: (elementIds: string[]) => void;
  onExportJson?: (payload: string) => void;
  onExportBcf?: (report: ConstructabilityReport) => void;
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>('severity');
  const groups = useMemo(
    () => groupConstructabilityFindings(props.report?.findings ?? [], groupBy),
    [props.report, groupBy],
  );

  if (!props.report) {
    return (
      <section className="space-y-3" aria-label="Constructability report">
        <Toolbar
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          onRefresh={props.onRefresh}
          refreshDisabled={props.loading}
          exportDisabled
        />
        <div className="rounded border border-border bg-surface p-3 text-xs text-muted">
          {props.error ||
            (props.loading ? 'Loading constructability report.' : 'No report loaded.')}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Constructability report">
      <Toolbar
        groupBy={groupBy}
        onGroupBy={setGroupBy}
        onRefresh={props.onRefresh}
        refreshDisabled={props.loading}
        exportDisabled={false}
        onExportJson={() => props.onExportJson?.(constructabilityReportJsonExport(props.report!))}
        onExportBcf={() => props.onExportBcf?.(props.report!)}
      />

      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <Metric label="Findings" value={props.report.summary.findingCount} />
        <Metric label="Issues" value={props.report.summary.issueCount} />
        <Metric label="Suppressed" value={props.report.summary.suppressedFindingCount ?? 0} />
        <Metric label="Profile" value={props.report.profile} />
      </div>

      {groups.length ? (
        <div className="max-h-[52vh] overflow-auto rounded border border-border">
          {groups.map((group) => (
            <section key={group.key} className="border-b border-border last:border-b-0">
              <header className="bg-muted/20 px-3 py-2 text-xs font-semibold">{group.label}</header>
              <ul className="divide-y divide-border">
                {group.findings.map((finding, index) => (
                  <li key={`${finding.ruleId}-${index}`} className="space-y-2 p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px]">
                        {finding.severity}
                      </span>
                      <code className="text-[10px] text-muted">{finding.ruleId}</code>
                      {finding.discipline ? (
                        <span className="rounded bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted">
                          {finding.discipline}
                        </span>
                      ) : null}
                    </div>
                    <p>{finding.message}</p>
                    {finding.recommendation ? (
                      <p className="text-[11px] text-muted">{finding.recommendation}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="break-all text-[10px] text-muted">
                        {finding.elementIds.join(', ')}
                      </code>
                      {finding.elementIds.length ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px]"
                          onClick={() => props.onIsolateElementIds?.(finding.elementIds)}
                        >
                          <Focus size={12} aria-hidden="true" />
                          Isolate
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded border border-border bg-surface p-3 text-xs text-muted">
          No active constructability findings.
        </div>
      )}
    </section>
  );
}

function Toolbar(props: {
  groupBy: GroupBy;
  onGroupBy: (groupBy: GroupBy) => void;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  exportDisabled: boolean;
  onExportJson?: () => void;
  onExportBcf?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="text-muted">
        Group
        <select
          className="ml-2 rounded border border-border bg-background px-2 py-1"
          value={props.groupBy}
          onChange={(event) => props.onGroupBy(event.target.value as GroupBy)}
        >
          <option value="severity">Severity</option>
          <option value="rule">Rule</option>
          <option value="discipline">Discipline</option>
        </select>
      </label>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1"
        onClick={props.onRefresh}
        disabled={props.refreshDisabled}
      >
        <RefreshCw size={12} aria-hidden="true" />
        Refresh
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1"
        onClick={props.onExportJson}
        disabled={props.exportDisabled}
      >
        <Download size={12} aria-hidden="true" />
        JSON
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1"
        onClick={props.onExportBcf}
        disabled={props.exportDisabled}
      >
        <Download size={12} aria-hidden="true" />
        BCF
      </button>
    </div>
  );
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border bg-surface p-2">
      <div className="text-[10px] uppercase text-muted">{props.label}</div>
      <div className="mt-1 truncate font-mono text-sm">{props.value}</div>
    </div>
  );
}
