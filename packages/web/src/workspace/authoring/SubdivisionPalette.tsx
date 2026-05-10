/**
 * TOP-V3-03 — SubdivisionPalette
 *
 * A 5-button finish-category palette drawer shown when the
 * `toposolid_subdivision` tool is active.  The active category gets the
 * `--color-accent` background.  Pressing Escape calls `onCancel`.
 *
 * Zero hex literals — all colours come from CSS custom properties.
 */

import { useEffect, useRef } from 'react';

export type SubdivisionCategory = 'paving' | 'lawn' | 'road' | 'planting' | 'other';

const CATEGORIES = [
  { id: 'paving', label: 'Paving', icon: '▦' },
  { id: 'lawn', label: 'Lawn', icon: '▩' },
  { id: 'road', label: 'Road', icon: '▬' },
  { id: 'planting', label: 'Planting', icon: '✿' },
  { id: 'other', label: 'Other', icon: '◻' },
] as const;

export interface SubdivisionPaletteProps {
  activeCategory: SubdivisionCategory;
  onSelect: (cat: SubdivisionCategory) => void;
  onCancel: () => void;
}

export function SubdivisionPalette({
  activeCategory,
  onSelect,
  onCancel,
}: SubdivisionPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Subdivision finish category"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4)',
        background: 'var(--color-surface-2, var(--color-surface-strong))',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md, 6px)',
        boxShadow: 'var(--elev-2)',
        pointerEvents: 'auto',
      }}
    >
      {CATEGORIES.map((cat) => {
        const isActive = cat.id === activeCategory;
        return (
          <button
            key={cat.id}
            type="button"
            aria-label={cat.label}
            aria-pressed={isActive}
            title={cat.label}
            onClick={() => onSelect(cat.id as SubdivisionCategory)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              width: 64,
              padding: 'var(--space-4) var(--space-2)',
              borderRadius: 'var(--radius-sm, 4px)',
              border: isActive ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: isActive ? 'var(--color-accent)' : 'var(--color-surface, transparent)',
              color: isActive
                ? 'var(--color-accent-foreground, var(--color-foreground-on-accent))'
                : 'var(--color-foreground)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm, 14px)',
              fontFamily: 'var(--font-sans)',
              fontWeight: isActive ? 600 : 400,
              transition: 'background var(--motion-fast) var(--ease-out)',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 'var(--text-lg, 18px)', lineHeight: 1 }}>
              {cat.icon}
            </span>
            <span style={{ fontSize: 'var(--text-xs, 11px)', lineHeight: 1 }}>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
