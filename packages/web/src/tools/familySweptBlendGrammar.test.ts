import { describe, expect, it } from 'vitest';
import { reduceFamilySweptBlend } from './toolGrammar';
import type { FamilySweptBlendState } from './toolGrammar';

describe('reduceFamilySweptBlend grammar — §15.1.2', () => {
  it('starts idle', () => {
    const { next } = reduceFamilySweptBlend({ phase: 'idle' }, { kind: 'activate' });
    expect(next.phase).toBe('idle');
  });

  it('transitions to recording-path on first click', () => {
    const { next } = reduceFamilySweptBlend({ phase: 'idle' }, { kind: 'click', xMm: 0, yMm: 0 });
    expect(next.phase).toBe('recording-path');
  });

  it('accumulates path points on click', () => {
    let { next } = reduceFamilySweptBlend({ phase: 'idle' }, { kind: 'click', xMm: 0, yMm: 0 });
    ({ next } = reduceFamilySweptBlend(next, { kind: 'click', xMm: 100, yMm: 0 }));
    expect(
      (next as Extract<FamilySweptBlendState, { phase: 'recording-path' }>).points,
    ).toHaveLength(2);
  });

  it('emits effect on confirm with 2+ points', () => {
    const state: FamilySweptBlendState = {
      phase: 'recording-path',
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 0 },
      ],
    };
    const { effect } = reduceFamilySweptBlend(state, { kind: 'confirm' });
    expect(effect?.kind).toBe('createFamilySweptBlend');
  });

  it('cancels back to idle', () => {
    const state: FamilySweptBlendState = { phase: 'recording-path', points: [] };
    const { next } = reduceFamilySweptBlend(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
  });
});
