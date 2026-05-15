import { describe, expect, it } from 'vitest';
import {
  initialLeaderTextState,
  initialTextAnnotationState,
  reduceLeaderText,
  reduceTextAnnotation,
} from './toolGrammar';

/* ────────────────────────────────────────────────────────────────────── */
/* Text Annotation                                                          */
/* ────────────────────────────────────────────────────────────────────── */

describe('TextAnnotation grammar', () => {
  it('starts in idle phase', () => {
    expect(initialTextAnnotationState().phase).toBe('idle');
  });

  it('idle → typing on click, records position and empty draft', () => {
    const s0 = initialTextAnnotationState();
    const { state, effect } = reduceTextAnnotation(s0, {
      kind: 'click',
      pointMm: { xMm: 300, yMm: 400 },
    });
    expect(state.phase).toBe('typing');
    if (state.phase === 'typing') {
      expect(state.positionMm).toEqual({ xMm: 300, yMm: 400 });
      expect(state.draft).toBe('');
    }
    expect(effect.commitText).toBeUndefined();
    expect(effect.stillActive).toBe(true);
  });

  it('typing accumulates characters via type events', () => {
    let state = initialTextAnnotationState();
    state = reduceTextAnnotation(state, {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    }).state;
    state = reduceTextAnnotation(state, { kind: 'type', char: 'H' }).state;
    state = reduceTextAnnotation(state, { kind: 'type', char: 'i' }).state;
    expect(state.phase).toBe('typing');
    if (state.phase === 'typing') {
      expect(state.draft).toBe('Hi');
    }
  });

  it('backspace removes the last character', () => {
    let state = initialTextAnnotationState();
    state = reduceTextAnnotation(state, {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    }).state;
    state = reduceTextAnnotation(state, { kind: 'type', char: 'A' }).state;
    state = reduceTextAnnotation(state, { kind: 'type', char: 'B' }).state;
    state = reduceTextAnnotation(state, { kind: 'backspace' }).state;
    expect(state.phase).toBe('typing');
    if (state.phase === 'typing') {
      expect(state.draft).toBe('A');
    }
  });

  it('confirm emits commitText with position and draft content, resets to idle', () => {
    let state = initialTextAnnotationState();
    state = reduceTextAnnotation(state, {
      kind: 'click',
      pointMm: { xMm: 100, yMm: 200 },
    }).state;
    state = reduceTextAnnotation(state, { kind: 'type', char: 'F' }).state;
    state = reduceTextAnnotation(state, { kind: 'type', char: 'o' }).state;
    state = reduceTextAnnotation(state, { kind: 'type', char: 'o' }).state;
    const { state: next, effect } = reduceTextAnnotation(state, { kind: 'confirm' });
    expect(next.phase).toBe('idle');
    expect(effect.commitText).toEqual({
      positionMm: { xMm: 100, yMm: 200 },
      content: 'Foo',
    });
    expect(effect.stillActive).toBe(true);
  });

  it('cancel from typing resets to idle without emitting commitText', () => {
    let state = initialTextAnnotationState();
    state = reduceTextAnnotation(state, {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    }).state;
    state = reduceTextAnnotation(state, { kind: 'type', char: 'X' }).state;
    const { state: next, effect } = reduceTextAnnotation(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
    expect(effect.commitText).toBeUndefined();
    expect(effect.stillActive).toBe(true);
  });

  it('deactivate returns stillActive=false and resets to idle', () => {
    let state = initialTextAnnotationState();
    state = reduceTextAnnotation(state, {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    }).state;
    const { state: next, effect } = reduceTextAnnotation(state, { kind: 'deactivate' });
    expect(next.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
    expect(effect.commitText).toBeUndefined();
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* Leader Text                                                              */
/* ────────────────────────────────────────────────────────────────────── */

describe('LeaderText grammar', () => {
  it('starts in idle phase', () => {
    expect(initialLeaderTextState().phase).toBe('idle');
  });

  it('idle → anchor on first click', () => {
    const s0 = initialLeaderTextState();
    const { state, effect } = reduceLeaderText(s0, {
      kind: 'click',
      pointMm: { xMm: 500, yMm: 600 },
    });
    expect(state.phase).toBe('anchor');
    if (state.phase === 'anchor') {
      expect(state.anchorMm).toEqual({ xMm: 500, yMm: 600 });
    }
    expect(effect.commitLeader).toBeUndefined();
    expect(effect.stillActive).toBe(true);
  });

  it('anchor → text-pos on second click, records elbowMm', () => {
    let state = initialLeaderTextState();
    state = reduceLeaderText(state, {
      kind: 'click',
      pointMm: { xMm: 100, yMm: 100 },
    }).state;
    const { state: next } = reduceLeaderText(state, {
      kind: 'click',
      pointMm: { xMm: 200, yMm: 150 },
    });
    expect(next.phase).toBe('text-pos');
    if (next.phase === 'text-pos') {
      expect(next.anchorMm).toEqual({ xMm: 100, yMm: 100 });
      expect(next.elbowMm).toEqual({ xMm: 200, yMm: 150 });
    }
  });

  it('text-pos → typing on third click, records textMm and empty draft', () => {
    let state = initialLeaderTextState();
    state = reduceLeaderText(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceLeaderText(state, { kind: 'click', pointMm: { xMm: 100, yMm: 0 } }).state;
    const { state: next } = reduceLeaderText(state, {
      kind: 'click',
      pointMm: { xMm: 200, yMm: 0 },
    });
    expect(next.phase).toBe('typing');
    if (next.phase === 'typing') {
      expect(next.textMm).toEqual({ xMm: 200, yMm: 0 });
      expect(next.draft).toBe('');
    }
  });

  it('typing accumulates characters and backspace removes them', () => {
    let state = initialLeaderTextState();
    state = reduceLeaderText(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceLeaderText(state, { kind: 'click', pointMm: { xMm: 100, yMm: 0 } }).state;
    state = reduceLeaderText(state, { kind: 'click', pointMm: { xMm: 200, yMm: 0 } }).state;
    state = reduceLeaderText(state, { kind: 'type', char: 'A' }).state;
    state = reduceLeaderText(state, { kind: 'type', char: 'B' }).state;
    state = reduceLeaderText(state, { kind: 'backspace' }).state;
    expect(state.phase).toBe('typing');
    if (state.phase === 'typing') {
      expect(state.draft).toBe('A');
    }
  });

  it('confirm emits commitLeader with all four fields and resets to idle', () => {
    let state = initialLeaderTextState();
    state = reduceLeaderText(state, {
      kind: 'click',
      pointMm: { xMm: 10, yMm: 20 },
    }).state;
    state = reduceLeaderText(state, {
      kind: 'click',
      pointMm: { xMm: 50, yMm: 30 },
    }).state;
    state = reduceLeaderText(state, {
      kind: 'click',
      pointMm: { xMm: 90, yMm: 30 },
    }).state;
    state = reduceLeaderText(state, { kind: 'type', char: 'W' }).state;
    state = reduceLeaderText(state, { kind: 'type', char: 'a' }).state;
    state = reduceLeaderText(state, { kind: 'type', char: 'l' }).state;
    state = reduceLeaderText(state, { kind: 'type', char: 'l' }).state;
    const { state: next, effect } = reduceLeaderText(state, { kind: 'confirm' });
    expect(next.phase).toBe('idle');
    expect(effect.commitLeader).toEqual({
      anchorMm: { xMm: 10, yMm: 20 },
      elbowMm: { xMm: 50, yMm: 30 },
      textMm: { xMm: 90, yMm: 30 },
      content: 'Wall',
    });
    expect(effect.stillActive).toBe(true);
  });

  it('cancel from any phase resets to idle without emitting commitLeader', () => {
    let state = initialLeaderTextState();
    state = reduceLeaderText(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceLeaderText(state, { kind: 'click', pointMm: { xMm: 100, yMm: 0 } }).state;
    const { state: next, effect } = reduceLeaderText(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
    expect(effect.commitLeader).toBeUndefined();
    expect(effect.stillActive).toBe(true);
  });

  it('deactivate returns stillActive=false and resets to idle', () => {
    let state = initialLeaderTextState();
    state = reduceLeaderText(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { state: next, effect } = reduceLeaderText(state, { kind: 'deactivate' });
    expect(next.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
    expect(effect.commitLeader).toBeUndefined();
  });
});
