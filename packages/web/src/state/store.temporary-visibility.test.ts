import { afterEach, describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { useBimStore } from './store';
import { isElementVisibleUnderTemporaryVisibility, type TemporaryVisibility } from './storeTypes';

afterEach(() => {
  useBimStore.setState({
    activePlanViewId: undefined,
    activeViewpointId: undefined,
    activeLevelId: undefined,
    elementsById: {},
    temporaryVisibility: null,
  });
});

describe('VIE-04 — temporaryVisibility store slice', () => {
  it('starts null and round-trips through setter / clear', () => {
    expect(useBimStore.getState().temporaryVisibility).toBeNull();

    const override: TemporaryVisibility = {
      viewId: 'pv-1',
      mode: 'isolate',
      categories: ['wall'],
    };
    useBimStore.getState().setTemporaryVisibility(override);
    expect(useBimStore.getState().temporaryVisibility).toEqual(override);

    useBimStore.getState().clearTemporaryVisibility();
    expect(useBimStore.getState().temporaryVisibility).toBeNull();
  });

  it('switching to a different plan view clears the override', () => {
    const planA: Element = {
      kind: 'plan_view',
      id: 'pv-a',
      name: 'A',
      levelId: 'lvl-1',
    };
    const planB: Element = {
      kind: 'plan_view',
      id: 'pv-b',
      name: 'B',
      levelId: 'lvl-1',
    };
    useBimStore.setState({ elementsById: { [planA.id]: planA, [planB.id]: planB } });

    useBimStore.getState().activatePlanView('pv-a');
    useBimStore
      .getState()
      .setTemporaryVisibility({ viewId: 'pv-a', mode: 'isolate', categories: ['wall'] });

    useBimStore.getState().activatePlanView('pv-b');
    expect(useBimStore.getState().temporaryVisibility).toBeNull();
  });

  it('re-entering the same plan view preserves the override', () => {
    const planA: Element = {
      kind: 'plan_view',
      id: 'pv-a',
      name: 'A',
      levelId: 'lvl-1',
    };
    useBimStore.setState({ elementsById: { [planA.id]: planA } });
    useBimStore.getState().activatePlanView('pv-a');
    useBimStore
      .getState()
      .setTemporaryVisibility({ viewId: 'pv-a', mode: 'hide', categories: ['door'] });

    useBimStore.getState().activatePlanView('pv-a');
    expect(useBimStore.getState().temporaryVisibility).toEqual({
      viewId: 'pv-a',
      mode: 'hide',
      categories: ['door'],
    });
  });

  it('leaving the plan view (undefined) clears the override', () => {
    useBimStore
      .getState()
      .setTemporaryVisibility({ viewId: 'pv-a', mode: 'isolate', categories: ['wall'] });
    useBimStore.getState().activatePlanView(undefined);
    expect(useBimStore.getState().temporaryVisibility).toBeNull();
  });
});

describe('VIE-04 — isElementVisibleUnderTemporaryVisibility helper', () => {
  it('returns true when no override is active', () => {
    expect(isElementVisibleUnderTemporaryVisibility('wall', null)).toBe(true);
  });

  it('isolate: only listed categories render', () => {
    const o: TemporaryVisibility = { viewId: 'v', mode: 'isolate', categories: ['wall'] };
    expect(isElementVisibleUnderTemporaryVisibility('wall', o)).toBe(true);
    expect(isElementVisibleUnderTemporaryVisibility('door', o)).toBe(false);
  });

  it('hide: listed categories are dropped, the rest survive', () => {
    const o: TemporaryVisibility = { viewId: 'v', mode: 'hide', categories: ['door'] };
    expect(isElementVisibleUnderTemporaryVisibility('door', o)).toBe(false);
    expect(isElementVisibleUnderTemporaryVisibility('wall', o)).toBe(true);
  });
});
