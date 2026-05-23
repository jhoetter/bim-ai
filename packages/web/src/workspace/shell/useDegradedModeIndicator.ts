/**
 * PERF-L05: surface a degraded-mode indicator when the viewport's
 * frame-time probe (PERF-I03) reports sustained budget violations.
 *
 * Polls `window.__BIM_AI_VIEWPORT_FRAME_STATS__` once a second and
 * flips into "degraded" when the rolling-EMA frame interval has
 * exceeded `frameBudgetMs` for `windowSeconds` consecutive polls.
 * Flips back when the budget recovers for the same window.
 *
 * No-op outside the browser. Defaults match a 30 fps soft floor.
 */
import { useEffect, useState } from 'react';

export type DegradedModeReason =
  | { kind: 'frame_time'; avgFrameIntervalMs: number; budgetMs: number }
  | { kind: 'rebuild_churn'; avgRebuildMs: number; budgetMs: number };

export type DegradedModeState = {
  active: boolean;
  reason: DegradedModeReason | null;
};

const INACTIVE: DegradedModeState = Object.freeze({ active: false, reason: null });

type FrameStats = {
  avgFrameIntervalMs?: number;
  frameCount?: number;
};

type RebuildStats = {
  avgRebuildMs?: number;
  rebuildCount?: number;
};

export function useDegradedModeIndicator(opts?: {
  frameBudgetMs?: number;
  rebuildBudgetMs?: number;
  windowSeconds?: number;
  pollMs?: number;
}): DegradedModeState {
  const frameBudgetMs = opts?.frameBudgetMs ?? 33.3; // 30 fps soft floor
  const rebuildBudgetMs = opts?.rebuildBudgetMs ?? 50; // mesh-rebuild ceiling
  const windowSeconds = opts?.windowSeconds ?? 3;
  const pollMs = opts?.pollMs ?? 1_000;
  const [state, setState] = useState<DegradedModeState>(INACTIVE);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let consecutiveBad = 0;
    let consecutiveGood = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = (): void => {
      const frame = (window as unknown as { __BIM_AI_VIEWPORT_FRAME_STATS__?: FrameStats })
        .__BIM_AI_VIEWPORT_FRAME_STATS__;
      const rebuild = (window as unknown as { __BIM_AI_VIEWPORT_REBUILD_STATS__?: RebuildStats })
        .__BIM_AI_VIEWPORT_REBUILD_STATS__;
      let reason: DegradedModeReason | null = null;
      if (frame && (frame.frameCount ?? 0) > 0 && (frame.avgFrameIntervalMs ?? 0) > frameBudgetMs) {
        reason = {
          kind: 'frame_time',
          avgFrameIntervalMs: frame.avgFrameIntervalMs ?? 0,
          budgetMs: frameBudgetMs,
        };
      } else if (
        rebuild &&
        (rebuild.rebuildCount ?? 0) > 0 &&
        (rebuild.avgRebuildMs ?? 0) > rebuildBudgetMs
      ) {
        reason = {
          kind: 'rebuild_churn',
          avgRebuildMs: rebuild.avgRebuildMs ?? 0,
          budgetMs: rebuildBudgetMs,
        };
      }
      if (reason) {
        consecutiveBad += 1;
        consecutiveGood = 0;
        if (consecutiveBad >= windowSeconds) {
          setState((prev) =>
            prev.active && prev.reason?.kind === reason!.kind
              ? prev
              : { active: true, reason: reason! },
          );
        }
      } else {
        consecutiveGood += 1;
        consecutiveBad = 0;
        if (consecutiveGood >= windowSeconds) {
          setState((prev) => (prev.active ? INACTIVE : prev));
        }
      }
    };

    timer = setInterval(tick, pollMs);
    tick();
    return () => {
      if (timer !== null) clearInterval(timer);
    };
  }, [frameBudgetMs, rebuildBudgetMs, windowSeconds, pollMs]);

  return state;
}
