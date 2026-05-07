import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { gripsFor, wallGripProvider, type Wall } from './gripProtocol';

const SAMPLE_WALL: Wall = {
  kind: 'wall',
  id: 'wall-1',
  name: 'Wall',
  levelId: 'L1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 5000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2700,
};

describe('EDT-01 — wallGripProvider', () => {
  it('emits four grips: start endpoint, end endpoint, midpoint move, thickness', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    expect(grips).toHaveLength(4);
    const ids = grips.map((g) => g.id);
    expect(ids).toContain('wall-1:start');
    expect(ids).toContain('wall-1:end');
    expect(ids).toContain('wall-1:move');
    expect(ids).toContain('wall-1:thickness');
  });

  it('positions start/end grips at the wall endpoints', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const start = grips.find((g) => g.id === 'wall-1:start')!;
    const end = grips.find((g) => g.id === 'wall-1:end')!;
    expect(start.positionMm).toEqual({ xMm: 0, yMm: 0 });
    expect(end.positionMm).toEqual({ xMm: 5000, yMm: 0 });
    expect(start.shape).toBe('square');
    expect(end.shape).toBe('square');
  });

  it('places the midpoint grip at the wall centre with circle shape', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const move = grips.find((g) => g.id === 'wall-1:move')!;
    expect(move.positionMm).toEqual({ xMm: 2500, yMm: 0 });
    expect(move.shape).toBe('circle');
  });

  it('places the thickness arrow on the cut edge', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const t = grips.find((g) => g.id === 'wall-1:thickness')!;
    // For a horizontal wall (start.y == end.y), the unit normal is (0, 1).
    // Half-thickness offset = 100mm.
    expect(t.positionMm.xMm).toBe(2500);
    expect(t.positionMm.yMm).toBe(100);
    expect(t.shape).toBe('arrow');
    expect(t.axis).toBe('normal_to_element');
  });

  it('endpoint onCommit produces moveWallEndpoints with the deltaed end', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const end = grips.find((g) => g.id === 'wall-1:end')!;
    const cmd = end.onCommit({ xMm: 1000, yMm: 200 });
    expect(cmd).toEqual({
      type: 'moveWallEndpoints',
      wallId: 'wall-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 6000, yMm: 200 },
    });
  });

  it('endpoint onDrag returns a draft mutation with new endpoint', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const end = grips.find((g) => g.id === 'wall-1:end')!;
    const draft = end.onDrag({ xMm: 100, yMm: -50 });
    expect(draft).toEqual({
      kind: 'wall',
      id: 'wall-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5100, yMm: -50 },
      thicknessMm: 200,
    });
  });

  it('endpoint onNumericOverride sets exact length anchored at the other endpoint', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const end = grips.find((g) => g.id === 'wall-1:end')!;
    const cmd = end.onNumericOverride(7000) as Record<string, { xMm: number; yMm: number }>;
    // Wall direction is +X, length 7000 anchored at start (0,0) → end (7000,0).
    expect(cmd.type).toBe('moveWallEndpoints');
    expect(cmd.start).toEqual({ xMm: 0, yMm: 0 });
    expect(cmd.end.xMm).toBeCloseTo(7000, 6);
    expect(cmd.end.yMm).toBeCloseTo(0, 6);
  });

  it('midpoint move onCommit emits moveWallDelta', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const move = grips.find((g) => g.id === 'wall-1:move')!;
    expect(move.onCommit({ xMm: 250, yMm: -100 })).toEqual({
      type: 'moveWallDelta',
      wallId: 'wall-1',
      dxMm: 250,
      dyMm: -100,
    });
  });

  it('thickness onDrag updates thicknessMm by 2x normal projection', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const t = grips.find((g) => g.id === 'wall-1:thickness')!;
    // Wall is horizontal — drag +Y by 50mm projects 50 onto normal,
    // so new thickness = 200 + 2*50 = 300mm.
    const draft = t.onDrag({ xMm: 0, yMm: 50 });
    expect(draft).toMatchObject({ kind: 'wall', thicknessMm: 300 });
  });

  it('thickness onCommit emits updateElementProperty with the clamped thickness', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const t = grips.find((g) => g.id === 'wall-1:thickness')!;
    // Drag inward by 200mm → new thickness clamped to floor 20.
    expect(t.onCommit({ xMm: 0, yMm: -200 })).toEqual({
      type: 'updateElementProperty',
      elementId: 'wall-1',
      key: 'thicknessMm',
      value: 20,
    });
  });

  it('thickness onNumericOverride sets the exact thickness floor-clamped to 20mm', () => {
    const grips = wallGripProvider.grips(SAMPLE_WALL, {});
    const t = grips.find((g) => g.id === 'wall-1:thickness')!;
    expect(t.onNumericOverride(150)).toEqual({
      type: 'updateElementProperty',
      elementId: 'wall-1',
      key: 'thicknessMm',
      value: 150,
    });
    expect(t.onNumericOverride(5)).toEqual({
      type: 'updateElementProperty',
      elementId: 'wall-1',
      key: 'thicknessMm',
      value: 20,
    });
  });
});

describe('EDT-01 — gripsFor dispatch', () => {
  it('returns wall grips for a wall element', () => {
    const grips = gripsFor(SAMPLE_WALL);
    expect(grips.length).toBe(4);
  });

  it('returns an empty list for kinds not yet wired (door, floor, etc.)', () => {
    const door: Element = {
      kind: 'door',
      id: 'd1',
      name: 'Door',
      wallId: 'wall-1',
      alongT: 0.5,
      widthMm: 900,
    };
    expect(gripsFor(door)).toEqual([]);
  });
});
