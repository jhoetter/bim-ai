import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  beamGripProvider,
  columnGripProvider,
  dimensionGripProvider,
  doorGripProvider,
  floorGripProvider,
  gripsFor,
  maskingRegionGripProvider,
  placedAssetGripProvider,
  referencePlaneGripProvider,
  sectionCutGripProvider,
  sketchElementGripProvider,
  windowGripProvider,
} from './index';
import { dimensionTextOffsetResetCommand } from './dimensionGripProvider';

const SAMPLE_WALL: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'L1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2700,
};

describe('EDT-01 — doorGripProvider', () => {
  const door: Extract<Element, { kind: 'door' }> = {
    kind: 'door',
    id: 'door-1',
    name: 'Door',
    wallId: 'wall-1',
    alongT: 0.5,
    widthMm: 900,
  };

  it('emits a single alongT slide grip on the host wall midpoint', () => {
    const grips = doorGripProvider.grips(door, { elementsById: { 'wall-1': SAMPLE_WALL } });
    expect(grips).toHaveLength(1);
    expect(grips[0].id).toBe('door-1:alongT');
    expect(grips[0].positionMm).toEqual({ xMm: 2500, yMm: 0 });
  });

  it('returns no grips when the host wall is missing', () => {
    expect(doorGripProvider.grips(door, { elementsById: {} })).toEqual([]);
  });

  it('drag-commit emits updateElementProperty on alongT clamped to [0,1]', () => {
    const grips = doorGripProvider.grips(door, { elementsById: { 'wall-1': SAMPLE_WALL } });
    const cmd = grips[0].onCommit({ xMm: 1000, yMm: 0 });
    // Wall length 5000, +1000mm along wall = +0.2 → 0.7
    expect(cmd).toEqual({
      type: 'updateElementProperty',
      elementId: 'door-1',
      key: 'alongT',
      value: 0.7,
    });
  });

  it('numeric override interprets value as distance from wall start', () => {
    const grips = doorGripProvider.grips(door, { elementsById: { 'wall-1': SAMPLE_WALL } });
    const cmd = grips[0].onNumericOverride(2000) as { value: number };
    expect(cmd.value).toBeCloseTo(0.4, 6);
  });
});

describe('EDT-01 — windowGripProvider', () => {
  const win: Extract<Element, { kind: 'window' }> = {
    kind: 'window',
    id: 'win-1',
    name: 'Window',
    wallId: 'wall-1',
    alongT: 0.25,
    widthMm: 1200,
    sillHeightMm: 900,
    heightMm: 1500,
  };

  it('drag-commit emits updateElementProperty on alongT', () => {
    const grips = windowGripProvider.grips(win, { elementsById: { 'wall-1': SAMPLE_WALL } });
    expect(grips).toHaveLength(1);
    const cmd = grips[0].onCommit({ xMm: 500, yMm: 0 });
    expect(cmd).toEqual({
      type: 'updateElementProperty',
      elementId: 'win-1',
      key: 'alongT',
      value: 0.35,
    });
  });

  it('numeric override clamps to [0,1]', () => {
    const grips = windowGripProvider.grips(win, { elementsById: { 'wall-1': SAMPLE_WALL } });
    const cmd = grips[0].onNumericOverride(99999) as { value: number };
    expect(cmd.value).toBe(1);
  });
});

