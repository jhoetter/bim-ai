import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  beamGripProvider,
  columnGripProvider,
  dimensionGripProvider,
  doorGripProvider,
  floorGripProvider,
  gripsFor,
  referencePlaneGripProvider,
  sectionCutGripProvider,
  windowGripProvider,
} from './index';

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
});
