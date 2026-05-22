import type { DisciplineTag, XY } from '../index';

export type WallOpeningElement = {
  kind: 'wall_opening';
  id: string;
  name?: string;
  hostWallId: string;
  alongTStart: number;
  alongTEnd: number;
  sillHeightMm: number;
  headHeightMm: number;
  /** DSC-V3-01: discipline tag. */
  discipline?: DisciplineTag | null;
  /** SCH-V3-01: custom property values. */
  props?: Record<string, unknown>;
};

export type SlabOpeningElement = {
  kind: 'slab_opening';
  id: string;
  name: string;
  hostFloorId: string;
  boundaryMm: XY[];
  isShaft?: boolean;
  pinned?: boolean;
};

/** IFC-03: opening hosted on a roof (skylight / roof penetration). */
export type RoofOpeningElement = {
  kind: 'roof_opening';
  id: string;
  name: string;
  hostRoofId: string;
  boundaryMm: XY[];
  pinned?: boolean;
};
