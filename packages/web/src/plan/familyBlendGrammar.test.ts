import { describe, expect, it } from 'vitest';
import { initialFamilyBlendState, reduceFamilyBlend } from '../tools/toolGrammar';

const pt = (xMm: number, yMm: number) => ({ xMm, yMm });

describe('family blend grammar — §15.1.2', () => {
  it('starts in idle state', () => {
    const state = initialFamilyBlendState();
    expect(state.phase).toBe('idle');
    expect(state.bottomPointsMm).toHaveLength(0);
    expect(state.topPointsMm).toHaveLength(0);
  });

  it('click adds bottom profile points', () => {
    let { state } = reduceFamilyBlend(initialFamilyBlendState(), { kind: 'activate' });
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(100, 0) }));
    expect(state.phase).toBe('sketching-bottom');
    expect(state.bottomPointsMm).toHaveLength(2);
  });

  it('Enter with ≥3 bottom points transitions to sketching-top', () => {
    let { state } = reduceFamilyBlend(initialFamilyBlendState(), { kind: 'activate' });
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(100, 0) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(50, 100) }));
    expect(state.bottomPointsMm).toHaveLength(3);
    ({ state } = reduceFamilyBlend(state, { kind: 'confirm' }));
    expect(state.phase).toBe('sketching-top');
  });

  it('Enter with <3 bottom points does not transition', () => {
    let { state } = reduceFamilyBlend(initialFamilyBlendState(), { kind: 'activate' });
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(100, 0) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'confirm' }));
    // Should stay in sketching-bottom (Enter not accepted with only 2 points)
    expect(state.phase).toBe('sketching-bottom');
  });

  it('Enter with ≥3 top points emits createFamilyBlend', () => {
    let { state } = reduceFamilyBlend(initialFamilyBlendState(), { kind: 'activate' });
    // Add 3 bottom points
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(500, 0) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(250, 500) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'confirm' }));
    expect(state.phase).toBe('sketching-top');

    // Add 3 top points
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(50, 50) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(250, 50) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(150, 250) }));

    const { state: stateAfterConfirm, effect } = reduceFamilyBlend(state, { kind: 'confirm' });
    state = stateAfterConfirm;
    expect(effect.createFamilyBlend).toBeDefined();
    expect(effect.createFamilyBlend!.bottomProfileMm).toHaveLength(3);
    expect(effect.createFamilyBlend!.topProfileMm).toHaveLength(3);
    // Resets to idle after emission
    expect(state.phase).toBe('idle');
  });

  it('Escape resets to idle from any state', () => {
    let { state } = reduceFamilyBlend(initialFamilyBlendState(), { kind: 'activate' });
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceFamilyBlend(state, { kind: 'click', pointMm: pt(100, 0) }));
    expect(state.phase).toBe('sketching-bottom');

    ({ state } = reduceFamilyBlend(state, { kind: 'cancel' }));
    expect(state.phase).toBe('idle');
    expect(state.bottomPointsMm).toHaveLength(0);
  });
});
