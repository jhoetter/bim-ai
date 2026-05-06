import { beforeEach, describe, expect, it } from 'vitest';

import { useBimStore } from './store';

beforeEach(() => {
  useBimStore.setState({
    revision: 0,
    elementsById: {},
    violations: [],
    activeLevelId: undefined,
    activePlanViewId: undefined,
    activeViewpointId: undefined,
    selectedId: undefined,
    planProjectionPrimitives: null,
    planRoomSchemeWireReadout: null,
  });
});

describe('coerceElement — viewpoint visibility / coordination', () => {
  it('parses hiddenElementIds on viewpoint', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'vp-1': {
          kind: 'viewpoint',
          name: 'Main',
          camera: {},
          mode: 'orbit_3d',
          hiddenElementIds: ['e1'],
        },
      },
      violations: [],
    });
    const vp = useBimStore.getState().elementsById['vp-1'];
    expect(vp?.kind).toBe('viewpoint');
    if (vp?.kind === 'viewpoint') {
      expect(vp.hiddenElementIds).toEqual(['e1']);
    }
  });

  it('parses isolatedElementIds on viewpoint', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'vp-2': {
          kind: 'viewpoint',
          name: 'Iso',
          camera: {},
          mode: 'orbit_3d',
          isolatedElementIds: ['e2', 'e3'],
        },
      },
      violations: [],
    });
    const vp = useBimStore.getState().elementsById['vp-2'];
    expect(vp?.kind).toBe('viewpoint');
    if (vp?.kind === 'viewpoint') {
      expect(vp.isolatedElementIds).toEqual(['e2', 'e3']);
    }
  });

  it('parses selection_set element with filterRules', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'ss-1': {
          kind: 'selection_set',
          name: 'Walls',
          filterRules: [{ field: 'category', operator: 'equals', value: 'wall' }],
        },
      },
      violations: [],
    });
    const ss = useBimStore.getState().elementsById['ss-1'];
    expect(ss?.kind).toBe('selection_set');
    if (ss?.kind === 'selection_set') {
      expect(ss.filterRules[0]?.field).toBe('category');
      expect(ss.filterRules[0]?.operator).toBe('equals');
      expect(ss.filterRules[0]?.value).toBe('wall');
    }
  });

  it('parses clash_test element with toleranceMm', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'ct-1': {
          kind: 'clash_test',
          name: 'Clash 1',
          setAIds: ['a'],
          setBIds: ['b'],
          toleranceMm: 25,
        },
      },
      violations: [],
    });
    const ct = useBimStore.getState().elementsById['ct-1'];
    expect(ct?.kind).toBe('clash_test');
    if (ct?.kind === 'clash_test') {
      expect(ct.toleranceMm).toBe(25);
      expect(ct.setAIds).toEqual(['a']);
      expect(ct.setBIds).toEqual(['b']);
    }
  });
});
