import { describe, it, expect } from 'vitest';
import {
  parseScaleFactor,
  scaleFactorFromDistances,
  scalePoint,
  scaleWallEndpoints,
  scaleFamilyInstance,
  buildScaleCommand,
  distanceMm,
} from './scaleTool';

describe('parseScaleFactor', () => {
  it('parses a valid positive number', () => {
    expect(parseScaleFactor('2')).toBe(2);
    expect(parseScaleFactor('0.5')).toBe(0.5);
    expect(parseScaleFactor('1.25')).toBe(1.25);
  });

  it('returns null for empty string', () => {
    expect(parseScaleFactor('')).toBeNull();
    expect(parseScaleFactor('   ')).toBeNull();
  });

  it('returns null for zero or negative', () => {
    expect(parseScaleFactor('0')).toBeNull();
    expect(parseScaleFactor('-1')).toBeNull();
    expect(parseScaleFactor('-0.5')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(parseScaleFactor('abc')).toBeNull();
    expect(parseScaleFactor('1x')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(parseScaleFactor('  2.0  ')).toBe(2);
  });
});

describe('scaleFactorFromDistances', () => {
  it('returns ratio of new to reference distance', () => {
    expect(scaleFactorFromDistances(1000, 2000)).toBe(2);
    expect(scaleFactorFromDistances(2000, 1000)).toBe(0.5);
    expect(scaleFactorFromDistances(500, 500)).toBe(1);
  });

  it('returns null when either distance is zero or negative', () => {
    expect(scaleFactorFromDistances(0, 2000)).toBeNull();
    expect(scaleFactorFromDistances(1000, 0)).toBeNull();
    expect(scaleFactorFromDistances(-100, 200)).toBeNull();
  });
});

describe('scalePoint', () => {
  it('scales a point relative to origin', () => {
    const origin = { xMm: 0, yMm: 0 };
    const point = { xMm: 1000, yMm: 2000 };
    const result = scalePoint(point, origin, 2);
    expect(result).toEqual({ xMm: 2000, yMm: 4000 });
  });

  it('scales relative to a non-zero origin', () => {
    const origin = { xMm: 1000, yMm: 1000 };
    const point = { xMm: 2000, yMm: 3000 };
    const result = scalePoint(point, origin, 2);
    expect(result).toEqual({ xMm: 3000, yMm: 5000 });
  });

  it('factor 1 leaves point unchanged', () => {
    const origin = { xMm: 0, yMm: 0 };
    const point = { xMm: 500, yMm: 300 };
    const result = scalePoint(point, origin, 1);
    expect(result).toEqual(point);
  });
});

describe('scaleWallEndpoints', () => {
  it('scales both endpoints from origin', () => {
    const start = { xMm: 0, yMm: 0 };
    const end = { xMm: 5000, yMm: 0 };
    const origin = { xMm: 0, yMm: 0 };
    const result = scaleWallEndpoints(start, end, origin, 2);
    expect(result.start).toEqual({ xMm: 0, yMm: 0 });
    expect(result.end).toEqual({ xMm: 10000, yMm: 0 });
  });

  it('scales a diagonal wall from a non-zero origin', () => {
    const start = { xMm: 1000, yMm: 0 };
    const end = { xMm: 1000, yMm: 3000 };
    const origin = { xMm: 1000, yMm: 0 };
    const result = scaleWallEndpoints(start, end, origin, 0.5);
    expect(result.start).toEqual({ xMm: 1000, yMm: 0 });
    expect(result.end).toEqual({ xMm: 1000, yMm: 1500 });
  });
});

describe('scaleFamilyInstance', () => {
  it('scales insertion point and sizes from origin', () => {
    const insertion = { xMm: 2000, yMm: 0 };
    const origin = { xMm: 0, yMm: 0 };
    const result = scaleFamilyInstance(insertion, 900, 2100, origin, 2);
    expect(result.insertionPoint).toEqual({ xMm: 4000, yMm: 0 });
    expect(result.widthMm).toBe(1800);
    expect(result.heightMm).toBe(4200);
  });
});

describe('buildScaleCommand', () => {
  it('builds a ScaleElementCommand with the correct shape', () => {
    const origin = { xMm: 500, yMm: 1000 };
    const cmd = buildScaleCommand('wall-01', origin, 1.5);
    expect(cmd).toEqual({
      type: 'scaleElement',
      elementId: 'wall-01',
      originXMm: 500,
      originYMm: 1000,
      factor: 1.5,
    });
  });
});

describe('distanceMm', () => {
  it('returns correct Euclidean distance', () => {
    expect(distanceMm({ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 4000 })).toBe(5000);
    expect(distanceMm({ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 0 })).toBe(0);
  });
});
