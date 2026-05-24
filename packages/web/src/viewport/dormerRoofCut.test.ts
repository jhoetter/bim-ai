import { afterEach, describe, expect, it } from 'vitest';

import type { Element } from '@bim-ai/core';

import { computeDormerCutVerticalExtent, DORMER_CUT_MARGIN_M } from './dormerCutGeometry';
import { makeRoofMassMesh, registerDormerCutFn } from './meshBuilders';

type LevelElem = Extract<Element, { kind: 'level' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;
type DormerElem = Extract<Element, { kind: 'dormer' }>;

const level0: LevelElem = {
  kind: 'level',
  id: 'lvl-0',
  name: 'EG',
  elevationMm: 0,
};

const wall3m: WallElem = {
  kind: 'wall',
  id: 'wall-1',
  name: 'EG wall',
  levelId: 'lvl-0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 8000, yMm: 0 },
  thicknessMm: 240,
  heightMm: 3000,
};

const gableRoof: RoofElem = {
  kind: 'roof',
  id: 'roof-1',
  name: 'Main gable roof',
  referenceLevelId: 'lvl-0',
  footprintMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 8000, yMm: 0 },
    { xMm: 8000, yMm: 6000 },
    { xMm: 0, yMm: 6000 },
  ],
  roofGeometryMode: 'gable_pitched_rectangle',
  slopeDeg: 35,
  overhangMm: 400,
};

const dormer: DormerElem = {
  kind: 'dormer',
  id: 'dormer-1',
  hostRoofId: 'roof-1',
  positionOnRoof: { alongRidgeMm: 0, acrossRidgeMm: 0 },
  widthMm: 1800,
  depthMm: 1500,
  wallHeightMm: 1600,
  dormerRoofKind: 'shed',
};

describe('computeDormerCutVerticalExtent (issue #77)', () => {
  it('starts the cutter just under the eave when eaveY is provided', () => {
    // EG floor at 0m, wall 3m → eaveY=3. Cutter base must sit just below
    // the eave, NOT at the ground (which is what produced the EG-window
    // leak through the dormer hole).
    const { baseY, cutHeightM } = computeDormerCutVerticalExtent(0, 3);
    expect(baseY).toBeCloseTo(3 - DORMER_CUT_MARGIN_M, 6);
    expect(cutHeightM).toBe(30);
  });

  it('keeps the cutter strictly above the wall top so the storey below stays intact', () => {
    // Critical invariant: the cutter's lower face must sit above the
    // top-of-wall, with at most one CUT_MARGIN slip-through. If this
    // ever regresses, EG windows leak through the dormer hole again.
    const refElev = 0;
    const wallTopM = 3;
    const eaveY = refElev + wallTopM;
    const { baseY } = computeDormerCutVerticalExtent(refElev, eaveY);
    expect(baseY).toBeGreaterThan(refElev);
    expect(baseY).toBeGreaterThanOrEqual(wallTopM - DORMER_CUT_MARGIN_M - 1e-9);
    expect(eaveY - baseY).toBeLessThanOrEqual(DORMER_CUT_MARGIN_M + 1e-9);
  });

  it('falls back to refElev when eaveY is omitted (legacy callers)', () => {
    // Older callers / synthetic tests that don't know the eave height
    // get the pre-#77 behaviour (cut from ground up), preserving
    // backwards compatibility.
    const { baseY, cutHeightM } = computeDormerCutVerticalExtent(0.5, undefined);
    expect(baseY).toBe(0.5);
    expect(cutHeightM).toBe(30);
  });

  it('still covers the full ridge height for steep mansards (cut height stays at 30m)', () => {
    // The cutter is intentionally tall so one box subtraction is enough
    // even for absurdly steep roofs; only the BOTTOM bound moved in #77.
    const { baseY, cutHeightM } = computeDormerCutVerticalExtent(0, 3);
    expect(baseY + cutHeightM).toBeGreaterThan(30); // ridge well below this
  });
});

describe('applyDormerCutsToRoofGeom wiring (issue #77)', () => {
  afterEach(() => {
    registerDormerCutFn(null);
  });

  it('passes eaveY (refElev + wallTop) to the registered dormer cut helper', () => {
    // Regression for issue #77: meshBuilders must pass the eave-top
    // elevation, not just refElev, so the cutter knows where the wall
    // ends. Without this, the cut helper has to fall back to refElev
    // and the cutter slices through the storey beneath the roof.
    let captured: { refElev: number; eaveY: number | undefined } | null = null;
    registerDormerCutFn((geom, _roof, _elementsById, refElev, eaveY) => {
      captured = { refElev, eaveY };
      return geom;
    });
    const elementsById: Record<string, Element> = {
      'lvl-0': level0,
      'wall-1': wall3m,
      'roof-1': gableRoof,
      'dormer-1': dormer,
    };
    makeRoofMassMesh(gableRoof, elementsById, null);

    expect(captured).not.toBeNull();
    expect(captured!.refElev).toBeCloseTo(0, 6);
    // wallTop = 3m → eaveY = 3m.
    expect(captured!.eaveY).toBeCloseTo(3, 6);
  });

  it('uses the eave-Y to start the cutter ABOVE the wall top', () => {
    // End-to-end check via the pure helper: given the wiring above, the
    // cutter's vertical extent reaches the bottom face of the roof but
    // does NOT extend into the wall.
    const refElev = 0;
    const wallTopM = 3;
    const eaveY = refElev + wallTopM;
    const { baseY, cutHeightM } = computeDormerCutVerticalExtent(refElev, eaveY);
    // Cutter bottom face just under the eave (within margin).
    expect(baseY).toBeGreaterThanOrEqual(eaveY - DORMER_CUT_MARGIN_M - 1e-9);
    expect(baseY).toBeLessThanOrEqual(eaveY);
    // Cutter top well above any plausible ridge.
    expect(baseY + cutHeightM).toBeGreaterThan(eaveY + 10);
    // And critically: the cutter does NOT reach down into the storey
    // (it stays above refElev + wallTop - DORMER_CUT_MARGIN_M).
    const wallTopY = refElev + wallTopM;
    expect(baseY).toBeGreaterThan(wallTopY - 2 * DORMER_CUT_MARGIN_M);
  });
});
