/**
 * EDT-06 — modifier-related coverage for the tool grammar.
 *
 * - Chain mode for Place Wall (already in WallChainState; this confirms
 *   the chain anchor advances every commit so a four-wall room costs
 *   four clicks instead of eight).
 * - Multiple mode is a presentational flag in TOOL_CAPABILITIES; here
 *   we assert which tools opt in.
 * - Tag-on-Place / numericInputActive defaults.
 */

import { describe, expect, it } from 'vitest';

import {
  defaultToolGrammarModifiers,
  initialNumericInputState,
  initialWallChainState,
  reduceNumericInput,
  reduceWallChain,
  TOOL_CAPABILITIES,
} from './toolGrammar';

describe('EDT-06 — defaults', () => {
  it('returns sensible default modifier flags', () => {
    const mods = defaultToolGrammarModifiers();
    expect(mods.chainable).toBe(true);
    expect(mods.multipleable).toBe(false);
    expect(mods.tagOnPlace.enabled).toBe(false);
    expect(mods.tagOnPlace.tagFamilyId).toBeUndefined();
    expect(mods.numericInputActive).toBe(false);
  });
});

describe('EDT-06 — chain mode for the Wall tool', () => {
  it('drawing four walls of a rectangular room takes four clicks (not eight)', () => {
    let state = initialWallChainState();
    state = reduceWallChain(state, { kind: 'tool-activated' }).state;

    const corners = [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
      { xMm: 0, yMm: 0 },
    ];

    const segments: {
      startMm: { xMm: number; yMm: number };
      endMm: { xMm: number; yMm: number };
    }[] = [];
    for (const c of corners) {
      const out = reduceWallChain(state, { kind: 'click', pointMm: c });
      state = out.state;
      if (out.effect.commitSegment) segments.push(out.effect.commitSegment);
    }

    // 5 clicks, 4 segments — first click sets the anchor, each subsequent click closes a segment.
    expect(segments).toHaveLength(4);
    expect(segments[0]!.startMm).toEqual({ xMm: 0, yMm: 0 });
    expect(segments[3]!.endMm).toEqual({ xMm: 0, yMm: 0 });
  });

  it('cancel breaks the chain (next click starts a new segment, not continues)', () => {
    let state = initialWallChainState();
    state = reduceWallChain(state, { kind: 'tool-activated' }).state;
    state = reduceWallChain(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceWallChain(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 0 } }).state;
    // chainAnchor is now at (1000, 0). Cancel resets it.
    state = reduceWallChain(state, { kind: 'cancel' }).state;
    expect(state.chainAnchorMm).toBeNull();
    const next = reduceWallChain(state, {
      kind: 'click',
      pointMm: { xMm: 5000, yMm: 5000 },
    });
    // First click after cancel should *not* commit — it sets a new start point.
    expect(next.effect.commitSegment).toBeUndefined();
  });
});

describe('EDT-06 — Multiple mode capabilities', () => {
  it('door / window / column / split / trim opt in to Multiple', () => {
    expect(TOOL_CAPABILITIES.door!.multipleable).toBe(true);
    expect(TOOL_CAPABILITIES.window!.multipleable).toBe(true);
    expect(TOOL_CAPABILITIES.column!.multipleable).toBe(true);
    expect(TOOL_CAPABILITIES.split!.multipleable).toBe(true);
    expect(TOOL_CAPABILITIES.trim!.multipleable).toBe(true);
  });

  it('wall / beam / ceiling do not advertise Multiple (they are chain or single-shot)', () => {
    expect(TOOL_CAPABILITIES.wall!.multipleable).toBe(false);
    expect(TOOL_CAPABILITIES.beam!.multipleable).toBe(false);
    expect(TOOL_CAPABILITIES.ceiling!.multipleable).toBe(false);
  });

  it('door / window / wall opt in to Tag-on-Place', () => {
    expect(TOOL_CAPABILITIES.door!.tagOnPlace).toBe(true);
    expect(TOOL_CAPABILITIES.window!.tagOnPlace).toBe(true);
    expect(TOOL_CAPABILITIES.wall!.tagOnPlace).toBe(true);
  });
});

describe('EDT-06 — numeric input reducer', () => {
  it('typing a digit while drawing pops the input field', () => {
    const s0 = initialNumericInputState();
    expect(s0.active).toBe(false);
    const s1 = reduceNumericInput(s0, { kind: 'start', firstDigit: '5' });
    expect(s1.active).toBe(true);
    expect(s1.value).toBe('5');
    expect(s1.axis).toBe('primary');
    const s2 = reduceNumericInput(s1, { kind: 'append', digit: '0' });
    const s3 = reduceNumericInput(s2, { kind: 'append', digit: '0' });
    const s4 = reduceNumericInput(s3, { kind: 'append', digit: '0' });
    expect(s4.value).toBe('5000');
  });

  it('Tab toggles the axis between primary and perpendicular', () => {
    let s = reduceNumericInput(initialNumericInputState(), { kind: 'start', firstDigit: '3' });
    s = reduceNumericInput(s, { kind: 'tab-axis' });
    expect(s.axis).toBe('perpendicular');
    s = reduceNumericInput(s, { kind: 'tab-axis' });
    expect(s.axis).toBe('primary');
  });

  it('backspace edits the input; commit / cancel reset it', () => {
    let s = reduceNumericInput(initialNumericInputState(), { kind: 'start', firstDigit: '5' });
    s = reduceNumericInput(s, { kind: 'append', digit: '0' });
    s = reduceNumericInput(s, { kind: 'backspace' });
    expect(s.value).toBe('5');
    s = reduceNumericInput(s, { kind: 'commit' });
    expect(s.active).toBe(false);
    s = reduceNumericInput(s, { kind: 'start', firstDigit: '7' });
    s = reduceNumericInput(s, { kind: 'cancel' });
    expect(s.active).toBe(false);
    expect(s.value).toBe('');
  });

  it('append / backspace are no-ops while inactive', () => {
    const s0 = initialNumericInputState();
    const s1 = reduceNumericInput(s0, { kind: 'append', digit: '5' });
    expect(s1).toEqual(s0);
    const s2 = reduceNumericInput(s0, { kind: 'backspace' });
    expect(s2).toEqual(s0);
  });
});
