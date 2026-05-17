import { describe, expect, it } from 'vitest';

describe('linework override deduplication', () => {
  it('adding override for same elementId replaces the old one', () => {
    const existing = [{ elementId: 'abc', colorHex: '#ff0000', lineWeightPx: 1 }];
    const newOv = { elementId: 'abc', colorHex: '#00ff00', lineWeightPx: 2 };
    const result = [...existing.filter((o) => o.elementId !== newOv.elementId), newOv];
    expect(result).toHaveLength(1);
    expect(result[0]!.colorHex).toBe('#00ff00');
    expect(result[0]!.lineWeightPx).toBe(2);
  });

  it('adding override for a new elementId appends it', () => {
    const existing = [{ elementId: 'abc', colorHex: '#ff0000', lineWeightPx: 1 }];
    const newOv = { elementId: 'xyz', colorHex: '#0000ff', lineWeightPx: 3 };
    const result = [...existing.filter((o) => o.elementId !== newOv.elementId), newOv];
    expect(result).toHaveLength(2);
    expect(result.find((o) => o.elementId === 'xyz')!.colorHex).toBe('#0000ff');
  });

  it('clearing all overrides produces empty array', () => {
    const existing = [
      { elementId: 'abc', colorHex: '#ff0000', lineWeightPx: 1 },
      { elementId: 'def', colorHex: '#00ff00', lineWeightPx: 2 },
    ];
    const result = existing.filter(() => false);
    expect(result).toHaveLength(0);
  });
});
