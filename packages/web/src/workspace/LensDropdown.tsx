import { type JSX, type KeyboardEvent, useCallback, useId, useState } from 'react';
import type { LensMode } from '@bim-ai/core';

const LENS_OPTIONS: { value: LensMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'structure', label: 'Structure' },
  { value: 'mep', label: 'MEP' },
  { value: 'energy', label: 'Energy' },
  { value: 'coordination', label: 'Coordination' },
];

function lensLabel(lens: LensMode): string {
  return LENS_OPTIONS.find((o) => o.value === lens)?.label ?? lens;
}

export interface LensDropdownProps {
  currentLens: LensMode;
  onLensChange: (lens: LensMode) => void;
}

export function LensDropdown({ currentLens, onLensChange }: LensDropdownProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Tab' && open) {
        event.preventDefault();
        const idx = LENS_OPTIONS.findIndex((o) => o.value === currentLens);
        const next = LENS_OPTIONS[(idx + 1) % LENS_OPTIONS.length];
        if (next) onLensChange(next.value);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    },
    [open, currentLens, onLensChange],
  );

  return (
    <div onKeyDown={handleKeyDown} className="relative flex items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        data-testid="lens-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm px-1.5 py-0.5 hover:bg-surface-strong"
      >
        Show:{' '}
        <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
          {lensLabel(currentLens)}
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Lens"
          data-testid="lens-menu"
          className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded-md border border-border bg-surface shadow-elev-2"
          style={{ fontSize: 'var(--text-sm)' }}
        >
          {LENS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              data-testid={`lens-option-${opt.value}`}
              onClick={() => {
                // TODO(T8/renderer): apply lens ghost opacity (25% for non-active discipline, 240ms --ease-paper)
                onLensChange(opt.value);
                setOpen(false);
              }}
              className={[
                'flex w-full items-center px-3 py-1.5 text-left',
                opt.value === currentLens
                  ? 'bg-accent-soft font-medium'
                  : 'hover:bg-surface-strong',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
