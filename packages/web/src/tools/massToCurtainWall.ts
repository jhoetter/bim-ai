import type { Element } from '@bim-ai/core';
import type { MassNewElem } from './massToFloors';

export interface CurtainWallCmd {
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
  heightMm: number;
  levelId: string;
}

function massEffectiveHeight(mass: MassNewElem): number {
  if (mass.kind === 'mass_revolution') {
    return Math.max(...mass.profilePoints.map((p) => p.yMm), 0);
  }
  return mass.heightMm;
}

function polygonToWallCmds(
  polygon: { xMm: number; yMm: number }[],
  heightMm: number,
  levelId: string,
): CurtainWallCmd[] {
  const n = polygon.length;
  return polygon.map((p, i) => {
    const next = polygon[(i + 1) % n]!;
    return {
      startMm: { xMm: p.xMm, yMm: p.yMm },
      endMm: { xMm: next.xMm, yMm: next.yMm },
      heightMm,
      levelId,
    };
  });
}

export function massToCurtainWallCmds(
  mass: MassNewElem,
  baseLevel: Extract<Element, { kind: 'level' }>,
): CurtainWallCmd[] {
  const h = massEffectiveHeight(mass);
  const lid = baseLevel.id;

  if (mass.kind === 'mass_box') {
    const { insertionXMm: x, insertionYMm: y, widthMm: w, depthMm: d } = mass;
    return polygonToWallCmds(
      [
        { xMm: x, yMm: y },
        { xMm: x + w, yMm: y },
        { xMm: x + w, yMm: y + d },
        { xMm: x, yMm: y + d },
      ],
      h,
      lid,
    );
  }

  if (mass.kind === 'mass_extrusion') {
    return polygonToWallCmds(mass.profilePoints, h, lid);
  }

  // mass_revolution: bounding box approximation
  const cx = mass.axisPt1.xMm;
  const cy = mass.axisPt1.yMm;
  const r = Math.max(...mass.profilePoints.map((p) => p.xMm), 1);
  return polygonToWallCmds(
    [
      { xMm: cx - r, yMm: cy - r },
      { xMm: cx + r, yMm: cy - r },
      { xMm: cx + r, yMm: cy + r },
      { xMm: cx - r, yMm: cy + r },
    ],
    h,
    lid,
  );
}
