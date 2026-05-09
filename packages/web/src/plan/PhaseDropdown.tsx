import type { ReactElement } from 'react';

import type { PhaseFilter } from '@bim-ai/core';

export type PhaseDropdownProps = {
  value: PhaseFilter;
  onChange: (value: PhaseFilter) => void;
};

const OPTIONS: { value: PhaseFilter; label: string; glyph: string }[] = [
  { value: 'all', label: 'Show All', glyph: '…' },
  { value: 'existing', label: 'Existing', glyph: '■' },
  { value: 'demolition', label: 'Demolition', glyph: '⊠' },
  { value: 'new', label: 'New Construction', glyph: '◼' },
];

export function PhaseDropdown({ value, onChange }: PhaseDropdownProps): ReactElement {
  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <div className="phase-dropdown">
      <button
        type="button"
        className="phase-dropdown__chip"
        aria-label={`Phase filter: ${active.label}`}
        onClick={() => {
          const next = OPTIONS[(OPTIONS.indexOf(active) + 1) % OPTIONS.length];
          onChange(next.value);
        }}
      >
        <span className="phase-dropdown__glyph">{active.glyph}</span>
        <span className="phase-dropdown__label">{active.label}</span>
      </button>
      <select
        className="phase-dropdown__select"
        value={value}
        aria-label="Phase filter"
        onChange={(e) => onChange(e.target.value as PhaseFilter)}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.glyph} {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
