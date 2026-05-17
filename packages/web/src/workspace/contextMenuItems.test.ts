import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@bim-ai/core';

import { contextMenuItemsForElement } from './contextMenuItems';

const extras = { activeLevelId: 'lvl-1', planTool: 'select' };

const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: 'w-1',
  name: 'Wall',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

const door: Extract<Element, { kind: 'door' }> = {
  kind: 'door',
  id: 'd-1',
  name: 'Door',
  wallId: 'w-1',
  alongT: 0.5,
  widthMm: 900,
};

const floor: Extract<Element, { kind: 'floor' }> = {
  kind: 'floor',
  id: 'f-1',
  name: 'Floor',
  levelId: 'lvl-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ],
  thicknessMm: 200,
};

const room: Extract<Element, { kind: 'room' }> = {
  kind: 'room',
  id: 'r-1',
  name: 'Room',
  levelId: 'lvl-1',
  outlineMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 4000 },
    { xMm: 0, yMm: 4000 },
  ],
};

const detailGroup: Extract<Element, { kind: 'detail_group' }> = {
  kind: 'detail_group',
  id: 'dg-1',
  hostViewId: 'view-1',
  memberIds: ['e-1', 'e-2'],
};

const stair: Extract<Element, { kind: 'stair' }> = {
  kind: 'stair',
  id: 's-1',
  name: 'Stair',
  baseLevelId: 'lvl-1',
  topLevelId: 'lvl-2',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 0, yMm: 3000 },
  widthMm: 1200,
  riserMm: 175,
  treadMm: 280,
};

describe('contextMenuItemsForElement — §1.7.2', () => {
  it('wall returns items including Flip and Split Element', () => {
    const items = contextMenuItemsForElement(wall, vi.fn(), extras);
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Flip');
    expect(labels).toContain('Split Element');
  });

  it('door returns Flip Facing and Flip Handing items', () => {
    const items = contextMenuItemsForElement(door, vi.fn(), extras);
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Flip Facing');
    expect(labels).toContain('Flip Handing');
  });

  it('floor returns Edit Boundary item', () => {
    const items = contextMenuItemsForElement(floor, vi.fn(), extras);
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Edit Boundary');
  });

  it('room returns Edit Name and Select Similar items', () => {
    const items = contextMenuItemsForElement(room, vi.fn(), extras);
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Edit Name');
    expect(labels).toContain('Select Similar');
  });

  it('detail_group returns Edit Group item', () => {
    const items = contextMenuItemsForElement(detailGroup, vi.fn(), extras);
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Edit Group');
  });

  it('any element returns Delete item', () => {
    for (const el of [wall, door, floor, room, stair, detailGroup] as Element[]) {
      const items = contextMenuItemsForElement(el, vi.fn(), extras);
      const labels = items.map((i) => i.label);
      expect(labels).toContain('Delete');
    }
  });

  it('wall Flip dispatches updateElementProperty for locationLine', () => {
    const dispatch = vi.fn();
    const items = contextMenuItemsForElement(wall, dispatch, extras);
    const flip = items.find((i) => i.label === 'Flip');
    expect(flip).toBeDefined();
    flip!.onClick();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updateElementProperty', key: 'locationLine' }),
    );
  });

  it('door Flip Facing dispatches updateElementProperty for facingFlipped', () => {
    const dispatch = vi.fn();
    const items = contextMenuItemsForElement(door, dispatch, extras);
    const flip = items.find((i) => i.label === 'Flip Facing');
    expect(flip).toBeDefined();
    flip!.onClick();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updateElementProperty', key: 'facingFlipped' }),
    );
  });

  it('stair Create Floor Opening dispatches create_shaft', () => {
    const dispatch = vi.fn();
    const items = contextMenuItemsForElement(stair, dispatch, extras);
    const btn = items.find((i) => i.label === 'Create Floor Opening');
    expect(btn).toBeDefined();
    btn!.onClick();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'create_shaft', baseLevelId: 'lvl-1' }),
    );
  });
});
