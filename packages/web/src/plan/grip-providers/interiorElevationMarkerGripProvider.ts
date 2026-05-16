/**
 * D2 — grip provider for interior_elevation_marker elements.
 *
 * Single circle grip at positionMm to drag the whole marker.
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type InteriorElevationMarker = Extract<Element, { kind: 'interior_elevation_marker' }>;

export const interiorElevationMarkerGripProvider: ElementGripProvider<InteriorElevationMarker> = {
  grips(el: InteriorElevationMarker, _ctx: PlanContext): GripDescriptor[] {
    const positionGrip: GripDescriptor = {
      id: `${el.id}:position`,
      positionMm: el.positionMm,
      shape: 'circle',
      axis: 'free',
      hint: 'Drag to move elevation marker',
      onDrag: () => ({ kind: 'unknown', id: el.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: el.id,
        key: 'positionMm',
        value: JSON.stringify({
          xMm: el.positionMm.xMm + delta.xMm,
          yMm: el.positionMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => ({
        type: 'updateElementProperty',
        elementId: el.id,
        key: 'positionMm',
        value: JSON.stringify({ xMm: absoluteMm, yMm: el.positionMm.yMm }),
      }),
    };
    return [positionGrip];
  },
};
