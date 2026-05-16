import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { elementInSelectionBoxMm } from './boxSelection';

const box = (
  xMm: number,
  yMm: number,
  w: number,
  h: number,
): { boxMinMm: { xMm: number; yMm: number }; boxMaxMm: { xMm: number; yMm: number } } => ({
  boxMinMm: { xMm, yMm },
  boxMaxMm: { xMm: xMm + w, yMm: yMm + h },
});

const wall = (
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): Extract<Element, { kind: 'wall' }> => ({
  kind: 'wall',
  id: 'w1',
  name: 'w1',
  levelId: 'L1',
  start,
  end,
  thicknessMm: 200,
  heightMm: 2800,
});

const column = (
  xMm: number,
  yMm: number,
  bMm = 400,
  hMm = 400,
): Extract<Element, { kind: 'column' }> => ({
  kind: 'column',
  id: 'c1',
  name: 'c1',
  levelId: 'L1',
  positionMm: { xMm, yMm },
  bMm,
  hMm,
  heightMm: 3000,
});

const room = (pts: { xMm: number; yMm: number }[]): Extract<Element, { kind: 'room' }> => ({
  kind: 'room',
  id: 'r1',
  name: 'r1',
  levelId: 'L1',
  outlineMm: pts,
  areaSqM: 0,
});

describe('elementInSelectionBoxMm — §1.8.1', () => {
  it('wall fully inside box: window mode returns true', () => {
    const el = wall({ xMm: 100, yMm: 100 }, { xMm: 500, yMm: 100 });
    const { boxMinMm, boxMaxMm } = box(0, 0, 1000, 1000);
    expect(elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'window')).toBe(true);
  });

  it('wall fully outside box: both modes return false', () => {
    const el = wall({ xMm: 2000, yMm: 2000 }, { xMm: 3000, yMm: 2000 });
    const { boxMinMm, boxMaxMm } = box(0, 0, 1000, 1000);
    expect(elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'window')).toBe(false);
    expect(elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'crossing')).toBe(false);
  });

  it('wall crossing box edge: crossing mode returns true, window mode false', () => {
    // wall starts inside, ends outside
    const el = wall({ xMm: 500, yMm: 500 }, { xMm: 1500, yMm: 500 });
    const { boxMinMm, boxMaxMm } = box(0, 0, 1000, 1000);
    expect(elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'window')).toBe(false);
    expect(elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'crossing')).toBe(true);
  });

  it('column footprint inside box: window mode returns true', () => {
    const el = column(500, 500, 200, 200);
    const { boxMinMm, boxMaxMm } = box(0, 0, 1000, 1000);
    expect(elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'window')).toBe(true);
  });

  it('room AABB crossing box: crossing mode returns true', () => {
    // room straddles the right edge of the box
    const el = room([
      { xMm: 800, yMm: 200 },
      { xMm: 1200, yMm: 200 },
      { xMm: 1200, yMm: 800 },
      { xMm: 800, yMm: 800 },
    ]);
    const { boxMinMm, boxMaxMm } = box(0, 0, 1000, 1000);
    expect(elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'crossing')).toBe(true);
    expect(elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'window')).toBe(false);
  });

  it('left-to-right drag is window, right-to-left is crossing', () => {
    // element that partially overlaps box — window rejects it, crossing accepts it
    const el = wall({ xMm: 500, yMm: 500 }, { xMm: 1500, yMm: 500 });
    const { boxMinMm, boxMaxMm } = box(0, 0, 1000, 1000);
    const windowResult = elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'window');
    const crossingResult = elementInSelectionBoxMm(el, boxMinMm, boxMaxMm, 'crossing');
    expect(windowResult).toBe(false);
    expect(crossingResult).toBe(true);
  });
});