describe('EDT-01 — floorGripProvider', () => {
  const floor: Extract<Element, { kind: 'floor' }> = {
    kind: 'floor',
    id: 'floor-1',
    name: 'Floor',
    levelId: 'L1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    thicknessMm: 200,
  };

  it('emits one vertex grip per boundary corner', () => {
    const grips = floorGripProvider.grips(floor, {});
    expect(grips).toHaveLength(4);
    expect(grips.map((g) => g.id)).toEqual([
      'floor-1:vertex:0',
      'floor-1:vertex:1',
      'floor-1:vertex:2',
      'floor-1:vertex:3',
    ]);
  });

  it('drag-commit replaces only the dragged vertex (immutable)', () => {
    const grips = floorGripProvider.grips(floor, {});
    const cmd = grips[1].onCommit({ xMm: 100, yMm: 50 }) as {
      type: string;
      key: string;
      value: string;
    };
    expect(cmd.type).toBe('updateElementProperty');
    expect(cmd.key).toBe('boundaryMm');
    const next = JSON.parse(cmd.value);
    expect(next).toHaveLength(4);
    expect(next[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(next[1]).toEqual({ xMm: 5100, yMm: 50 });
    expect(next[2]).toEqual({ xMm: 5000, yMm: 4000 });
  });
});

describe('F-077 — maskingRegionGripProvider', () => {
  const region: Extract<Element, { kind: 'masking_region' }> = {
    kind: 'masking_region',
    id: 'mr-1',
    hostViewId: 'pv-1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 1000 },
    ],
    fillColor: 'var(--color-canvas-paper)',
  };

  it('emits one boundary grip per masking region vertex', () => {
    const grips = maskingRegionGripProvider.grips(region, {});
    expect(grips.map((g) => g.id)).toEqual([
      'mr-1:mask-boundary:0',
      'mr-1:mask-boundary:1',
      'mr-1:mask-boundary:2',
      'mr-1:mask-boundary:3',
    ]);
    expect(gripsFor(region).map((g) => g.id)).toEqual(grips.map((g) => g.id));
  });

  it('drag-commit emits updateMaskingRegion with only the moved vertex changed', () => {
    const grips = maskingRegionGripProvider.grips(region, {});
    const cmd = grips[2]!.onCommit({ xMm: 250, yMm: -100 }) as {
      type: string;
      maskingRegionId: string;
      boundaryMm: { xMm: number; yMm: number }[];
    };
    expect(cmd.type).toBe('updateMaskingRegion');
    expect(cmd.maskingRegionId).toBe('mr-1');
    expect(cmd.boundaryMm[0]).toEqual(region.boundaryMm[0]);
    expect(cmd.boundaryMm[2]).toEqual({ xMm: 1250, yMm: 900 });
  });
});

describe('EDT-01 — columnGripProvider', () => {
  const square: Extract<Element, { kind: 'column' }> = {
    kind: 'column',
    id: 'col-1',
    name: 'Col',
    levelId: 'L1',
    positionMm: { xMm: 1000, yMm: 2000 },
    bMm: 300,
    hMm: 300,
    heightMm: 3000,
  };
  const rectangular = { ...square, id: 'col-2', bMm: 400, hMm: 200 };

  it('square columns emit only a position grip (no rotation handle)', () => {
    const grips = columnGripProvider.grips(square, {});
    expect(grips).toHaveLength(1);
    expect(grips[0].id).toBe('col-1:position');
  });

  it('non-square columns add a rotation handle', () => {
    const grips = columnGripProvider.grips(rectangular, {});
    expect(grips.map((g) => g.id)).toContain('col-2:rotation');
  });

  it('position drag-commit emits updateElementProperty on positionMm', () => {
    const [pos] = columnGripProvider.grips(square, {});
    const cmd = pos.onCommit({ xMm: 50, yMm: -25 }) as { value: string };
    expect(JSON.parse(cmd.value)).toEqual({ xMm: 1050, yMm: 1975 });
  });

  it('rotation numeric override sets rotationDeg', () => {
    const grips = columnGripProvider.grips(rectangular, {});
    const rot = grips.find((g) => g.id === 'col-2:rotation')!;
    expect(rot.onNumericOverride(45)).toEqual({
      type: 'updateElementProperty',
      elementId: 'col-2',
      key: 'rotationDeg',
      value: 45,
    });
  });
});

describe('EDT-01 — beamGripProvider', () => {
  const beam: Extract<Element, { kind: 'beam' }> = {
    kind: 'beam',
    id: 'beam-1',
    name: 'Beam',
    levelId: 'L1',
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 4000, yMm: 0 },
    widthMm: 300,
    heightMm: 500,
  };

  it('emits start + end endpoint grips', () => {
    const grips = beamGripProvider.grips(beam, {});
    expect(grips.map((g) => g.id)).toEqual(['beam-1:start', 'beam-1:end']);
  });

  it('drag-commit emits moveBeamEndpoints with the deltaed endpoint', () => {
    const grips = beamGripProvider.grips(beam, {});
    const cmd = grips[1].onCommit({ xMm: 500, yMm: 100 });
    expect(cmd).toEqual({
      type: 'moveBeamEndpoints',
      beamId: 'beam-1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 4500, yMm: 100 },
    });
  });

  it('numeric override on the end grip sets exact length anchored at start', () => {
    const grips = beamGripProvider.grips(beam, {});
    const cmd = grips[1].onNumericOverride(7500) as {
      type: string;
      endMm: { xMm: number; yMm: number };
    };
    expect(cmd.type).toBe('moveBeamEndpoints');
    expect(cmd.endMm.xMm).toBeCloseTo(7500, 6);
    expect(cmd.endMm.yMm).toBeCloseTo(0, 6);
  });
});

