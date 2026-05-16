import { describe, expect, it } from 'vitest';

/** Build equal-length parts for a wall split into `count` segments. */
function buildEqualParts(count: number): Array<{ id: string; startT: number; endT: number }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `part-${i}`,
    startT: parseFloat((i / count).toFixed(10)),
    endT: parseFloat(((i + 1) / count).toFixed(10)),
  }));
}

describe('G3 — wall parts', () => {
  it('createWallParts with count=3 produces 3 equal parts with correct startT/endT', () => {
    const parts = buildEqualParts(3);
    expect(parts).toHaveLength(3);

    expect(parts[0]!.startT).toBeCloseTo(0, 9);
    expect(parts[0]!.endT).toBeCloseTo(1 / 3, 9);

    expect(parts[1]!.startT).toBeCloseTo(1 / 3, 9);
    expect(parts[1]!.endT).toBeCloseTo(2 / 3, 9);

    expect(parts[2]!.startT).toBeCloseTo(2 / 3, 9);
    expect(parts[2]!.endT).toBeCloseTo(1, 9);
  });

  it('parts are contiguous — each endT equals the next startT', () => {
    const parts = buildEqualParts(3);
    for (let i = 0; i < parts.length - 1; i++) {
      expect(parts[i]!.endT).toBeCloseTo(parts[i + 1]!.startT, 9);
    }
  });

  it('first part starts at 0, last ends at 1', () => {
    const parts = buildEqualParts(3);
    expect(parts[0]!.startT).toBe(0);
    expect(parts[2]!.endT).toBeCloseTo(1, 9);
  });

  it('wall parts type allows optional materialId', () => {
    const parts: Array<{ id: string; startT: number; endT: number; materialId?: string }> =
      buildEqualParts(3);
    parts[0]!.materialId = 'mat-brick';
    expect(parts[0]!.materialId).toBe('mat-brick');
    expect(parts[1]!.materialId).toBeUndefined();
  });
});
