import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { AssetLibraryEntry, AssetCategory } from '@bim-ai/core';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import { AssetCard } from './AssetCard';
import { AssetPreviewPane } from './AssetPreviewPane';

const CATEGORIES: { key: AssetCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'furniture', label: 'Furniture' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'bathroom', label: 'Bathroom' },
  { key: 'door', label: 'Doors' },
  { key: 'window', label: 'Windows' },
  { key: 'casework', label: 'Casework' },
  { key: 'decal', label: 'Decals' },
  { key: 'profile', label: 'Profiles' },
];

type DisciplineFilter = 'arch' | 'struct' | 'mep';

const DISCIPLINE_FILTERS: { key: DisciplineFilter; label: string; token: string; soft: string }[] =
  [
    { key: 'arch', label: 'Arch', token: 'var(--disc-arch)', soft: 'var(--disc-arch-soft)' },
    {
      key: 'struct',
      label: 'Struct',
      token: 'var(--disc-struct)',
      soft: 'var(--disc-struct-soft)',
    },
    { key: 'mep', label: 'MEP', token: 'var(--disc-mep)', soft: 'var(--disc-mep-soft)' },
  ];

function disciplineSetFromLens(
  activeDiscipline?: DisciplineFilter | 'all' | null,
): Set<DisciplineFilter> {
  if (!activeDiscipline || activeDiscipline === 'all') return new Set();
  return new Set([activeDiscipline]);
}

function entryMatchesDiscipline(
  entry: AssetLibraryEntry,
  activeDisciplines: Set<DisciplineFilter>,
): boolean {
  if (activeDisciplines.size === 0) return true;
  const tags = entry.disciplineTags ?? [];
  return tags.some((tag) => activeDisciplines.has(tag as DisciplineFilter));
}

/** Token-based client-side fuzzy filter (mirrors the Python backend logic). */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function matchesQuery(entry: AssetLibraryEntry, queryTokens: string[]): boolean {
  if (queryTokens.length === 0) return true;
  const corpus = new Set([
    ...tokenize(entry.name),
    ...(entry.description ? tokenize(entry.description) : []),
    ...entry.tags.flatMap((t) => tokenize(t)),
  ]);
  return queryTokens.some((qt) => {
    for (const ct of corpus) {
      if (ct === qt || ct.startsWith(qt)) return true;
    }
    return false;
  });
}

type LibraryOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  entries: AssetLibraryEntry[];
  activeDiscipline?: DisciplineFilter | 'all' | null;
  /** Called when the user confirms placement (drag or Place button). */
  onPlace: (entry: AssetLibraryEntry, paramValues: Record<string, unknown>) => void;
};

