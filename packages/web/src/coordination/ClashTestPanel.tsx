import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element, ClashResult } from '@bim-ai/core';

function linkChainLabel(
  chain: string[] | undefined,
  elementsById: Record<string, Element>,
): string {
  if (!chain || chain.length === 0) return '';
  return chain
    .map((linkId) => {
      const link = elementsById[linkId];
      if (link && link.kind === 'link_model') return link.name || link.id;
      return linkId;
    })
    .join(' / ');
}

function elementLabel(
  elementId: string,
  linkChain: string[] | undefined,
  elementsById: Record<string, Element>,
  fromWord: string,
): string {
  // For linked elements the snapshot id is `<linkId>::<sourceElemId>`; show
  // the source-side id and a "from <linkName>" prefix so cross-link clashes
  // read like "STR/Beams/B-12 — from Structure".
  if (linkChain && linkChain.length > 0) {
    const sep = '::';
    const sourceId = elementId.includes(sep)
      ? elementId.slice(elementId.indexOf(sep) + sep.length)
      : elementId;
    return `${fromWord} ${linkChainLabel(linkChain, elementsById)} — ${sourceId}`;
  }
  return elementId;
}

export function ClashTestPanel({
  el,
  elements,
  onRun,
  onFlyTo,
}: {
  el: Extract<Element, { kind: 'clash_test' }>;
  elements?: Record<string, Element>;
  onRun?: (clashTestId: string) => void;
  onFlyTo?: (r: ClashResult) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const elementsById = elements ?? {};

  function runClashTest(): void {
    if (onRun) {
      onRun(el.id);
      return;
    }
    console.warn('run-clash-test stub', {
      setAIds: el.setAIds,
      setBIds: el.setBIds,
      toleranceMm: el.toleranceMm,
    });
  }

  function flyTo(r: ClashResult): void {
    if (onFlyTo) onFlyTo(r);
    else console.warn('fly-to-clash', r);
  }

  const fromWord = t('coordination.fromLink');

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
        <table
          className="w-full border-collapse text-[11px]"
          aria-label={t('coordination.clashResultsLabel')}
        >
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="text-left font-semibold text-muted">
                {t('coordination.elementA')}
              </th>
              <th scope="col" className="text-left font-semibold text-muted">
                {t('coordination.elementB')}
              </th>
              <th scope="col" className="text-left font-semibold text-muted">
                {t('coordination.distance')}
              </th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {el.results.map((r, i) => (
              <tr key={i} className="border-b border-border">
                <td className="font-mono" data-testid="clash-row-a">
                  {elementLabel(r.elementIdA, r.linkChainA, elementsById, fromWord)}
                </td>
                <td className="font-mono" data-testid="clash-row-b">
                  {elementLabel(r.elementIdB, r.linkChainB, elementsById, fromWord)}
                </td>
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
