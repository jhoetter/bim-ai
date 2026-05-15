import { describe, expect, it } from 'vitest';
import {
  linearArrayOffsets,
  parseArrayCount,
  radialArrayAngles,
  radialOffsetForElement,
} from './arrayTool';

describe('linearArrayOffsets', () => {
  it('moveToLast=true, count=3: offsets at 0%, 50%, 100% of vector', () => {
    const offsets = linearArrayOffsets({
      mode: 'linear',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 100, yMm: 200 },
      count: 3,
      moveToLast: true,
    });

    expect(offsets).toHaveLength(3);
    expect(offsets[0]).toEqual({ dxMm: 0, dyMm: 0 });
    expect(offsets[1]).toEqual({ dxMm: 50, dyMm: 100 });
    expect(offsets[2]).toEqual({ dxMm: 100, dyMm: 200 });
  });

  it('moveToLast=false (2nd copy), count=3: each offset is a repeated step', () => {
    const offsets = linearArrayOffsets({
      mode: 'linear',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 50, yMm: 75 },
      count: 3,
      moveToLast: false,
    });

    expect(offsets).toHaveLength(3);
    expect(offsets[0]).toEqual({ dxMm: 0, dyMm: 0 });
    expect(offsets[1]).toEqual({ dxMm: 50, dyMm: 75 });
    expect(offsets[2]).toEqual({ dxMm: 100, dyMm: 150 });
  });
});

describe('radialArrayAngles', () => {
  it('count=4, angleDeg=270 → [0, 90, 180, 270]', () => {
    const angles = radialArrayAngles({
      mode: 'radial',
      centerMm: { xMm: 0, yMm: 0 },
      angleDeg: 270,
      count: 4,
    });

    expect(angles).toHaveLength(4);
    expect(angles[0]).toBeCloseTo(0);
    expect(angles[1]).toBeCloseTo(90);
    expect(angles[2]).toBeCloseTo(180);
    expect(angles[3]).toBeCloseTo(270);
  });

  it('count=2 returns [0, angleDeg]', () => {
    const angles = radialArrayAngles({
      mode: 'radial',
      centerMm: { xMm: 0, yMm: 0 },
      angleDeg: 180,
      count: 2,
    });

    expect(angles).toHaveLength(2);
    expect(angles[0]).toBeCloseTo(0);
    expect(angles[1]).toBeCloseTo(180);
  });
});

describe('radialOffsetForElement', () => {
  it('center {0,0}, element at {100,0}, rotate 90° → offset approx {0,100}', () => {
    const offset = radialOffsetForElement({ xMm: 0, yMm: 0 }, { xMm: 100, yMm: 0 }, 90);

    expect(offset.dxMm).toBeCloseTo(-100, 5);
    expect(offset.dyMm).toBeCloseTo(100, 5);
  });

  it('center {0,0}, element at {0,100}, rotate 90° → offset approx {-100,-100}', () => {
    // rotated position: {-100, 0}; offset = rotated - original = {-100-0, 0-100} = {-100,-100}
    const offset = radialOffsetForElement({ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 100 }, 90);

    expect(offset.dxMm).toBeCloseTo(-100, 5);
    expect(offset.dyMm).toBeCloseTo(-100, 5);
  });

  it('0° rotation returns zero offset', () => {
    const offset = radialOffsetForElement({ xMm: 50, yMm: 50 }, { xMm: 150, yMm: 50 }, 0);

    expect(offset.dxMm).toBeCloseTo(0);
    expect(offset.dyMm).toBeCloseTo(0);
  });
});

describe('parseArrayCount', () => {
  it('"3" → 3', () => {
    expect(parseArrayCount('3')).toBe(3);
  });

  it('"2" → 2 (minimum valid)', () => {
    expect(parseArrayCount('2')).toBe(2);
  });

  it('"1" → null (below minimum)', () => {
    expect(parseArrayCount('1')).toBeNull();
  });

  it('"0" → null', () => {
    expect(parseArrayCount('0')).toBeNull();
  });

  it('"abc" → null', () => {
    expect(parseArrayCount('abc')).toBeNull();
  });

  it('"2.5" → null (non-integer)', () => {
    expect(parseArrayCount('2.5')).toBeNull();
  });

  it('empty string → null', () => {
    expect(parseArrayCount('')).toBeNull();
  });

  it('whitespace-padded integer is accepted', () => {
    expect(parseArrayCount('  5  ')).toBe(5);
  });
});
