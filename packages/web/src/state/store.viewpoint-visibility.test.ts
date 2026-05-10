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
  it('parses coordinate point clipped state', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        pbp: {
          kind: 'project_base_point',
          positionMm: { xMm: 10, yMm: 20, zMm: 0 },
          angleToTrueNorthDeg: 5,
          clipped: true,
        },
        sp: {
          kind: 'survey_point',
          positionMm: { xMm: 1, yMm: 2, zMm: 3 },
          sharedElevationMm: 100,
          clipped: true,
        },
      },
      violations: [],
    });
    const pbp = useBimStore.getState().elementsById.pbp;
    expect(pbp?.kind).toBe('project_base_point');
    if (pbp?.kind === 'project_base_point') expect(pbp.clipped).toBe(true);
    const sp = useBimStore.getState().elementsById.sp;
    expect(sp?.kind).toBe('survey_point');
    if (sp?.kind === 'survey_point') expect(sp.clipped).toBe(true);
  });

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
