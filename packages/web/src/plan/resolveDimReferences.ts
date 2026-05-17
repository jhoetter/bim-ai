import type { DimWitnessPoint, Element } from '@bim-ai/core';

/**
 * For any witness point that has a referencedElementId, re-compute its position
 * from the referenced element's current geometry. Returns updated witness points.
 */
export function resolveDimReferences(
  witnessPoints: DimWitnessPoint[],
  elementsById: Record<string, Element>,
): DimWitnessPoint[] {
  return witnessPoints.map((pt) => {
    if (!pt.referencedElementId) return pt;
    const el = elementsById[pt.referencedElementId] as any;
    if (!el) return pt;

    // For walls: use startMm or endMm depending on referenceEdge
    if (el.kind === 'wall') {
      if (pt.referenceEdge === 'start') {
        return { ...pt, xMm: el.startMm?.xMm ?? pt.xMm, yMm: el.startMm?.yMm ?? pt.yMm };
      }
      if (pt.referenceEdge === 'end') {
        return { ...pt, xMm: el.endMm?.xMm ?? pt.xMm, yMm: el.endMm?.yMm ?? pt.yMm };
      }
    }

    // For columns: use positionMm
    if (el.kind === 'column' && el.positionMm) {
      return { ...pt, xMm: el.positionMm.xMm ?? pt.xMm, yMm: el.positionMm.yMm ?? pt.yMm };
    }

    return pt;
  });
}
