/**
 * PERF-I04: dev-only mesh-rebuild instrumentation.
 *
 * `useViewportSceneEffects.ts` runs a single useEffect that diffs the latest
 * `elementsById` against the previous snapshot and surgically adds, updates,
 * or removes Three.js meshes. This module records timing + diff sizes for
 * each invocation so Playwright / dev probes can read rebuild cadence and
 * mesh churn after a UI scenario.
 *
 * Stats accumulate in `window.__BIM_AI_VIEWPORT_REBUILD_STATS__`. Recording
 * auto-enables in DEV / Vitest; production builds no-op unless
 * `window.__BIM_AI_RECORD_VIEWPORT_REBUILD_STATS__` is forced true.
 */

export type ViewportRebuildSample = {
  /** How many rebuild passes have run since the probe was reset. */
  rebuildCount: number;
  /** Diff sizes for the most recent rebuild. */
  lastAddedCount: number;
  lastRemovedCount: number;
  lastChangedCount: number;
  /**
   * IDs marked dirty by dependency propagation (e.g. a wall change that
   * dirties its hosted openings). Counted *after* propagation but
   * separately from `lastChangedCount` so callers see how much of the
   * dirty set was direct vs. propagated.
   */
  lastExtraDirtyCount: number;
  /** Wall-clock duration of the most recent rebuild pass, in ms. */
  lastRebuildMs: number;
  /** Rolling average rebuild duration (EMA α=0.1, ms). */
  avgRebuildMs: number;
  /** Sum of added+removed+changed across all recorded rebuilds. */
  totalMeshChurn: number;
  /** `performance.now()` of the most recent rebuild. */
  lastRebuildAt: number;
};

declare global {
  interface Window {
    __BIM_AI_RECORD_VIEWPORT_REBUILD_STATS__?: boolean;
    __BIM_AI_VIEWPORT_REBUILD_STATS__?: ViewportRebuildSample;
  }
}

const EMA_ALPHA = 0.1;

function shouldRecord(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__BIM_AI_RECORD_VIEWPORT_REBUILD_STATS__ === true) return true;
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function ema(previous: number, sample: number, count: number): number {
  if (count <= 1) return sample;
  return previous + EMA_ALPHA * (sample - previous);
}

export type RebuildDiff = {
  addedCount: number;
  removedCount: number;
  changedCount: number;
  extraDirtyCount: number;
  rebuildMs: number;
};

export function recordViewportRebuild(diff: RebuildDiff): void {
  if (!shouldRecord()) return;
  const prev = window.__BIM_AI_VIEWPORT_REBUILD_STATS__;
  const nextCount = (prev?.rebuildCount ?? 0) + 1;
  const avgRebuildMs = ema(prev?.avgRebuildMs ?? diff.rebuildMs, diff.rebuildMs, nextCount);
  const totalMeshChurn =
    (prev?.totalMeshChurn ?? 0) + diff.addedCount + diff.removedCount + diff.changedCount;
  window.__BIM_AI_VIEWPORT_REBUILD_STATS__ = {
    rebuildCount: nextCount,
    lastAddedCount: diff.addedCount,
    lastRemovedCount: diff.removedCount,
    lastChangedCount: diff.changedCount,
    lastExtraDirtyCount: diff.extraDirtyCount,
    lastRebuildMs: diff.rebuildMs,
    avgRebuildMs,
    totalMeshChurn,
    lastRebuildAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
  };
}

export function readViewportRebuildStats(): ViewportRebuildSample | null {
  if (typeof window === 'undefined') return null;
  return window.__BIM_AI_VIEWPORT_REBUILD_STATS__ ?? null;
}

export function resetViewportRebuildStats(): void {
  if (typeof window === 'undefined') return;
  window.__BIM_AI_VIEWPORT_REBUILD_STATS__ = undefined;
}
