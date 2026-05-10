import { describe, expect, it } from 'vitest';

import {
  lineFromReferencePlane,
  pickedReferencePlaneLine,
  rederiveLockedSketchLines,
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
