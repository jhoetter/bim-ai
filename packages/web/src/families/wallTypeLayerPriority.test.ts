import { describe, expect, it } from 'vitest';
import type { WallTypeLayer } from '@bim-ai/core';

import { mergeLayersByPriority } from '../viewport/effectiveHostMaterials';

function makeLayer(overrides: Partial<WallTypeLayer> = {}): WallTypeLayer {
  return { thicknessMm: 100, function: 'structure', ...overrides };
}

describe('WallTypeLayer priority — §2.4.4', () => {
  it('priority defaults to 3 when null or undefined', () => {
    const layerNull = makeLayer({ priority: null });
    const layerUndefined = makeLayer({ priority: undefined });
    const result = mergeLayersByPriority([layerNull], [layerUndefined]);
    expect(result).toHaveLength(2);
    // Both treated as priority 3, order preserved
    expect(result[0]).toBe(layerNull);
    expect(result[1]).toBe(layerUndefined);
  });

  it('layer with priority 1 dominates layer with priority 5 at join', () => {
    const highPriority = makeLayer({ priority: 1, materialKey: 'concrete' });
    const lowPriority = makeLayer({ priority: 5, materialKey: 'plaster' });
    const result = mergeLayersByPriority([lowPriority], [highPriority]);
    expect(result[0]).toBe(highPriority);
    expect(result[1]).toBe(lowPriority);
  });

  it('equal priorities preserve existing order', () => {
    const a = makeLayer({ priority: 2, materialKey: 'a' });
    const b = makeLayer({ priority: 2, materialKey: 'b' });
    const result = mergeLayersByPriority([a], [b]);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it('effectiveHostMaterials sorts layers by priority ascending', () => {
    const layers: WallTypeLayer[] = [
      makeLayer({ priority: 4, materialKey: 'finish' }),
      makeLayer({ priority: 1, materialKey: 'structure' }),
      makeLayer({ priority: 3, materialKey: 'insulation' }),
    ];
    const result = mergeLayersByPriority(layers, []);
    expect(result[0].materialKey).toBe('structure');
    expect(result[1].materialKey).toBe('insulation');
    expect(result[2].materialKey).toBe('finish');
  });
});
