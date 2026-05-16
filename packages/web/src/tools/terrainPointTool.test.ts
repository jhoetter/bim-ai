import { describe, it, expect } from 'vitest';
import {
  initialTerrainPointState,
  reduceTerrainPoint,
  type TerrainPointState,
} from './toolGrammar';

describe('terrain point grammar — §5.1.1 + §5.1.2', () => {
  it('activate transitions from idle to active', () => {
    const state = initialTerrainPointState();
    const { state: next } = reduceTerrainPoint(state, {
      kind: 'activate',
      toposolidId: 'topo-1',
    });
    expect(next.phase).toBe('active');
    if (next.phase === 'active') {
      expect(next.toposolidId).toBe('topo-1');
      expect(next.pendingSamples).toHaveLength(0);
    }
  });

  it('click appends a sample to pendingSamples', () => {
    const idle = initialTerrainPointState();
    const { state: active } = reduceTerrainPoint(idle, {
      kind: 'activate',
      toposolidId: 'topo-1',
    });
    const { state: after, effect } = reduceTerrainPoint(active, {
      kind: 'click',
      xMm: 1000,
      yMm: 2000,
    });
    expect(after.phase).toBe('active');
    if (after.phase === 'active') {
      expect(after.pendingSamples).toHaveLength(1);
      expect(after.pendingSamples[0]).toEqual({ xMm: 1000, yMm: 2000, zMm: 0 });
    }
    expect(effect.previewTerrainPoints).toHaveLength(1);
  });

  it('commit emits addTerrainPoints with accumulated samples', () => {
    const idle = initialTerrainPointState();
    const { state: active } = reduceTerrainPoint(idle, {
      kind: 'activate',
      toposolidId: 'topo-42',
    });
    const { state: s1 } = reduceTerrainPoint(active, { kind: 'click', xMm: 100, yMm: 200 });
    const { state: s2 } = reduceTerrainPoint(s1, { kind: 'click', xMm: 300, yMm: 400 });
    const { state: final, effect } = reduceTerrainPoint(s2, { kind: 'commit' });
    expect(final.phase).toBe('idle');
    expect(effect.addTerrainPoints).toBeDefined();
    expect(effect.addTerrainPoints?.toposolidId).toBe('topo-42');
    expect(effect.addTerrainPoints?.samples).toHaveLength(2);
    expect(effect.addTerrainPoints?.samples[0]).toEqual({ xMm: 100, yMm: 200, zMm: 0 });
    expect(effect.addTerrainPoints?.samples[1]).toEqual({ xMm: 300, yMm: 400, zMm: 0 });
  });

  it('cancel from active returns to idle', () => {
    const idle = initialTerrainPointState();
    const { state: active } = reduceTerrainPoint(idle, {
      kind: 'activate',
      toposolidId: 'topo-1',
    });
    const { state: after } = reduceTerrainPoint(active, { kind: 'cancel' });
    expect(after.phase).toBe('idle');
  });

  it('multiple clicks accumulate multiple samples', () => {
    let state: TerrainPointState = initialTerrainPointState();
    ({ state } = reduceTerrainPoint(state, { kind: 'activate', toposolidId: 'topo-1' }));
    ({ state } = reduceTerrainPoint(state, { kind: 'click', xMm: 0, yMm: 0 }));
    ({ state } = reduceTerrainPoint(state, { kind: 'click', xMm: 500, yMm: 500 }));
    const { state: after, effect } = reduceTerrainPoint(state, {
      kind: 'click',
      xMm: 1000,
      yMm: 1000,
    });
    expect(after.phase).toBe('active');
    if (after.phase === 'active') {
      expect(after.pendingSamples).toHaveLength(3);
    }
    expect(effect.previewTerrainPoints).toHaveLength(3);
  });
});
