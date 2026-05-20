import { describe, expect, it } from 'vitest';
import { resolveDimReferences } from './resolveDimReferences';
import type { DimWitnessPoint, Element } from '@bim-ai/core';

const wallElem = {
  id: 'w1',
  kind: 'wall',
  startMm: { xMm: 0, yMm: 0 },
  endMm: { xMm: 5000, yMm: 0 },
} as unknown as Element;
const colElem = {
  id: 'c1',
  kind: 'column',
  positionMm: { xMm: 2500, yMm: 1000 },
} as unknown as Element;

const elementsById: Record<string, Element> = { w1: wallElem, c1: colElem };

describe('resolveDimReferences — §4.1', () => {
  it('returns unmodified point when no referencedElementId', () => {
    const pts: DimWitnessPoint[] = [{ xMm: 100, yMm: 200 }];
    expect(resolveDimReferences(pts, elementsById)).toEqual(pts);
  });

  it('snaps to wall start when referenceEdge is start', () => {
    const pts: DimWitnessPoint[] = [
      {
        xMm: 100,
        yMm: 100,
        referencedElementId: 'w1',
        referenceEdge: 'start',
      },
    ];
    const result = resolveDimReferences(pts, elementsById);
    expect(result[0].xMm).toBe(0);
    expect(result[0].yMm).toBe(0);
  });

  it('snaps to wall end when referenceEdge is end', () => {
    const pts: DimWitnessPoint[] = [
      {
        xMm: 100,
        yMm: 100,
        referencedElementId: 'w1',
        referenceEdge: 'end',
      },
    ];
    const result = resolveDimReferences(pts, elementsById);
    expect(result[0].xMm).toBe(5000);
  });

  it('snaps to column position', () => {
    const pts: DimWitnessPoint[] = [
      {
        xMm: 0,
        yMm: 0,
        referencedElementId: 'c1',
      },
    ];
    const result = resolveDimReferences(pts, elementsById);
    expect(result[0].xMm).toBe(2500);
    expect(result[0].yMm).toBe(1000);
  });

  it('returns original coords when referenced element not found', () => {
    const pts: DimWitnessPoint[] = [
      {
        xMm: 999,
        yMm: 888,
        referencedElementId: 'nonexistent',
      },
    ];
    const result = resolveDimReferences(pts, elementsById);
    expect(result[0].xMm).toBe(999);
    expect(result[0].yMm).toBe(888);
  });
});
