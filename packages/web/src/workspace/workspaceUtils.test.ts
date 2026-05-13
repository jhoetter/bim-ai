import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { buildPrimaryNavigationSections } from './workspaceUtils';

describe('buildPrimaryNavigationSections', () => {
  it('orders primary navigation groups and excludes resources/editing surfaces', () => {
    const sections = buildPrimaryNavigationSections({
      level_1: {
        kind: 'level',
        id: 'level_1',
        name: 'Level 1',
        elevationMm: 0,
      },
      plan_1: {
        kind: 'plan_view',
        id: 'plan_1',
        name: 'Level 1 Plan',
        levelId: 'level_1',
      },
      viewpoint_1: {
        kind: 'viewpoint',
        id: 'viewpoint_1',
        name: 'Default 3D',
        mode: 'orbit_3d',
        camera: {
          position: { xMm: 0, yMm: 0, zMm: 5000 },
          target: { xMm: 0, yMm: 0, zMm: 0 },
          up: { xMm: 0, yMm: 1, zMm: 0 },
        },
      },
      section_1: {
        kind: 'section_cut',
        id: 'section_1',
        name: 'Section A',
        lineStartMm: { xMm: 0, yMm: 0 },
        lineEndMm: { xMm: 1000, yMm: 0 },
      },
      sheet_1: {
        kind: 'sheet',
        id: 'sheet_1',
        name: 'A101',
        titleblockParameters: {
          sheetIntent: 'moodboard',
        },
      },
      schedule_1: {
        kind: 'schedule',
        id: 'schedule_1',
        name: 'Door Schedule',
      },
      concept_1: {
        kind: 'view_concept_board',
        id: 'concept_1',
        name: 'Massing',
        attachments: [],
      },
      wall_type_1: {
        kind: 'wall_type',
        id: 'wall_type_1',
        name: 'Generic Wall',
        layers: [],
      },
      family_type_1: {
        kind: 'family_type',
        id: 'family_type_1',
        name: 'Window Type',
        familyId: 'window-family',
        discipline: 'window',
        parameters: { name: 'Window Type' },
      },
    } as Record<string, Element>);

    expect(sections.map((section) => section.label)).toEqual([
      'Concept',
      'Floor Plans',
      '3D Views',
      'Sections',
      'Sheets',
      'Schedules',
    ]);
    expect(sections.flatMap((section) => section.rows.map((row) => row.label))).toEqual([
      'Massing',
      'Level 1 Plan',
      'Default 3D',
      'Section A',
      'A101',
      'Door Schedule',
    ]);
    expect(sections.find((section) => section.id === 'sheets')?.rows[0]?.hint).toContain(
      'Moodboard',
    );
    const serialized = JSON.stringify(sections);
    expect(serialized).not.toContain('"level_1"');
    expect(serialized).not.toMatch(/Generic Wall|Window Type|Types|Families/);
  });
});
