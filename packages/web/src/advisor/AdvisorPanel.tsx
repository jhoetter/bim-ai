import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PerspectiveId, Violation } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import {
  humanizeRuleId,
  sortViolationsDeterministic,
  summarizeQuickFixCommand,
  translatedContextForRuleId,
} from './advisorViolationContext';
import { filterViolationsForPerspective } from './perspectiveFilter';

type AdvisorGroupBy = 'severity' | 'category' | 'view' | 'element';

type AdvisorGroup = {
  key: string;
  label: string;
  rank: number;
  items: Violation[];
};

function violationFingerprint(v: Violation): string {
  return [v.ruleId, v.severity, v.message, (v.elementIds ?? []).join(','), v.discipline ?? ''].join(
    '|',
  );
}

function formatRuleCategory(ruleId: string): string {
  const raw = ruleId.split('_')[0] ?? 'general';
  if (!raw.trim()) return 'General';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatViewGroup(v: Violation): string {
  const rule = v.ruleId.toLowerCase();
  if (rule.startsWith('schedule_')) return 'Schedule';
  if (rule.startsWith('sheet_')) return 'Sheet';
  if (rule.includes('section') || rule.includes('elevation')) return 'Section';
  if (
    rule.includes('wall') ||
    rule.includes('room') ||
    rule.includes('opening') ||
    rule.includes('datum') ||
    rule.includes('level')
  ) {
    return 'Plan';
  }
  if (
    rule.startsWith('physical_') ||
    rule.includes('clash') ||
    rule.includes('roof') ||
    rule.includes('column') ||
    rule.includes('beam')
  ) {
    return '3D';
  }
  return 'Model-wide';
}

function formatElementGroup(v: Violation): string {
  if ((v.elementIds ?? []).length === 0) return 'No element target';
  if ((v.elementIds ?? []).length === 1) return v.elementIds![0]!;
  return `${v.elementIds![0]} (+${v.elementIds!.length - 1})`;
}

function groupRank(groupBy: AdvisorGroupBy, key: string): number {
  if (groupBy === 'severity') {
    if (key === 'error') return 0;
    if (key === 'warning') return 1;
    if (key === 'info') return 2;
  }
  if (groupBy === 'view') {
    if (key === 'Plan') return 0;
    if (key === '3D') return 1;
    if (key === 'Section') return 2;
    if (key === 'Sheet') return 3;
    if (key === 'Schedule') return 4;
    if (key === 'Model-wide') return 5;
  }
  if (groupBy === 'element' && key === 'No element target') return 99;
  return 10;
}

function groupViolations(
  violations: Violation[],
  groupBy: AdvisorGroupBy,
  t: (key: string, options?: Record<string, unknown>) => string,
): AdvisorGroup[] {
  const buckets = new Map<string, AdvisorGroup>();
  for (const violation of violations) {
    const key =
      groupBy === 'severity'
        ? violation.severity
        : groupBy === 'category'
          ? formatRuleCategory(violation.ruleId)
          : groupBy === 'view'
            ? formatViewGroup(violation)
            : formatElementGroup(violation);
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(violation);
      continue;
    }
    const label =
      groupBy === 'severity' ? t(`violation.severity.${key}`, { defaultValue: key }) : key;
    buckets.set(key, {
      key,
      label,
      rank: groupRank(groupBy, key),
      items: [violation],
    });
  }

  return [...buckets.values()]
    .map((group) => ({
      ...group,
      label: `${group.label} (${group.items.length})`,
      items: sortViolationsDeterministic(group.items),
    }))
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
}

function toTestIdPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function AdvisorPanel(props: {
  violations: Violation[];
  selectionId?: string;
  preset: string;
  onPreset: (preset: string) => void;
  codePresets?: string[];
  onApplyQuickFix(cmd: Record<string, unknown>): void;
  perspective: PerspectiveId;
  showAllPerspectives?: boolean;
  onNavigateToElement?: (elementId: string) => void;
}) {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState<AdvisorGroupBy>('severity');
  const [ignoredFingerprints, setIgnoredFingerprints] = useState<Set<string>>(new Set());
  const scoped = props.selectionId
    ? props.violations.filter((v) => (v.elementIds ?? []).includes(props.selectionId!))
    : props.violations;

  const filtered = props.showAllPerspectives
    ? scoped
    : filterViolationsForPerspective(scoped, props.perspective);
  const sorted = useMemo(() => sortViolationsDeterministic(filtered), [filtered]);
  const visible = useMemo(
    () => sorted.filter((v) => !ignoredFingerprints.has(violationFingerprint(v))),
    [ignoredFingerprints, sorted],
  );
  const grouped = useMemo(() => groupViolations(visible, groupBy, t), [visible, groupBy, t]);
  const presetKeys = props.codePresets ?? ['residential', 'commercial', 'office'];
  const ignoredCount = sorted.length - visible.length;

  function ignoreViolation(violation: Violation) {
    const fingerprint = violationFingerprint(violation);
    setIgnoredFingerprints((previous) => {
      if (previous.has(fingerprint)) return previous;
      const next = new Set(previous);
      next.add(fingerprint);
      return next;
    });
  }

  function renderViolationCard(v: Violation, i: number) {
    const qf =
      v.quickFixCommand && typeof v.quickFixCommand === 'object'
        ? summarizeQuickFixCommand(v.quickFixCommand as Record<string, unknown>)
        : null;
    const ctx = translatedContextForRuleId(v.ruleId, t);
    const title = t(`violation.title.${v.ruleId}`, {
      defaultValue: humanizeRuleId(v.ruleId),
    });
    const severityLabel = t(`violation.severity.${v.severity}`, { defaultValue: v.severity });
    const fingerprint = violationFingerprint(v);

    return (
      <li key={`${v.ruleId}-${i}-${v.message.slice(0, 24)}`} className="rounded border p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-[10px] ${v.blocking ? 'bg-red-500/25' : 'bg-amber-500/15'}`}
          >
            {severityLabel}
          </span>
          <span className="font-mono text-[10px] text-muted">{v.ruleId}</span>
          {v.discipline ? (
            <span className="rounded bg-muted/30 px-1 py-0.5 text-[9px] text-muted">
              {t(`perspective.${v.discipline}`, { defaultValue: v.discipline })}
            </span>
          ) : null}
        </div>

        <div className="mt-1 font-medium">{title}</div>
        <div className="mt-0.5 text-[10px] text-muted">{v.message}</div>

        <p className="mt-1 text-[10px] text-muted">{ctx}</p>

        {(v.elementIds?.length ?? 0) > 0 ? (
          <div className="mt-1 text-[10px]">
            <span className="text-muted">elementIds: </span>
            <code className="break-all text-[10px]">{(v.elementIds ?? []).join(', ')}</code>
            {props.onNavigateToElement ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {(v.elementIds ?? []).map((elementId) => (
                  <Btn
                    key={elementId}
                    type="button"
                    className="px-2 py-0.5 text-[10px]"
                    variant="quiet"
                    data-testid={`advisor-navigate-${elementId}`}
                    onClick={() => props.onNavigateToElement?.(elementId)}
                  >
                    Open {elementId}
                  </Btn>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {qf ? (
          <div className="mt-2 rounded border border-border/50 bg-muted/5 p-2">
            <div className="text-[9px] font-semibold text-muted">
              {t('advisor.quickFixSummary')}
            </div>
            <ul className="mt-1 list-inside list-disc font-mono text-[9px] text-muted">
              {qf.map((line) => (
                <li key={line} className="break-all">
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[9px] text-muted">{t('advisor.quickFixDisclaimer')}</p>
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {v.quickFixCommand && typeof v.quickFixCommand === 'object' ? (
            <Btn
              type="button"
              className="px-3 py-1 text-[11px]"
              variant="quiet"
              onClick={() => props.onApplyQuickFix(v.quickFixCommand as Record<string, unknown>)}
            >
              {t('advisor.applyFix')}
            </Btn>
          ) : null}
          <Btn
            type="button"
            className="px-2 py-1 text-[10px]"
            variant="quiet"
            data-testid={`advisor-ignore-${toTestIdPart(fingerprint)}`}
            onClick={() => ignoreViolation(v)}
          >
            Ignore
          </Btn>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-muted">{t('advisor.codePreset')}</span>
        <select
          value={props.preset}
          aria-label={t('advisor.codePreset')}
          onChange={(e) => props.onPreset(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1"
        >
          {presetKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        <span className="text-muted">{t('advisor.perspective')}</span>
        <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px]">
          {t(`perspective.${props.perspective}`, { defaultValue: props.perspective })}
        </span>

        <label className="flex items-center gap-2">
          <span className="text-muted">Group</span>
          <select
            value={groupBy}
            data-testid="advisor-group-by"
            aria-label="Advisor group by"
            onChange={(e) => setGroupBy(e.target.value as AdvisorGroupBy)}
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="severity">Severity</option>
            <option value="category">Category</option>
            <option value="view">View</option>
            <option value="element">Element</option>
          </select>
        </label>

        {ignoredCount > 0 ? (
          <>
            <span data-testid="advisor-ignored-summary" className="rounded border px-2 py-0.5">
              Ignored {ignoredCount}
            </span>
            <Btn
              type="button"
              className="px-2 py-1 text-[10px]"
              variant="quiet"
              data-testid="advisor-reset-ignored"
              onClick={() => setIgnoredFingerprints(new Set())}
            >
              Restore
            </Btn>
          </>
        ) : null}
      </div>

      {grouped.length ? (
        <div className="max-h-[40vh] space-y-3 overflow-auto text-xs">
          {grouped.map((g) => (
            <div key={g.key}>
              <div
                className="mb-1 text-[10px] font-semibold uppercase text-muted"
                data-testid={`advisor-group-${toTestIdPart(g.key)}`}
              >
                {g.label}
              </div>
              <ul className="space-y-2">{g.items.map((v, i) => renderViolationCard(v, i))}</ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded border bg-surface p-4 text-[11px] text-muted">
          {props.selectionId ? t('advisor.emptySelection') : t('advisor.emptyGeneral')}
        </div>
      )}
    </div>
  );
}
