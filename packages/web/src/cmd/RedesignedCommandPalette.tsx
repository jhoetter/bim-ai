import { Command } from 'cmdk';
import { type JSX, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import {
  EMPTY_STATE_HINTS,
  parseQuery,
  rankCandidates,
  type CommandCandidate,
} from './commandPaletteSources';

/**
 * Redesigned command palette — spec §18.
 *
 * Wraps cmdk with the `commandPaletteSources` aggregator so the spec'd
 * `>`, `@`, `:` prefix grammar drives source filtering, and recent-id
 * boost lifts repeat actions to the top.
 *
 * Visual layout matches §18: 560 px wide, --radius-xl, --elev-3 shadow,
 * empty-state shows the top 5 keyboard hints.
 */

export interface RedesignedCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aggregated source list. The component is purely presentational —
   * callers compose tools / views / elements / settings / agent actions
   * into a flat candidate array. */
  candidates: CommandCandidate[];
  /** Recent action ids (most recent first). Capped at 5 internally. */
  recentIds?: string[];
  /** Invoked when the user picks a candidate (`Enter` or click). */
  onPick: (candidate: CommandCandidate) => void;
}

export function RedesignedCommandPalette({
  open,
  onOpenChange,
  candidates,
  recentIds,
  onPick,
}: RedesignedCommandPaletteProps): JSX.Element | null {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const ranked = useMemo(() => {
    const parsed = parseQuery(query);
    return rankCandidates(candidates, parsed, { recentIds });
  }, [candidates, query, recentIds]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('cmd.ariaLabel')}
      data-testid="command-palette"
      className="fixed inset-0 z-[60] flex items-start justify-center pt-24"
      style={{ background: 'rgba(8, 12, 20, 0.42)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-3"
        style={{ width: 560, maxHeight: '60vh', display: 'flex', flexDirection: 'column' }}
      >
        <Command label={t('cmd.commandsLabel')} shouldFilter={false} className="flex flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Icons.commandPalette
              size={ICON_SIZE.toolPalette}
              aria-hidden="true"
              className="text-muted"
            />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={t('cmd.placeholder')}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t('cmd.closeAriaLabel')}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-strong"
            >
              <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
            </button>
          </div>
          <Command.List className="flex-1 overflow-y-auto px-2 py-2">
            {query === '' ? <EmptyHints /> : null}
            <Command.Empty className="px-3 py-3 text-sm text-muted">{t('cmd.noMatches')}</Command.Empty>
            {query !== '' && ranked.length > 0 ? (
              <Command.Group heading={t('cmd.resultsGroup')}>
                {ranked.map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`${r.id} ${r.label} ${r.keywords ?? ''}`}
                    onSelect={() => {
                      onPick(r);
                      onOpenChange(false);
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-1.5 text-sm hover:bg-accent-soft data-[selected=true]:bg-accent-soft"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted"
                      >
                        {r.kind}
                      </span>
                      <span>{r.label}</span>
                    </span>
                    {r.hint ? (
                      <kbd className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted">
                        {r.hint}
                      </kbd>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
          <div className="border-t border-border bg-surface-muted px-3 py-1.5 text-xs text-muted">
            {t('cmd.footer')}
          </div>
        </Command>
      </div>
    </div>
  );
}

function EmptyHints(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="px-3 py-2">
      <div
        className="mb-2 text-xs uppercase text-muted"
        style={{ letterSpacing: 'var(--text-eyebrow-tracking)' }}
      >
        {t('cmd.emptyHintsHeader')}
      </div>
      <ul className="flex flex-col gap-1">
        {EMPTY_STATE_HINTS.map((h) => (
          <li
            key={h.label}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-xs text-foreground"
          >
            <span>{h.label}</span>
            <kbd className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted">
              {h.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}
