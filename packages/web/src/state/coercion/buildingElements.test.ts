import { describe, expect, it } from 'vitest';

import { coerceElement } from '../storeCoercion';

describe('building element coercion', () => {
  it('coerces levels and monitor sources from snake_case input', () => {
    const element = coerceElement('level-2', {
      kind: 'level',
      name: 'Level 2',
      elevation_mm: '3200',
      datum_kind: 'story',
      parent_level_id: 'level-1',
      offset_from_parent_mm: '3200',
      monitor_source: {
        link_id: 'link-1',
        element_id: 'src-level-2',
        source_revision_at_copy: '4',
        drifted: true,
        drifted_fields: ['elevationMm', 7],
      },
    });

    expect(element?.kind).toBe('level');
    if (element?.kind !== 'level') return;
    expect(element.elevationMm).toBe(3200);
    expect(element.datumKind).toBe('story');
    expect(element.parentLevelId).toBe('level-1');
    expect(element.offsetFromParentMm).toBe(3200);
    expect(element.monitorSource).toEqual({
      linkId: 'link-1',
      elementId: 'src-level-2',
      sourceRevisionAtCopy: 4,
      drifted: true,
      driftedFields: ['elevationMm', '7'],
    });
  });

  it('coerces walls with curves, constraints, and recess zones', () => {
    const element = coerceElement('wall-1', {
      kind: 'wall',
      name: 'Curved wall',
      levelId: 'level-1',
      start: { xMm: '0', yMm: '0' },
      end: { xMm: '4000', yMm: '0' },
      wall_curve: {
        kind: 'arc',
        center: { x_mm: '2000', y_mm: '1000' },
        radius_mm: '2000',
        start_angle_deg: '180',
        end_angle_deg: '360',
        sweep_deg: '180',
      },
      thickness_mm: '240',
      height_mm: '3100',
      top_constraint_host_face: 'top',
      recess_zones: [
        {
          along_t_start: '0.2',
          along_t_end: '0.4',
          setback_mm: '120',
          sill_height_mm: '900',
          floor_continues: true,
        },
        { along_t_start: 'bad', along_t_end: '0.7', setback_mm: '80' },
      ],
    });

    expect(element?.kind).toBe('wall');
    if (element?.kind !== 'wall') return;
    expect(element.wallCurve).toEqual({
      kind: 'arc',
      center: { xMm: 2000, yMm: 1000 },
      radiusMm: 2000,
      startAngleDeg: 180,
      endAngleDeg: 360,
      sweepDeg: 180,
    });
    expect(element.thicknessMm).toBe(240);
    expect(element.heightMm).toBe(3100);
    expect(element.topConstraintHostFace).toBe('top');
    expect(element.recessZones).toEqual([
      {
        alongTStart: 0.2,
        alongTEnd: 0.4,
        setbackMm: 120,
        sillHeightMm: 900,
        floorContinues: true,
      },
    ]);
  });

  it('coerces openings and preserves specialized door/window fields', () => {
    const door = coerceElement('door-1', {
      kind: 'door',
      name: 'Pocket door',
      wallId: 'wall-1',
      alongT: '0.5',
      widthMm: '1000',
      operation_type: 'pocket',
      sliding_track_side: 'in_pocket',
      lodPlan: 'detailed',
    });
    const window = coerceElement('window-1', {
      kind: 'window',
      wallId: 'wall-1',
      alongT: '0.4',
      widthMm: '1400',
      sill_height_mm: '800',
      height_mm: '1300',
      outline_kind: 'gable_trapezoid',
      attached_roof_id: 'roof-1',
    });

    expect(door?.kind).toBe('door');
    if (door?.kind !== 'door') return;
    expect(door.operationType).toBe('pocket');
    expect(door.slidingTrackSide).toBe('in_pocket');
    expect(door.lodPlan).toBe('detailed');

    expect(window?.kind).toBe('window');
    if (window?.kind !== 'window') return;
    expect(window.sillHeightMm).toBe(800);
    expect(window.heightMm).toBe(1300);
    expect(window.outlineKind).toBe('gable_trapezoid');
    expect(window.attachedRoofId).toBe('roof-1');
  });

  it('coerces grid lines and dimensions with anchor defaults', () => {
    const grid = coerceElement('grid-a', {
      kind: 'grid_line',
      label: 'A',
      start: { x_mm: '0', y_mm: '0' },
      end: { x_mm: '0', y_mm: '5000' },
      level_id: 'level-1',
    });
    const dimension = coerceElement('dim-1', {
      kind: 'dimension',
      name: 'Overall',
      levelId: 'level-1',
      a_mm: { x_mm: '0', y_mm: '0' },
      b_mm: { x_mm: '5000', y_mm: '0' },
      offset_mm: { x_mm: '0', y_mm: '500' },
      anchor_a: {
        kind: 'feature',
        feature: { elementId: 'wall-1', anchor: 'start' },
        fallback_position_mm: { x_mm: '0', y_mm: '0' },
      },
      anchor_b: { kind: 'bad', fallback_position_mm: { x_mm: '1', y_mm: '2' } },
      state: 'linked',
      ref_element_id_a: 'wall-1',
    });

    expect(grid?.kind).toBe('grid_line');
    if (grid?.kind !== 'grid_line') return;
    expect(grid.start).toEqual({ xMm: 0, yMm: 0 });
    expect(grid.end).toEqual({ xMm: 0, yMm: 5000 });
    expect(grid.levelId).toBe('level-1');

    expect(dimension?.kind).toBe('dimension');
    if (dimension?.kind !== 'dimension') return;
    expect(dimension.aMm).toEqual({ xMm: 0, yMm: 0 });
    expect(dimension.offsetMm).toEqual({ xMm: 0, yMm: 500 });
    expect(dimension.anchorA).toEqual({
      kind: 'feature',
      feature: { elementId: 'wall-1', anchor: 'start' },
      fallbackPositionMm: { xMm: 0, yMm: 0 },
    });
    expect(dimension.anchorB).toBeNull();
    expect(dimension.state).toBe('linked');
    expect(dimension.refElementIdA).toBe('wall-1');
  });
});
