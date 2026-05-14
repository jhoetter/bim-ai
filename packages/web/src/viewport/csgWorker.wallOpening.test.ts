import { describe, expect, it } from 'vitest';
import { wallOpeningCutterGeometry, doorCutterGeometry } from './csgCutterGeometry';

const wallLen = 6.0;
const wallHeight = 2.8;
const wallThick = 0.2;

describe('wallOpeningCutterGeometry — KRN-04', () => {
  it('centered opening produces zero localX', () => {
    const out = wallOpeningCutterGeometry(
      {
        alongTStart: 0.4,
        alongTEnd: 0.6,
        sillHeightMm: 0,
        headHeightMm: 2400,
        wallHeightMm: 2800,
      },
      wallLen,
      wallHeight,
      wallThick,
    );
    expect(out.localX).toBeCloseTo(0, 5);
  });

  it('opening width is end-minus-start times wall length plus margin', () => {
    const out = wallOpeningCutterGeometry(
      {
        alongTStart: 0.1,
        alongTEnd: 0.4,
        sillHeightMm: 0,
        headHeightMm: 2400,
        wallHeightMm: 2800,
      },
      wallLen,
      wallHeight,
      wallThick,
    );
    expect(out.cutW).toBeCloseTo(0.3 * wallLen + 0.04, 5);
  });

  it('cut depth exceeds wall thickness so CSG eats through both faces', () => {
    const out = wallOpeningCutterGeometry(
      {
        alongTStart: 0.2,
        alongTEnd: 0.4,
        sillHeightMm: 200,
        headHeightMm: 2200,
        wallHeightMm: 2800,
      },
      wallLen,
      wallHeight,
      wallThick,
    );
    expect(out.cutD).toBeGreaterThan(wallThick);
  });

  it('opening from sill 200mm to head 2400mm centers on midpoint of that range', () => {
    const sill = 0.2;
    const head = 2.4;
    const out = wallOpeningCutterGeometry(
      {
        alongTStart: 0.2,
        alongTEnd: 0.4,
        sillHeightMm: 200,
        headHeightMm: 2400,
        wallHeightMm: 2800,
      },
      wallLen,
      wallHeight,
      wallThick,
    );
    const expectedMidY = sill + (head - sill) / 2 - wallHeight / 2;
    expect(out.localY).toBeCloseTo(expectedMidY, 5);
    expect(out.cutH).toBeCloseTo(head - sill + 0.02, 5);
  });

  it('reversed alongT inputs are normalized (start > end still cuts the same span)', () => {
    const fwd = wallOpeningCutterGeometry(
      {
        alongTStart: 0.2,
        alongTEnd: 0.5,
        sillHeightMm: 0,
        headHeightMm: 2400,
        wallHeightMm: 2800,
      },
      wallLen,
      wallHeight,
      wallThick,
    );
    const rev = wallOpeningCutterGeometry(
      {
        alongTStart: 0.5,
        alongTEnd: 0.2,
        sillHeightMm: 0,
        headHeightMm: 2400,
        wallHeightMm: 2800,
      },
      wallLen,
      wallHeight,
      wallThick,
    );
    expect(rev.cutW).toBeCloseTo(fwd.cutW, 5);
    expect(rev.localX).toBeCloseTo(fwd.localX, 5);
  });

  it('sill clamped to non-negative; head clamped to wall height', () => {
    const out = wallOpeningCutterGeometry(
      {
        alongTStart: 0,
        alongTEnd: 0.5,
        sillHeightMm: -100,
        headHeightMm: 5000,
        wallHeightMm: 2800,
      },
      wallLen,
      wallHeight,
      wallThick,
    );
    // After clamping, cut spans 0..wallHeight.
    expect(out.cutH).toBeCloseTo(wallHeight + 0.02, 5);
  });

  it('produces cutter geometry independent of doorCutterGeometry (no frame)', () => {
    const wo = wallOpeningCutterGeometry(
      {
        alongTStart: 0.4,
        alongTEnd: 0.6,
        sillHeightMm: 0,
        headHeightMm: 2100,
        wallHeightMm: 2800,
      },
      wallLen,
      wallHeight,
      wallThick,
    );
    const dr = doorCutterGeometry(
      { widthMm: 0.2 * wallLen * 1000, alongT: 0.5, wallHeightMm: 2800 },
      wallLen,
      wallHeight,
      wallThick,
    );
    // wall_opening Y is sill-anchored (custom range); door is leaf-height anchored.
    expect(wo.localY).not.toBeCloseTo(dr.localY, 3);
  });

  it('door cutter honors explicit family type height when supplied', () => {
    const out = doorCutterGeometry(
      { widthMm: 1800, heightMm: 2100, alongT: 0.5, wallHeightMm: 3200 },
      wallLen,
      3.2,
      wallThick,
    );

    expect(out.cutW).toBeCloseTo(1.84, 5);
    expect(out.cutH).toBeCloseTo(2.11, 5);
  });
});
