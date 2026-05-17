import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { autoTagElements } from './autoTags';

const wallId = 'wall-001';
const wall: Extract<Element, { kind: 'wall' }> = {
  kind: 'wall',
  id: wallId,
  name: 'W1',
  levelId: 'lvl-1',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

const wallType: Extract<Element, { kind: 'wall_type' }> = {
  kind: 'wall_type',
  id: 'wt-1',
  name: 'Ext Wall 200',
  layers: [],
};

const walWithType: Extract<Element, { kind: 'wall' }> = {
  ...wall,
  id: 'wall-002',
  wallTypeId: wallType.id,
};

const door: Extract<Element, { kind: 'door' }> = {
  kind: 'door',
  id: 'door-abc',
  name: 'D1',
  wallId,
  alongT: 0.5,
  widthMm: 900,
};

const doorWithType: Extract<Element, { kind: 'door' }> = {
  ...door,
  id: 'door-xyz',
  familyTypeId: 'ft-1',
};

const familyType: Extract<Element, { kind: 'family_type' }> = {
  kind: 'family_type',
  id: 'ft-1',
  familyId: 'fam-door',
  name: 'Single Door 900',
  discipline: 'door',
  parameters: {},
};

const window_: Extract<Element, { kind: 'window' }> = {
  kind: 'window',
  id: 'win-abc',
  name: 'W1',
  wallId,
  alongT: 0.25,
  widthMm: 1200,
  sillHeightMm: 900,
  heightMm: 1500,
};

const room: Extract<Element, { kind: 'room' }> = {
  kind: 'room',
  id: 'room-001',
  name: 'Living',
  levelId: 'lvl-1',
  numberLabel: '101',
  outlineMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 4000, yMm: 0 },
    { xMm: 4000, yMm: 3000 },
    { xMm: 0, yMm: 3000 },
  ],
};

describe('autoTagElements — §4.11.1', () => {
  it('generates a door tag with mark and typeName', () => {
    const elements: Element[] = [wall, doorWithType, familyType];
    const tags = autoTagElements(elements, 'lvl-1');
    const doorTag = tags.find((t) => t.targetElementId === doorWithType.id);
    expect(doorTag).toBeDefined();
    expect(doorTag!.categoryKind).toBe('door');
    expect(doorTag!.fields.mark).toBe(doorWithType.id.slice(-3));
    expect(doorTag!.fields.typeName).toBe('Single Door 900');
    expect(doorTag!.fields.widthMm).toBe(900);
  });

  it('generates a window tag with widthMm and heightMm', () => {
    const elements: Element[] = [wall, window_];
    const tags = autoTagElements(elements, 'lvl-1');
    const winTag = tags.find((t) => t.targetElementId === window_.id);
    expect(winTag).toBeDefined();
    expect(winTag!.categoryKind).toBe('window');
    expect(winTag!.fields.widthMm).toBe(1200);
    expect(winTag!.fields.heightMm).toBe(1500);
  });

  it('generates a room tag with roomName and roomNumber', () => {
    const elements: Element[] = [room];
    const tags = autoTagElements(elements, 'lvl-1');
    const roomTag = tags.find((t) => t.targetElementId === room.id);
    expect(roomTag).toBeDefined();
    expect(roomTag!.categoryKind).toBe('room');
    expect(roomTag!.fields.roomName).toBe('Living');
    expect(roomTag!.fields.roomNumber).toBe('101');
    expect(roomTag!.leaderEndMm).toBeNull();
  });

  it('tag id is stable across repeated calls for the same element', () => {
    const elements: Element[] = [wall, door];
    const tags1 = autoTagElements(elements, 'lvl-1');
    const tags2 = autoTagElements(elements, 'lvl-1');
    const id1 = tags1.find((t) => t.targetElementId === door.id)?.id;
    const id2 = tags2.find((t) => t.targetElementId === door.id)?.id;
    expect(id1).toBe(`auto-tag-${door.id}`);
    expect(id1).toBe(id2);
  });

  it('does not duplicate tags for same targetElementId', () => {
    const elements: Element[] = [wall, door];
    const tags = autoTagElements(elements, 'lvl-1');
    const doorTags = tags.filter((t) => t.targetElementId === door.id);
    expect(doorTags).toHaveLength(1);
  });

  it('skips elements on a different level', () => {
    const otherRoom = { ...room, id: 'room-002', levelId: 'lvl-2' };
    const elements: Element[] = [room, otherRoom as Element];
    const tags = autoTagElements(elements, 'lvl-1');
    expect(tags.every((t) => t.targetElementId !== otherRoom.id)).toBe(true);
  });

  it('generates a wall tag with typeName from wallTypeId', () => {
    const elements: Element[] = [walWithType, wallType];
    const tags = autoTagElements(elements, 'lvl-1');
    const wallTag = tags.find((t) => t.targetElementId === walWithType.id);
    expect(wallTag).toBeDefined();
    expect(wallTag!.categoryKind).toBe('wall');
    expect(wallTag!.fields.typeName).toBe('Ext Wall 200');
    expect(wallTag!.leaderEndMm).not.toBeNull();
  });

  it('door tag has a leaderEndMm pointing at the wall position', () => {
    const elements: Element[] = [wall, door];
    const tags = autoTagElements(elements, 'lvl-1');
    const doorTag = tags.find((t) => t.targetElementId === door.id);
    expect(doorTag!.leaderEndMm).not.toBeNull();
    expect(doorTag!.leaderEndMm!.xMm).toBeCloseTo(3000);
    expect(doorTag!.leaderEndMm!.yMm).toBeCloseTo(0);
  });
});
