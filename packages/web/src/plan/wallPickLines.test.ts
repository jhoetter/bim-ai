import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  createWallFromPickedLineCommand,
  hasOverlappingWallLine,
  pickDxfLineForWall,
  pickFloorBoundaryEdgeForWall,
} from './wallPickLines';

const floor: Extract<Element, { kind: 'floor' }> = {
  kind: 'floor',
  id: 'floor-a',
  name: 'Floor A',
  levelId: 'lvl-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 4000, yMm: 0 },
    { xMm: 4000, yMm: 3000 },
    { xMm: 0, yMm: 3000 },
  ],
  thicknessMm: 250,
};

describe('WP-NEXT-44 wall pick lines', () => {
  it('picks the nearest floor boundary edge for wall creation', () => {
    const picked = pickFloorBoundaryEdgeForWall(
      { [floor.id]: floor },
      'lvl-1',
      { xMm: 2100, yMm: 80 },
      150,
    );

    expect(picked).toMatchObject({
      source: 'floor-edge',
      sourceId: 'floor-a',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
    });
  });

  it('converts picked DXF linework into a transformed wall line', () => {
    const link: Extract<Element, { kind: 'link_dxf' }> = {
      kind: 'link_dxf',
      id: 'dxf-1',
      name: 'Survey underlay',
      levelId: 'lvl-1',
      originMm: { xMm: 1000, yMm: 2000 },
      linework: [
        {
          kind: 'line',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 5000, yMm: 0 },
          layerName: 'A-WALL',
        },
      ],
    };

    const picked = pickDxfLineForWall(
      {
        link,
        primitive: link.linework![0]!,
        primitiveIndex: 0,
        layerName: 'A-WALL',
        color: '#777',
        distanceMm: 10,
      },
      { xMm: 3200, yMm: 2020 },
      { [link.id]: link },
    );

    expect(picked).toMatchObject({
      source: 'dxf-line',
      sourceId: 'dxf-1',
      start: { xMm: 1000, yMm: 2000 },
      end: { xMm: 6000, yMm: 2000 },
    });
  });

  it('guards picked lines against duplicate overlapping wall creation', () => {
    const existing: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w-existing',
      name: 'Existing wall',
      levelId: 'lvl-1',
      start: { xMm: -100, yMm: 10 },
      end: { xMm: 4100, yMm: 10 },
      thicknessMm: 200,
      heightMm: 3000,
    };
    const picked = pickFloorBoundaryEdgeForWall(
      { [floor.id]: floor },
      'lvl-1',
      { xMm: 2000, yMm: 20 },
      150,
    );

    expect(picked).toBeTruthy();
    expect(hasOverlappingWallLine({ [existing.id]: existing }, 'lvl-1', picked!, 150)).toBe(true);
  });

  it('emits the same createWall payload used by normal wall placement', () => {
    const picked = pickFloorBoundaryEdgeForWall(
      { [floor.id]: floor },
      'lvl-1',
      { xMm: 2000, yMm: 20 },
      150,
    );

    expect(
      createWallFromPickedLineCommand(picked!, {
        id: 'w-picked',
        levelId: 'lvl-1',
        wallTypeId: 'wt-ext',
        locationLine: 'finish-face-exterior',
        heightMm: 3250,
      }),
    ).toEqual({
      type: 'createWall',
      id: 'w-picked',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      locationLine: 'finish-face-exterior',
      wallTypeId: 'wt-ext',
      heightMm: 3250,
    });
  });
});
