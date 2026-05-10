import { describe, expect, it } from 'vitest';

import {
  lineFromReferencePlane,
  pickedFamilyGeometryLine,
  pickedReferencePlaneLine,
  rederiveLockedSketchLines,
  solveReferencePlaneDimensionConstraints,
  trimExtendSketchLinesToCorner,
} from './familySketchGeometry';

describe('familySketchGeometry', () => {
  it('creates profile sketch lines from reference planes', () => {
    expect(lineFromReferencePlane({ id: 'rp-v', isVertical: true, offsetMm: 250 }, 500)).toEqual({
      startMm: { xMm: 250, yMm: -500 },
      endMm: { xMm: 250, yMm: 500 },
    });
    expect(lineFromReferencePlane({ id: 'rp-h', isVertical: false, offsetMm: 125 }, 500)).toEqual({
      startMm: { xMm: -500, yMm: 125 },
      endMm: { xMm: 500, yMm: 125 },
    });
  });

  it('rederives locked picked lines when a reference plane moves', () => {
    const lines = [
      pickedReferencePlaneLine({ id: 'rp-v', isVertical: true, offsetMm: 0 }, true, 100),
      {
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 10, yMm: 0 },
      },
    ];

    expect(
      rederiveLockedSketchLines(lines, [{ id: 'rp-v', isVertical: true, offsetMm: 300 }], 100),
    ).toEqual([
      {
        startMm: { xMm: 300, yMm: -100 },
        endMm: { xMm: 300, yMm: 100 },
        source: { kind: 'reference_plane', refPlaneId: 'rp-v' },
        locked: true,
      },
      {
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 10, yMm: 0 },
      },
    ]);
  });

  it('rederives locked picked lines from family geometry edges', () => {
    const lines = [
      pickedFamilyGeometryLine(
        {
          startMm: { xMm: 0, yMm: 0 },
          endMm: { xMm: 100, yMm: 0 },
        },
        { kind: 'family_geometry', geometryKind: 'symbolic_line', index: 0 },
        true,
      ),
    ];

    expect(
      rederiveLockedSketchLines(
        lines,
        [],
        [
          {
            startMm: { xMm: 25, yMm: 50 },
            endMm: { xMm: 125, yMm: 50 },
          },
        ],
        100,
      ),
    ).toEqual([
      {
        startMm: { xMm: 25, yMm: 50 },
        endMm: { xMm: 125, yMm: 50 },
        source: { kind: 'family_geometry', geometryKind: 'symbolic_line', index: 0 },
        locked: true,
      },
    ]);
  });

  it('solves aligned dimension constraints against reference-plane offsets', () => {
    const solved = solveReferencePlaneDimensionConstraints(
      [
        { id: 'left', isVertical: true, offsetMm: 0, locked: true },
        { id: 'right', isVertical: true, offsetMm: 1000 },
      ],
      [{ refAId: 'left', refBId: 'right', paramKey: 'Width', lockedValueMm: 1000 }],
      { Width: 1500 },
    );

    expect(solved.find((plane) => plane.id === 'right')?.offsetMm).toBe(1500);
  });

  it('moves the unlocked anchor when the second reference plane is locked', () => {
    const solved = solveReferencePlaneDimensionConstraints(
      [
        { id: 'left', isVertical: true, offsetMm: 0 },
        { id: 'right', isVertical: true, offsetMm: 1000, locked: true },
      ],
      [{ refAId: 'left', refBId: 'right', paramKey: 'Width', lockedValueMm: 1000 }],
      { Width: 750 },
    );

    expect(solved.find((plane) => plane.id === 'left')?.offsetMm).toBe(250);
    expect(solved.find((plane) => plane.id === 'right')?.offsetMm).toBe(1000);
  });

  it('trims or extends the nearest endpoints of two profile lines to their corner', () => {
    const next = trimExtendSketchLinesToCorner(
      [
        {
          startMm: { xMm: 0, yMm: 0 },
          endMm: { xMm: 10, yMm: 0 },
        },
        {
          startMm: { xMm: 12, yMm: -5 },
          endMm: { xMm: 12, yMm: 10 },
        },
      ],
      0,
      1,
    );

    expect(next[0]?.endMm).toEqual({ xMm: 12, yMm: 0 });
    expect(next[1]?.startMm).toEqual({ xMm: 12, yMm: 0 });
  });

  it('leaves parallel lines unchanged', () => {
    const lines = [
      {
        startMm: { xMm: 0, yMm: 0 },
        endMm: { xMm: 10, yMm: 0 },
      },
      {
        startMm: { xMm: 0, yMm: 5 },
        endMm: { xMm: 10, yMm: 5 },
      },
    ];

    expect(trimExtendSketchLinesToCorner(lines, 0, 1)).toEqual(lines);
  });
});