describe('F-117/F-120 — placedAssetGripProvider', () => {
  const sofaEntry: Extract<Element, { kind: 'asset_library_entry' }> = {
    kind: 'asset_library_entry',
    id: 'asset-sofa',
    assetKind: 'family_instance',
    name: 'Sofa',
    tags: ['sofa'],
    category: 'furniture',
    thumbnailKind: 'schematic_plan',
    thumbnailWidthMm: 2200,
    thumbnailHeightMm: 950,
    planSymbolKind: 'sofa',
    renderProxyKind: 'sofa',
    paramSchema: [
      { key: 'widthMm', kind: 'mm', default: 2200 },
      { key: 'depthMm', kind: 'mm', default: 950 },
    ],
  };
  const sofa: Extract<Element, { kind: 'placed_asset' }> = {
    kind: 'placed_asset',
    id: 'pa-1',
    name: 'Sofa',
    assetId: 'asset-sofa',
    levelId: 'L1',
    positionMm: { xMm: 1000, yMm: 2000 },
    rotationDeg: 0,
    paramValues: { widthMm: 2400, fabric: 'linen' },
  };

  it('emits face grips for width and depth using instance values and schema defaults', () => {
    const grips = placedAssetGripProvider.grips(sofa, {
      elementsById: { [sofa.id]: sofa, [sofaEntry.id]: sofaEntry },
    });

    expect(grips.map((g) => g.id)).toEqual([
      'pa-1:width:plus',
      'pa-1:width:minus',
      'pa-1:depth:plus',
      'pa-1:depth:minus',
    ]);
    expect(grips[0].positionMm).toEqual({ xMm: 2200, yMm: 2000 });
    expect(grips[2].positionMm).toEqual({ xMm: 1000, yMm: 2475 });
    expect(
      gripsFor(sofa, { elementsById: { [sofaEntry.id]: sofaEntry } }).map((g) => g.id),
    ).toEqual(grips.map((g) => g.id));
  });

  it('drag-commit patches widthMm without dropping existing instance params', () => {
    const [widthPlus] = placedAssetGripProvider.grips(sofa, {
      elementsById: { [sofaEntry.id]: sofaEntry },
    });
    const cmd = widthPlus.onCommit({ xMm: 100, yMm: 0 }) as {
      type: string;
      elementId: string;
      key: string;
      value: Record<string, unknown>;
    };

    expect(cmd).toEqual({
      type: 'updateElementProperty',
      elementId: 'pa-1',
      key: 'paramValues',
      value: { widthMm: 2600, fabric: 'linen' },
    });
  });

  it('numeric override patches depthMm exactly', () => {
    const depthMinus = placedAssetGripProvider
      .grips(sofa, { elementsById: { [sofaEntry.id]: sofaEntry } })
      .find((g) => g.id === 'pa-1:depth:minus')!;

    expect(depthMinus.onNumericOverride(1200)).toEqual({
      type: 'updateElementProperty',
      elementId: 'pa-1',
      key: 'paramValues',
      value: { widthMm: 2400, fabric: 'linen', depthMm: 1200 },
    });
  });

  it('adds composite kitchen offset grips that patch paramValues through updateElementProperty', () => {
    const kitchenEntry: Extract<Element, { kind: 'asset_library_entry' }> = {
      ...sofaEntry,
      id: 'asset-kitchen-layout',
      name: 'Kitchen Slab Layout',
      tags: ['kitchen', 'counter', 'sink', 'fridge'],
      category: 'kitchen',
      thumbnailWidthMm: 3000,
      thumbnailHeightMm: 650,
      planSymbolKind: 'counter',
      renderProxyKind: 'counter',
      paramSchema: [
        { key: 'widthMm', kind: 'mm', default: 3000 },
        { key: 'depthMm', kind: 'mm', default: 650 },
        { key: 'sinkOffsetMm', kind: 'mm', default: 1500 },
        { key: 'fridgeOffsetMm', kind: 'mm', default: 350 },
      ],
    };
    const kitchen: Extract<Element, { kind: 'placed_asset' }> = {
      ...sofa,
      id: 'pa-kitchen',
      name: 'Kitchen Slab Layout',
      assetId: kitchenEntry.id,
      positionMm: { xMm: 1000, yMm: 2000 },
      rotationDeg: 0,
      paramValues: { sinkOffsetMm: 1700, finish: 'laminate' },
    };

    const grips = placedAssetGripProvider.grips(kitchen, {
      elementsById: { [kitchenEntry.id]: kitchenEntry },
    });
    const sink = grips.find((g) => g.id === 'pa-kitchen:sinkOffsetMm')!;
    const fridge = grips.find((g) => g.id === 'pa-kitchen:fridgeOffsetMm')!;

    expect(grips.map((g) => g.id)).toContain('pa-kitchen:sinkOffsetMm');
    expect(grips.map((g) => g.id)).toContain('pa-kitchen:fridgeOffsetMm');
    expect(sink.positionMm).toEqual({ xMm: 1200, yMm: 2000 });
    expect(fridge.positionMm).toEqual({ xMm: -150, yMm: 2000 });
    expect(sink.onCommit({ xMm: 125, yMm: 50 })).toEqual({
      type: 'updateElementProperty',
      elementId: 'pa-kitchen',
      key: 'paramValues',
      value: { sinkOffsetMm: 1825, finish: 'laminate' },
    });
  });

  it('projects rotated composite offset drags onto the asset width axis', () => {
    const bathEntry: Extract<Element, { kind: 'asset_library_entry' }> = {
      ...sofaEntry,
      id: 'asset-bath-layout',
      name: 'Compact Bathroom Layout',
      tags: ['bathroom', 'toilet', 'vanity', 'shower'],
      category: 'bathroom',
      thumbnailWidthMm: 2400,
      thumbnailHeightMm: 2200,
      planSymbolKind: 'bathroom_layout',
      renderProxyKind: 'bathroom_layout',
      paramSchema: [
        { key: 'widthMm', kind: 'mm', default: 2400 },
        { key: 'depthMm', kind: 'mm', default: 2200 },
        { key: 'showerOffsetMm', kind: 'mm', default: 450 },
        { key: 'toiletOffsetMm', kind: 'mm', default: 1180 },
        { key: 'vanityOffsetMm', kind: 'mm', default: 1900 },
      ],
    };
    const bath: Extract<Element, { kind: 'placed_asset' }> = {
      ...sofa,
      id: 'pa-bath',
      name: 'Compact Bathroom Layout',
      assetId: bathEntry.id,
      positionMm: { xMm: 1000, yMm: 2000 },
      rotationDeg: 90,
      paramValues: { toiletOffsetMm: 1180 },
    };

    const toilet = placedAssetGripProvider
      .grips(bath, { elementsById: { [bathEntry.id]: bathEntry } })
      .find((g) => g.id === 'pa-bath:toiletOffsetMm')!;

    expect(toilet.positionMm.xMm).toBeCloseTo(780, 6);
    expect(toilet.positionMm.yMm).toBeCloseTo(1980, 6);
    expect(toilet.onCommit({ xMm: 0, yMm: 100 })).toEqual({
      type: 'updateElementProperty',
      elementId: 'pa-bath',
      key: 'paramValues',
      value: { toiletOffsetMm: 1280 },
    });
    expect(toilet.onNumericOverride(99999)).toEqual({
      type: 'updateElementProperty',
      elementId: 'pa-bath',
      key: 'paramValues',
      value: { toiletOffsetMm: 2320 },
    });
  });
});

