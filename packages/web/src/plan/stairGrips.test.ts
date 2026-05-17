/**
 * §8.6.4 — stair grip provider tests.
 */
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';
import { stairGripProvider } from './grip-providers/stairGripProvider';

type StairEl = Extract<Element, { kind: 'stair' }>;

function makeStair(overrides: Partial<StairEl> = {}): StairEl {
  return {
    kind: 'stair',
    id: 'stair-1',
    name: 'Test Stair',
    baseLevelId: 'lvl-ground',
    topLevelId: 'lvl-upper',
    runStartMm: { xMm: 0, yMm: 0 },
    runEndMm: { xMm: 3000, yMm: 0 },
    widthMm: 1200,
    riserMm: 175,
    treadMm: 280,
    riserCount: 16,
    ...overrides,
  } as StairEl;
}

describe('stair grip provider — §8.6.4', () => {
  it('provides a riser-count grip at top of stair', () => {
    const stair = makeStair();
    const grips = stairGripProvider.grips(stair, {});
    const riserGrip = grips.find((g) => g.id === `${stair.id}:riser-grip`);
    expect(riserGrip).toBeTruthy();
  });

  it('provides a run-width grip on the right side', () => {
    const stair = makeStair();
    const grips = stairGripProvider.grips(stair, {});
    const widthGrip = grips.find((g) => g.id === `${stair.id}:width-grip`);
    expect(widthGrip).toBeTruthy();
  });

  it('riser grip is positioned at the top centre of the stair', () => {
    const stair = makeStair({
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 3000, yMm: 0 },
    });
    const grips = stairGripProvider.grips(stair, {});
    const riserGrip = grips.find((g) => g.id === `${stair.id}:riser-grip`);
    // The run goes from (0,0) to (3000,0), depth = 3000mm.
    // Grip should be at start.xMm, start.yMm - depth = (0, -3000).
    expect(riserGrip!.positionMm.xMm).toBeCloseTo(0, 1);
    expect(riserGrip!.positionMm.yMm).toBeCloseTo(-3000, 1);
  });

  it('width grip is positioned at the right side of the stair', () => {
    const stair = makeStair({
      widthMm: 1200,
      runStartMm: { xMm: 0, yMm: 0 },
      runEndMm: { xMm: 3000, yMm: 0 },
    });
    const grips = stairGripProvider.grips(stair, {});
    const widthGrip = grips.find((g) => g.id === `${stair.id}:width-grip`);
    // runWidthMm falls back to widthMm=1200; xMm = 0 + 1200 = 1200.
    expect(widthGrip!.positionMm.xMm).toBeCloseTo(1200, 1);
  });

  it('dragging riser grip adjusts riserCount by 1 per 175mm', () => {
    const stair = makeStair({ riserCount: 16 });
    const grips = stairGripProvider.grips(stair, {});
    const riserGrip = grips.find((g) => g.id === `${stair.id}:riser-grip`)!;

    // Dragging up (negative yMm) should increase riserCount.
    // -175mm → round(-(-175)/175) = round(1) = +1 → 17
    const cmd17 = riserGrip.onCommit({ xMm: 0, yMm: -175 });
    expect(cmd17).toMatchObject({ key: 'riserCount', value: 17 });

    // Dragging down (positive yMm) should decrease riserCount.
    // +175mm → round(-(175)/175) = round(-1) = -1 → 15
    const cmd15 = riserGrip.onCommit({ xMm: 0, yMm: 175 });
    expect(cmd15).toMatchObject({ key: 'riserCount', value: 15 });
  });

  it('riserCount cannot go below 2 from grip', () => {
    const stair = makeStair({ riserCount: 2 });
    const grips = stairGripProvider.grips(stair, {});
    const riserGrip = grips.find((g) => g.id === `${stair.id}:riser-grip`)!;
    // Dragging down a lot should floor at 2.
    const cmd = riserGrip.onCommit({ xMm: 0, yMm: 5000 });
    expect((cmd as { value: number }).value).toBeGreaterThanOrEqual(2);
  });

  it('dragging width grip adjusts runWidthMm', () => {
    const stair = makeStair({ widthMm: 1200 });
    const grips = stairGripProvider.grips(stair, {});
    const widthGrip = grips.find((g) => g.id === `${stair.id}:width-grip`)!;

    // Dragging right by 200mm → 1200 + 200 = 1400
    const cmd = widthGrip.onCommit({ xMm: 200, yMm: 0 });
    expect(cmd).toMatchObject({ key: 'runWidthMm', value: 1400 });
  });

  it('run width cannot go below 600mm from grip', () => {
    const stair = makeStair({ widthMm: 700 });
    const grips = stairGripProvider.grips(stair, {});
    const widthGrip = grips.find((g) => g.id === `${stair.id}:width-grip`)!;
    // Dragging left by 500mm → 700 - 500 = 200, but floor is 600.
    const cmd = widthGrip.onCommit({ xMm: -500, yMm: 0 });
    expect((cmd as { value: number }).value).toBeGreaterThanOrEqual(600);
  });

  it('uses runWidthMm over widthMm when both are set', () => {
    const stair = makeStair({ widthMm: 1200, runWidthMm: 1500 });
    const grips = stairGripProvider.grips(stair, {});
    const widthGrip = grips.find((g) => g.id === `${stair.id}:width-grip`)!;
    // Commit with no drag → value = 1500 + 0 = 1500.
    const cmd = widthGrip.onCommit({ xMm: 0, yMm: 0 });
    expect((cmd as { value: number }).value).toBe(1500);
  });
});
