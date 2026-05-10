import { describe, expect, it } from 'vitest';

import {
  parseTypedRotateAngle,
  rotateAngleFromPoints,
  rotateDeltaAngleFromReference,
  snapRotateAngleDeg,
} from './rotateTool';

describe('rotateTool angular snap', () => {
  it('snaps raw rotate bearings to 45 degree increments', () => {
    expect(snapRotateAngleDeg(2)).toBe(0);
    expect(snapRotateAngleDeg(23)).toBe(45);
    expect(snapRotateAngleDeg(67)).toBe(45);
    expect(snapRotateAngleDeg(68)).toBe(90);
  });

  it('keeps snapped angles in the signed rotate range', () => {
    expect(snapRotateAngleDeg(181)).toBe(180);
    expect(snapRotateAngleDeg(224)).toBe(-135);
    expect(snapRotateAngleDeg(-181)).toBe(180);
    expect(snapRotateAngleDeg(-46)).toBe(-45);
  });

  it('computes snapped angle from center and picked end point', () => {
    expect(rotateAngleFromPoints({ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 2 })).toBe(0);
    expect(rotateAngleFromPoints({ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 11 })).toBe(45);
    expect(rotateAngleFromPoints({ xMm: 0, yMm: 0 }, { xMm: 0, yMm: -10 })).toBe(-90);
  });

  it('computes a snapped delta from an explicit reference ray', () => {
    expect(
      rotateDeltaAngleFromReference({ xMm: 0, yMm: 0 }, { xMm: 10, yMm: 0 }, { xMm: 0, yMm: 10 }),
    ).toBe(90);
    expect(
      rotateDeltaAngleFromReference({ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 10 }, { xMm: 10, yMm: 10 }),
    ).toBe(-45);
  });

  it('normalizes typed rotation angles', () => {
    expect(parseTypedRotateAngle('90')).toBe(90);
    expect(parseTypedRotateAngle('-270deg')).toBe(90);
    expect(parseTypedRotateAngle('181°')).toBe(-179);
    expect(parseTypedRotateAngle('')).toBeNull();
    expect(parseTypedRotateAngle('abc')).toBeNull();
  });
});
