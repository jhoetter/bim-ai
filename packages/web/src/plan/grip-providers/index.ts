/**
 * EDT-01 — grip provider registry.
 *
 * Single dispatch point used by PlanCanvas to fetch grips for a
 * selected element. Providers are pure functions of `(element,
 * context)` so callers can also import a specific provider for unit
 * tests without going through the registry.
 */
import type { Element } from '@bim-ai/core';

import { wallGripProvider } from '../gripProtocol';
import type { GripDescriptor, PlanContext } from '../gripProtocol';

import { beamGripProvider } from './beamGripProvider';
import { columnGripProvider } from './columnGripProvider';
import { dimensionGripProvider } from './dimensionGripProvider';
import { doorGripProvider } from './doorGripProvider';
import { floorGripProvider } from './floorGripProvider';
import { maskingRegionGripProvider } from './maskingRegionGripProvider';
import { placedAssetGripProvider } from './placedAssetGripProvider';
import { referencePlaneGripProvider } from './referencePlaneGripProvider';
import { sectionCutGripProvider } from './sectionCutGripProvider';
import { sketchElementGripProvider } from './sketchElementGripProvider';
import { windowGripProvider } from './windowGripProvider';
import { textNoteGripProvider, leaderTextGripProvider } from './annotationGripProvider';
import {
  angularDimensionGripProvider,
  radialDimensionGripProvider,
  diameterDimensionGripProvider,
  arcLengthDimensionGripProvider,
  spotElevationGripProvider,
  spotCoordinateGripProvider,
  spotSlopeGripProvider,
} from './spotAnnotationGripProvider';

export {
  beamGripProvider,
  columnGripProvider,
  dimensionGripProvider,
  doorGripProvider,
  floorGripProvider,
  maskingRegionGripProvider,
  placedAssetGripProvider,
  referencePlaneGripProvider,
  sectionCutGripProvider,
  sketchElementGripProvider,
  windowGripProvider,
  textNoteGripProvider,
  leaderTextGripProvider,
  angularDimensionGripProvider,
  radialDimensionGripProvider,
  diameterDimensionGripProvider,
  arcLengthDimensionGripProvider,
  spotElevationGripProvider,
  spotCoordinateGripProvider,
  spotSlopeGripProvider,
};

export function gripsFor(element: Element, context: PlanContext = {}): GripDescriptor[] {
  switch (element.kind) {
    case 'wall':
      return wallGripProvider.grips(element, context);
    case 'door':
      return doorGripProvider.grips(element, context);
    case 'window':
      return windowGripProvider.grips(element, context);
    case 'floor':
      return floorGripProvider.grips(element, context);
    case 'masking_region':
      return maskingRegionGripProvider.grips(element, context);
    case 'column':
      return columnGripProvider.grips(element, context);
    case 'beam':
      return beamGripProvider.grips(element, context);
    case 'section_cut':
      return sectionCutGripProvider.grips(element, context);
    case 'dimension':
      return dimensionGripProvider.grips(element, context);
    case 'reference_plane':
      return referencePlaneGripProvider.grips(element, context);
    case 'placed_asset':
      return placedAssetGripProvider.grips(element, context);
    case 'plan_region':
    case 'stair':
      return sketchElementGripProvider.grips(element, context);
    case 'text_note':
      return textNoteGripProvider.grips(element, context);
    case 'leader_text':
      return leaderTextGripProvider.grips(element, context);
    case 'angular_dimension':
      return angularDimensionGripProvider.grips(element, context);
    case 'radial_dimension':
      return radialDimensionGripProvider.grips(element, context);
    case 'diameter_dimension':
      return diameterDimensionGripProvider.grips(element, context);
    case 'arc_length_dimension':
      return arcLengthDimensionGripProvider.grips(element, context);
    case 'spot_elevation':
      return spotElevationGripProvider.grips(element, context);
    case 'spot_coordinate':
      return spotCoordinateGripProvider.grips(element, context);
    case 'spot_slope':
      return spotSlopeGripProvider.grips(element, context);
    default:
      return [];
  }
}
