/**
 * EDT-03 — 3D direct-manipulation handles tests (load-bearing slice).
 */

import { describe, expect, test, beforeEach } from 'vitest';

import {
  Grip3dDescriptor,
  clampDragDelta,
  clear3dGripProviders,
  gripsFor,
  projectGripDelta,
  register3dGripProvider,
  wallGripProvider,
} from './grip3d';

const baseWall = {
  id: 'w-ssw',
  kind: 'wall' as const,
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  heightMm: 3000,
  baseElevationMm: 0,
  baseConstraintOffsetMm: 0,
  topConstraintOffsetMm: 0,
};

beforeEach(() => {
  clear3dGripProviders();
});

describe('clampDragDelta', () => {
  test('passes through deltas inside the range', () => {
    expect(clampDragDelta(100, { minMm: -500, maxMm: 500 })).toBe(100);
  });

  test('clamps to max when over', () => {
    expect(clampDragDelta(900, { minMm: -500, maxMm: 500 })).toBe(500);
  });

  test('clamps to min when under', () => {
    expect(clampDragDelta(-900, { minMm: -500, maxMm: 500 })).toBe(-500);
  });

  test('treats NaN as zero', () => {
    expect(clampDragDelta(Number.NaN, { minMm: -10, maxMm: 10 })).toBe(0);
  });
});

describe('wallGripProvider', () => {
  test('returns top + base descriptors at wall midpoint', () => {
    const grips = wallGripProvider(baseWall);
    expect(grips).toHaveLength(2);
    const ids = grips.map((g) => g.id).sort();
    expect(ids).toEqual(['w-ssw/base', 'w-ssw/top']);
    grips.forEach((g) => {
      expect(g.position.xMm).toBe(2500);
      expect(g.position.yMm).toBe(0);
      expect(g.axis).toBe('z');
    });
  });

  test('top handle anchored at top elevation, base at bottom', () => {
    const grips = wallGripProvider({
      ...baseWall,
      baseElevationMm: 1000,
    });
    const top = grips.find((g) => g.id.endsWith('/top'))!;
    const base = grips.find((g) => g.id.endsWith('/base'))!;
    expect(top.position.zMm).toBe(4000); // 1000 base + 3000 height
    expect(base.position.zMm).toBe(1000);
  });

  test('top handle drag emits live preview payload', () => {
    const top = wallGripProvider(baseWall).find((g) => g.id.endsWith('/top'))!;
    const payload = top.onDrag(500);
    expect(payload).toEqual({
      elementId: 'w-ssw',
      property: 'topConstraintOffsetMm',
      valueMm: 500,
    });
  });

  test('top handle commit emits updateElementProperty command', () => {
    const top = wallGripProvider(baseWall).find((g) => g.id.endsWith('/top'))!;
    const cmd = top.onCommit(750);
    expect(cmd).toEqual({
      type: 'updateElementProperty',
      payload: {
        elementId: 'w-ssw',
        property: 'topConstraintOffsetMm',
        valueMm: 750,
      },
    });
  });

  test('zero-delta commit returns null (no-op suppresses spurious commands)', () => {
    const top = wallGripProvider(baseWall).find((g) => g.id.endsWith('/top'))!;
    expect(top.onCommit(0)).toBeNull();
  });

  test('top range never lets wall shrink below MIN_WALL_HEIGHT_MM', () => {
    const top = wallGripProvider(baseWall).find((g) => g.id.endsWith('/top'))!;
    // Wall is 3000mm; min height is 100mm; so top can drop at most -2900mm
    expect(top.rangeMm.minMm).toBe(-2900);
  });

  test('drag clamped to range — extreme drag-up does not exceed MAX_WALL_HEIGHT_MM', () => {
    const top = wallGripProvider(baseWall).find((g) => g.id.endsWith('/top'))!;
    const huge = top.onDrag(1_000_000);
    expect(huge.valueMm).toBe(top.rangeMm.maxMm); // 27000 (= 30000 - 3000)
  });

  test('non-zero starting offset preserved on commit', () => {
    const top = wallGripProvider({
      ...baseWall,
      topConstraintOffsetMm: 200,
    }).find((g) => g.id.endsWith('/top'))!;
    const cmd = top.onCommit(300);
    expect(cmd?.payload).toEqual({
      elementId: 'w-ssw',
      property: 'topConstraintOffsetMm',
      valueMm: 500, // 200 starting + 300 delta
    });
  });

  test('base handle commit writes baseConstraintOffsetMm', () => {
    const base = wallGripProvider(baseWall).find((g) => g.id.endsWith('/base'))!;
    const cmd = base.onCommit(150);
    expect(cmd).toEqual({
      type: 'updateElementProperty',
      payload: {
        elementId: 'w-ssw',
        property: 'baseConstraintOffsetMm',
        valueMm: 150,
      },
    });
  });
});

