import { describe, it, expect } from 'vitest';
import type { Element } from '@bim-ai/core';

import { permanentDimGripProvider } from './permanentDimGripProvider';

const dim: Extract<Element, { kind: 'permanent_dimension' }> = {
  kind: 'permanent_dimension',
  id: 'pd-1',
  levelId: 'lvl-1',
  witnessPointsMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 1000, yMm: 0 },
    { xMm: 2000, yMm: 0 },
  ],
  offsetMm: { xMm: 0, yMm: 500 },
};

describe('permanentDimGripProvider — §4.2.5', () => {
  it('returns a text-offset grip at centroid + offsetMm', () => {
    const grips = permanentDimGripProvider.grips(dim, {});
    const offsetGrip = grips.find((g) => g.id === 'pd-1:dim-offset');
    expect(offsetGrip).toBeTruthy();
    // centroid of [0,1000,2000] = 1000, y = 0; + offsetMm = {0, 500}
    expect(offsetGrip!.positionMm).toEqual({ xMm: 1000, yMm: 500 });
  });

  it('returns one witness grip per witnessPoint', () => {
    const grips = permanentDimGripProvider.grips(dim, {});
    const witnessGrips = grips.filter((g) => g.id.includes('dim-witness'));
    expect(witnessGrips).toHaveLength(3);
    expect(witnessGrips[0]!.positionMm).toEqual({ xMm: 0, yMm: 0 });
    expect(witnessGrips[1]!.positionMm).toEqual({ xMm: 1000, yMm: 0 });
    expect(witnessGrips[2]!.positionMm).toEqual({ xMm: 2000, yMm: 0 });
  });

  it('dragging text-offset grip produces new offsetMm', () => {
    const grips = permanentDimGripProvider.grips(dim, {});
    const offsetGrip = grips.find((g) => g.id === 'pd-1:dim-offset')!;
    const cmd = offsetGrip.onCommit({ xMm: 100, yMm: 200 });
    expect(cmd.type).toBe('updateElementProperty');
    expect(cmd.key).toBe('offsetMm');
    const newOffset = JSON.parse(cmd.value as string);
    expect(newOffset).toEqual({ xMm: 100, yMm: 700 });
  });

  it('dragging witness grip at index 1 updates witnessPointsMm[1]', () => {
    const grips = permanentDimGripProvider.grips(dim, {});
    const witness1 = grips.find((g) => g.id === 'pd-1:dim-witness-1')!;
    const cmd = witness1.onCommit({ xMm: 50, yMm: 0 });
    expect(cmd.type).toBe('updateElementProperty');
    expect(cmd.key).toBe('witnessPointsMm');
    const newPts = JSON.parse(cmd.value as string);
    expect(newPts[1]).toEqual({ xMm: 1050, yMm: 0 });
    expect(newPts[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(newPts[2]).toEqual({ xMm: 2000, yMm: 0 });
  });
});
