import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

/**
 * FED-03: render Copy/Monitor inspector rows for an element that may carry
 * either the legacy `monitorSourceId` string or the structured
 * `monitorSource` object.
 */
export function MonitorSourceRows({
  el,
  elementsById,
  t,
  onMonitorReconcile,
}: {
  el: Extract<Element, { kind: 'level' } | { kind: 'grid_line' }>;
  elementsById: Record<string, Element>;
  t: TFunction;
  onMonitorReconcile?: (elementId: string, mode: 'accept_source' | 'keep_host') => void;
}): JSX.Element | null {
  const f = (key: string) => t(`inspector.fields.${key}`);
  const ms = el.monitorSource ?? null;
  const legacy = !ms && el.monitorSourceId ? { elementId: el.monitorSourceId } : null;
  if (!ms && !legacy) return null;

  const elementId = ms?.elementId ?? legacy?.elementId ?? '—';
  const linkId = ms?.linkId ?? null;
  const linkLabel = (() => {
    if (!linkId) return '';
    const link = elementsById[linkId];
    if (link && link.kind === 'link_model') return link.name || link.id;
    return linkId;
  })();
  const revisionAtCopy = ms?.sourceRevisionAtCopy ?? null;
  const drifted = Boolean(ms?.drifted);
  const driftedFields = ms?.driftedFields ?? [];
  const headerValue = linkLabel
    ? `${linkLabel} / ${elementId}${revisionAtCopy != null ? ` @r${revisionAtCopy}` : ''}`
    : `${elementId}${revisionAtCopy != null ? ` @r${revisionAtCopy}` : ''}`;

  return (
    <>
      <FieldRow label={f('monitorSource')} value={headerValue} mono />
      {drifted ? (
        <div
          className="flex flex-col gap-1 border-b border-border py-1.5"
          data-testid="monitor-drift-banner"
        >
          <div className="flex items-center gap-2 text-[11px] text-amber-700">
            <span aria-hidden>⚠</span>
            <span>
              {t('inspector.monitorDriftBanner', {
                fields: driftedFields.join(', ') || '—',
              })}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
              onClick={() => onMonitorReconcile?.(el.id, 'accept_source')}
            >
              {t('inspector.acceptSource')}
            </button>
            <button
              type="button"
              className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
              onClick={() => onMonitorReconcile?.(el.id, 'keep_host')}
            >
              {t('inspector.keepHost')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