describe('EDT-01 — sectionCutGripProvider', () => {
  const section: Extract<Element, { kind: 'section_cut' }> = {
    kind: 'section_cut',
    id: 'sec-1',
    name: 'Section',
    lineStartMm: { xMm: 0, yMm: 0 },
    lineEndMm: { xMm: 3000, yMm: 0 },
  };

  it('drag-commit on start emits updateElementProperty on lineStartMm', () => {
    const grips = sectionCutGripProvider.grips(section, {});
    expect(grips).toHaveLength(2);
    const cmd = grips[0].onCommit({ xMm: 100, yMm: -50 }) as {
      type: string;
      key: string;
      value: string;
    };
    expect(cmd.key).toBe('lineStartMm');
    expect(JSON.parse(cmd.value)).toEqual({ xMm: 100, yMm: -50 });
  });
});

describe('EDT-01 — dimensionGripProvider', () => {
  const dim: Extract<Element, { kind: 'dimension' }> = {
    kind: 'dimension',
    id: 'dim-1',
    name: 'Dim',
    levelId: 'L1',
    aMm: { xMm: 0, yMm: 0 },
    bMm: { xMm: 4000, yMm: 0 },
    offsetMm: { xMm: 0, yMm: 500 },
  };

  it('emits anchor + offset + text grips', () => {
    const grips = dimensionGripProvider.grips(dim, {});
    expect(grips.map((g) => g.id)).toEqual(['dim-1:anchor', 'dim-1:offset', 'dim-1:text']);
  });

  it('offset grip drag projects onto the unit normal', () => {
    const grips = dimensionGripProvider.grips(dim, {});
    const offset = grips[1];
    // Wall along +X → normal is +Y. Drag (+200, +0) projects to 0.
    const flatCmd = offset.onCommit({ xMm: 200, yMm: 0 }) as { value: string };
    expect(JSON.parse(flatCmd.value)).toEqual({ xMm: 0, yMm: 500 });
    // Drag (+0, +100) projects to +100 along normal.
    const liftedCmd = offset.onCommit({ xMm: 0, yMm: 100 }) as { value: string };
    const next = JSON.parse(liftedCmd.value);
    expect(next.xMm).toBeCloseTo(0, 6);
    expect(next.yMm).toBeCloseTo(600, 6);
  });

  it('text grip drag snaps label offset to the dimension line axis', () => {
    const grips = dimensionGripProvider.grips(
      {
        ...dim,
        textOffsetMm: { xMm: 100, yMm: 75 },
      },
      {},
    );
    const text = grips[2];
    expect(text.id).toBe('dim-1:text');
    const cmd = text.onCommit({ xMm: 200, yMm: 300 }) as { value: string };
    expect(JSON.parse(cmd.value)).toEqual({ xMm: 300, yMm: 0 });
  });

  it('double-click text grip reset emits a null textOffsetMm update', () => {
    expect(dimensionTextOffsetResetCommand('dim-1:text', { 'dim-1': dim })).toEqual({
      type: 'updateElementProperty',
      elementId: 'dim-1',
      key: 'textOffsetMm',
      value: null,
    });
    expect(dimensionTextOffsetResetCommand('dim-1:offset', { 'dim-1': dim })).toBeNull();
  });
});

