import type { Element, XY } from '@bim-ai/core';

export type AreaScheme = 'gross_building' | 'net' | 'rentable';

export type AreaPlanPlacementContext = {
  levelId: string;
  areaScheme: AreaScheme;
  ruleSet: 'gross' | 'net';
};

export type AreaPlacementBoundary = {
  existingAreaId: string;
  boundaryMm: XY[];
  areaScheme: AreaScheme;
  levelId: string;
};

export function areaPlanPlacementContext(
  elementsById: Record<string, Element>,
  activePlanViewId: string | undefined,
  fallbackLevelId: string | undefined,
): AreaPlanPlacementContext | null {
  const activePv = activePlanViewId ? elementsById[activePlanViewId] : null;
  if (!activePv || activePv.kind !== 'plan_view' || activePv.planViewSubtype !== 'area_plan') {
    return null;
  }
  const areaScheme: AreaScheme = activePv.areaScheme ?? 'gross_building';
  const levelId = activePv.levelId || fallbackLevelId;
  if (!levelId) return null;
  return {
    levelId,
    areaScheme,
    ruleSet: areaScheme === 'gross_building' ? 'gross' : 'net',
  };
}

export function findAreaPlacementBoundary(
  elementsById: Record<string, Element>,
  context: Pick<AreaPlanPlacementContext, 'levelId' | 'areaScheme'>,
  pointMm: XY,
): AreaPlacementBoundary | null {
  let best: (AreaPlacementBoundary & { areaSqMm: number }) | null = null;

  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'area') continue;
    const elScheme = el.areaScheme ?? 'gross_building';
    if (el.levelId !== context.levelId || elScheme !== context.areaScheme) continue;
    if (el.boundaryMm.length < 3) continue;

    const areaSqMm = polygonAreaAbsSqMm(el.boundaryMm);
    if (areaSqMm <= 1e-6) continue;
    if (!pointInPolygonMm(pointMm, el.boundaryMm)) continue;

    if (!best || areaSqMm < best.areaSqMm) {
      best = {
        existingAreaId: el.id,
        boundaryMm: el.boundaryMm,
        areaScheme: elScheme,
        levelId: el.levelId,
        areaSqMm,
      };
    }
  }

  if (!best) return null;
  const { areaSqMm: _areaSqMm, ...boundary } = best;
  return boundary;
}

export function pointInPolygonMm(point: XY, polygon: XY[], boundaryToleranceMm = 0.5): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    if (pointOnSegmentMm(point, a, b, boundaryToleranceMm)) return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const crossesY = pi.yMm > point.yMm !== pj.yMm > point.yMm;
    if (!crossesY) continue;

    const xAtY = ((pj.xMm - pi.xMm) * (point.yMm - pi.yMm)) / (pj.yMm - pi.yMm) + pi.xMm;
    if (point.xMm < xAtY) inside = !inside;
  }
  return inside;
}

function pointOnSegmentMm(point: XY, a: XY, b: XY, toleranceMm: number): boolean {
  const abx = b.xMm - a.xMm;
  const aby = b.yMm - a.yMm;
  const apx = point.xMm - a.xMm;
  const apy = point.yMm - a.yMm;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 1e-9) return Math.hypot(apx, apy) <= toleranceMm;

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq));
  const closest = { xMm: a.xMm + abx * t, yMm: a.yMm + aby * t };
  return Math.hypot(point.xMm - closest.xMm, point.yMm - closest.yMm) <= toleranceMm;
}

function polygonAreaAbsSqMm(polygon: XY[]): number {
  let acc = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    acc += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  return Math.abs(acc / 2);
}
