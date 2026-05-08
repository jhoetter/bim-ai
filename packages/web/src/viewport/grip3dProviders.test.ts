/**
 * EDT-03 — 3D grip provider tests (closeout).
 */

import { describe, expect, test } from 'vitest';

import {
  beamGripProvider3d,
  columnGripProvider3d,
  doorGripProvider3d,
  floorGripProvider3d,
  roofGripProvider3d,
  windowGripProvider3d,
} from './grip3dProviders';

describe('floorGripProvider3d', () => {
  const floor = {
    id: 'flr-1',
    kind: 'floor' as const,
    levelId: 'L1',
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    thicknessMm: 200,
  };

  test('emits one vertex grip per boundary point + corner extrusions + thickness', () => {
    const grips = floorGripProvider3d(floor);
    const ids = grips.map((g) => g.id);
    // 4 vertices + 4 corners + 1 thickness = 9 grips
    expect(grips).toHaveLength(9);
    expect(ids).toContain('flr-1/vertex/0');
    expect(ids).toContain('flr-1/corner/0');
    expect(ids).toContain('flr-1/thickness');
  });

  test('vertex commit emits updateElementProperty boundaryMm with replaced vertex', () => {
    const grips = floorGripProvider3d(floor);
    const v0 = grips.find((g) => g.id === 'flr-1/vertex/0')!;
    const cmd = v0.onCommit(250);
    expect(cmd?.type).toBe('updateElementProperty');
    expect(cmd?.payload.elementId).toBe('flr-1');
    expect(cmd?.payload.property).toBe('boundaryMm');
    const next = (cmd?.payload.value as { xMm: number; yMm: number }[]) ?? [];
    expect(next[0]).toEqual({ xMm: 250, yMm: 250 });
    expect(next[1]).toEqual(floor.boundaryMm[1]);
  });

  test('thickness handle clamped at FLOOR_MIN_THICKNESS_MM', () => {
    const grips = floorGripProvider3d(floor);
    const t = grips.find((g) => g.id === 'flr-1/thickness')!;
    const cmd = t.onCommit(-10000);
    expect(cmd?.payload.valueMm).toBe(50); // 200 - 150 clamp = 50 (min)
  });

  test('zero-delta commit returns null', () => {
    const t = floorGripProvider3d(floor).find((g) => g.id === 'flr-1/thickness')!;
    expect(t.onCommit(0)).toBeNull();
  });

  test('uses level elevation from elementsById ctx for grip Z', () => {
    const grips = floorGripProvider3d(floor, {
      elementsById: { L1: { kind: 'level', elevationMm: 3500 } },
    });
    const v0 = grips.find((g) => g.id === 'flr-1/vertex/0')!;
    expect(v0.position.zMm).toBe(3500);
  });
});

describe('roofGripProvider3d', () => {
  const roof = {
    id: 'rf-1',
    kind: 'roof' as const,
    referenceLevelId: 'L2',
    footprintMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 6000, yMm: 0 },
      { xMm: 6000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    overhangMm: 600,
    eaveHeightLeftMm: 3000,
    slopeDeg: 30,
  };

  test('returns ridge + eave + gable-end grips', () => {
    const grips = roofGripProvider3d(roof);
    const ids = grips.map((g) => g.id).sort();
    expect(ids).toEqual(['rf-1/eave', 'rf-1/gable-end', 'rf-1/ridge']);
  });

  test('eave commit emits updateElementProperty eaveHeightLeftMm', () => {
    const eave = roofGripProvider3d(roof).find((g) => g.id === 'rf-1/eave')!;
    const cmd = eave.onCommit(500);
    expect(cmd?.type).toBe('updateElementProperty');
    expect(cmd?.payload.property).toBe('eaveHeightLeftMm');
    expect(cmd?.payload.valueMm).toBe(3500); // 3000 + 500
  });

  test('ridge commit converts z-rise into a slope angle', () => {
    const ridge = roofGripProvider3d(roof).find((g) => g.id === 'rf-1/ridge')!;
    const cmd = ridge.onCommit(500);
    expect(cmd?.type).toBe('updateElementProperty');
    expect(cmd?.payload.property).toBe('slopeDeg');
    expect(cmd?.payload.valueMm).toBeGreaterThan(30);
  });

  test('gable-end commit emits updateElementProperty overhangMm', () => {
    const gable = roofGripProvider3d(roof).find((g) => g.id === 'rf-1/gable-end')!;
    const cmd = gable.onCommit(200);
    expect(cmd?.payload.property).toBe('overhangMm');
    expect(cmd?.payload.valueMm).toBe(800); // 600 + 200
  });
});

