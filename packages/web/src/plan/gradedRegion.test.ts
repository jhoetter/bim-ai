import { describe, it, expect } from 'vitest';
import {
  initialGradedRegionState,
  reduceGradedRegion,
  type GradedRegionState,
} from '../tools/toolGrammar';

describe('graded region grammar — §5.1.6', () => {
  it('starts in idle state', () => {
    const state = initialGradedRegionState();
    expect(state.phase).toBe('idle');
  });

  it('clicks add points to sketching state', () => {
    let state: GradedRegionState = initialGradedRegionState();

    const r1 = reduceGradedRegion(state, { kind: 'click', xMm: 0, yMm: 0 });
    state = r1.state;
    expect(state.phase).toBe('sketching');
    expect(r1.effect.stillActive).toBe(true);

    const r2 = reduceGradedRegion(state, { kind: 'click', xMm: 5000, yMm: 0 });
    state = r2.state;
    expect(state.phase).toBe('sketching');
    if (state.phase === 'sketching') {
      expect(state.points).toHaveLength(2);
    }
  });

  it('Enter with ≥3 points emits createGradedRegion', () => {
    let state: GradedRegionState = initialGradedRegionState();
    state = reduceGradedRegion(state, { kind: 'click', xMm: 0, yMm: 0 }).state;
    state = reduceGradedRegion(state, { kind: 'click', xMm: 5000, yMm: 0 }).state;
    state = reduceGradedRegion(state, { kind: 'click', xMm: 2500, yMm: 5000 }).state;

    const { state: finalState, effect } = reduceGradedRegion(state, { kind: 'commit' });
    expect(finalState.phase).toBe('idle');
    expect(effect.createGradedRegion).toBeDefined();
    expect(effect.createGradedRegion!.perimeterMm).toHaveLength(3);
    expect(effect.createGradedRegion!.lowerElevationMm).toBe(0);
    expect(effect.createGradedRegion!.upperElevationMm).toBe(500);
    expect(effect.stillActive).toBe(false);
  });

  it('Escape resets to idle', () => {
    let state: GradedRegionState = initialGradedRegionState();
    state = reduceGradedRegion(state, { kind: 'click', xMm: 0, yMm: 0 }).state;
    state = reduceGradedRegion(state, { kind: 'click', xMm: 5000, yMm: 0 }).state;
    expect(state.phase).toBe('sketching');

    const { state: cancelled, effect } = reduceGradedRegion(state, { kind: 'cancel' });
    expect(cancelled.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
    expect(effect.createGradedRegion).toBeUndefined();
  });
});
