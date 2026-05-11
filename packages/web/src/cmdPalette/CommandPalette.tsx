import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  queryPalette,
  getRegistry,
  type PaletteCategory,
  type PaletteContext,
  type PaletteEntry,
} from './registry';
import { paletteRecencyScopeForCommand, usePaletteRecencyStore } from './paletteRecencyStore';

export type CommandPaletteProps = {
  isOpen: boolean;
  onClose: () => void;
  context: PaletteContext;
};

const CATEGORY_LABELS: Record<PaletteCategory, string> = {
  command: 'Commands',
  navigate: 'Navigate',
  select: 'Select',
};

type PaletteSection = {
  key: string;
  label: string;
  items: PaletteEntry[];
};

function fallbackSectionLabel(category: PaletteCategory): string {
  return CATEGORY_LABELS[category];
}

function contextSectionLabel(entry: PaletteEntry): string {
  if (entry.disabledReason) return 'Unavailable';
  return entry.badge ?? fallbackSectionLabel(entry.category);
}

function sectionKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'commands'
  );
}

export function CommandPalette({
  isOpen,
  onClose,
  context,
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const invocations = usePaletteRecencyStore((s) => s.invocations);
  const recordInvocation = usePaletteRecencyStore((s) => s.recordInvocation);
  const getRecencyScore = usePaletteRecencyStore((s) => s.getRecencyScore);

  const nowRef = useRef(0);
  useEffect(() => {
    nowRef.current = Date.now();
  }, [invocations]);

  const recencyMap = useMemo<Record<string, number>>(() => {
    const now = nowRef.current;
    const map: Record<string, number> = {};
    const ids = new Set<string>(getRegistry().map((entry) => entry.id));
    for (const view of context.views ?? []) {
      ids.add(`view.${view.id}`);
    }
    for (const template of context.planTemplates ?? []) {
      ids.add(`view-template.apply.${template.id}`);
    }
    for (const id of ids) {
      map[id] = getRecencyScore(id, paletteRecencyScopeForCommand(id, context), now);
    }
    return map;
  }, [context, invocations, getRecencyScore]);

  const results = useMemo(
    () => queryPalette(query, context, recencyMap),
    [query, context, recencyMap],
  );

  const sections = useMemo<PaletteSection[]>(() => {
    const grouped = new Map<string, PaletteSection>();
    for (const entry of results) {
      const label = contextSectionLabel(entry);
      const key = sectionKey(label);
      const section = grouped.get(key) ?? { key, label, items: [] };
      section.items.push(entry);
      grouped.set(key, section);
    }
    return Array.from(grouped.values());
  }, [results]);

  const flatEntries = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, flatEntries.length - 1)));
  }, [flatEntries.length]);

  const invoke = useCallback(
    (entry: PaletteEntry) => {
      if (entry.disabledReason) return;
      recordInvocation(entry.id, paletteRecencyScopeForCommand(entry.id, context));
      entry.invoke(context);
      onClose();
    },
    [context, onClose, recordInvocation],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatEntries.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const entry = flatEntries[activeIndex];
        if (entry) invoke(entry);
      }
    },
    [activeIndex, flatEntries, invoke, onClose],
  );

  if (!isOpen) return null;

  let globalIdx = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-testid="cmd-palette-v3"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 96,
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 480,
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-card, 4px)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--elev-3)',
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyDown}
      >
        <div
          className="focus-within:ring-1 focus-within:ring-accent/40 focus-within:ring-inset"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command…"
            aria-label="Command palette search"
            aria-autocomplete="list"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 'var(--text-base, 14px)',
              color: 'var(--color-foreground)',
            }}
          />
          <kbd
            style={{
              padding: '2px 6px',
              borderRadius: 'var(--radius-card, 4px)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-background)',
              fontFamily: 'monospace',
              fontSize: 11,
              color: 'var(--color-muted)',
            }}
          >
            Esc
          </kbd>
        </div>

        <div
          role="listbox"
          aria-label="Commands"
          style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}
        >
          {flatEntries.length === 0 ? (
            <div
              style={{
                padding: '12px 16px',
                fontSize: 'var(--text-sm, 12px)',
                color: 'var(--color-muted)',
              }}
            >
              No matches
            </div>
          ) : (
            sections.map(({ key, label, items }) => (
              <div key={key} data-testid={`cmd-palette-section-${key}`}>
                <div
                  style={{
                    padding: '4px 12px 2px',
                    fontSize: 'var(--text-2xs, 10px)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-muted)',
                  }}
                >
                  {label}
                </div>
                {items.map((entry) => {
                  const idx = globalIdx++;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-testid={`palette-entry-${entry.id}`}
                      disabled={Boolean(entry.disabledReason)}
                      title={entry.disabledReason ?? entry.label}
                      onClick={() => invoke(entry)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        fontSize: 'var(--text-sm, 12px)',
                        color: entry.disabledReason
                          ? 'var(--color-muted)'
                          : 'var(--color-foreground)',
                        background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                        border: 'none',
                        cursor: entry.disabledReason ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        opacity: entry.disabledReason ? 0.6 : 1,
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span>{entry.label}</span>
                        {entry.disabledReason ? (
                          <span
                            style={{
                              display: 'block',
                              marginTop: 2,
                              fontSize: 10,
                              color: 'var(--color-muted)',
                            }}
                          >
                            {entry.disabledReason}
                          </span>
                        ) : null}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {entry.badge ? (
                          <span
                            data-testid={`palette-entry-badge-${entry.id}`}
                            style={{
                              borderRadius: 'var(--radius-card, 4px)',
                              border: '1px solid var(--color-border)',
                              padding: '1px 5px',
                              fontSize: 10,
                              color: entry.bridged ? 'var(--color-accent)' : 'var(--color-muted)',
                              background: 'var(--color-background)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.badge}
                          </span>
                        ) : null}
                        {entry.shortcut ? (
                          <kbd
                            style={{
                              padding: '1px 5px',
                              borderRadius: 'var(--radius-card, 4px)',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-background)',
                              fontFamily: 'monospace',
                              fontSize: 10,
                              color: 'var(--color-muted)',
                              flexShrink: 0,
                            }}
                          >
                            {entry.shortcut}
                          </kbd>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface-muted)',
            fontSize: 'var(--text-2xs, 10px)',
            color: 'var(--color-muted)',
          }}
        >
          ↑↓ navigate · Enter invoke · Esc close
        </div>
      </div>
    </div>
  );
}
