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
  it('preserves asymmetric target-house roof fields and hosted roof openings', () => {
    const { hydrateFromSnapshot } = useBimStore.getState();
    hydrateFromSnapshot({
      modelId: 'm1',
      revision: 1,
      elements: {
        'roof-1': {
          kind: 'roof',
          name: 'White asymmetric shell roof',
          referenceLevelId: 'lvl-1',
          footprintMm: [
            { xMm: 0, yMm: 0 },
            { xMm: 8000, yMm: 0 },
            { xMm: 8000, yMm: 8200 },
            { xMm: 0, yMm: 8200 },
          ],
          overhangMm: 320,
          slopeDeg: 24,
          roofGeometryMode: 'asymmetric_gable',
          ridgeOffsetTransverseMm: 500,
          eaveHeightLeftMm: 2450,
          eaveHeightRightMm: 2100,
          materialKey: 'white_render',
        },
        'roof-cut-1': {
          kind: 'roof_opening',
          name: 'Embedded roof terrace cutout',
          hostRoofId: 'roof-1',
          boundaryMm: [
            { xMm: 4700, yMm: 1700 },
            { xMm: 8000, yMm: 1700 },
            { xMm: 8000, yMm: 6900 },
            { xMm: 4700, yMm: 6900 },
          ],
        },
      },
      violations: [],
    });

    const roof = useBimStore.getState().elementsById['roof-1'];
    expect(roof?.kind).toBe('roof');
    if (roof?.kind === 'roof') {
      expect(roof.roofGeometryMode).toBe('asymmetric_gable');
      expect(roof.materialKey).toBe('white_render');
      expect(roof.ridgeOffsetTransverseMm).toBe(500);
      expect(roof.eaveHeightLeftMm).toBe(2450);
      expect(roof.eaveHeightRightMm).toBe(2100);
    }

    const opening = useBimStore.getState().elementsById['roof-cut-1'];
    expect(opening?.kind).toBe('roof_opening');
    if (opening?.kind === 'roof_opening') {
      expect(opening.hostRoofId).toBe('roof-1');
      expect(opening.boundaryMm).toEqual([
        { xMm: 4700, yMm: 1700 },
        { xMm: 8000, yMm: 1700 },
        { xMm: 8000, yMm: 6900 },
        { xMm: 4700, yMm: 6900 },
      ]);
    }
  });

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
