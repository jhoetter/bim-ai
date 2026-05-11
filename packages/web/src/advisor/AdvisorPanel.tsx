import { useTranslation } from 'react-i18next';

import type { PerspectiveId, Violation } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import {
  groupViolationsBySeverity,
  humanizeRuleId,
  sortViolationsDeterministic,
  summarizeQuickFixCommand,
  translatedContextForRuleId,
} from './advisorViolationContext';
import { filterViolationsForPerspective } from './perspectiveFilter';

export function AdvisorPanel(props: {
  violations: Violation[];
  selectionId?: string;
  preset: string;
  onPreset: (preset: string) => void;
  codePresets?: string[];
  onApplyQuickFix(cmd: Record<string, unknown>): void;
  perspective: PerspectiveId;
  showAllPerspectives?: boolean;
}) {
  const { t } = useTranslation();
  const scoped = props.selectionId
    ? props.violations.filter((v) => (v.elementIds ?? []).includes(props.selectionId!))
    : props.violations;

  const filtered = props.showAllPerspectives
    ? scoped
    : filterViolationsForPerspective(scoped, props.perspective);
  const sorted = sortViolationsDeterministic(filtered);
  const grouped = groupViolationsBySeverity(sorted);
  const presetKeys = props.codePresets ?? ['residential', 'commercial', 'office'];

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

        {v.quickFixCommand && typeof v.quickFixCommand === 'object' ? (
          <Btn
            type="button"
            className="mt-2 px-3 py-1 text-[11px]"
            variant="quiet"
            onClick={() => props.onApplyQuickFix(v.quickFixCommand as Record<string, unknown>)}
          >
            {t('advisor.applyFix')}
          </Btn>
        ) : null}
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
      </div>

      {grouped.length ? (
        <div className="max-h-[40vh] space-y-3 overflow-auto text-xs">
          {grouped.map((g) => (
            <div key={g.severity}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {t(`violation.severity.${g.severity}`, { defaultValue: g.severity })}
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
