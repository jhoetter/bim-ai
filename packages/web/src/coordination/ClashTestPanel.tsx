import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element, ClashResult } from '@bim-ai/core';

type Discipline = 'arch' | 'struct' | 'mep';
type ClashDisciplineFilter = 'all' | 'arch-struct' | 'arch-mep' | 'struct-mep';

const FILTERS: Array<{
  id: ClashDisciplineFilter;
  label: string;
  pair?: [Discipline, Discipline];
}> = [
  { id: 'arch-struct', label: 'Arch ↔ Struct', pair: ['arch', 'struct'] },
  { id: 'arch-mep', label: 'Arch ↔ MEP', pair: ['arch', 'mep'] },
  { id: 'struct-mep', label: 'Struct ↔ MEP', pair: ['struct', 'mep'] },
  { id: 'all', label: 'All' },
];

function defaultDisciplineForKind(kind: string | undefined): Discipline {
  if (kind === 'column' || kind === 'beam' || kind === 'brace' || kind === 'foundation') {
    return 'struct';
  }
  if (kind === 'duct' || kind === 'pipe' || kind === 'outlet') return 'mep';
  return 'arch';
}

function disciplineForElementId(
  elementId: string,
  elementsById: Record<string, Element>,
): Discipline {
  const hostId = elementId.includes('::')
    ? elementId.slice(elementId.indexOf('::') + 2)
    : elementId;
  const el = elementsById[elementId] ?? elementsById[hostId];
  const raw = (el as { discipline?: unknown } | undefined)?.discipline;
  return raw === 'struct' || raw === 'mep' || raw === 'arch'
    ? raw
    : defaultDisciplineForKind(el?.kind);
}

function pairKey(a: Discipline, b: Discipline): ClashDisciplineFilter {
  const sorted = [a, b].sort().join('-');
  if (sorted === 'arch-struct') return 'arch-struct';
  if (sorted === 'arch-mep') return 'arch-mep';
  if (sorted === 'mep-struct') return 'struct-mep';
  return 'all';
}

export function clashDisciplinePair(
  result: ClashResult,
  elementsById: Record<string, Element>,
): ClashDisciplineFilter {
  return pairKey(
    disciplineForElementId(result.elementIdA, elementsById),
    disciplineForElementId(result.elementIdB, elementsById),
  );
}

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
  activeFilter = 'all',
  onFilterChange,
}: {
  el: Extract<Element, { kind: 'clash_test' }>;
  elements?: Record<string, Element>;
  onRun?: (clashTestId: string) => void;
  onFlyTo?: (r: ClashResult) => void;
  activeFilter?: ClashDisciplineFilter;
  onFilterChange?: (filter: ClashDisciplineFilter) => void;
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
  const results = el.results ?? [];
  const counts = FILTERS.reduce(
    (acc, filter) => {
      acc[filter.id] =
        filter.id === 'all'
          ? results.length
          : results.filter((r) => clashDisciplinePair(r, elementsById) === filter.id).length;
      return acc;
    },
    {} as Record<ClashDisciplineFilter, number>,
  );
  const visibleResults =
    activeFilter === 'all'
      ? results
      : results.filter((r) => clashDisciplinePair(r, elementsById) === activeFilter);

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
      {results.length ? (
        <div className="flex flex-wrap gap-1" data-testid="clash-discipline-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              data-testid={`clash-filter-${f.id}`}
              onClick={() => onFilterChange?.(f.id)}
              className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
              style={{
                borderLeft:
                  f.id === activeFilter ? '3px solid var(--color-accent)' : '3px solid transparent',
              }}
            >
              {f.label} ({counts[f.id]})
            </button>
          ))}
        </div>
      ) : null}
      {visibleResults.length ? (
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
            {visibleResults.map((r, i) => {
              const pair = clashDisciplinePair(r, elementsById);
              return (
                <tr key={i} className="border-b border-border" data-testid={`clash-row-${pair}`}>
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
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