describe('EDT-01 — referencePlaneGripProvider', () => {
  const refPlane = {
    kind: 'reference_plane' as const,
    id: 'rp-1',
    name: 'RP',
    levelId: 'L1',
    startMm: { xMm: 1000, yMm: 0 },
    endMm: { xMm: 1000, yMm: 5000 },
  };

  it('emits endpoint grips on KRN-05 reference planes', () => {
    const grips = referencePlaneGripProvider.grips(
      refPlane as Element & { kind: 'reference_plane' },
      {},
    );
    expect(grips.map((g) => g.id)).toEqual(['rp-1:start', 'rp-1:end']);
  });

  it('drag-commit on end emits updateElementProperty on endMm', () => {
    const grips = referencePlaneGripProvider.grips(
      refPlane as Element & { kind: 'reference_plane' },
      {},
    );
    const cmd = grips[1].onCommit({ xMm: 0, yMm: 200 }) as {
      type: string;
      key: string;
      value: string;
    };
    expect(cmd.key).toBe('endMm');
    expect(JSON.parse(cmd.value)).toEqual({ xMm: 1000, yMm: 5200 });
  });

  it('returns no grips for the family-editor variant of reference_plane', () => {
    const familyVariant = {
      kind: 'reference_plane' as const,
      id: 'rp-fam-1',
      name: 'RP-fam',
      familyEditorId: 'fam-1',
      isVertical: true,
      offsetMm: 0,
    };
    expect(
      referencePlaneGripProvider.grips(familyVariant as Element & { kind: 'reference_plane' }, {}),
    ).toEqual([]);
  });
});

