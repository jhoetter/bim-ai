/**
 * EDT-05 — snap-type toggle toolbar.
 *
 * Compact dropdown rendered next to the plan canvas zoom button. Shows
 * a checkbox per snap kind and persists changes via `saveSnapSettings`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_SNAP_SETTINGS,
  saveSnapSettings,
  type SnapSettings,
  type ToggleableSnapKind,
} from './snapSettings';

const ROWS: Array<{ key: ToggleableSnapKind; label: string }> = [
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'midpoint', label: 'Midpoint' },
  { key: 'nearest', label: 'Nearest' },
  { key: 'center', label: 'Center' },
  { key: 'intersection', label: 'Intersection' },
  { key: 'perpendicular', label: 'Perpendicular' },
  { key: 'extension', label: 'Extension' },
  { key: 'parallel', label: 'Parallel' },
  { key: 'tangent', label: 'Tangent' },
  { key: 'workplane', label: 'Workplane' },
  { key: 'grid', label: 'Grid' },
];

export interface SnapSettingsToolbarProps {
  value: SnapSettings;
  onChange: (next: SnapSettings) => void;
}

export function SnapSettingsToolbar({ value, onChange }: SnapSettingsToolbarProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const enabledCount = ROWS.filter((r) => value[r.key]).length;

  const toggle = useCallback(
    (key: ToggleableSnapKind) => {
      const next = { ...value, [key]: !value[key] };
      onChange(next);
      saveSnapSettings(next);
    },
    [value, onChange],
  );

  const reset = useCallback(() => {
    onChange({ ...DEFAULT_SNAP_SETTINGS });
    saveSnapSettings({ ...DEFAULT_SNAP_SETTINGS });
  }, [onChange]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} data-testid="snap-settings-toolbar" className="relative">
      {open && (
        <div className="absolute bottom-9 left-0 z-20 flex flex-col overflow-hidden rounded border border-border bg-surface/95 shadow-md backdrop-blur">
          {ROWS.map((row) => (
            <label
              key={row.key}
              data-testid={`snap-toggle-${row.key}`}
              className="flex cursor-pointer items-center gap-2 px-3 py-1 font-mono text-[10px] text-muted hover:bg-accent/20 hover:text-foreground"
            >
              <input
                type="checkbox"
                checked={value[row.key]}
                onChange={() => toggle(row.key)}
                aria-label={`Toggle ${row.label.toLowerCase()} snap`}
              />
              <span>{row.label}</span>
            </label>
          ))}
          <div className="mx-2 border-t border-border" />
          <button
            type="button"
            data-testid="snap-toggle-reset"
            className="px-3 py-1 text-left font-mono text-[10px] text-muted hover:bg-accent/20 hover:text-foreground"
            onClick={reset}
          >
            Reset to defaults
          </button>
        </div>
      )}
      <button
        type="button"
        data-testid="snap-settings-button"
        title="Toggle individual snap types (saved across sessions)"
        className="flex items-center gap-1 rounded border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur hover:bg-surface hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        Snaps · {enabledCount}/{ROWS.length}
      </button>
    </div>
  );
}
