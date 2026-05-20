import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

export function PhaseSection({
  phaseCreated,
  phaseDemolished,
  phases,
  onPropertyChange,
}: {
  phaseCreated: string | null | undefined;
  phaseDemolished: string | null | undefined;
  phases: Extract<Element, { kind: 'phase' }>[];
  onPropertyChange?: (property: string, value: unknown) => void;
}): JSX.Element {
  const sorted = [...phases].sort((a, b) => a.ord - b.ord);
  return (
    <>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Phase Created</span>
        <select
          data-testid="inspector-phase-created"
          className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
          value={phaseCreated ?? ''}
          onChange={(e) => onPropertyChange?.('phaseCreated', e.target.value || null)}
        >
          <option value="">—</option>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Phase Demolished</span>
        <select
          data-testid="inspector-phase-demolished"
          className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
          value={phaseDemolished ?? ''}
          onChange={(e) => onPropertyChange?.('phaseDemolished', e.target.value || null)}
        >
          <option value="">—</option>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