describe('EDT-V3-13 — sketchElementGripProvider', () => {
  it('emits sage sketch grips for plan-region vertices and edge midpoints', () => {
    const region: Extract<Element, { kind: 'plan_region' }> = {
      kind: 'plan_region',
      id: 'pr-1',
      name: 'Plan region',
      levelId: 'L1',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 1000, yMm: 1000 },
        { xMm: 0, yMm: 1000 },
      ],
      cutPlaneOffsetMm: 1200,
    };
    const grips = sketchElementGripProvider.grips(region, {});
    expect(grips).toHaveLength(8);
    expect(grips[0]!.id).toBe('pr-1:sketch-vertex:0');
    expect(grips[1]!.positionMm).toEqual({ xMm: 500, yMm: 0 });
    expect(grips[0]!.onCommit({ xMm: 50, yMm: 25 })).toMatchObject({
      type: 'updatePlanRegion',
      id: 'pr-1',
    });
  });

  it('emits boundary and tread grips for by-sketch stairs', () => {
    const stair: Extract<Element, { kind: 'stair' }> = {
      kind: 'stair',
      id: 'stair-1',
      name: 'Sketch stair',
      baseLevelId: 'L1',
      topLevelId: 'L2',
      shape: 'straight',
      widthMm: 1000,
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 3000, yMm: 0 },
      riserMm: 175,
      treadMm: 280,
      authoringMode: 'by_sketch',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 1000 },
        { xMm: 0, yMm: 1000 },
      ],
      treadLines: [
        { fromMm: { xMm: 1000, yMm: 0 }, toMm: { xMm: 1000, yMm: 1000 } },
        { fromMm: { xMm: 2000, yMm: 0 }, toMm: { xMm: 2000, yMm: 1000 } },
      ],
      totalRiseMm: 2800,
    };
    const grips = sketchElementGripProvider.grips(stair, {});
    expect(grips.map((g) => g.id)).toContain('stair-1:sketch-boundary:0');
    expect(grips.map((g) => g.id)).toContain('stair-1:sketch-tread:1');
    expect(grips.at(-1)!.onCommit({ xMm: 50, yMm: 0 })).toMatchObject({
      type: 'updateStairTreads',
      id: 'stair-1',
    });
  });
});

describe('EDT-01 — gripsFor dispatch (propagated)', () => {
  it('dispatches walls', () => {
    expect(gripsFor(SAMPLE_WALL).length).toBe(4);
  });

  it('dispatches doors when host wall is provided in context', () => {
    const door: Element = {
      kind: 'door',
      id: 'd1',
      name: 'Door',
      wallId: 'wall-1',
      alongT: 0.5,
      widthMm: 900,
    };
    expect(gripsFor(door, { elementsById: { 'wall-1': SAMPLE_WALL } })).toHaveLength(1);
  });

  it('dispatches floors', () => {
    const floor: Element = {
      kind: 'floor',
      id: 'f1',
      name: 'Floor',
      levelId: 'L1',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 0, yMm: 1000 },
      ],
      thicknessMm: 200,
    };
    expect(gripsFor(floor)).toHaveLength(3);
  });

  it('dispatches plan regions through the sketch grip provider', () => {
    const region: Element = {
      kind: 'plan_region',
      id: 'pr-1',
      name: 'Plan region',
      levelId: 'L1',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 0, yMm: 1000 },
      ],
      cutPlaneOffsetMm: 1000,
    };
    expect(gripsFor(region)).toHaveLength(6);
  });
});
