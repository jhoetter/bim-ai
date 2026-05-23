/**
 * PERF-H04: wrap a React setState so pointer-event-driven UI state
 * updates coalesce to animation-frame cadence and skip redundant
 * commits (last-write-wins with deep-equality compare).
 *
 * Pointermove handlers can fire faster than the browser paints, so a
 * naive setState chain triggers an extra render per event. This hook
 * buffers the latest value in a ref and commits it on the next
 * requestAnimationFrame; if the buffered value equals the last
 * committed value (per the caller's `isEqual`), the commit is skipped.
 *
 * On unmount the pending frame is cancelled so we don't leak callbacks
 * after the component is gone.
 */
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

export type CoalescedSetter<T> = (value: T) => void;
type WrappedSetter<T> = Dispatch<SetStateAction<T>> | ((value: T) => void);

type State<T> = {
  raf: number | null;
  pending: { value: T } | null;
  lastCommitted: { value: T } | null;
};

export function useCoalescedSetter<T>(
  setter: WrappedSetter<T>,
  isEqual: (a: T, b: T) => boolean = Object.is,
): CoalescedSetter<T> {
  const setterRef = useRef(setter);
  setterRef.current = setter;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;
  const stateRef = useRef<State<T>>({ raf: null, pending: null, lastCommitted: null });

  useEffect(() => {
    const state = stateRef.current;
    return () => {
      if (state.raf !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(state.raf);
      }
      state.raf = null;
      state.pending = null;
    };
  }, []);

  return useCallback((value: T) => {
    const state = stateRef.current;
    state.pending = { value };
    if (state.raf !== null) return;
    if (typeof requestAnimationFrame === 'undefined') {
      // jsdom / SSR fallback: flush synchronously so tests don't hang.
      const pending = state.pending;
      state.pending = null;
      if (
        pending !== null &&
        (state.lastCommitted === null ||
          !isEqualRef.current(pending.value, state.lastCommitted.value))
      ) {
        state.lastCommitted = { value: pending.value };
        setterRef.current(pending.value);
      }
      return;
    }
    state.raf = requestAnimationFrame(() => {
      state.raf = null;
      const pending = state.pending;
      state.pending = null;
      if (pending === null) return;
      const last = state.lastCommitted;
      if (last !== null && isEqualRef.current(pending.value, last.value)) return;
      state.lastCommitted = { value: pending.value };
      setterRef.current(pending.value);
    });
  }, []);
}
