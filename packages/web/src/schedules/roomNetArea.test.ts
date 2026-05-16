import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { computeRoomNetAreaMm2 } from './roomNetArea';

const roomSquare: Extract<Element, { kind: 'room' }> = {
  kind: 'room',
  id: 'room-1',
  name: 'Living Room',
  levelId: 'lvl-1',
  outlineMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ],
};

const column: Extract<Element, { kind: 'column' }> = {
  kind: 'column',
  id: 'col-1',
  name: 'C1',
  levelId: 'lvl-1',
  positionMm: { xMm: 2500, yMm: 2000 },
  bMm: 300,
  hMm: 300,
  heightMm: 3000,
};

describe('computeRoomNetAreaMm2', () => {
  it('returns gross area when no columns or walls are present', () => {
    const net = computeRoomNetAreaMm2(roomSquare, {});
    expect(net).toBeCloseTo(5000 * 4000);
  });

  it('subtracts column footprint when column centre is inside boundary', () => {
    const net = computeRoomNetAreaMm2(roomSquare, { 'col-1': column });
    const expected = 5000 * 4000 - 300 * 300;
    expect(net).toBeCloseTo(expected);
  });

  it('does not subtract wall whose midpoint is outside the boundary', () => {
    const outsideWall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'wall-out',
      name: 'Outside',
      levelId: 'lvl-1',
      start: { xMm: 6000, yMm: 0 },
      end: { xMm: 8000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    };
    const net = computeRoomNetAreaMm2(roomSquare, { 'wall-out': outsideWall });
    expect(net).toBeCloseTo(5000 * 4000);
  });

  it('never returns below zero', () => {
    const hugeColumn: Extract<Element, { kind: 'column' }> = {
      ...column,
      id: 'col-big',
      bMm: 100_000,
      hMm: 100_000,
    };
    const net = computeRoomNetAreaMm2(roomSquare, { 'col-big': hugeColumn });
    expect(net).toBe(0);
  });
});
