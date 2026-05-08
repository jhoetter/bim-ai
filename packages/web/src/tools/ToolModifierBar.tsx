/**
 * CHR-V3-08 — ToolModifierBar presentational component.
 *
 * 36 px secondary contextual bar that morphs by active tool. Mounts when
 * a tool with registered descriptors is active; unmounts when no tool is
 * active (D8 — context, not configuration). Does not persist between tool
 * sessions.
 *
 * All colours via CSS custom properties — no hex literals (R-G §2.5).
 */

import { type JSX } from 'react';

import type { ToolId } from './toolRegistry';
import type {
  AlwaysArmedModifierDescriptor,
  CycleModifierDescriptor,
  ToggleModifierDescriptor,
  ToolModifierDescriptor,
} from './modifierBar';

export interface ToolModifierBarProps {
  activeTool: ToolId | null;
  descriptors: ToolModifierDescriptor[];
  getToggle: (modifierId: string) => boolean;
  onToggle: (modifierId: string, value: boolean) => void;
  getCycle: (modifierId: string) => string;
  onCycleAdvance: (modifierId: string) => void;
}

const BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  height: 36,
  paddingInline: 12,
  background: 'var(--color-surface-2, var(--color-surface-strong))',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs-line)',
  color: 'var(--color-foreground)',
  overflow: 'hidden',
  animation: 'modifier-bar-mount 200ms var(--ease-paper, cubic-bezier(0.32,0.72,0,1)) both',
};

const LABEL_STYLE: React.CSSProperties = {
  color: 'var(--color-muted-foreground)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 5px',
  height: 18,
  borderRadius: 3,
  fontSize: 'var(--text-2xs, 10px)',
  lineHeight: 'var(--text-2xs-line, 14px)',
  background: 'var(--color-surface-strong)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-muted-foreground)',
  fontFamily: 'var(--font-mono, monospace)',
};

const TOGGLE_ON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  padding: '2px 7px',
  borderRadius: 4,
  background: 'var(--color-accent-soft)',
  border: '1px solid var(--color-accent)',
  color: 'var(--color-foreground)',
  fontSize: 'inherit',
  lineHeight: 'inherit',
};

const TOGGLE_OFF_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  padding: '2px 7px',
  borderRadius: 4,
  background: 'transparent',
  border: '1px solid var(--color-border)',
  color: 'var(--color-muted-foreground)',
  fontSize: 'inherit',
  lineHeight: 'inherit',
};

const CYCLE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  padding: '2px 7px',
  borderRadius: 4,
  background: 'transparent',
  border: '1px solid var(--color-border)',
  color: 'var(--color-foreground)',
  fontSize: 'inherit',
  lineHeight: 'inherit',
};

const ALWAYS_ARMED_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: 'var(--color-muted-foreground)',
  opacity: 0.7,
  fontSize: 'inherit',
  lineHeight: 'inherit',
};

const SEPARATOR_STYLE: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'var(--color-border)',
  flexShrink: 0,
};

function ToggleChip({
  descriptor,
  on,
  onToggle,
}: {
  descriptor: ToggleModifierDescriptor;
  on: boolean;
  onToggle: (value: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={descriptor.label}
      data-testid={`modifier-toggle-${descriptor.id}`}
      style={on ? TOGGLE_ON_STYLE : TOGGLE_OFF_STYLE}
      onClick={() => onToggle(!on)}
    >
      <span style={LABEL_STYLE}>{descriptor.label}</span>
      {descriptor.shortcut && <span style={CHIP_STYLE}>{descriptor.shortcut}</span>}
    </button>
  );
}

function CycleChip({
  descriptor,
  current,
  onAdvance,
}: {
  descriptor: CycleModifierDescriptor;
  current: string;
  onAdvance: () => void;
}): JSX.Element {
  const displayLabel = descriptor.valueLabels[current] ?? current;
  return (
    <button
      type="button"
      aria-label={`${descriptor.label}: ${displayLabel}`}
      data-testid={`modifier-cycle-${descriptor.id}`}
      style={CYCLE_STYLE}
      onClick={onAdvance}
    >
      <span style={LABEL_STYLE}>{descriptor.label}:</span>
      <span>{displayLabel}</span>
      {descriptor.shortcut && <span style={CHIP_STYLE}>{descriptor.shortcut}</span>}
    </button>
  );
}

function AlwaysArmedChip({
  descriptor,
}: {
  descriptor: AlwaysArmedModifierDescriptor;
}): JSX.Element {
  return (
    <span data-testid={`modifier-armed-${descriptor.id}`} style={ALWAYS_ARMED_STYLE}>
      <span>{descriptor.label}</span>
      {descriptor.shortcut && <span style={CHIP_STYLE}>{descriptor.shortcut}</span>}
    </span>
  );
}

export function ToolModifierBar({
  activeTool,
  descriptors,
  getToggle,
  onToggle,
  getCycle,
  onCycleAdvance,
}: ToolModifierBarProps): JSX.Element | null {
  if (!activeTool || descriptors.length === 0) return null;

  const chips: JSX.Element[] = [];
  let prevKind: string | null = null;

  for (const desc of descriptors) {
    if (prevKind === 'always-armed' && desc.kind !== 'always-armed') {
      chips.push(<div key={`sep-${desc.id}`} style={SEPARATOR_STYLE} aria-hidden="true" />);
    } else if (prevKind !== null && prevKind !== 'always-armed' && desc.kind === 'always-armed') {
      chips.push(<div key={`sep-${desc.id}`} style={SEPARATOR_STYLE} aria-hidden="true" />);
    }

    if (desc.kind === 'toggle') {
      chips.push(
        <ToggleChip
          key={desc.id}
          descriptor={desc}
          on={getToggle(desc.id)}
          onToggle={(v) => onToggle(desc.id, v)}
        />,
      );
    } else if (desc.kind === 'cycle') {
      chips.push(
        <CycleChip
          key={desc.id}
          descriptor={desc}
          current={getCycle(desc.id)}
          onAdvance={() => onCycleAdvance(desc.id)}
        />,
      );
    } else {
      chips.push(<AlwaysArmedChip key={desc.id} descriptor={desc} />);
    }
    prevKind = desc.kind;
  }

  return (
    <>
      <style>{`
        @keyframes modifier-bar-mount {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        role="toolbar"
        aria-label={`${activeTool} modifiers`}
        data-testid="tool-modifier-bar"
        style={BAR_STYLE}
      >
        {chips}
      </div>
    </>
  );
}
