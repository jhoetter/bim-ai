/**
 * CAN-V3-02 — Hatch pattern picker component.
 *
 * Renders a grid of 32×32 px SVG thumbnail previews for each hatch pattern.
 * Used in the material editor's "Plan hatch" slot and the detail-region OptionsBar.
 */
import type { HatchPatternDef } from '@bim-ai/core';
import type { JSX } from 'react';

import { buildSvgHatchPatternElement, computeHatchScreenRepeat } from './HatchRenderer';

const THUMB_SIZE = 32;
const THUMB_SCALE_DENOM = 50;
const THUMB_ZOOM = 1.0;

function HatchThumb({ hatch }: { hatch: HatchPatternDef }): JSX.Element {
  const screenRepeat = computeHatchScreenRepeat(hatch.paperMmRepeat, THUMB_SCALE_DENOM, THUMB_ZOOM);
  // Clamp repeat to thumbnail size so small hatches tile naturally and large
  // hatches still show at least one line.
  const clampedRepeat = Math.min(screenRepeat, THUMB_SIZE);
  const strokeColour = 'var(--draft-cut)';
  const patternId = `hatch-${hatch.id}-thumb`;
  const patternDef = buildSvgHatchPatternElement(
    { ...hatch, paperMmRepeat: clampedRepeat },
    clampedRepeat,
    strokeColour,
    patternId,
  );

  const fillAttr = patternDef ? `url(#${patternId})` : strokeColour;

  return (
    <svg
      width={THUMB_SIZE}
      height={THUMB_SIZE}
      style={{ display: 'block', border: '1px solid var(--draft-grid-major)' }}
    >
      {patternDef ? <defs>{patternDef}</defs> : null}
      <rect width={THUMB_SIZE} height={THUMB_SIZE} fill={fillAttr} />
    </svg>
  );
}

function NoneThumb(): JSX.Element {
  return (
    <svg
      width={THUMB_SIZE}
      height={THUMB_SIZE}
      style={{ display: 'block', border: '1px solid var(--draft-grid-major)' }}
    >
      <rect width={THUMB_SIZE} height={THUMB_SIZE} fill="var(--draft-paper)" />
      <line x1="4" y1="4" x2="28" y2="28" stroke="var(--draft-grid-major)" strokeWidth="1" />
      <line x1="28" y1="4" x2="4" y2="28" stroke="var(--draft-grid-major)" strokeWidth="1" />
    </svg>
  );
}

export function HatchPicker({
  hatches,
  value,
  onChange,
}: {
  hatches: HatchPatternDef[];
  value: string | null;
  onChange: (hatchId: string | null) => void;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        padding: '4px',
        background: 'var(--draft-paper)',
      }}
    >
      <button
        type="button"
        title="None"
        aria-pressed={value === null}
        style={{
          padding: 0,
          border: value === null ? '2px solid var(--draft-selection)' : '2px solid transparent',
          background: 'none',
          cursor: 'pointer',
          borderRadius: '2px',
        }}
        onClick={() => onChange(null)}
      >
        <NoneThumb />
      </button>

      {hatches.map((hatch) => (
        <button
          key={hatch.id}
          type="button"
          title={hatch.name}
          aria-pressed={value === hatch.id}
          style={{
            padding: 0,
            border:
              value === hatch.id ? '2px solid var(--draft-selection)' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            borderRadius: '2px',
          }}
          onClick={() => onChange(hatch.id)}
        >
          <HatchThumb hatch={hatch} />
        </button>
      ))}
    </div>
  );
}
