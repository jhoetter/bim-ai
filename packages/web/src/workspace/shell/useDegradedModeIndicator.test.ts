import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDegradedModeIndicator } from './useDegradedModeIndicator';

describe('PERF-L05 useDegradedModeIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (
      window as unknown as { __BIM_AI_VIEWPORT_FRAME_STATS__?: unknown }
    ).__BIM_AI_VIEWPORT_FRAME_STATS__ = undefined;
    (
      window as unknown as { __BIM_AI_VIEWPORT_REBUILD_STATS__?: unknown }
    ).__BIM_AI_VIEWPORT_REBUILD_STATS__ = undefined;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays inactive when no probe data is present', () => {
    const { result } = renderHook(() =>
      useDegradedModeIndicator({ frameBudgetMs: 33, windowSeconds: 2, pollMs: 100 }),
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.active).toBe(false);
  });

  it('flips to active after `windowSeconds` consecutive frame-budget violations', () => {
    (
      window as unknown as { __BIM_AI_VIEWPORT_FRAME_STATS__: unknown }
    ).__BIM_AI_VIEWPORT_FRAME_STATS__ = {
      frameCount: 10,
      avgFrameIntervalMs: 60, // ~16 fps — way over the 33ms budget
    };
    const { result } = renderHook(() =>
      useDegradedModeIndicator({ frameBudgetMs: 33, windowSeconds: 2, pollMs: 100 }),
    );
    // First tick is synchronous in the effect; one more poll lands a 2nd bad sample.
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.active).toBe(true);
    expect(result.current.reason?.kind).toBe('frame_time');
  });

  it('flips back to inactive after `windowSeconds` consecutive recovered samples', () => {
    (
      window as unknown as { __BIM_AI_VIEWPORT_FRAME_STATS__: unknown }
    ).__BIM_AI_VIEWPORT_FRAME_STATS__ = {
      frameCount: 10,
      avgFrameIntervalMs: 60,
    };
    const { result } = renderHook(() =>
      useDegradedModeIndicator({ frameBudgetMs: 33, windowSeconds: 2, pollMs: 100 }),
    );
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.active).toBe(true);

    // Recover: frame interval back under budget.
    (
      window as unknown as { __BIM_AI_VIEWPORT_FRAME_STATS__: unknown }
    ).__BIM_AI_VIEWPORT_FRAME_STATS__ = {
      frameCount: 20,
      avgFrameIntervalMs: 16,
    };
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.active).toBe(false);
    expect(result.current.reason).toBeNull();
  });

  it('reports rebuild_churn when the PERF-I04 stats are over budget', () => {
    (
      window as unknown as { __BIM_AI_VIEWPORT_REBUILD_STATS__: unknown }
    ).__BIM_AI_VIEWPORT_REBUILD_STATS__ = {
      rebuildCount: 5,
      avgRebuildMs: 120,
    };
    const { result } = renderHook(() =>
      useDegradedModeIndicator({
        frameBudgetMs: 33,
        rebuildBudgetMs: 50,
        windowSeconds: 1,
        pollMs: 100,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(result.current.active).toBe(true);
    expect(result.current.reason?.kind).toBe('rebuild_churn');
  });
});
