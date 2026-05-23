import { beforeEach, describe, expect, it } from 'vitest';

import {
  readViewportRebuildStats,
  recordViewportRebuild,
  resetViewportRebuildStats,
} from './viewportRebuildStats';

describe('PERF-I04 viewport rebuild stats probe', () => {
  beforeEach(() => {
    resetViewportRebuildStats();
    window.__BIM_AI_RECORD_VIEWPORT_REBUILD_STATS__ = true;
  });

  it('records diff sizes + duration on each rebuild', () => {
    recordViewportRebuild({
      addedCount: 4,
      removedCount: 1,
      changedCount: 12,
      extraDirtyCount: 3,
      rebuildMs: 8.4,
    });
    const stats = readViewportRebuildStats();
    expect(stats?.rebuildCount).toBe(1);
    expect(stats?.lastAddedCount).toBe(4);
    expect(stats?.lastRemovedCount).toBe(1);
    expect(stats?.lastChangedCount).toBe(12);
    expect(stats?.lastExtraDirtyCount).toBe(3);
    expect(stats?.lastRebuildMs).toBe(8.4);
    expect(stats?.avgRebuildMs).toBe(8.4);
    expect(stats?.totalMeshChurn).toBe(4 + 1 + 12);
  });

  it('rolls average rebuild duration via EMA', () => {
    recordViewportRebuild({
      addedCount: 1,
      removedCount: 0,
      changedCount: 0,
      extraDirtyCount: 0,
      rebuildMs: 10,
    });
    recordViewportRebuild({
      addedCount: 0,
      removedCount: 0,
      changedCount: 1,
      extraDirtyCount: 0,
      rebuildMs: 30,
    });
    const stats = readViewportRebuildStats();
    expect(stats?.rebuildCount).toBe(2);
    // EMA α=0.1: 10 + 0.1*(30-10) = 12
    expect(stats?.avgRebuildMs).toBeCloseTo(12, 5);
  });

  it('accumulates totalMeshChurn across rebuilds', () => {
    recordViewportRebuild({
      addedCount: 2,
      removedCount: 1,
      changedCount: 3,
      extraDirtyCount: 0,
      rebuildMs: 5,
    });
    recordViewportRebuild({
      addedCount: 0,
      removedCount: 0,
      changedCount: 7,
      extraDirtyCount: 2,
      rebuildMs: 5,
    });
    expect(readViewportRebuildStats()?.totalMeshChurn).toBe(2 + 1 + 3 + 0 + 0 + 7);
  });
});
