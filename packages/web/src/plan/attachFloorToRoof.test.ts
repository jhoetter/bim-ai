import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { applyAttachFloorToRoof } from './attachFloorToRoof';

const level: Extract<Element, { kind: 'level' }> = {
  kind: 'level',
  id: 'lvl-1',
  name: 'Ground Floor',
  elevationMm: 0,
};

const roof: Extract<Element, { kind: 'roof' }> = {
  kind: 'roof',
  id: 'roof-1',
  name: 'Main Roof',
  referenceLevelId: 'lvl-1',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 10000 },
    { xMm: 0, yMm: 10000 },
  ],
  baseElevationMm: 3000,
};

const floor: Extract<Element, { kind: 'floor' }> = {
  kind: 'floor',
  id: 'floor-1',
  name: 'Ground Slab',
  levelId: 'lvl-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 10000, yMm: 0 },
    { xMm: 10000, yMm: 10000 },
    { xMm: 0, yMm: 10000 },
  ],
  thicknessMm: 200,
};

const elementsById: Record<string, Element> = {
  [level.id]: level,
  [roof.id]: roof,
  [floor.id]: floor,
};

describe('attachFloorToRoof command handler — §3.4.1', () => {
  it('sets attachedToRoofId on floor element', () => {
    const next = applyAttachFloorToRoof(elementsById, 'floor-1', 'roof-1');
    const updatedFloor = next['floor-1'] as Extract<Element, { kind: 'floor' }>;
    expect(updatedFloor.attachedToRoofId).toBe('roof-1');
  });

  it('sets topFaceElevationMm from roof baseElevationMm', () => {
    const next = applyAttachFloorToRoof(elementsById, 'floor-1', 'roof-1');
    const updatedFloor = next['floor-1'] as Extract<Element, { kind: 'floor' }>;
    expect(updatedFloor.topFaceElevationMm).toBe(3000);
  });

  it('detach clears attachedToRoofId and topFaceElevationMm', () => {
    const attached = applyAttachFloorToRoof(elementsById, 'floor-1', 'roof-1');
    const detached = applyAttachFloorToRoof(attached, 'floor-1', '');
    const updatedFloor = detached['floor-1'] as Extract<Element, { kind: 'floor' }>;
    expect(updatedFloor.attachedToRoofId).toBeNull();
    expect(updatedFloor.topFaceElevationMm).toBeNull();
  });
});
