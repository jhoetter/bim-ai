import { describe, expect, it } from 'vitest';

import { initialRoofByExtrusionState, reduceRoofByExtrusion } from './toolGrammar';

const LEVEL = 'level-1';

describe('G2 — roof-by-extrusion grammar', () => {
  it('starts in idle; activate moves to recording', () => {
    const s0 = initialRoofByExtrusionState();
    expect(s0.phase).toBe('idle');

    const { state } = reduceRoofByExtrusion(s0, { kind: 'activate' }, LEVEL);
    expect(state.phase).toBe('recording');
  });

  it('3 clicks + Enter → confirm-depth state', () => {
    let { state } = reduceRoofByExtrusion(
      initialRoofByExtrusionState(),
      { kind: 'activate' },
      LEVEL,
    );
    state = reduceRoofByExtrusion(state, { kind: 'click', xMm: 0, yMm: 0 }, LEVEL).state;
    state = reduceRoofByExtrusion(state, { kind: 'click', xMm: 5000, yMm: 0 }, LEVEL).state;
    state = reduceRoofByExtrusion(state, { kind: 'click', xMm: 5000, yMm: 4000 }, LEVEL).state;

    const { state: s2 } = reduceRoofByExtrusion(state, { kind: 'enter' }, LEVEL);
    expect(s2.phase).toBe('confirm-depth');
    if (s2.phase === 'confirm-depth') {
      expect(s2.points).toHaveLength(3);
    }
  });

  it('confirm-depth: type 3000 + Enter → createRoofByExtrusion effect', () => {
    let { state } = reduceRoofByExtrusion(
      initialRoofByExtrusionState(),
      { kind: 'activate' },
      LEVEL,
    );
    state = reduceRoofByExtrusion(state, { kind: 'click', xMm: 0, yMm: 0 }, LEVEL).state;
    state = reduceRoofByExtrusion(state, { kind: 'click', xMm: 5000, yMm: 0 }, LEVEL).state;

    // move to confirm-depth
    state = reduceRoofByExtrusion(state, { kind: 'enter' }, LEVEL).state;
    expect(state.phase).toBe('confirm-depth');

    // type depth
    state = reduceRoofByExtrusion(state, { kind: 'set-depth', value: '3000' }, LEVEL).state;

    // confirm
    const { state: final, effect } = reduceRoofByExtrusion(state, { kind: 'enter' }, LEVEL);
    expect(effect.createRoofByExtrusion).toBeDefined();
    expect(effect.createRoofByExtrusion?.depthMm).toBe(3000);
    expect(effect.createRoofByExtrusion?.profilePoints).toHaveLength(2);
    expect(effect.createRoofByExtrusion?.levelId).toBe(LEVEL);
    expect(effect.stillActive).toBe(false);
    expect(final.phase).toBe('idle');
  });

  it('Escape in recording → idle + stillActive false', () => {
    let { state } = reduceRoofByExtrusion(
      initialRoofByExtrusionState(),
      { kind: 'activate' },
      LEVEL,
    );
    state = reduceRoofByExtrusion(state, { kind: 'click', xMm: 0, yMm: 0 }, LEVEL).state;

    const { state: escaped, effect } = reduceRoofByExtrusion(state, { kind: 'escape' }, LEVEL);
    expect(escaped.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });

  it('double-click with ≥2 points → confirm-depth', () => {
    let { state } = reduceRoofByExtrusion(
      initialRoofByExtrusionState(),
      { kind: 'activate' },
      LEVEL,
    );
    state = reduceRoofByExtrusion(state, { kind: 'click', xMm: 0, yMm: 0 }, LEVEL).state;
    state = reduceRoofByExtrusion(state, { kind: 'click', xMm: 3000, yMm: 0 }, LEVEL).state;

    const { state: s2 } = reduceRoofByExtrusion(
      state,
      { kind: 'double-click', xMm: 3000, yMm: 0 },
      LEVEL,
    );
    expect(s2.phase).toBe('confirm-depth');
  });
});
