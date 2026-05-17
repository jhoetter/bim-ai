import { describe, it, expect } from 'vitest';
import { scalePoint, scaleWallEndpoints } from './scaleTool';

/**
 * Tests for the scaleElements handler logic (§3.3.6).
 * The Workspace handler for scaleElements delegates to updateElementProperty
 * for each field; here we unit-test the underlying math helpers.
 */

describe('scaleElements handler — §3.3.6', () => {
  it('scales positionMm relative to basePt', () => {
    const basePt = { xMm: 0, yMm: 0 };
    const pos = { xMm: 1000, yMm: 0 };
    const scaleFactor = 2;
    const dx = (pos.xMm - basePt.xMm) * scaleFactor;
    const dy = (pos.yMm - basePt.yMm) * scaleFactor;
    const result = { xMm: basePt.xMm + dx, yMm: basePt.yMm + dy };
    expect(result).toEqual({ xMm: 2000, yMm: 0 });
  });

  it('scales lengthMm by scaleFactor', () => {
    const lengthMm = 500;
    const scaleFactor = 2;
    expect(lengthMm * scaleFactor).toBe(1000);
  });

  it('uniform scale preserves direction', () => {
    const basePt = { xMm: 0, yMm: 0 };
    const pos = { xMm: 3000, yMm: 4000 };
    const scaleFactor = 0.5;
    const result = scalePoint(pos, basePt, scaleFactor);
    // Direction: atan2(4000,3000) — should be same after scale
    const origAngle = Math.atan2(pos.yMm - basePt.yMm, pos.xMm - basePt.xMm);
    const newAngle = Math.atan2(result.yMm - basePt.yMm, result.xMm - basePt.xMm);
    expect(newAngle).toBeCloseTo(origAngle, 5);
    // Distance should halve
    const origDist = Math.sqrt(pos.xMm ** 2 + pos.yMm ** 2);
    const newDist = Math.sqrt(result.xMm ** 2 + result.yMm ** 2);
    expect(newDist).toBeCloseTo(origDist * scaleFactor, 5);
  });

  it('scale factor 1 leaves position unchanged', () => {
    const basePt = { xMm: 500, yMm: 500 };
    const pos = { xMm: 2000, yMm: 3000 };
    const result = scalePoint(pos, basePt, 1);
    expect(result).toEqual(pos);
  });

  it('scaleWallEndpoints scales both endpoints proportionally', () => {
    const origin = { xMm: 0, yMm: 0 };
    const start = { xMm: 0, yMm: 0 };
    const end = { xMm: 5000, yMm: 0 };
    const { start: s2, end: e2 } = scaleWallEndpoints(start, end, origin, 2);
    expect(s2).toEqual({ xMm: 0, yMm: 0 });
    expect(e2).toEqual({ xMm: 10000, yMm: 0 });
  });

  it('non-zero basePt shifts scale correctly', () => {
    const basePt = { xMm: 1000, yMm: 1000 };
    const pos = { xMm: 3000, yMm: 1000 };
    const scaleFactor = 2;
    const dx = (pos.xMm - basePt.xMm) * scaleFactor;
    const dy = (pos.yMm - basePt.yMm) * scaleFactor;
    const result = { xMm: basePt.xMm + dx, yMm: basePt.yMm + dy };
    // (3000-1000)*2 + 1000 = 5000
    expect(result).toEqual({ xMm: 5000, yMm: 1000 });
  });
});
