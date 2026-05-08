import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { getHelperDimensions } from '../helperDimensions';

function makeWall(
  id: string,
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
  thicknessMm = 200,
): Extract<Element, { kind: 'wall' }> {
  return {
    kind: 'wall',
    id,
    name: id,
    levelId: 'lvl-1',
    start,
    end,
    thicknessMm,
    heightMm: 2800,
  };
}

function makeDoor(
  id: string,
  wallId: string,
  alongT: number,
  widthMm: number,
): Extract<Element, { kind: 'door' }> {
  return {
    kind: 'door',
    id,
    name: id,
    wallId,
    alongT,
    widthMm,
  };
}

describe('getHelperDimensions — wall', () => {
  it('returns length and thickness descriptors', () => {
    const wall = makeWall('w1', { xMm: 0, yMm: 0 }, { xMm: 5400, yMm: 0 });
    const dims = getHelperDimensions(wall, {});
    expect(dims).toHaveLength(2);
    expect(dims[0].id).toBe('wall-length');
    expect(dims[1].id).toBe('wall-thickness');
  });

  it('wall-length valueMm reflects actual distance', () => {
    const wall = makeWall('w1', { xMm: 0, yMm: 0 }, { xMm: 5400, yMm: 0 });
    const dims = getHelperDimensions(wall, {});
    const lengthDim = dims.find((d) => d.id === 'wall-length')!;
    expect(lengthDim.valueMm).toBeCloseTo(5400);
  });

  it('onCommit for length returns updateWall command with lengthMm', () => {
    const wall = makeWall('w1', { xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 });
    const dims = getHelperDimensions(wall, {});
    const lengthDim = dims.find((d) => d.id === 'wall-length')!;
    const cmd = lengthDim.onCommit(5400);
    expect(cmd).toEqual({ type: 'updateWall', id: 'w1', lengthMm: 5400 });
  });

  it('onCommit for thickness returns updateWall command with thicknessMm', () => {
    const wall = makeWall('w1', { xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 }, 200);
    const dims = getHelperDimensions(wall, {});
    const thickDim = dims.find((d) => d.id === 'wall-thickness')!;
    const cmd = thickDim.onCommit(300);
    expect(cmd).toEqual({ type: 'updateWall', id: 'w1', thicknessMm: 300 });
  });
});

describe('getHelperDimensions — door', () => {
  it('returns width descriptor for a door with a valid host wall', () => {
    const wall = makeWall('w1', { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 });
    const door = makeDoor('d1', 'w1', 0.5, 900);
    const elementsById: Record<string, Element> = { w1: wall };
    const dims = getHelperDimensions(door, elementsById);
    expect(dims).toHaveLength(1);
    expect(dims[0].id).toBe('door-width');
  });

  it('onCommit for door width returns updateDoor command', () => {
    const wall = makeWall('w1', { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 });
    const door = makeDoor('d1', 'w1', 0.5, 900);
    const elementsById: Record<string, Element> = { w1: wall };
    const dims = getHelperDimensions(door, elementsById);
    const cmd = dims[0].onCommit(1200);
    expect(cmd).toEqual({ type: 'updateDoor', id: 'd1', widthMm: 1200 });
  });

  it('returns empty array when host wall is missing', () => {
    const door = makeDoor('d1', 'w-missing', 0.5, 900);
    const dims = getHelperDimensions(door, {});
    expect(dims).toHaveLength(0);
  });
});

describe('getHelperDimensions — unknown kind', () => {
  it('returns empty array for an unhandled element kind', () => {
    const elem = {
      kind: 'room',
      id: 'r1',
      name: 'Room',
      levelId: 'lvl-1',
      outlineMm: [],
    } as unknown as Element;
    const dims = getHelperDimensions(elem, {});
    expect(dims).toHaveLength(0);
  });
});