export function LibraryOverlay({
  isOpen,
  onClose,
  entries,
  activeDiscipline,
  onPlace,
}: LibraryOverlayProps): ReactElement {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AssetCategory | 'all'>('all');
  const [disciplines, setDisciplines] = useState<Set<DisciplineFilter>>(() =>
    disciplineSetFromLens(activeDiscipline),
  );
  const [selected, setSelected] = useState<AssetLibraryEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search field when opened (keyboard flow: Alt+2 → type query → Enter → click)
  useEffect(() => {
    if (isOpen) {
      setDisciplines(disciplineSetFromLens(activeDiscipline));
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSelected(null);
    }
  }, [isOpen, activeDiscipline]);

  // Esc closes the drawer without blocking canvas editing
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  const queryTokens = useMemo(() => tokenize(query), [query]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (!entryMatchesDiscipline(e, disciplines)) return false;
      return matchesQuery(e, queryTokens);
    });
  }, [entries, category, disciplines, queryTokens]);

  const handlePlace = useCallback(
    (entry: AssetLibraryEntry, paramValues: Record<string, unknown>) => {
      onPlace(entry, paramValues);
      onClose();
    },
    [onPlace, onClose],
  );

  return (
    <>
      {/* Canvas dim — faint, non-blocking (drawer is contextual, not modal — D8) */}
      <div
        data-testid="library-overlay-dim"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--color-canvas-paper)',
          opacity: isOpen ? 0.15 : 0,
          pointerEvents: 'none',
          transition: 'opacity 180ms ease',
          zIndex: 40,
        }}
      />

      {/* Drawer — slides in from left, does NOT block canvas editing */}
      <div
        role="dialog"
        aria-label="Asset Library"
        aria-modal={false}
        data-testid="library-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 540,
          display: 'flex',
          flexDirection: 'row',
          background: 'var(--color-surface-strong)',
          borderRight: '1px solid var(--color-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 200ms ease',
          zIndex: 50,
          overflow: 'hidden',
        }}
      >
        {/* Left rail — category facets + discipline filter */}
        <div
          data-testid="library-left-rail"
          style={{
            width: 128,
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '12px 0',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '0 12px 8px',
            }}
          >
            Category
          </div>
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              data-testid={`category-facet-${key}`}
              onClick={() => setCategory(key)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '5px 12px',
                fontSize: 'var(--text-xs)',
                color: category === key ? 'var(--color-accent)' : 'var(--color-foreground)',
                background: category === key ? 'var(--color-accent-soft)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderLeft:
                  category === key ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
            >
              {label}
            </button>
          ))}

          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '16px 12px 8px',
            }}
          >
            Discipline
          </div>
          {disciplines.size > 0 ? (
            <button
              type="button"
              data-testid="discipline-filter-clear"
              onClick={() => setDisciplines(new Set())}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '5px 12px',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-muted-foreground)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          ) : null}
          {DISCIPLINE_FILTERS.map(({ key, label, token, soft }) => {
            const active = disciplines.has(key);
            return (
              <button
                key={key}
                type="button"
                data-testid={`discipline-filter-${key}`}
                onClick={() =>
                  setDisciplines((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '5px 12px',
                  fontSize: 'var(--text-xs)',
                  color: active ? token : 'var(--color-foreground)',
                  background: active ? soft : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderLeft: active ? `2px solid ${token}` : '2px solid transparent',
                }}
              >
                {label}
              </button>
            );
          })}

          {/* Libraries heading + Built-in entry (AST-V3-02 subscription backend is wave-7) */}
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '16px 12px 8px',
            }}
          >
            Libraries
          </div>
          <ul
            data-testid="library-subscriptions-list"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            <li
              style={{
                padding: '5px 12px',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-foreground)',
              }}
            >
              Built-in
            </li>
          </ul>
        </div>

        {/* Centre — search + card grid */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {/* Header: title + close */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--color-foreground)',
              }}
            >
              Library
            </span>
            <button
              type="button"
              aria-label="Close library"
              data-testid="library-close-btn"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-muted)',
                cursor: 'pointer',
                lineHeight: 1,
                padding: 4,
              }}
            >
              <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '8px 12px', flexShrink: 0 }}>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search assets…"
              aria-label="Search assets"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="library-search-input"
              className="focus:ring-1 focus:ring-accent/40"
              style={{
                width: '100%',
                background: 'var(--color-surface-strong)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                color: 'var(--color-foreground)',
                fontSize: 'var(--text-xs)',
                padding: '5px 8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Card grid */}
          <div
            data-testid="library-card-grid"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 12px 12px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
              gap: 8,
              alignContent: 'start',
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: 'var(--color-muted)',
                  fontSize: 'var(--text-xs)',
                  padding: 24,
                }}
              >
                No assets found
              </div>
            ) : (
              filtered.map((entry) => (
                <AssetCard
                  key={entry.id}
                  entry={entry}
                  selected={selected?.id === entry.id}
                  onSelect={setSelected}
                  onPlace={(e) => handlePlace(e, {})}
                />
              ))
            )}
          </div>
        </div>

        {/* Right edge — preview pane */}
        <div
          data-testid="library-preview-pane"
          style={{
            width: 160,
            borderLeft: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <AssetPreviewPane entry={selected} onPlace={handlePlace} />
        </div>
      </div>
    </>
  );
}
