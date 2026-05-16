import { describe, expect, it } from 'vitest';
import { buildExcavationMesh } from './meshBuilders';
import type { ToposolidExcavationElem } from '@bim-ai/core';

const makeExcav = (
  boundaryMm: { xMm: number; yMm: number }[],
  depthMm = 2000,
): ToposolidExcavationElem => ({
  kind: 'toposolid_excavation',
  id: 'test-excav',
  hostToposolidId: '',
  cutterElementId: '',
  cutMode: 'by_face',
  offsetMm: 0,
  boundaryMm,
  depthMm,
});

const SQUARE = [
  { xMm: 0, yMm: 0 },
  { xMm: 6000, yMm: 0 },
  { xMm: 6000, yMm: 4000 },
  { xMm: 0, yMm: 4000 },
];

describe('buildExcavationMesh', () => {
  it('returns a Group with 2 children (walls + floor) for a valid boundary', () => {
    const grp = buildExcavationMesh(makeExcav(SQUARE, 2000));
    expect(grp.children).toHaveLength(2);
  });

  it('floor mesh is positioned at -depthMm/1000 on world Y', () => {
    const depthMm = 3000;
    const grp = buildExcavationMesh(makeExcav(SQUARE, depthMm));
    const floor = grp.children[1];
    expect(floor).toBeDefined();
    expect(floor!.position.y).toBeCloseTo(-depthMm / 1000, 5);
  });

  it('returns an empty Group for a boundary with fewer than 3 points', () => {
    const grp = buildExcavationMesh(
      makeExcav([
        { xMm: 0, yMm: 0 },
        { xMm: 1000, yMm: 0 },
      ]),
    );
    expect(grp.children).toHaveLength(0);
  });
});
