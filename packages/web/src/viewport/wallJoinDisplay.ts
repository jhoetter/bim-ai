import type { Element } from '@bim-ai/core';

import { collectWallConnectivity } from '../geometry/wallConnectivity';

type WallElem = Extract<Element, { kind: 'wall' }>;

export const WALL_3D_DISALLOW_JOIN_GAP_MM = 120;

export function wall3dDisallowedJoinEndpoints(
  wall: WallElem,
  elementsById: Record<string, Element> | undefined,
  toleranceMm = 35,
): { start: boolean; end: boolean } {
  if (!elementsById) return { start: false, end: false };
  const walls = Object.values(elementsById).filter(
    (entry): entry is WallElem => entry.kind === 'wall' && entry.levelId === wall.levelId,
  );
  if (walls.length < 2) return { start: false, end: false };

  const out = { start: false, end: false };
  for (const join of collectWallConnectivity(walls, { toleranceMm })) {
    if (join.disallowedByWallId[wall.id] !== true) continue;
    const endpoint = join.endpointByWallId[wall.id];
    if (endpoint === 'start') out.start = true;
    if (endpoint === 'end') out.end = true;
  }
  return out;
}

export function wallWith3dJoinDisallowGaps(
  wall: WallElem,
  elementsById: Record<string, Element> | undefined,
  gapMm = WALL_3D_DISALLOW_JOIN_GAP_MM,
): WallElem {
  const endpoints = wall3dDisallowedJoinEndpoints(wall, elementsById);
  if (!endpoints.start && !endpoints.end) return wall;

  const dx = wall.end.xMm - wall.start.xMm;
  const dy = wall.end.yMm - wall.start.yMm;
  const len = Math.hypot(dx, dy);
  if (len <= 1) return wall;

  let startGap = endpoints.start ? gapMm : 0;
  let endGap = endpoints.end ? gapMm : 0;
  const maxTotalGap = Math.max(0, len - 1);
  const requestedTotalGap = startGap + endGap;
  if (requestedTotalGap > maxTotalGap && requestedTotalGap > 0) {
    const scale = maxTotalGap / requestedTotalGap;
    startGap *= scale;
    endGap *= scale;
  }

  const ux = dx / len;
  const uy = dy / len;
  return {
    ...wall,
    start: {
      xMm: wall.start.xMm + ux * startGap,
      yMm: wall.start.yMm + uy * startGap,
    },
    end: {
      xMm: wall.end.xMm - ux * endGap,
      yMm: wall.end.yMm - uy * endGap,
    },
  };
}
