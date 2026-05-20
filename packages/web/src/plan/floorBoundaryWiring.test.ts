import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { detectFloorBoundaryFromWalls } from './detectFloorBoundaryFromWalls';

describe('detectFloorBoundaryFromWalls wiring — §2.4.2', () => {
  it('returns null for empty elements', () => {
    const result = detectFloorBoundaryFromWalls({ xMm: 0, yMm: 0 }, {}, null);
    expect(result).toBeNull();
  });

  it('returns polygon from four wall endpoints', () => {
    const elements = {
      w1: {
        kind: 'wall',
        levelId: 'L1',
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 5000, yMm: 0 },
      },
      w2: {
        kind: 'wall',
        levelId: 'L1',
        startMm: { xMm: 5000, yMm: 0 },
        endMm: { xMm: 5000, yMm: 4000 },
      },
      w3: {
        kind: 'wall',
        levelId: 'L1',
        startMm: { xMm: 5000, yMm: 4000 },
        endMm: { xMm: 0, yMm: 4000 },
      },
      w4: {
        kind: 'wall',
        levelId: 'L1',
        startMm: { xMm: 0, yMm: 4000 },
        endMm: { xMm: 0, yMm: 0 },
      },
    } as unknown as Record<string, Element>;
    const result = detectFloorBoundaryFromWalls({ xMm: 2500, yMm: 2000 }, elements, 'L1');
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(3);
  });

  it('filters walls by levelId', () => {
    const elements = {
      w1: {
        kind: 'wall',
        levelId: 'L2',
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 5000, yMm: 0 },
      },
    } as unknown as Record<string, Element>;
    const result = detectFloorBoundaryFromWalls({ xMm: 0, yMm: 0 }, elements, 'L1');
    expect(result).toBeNull();
  });
});
