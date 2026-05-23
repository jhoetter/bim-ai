import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useCoalescedSetter } from './useCoalescedSetter';

describe('PERF-H04 useCoalescedSetter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // requestAnimationFrame in vitest's jsdom routes through timers when
    // fake timers are active. We force a manual mock so the coalesce
    // queue can be drained deterministically.
    let nextHandle = 1;
    const handles = new Map<number, FrameRequestCallback>();
    (
      globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }
    ).requestAnimationFrame = (cb: FrameRequestCallback) => {
      const handle = nextHandle++;
      handles.set(handle, cb);
      return handle;
    };
    (
      globalThis as unknown as { cancelAnimationFrame: (handle: number) => void }
    ).cancelAnimationFrame = (handle: number) => {
      handles.delete(handle);
    };
    (globalThis as unknown as { __flushRaf: () => void }).__flushRaf = () => {
      const pending = Array.from(handles.values());
      handles.clear();
      for (const cb of pending) cb(performance.now());
    };
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces multiple set() calls into a single commit on the next frame', () => {
    const sink = vi.fn();
    const { result } = renderHook(() => useCoalescedSetter<number>(sink));
    act(() => {
      result.current(1);
      result.current(2);
      result.current(3);
    });
    expect(sink).not.toHaveBeenCalled();
    act(() => {
      (globalThis as unknown as { __flushRaf: () => void }).__flushRaf();
    });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(3);
  });

  it('skips the commit when the buffered value equals the last committed', () => {
    const sink = vi.fn();
    const { result } = renderHook(() => useCoalescedSetter<number>(sink));
    act(() => {
      result.current(42);
    });
    act(() => {
      (globalThis as unknown as { __flushRaf: () => void }).__flushRaf();
    });
    expect(sink).toHaveBeenCalledTimes(1);

    act(() => {
      result.current(42);
    });
    act(() => {
      (globalThis as unknown as { __flushRaf: () => void }).__flushRaf();
    });
    // No new commit because the value didn't change.
    expect(sink).toHaveBeenCalledTimes(1);

    act(() => {
      result.current(99);
    });
    act(() => {
      (globalThis as unknown as { __flushRaf: () => void }).__flushRaf();
    });
    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink).toHaveBeenLastCalledWith(99);
  });

  it('uses the caller-supplied isEqual for structural comparison', () => {
    const sink = vi.fn();
    type Sample = { id: string; index: number };
    const isEqual = (a: Sample, b: Sample): boolean => a.id === b.id && a.index === b.index;
    const { result } = renderHook(() => useCoalescedSetter<Sample>(sink, isEqual));
    act(() => result.current({ id: 'endpoint', index: 0 }));
    act(() => (globalThis as unknown as { __flushRaf: () => void }).__flushRaf());
    expect(sink).toHaveBeenCalledTimes(1);

    // Same logical value, fresh object reference — must not re-commit.
    act(() => result.current({ id: 'endpoint', index: 0 }));
    act(() => (globalThis as unknown as { __flushRaf: () => void }).__flushRaf());
    expect(sink).toHaveBeenCalledTimes(1);

    act(() => result.current({ id: 'endpoint', index: 1 }));
    act(() => (globalThis as unknown as { __flushRaf: () => void }).__flushRaf());
    expect(sink).toHaveBeenCalledTimes(2);
  });
});
