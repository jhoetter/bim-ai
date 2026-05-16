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
    return [
      positionGrip(`${el.id}:vertex`, el.id, el.vertexMm, 'vertexMm', 'Drag angular dim vertex'),
    ];
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
