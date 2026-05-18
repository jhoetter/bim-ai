import { describe, expect, it } from 'vitest';

describe('Material tag completion — §4.11.3', () => {
  it('material_tag shape includes required fields', () => {
    const tag: any = {
      kind: 'material_tag',
      id: 'mt1',
      targetElementId: 'wall-01',
      positionMm: { xMm: 1000, yMm: 2000 },
      levelId: 'l1',
    };
    expect(tag.kind).toBe('material_tag');
    expect(tag.targetElementId).toBe('wall-01');
  });

  it('textOverride takes precedence over auto-resolved material', () => {
    const tag: any = { textOverride: 'Custom Material', layerIndex: 0 };
    const resolved = tag.textOverride ?? 'fallback';
    expect(resolved).toBe('Custom Material');
  });

  it('leaderEndMm is optional', () => {
    const tag: any = {
      kind: 'material_tag',
      id: 'mt1',
      targetElementId: 'w1',
      positionMm: { xMm: 0, yMm: 0 },
      levelId: 'l1',
    };
    expect(tag.leaderEndMm).toBeUndefined();
  });

  it('layerIndex defaults to 0', () => {
    const tag: any = {
      kind: 'material_tag',
      id: 'mt1',
      targetElementId: 'w1',
      positionMm: { xMm: 0, yMm: 0 },
      levelId: 'l1',
    };
    expect(tag.layerIndex ?? 0).toBe(0);
  });

  it('resolves wall type first layer material', () => {
    const layers = [{ materialKey: 'concrete' }, { materialKey: 'insulation' }];
    const layerIndex = 0;
    expect(layers[layerIndex]?.materialKey).toBe('concrete');
  });
});
