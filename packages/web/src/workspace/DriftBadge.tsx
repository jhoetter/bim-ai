import type { JSX } from 'react';

export interface DriftBadgeProps {
  driftCount: number;
  onClick: () => void;
}

export function DriftBadge({ driftCount, onClick }: DriftBadgeProps): JSX.Element | null {
  if (driftCount === 0) return null;
  return (
    <button
      type="button"
      data-testid="drift-badge"
      onClick={onClick}
      className="rounded-sm px-1.5 py-0.5 hover:bg-surface-strong"
      style={{
        color: 'var(--color-drift)',
        transition: 'opacity 240ms var(--ease-paper)',
      }}
    >
      {driftCount} drift{driftCount !== 1 ? 's' : ''}
    </button>
  );
}
