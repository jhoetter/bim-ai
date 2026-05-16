import { describe, expect, it } from 'vitest';
import { initialExcavationState, reduceExcavation } from '../tools/toolGrammar';

describe('reduceExcavation', () => {
  it('3 clicks then Enter emits createExcavationEffect', () => {
    let s = initialExcavationState();
    const pts = [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
    ];
    for (const pt of pts) {
      const r = reduceExcavation(s, { kind: 'click', pointMm: pt });
      s = r.state;
    }
    const { effect } = reduceExcavation(s, { kind: 'close-loop' });
    expect(effect.createExcavationEffect).toBeDefined();
    expect(effect.createExcavationEffect!.boundaryMm).toHaveLength(3);
    expect(effect.createExcavationEffect!.depthMm).toBeGreaterThan(0);
  });

  it('Escape clears in-flight vertices and stays active', () => {
    let s = initialExcavationState();
    s = reduceExcavation(s, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    s = reduceExcavation(s, { kind: 'click', pointMm: { xMm: 1000, yMm: 0 } }).state;
    const { state, effect } = reduceExcavation(s, { kind: 'cancel' });
    expect(state.verticesMm).toHaveLength(0);
    expect(state.phase).toBe('idle');
    expect(effect.stillActive).toBe(true);
  });

  it('close-loop with fewer than 3 vertices produces no effect', () => {
    let s = initialExcavationState();
    s = reduceExcavation(s, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    s = reduceExcavation(s, { kind: 'click', pointMm: { xMm: 2000, yMm: 0 } }).state;
    const { effect } = reduceExcavation(s, { kind: 'close-loop' });
    expect(effect.createExcavationEffect).toBeUndefined();
  });
});