describe('columnGripProvider3d', () => {
  const column = {
    id: 'col-1',
    kind: 'column' as const,
    levelId: 'L1',
    positionMm: { xMm: 1000, yMm: 2000 },
    heightMm: 3000,
    baseConstraintOffsetMm: 0,
    topConstraintOffsetMm: 0,
  };

  test('emits top + base z-axis grips', () => {
    const grips = columnGripProvider3d(column);
    expect(grips).toHaveLength(2);
    expect(grips.every((g) => g.axis === 'z')).toBe(true);
  });

  test('top commit emits topConstraintOffsetMm', () => {
    const top = columnGripProvider3d(column).find((g) => g.id === 'col-1/top')!;
    const cmd = top.onCommit(150);
    expect(cmd?.payload.property).toBe('topConstraintOffsetMm');
    expect(cmd?.payload.valueMm).toBe(150);
  });

  test('uses level elevation for grip Z position', () => {
    const grips = columnGripProvider3d(column, {
      elementsById: { L1: { kind: 'level', elevationMm: 3500 } },
    });
    const top = grips.find((g) => g.id === 'col-1/top')!;
    const base = grips.find((g) => g.id === 'col-1/base')!;
    expect(top.position.zMm).toBe(6500); // 3500 + 3000 height
    expect(base.position.zMm).toBe(3500);
  });
});

describe('beamGripProvider3d', () => {
  const beam = {
    id: 'bm-1',
    kind: 'beam' as const,
    levelId: 'L1',
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 5000, yMm: 0 },
  };

  test('emits start + end xyz grips', () => {
    const grips = beamGripProvider3d(beam);
    expect(grips).toHaveLength(2);
    expect(grips.every((g) => g.axis === 'xyz')).toBe(true);
  });

  test('start commit emits moveBeamEndpoints with updated start', () => {
    const start = beamGripProvider3d(beam).find((g) => g.id === 'bm-1/start')!;
    const cmd = start.onCommit(100);
    expect(cmd?.type).toBe('moveBeamEndpoints');
    expect(cmd?.payload.beamId).toBe('bm-1');
    expect(cmd?.payload.startMm).toEqual({ xMm: 100, yMm: 100 });
    expect(cmd?.payload.endMm).toEqual(beam.endMm);
  });
});

describe('doorGripProvider3d', () => {
  const door = {
    id: 'dr-1',
    kind: 'door' as const,
    wallId: 'w-1',
    alongT: 0.5,
    widthMm: 900,
  };

  test('emits width + height grips, both elevation-only', () => {
    const grips = doorGripProvider3d(door);
    expect(grips).toHaveLength(2);
    expect(grips.every((g) => g.visibleIn === 'elevation')).toBe(true);
  });

  test('width commit emits updateElementProperty widthMm', () => {
    const width = doorGripProvider3d(door).find((g) => g.id === 'dr-1/width')!;
    const cmd = width.onCommit(200);
    expect(cmd?.payload.property).toBe('widthMm');
    expect(cmd?.payload.valueMm).toBe(1100); // 900 + 200
  });
});

describe('windowGripProvider3d', () => {
  const win = {
    id: 'win-1',
    kind: 'window' as const,
    wallId: 'w-1',
    alongT: 0.5,
    widthMm: 1200,
    heightMm: 1500,
    sillHeightMm: 900,
  };

  test('emits width + height + sill grips', () => {
    const grips = windowGripProvider3d(win);
    const ids = grips.map((g) => g.id).sort();
    expect(ids).toEqual(['win-1/height', 'win-1/sill', 'win-1/width']);
  });

  test('sill commit emits updateElementProperty sillHeightMm', () => {
    const sill = windowGripProvider3d(win).find((g) => g.id === 'win-1/sill')!;
    const cmd = sill.onCommit(150);
    expect(cmd?.payload.property).toBe('sillHeightMm');
    expect(cmd?.payload.valueMm).toBe(1050); // 900 + 150
  });

  test('all window grips are elevation-only', () => {
    const grips = windowGripProvider3d(win);
    expect(grips.every((g) => g.visibleIn === 'elevation')).toBe(true);
  });
});
