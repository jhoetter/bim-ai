/**
 * EDT-V3-06 — Helper dimension chip SVG overlay.
 *
 * Renders a dimension line between fromPoint and toPoint with an editable
 * chip at the midpoint. Clicking the chip opens an inline numeric input;
 * Enter commits, Esc cancels, Tab moves to the next chip.
 */
import { type KeyboardEvent, useRef, useState } from 'react';

import type { HelperDimensionDescriptor } from '@bim-ai/core';

import type { ScreenPoint } from './GripLayer';

export type PlanToScreen = (pt: { xMm: number; yMm: number }) => ScreenPoint;

interface HelperDimChipProps {
  descriptor: HelperDimensionDescriptor;
  planToScreen: PlanToScreen;
  onDispatch: (cmd: Record<string, unknown>) => void;
}

function formatMm(mm: number): string {
  if (mm >= 1_000_000) {
    const m2 = mm / 1_000_000;
    return `${m2.toFixed(2)} m²`;
  }
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
  return `${Math.round(mm)} mm`;
}

export function HelperDimChip({ descriptor, planToScreen, onDispatch }: HelperDimChipProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const a = planToScreen(descriptor.fromPoint);
  const b = planToScreen(descriptor.toPoint);
  const cx = (a.pxX + b.pxX) / 2;
  const cy = (a.pxY + b.pxY) / 2;

  const hasDimLine = Math.abs(a.pxX - b.pxX) > 1 || Math.abs(a.pxY - b.pxY) > 1;

  const minX = Math.min(a.pxX, b.pxX) - 32;
  const minY = Math.min(a.pxY, b.pxY) - 32;
  const maxX = Math.max(a.pxX, b.pxX) + 32;
  const maxY = Math.max(a.pxY, b.pxY) + 32;
  const svgW = Math.max(1, maxX - minX);
  const svgH = Math.max(1, maxY - minY);

  function handleChipClick() {
    if (descriptor.readOnly) return;
    setInputValue(String(Math.round(descriptor.valueMm)));
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  }

  function commit() {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed > 0) {
      onDispatch(descriptor.onCommit(parsed));
    }
    setEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
  }

  const chipWidth = 68;
  const chipHeight = 20;

  return (
    <div
      data-testid={`helper-dim-chip-${descriptor.id}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {hasDimLine && (
        <svg
          style={{ position: 'absolute', left: minX, top: minY, pointerEvents: 'none' }}
          width={svgW}
          height={svgH}
          viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
        >
          <line
            x1={a.pxX}
            y1={a.pxY}
            x2={b.pxX}
            y2={b.pxY}
            stroke="var(--draft-witness)"
            strokeWidth="var(--draft-lw-witness, 0.5)"
            strokeDasharray="4 3"
          />
        </svg>
      )}
      {editing ? (
        <foreignObject
          style={{
            position: 'absolute',
            left: cx - chipWidth / 2,
            top: cy - chipHeight / 2,
            width: chipWidth,
            height: chipHeight,
            pointerEvents: 'auto',
            zIndex: 30,
          }}
        >
          <input
            ref={inputRef}
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-surface-2, var(--color-surface-strong))',
              color: 'var(--color-foreground)',
              border: '1px solid var(--brand-accent)',
              borderRadius: 3,
              fontSize: 'var(--text-2xs, 10px)',
              fontVariantNumeric: 'tabular-nums',
              padding: '0 4px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </foreignObject>
      ) : (
        <button
          type="button"
          tabIndex={descriptor.readOnly ? -1 : 0}
          data-helper-dim-chip
          onClick={handleChipClick}
          onFocus={() => {
            if (!descriptor.readOnly) {
              setInputValue(String(Math.round(descriptor.valueMm)));
              setEditing(true);
            }
          }}
          title={descriptor.readOnly ? descriptor.label : `Click to edit ${descriptor.label}`}
          style={{
            position: 'absolute',
            left: cx - chipWidth / 2,
            top: cy - chipHeight / 2,
            width: chipWidth,
            height: chipHeight,
            background: 'var(--color-surface-2, var(--color-surface-strong))',
            color: 'var(--color-foreground)',
            border: '1px solid color-mix(in srgb, var(--color-foreground) 20%, transparent)',
            borderRadius: 3,
            fontSize: 'var(--text-2xs, 10px)',
            fontVariantNumeric: 'tabular-nums',
            cursor: descriptor.readOnly ? 'default' : 'text',
            pointerEvents: 'auto',
            zIndex: 20,
            padding: '0 4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            boxSizing: 'border-box',
          }}
          onMouseEnter={(e) => {
            if (!descriptor.readOnly) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-accent)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              'color-mix(in srgb, var(--color-foreground) 20%, transparent)';
          }}
        >
          {formatMm(descriptor.valueMm)}
        </button>
      )}
    </div>
  );
}
