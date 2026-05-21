import { describe, expect, it } from 'vitest';
import { buildExcavationMesh } from './meshBuilders';
import type { Element, ToposolidExcavationElem } from '@bim-ai/core';

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

  it('derives its boundary from the cutter floor when boundaryMm is not explicit', () => {
    const elementsById: Record<string, Element> = {
      'floor-1': {
        kind: 'floor',
        id: 'floor-1',
        levelId: 'lvl-1',
        boundaryMm: SQUARE,
        thicknessMm: 200,
      } as Extract<Element, { kind: 'floor' }>,
    };
    const grp = buildExcavationMesh(
      {
        kind: 'toposolid_excavation',
        id: 'test-excav-cutter',
        hostToposolidId: '',
        cutterElementId: 'floor-1',
        cutMode: 'to_bottom_of_cutter',
        offsetMm: 0,
        customDepthMm: 2500,
      },
      elementsById,
    );

    expect(grp.children).toHaveLength(2);
  });
});
