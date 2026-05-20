import { describe, expect, it } from 'vitest';

import { coerceElement } from '../storeCoercion';

describe('spatial element coercion', () => {
  it('coerces rooms from snake_case input with nullable numeric fields', () => {
    const element = coerceElement('room-1', {
      kind: 'room',
      name: 'Office',
      level_id: 'level-1',
      outline_mm: [
        { x_mm: '0', y_mm: '0' },
        { x_mm: '1000', y_mm: '0' },
      ],
      upper_limit_level_id: 'level-2',
      volume_ceiling_offset_mm: '300',
      programme_code: 'OFF',
      function_label: 'Work',
      finish_set: 'Standard',
      target_area_m2: null,
      volume_m3: '45',
      room_fill_pattern_override: 'solid',
      phase_created: 'New',
      props: { occupancy: 4 },
    });

    expect(element?.kind).toBe('room');
    if (element?.kind !== 'room') return;
    expect(element.levelId).toBe('level-1');
    expect(element.outlineMm).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
    ]);
    expect(element.upperLimitLevelId).toBe('level-2');
    expect(element.volumeCeilingOffsetMm).toBe(300);
    expect(element.programmeCode).toBe('OFF');
    expect(element.targetAreaM2).toBeNull();
    expect(element.volumeM3).toBe(45);
    expect(element.roomFillPatternOverride).toBe('solid');
    expect(element.phaseCreated).toBe('New');
    expect(element.props).toEqual({ occupancy: 4 });
  });

  it('coerces areas and drops invalid computed area values', () => {
    const element = coerceElement('area-1', {
      kind: 'area',
      name: 'Gross',
      level_id: 'level-1',
      boundary_mm: [
        { x_mm: '0', y_mm: '0' },
        { x_mm: '1000', y_mm: '0' },
      ],
      rule_set: 'gross',
      area_scheme: 'rentable',
      computed_area_sq_mm: 'bad',
      pinned: true,
      phase_created: 'Existing',
    });

    expect(element?.kind).toBe('area');
    if (element?.kind !== 'area') return;
    expect(element.levelId).toBe('level-1');
    expect(element.boundaryMm).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
    ]);
    expect(element.ruleSet).toBe('gross');
    expect(element.areaScheme).toBe('rentable');
    expect(element.computedAreaSqMm).toBeUndefined();
    expect(element.pinned).toBe(true);
    expect(element.phaseCreated).toBe('Existing');
    expect(element.phaseDemolished).toBeNull();
  });

  it('coerces room separation and plan regions with defaults', () => {
    const roomSeparation = coerceElement('sep-1', {
      kind: 'room_separation',
      name: 'Separation',
      level_id: 'level-1',
      start: { x_mm: '1', y_mm: '2' },
      end: { x_mm: '3', y_mm: '4' },
    });
    const planRegion = coerceElement('region-1', {
      kind: 'plan_region',
      name: 'Low cut',
      level_id: 'level-1',
      outline_mm: [{ x_mm: '0', y_mm: '0' }],
      cut_plane_offset_mm: 'bad',
    });

    expect(roomSeparation?.kind).toBe('room_separation');
    if (roomSeparation?.kind !== 'room_separation') return;
    expect(roomSeparation.levelId).toBe('level-1');
    expect(roomSeparation.start).toEqual({ xMm: 1, yMm: 2 });
    expect(roomSeparation.end).toEqual({ xMm: 3, yMm: 4 });

    expect(planRegion?.kind).toBe('plan_region');
    if (planRegion?.kind !== 'plan_region') return;
    expect(planRegion.outlineMm).toEqual([{ xMm: 0, yMm: 0 }]);
    expect(planRegion.cutPlaneOffsetMm).toBe(-500);
  });
});
