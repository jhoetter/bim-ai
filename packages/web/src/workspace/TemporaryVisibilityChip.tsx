import type { JSX } from 'react';

import { useBimStore } from '../state/store';

/**
 * VIE-04: status-bar chip showing the active temporary-visibility override
 * with a one-click reset. Renders nothing when no override is active.
 */
export function TemporaryVisibilityChip(): JSX.Element | null {
  const override = useBimStore((s) => s.temporaryVisibility);
  const clear = useBimStore((s) => s.clearTemporaryVisibility);
  if (override === null) return null;
  const label = override.mode === 'isolate' ? 'Isolate' : 'Hide';
  const cats = override.categories.length > 0 ? override.categories.join(', ') : '—';
  return (
    <button
      type="button"
      data-testid="temp-visibility-chip"
      onClick={clear}
      title="Reset Temporary Visibility (HR)"
      className="inline-flex items-center gap-1 rounded border border-amber-500 bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 hover:bg-amber-200"
    >
      <span aria-hidden>👁</span>
      <span>
        {label}: {cats}
      </span>
      <span aria-hidden className="text-[10px] opacity-70">
        ✕
      </span>
    </button>
  );
}