describe('grip provider registry', () => {
  test('gripsFor returns [] for unregistered kinds', () => {
    expect(gripsFor({ kind: 'roof' })).toEqual([]);
  });

  test('gripsFor returns [] for null/undefined element', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(gripsFor(null)).toEqual([]);
  });

  test('register + dispatch routes by kind', () => {
    const stub: Grip3dDescriptor = {
      id: 'roof/ridge',
      role: 'ridgeHeightMm',
      position: { xMm: 0, yMm: 0, zMm: 5000 },
      axis: 'z',
      rangeMm: { minMm: -1000, maxMm: 1000 },
      onDrag: () => ({
        elementId: 'r1',
        property: 'ridgeHeightMm',
        valueMm: 0,
      }),
      onCommit: () => null,
    };
    register3dGripProvider('roof', () => [stub]);

    const grips = gripsFor({ kind: 'roof' });
    expect(grips).toHaveLength(1);
    expect(grips[0].id).toBe('roof/ridge');
  });

  test('default wall registration survives clear+re-register cycle', () => {
    register3dGripProvider('wall', wallGripProvider as never);
    const grips = gripsFor({ ...baseWall } as Record<string, unknown>);
    expect(grips).toHaveLength(2);
  });
});

describe('EDT-V3-08 — projectGripDelta', () => {
  const startMm = { xMm: 0, yMm: 0, zMm: 0 };

  test('xy axis projects to the horizontal plane', () => {
    const result = projectGripDelta({
      axis: 'xy',
      startMm,
      currentMm: { xMm: 100, yMm: 200, zMm: 300 },
    });
    expect(result.deltaMm).toEqual({ xMm: 100, yMm: 200, zMm: 0 });
  });

  test('xyz waits for an 8px deadzone before locking dominant axis', () => {
    const pending = projectGripDelta({
      axis: 'xyz',
      startMm,
      currentMm: { xMm: 100, yMm: 20, zMm: 0 },
      initialDeltaPx: { x: 3, y: 4 },
    });
    expect(pending.deltaMm).toEqual({ xMm: 0, yMm: 0, zMm: 0 });

    const locked = projectGripDelta({
      axis: 'xyz',
      startMm,
      currentMm: { xMm: 100, yMm: 20, zMm: 0 },
      initialDeltaPx: { x: 8, y: 0 },
    });
    expect(locked.state.dominantAxis).toBe('x');
    expect(locked.deltaMm).toEqual({ xMm: 100, yMm: 0, zMm: 0 });
  });

  test('xyz preserves dominant lock and shift enables free 3D movement', () => {
    const locked = projectGripDelta(
      {
        axis: 'xyz',
        startMm,
        currentMm: { xMm: 10, yMm: 200, zMm: 30 },
      },
      { dominantAxis: 'x' },
    );
    expect(locked.deltaMm).toEqual({ xMm: 10, yMm: 0, zMm: 0 });

    const free = projectGripDelta(
      {
        axis: 'xyz',
        startMm,
        currentMm: { xMm: 10, yMm: 200, zMm: 30 },
        shiftKey: true,
      },
      { dominantAxis: 'x' },
    );
    expect(free.deltaMm).toEqual({ xMm: 10, yMm: 200, zMm: 30 });
  });
});
