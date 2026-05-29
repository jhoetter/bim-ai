/**
 * FE-CQ-01-followup — non-subscribing ref-mirror for `elementsById`.
 *
 * Returns a `MutableRefObject` whose `.current` is always the latest
 * `elementsById` map from the store. Updates are wired via Zustand's
 * vanilla `subscribe` (no React notification), so this hook itself
 * never triggers a re-render of its caller — unlike
 * `useBimStore((s) => s.elementsById)`, which fires a render on every
 * authoring delta.
 *
 * Use this in render-path code that needs to *look up* an element by id
 * but does NOT need to re-render when the map changes. Typical sites:
 *
 *   - `useMemo`/`useEffect` callbacks that read `elementsById[someId]`
 *     and key on something else (selectedId, activePlanViewId, …).
 *   - Tab-title / breadcrumb derivations keyed on a small selector.
 *
 * For event handlers (click, key, drop) prefer the one-shot
 * `useBimStore.getState().elementsById[id]` — that doesn't even need a
 * ref. For renders that *do* need reactivity (the inspector / advisor
 * counts) keep using `useBimStore((s) => s.elementsById)` directly.
 *
 * The pattern mirrors PERF-G05 in Viewport.tsx (`wallsByLevelRef`),
 * extended with vanilla `subscribe` so no broad React subscription
 * remains.
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Element } from '@bim-ai/core';

import { useBimStore } from './store';

export function useElementsByIdRef(): MutableRefObject<Record<string, Element>> {
  const ref = useRef<Record<string, Element>>(useBimStore.getState().elementsById);
  // Seed eagerly so synchronous render-path reads on first mount see the
  // current snapshot rather than a stale one (the initial ref value
  // captures store state at component creation, but if the store updates
  // between component creation and the first useEffect tick we want the
  // very latest value before the render commits).
  ref.current = useBimStore.getState().elementsById;
  useEffect(() => {
    // Zustand's vanilla `subscribe` does NOT cause a React re-render —
    // it just runs the listener. That is exactly what we want: keep the
    // ref fresh through every delta without forcing this hook's caller
    // to re-render.
    const unsubscribe = useBimStore.subscribe((state) => {
      ref.current = state.elementsById;
    });
    return unsubscribe;
  }, []);
  return ref;
}
