/**
 * §8.6.2 — Stair by Component
 * Tests for reduceStairRun and reduceStairLanding grammars.
 */

import { describe, expect, it } from 'vitest';
import {
  initialStairRunState,
  reduceStairRun,
  initialStairLandingState,
  reduceStairLanding,
  type StairRunState,
  type StairLandingState,
} from '../tools/toolGrammar';

const pt1 = { xMm: 0, yMm: 0 };
const pt2 = { xMm: 3000, yMm: 0 };
const pt3 = { xMm: 3000, yMm: 1200 };
const pt4 = { xMm: 0, yMm: 1200 };

describe('reduceStairRun — §8.6.2', () => {
  it('starts in idle state', () => {
    const state = initialStairRunState();
    expect(state.phase).toBe('idle');
  });

  it('activate moves to pick-stair', () => {
    const state = initialStairRunState();
    const { state: next } = reduceStairRun(state, { kind: 'activate' });
    expect(next.phase).toBe('pick-stair');
  });

  it('two clicks after picking stair emit addStairRun', () => {
    // Start in idle → activate → pick-stair
    let state: StairRunState = initialStairRunState();
    ({ state } = reduceStairRun(state, { kind: 'activate' }));
    expect(state.phase).toBe('pick-stair');

    // Click to pick stair
    const stairId = 'stair-001';
    ({ state } = reduceStairRun(state, { kind: 'click', pointMm: pt1, elementId: stairId }));
    expect(state.phase).toBe('place-start');
    if (state.phase === 'place-start') {
      expect(state.stairId).toBe(stairId);
    }

    // Click to place start point
    ({ state } = reduceStairRun(state, { kind: 'click', pointMm: pt1 }));
    expect(state.phase).toBe('place-end');

    // Click to place end point — should emit effect
    const { state: final, effect } = reduceStairRun(state, { kind: 'click', pointMm: pt2 });
    expect(final.phase).toBe('idle');
    expect(effect?.kind).toBe('addStairRun');
    if (effect?.kind === 'addStairRun') {
      expect(effect.run.stairId).toBe(stairId);
      expect(effect.run.startMm).toEqual(pt1);
      expect(effect.run.endMm).toEqual(pt2);
      expect(typeof effect.run.riserCount).toBe('number');
      expect(typeof effect.run.runWidthMm).toBe('number');
    }
  });

  it('Escape from place-start returns to idle', () => {
    let state: StairRunState = initialStairRunState();
    ({ state } = reduceStairRun(state, { kind: 'activate' }));
    ({ state } = reduceStairRun(state, { kind: 'click', pointMm: pt1, elementId: 'stair-001' }));
    expect(state.phase).toBe('place-start');

    const { state: after } = reduceStairRun(state, { kind: 'escape' });
    expect(after.phase).toBe('idle');
  });
});

describe('reduceStairLanding — §8.6.2', () => {
  it('starts in idle state', () => {
    const state = initialStairLandingState();
    expect(state.phase).toBe('idle');
  });

  it('sketching accumulates points', () => {
    let state: StairLandingState = initialStairLandingState();
    ({ state } = reduceStairLanding(state, { kind: 'activate' }));
    expect(state.phase).toBe('pick-stair');

    // Pick stair
    ({ state } = reduceStairLanding(state, {
      kind: 'click',
      pointMm: pt1,
      elementId: 'stair-001',
    }));
    expect(state.phase).toBe('sketching');

    // Add points
    ({ state } = reduceStairLanding(state, { kind: 'click', pointMm: pt1 }));
    ({ state } = reduceStairLanding(state, { kind: 'click', pointMm: pt2 }));
    ({ state } = reduceStairLanding(state, { kind: 'click', pointMm: pt3 }));
    if (state.phase === 'sketching') {
      expect(state.points.length).toBe(3);
    }
  });

  it('Enter with 3+ points emits addStairLanding', () => {
    let state: StairLandingState = initialStairLandingState();
    ({ state } = reduceStairLanding(state, { kind: 'activate' }));
    ({ state } = reduceStairLanding(state, {
      kind: 'click',
      pointMm: pt1,
      elementId: 'stair-001',
    }));
    ({ state } = reduceStairLanding(state, { kind: 'click', pointMm: pt1 }));
    ({ state } = reduceStairLanding(state, { kind: 'click', pointMm: pt2 }));
    ({ state } = reduceStairLanding(state, { kind: 'click', pointMm: pt3 }));

    const { state: final, effect } = reduceStairLanding(state, { kind: 'enter' });
    expect(final.phase).toBe('idle');
    expect(effect?.kind).toBe('addStairLanding');
    if (effect?.kind === 'addStairLanding') {
      expect(effect.landing.stairId).toBe('stair-001');
      expect(effect.landing.perimeterMm.length).toBe(3);
    }
  });

  it('Enter with fewer than 3 points does nothing', () => {
    let state: StairLandingState = initialStairLandingState();
    ({ state } = reduceStairLanding(state, { kind: 'activate' }));
    ({ state } = reduceStairLanding(state, {
      kind: 'click',
      pointMm: pt1,
      elementId: 'stair-001',
    }));
    // Add only 2 points
    ({ state } = reduceStairLanding(state, { kind: 'click', pointMm: pt1 }));
    ({ state } = reduceStairLanding(state, { kind: 'click', pointMm: pt2 }));

    const { state: after, effect } = reduceStairLanding(state, { kind: 'enter' });
    expect(effect).toBeUndefined();
    expect(after.phase).toBe('sketching');
  });
});
