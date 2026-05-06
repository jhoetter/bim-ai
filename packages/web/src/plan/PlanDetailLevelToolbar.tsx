import type { JSX } from 'react';

import type { PlanDetailLevel } from './planDetailLevelLines';

const ORDER: readonly PlanDetailLevel[] = ['coarse', 'medium', 'fine'];

/**
 * VIE-01 — three-state Coarse/Medium/Fine selector for the plan canvas
 * toolbar. Mirrors Revit's "View Control Bar" position and lets the user
 * cycle the plan view's detail level without opening the Inspector.
 *
 * The component is presentational only — the parent owns the state. Reads
 * `value`; calls `onChange` with the next level on click.
 */
export function PlanDetailLevelToolbar({
  value,
  onChange,
}: {
  value: PlanDetailLevel;
  onChange: (next: PlanDetailLevel) => void;
}): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Plan detail level"
      data-testid="plan-detail-level-toolbar"
      className="inline-flex overflow-hidden rounded border border-border bg-background"
    >
      {ORDER.map((level) => {
        const active = level === value;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`plan-detail-level-${level}`}
            onClick={() => onChange(level)}
            className={[
              'px-2 py-1 text-[11px] capitalize',
              active ? 'bg-amber-200 text-amber-900' : 'text-muted hover:bg-muted/10',
            ].join(' ')}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}
