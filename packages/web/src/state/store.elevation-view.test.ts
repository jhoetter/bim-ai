import { afterEach, describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { useBimStore } from './store';

afterEach(() => {
  useBimStore.setState({
    activePlanViewId: undefined,
    activeViewpointId: undefined,
    activeElevationViewId: undefined,
    activeLevelId: undefined,
    elementsById: {},
    temporaryVisibility: null,
  });
});

const ev: Element = {
  kind: 'elevation_view',
  id: 'ev-N',
  name: 'North',
  direction: 'north',
};

describe('VIE-03 — activateElevationView store action', () => {
  it('sets activeElevationViewId and clears plan view + viewpoint', () => {
    useBimStore.setState({
      elementsById: { 'ev-N': ev },
      activePlanViewId: 'pv-1',
      activeViewpointId: 'vp-1',
    });
    useBimStore.getState().activateElevationView('ev-N');
    const s = useBimStore.getState();
    expect(s.activeElevationViewId).toBe('ev-N');
    expect(s.activePlanViewId).toBeUndefined();
    expect(s.activeViewpointId).toBeUndefined();
    expect(s.viewerMode).toBe('plan_canvas');
  });

  it('passing undefined closes the active elevation view', () => {
    useBimStore.setState({
      elementsById: { 'ev-N': ev },
      activeElevationViewId: 'ev-N',
    });
    useBimStore.getState().activateElevationView(undefined);
    expect(useBimStore.getState().activeElevationViewId).toBeUndefined();
  });

  it('ignores ids that are not elevation_view', () => {
    const wall: Element = {
      kind: 'wall',
      id: 'w-1',
      name: 'W',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 1000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };
    useBimStore.setState({ elementsById: { 'w-1': wall } });
    useBimStore.getState().activateElevationView('w-1');
    expect(useBimStore.getState().activeElevationViewId).toBeUndefined();
  });

  it('clears temporaryVisibility on view switch', () => {
    useBimStore.setState({
      elementsById: { 'ev-N': ev },
      temporaryVisibility: { viewId: 'pv-other', mode: 'isolate', categories: ['wall'] },
    });
    useBimStore.getState().activateElevationView('ev-N');
    expect(useBimStore.getState().temporaryVisibility).toBeNull();
  });

  it('preserves temporaryVisibility when re-entering the same view', () => {
    useBimStore.setState({
      elementsById: { 'ev-N': ev },
      temporaryVisibility: { viewId: 'ev-N', mode: 'hide', categories: ['door'] },
    });
    useBimStore.getState().activateElevationView('ev-N');
    expect(useBimStore.getState().temporaryVisibility).toEqual({
      viewId: 'ev-N',
      mode: 'hide',
      categories: ['door'],
    });
  });
});
