export interface WallOffsetWall {
  id: string;
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
}

export interface WallOffsetMoveCommand extends Record<string, unknown> {
  type: 'moveElementsDelta';
  elementIds: string[];
  dxMm: number;
  dyMm: number;
}

function cleanZero(value: number): number {
  return Object.is(value, -0) || Math.abs(value) < 1e-9 ? 0 : value;
}

export function wallOffsetDeltaFromPoint(
  wall: WallOffsetWall,
  pointMm: { xMm: number; yMm: number },
): { dxMm: number; dyMm: number; signedOffsetMm: number } | null {
  const dx = wall.end.xMm - wall.start.xMm;
  const dy = wall.end.yMm - wall.start.yMm;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return null;

  const normal = { x: -dy / length, y: dx / length };
  const signedOffsetMm =
    (pointMm.xMm - wall.start.xMm) * normal.x + (pointMm.yMm - wall.start.yMm) * normal.y;
  if (Math.abs(signedOffsetMm) < 0.5) return null;

  return {
    dxMm: cleanZero(normal.x * signedOffsetMm),
    dyMm: cleanZero(normal.y * signedOffsetMm),
    signedOffsetMm,
  };
}

export function wallOffsetMoveCommandFromPoint(
  wall: WallOffsetWall,
  pointMm: { xMm: number; yMm: number },
  selectedIds: string[] = [],
): WallOffsetMoveCommand | null {
  const delta = wallOffsetDeltaFromPoint(wall, pointMm);
  if (!delta) return null;
  const elementIds = Array.from(new Set([wall.id, ...selectedIds].filter(Boolean)));
  return {
    type: 'moveElementsDelta',
    elementIds,
    dxMm: delta.dxMm,
    dyMm: delta.dyMm,
  };
}
