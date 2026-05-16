import { describe, expect, it } from 'vitest';
import type { WallTypeLayer } from '@bim-ai/core';

import { mergeLayersByPriority } from '../viewport/effectiveHostMaterials';

describe('material layer join priority — §2.4.4', () => {
  it('priority 1 layer dominates priority 5 layer at junction', () => {
    const structure: WallTypeLayer = {
      thicknessMm: 200,
      function: 'structure',
      materialKey: 'concrete',
      priority: 1,
    };
    const finish: WallTypeLayer = {
      thicknessMm: 13,
      function: 'finish',
      materialKey: 'plaster',
      priority: 5,
    };
    const merged = mergeLayersByPriority([finish], [structure]);
    expect(merged[0].priority).toBe(1);
    expect(merged[0].materialKey).toBe('concrete');
  });

  it('equal priority layers default to first layer', () => {
    const layerA: WallTypeLayer = {
      thicknessMm: 100,
      function: 'finish',
      materialKey: 'brick',
      priority: 3,
    };
    const layerB: WallTypeLayer = {
      thicknessMm: 100,
      function: 'finish',
      materialKey: 'plaster',
      priority: 3,
    };
    const merged = mergeLayersByPriority([layerA], [layerB]);
    expect(merged[0].materialKey).toBe('brick');
  });

  it('null priority treated as 5 (lowest)', () => {
    const nullPriority: WallTypeLayer = {
      thicknessMm: 50,
      function: 'finish',
      materialKey: 'render',
      priority: null,
    };
    const highPriority: WallTypeLayer = {
      thicknessMm: 200,
      function: 'structure',
      materialKey: 'concrete',
      priority: 1,
    };
    const merged = mergeLayersByPriority([nullPriority], [highPriority]);
    expect(merged[0].priority).toBe(1);
    expect(merged[0].materialKey).toBe('concrete');
  });
});
