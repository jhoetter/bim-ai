import { type JSX, type KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import { CHEATSHEET, filterCheatsheet } from './cheatsheetData';

/**
 * Cheatsheet modal — spec §19.
 *
 * Opens when the user presses `?` (or Shift + /) — open/close ownership
 * is the caller's; this component just renders the sheet when `open` is
 * true. `Escape` closes; section filtering is keyboard-accessible.
 */

export interface CheatsheetModalProps {
  open: boolean;
  onClose: () => void;
}

export function CheatsheetModal({ open, onClose }: CheatsheetModalProps): JSX.Element | null {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const handleBackdropKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;
  const sections = filterCheatsheet(query);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard cheatsheet"
      data-testid="cheatsheet-modal"
      onKeyDown={handleBackdropKey}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8, 12, 20, 0.42)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-elev-3"
        style={{ minWidth: 480 }}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Icons.commandPalette
            size={ICON_SIZE.toolPalette}
            aria-hidden="true"
            className="text-muted"
          />
          <h2 className="flex-1 text-md font-medium text-foreground">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cheatsheet"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-strong"
          >
            <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
          </button>
        </div>
        <div className="border-b border-border px-4 py-2">
          <input
            type="search"
            placeholder="Filter shortcuts (e.g. wall, mode, undo)"
            aria-label="Filter shortcuts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {sections.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No shortcuts match.</p>
          ) : (
            sections.map((section) => (
              <div key={section.id} className="mb-4">
                <div
                  className="mb-2 text-xs uppercase text-muted"
                  style={{ letterSpacing: 'var(--text-eyebrow-tracking)' }}
                >
                  {section.label}
                </div>
                <ul className="flex flex-col gap-1">
                  {section.entries.map((entry) => (
                    <li
                      key={`${section.id}:${entry.action}:${entry.keys}`}
                      className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-surface-strong"
                    >
                      <span className="text-sm text-foreground">{entry.action}</span>
                      <kbd className="rounded-sm border border-border bg-background px-2 py-0.5 font-mono text-xs text-muted">
                        {entry.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border bg-surface-muted px-4 py-2 text-xs text-muted">
          {CHEATSHEET.flatMap((s) => s.entries).length} shortcuts · Esc to close
        </div>
      </div>
    </div>
  );
}
