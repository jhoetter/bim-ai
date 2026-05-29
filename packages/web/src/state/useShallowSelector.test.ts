/**
 * PERF-G06: regression test for the shallow-equality selector contract.
 *
 * Verifies that `useShallowSelector` survives store rewrites which
 * produce a fresh object whose contents are reference-stable. Without
 * shallow equality, the consumer would re-render on every set call.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { create } from 'zustand';

import { useShallowSelector } from '@bim-ai/web-state';

type Counter = { a: number; b: number; nudge: () => void };

const useStore = create<Counter>((set) => ({
  a: 1,
  b: 2,
  nudge: () => set((s) => ({ a: s.a, b: s.b })),
}));

describe('useShallowSelector', () => {
  it('does not re-fire when the projected fields are unchanged', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useStore(useShallowSelector((s) => ({ a: s.a, b: s.b })));
    });
    expect(renderCount).toBe(1);
    expect(result.current).toEqual({ a: 1, b: 2 });
    act(() => {
      useStore.getState().nudge();
      useStore.getState().nudge();
      useStore.getState().nudge();
    });
    // Without shallow equality each nudge would trigger a re-render even
    // though the selected fields didn't change.
    expect(renderCount).toBe(1);
  });

  it('fires when one of the projected fields actually changes', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useStore(useShallowSelector((s) => ({ a: s.a, b: s.b })));
    });
    expect(renderCount).toBe(1);
    act(() => {
      useStore.setState({ a: 99 });
    });
    expect(renderCount).toBe(2);
    expect(result.current.a).toBe(99);
  });
});
