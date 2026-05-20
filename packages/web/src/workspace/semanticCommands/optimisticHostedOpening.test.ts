import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { materializeOptimisticHostedOpening } from './optimisticHostedOpening';

function wall(overrides: Partial<Extract<Element, { kind: 'wall' }>> = {}): Element {
  return {
    kind: 'wall',
    id: 'wall-1',
    name: 'Wall 1',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 5000, yMm: 0 },
    heightMm: 3000,
    thicknessMm: 200,
    ...overrides,
  } as Element;
}

describe('materializeOptimisticHostedOpening', () => {
  it('materializes a clamped door on a physical wall', () => {
    const result = materializeOptimisticHostedOpening(
      {
        type: 'insertDoorOnWall',
        id: 'door-1',
        wallId: 'wall-1',
        alongT: 2,
        widthMm: -10,
        familyTypeId: 'door-type',
      },
      { 'wall-1': wall() },
    );

    expect(result?.command.id).toBe('door-1');
    expect(result?.element).toMatchObject({
      kind: 'door',
      id: 'door-1',
      wallId: 'wall-1',
      alongT: 1,
      widthMm: 1,
      familyTypeId: 'door-type',
      discipline: 'arch',
    });
  });

  it('materializes a window with numeric fallbacks', () => {
    const result = materializeOptimisticHostedOpening(
      {
        type: 'insertWindowOnWall',
        id: 'window-1',
        wallId: 'wall-1',
        alongT: 'bad',
        sillHeightMm: -50,
        heightMm: 0,
      },
      { 'wall-1': wall() },
    );

    expect(result?.element).toMatchObject({
      kind: 'window',
      alongT: 0.5,
      widthMm: 1200,
      sillHeightMm: 0,
      heightMm: 1,
    });
  });

  it('rejects invalid or nonphysical wall openings', () => {
    expect(
      materializeOptimisticHostedOpening(
        {
          type: 'createWallOpening',
          id: 'opening-1',
          hostWallId: 'wall-1',
          alongTStart: 0.7,
          alongTEnd: 0.2,
        },
        { 'wall-1': wall() },
      ),
    ).toBeNull();

    expect(
      materializeOptimisticHostedOpening(
        {
          type: 'insertDoorOnWall',
          id: 'door-1',
          wallId: 'wall-1',
        },
        { 'wall-1': wall({ props: { nonPhysical: true } }) },
      ),
    ).toBeNull();
  });
});
