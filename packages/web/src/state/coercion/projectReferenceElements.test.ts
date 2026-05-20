import { describe, expect, it } from 'vitest';

import { coerceElement } from '../storeCoercion';

describe('project reference element coercion', () => {
  it('coerces project reference planes from snake_case input', () => {
    const element = coerceElement('ref-1', {
      kind: 'reference_plane',
      name: 'Grid work plane',
      level_id: 'level-1',
      start_mm: { x_mm: '100', y_mm: 'bad' },
      end_mm: { x_mm: 5000, y_mm: 1000 },
      is_work_plane: true,
      pinned: true,
    });

    expect(element?.kind).toBe('reference_plane');
    if (element?.kind !== 'reference_plane' || !('levelId' in element)) return;
    expect(element.name).toBe('Grid work plane');
    expect(element.levelId).toBe('level-1');
    expect(element.startMm).toEqual({ xMm: 100, yMm: 0 });
    expect(element.endMm).toEqual({ xMm: 5000, yMm: 1000 });
    expect(element.isWorkPlane).toBe(true);
    expect(element.pinned).toBe(true);
  });

  it('coerces family reference planes from camelCase input', () => {
    const element = coerceElement('family-ref-1', {
      kind: 'reference_plane',
      name: 'Centerline',
      familyEditorId: 'family-1',
      isVertical: true,
      offsetMm: 'bad',
      isSymmetryRef: true,
    });

    expect(element?.kind).toBe('reference_plane');
    if (element?.kind !== 'reference_plane' || !('familyEditorId' in element)) return;
    expect(element.familyEditorId).toBe('family-1');
    expect(element.isVertical).toBe(true);
    expect(element.offsetMm).toBe(0);
    expect(element.isSymmetryRef).toBe(true);
  });

  it('coerces property lines and selection-set rules with defaults', () => {
    const propertyLine = coerceElement('pl-1', {
      kind: 'property_line',
      name: 'Side lot line',
      start: { x_mm: '5', y_mm: '10' },
      end: { xMm: 'bad', yMm: '20' },
      setback_mm: '1200',
      classification: 'side',
      pinned: true,
    });
    const selectionSet = coerceElement('set-1', {
      kind: 'selection_set',
      name: 'Walls',
      filter_rules: [
        { field: 'typeName', operator: 'contains', value: 'Exterior' },
        { field: 'bad', operator: 'bad', value: 7 },
      ],
    });

    expect(propertyLine?.kind).toBe('property_line');
    if (propertyLine?.kind !== 'property_line') return;
    expect(propertyLine.startMm).toEqual({ xMm: 5, yMm: 10 });
    expect(propertyLine.endMm).toEqual({ xMm: 0, yMm: 20 });
    expect(propertyLine.setbackMm).toBe(1200);
    expect(propertyLine.classification).toBe('side');

    expect(selectionSet?.kind).toBe('selection_set');
    if (selectionSet?.kind !== 'selection_set') return;
    expect(selectionSet.filterRules).toEqual([
      { field: 'typeName', operator: 'contains', value: 'Exterior' },
      { field: 'category', operator: 'equals', value: '7' },
    ]);
  });

  it('coerces shared coordinate points from snake_case input', () => {
    const basePoint = coerceElement('base-1', {
      kind: 'project_base_point',
      position_mm: { x_mm: '1', y_mm: '2', z_mm: '3' },
      angle_to_true_north_deg: 'bad',
      clipped: true,
    });
    const surveyPoint = coerceElement('survey-1', {
      kind: 'survey_point',
      position_mm: { x_mm: '4', y_mm: '5', z_mm: '6' },
      shared_elevation_mm: '700',
    });

    expect(basePoint?.kind).toBe('project_base_point');
    if (basePoint?.kind !== 'project_base_point') return;
    expect(basePoint.positionMm).toEqual({ xMm: 1, yMm: 2, zMm: 3 });
    expect(basePoint.angleToTrueNorthDeg).toBe(0);
    expect(basePoint.clipped).toBe(true);

    expect(surveyPoint?.kind).toBe('survey_point');
    if (surveyPoint?.kind !== 'survey_point') return;
    expect(surveyPoint.positionMm).toEqual({ xMm: 4, yMm: 5, zMm: 6 });
    expect(surveyPoint.sharedElevationMm).toBe(700);
    expect(surveyPoint.clipped).toBe(false);
  });
});
