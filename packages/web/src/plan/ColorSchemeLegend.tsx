/**
 * §13.1.3 — Color Fill Legend panel overlay for plan views.
 *
 * Rendered as a floating panel on the plan canvas when a color scheme is active.
 */
import type { JSX } from 'react';

interface ColorSchemeLegendProps {
  rows: Array<{ colorHex: string; label: string; count?: number; areaSqm?: number }>;
  title: string;
  visible: boolean;
  onClose: () => void;
}

export function ColorSchemeLegend({
  rows,
  title,
  visible,
  onClose,
}: ColorSchemeLegendProps): JSX.Element | null {
  if (!visible || rows.length === 0) return null;
  return (
    <div
      data-testid="color-scheme-legend"
      className="absolute bottom-12 right-2 z-10 rounded bg-surface/95 border border-border shadow-md p-2 min-w-[140px]"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" data-testid="color-scheme-legend-title">
          {title}
        </span>
        <button
          type="button"
          className="text-xs text-muted"
          onClick={onClose}
          data-testid="color-scheme-legend-close"
        >
          ✕
        </button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5 py-0.5">
          <div
            className="w-3 h-3 rounded-sm shrink-0 border border-border/60"
            style={{ background: row.colorHex }}
            data-testid={`legend-swatch-${i}`}
          />
          <span className="text-xs truncate" data-testid={`legend-label-${i}`}>
            {row.label}
          </span>
          {row.count != null && (
            <span className="text-xs text-muted ml-auto" data-testid={`legend-count-${i}`}>
              {row.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
