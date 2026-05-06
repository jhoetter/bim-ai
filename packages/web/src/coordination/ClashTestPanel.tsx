import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element, ClashResult } from '@bim-ai/core';

export function ClashTestPanel({
  el,
}: {
  el: Extract<Element, { kind: 'clash_test' }>;
}): JSX.Element {
  const { t } = useTranslation();

  function runClashTest(): void {
    console.warn('run-clash-test stub', {
      setAIds: el.setAIds,
      setBIds: el.setBIds,
      toleranceMm: el.toleranceMm,
    });
  }

  function flyTo(r: ClashResult): void {
    console.warn('fly-to-clash', r);
  }

  return (
    <div className="flex flex-col gap-2 text-[11px]">
      <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
        <span className="text-xs text-muted">{t('coordination.setA')}</span>
        <span className="text-sm text-foreground">{el.setAIds.length}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
        <span className="text-xs text-muted">{t('coordination.setB')}</span>
        <span className="text-sm text-foreground">{el.setBIds.length}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
        <span className="text-xs text-muted">{t('coordination.toleranceMm')}</span>
        <span className="text-sm text-foreground">{el.toleranceMm} mm</span>
      </div>
      <button
        type="button"
        onClick={runClashTest}
        className="self-start rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-surface-strong"
      >
        {t('coordination.runClashTest')}
      </button>
      {el.results?.length ? (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-semibold text-muted">{t('coordination.elementA')}</th>
              <th className="text-left font-semibold text-muted">{t('coordination.elementB')}</th>
              <th className="text-left font-semibold text-muted">{t('coordination.distance')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {el.results.map((r, i) => (
              <tr key={i} className="border-b border-border">
                <td className="font-mono">{r.elementIdA}</td>
                <td className="font-mono">{r.elementIdB}</td>
                <td>{r.distanceMm.toFixed(1)} mm</td>
                <td>
                  <button
                    type="button"
                    onClick={() => flyTo(r)}
                    className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
                  >
                    {t('coordination.flyTo')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
