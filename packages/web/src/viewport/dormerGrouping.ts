import type { Element } from '@bim-ai/core';

type DormerElem = Extract<Element, { kind: 'dormer' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;

export interface DormerFootprint {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface DormerGroup {
  primaryId: string;
  memberIds: string[];
  mergedFootprint: DormerFootprint;
  mergedWallHeightMm: number;
}

const DEFAULT_MERGE_THRESHOLD_MM = 200;

/**
 * Compute each dormer's roof-plan AABB and union groups whose AABBs overlap or
 * sit within `thresholdMm` of each other. Returns one group per cluster; the
 * `primaryId` is the dormer with the largest footprint area (ties broken by id
 * sort), which is the body that should be rendered for the merged cluster.
 */
export function groupDormersByOverlap(
  dormers: DormerElem[],
  hostRoof: RoofElem,
  thresholdMm: number = DEFAULT_MERGE_THRESHOLD_MM,
): DormerGroup[] {
  if (dormers.length === 0) return [];

  const footprints = dormers.map((d) => ({
    id: d.id,
    fp: dormerFootprintForRoof(d, hostRoof),
    areaMm2: d.widthMm * d.depthMm,
    wallHeightMm: d.wallHeightMm,
  }));

  const parent = new Map<string, string>();
  for (const f of footprints) parent.set(f.id, f.id);
  function find(x: string): string {
    let cur = x;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    let path = x;
    while (parent.get(path) !== cur) {
      const next = parent.get(path)!;
      parent.set(path, cur);
      path = next;
    }
    return cur;
  }
  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      if (bboxesWithin(footprints[i].fp, footprints[j].fp, thresholdMm)) {
        union(footprints[i].id, footprints[j].id);
      }
    }
  }

  const groups = new Map<string, typeof footprints>();
  for (const f of footprints) {
    const root = find(f.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(f);
  }

  const result: DormerGroup[] = [];
  for (const members of groups.values()) {
    const sorted = [...members].sort((a, b) => {
      if (a.areaMm2 !== b.areaMm2) return b.areaMm2 - a.areaMm2;
      return a.id < b.id ? -1 : 1;
    });
    const primary = sorted[0];
    result.push({
      primaryId: primary.id,
      memberIds: members.map((m) => m.id),
      mergedFootprint: mergeFootprints(members.map((m) => m.fp)),
      mergedWallHeightMm: Math.max(...members.map((m) => m.wallHeightMm)),
    });
  }
  return result;
}

function bboxesWithin(a: DormerFootprint, b: DormerFootprint, thresholdMm: number): boolean {
  const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const gapY = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY));
  return gapX <= thresholdMm && gapY <= thresholdMm;
}

function mergeFootprints(fps: DormerFootprint[]): DormerFootprint {
  return {
    minX: Math.min(...fps.map((f) => f.minX)),
    maxX: Math.max(...fps.map((f) => f.maxX)),
    minY: Math.min(...fps.map((f) => f.minY)),
    maxY: Math.max(...fps.map((f) => f.maxY)),
  };
}

function dormerFootprintForRoof(dormer: DormerElem, hostRoof: RoofElem): DormerFootprint {
  const xs = hostRoof.footprintMm.map((p) => p.xMm);
  const ys = hostRoof.footprintMm.map((p) => p.yMm);
  const minRx = Math.min(...xs);
  const maxRx = Math.max(...xs);
  const minRy = Math.min(...ys);
  const maxRy = Math.max(...ys);
  const cx = (minRx + maxRx) / 2;
  const cy = (minRy + maxRy) / 2;
  const spanX = maxRx - minRx;
  const spanY = maxRy - minRy;
  const ridgeAlongX =
    hostRoof.ridgeAxis === 'x' ? true : hostRoof.ridgeAxis === 'z' ? false : spanX >= spanY;
  const dx = ridgeAlongX ? dormer.positionOnRoof.alongRidgeMm : dormer.positionOnRoof.acrossRidgeMm;
  const dy = ridgeAlongX ? dormer.positionOnRoof.acrossRidgeMm : dormer.positionOnRoof.alongRidgeMm;
  const centreX = cx + dx;
  const centreY = cy + dy;
  const halfW = dormer.widthMm / 2;
  const halfD = dormer.depthMm / 2;
  if (ridgeAlongX) {
    return {
      minX: centreX - halfW,
      maxX: centreX + halfW,
      minY: centreY - halfD,
      maxY: centreY + halfD,
    };
  }
  return {
    minX: centreX - halfD,
    maxX: centreX + halfD,
    minY: centreY - halfW,
    maxY: centreY + halfW,
  };
}
