import { describe, it, expect } from 'vitest';
import { buildCategoryRows, deselectByCategory } from './selectionFilter';
import type { Element } from '@bim-ai/core';

const wall = (id: string): Element =>
  ({
    kind: 'wall',
    id,
    name: id,
    levelId: 'L1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 1000, yMm: 0 },
    thicknessMm: 200,
    heightMm: 2700,
  }) as unknown as Element;

const door = (id: string): Element =>
  ({
    kind: 'door',
    id,
    name: id,
    levelId: 'L1',
    hostWallId: 'w1',
    insertionPoint: { xMm: 500, yMm: 0 },
    widthMm: 900,
    heightMm: 2100,
    familyId: 'door-single',
  }) as unknown as Element;

const elementsById = {
  w1: wall('w1'),
  w2: wall('w2'),
  w3: wall('w3'),
  d1: door('d1'),
  d2: door('d2'),
};

describe('buildCategoryRows', () => {
  it('groups by kind and counts correctly', () => {
    const rows = buildCategoryRows(['w1', 'w2', 'd1'], elementsById as Record<string, Element>);
    expect(rows).toHaveLength(2);
    const wall = rows.find((r) => r.kind === 'wall')!;
    const door = rows.find((r) => r.kind === 'door')!;
    expect(wall.count).toBe(2);
    expect(door.count).toBe(1);
  });

  it('sorts by count descending', () => {
    const rows = buildCategoryRows(
      ['w1', 'w2', 'w3', 'd1', 'd2'],
      elementsById as Record<string, Element>,
    );
    expect(rows[0]!.kind).toBe('wall');
    expect(rows[0]!.count).toBe(3);
  });

  it('returns empty array for empty selection', () => {
    expect(buildCategoryRows([], elementsById as Record<string, Element>)).toEqual([]);
  });

  it('skips IDs not in elementsById', () => {
    const rows = buildCategoryRows(['w1', 'unknown-id'], elementsById as Record<string, Element>);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('wall');
  });

  it('labels kinds in Title Case', () => {
    const elems = { f1: { kind: 'floor', id: 'f1' } };
    const rows = buildCategoryRows(['f1'], elems as Record<string, Element>);
    expect(rows[0]!.label).toBe('Floor');
  });
});

describe('deselectByCategory', () => {
  it('keeps only elements of the kept kinds', () => {
    const result = deselectByCategory(
      'w1',
      ['w2', 'd1'],
      elementsById as Record<string, Element>,
      new Set(['wall']),
    );
    expect(result.selectedId).toBe('w1');
    expect(result.selectedIds).toEqual(['w2']);
  });

  it('removes all elements when keepKinds is empty', () => {
    const result = deselectByCategory(
      'w1',
      ['d1'],
      elementsById as Record<string, Element>,
      new Set([]),
    );
    expect(result.selectedId).toBeUndefined();
    expect(result.selectedIds).toEqual([]);
  });

  it('promotes first remaining element to primary when original primary is removed', () => {
    const result = deselectByCategory(
      'd1',
      ['w1', 'w2'],
      elementsById as Record<string, Element>,
      new Set(['wall']),
    );
    expect(result.selectedId).toBe('w1');
    expect(result.selectedIds).toEqual(['w2']);
  });

  it('keeps all elements when all kinds are retained', () => {
    const result = deselectByCategory(
      'w1',
      ['d1', 'w2'],
      elementsById as Record<string, Element>,
      new Set(['wall', 'door']),
    );
    expect(result.selectedId).toBe('w1');
    expect(result.selectedIds).toContain('d1');
    expect(result.selectedIds).toContain('w2');
  });
});
