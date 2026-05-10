import type { Element } from '@bim-ai/core';

type WallElement = Extract<Element, { kind: 'wall' }>;

export type WallTabCycleState = {
  selId: string;
  index: number;
};

export type WallTabSelectionResult = {
  nextSelectedId: string;
  nextSelectedIds: string[];
  nextCycleState: WallTabCycleState;
};

function pointsClose(ax: number, ay: number, bx: number, by: number, toleranceMm: number): boolean {
  return Math.abs(ax - bx) < toleranceMm && Math.abs(ay - by) < toleranceMm;
}

export function selectNextConnectedWallByTab(
  elementsById: Record<string, Element>,
  selectedId: string | undefined,
  selectedIds: string[],
  cycleState: WallTabCycleState,
  toleranceMm = 10,
): WallTabSelectionResult | null {
  if (!selectedId) return null;
  const curEl = elementsById[selectedId];
  if (curEl?.kind !== 'wall') return null;
  const curWall = curEl as WallElement;
  const allWalls = Object.values(elementsById).filter(
    (e): e is WallElement => e.kind === 'wall' && e.levelId === curWall.levelId,
  );

  let connected = allWalls.filter(
    (w) =>
      w.id !== curWall.id &&
      (pointsClose(w.start.xMm, w.start.yMm, curWall.end.xMm, curWall.end.yMm, toleranceMm) ||
        pointsClose(w.end.xMm, w.end.yMm, curWall.end.xMm, curWall.end.yMm, toleranceMm)),
  );
  if (connected.length === 0) {
    connected = allWalls.filter(
      (w) =>
        w.id !== curWall.id &&
        (pointsClose(w.start.xMm, w.start.yMm, curWall.start.xMm, curWall.start.yMm, toleranceMm) ||
          pointsClose(w.end.xMm, w.end.yMm, curWall.start.xMm, curWall.start.yMm, toleranceMm)),
    );
  }
  if (connected.length === 0) return null;

  const index = cycleState.selId === selectedId ? (cycleState.index + 1) % connected.length : 0;
  const nextWall = connected[index]!;
  const selectedSet = new Set([selectedId, ...selectedIds, nextWall.id]);
  selectedSet.delete(nextWall.id);

  return {
    nextSelectedId: nextWall.id,
    nextSelectedIds: [...selectedSet],
    nextCycleState: { selId: selectedId, index },
  };
}
