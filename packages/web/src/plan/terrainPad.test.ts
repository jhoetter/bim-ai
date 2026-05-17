import { describe, expect, it } from 'vitest';
import { initialTerrainPadState, reduceTerrainPad } from '../tools/toolGrammar';

describe('terrain pad — §5.1.4', () => {
  it('grammar starts in idle state', () => {
    const state = initialTerrainPadState();
    expect(state.phase).toBe('idle');
  });

  it('click adds a boundary point', () => {
    let state = initialTerrainPadState();
    // activate first
    ({ state } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-1',
      elevationMm: 0,
    }));
    expect(state.phase).toBe('sketching');
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 1000, yMm: 2000 }));
    expect(state.phase).toBe('sketching');
    if (state.phase === 'sketching') {
      expect(state.points).toHaveLength(1);
      expect(state.points[0]).toEqual({ xMm: 1000, yMm: 2000 });
    }
  });

  it('commit with <3 points is rejected', () => {
    let state = initialTerrainPadState();
    ({ state } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-1',
      elevationMm: 0,
    }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 0, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 1000, yMm: 0 }));
    const { effect } = reduceTerrainPad(state, { kind: 'commit' });
    expect(effect.createTerrainPad).toBeUndefined();
  });

  it('commit with 3+ points emits createTerrainPad effect', () => {
    let state = initialTerrainPadState();
    ({ state } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-abc',
      elevationMm: 1500,
    }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 0, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 5000, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 5000, yMm: 4000 }));
    const { effect } = reduceTerrainPad(state, { kind: 'commit' });
    expect(effect.createTerrainPad).toBeDefined();
    expect(effect.createTerrainPad!.toposolidId).toBe('topo-abc');
    expect(effect.createTerrainPad!.boundaryMm).toHaveLength(3);
    expect(effect.createTerrainPad!.elevationMm).toBe(1500);
  });

  it('escape cancels and resets to idle', () => {
    let state = initialTerrainPadState();
    ({ state } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-1',
      elevationMm: 0,
    }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 0, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 1000, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'cancel' }));
    expect(state.phase).toBe('idle');
  });
});
