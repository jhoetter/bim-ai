import { describe, expect, it } from 'vitest';
import type { DimWitnessPoint } from '@bim-ai/core';

describe('DimWitnessPoint type — §4.1', () => {
  it('accepts point without referencedElementId', () => {
    const pt: DimWitnessPoint = { xMm: 0, yMm: 0 };
    expect(pt.xMm).toBe(0);
  });

  it('accepts point with referencedElementId', () => {
    const pt: DimWitnessPoint = {
      xMm: 100,
      yMm: 200,
      referencedElementId: 'w1',
      referenceEdge: 'start',
    };
    expect(pt.referencedElementId).toBe('w1');
    expect(pt.referenceEdge).toBe('start');
  });
});
