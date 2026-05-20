import { describe, expect, it } from 'vitest';

import { coerceElement } from '../storeCoercion';

describe('site element coercion', () => {
  it('coerces toposolid camelCase wire input with height samples and grid', () => {
    const element = coerceElement('topo-1', {
      kind: 'toposolid',
      name: 'Sloped site',
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
        { xMm: 1000, yMm: 1000 },
      ],
      heightSamples: [{ xMm: 0, yMm: 0, zMm: 125 }],
      heightmapGridMm: { stepMm: 500, rows: 1, cols: 2, values: ['10', 20] },
      thicknessMm: '900',
      baseElevationMm: '-100',
      defaultMaterialKey: 'site_grass',
      pinned: true,
    });

    expect(element?.kind).toBe('toposolid');
    if (element?.kind !== 'toposolid') return;
    expect(element.boundaryMm).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
    ]);
    expect(element.heightSamples).toEqual([{ xMm: 0, yMm: 0, zMm: 125 }]);
    expect(element.heightmapGridMm).toEqual({
      stepMm: 500,
      rows: 1,
      cols: 2,
      values: [10, 20],
    });
    expect(element.thicknessMm).toBe(900);
    expect(element.baseElevationMm).toBe(-100);
    expect(element.defaultMaterialKey).toBe('site_grass');
    expect(element.pinned).toBe(true);
  });

  it('coerces toposolid snake_case wire input and defaults invalid numeric points', () => {
    const element = coerceElement('topo-2', {
      kind: 'toposolid',
      boundary_mm: [{ x_mm: 'bad', y_mm: 20 }],
      height_samples: [{ x_mm: 10, y_mm: 'bad', z_mm: 'also-bad' }],
      heightmap_grid_mm: { step_mm: 'bad', rows: '2', cols: 'bad', values: ['bad', 5] },
      thickness_mm: 'not-a-number',
    });

    expect(element?.kind).toBe('toposolid');
    if (element?.kind !== 'toposolid') return;
    expect(element.name).toBe('topo-2');
    expect(element.boundaryMm).toEqual([{ xMm: 0, yMm: 20 }]);
    expect(element.heightSamples).toEqual([{ xMm: 10, yMm: 0, zMm: 0 }]);
    expect(element.heightmapGridMm).toEqual({ stepMm: 0, rows: 2, cols: 0, values: [0, 5] });
    expect(element.thicknessMm).toBe(1500);
  });

  it('coerces subdivision and graded region relation fields from snake_case input', () => {
    const subdivision = coerceElement('sub-1', {
      kind: 'toposolid_subdivision',
      name: 'Drive',
      host_toposolid_id: 'topo-1',
      boundary_mm: [{ x_mm: 1, y_mm: 2 }],
      finish_category: 'paving',
      material_key: 'asphalt',
    });
    const graded = coerceElement('grade-1', {
      kind: 'graded_region',
      host_toposolid_id: 'topo-1',
      boundary_mm: [{ x_mm: 3, y_mm: 4 }],
      target_mode: 'slope',
      target_z_mm: '120',
      slope_axis_deg: '45',
      slope_deg_percent: '8.5',
    });

    expect(subdivision).toMatchObject({
      kind: 'toposolid_subdivision',
      hostToposolidId: 'topo-1',
      boundaryMm: [{ xMm: 1, yMm: 2 }],
      finishCategory: 'paving',
      materialKey: 'asphalt',
    });
    expect(graded).toMatchObject({
      kind: 'graded_region',
      hostToposolidId: 'topo-1',
      boundaryMm: [{ xMm: 3, yMm: 4 }],
      targetMode: 'slope',
      targetZMm: 120,
      slopeAxisDeg: 45,
      slopeDegPercent: 8.5,
    });
  });

  it('coerces excavation snake_case input with explicit numeric defaults', () => {
    const element = coerceElement('exc-1', {
      kind: 'toposolid_excavation',
      host_toposolid_id: 'topo-1',
      cutter_element_id: 'floor-1',
      cut_mode: 'custom_depth',
      offset_mm: 'bad',
      custom_depth_mm: '1800',
      estimated_volume_m3: 'bad',
      boundary_mm: [{ x_mm: '12', y_mm: 'bad' }],
      depth_mm: 'bad',
    });

    expect(element?.kind).toBe('toposolid_excavation');
    if (element?.kind !== 'toposolid_excavation') return;
    expect(element.hostToposolidId).toBe('topo-1');
    expect(element.cutterElementId).toBe('floor-1');
    expect(element.cutMode).toBe('custom_depth');
    expect(element.offsetMm).toBe(0);
    expect(element.customDepthMm).toBe(1800);
    expect(element.estimatedVolumeM3).toBe(0);
    expect(element.boundaryMm).toEqual([{ xMm: 12, yMm: 0 }]);
    expect(element.depthMm).toBe(0);
  });
});
