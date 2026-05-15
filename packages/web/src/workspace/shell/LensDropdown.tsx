import { type JSX, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { LensMode } from '@bim-ai/core';
import { LENS_ORDER, lensLabel } from '../lensUx';

const LENS_CYCLE = LENS_ORDER;
type LensCycleMode = (typeof LENS_CYCLE)[number];

const DISC_SOFT: Partial<Record<LensMode, string>> = {
  architecture: 'var(--disc-arch-soft)',
  structure: 'var(--disc-struct-soft)',
  mep: 'var(--disc-mep-soft)',
  coordination: 'color-mix(in srgb, var(--color-drift, var(--color-warning)) 20%, transparent)',
  'fire-safety': 'color-mix(in srgb, var(--color-danger) 22%, transparent)',
  energy: 'color-mix(in srgb, var(--color-success) 24%, transparent)',
  construction: 'color-mix(in srgb, var(--draft-construction-blue) 24%, transparent)',
  sustainability: 'color-mix(in srgb, var(--color-success) 18%, transparent)',
  'cost-quantity': 'color-mix(in srgb, var(--color-warning) 24%, transparent)',
};

const DISC_SOLID: Partial<Record<LensMode, string>> = {
  architecture: 'var(--disc-arch)',
  structure: 'var(--disc-struct)',
  mep: 'var(--disc-mep)',
  coordination: 'var(--color-drift, var(--color-warning))',
  'fire-safety': 'var(--color-danger)',
  energy: 'var(--color-success)',
  construction: 'var(--draft-construction-blue)',
  sustainability: 'var(--color-success)',
  'cost-quantity': 'var(--color-warning)',
};

export interface LensDropdownProps {
  currentLens: LensMode;
  onLensChange: (lens: LensMode) => void;
  enableHotkey?: boolean;
}

export function LensDropdown({
  currentLens,
  onLensChange,
  enableHotkey = true,
}: LensDropdownProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const activeLensInCycle = LENS_CYCLE.includes(currentLens as (typeof LENS_CYCLE)[number])
    ? (currentLens as (typeof LENS_CYCLE)[number])
    : 'all';

  // Global L key cycles forward through the lens modes.
  useEffect(() => {
    if (!enableHotkey) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'l' && e.key !== 'L') return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const idx = LENS_CYCLE.indexOf(activeLensInCycle);
      onLensChange(LENS_CYCLE[(idx + 1) % LENS_CYCLE.length]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLensInCycle, enableHotkey, onLensChange]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, close]);

  const softColor = DISC_SOFT[currentLens];
  const solidColor = DISC_SOLID[currentLens] ?? 'var(--color-muted-foreground)';

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        data-testid="lens-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
        style={
          softColor
            ? {
                boxShadow: `inset 0 -2px 0 ${softColor}`,
              }
            : undefined
        }
        className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] hover:bg-surface-strong"
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: solidColor }}
        />
        <span className="text-muted">Show</span>
        <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
          {lensLabel(activeLensInCycle)}
        </span>
        <span aria-hidden="true" className="text-muted">
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Lens"
          data-testid="lens-menu"
          className="absolute left-0 top-full z-50 mt-1 w-52 rounded-md border border-border bg-surface shadow-elev-2"
          style={{ fontSize: 'var(--text-sm)' }}
          ref={(el) => {
            const active = el?.querySelector<HTMLElement>('[aria-current="true"]');
            const first = el?.querySelector<HTMLElement>('[role="menuitem"]');
            (active ?? first)?.focus();
          }}
          onKeyDown={(e) => {
            const items = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
            );
            const idx = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              items[(idx + 1) % items.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              items[(idx - 1 + items.length) % items.length]?.focus();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
        >
          {LENS_CYCLE.map((lens) => (
            <button
              key={lens}
              type="button"
              role="menuitem"
              aria-current={lens === currentLens ? 'true' : undefined}
              data-testid={`lens-option-${lens}`}
              onClick={() => {
                onLensChange(lens);
                close();
              }}
              className={[
                'flex w-full items-center justify-between px-3 py-1.5 text-left',
                lens === currentLens ? 'bg-accent-soft font-medium' : 'hover:bg-surface-strong',
              ].join(' ')}
            >
              {lensLabel(lens)}
              {lens === currentLens ? (
                <svg
                  aria-hidden="true"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2,6 5,9 10,3" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
