import type { Element } from '@bim-ai/core';

type ToposolidEl = Extract<Element, { kind: 'toposolid' }>;
type PointMm = { xMm: number; yMm: number };

/**
 * Splits a toposolid into two separate toposolid elements by a polyline.
 * The split line is defined by a sequence of 2D points.
 * Returns two new toposolid elements (the original should be deleted by the caller).
 * §5.1.6
 */
export function splitToposolid(
  topo: ToposolidEl,
  splitLineMm: PointMm[],
): [ToposolidEl, ToposolidEl] {
  // Simplified: partition heightSamples into left/right of the split line.
  // Use cross product to determine side for each sample.
  const left: typeof topo.heightSamples = [];
  const right: typeof topo.heightSamples = [];

  for (const sample of topo.heightSamples ?? []) {
    const side = sideOfPolyline(splitLineMm, { xMm: sample.xMm, yMm: sample.yMm });
    if (side >= 0) left.push(sample);
    else right.push(sample);
  }

  // Compute bounding boxes for perimeters
  const leftPerim = boundingBoxPerimeter(left.map((s) => ({ xMm: s.xMm, yMm: s.yMm })));
  const rightPerim = boundingBoxPerimeter(right.map((s) => ({ xMm: s.xMm, yMm: s.yMm })));

  return [
    { ...topo, id: crypto.randomUUID(), heightSamples: left, perimeterMm: leftPerim },
    { ...topo, id: crypto.randomUUID(), heightSamples: right, perimeterMm: rightPerim },
  ];
}

function sideOfPolyline(line: PointMm[], pt: PointMm): number {
  // Cross product with first segment of split line
  if (line.length < 2) return 1;
  const dx = line[1]!.xMm - line[0]!.xMm;
  const dy = line[1]!.yMm - line[0]!.yMm;
  return dx * (pt.yMm - line[0]!.yMm) - dy * (pt.xMm - line[0]!.xMm);
}

function boundingBoxPerimeter(pts: PointMm[]): PointMm[] {
  if (pts.length === 0) return [];
  const xs = pts.map((p) => p.xMm),
    ys = pts.map((p) => p.yMm);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  return [
    { xMm: minX, yMm: minY },
    { xMm: maxX, yMm: minY },
    { xMm: maxX, yMm: maxY },
    { xMm: minX, yMm: maxY },
  ];
}
