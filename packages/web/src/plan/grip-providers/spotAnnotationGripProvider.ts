/**
 * ANN-04–ANN-09 — grip providers for auxiliary annotation elements.
 *
 * angular_dimension: position grip at vertex.
 * radial_dimension / diameter_dimension: grip at arcPointMm.
 * arc_length_dimension: grip at arc midpoint (computed from angles + radius).
 * spot_elevation / spot_coordinate / spot_slope: single position grip.
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type AngularDimension = Extract<Element, { kind: 'angular_dimension' }>;
export type RadialDimension = Extract<Element, { kind: 'radial_dimension' }>;
export type DiameterDimension = Extract<Element, { kind: 'diameter_dimension' }>;
export type ArcLengthDimension = Extract<Element, { kind: 'arc_length_dimension' }>;
export type SpotElevation = Extract<Element, { kind: 'spot_elevation' }>;
export type SpotCoordinate = Extract<Element, { kind: 'spot_coordinate' }>;
export type SpotSlope = Extract<Element, { kind: 'spot_slope' }>;

function positionGrip(
  id: string,
  elementId: string,
  positionMm: { xMm: number; yMm: number },
  propKey: string,
  hint: string,
): GripDescriptor {
  return {
    id,
    positionMm,
    shape: 'square',
    axis: 'free',
    hint,
    onDrag: () => ({ kind: 'unknown', id: elementId }),
    onCommit: (delta): GripCommand => ({
      type: 'updateElementProperty',
      elementId,
      key: propKey,
      value: JSON.stringify({
        xMm: positionMm.xMm + delta.xMm,
        yMm: positionMm.yMm + delta.yMm,
      }),
    }),
    onNumericOverride: (absoluteMm): GripCommand => ({
      type: 'updateElementProperty',
      elementId,
      key: propKey,
      value: JSON.stringify({ xMm: absoluteMm, yMm: positionMm.yMm }),
    }),
  };
}

export const angularDimensionGripProvider: ElementGripProvider<AngularDimension> = {
  grips(el: AngularDimension, _ctx: PlanContext): GripDescriptor[] {
    const grips: GripDescriptor[] = [
      positionGrip(`${el.id}:vertex`, el.id, el.vertexMm, 'vertexMm', 'Drag angular dim vertex'),
    ];

    // Arc-offset grip along the bisector of the two rays.
    const rayA = { xMm: el.rayAMm.xMm - el.vertexMm.xMm, yMm: el.rayAMm.yMm - el.vertexMm.yMm };
    const rayB = { xMm: el.rayBMm.xMm - el.vertexMm.xMm, yMm: el.rayBMm.yMm - el.vertexMm.yMm };
    const magA = Math.hypot(rayA.xMm, rayA.yMm);
    const magB = Math.hypot(rayB.xMm, rayB.yMm);
    if (magA > 0 && magB > 0) {
      const normA = { xMm: rayA.xMm / magA, yMm: rayA.yMm / magA };
      const normB = { xMm: rayB.xMm / magB, yMm: rayB.yMm / magB };
      const bisector = { xMm: normA.xMm + normB.xMm, yMm: normA.yMm + normB.yMm };
      const bisectorMag = Math.hypot(bisector.xMm, bisector.yMm);
      if (bisectorMag > 0) {
        const nb = { xMm: bisector.xMm / bisectorMag, yMm: bisector.yMm / bisectorMag };
        const offsetDist = el.offsetMm
          ? Math.hypot(el.offsetMm.xMm, el.offsetMm.yMm)
          : (el.arcRadiusMm ?? 200);
        const arcGripPos = {
          xMm: el.vertexMm.xMm + nb.xMm * offsetDist,
          yMm: el.vertexMm.yMm + nb.yMm * offsetDist,
        };
        const baseOffsetX = el.offsetMm?.xMm ?? nb.xMm * offsetDist;
        const baseOffsetY = el.offsetMm?.yMm ?? nb.yMm * offsetDist;
        grips.push({
          id: `${el.id}:arc-offset`,
          positionMm: arcGripPos,
          shape: 'circle',
          axis: 'free',
          hint: 'Drag to adjust arc offset',
          onDrag: () => ({ kind: 'unknown', id: el.id }),
          onCommit: (delta): GripCommand => ({
            type: 'updateElementProperty',
            elementId: el.id,
            key: 'offsetMm',
            value: JSON.stringify({
              xMm: baseOffsetX + delta.xMm,
              yMm: baseOffsetY + delta.yMm,
            }),
          }),
          onNumericOverride: (absoluteMm): GripCommand => ({
            type: 'updateElementProperty',
            elementId: el.id,
            key: 'offsetMm',
            value: JSON.stringify({ xMm: absoluteMm, yMm: el.offsetMm?.yMm ?? 0 }),
          }),
        });
      }
    }

    return grips;
  },
};

export const radialDimensionGripProvider: ElementGripProvider<RadialDimension> = {
  grips(el: RadialDimension, _ctx: PlanContext): GripDescriptor[] {
    return [
      positionGrip(`${el.id}:arc`, el.id, el.arcPointMm, 'arcPointMm', 'Drag radial dim endpoint'),
    ];
  },
};

export const diameterDimensionGripProvider: ElementGripProvider<DiameterDimension> = {
  grips(el: DiameterDimension, _ctx: PlanContext): GripDescriptor[] {
    return [
      positionGrip(
        `${el.id}:arc`,
        el.id,
        el.arcPointMm,
        'arcPointMm',
        'Drag diameter dim endpoint',
      ),
    ];
  },
};

export const arcLengthDimensionGripProvider: ElementGripProvider<ArcLengthDimension> = {
  grips(el: ArcLengthDimension, _ctx: PlanContext): GripDescriptor[] {
    return [positionGrip(`${el.id}:center`, el.id, el.centerMm, 'centerMm', 'Drag arc dim center')];
  },
};

export const spotElevationGripProvider: ElementGripProvider<SpotElevation> = {
  grips(el: SpotElevation, _ctx: PlanContext): GripDescriptor[] {
    return [
      positionGrip(`${el.id}:position`, el.id, el.positionMm, 'positionMm', 'Drag spot elevation'),
    ];
  },
};

export const spotCoordinateGripProvider: ElementGripProvider<SpotCoordinate> = {
  grips(el: SpotCoordinate, _ctx: PlanContext): GripDescriptor[] {
    return [
      positionGrip(`${el.id}:position`, el.id, el.positionMm, 'positionMm', 'Drag spot coordinate'),
    ];
  },
};

export const spotSlopeGripProvider: ElementGripProvider<SpotSlope> = {
  grips(el: SpotSlope, _ctx: PlanContext): GripDescriptor[] {
    return [
      positionGrip(
        `${el.id}:position`,
        el.id,
        el.positionMm,
        'positionMm',
        'Drag slope annotation',
      ),
    ];
  },
};
