import { describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { buildModelIndices } from './modelIndices';

describe('buildModelIndices', () => {
  it('groups common BIM elements by access pattern', () => {
    const elementsById: Record<string, Element> = {
      l2: { kind: 'level', id: 'l2', name: 'Level 2', elevationMm: 3000 },
      l1: { kind: 'level', id: 'l1', name: 'Level 1', elevationMm: 0 },
      w1: {
        kind: 'wall',
        id: 'w1',
        name: 'Wall 1',
        levelId: 'l1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 1000, yMm: 0 },
        thicknessMm: 200,
        heightMm: 2800,
      },
      d1: { kind: 'door', id: 'd1', name: 'Door', wallId: 'w1', alongT: 0.5, widthMm: 900 },
      r1: {
        kind: 'room',
        id: 'r1',
        name: 'Room',
        levelId: 'l1',
        outlineMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 0 },
          { xMm: 1000, yMm: 1000 },
          { xMm: 0, yMm: 1000 },
        ],
      },
      pv1: { kind: 'plan_view', id: 'pv1', name: 'Plan', levelId: 'l1' },
      sch1: { kind: 'schedule', id: 'sch1', name: 'Rooms', filters: { category: 'room' } },
      sh1: { kind: 'sheet', id: 'sh1', name: 'A101' },
      ps1: { kind: 'project_settings', id: 'ps1', name: 'Settings' },
    };

    const indices = buildModelIndices(elementsById);

    expect(indices.levels.map((level) => level.id)).toEqual(['l1', 'l2']);
    expect(indices.wallsByLevel.l1?.map((wall) => wall.id)).toEqual(['w1']);
    expect(indices.roomsByLevel.l1?.map((room) => room.id)).toEqual(['r1']);
    expect(indices.openingsByWall.w1?.map((opening) => opening.id)).toEqual(['d1']);
    expect(indices.planViews.map((view) => view.id)).toEqual(['pv1']);
    expect(indices.schedules.map((schedule) => schedule.id)).toEqual(['sch1']);
    expect(indices.sheets.map((sheet) => sheet.id)).toEqual(['sh1']);
    expect(indices.projectSettings?.id).toBe('ps1');
    expect(indices.selectableIds).toEqual([
      'd1',
      'l1',
      'l2',
      'ps1',
      'pv1',
      'r1',
      'sch1',
      'sh1',
      'w1',
    ]);
  });
});
