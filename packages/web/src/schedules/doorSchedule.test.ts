import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { buildDoorSchedule } from './doorSchedule';

function makeLevel(id: string, name: string): Element {
  return { kind: 'level', id, name, elevationMm: 0 } as unknown as Element;
}

function makeWall(id: string, levelId: string): Element {
  return {
    kind: 'wall',
    id,
    levelId,
    name: `Wall ${id}`,
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 1000, yMm: 0 },
    heightMm: 3000,
    thicknessMm: 200,
    wallTypeId: null,
  } as unknown as Element;
}

function makeDoor(id: string, wallId: string, familyTypeId?: string, widthMm = 900): Element {
  return {
    kind: 'door',
    id,
    name: `Door ${id}`,
    wallId,
    alongT: 0.5,
    widthMm,
    familyTypeId: familyTypeId ?? null,
  } as unknown as Element;
}

describe('buildDoorSchedule — §13.3.1', () => {
  it('returns empty array when no doors', () => {
    const result = buildDoorSchedule({});
    expect(result).toEqual([]);
  });

  it('groups doors by typeId', () => {
    const elementsById: Record<string, Element> = {
      lvl1: makeLevel('lvl1', 'Level 1'),
      w1: makeWall('w1', 'lvl1'),
      w2: makeWall('w2', 'lvl1'),
      d1: makeDoor('d1', 'w1', 'TypeA'),
      d2: makeDoor('d2', 'w2', 'TypeA'),
      d3: makeDoor('d3', 'w1', 'TypeB'),
    };
    const rows = buildDoorSchedule(elementsById);
    expect(rows).toHaveLength(2);
    const typeIds = rows.map((r) => r.typeId);
    expect(typeIds).toContain('TypeA');
    expect(typeIds).toContain('TypeB');
  });

  it('assigns sequential mark numbers D1, D2, ...', () => {
    const elementsById: Record<string, Element> = {
      lvl1: makeLevel('lvl1', 'Level 1'),
      w1: makeWall('w1', 'lvl1'),
      d1: makeDoor('d1', 'w1', 'TypeB'),
      d2: makeDoor('d2', 'w1', 'TypeA'),
    };
    const rows = buildDoorSchedule(elementsById);
    const marks = rows.map((r) => r.mark);
    expect(marks).toContain('D1');
    expect(marks).toContain('D2');
  });

  it('counts doors correctly within each type group', () => {
    const elementsById: Record<string, Element> = {
      lvl1: makeLevel('lvl1', 'Level 1'),
      w1: makeWall('w1', 'lvl1'),
      w2: makeWall('w2', 'lvl1'),
      w3: makeWall('w3', 'lvl1'),
      d1: makeDoor('d1', 'w1', 'TypeA'),
      d2: makeDoor('d2', 'w2', 'TypeA'),
      d3: makeDoor('d3', 'w3', 'TypeA'),
      d4: makeDoor('d4', 'w1', 'TypeB'),
    };
    const rows = buildDoorSchedule(elementsById);
    const typeA = rows.find((r) => r.typeId === 'TypeA');
    const typeB = rows.find((r) => r.typeId === 'TypeB');
    expect(typeA?.count).toBe(3);
    expect(typeB?.count).toBe(1);
  });

  it('resolves level name from wall levelId', () => {
    const elementsById: Record<string, Element> = {
      lvl1: makeLevel('lvl1', 'Ground Floor'),
      w1: makeWall('w1', 'lvl1'),
      d1: makeDoor('d1', 'w1', 'TypeA'),
    };
    const rows = buildDoorSchedule(elementsById);
    expect(rows[0]?.levelName).toBe('Ground Floor');
  });

  it('uses Generic when familyTypeId is null', () => {
    const elementsById: Record<string, Element> = {
      lvl1: makeLevel('lvl1', 'L1'),
      w1: makeWall('w1', 'lvl1'),
      d1: makeDoor('d1', 'w1', undefined),
    };
    const rows = buildDoorSchedule(elementsById);
    expect(rows[0]?.typeId).toBe('Generic');
  });
});
