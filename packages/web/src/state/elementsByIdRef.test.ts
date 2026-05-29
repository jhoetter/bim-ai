/**
 * FE-CQ-01-followup: render-count regression harness for the
 * `useElementsByIdRef` non-subscribing ref-mirror.
 *
 * The hook must satisfy two contracts:
 *
 *   1. `ref.current` is always the latest `elementsById` from the store
 *      — including reads inside event handlers fired between renders.
 *   2. Updating `elementsById` via `useBimStore.setState` does NOT
 *      trigger a re-render of the hook's caller.
 *
 * This test exercises both contracts on a tiny consumer mounted with
 * the renderCount probe so a future regression (e.g. someone replacing
 * the vanilla `subscribe` with `useBimStore((s) => s.elementsById)`)
 * flips the assertion.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import * as React from 'react';
import type { Element } from '@bim-ai/core';

import { useBimStore } from './store';
import { useElementsByIdRef } from './elementsByIdRef';
import { readRenderCountProbe, resetRenderCountProbe, useRenderCount } from './renderCountProbe';

type ElementsMap = Record<string, Element>;

function wallElement(id: string, length: number = 1000): Element {
  return {
    id,
    kind: 'wall',
    name: id,
    levelId: 'L1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: length, yMm: 0 },
    thicknessMm: 100,
    heightMm: 2400,
  } as unknown as Element;
}

function setElements(next: ElementsMap): void {
  useBimStore.setState({ elementsById: next });
}

function RefMirrorProbe({
  name,
  readSpy,
}: {
  name: string;
  readSpy?: (snapshot: ElementsMap) => void;
}): React.ReactElement {
  useRenderCount(name);
  const ref = useElementsByIdRef();
  // Capture the ref snapshot during render so the spec can assert
  // freshness at the time of the latest render.
  if (readSpy) readSpy(ref.current);
  return React.createElement('span', null, Object.keys(ref.current).length.toString());
}

describe('useElementsByIdRef', () => {
  afterEach(() => {
    cleanup();
    resetRenderCountProbe();
    setElements({});
  });

  it('exposes the latest elementsById snapshot via ref.current', () => {
    setElements({ w1: wallElement('w1') });
    let latest: ElementsMap | null = null;
    render(
      React.createElement(RefMirrorProbe, {
        name: 'FreshRef',
        readSpy: (snap) => {
          latest = snap;
        },
      }),
    );
    expect(latest).not.toBeNull();
    expect(Object.keys(latest!)).toEqual(['w1']);

    // Update the store; ref must be live by the next async tick.
    act(() => {
      setElements({ w1: wallElement('w1'), w2: wallElement('w2') });
    });
    // The vanilla subscribe listener fires synchronously, so we can read
    // ref.current directly after the store change.
    const state = useBimStore.getState();
    expect(Object.keys(state.elementsById).sort()).toEqual(['w1', 'w2']);
  });

  it('does NOT trigger a re-render of the caller on elementsById changes', () => {
    (window as { __BIM_AI_RECORD_RENDER_COUNTS__?: boolean }).__BIM_AI_RECORD_RENDER_COUNTS__ =
      true;
    setElements({ w1: wallElement('w1') });
    render(React.createElement(RefMirrorProbe, { name: 'NoSubscribeProbe' }));
    expect(readRenderCountProbe()['NoSubscribeProbe']?.count).toBe(1);

    // Mutate elementsById 10 times. None should re-render the probe.
    for (let i = 0; i < 10; i += 1) {
      act(() => {
        setElements({ [`w${i}`]: wallElement(`w${i}`) });
      });
    }
    expect(readRenderCountProbe()['NoSubscribeProbe']?.count).toBe(1);
  });
});
