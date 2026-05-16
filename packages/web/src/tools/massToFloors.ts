import type { Element } from '@bim-ai/core';

export type MassNewElem =
  | Extract<Element, { kind: 'mass_box' }>
  | Extract<Element, { kind: 'mass_extrusion' }>
  | Extract<Element, { kind: 'mass_revolution' }>;

export interface FloorCmd {
  levelId: string;
  boundary: { xMm: number; yMm: number }[];
  elevationMm: number;
}

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

function massTopElevation(mass: MassNewElem): number {
  if (mass.kind === 'mass_revolution') {
    const maxY = Math.max(...mass.profilePoints.map((p) => p.yMm), 0);
    return mass.baseElevationMm + maxY;
  }
  return mass.baseElevationMm + mass.heightMm;
}

function massFootprint(mass: MassNewElem): { xMm: number; yMm: number }[] {
  if (mass.kind === 'mass_box') return massBoxFootprint(mass);
  if (mass.kind === 'mass_extrusion') return mass.profilePoints;
  return revolutionFootprint(mass);
}

export function massToFloorCmds(
  mass: MassNewElem,
  levels: Extract<Element, { kind: 'level' }>[],
): FloorCmd[] {
  const baseMm = mass.baseElevationMm;
  const topMm = massTopElevation(mass);
  const boundary = massFootprint(mass);
  const result: FloorCmd[] = [];

  for (const lvl of levels) {
    const elev = lvl.elevationMm;
    if (elev < baseMm - 1 || elev > topMm + 1) continue;
    result.push({ levelId: lvl.id, boundary, elevationMm: elev });
  }

  return result;
}
