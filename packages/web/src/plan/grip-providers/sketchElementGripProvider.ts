/**
 * EDT-V3-13 — sketch-element grips for plan-region and stair-by-sketch shapes.
 */
import type { Element, StairTreadLine, XY } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

type PlanRegion = Extract<Element, { kind: 'plan_region' }>;
type Stair = Extract<Element, { kind: 'stair' }>;
export type SketchGrippable = PlanRegion | Stair;

function movePoint(point: XY, delta: XY): XY {
  return { xMm: point.xMm + delta.xMm, yMm: point.yMm + delta.yMm };
}

function replacePoint(points: XY[], index: number, next: XY): XY[] {
  return points.map((point, i) => (i === index ? next : point));
}

function midpoint(a: XY, b: XY): XY {
  return { xMm: (a.xMm + b.xMm) / 2, yMm: (a.yMm + b.yMm) / 2 };
}

function movePlanRegionVertex(region: PlanRegion, index: number, delta: XY): GripCommand {
  return {
    type: 'updatePlanRegion',
    id: region.id,
    outlineMm: replacePoint(region.outlineMm, index, movePoint(region.outlineMm[index]!, delta)),
  };
}

function movePlanRegionEdge(region: PlanRegion, index: number, delta: XY): GripCommand {
  const next = region.outlineMm.map((point, i) =>
    i === index || i === (index + 1) % region.outlineMm.length ? movePoint(point, delta) : point,
  );
  return { type: 'updatePlanRegion', id: region.id, outlineMm: next };
}

function moveStairBoundaryVertex(stair: Stair, index: number, delta: XY): GripCommand {
  const boundary = stair.boundaryMm ?? [];
  return {
    type: 'updateElementProperty',
    elementId: stair.id,
    key: 'boundaryMm',
    value: JSON.stringify(replacePoint(boundary, index, movePoint(boundary[index]!, delta))),
  };
}

function moveTreadLine(line: StairTreadLine, delta: XY): StairTreadLine {
  return {
    ...line,
    fromMm: movePoint(line.fromMm, delta),
    toMm: movePoint(line.toMm, delta),
    manualOverride: true,
  };
}

export const sketchElementGripProvider: ElementGripProvider<SketchGrippable> = {
  grips(element: SketchGrippable, _context: PlanContext): GripDescriptor[] {
    if (element.kind === 'plan_region') {
      const grips: GripDescriptor[] = [];
      element.outlineMm.forEach((point, index) => {
        grips.push({
          id: `${element.id}:sketch-vertex:${index}`,
          positionMm: point,
          shape: 'square',
          axis: 'free',
          hint: 'Drag sketch vertex',
          onDrag: () => ({ kind: 'unknown', id: element.id }),
          onCommit: (delta) => movePlanRegionVertex(element, index, delta),
          onNumericOverride: (absoluteMm) => {
            const next = { xMm: point.xMm + absoluteMm, yMm: point.yMm };
            return {
              type: 'updatePlanRegion',
              id: element.id,
              outlineMm: replacePoint(element.outlineMm, index, next),
            };
          },
        });
        const next = element.outlineMm[(index + 1) % element.outlineMm.length]!;
        grips.push({
          id: `${element.id}:sketch-edge:${index}`,
          positionMm: midpoint(point, next),
          shape: 'circle',
          axis: 'free',
          hint: 'Drag sketch edge',
          onDrag: () => ({ kind: 'unknown', id: element.id }),
          onCommit: (delta) => movePlanRegionEdge(element, index, delta),
          onNumericOverride: (absoluteMm) =>
            movePlanRegionEdge(element, index, { xMm: absoluteMm, yMm: 0 }),
        });
      });
      return grips;
    }

    if (element.authoringMode !== 'by_sketch') return [];
    const grips: GripDescriptor[] = [];
    const boundary = element.boundaryMm ?? [];
    boundary.forEach((point, index) => {
      grips.push({
        id: `${element.id}:sketch-boundary:${index}`,
        positionMm: point,
        shape: 'square',
        axis: 'free',
        hint: 'Drag stair sketch boundary',
        onDrag: () => ({ kind: 'unknown', id: element.id }),
        onCommit: (delta) => moveStairBoundaryVertex(element, index, delta),
        onNumericOverride: (absoluteMm) =>
          moveStairBoundaryVertex(element, index, { xMm: absoluteMm, yMm: 0 }),
      });
    });
    (element.treadLines ?? []).forEach((line, index) => {
      grips.push({
        id: `${element.id}:sketch-tread:${index}`,
        positionMm: midpoint(line.fromMm, line.toMm),
        shape: 'circle',
        axis: 'free',
        hint: 'Drag stair tread line',
        onDrag: () => ({ kind: 'unknown', id: element.id }),
        onCommit: (delta) => ({
          type: 'updateStairTreads',
          id: element.id,
          treadLines: (element.treadLines ?? []).map((candidate, i) =>
            i === index ? moveTreadLine(candidate, delta) : candidate,
          ),
        }),
        onNumericOverride: (absoluteMm) => ({
          type: 'updateStairTreads',
          id: element.id,
          treadLines: (element.treadLines ?? []).map((candidate, i) =>
            i === index ? moveTreadLine(candidate, { xMm: absoluteMm, yMm: 0 }) : candidate,
          ),
        }),
      });
    });
    return grips;
  },
};
