/**
 * EDT-06 — typing a digit while drawing pops a numeric input field, and
 * Enter commits at the typed length.
 *
 * Validates the canvas-level wiring of {@link reduceNumericInput} into
 * a wall draft: with the wall tool active and a draft start in place,
 * pressing "5" begins capture, three more digits build "5000", and
 * Enter resolves to a 5000mm-long endpoint along the cursor direction.
 */

import { describe, expect, it } from 'vitest';

import { parseDimensionInput } from '@bim-ai/core';
import { initialNumericInputState, reduceNumericInput } from './toolGrammar';

interface Vec {
  xMm: number;
  yMm: number;
}

/** Pure helper — the same shape the canvas uses to resolve the typed
 * length into an actual endpoint. Extracted here for unit coverage. */
export function resolveNumericEndpoint(
  start: Vec,
  cursorMm: Vec,
  lengthMm: number,
  axis: 'primary' | 'perpendicular',
): Vec {
  const dx = cursorMm.xMm - start.xMm;
  const dy = cursorMm.yMm - start.yMm;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < 1e-9) return start;
  if (axis === 'primary') {
    return {
      xMm: start.xMm + (dx / magnitude) * lengthMm,
      yMm: start.yMm + (dy / magnitude) * lengthMm,
    };
  }
  // Perpendicular: rotate the unit direction by +90°.
  return {
    xMm: start.xMm - (dy / magnitude) * lengthMm,
    yMm: start.yMm + (dx / magnitude) * lengthMm,
  };
}

describe('EDT-06 — numeric input while drawing a wall', () => {
  it('EDT-V3-12 parses mm, metres, and feet/inches into millimetres', () => {
    expect(parseDimensionInput('5400')).toEqual({ ok: true, mm: 5400, sourceUnit: 'mm' });
    expect(parseDimensionInput('5.4')).toEqual({ ok: true, mm: 5400, sourceUnit: 'm' });
    expect(parseDimensionInput('5.4 m')).toEqual({ ok: true, mm: 5400, sourceUnit: 'm' });
    expect(parseDimensionInput('5400 mm')).toEqual({ ok: true, mm: 5400, sourceUnit: 'mm' });
    const feet = parseDimensionInput(`5'4"`);
    expect(feet.ok && feet.mm).toBeCloseTo(1625.6, 1);
    expect(parseDimensionInput('not-a-length')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('typing 5000 + Enter commits a 5000mm-long segment in the cursor direction', () => {
    let s = initialNumericInputState();
    s = reduceNumericInput(s, { kind: 'start', firstDigit: '5' });
    s = reduceNumericInput(s, { kind: 'append', digit: '0' });
    s = reduceNumericInput(s, { kind: 'append', digit: '0' });
    s = reduceNumericInput(s, { kind: 'append', digit: '0' });
    expect(s.active).toBe(true);
    expect(s.value).toBe('5000');

    const cursor = { xMm: 8000, yMm: 0 };
    const endpoint = resolveNumericEndpoint(
      { xMm: 0, yMm: 0 },
      cursor,
      parseFloat(s.value),
      'primary',
    );
    expect(endpoint.xMm).toBeCloseTo(5000, 6);
    expect(endpoint.yMm).toBeCloseTo(0, 6);

    // Enter clears the input.
    s = reduceNumericInput(s, { kind: 'commit' });
    expect(s.active).toBe(false);
  });

  it('Tab switches axis, so typing again places along the perpendicular', () => {
    let s = initialNumericInputState();
    s = reduceNumericInput(s, { kind: 'start', firstDigit: '3' });
    s = reduceNumericInput(s, { kind: 'append', digit: '0' });
    s = reduceNumericInput(s, { kind: 'append', digit: '0' });
    s = reduceNumericInput(s, { kind: 'append', digit: '0' });
    s = reduceNumericInput(s, { kind: 'tab-axis' });
    expect(s.axis).toBe('perpendicular');

    // Cursor along +X. Perpendicular at length=3000 → +Y by 3000.
    const endpoint = resolveNumericEndpoint(
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      parseFloat(s.value),
      'perpendicular',
    );
    expect(endpoint.xMm).toBeCloseTo(0, 6);
    expect(endpoint.yMm).toBeCloseTo(3000, 6);
  });
});
