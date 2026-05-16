import { describe, it, expect } from 'vitest';
import { initialTerrainPadState, reduceTerrainPad, type TerrainPadState } from './toolGrammar';

describe('terrain pad grammar — §5.1.4', () => {
  it('activate moves to sketching phase', () => {
    const state = initialTerrainPadState();
    const { state: next } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-1',
      elevationMm: 500,
    });
    expect(next.phase).toBe('sketching');
    if (next.phase === 'sketching') {
      expect(next.toposolidId).toBe('topo-1');
      expect(next.elevationMm).toBe(500);
      expect(next.points).toHaveLength(0);
    }
  });

  it('click appends boundary points', () => {
    let state: TerrainPadState = initialTerrainPadState();
    ({ state } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-1',
      elevationMm: 0,
    }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 1000, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 1000, yMm: 1000 }));
    expect(state.phase).toBe('sketching');
    if (state.phase === 'sketching') {
      expect(state.points).toHaveLength(2);
      expect(state.points[0]).toEqual({ xMm: 1000, yMm: 0 });
      expect(state.points[1]).toEqual({ xMm: 1000, yMm: 1000 });
    }
  });

  it('commit with ≥3 points emits createTerrainPad', () => {
    let state: TerrainPadState = initialTerrainPadState();
    ({ state } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-42',
      elevationMm: 1200,
    }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 0, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 5000, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 5000, yMm: 5000 }));
    const { state: final, effect } = reduceTerrainPad(state, { kind: 'commit' });
    expect(final.phase).toBe('idle');
    expect(effect.createTerrainPad).toBeDefined();
    expect(effect.createTerrainPad?.toposolidId).toBe('topo-42');
    expect(effect.createTerrainPad?.elevationMm).toBe(1200);
    expect(effect.createTerrainPad?.boundaryMm).toHaveLength(3);
  });

  it('commit with <3 points does nothing', () => {
    let state: TerrainPadState = initialTerrainPadState();
    ({ state } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-1',
      elevationMm: 0,
    }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 0, yMm: 0 }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 1000, yMm: 0 }));
    const { state: after, effect } = reduceTerrainPad(state, { kind: 'commit' });
    expect(after.phase).toBe('sketching');
    expect(effect.createTerrainPad).toBeUndefined();
    expect(effect.stillActive).toBe(true);
  });

  it('cancel returns to idle', () => {
    let state: TerrainPadState = initialTerrainPadState();
    ({ state } = reduceTerrainPad(state, {
      kind: 'activate',
      toposolidId: 'topo-1',
      elevationMm: 0,
    }));
    ({ state } = reduceTerrainPad(state, { kind: 'click', xMm: 0, yMm: 0 }));
    const { state: after } = reduceTerrainPad(state, { kind: 'cancel' });
    expect(after.phase).toBe('idle');
  });
});
