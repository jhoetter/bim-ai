/**
 * §11.5 — Massing → BIM workflow helpers.
 *
 * Pure functions that derive CreateWallCmd / CreateFloorCmd / CreateRoofCmd
 * arrays from a mass element so they can be unit-tested without mounting
 * Workspace.tsx.
 */
import type { Element } from '@bim-ai/core';
import type { MassNewElem } from './massToFloors';

export type LevelElem = Extract<Element, { kind: 'level' }>;

// ---------------------------------------------------------------------------
// Command shapes (mirrors the server-side semantic command API)
// ---------------------------------------------------------------------------

export interface CreateWallCmd {
  type: 'createWall';
  id: string;
  levelId: string;
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
  heightMm: number;
  /** Default wall thickness in mm. */
  widthMm: number;
}

export interface CreateFloorCmd {
  type: 'createFloor';
  levelId: string;
  boundaryMm: { xMm: number; yMm: number }[];
}

export interface CreateRoofCmd {
  type: 'createRoof';
  referenceLevelId: string;
  footprintMm: { xMm: number; yMm: number }[];
}

// ---------------------------------------------------------------------------
// §11.5 (WP-E) curtain wall command shape
// ---------------------------------------------------------------------------

export interface CreateCurtainWallCmd {
  type: 'createWall';
  id: string;
  levelId: string;
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
  heightMm: number;
  widthMm: number;
  isCurtainWall: true;
  curtainWallData: {
    gridH: { count: number };
    gridV: { count: number };
    panelType: 'glass';
    mullionType: 'rectangular';
  };
}

// ---------------------------------------------------------------------------
// Internal geometry helpers (shared with massToFloors / massToCurtainWall)
// ---------------------------------------------------------------------------

function massBoxFootprint(
  mass: Extract<Element, { kind: 'mass_box' }>,
): { xMm: number; yMm: number }[] {
  const { insertionXMm: x, insertionYMm: y, widthMm: w, depthMm: d } = mass;
  return [
    { xMm: x, yMm: y },
    { xMm: x + w, yMm: y },
    { xMm: x + w, yMm: y + d },
    { xMm: x, yMm: y + d },
  ];
}

function revolutionFootprint(
  mass: Extract<Element, { kind: 'mass_revolution' }>,
): { xMm: number; yMm: number }[] {
  const cx = mass.axisPt1.xMm;
  const cy = mass.axisPt1.yMm;
  const r = Math.max(...mass.profilePoints.map((p) => p.xMm), 1);
  return [
    { xMm: cx - r, yMm: cy - r },
    { xMm: cx + r, yMm: cy - r },
    { xMm: cx + r, yMm: cy + r },
    { xMm: cx - r, yMm: cy + r },
  ];
}

function massFootprint(mass: MassNewElem): { xMm: number; yMm: number }[] {
  if (mass.kind === 'mass_box') return massBoxFootprint(mass);
  if (mass.kind === 'mass_extrusion') return mass.profilePoints;
  return revolutionFootprint(mass);
}

function massEffectiveHeight(mass: MassNewElem): number {
  if (mass.kind === 'mass_revolution') {
    return Math.max(...mass.profilePoints.map((p) => p.yMm), 0);
  }
  return mass.heightMm;
}

function massTopElevation(mass: MassNewElem): number {
  return mass.baseElevationMm + massEffectiveHeight(mass);
}

// ---------------------------------------------------------------------------
// §11.5-A: Generate walls from mass
// ---------------------------------------------------------------------------

/**
 * For each edge of the mass footprint, produce a CreateWallCmd.
 * The wall spans from the base elevation to the top elevation.
 */
export function generateWallsFromMass(
  mass: MassNewElem,
  lowestLevelId: string,
  wallThicknessMm = 200,
): CreateWallCmd[] {
  const footprint = massFootprint(mass);
  const n = footprint.length;
  if (n < 2) return [];

  const heightMm = massEffectiveHeight(mass);

  return footprint.map((pt, i) => {
    const next = footprint[(i + 1) % n]!;
    return {
      type: 'createWall',
      id: crypto.randomUUID(),
      levelId: lowestLevelId,
      start: { xMm: pt.xMm, yMm: pt.yMm },
      end: { xMm: next.xMm, yMm: next.yMm },
      heightMm,
      widthMm: wallThicknessMm,
    };
  });
}

// ---------------------------------------------------------------------------
// §11.5-B: Generate floors from mass
// ---------------------------------------------------------------------------

/**
 * For each level whose elevation intersects the mass volume, produce a
 * CreateFloorCmd with the mass footprint as the boundary.
 */
export function generateFloorsFromMass(mass: MassNewElem, levels: LevelElem[]): CreateFloorCmd[] {
  const baseMm = mass.baseElevationMm;
  const topMm = massTopElevation(mass);
  const boundary = massFootprint(mass);
  const result: CreateFloorCmd[] = [];

  for (const lvl of levels) {
    const elev = lvl.elevationMm;
    if (elev < baseMm - 1 || elev > topMm + 1) continue;
    result.push({ type: 'createFloor', levelId: lvl.id, boundaryMm: boundary });
  }

  return result;
}

// ---------------------------------------------------------------------------
// §11.5-C: Generate roof from mass
// ---------------------------------------------------------------------------

/**
 * Returns a CreateRoofCmd using the mass footprint at the top elevation.
 * The referenceLevelId must be supplied by the caller (highest level that
 * intersects the mass, or the lowest level id as a fallback).
 */
export function generateRoofFromMass(mass: MassNewElem, referenceLevelId: string): CreateRoofCmd {
  const footprint = massFootprint(mass);
  return {
    type: 'createRoof',
    referenceLevelId,
    footprintMm: footprint,
  };
}

// ---------------------------------------------------------------------------
// §11.5 (WP-E): Generate curtain walls from mass — one per vertical face
// ---------------------------------------------------------------------------

/**
 * For each edge of the mass footprint, produce a CreateCurtainWallCmd with
 * curtainWallData set (gridH: 2 rows, gridV: 3 columns, glass panels,
 * rectangular mullions). The wall spans the full mass height.
 */
export function generateCurtainWallsFromMass(
  mass: MassNewElem,
  lowestLevelId: string,
): CreateCurtainWallCmd[] {
  const footprint = massFootprint(mass);
  const n = footprint.length;
  if (n < 2) return [];

  const heightMm = massEffectiveHeight(mass);

  return footprint.map((pt, i) => {
    const next = footprint[(i + 1) % n]!;
    return {
      type: 'createWall',
      id: crypto.randomUUID(),
      levelId: lowestLevelId,
      start: { xMm: pt.xMm, yMm: pt.yMm },
      end: { xMm: next.xMm, yMm: next.yMm },
      heightMm,
      widthMm: 50,
      isCurtainWall: true,
      curtainWallData: {
        gridH: { count: 2 },
        gridV: { count: 3 },
        panelType: 'glass',
        mullionType: 'rectangular',
      },
    };
  });
}
