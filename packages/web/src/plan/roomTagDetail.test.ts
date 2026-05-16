import { describe, it, expect } from 'vitest';
import type { Element } from '@bim-ai/core';

import { roomMesh } from './planElementMeshBuilders';
import { polygonAreaMm2 } from './symbology';

type RoomEl = Extract<Element, { kind: 'room' }>;

const SQUARE_OUTLINE = [
  { xMm: 0, yMm: 0 },
  { xMm: 5000, yMm: 0 },
  { xMm: 5000, yMm: 4000 },
  { xMm: 0, yMm: 4000 },
];

function makeRoom(overrides: Partial<RoomEl> = {}): RoomEl {
  return {
    kind: 'room',
    id: 'r1',
    name: 'Living Room',
    levelId: 'lv1',
    outlineMm: SQUARE_OUTLINE,
    ...overrides,
  } as RoomEl;
}

describe('room tag detail — §13.1.2 + §13.1.4', () => {
  it('roomMesh sets userData.roomLabel.areaMm2', () => {
    const mesh = roomMesh(makeRoom());
    const rl = mesh.userData.roomLabel as { areaMm2: number };
    expect(typeof rl.areaMm2).toBe('number');
    expect(rl.areaMm2).toBeGreaterThan(0);
  });

  it('roomMesh sets userData.roomLabel.numberLabel from room.numberLabel', () => {
    const mesh = roomMesh(makeRoom({ numberLabel: '101' }));
    const rl = mesh.userData.roomLabel as { numberLabel: string | null };
    expect(rl.numberLabel).toBe('101');
  });

  it('roomMesh sets numberLabel=null when room.numberLabel is absent', () => {
    const mesh = roomMesh(makeRoom());
    const rl = mesh.userData.roomLabel as { numberLabel: string | null };
    expect(rl.numberLabel).toBeNull();
  });

  it('area in m² = areaMm2 / 1e6', () => {
    const areaMm2 = polygonAreaMm2(SQUARE_OUTLINE);
    const areaM2 = areaMm2 / 1e6;
    // 5000mm × 4000mm = 20m²
    expect(areaM2).toBeCloseTo(20, 5);
  });
});
