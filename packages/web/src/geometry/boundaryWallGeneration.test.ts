import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { buildBoundaryWallPlan } from './boundaryWallGeneration';

const floor: Extract<Element, { kind: 'floor' }> = {
  kind: 'floor',
  id: 'floor-a',
  name: 'Proof floor',
  levelId: 'lvl-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 4000, yMm: 0 },
    { xMm: 4000, yMm: 3000 },
    { xMm: 0, yMm: 3000 },
  ],
  thicknessMm: 250,
};

const wallType: Extract<Element, { kind: 'wall_type' }> = {
  kind: 'wall_type',
  id: 'wt-350',
  name: '350 wall',
  layers: [
    { thicknessMm: 200, function: 'structure' },
    { thicknessMm: 150, function: 'finish' },
  ],
};

describe('WP-NEXT-44 boundary wall generation', () => {
  it('creates a deterministic createWallChain command from a floor boundary', () => {
    const plan = buildBoundaryWallPlan(
      floor,
      { [floor.id]: floor, [wallType.id]: wallType },
      {
        wallTypeId: wallType.id,
        wallHeightMm: 3200,
        locationLine: 'finish-face-exterior',
      },
    );

    expect(plan.canCommit).toBe(true);
    expect(plan.createCount).toBe(4);
    expect(plan.conflictCount).toBe(0);
    expect(plan.command).toMatchObject({
      type: 'createWallChain',
      levelId: 'lvl-1',
      wallTypeId: 'wt-350',
      locationLine: 'finish-face-exterior',
    });
    const segments = (plan.command?.segments ?? []) as Array<Record<string, unknown>>;
    expect(segments).toHaveLength(4);
    expect(segments.map((segment) => segment.id)).toEqual(
      plan.segments.map((segment) => segment.id),
    );
    expect(segments[0]).toMatchObject({
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 350,
      heightMm: 3200,
    });
  });

  it('marks overlapping existing walls as conflicts and skips duplicate creation', () => {
    const existingWall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'existing-south',
      name: 'Existing south wall',
      levelId: 'lvl-1',
      start: { xMm: -100, yMm: 0 },
      end: { xMm: 4100, yMm: 0 },
      thicknessMm: 200,
      heightMm: 3000,
    };

    const plan = buildBoundaryWallPlan(floor, {
      [floor.id]: floor,
      [existingWall.id]: existingWall,
    });

    expect(plan.createCount).toBe(3);
    expect(plan.conflictCount).toBe(1);
    expect(plan.segments[0]).toMatchObject({
      status: 'conflict',
      existingWallIds: ['existing-south'],
    });
    const commandSegments = (plan.command?.segments ?? []) as Array<{ id: string }>;
    expect(commandSegments.map((segment) => segment.id)).not.toContain(plan.segments[0]?.id);
  });

  it('derives room boundary wall plans from room outlines', () => {
    const room: Extract<Element, { kind: 'room' }> = {
      kind: 'room',
      id: 'room-a',
      name: 'Room A',
      levelId: 'lvl-1',
      outlineMm: floor.boundaryMm,
    };

    const plan = buildBoundaryWallPlan(room, { [room.id]: room });

    expect(plan.sourceKind).toBe('room');
    expect(plan.createCount).toBe(4);
    expect(plan.command?.type).toBe('createWallChain');
  });
});
