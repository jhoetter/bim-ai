import type { Element } from '@bim-ai/core';

import { coerceLoop, coerceNumber, coerceXY, coerceXYZ, type WireRecord } from './primitives';

type SiteElement = Extract<
  Element,
  {
    kind: 'toposolid' | 'toposolid_subdivision' | 'graded_region' | 'toposolid_excavation';
  }
>;

function readHeightmapGrid(
  raw: WireRecord,
): Extract<Element, { kind: 'toposolid' }>['heightmapGridMm'] {
  const gridRaw = raw.heightmapGridMm ?? raw.heightmap_grid_mm;
  const grid = gridRaw && typeof gridRaw === 'object' ? (gridRaw as WireRecord) : null;
  if (!grid) return undefined;
  return {
    stepMm: coerceNumber(grid.stepMm ?? grid.step_mm, 0),
    rows: coerceNumber(grid.rows, 0),
    cols: coerceNumber(grid.cols, 0),
    values: Array.isArray(grid.values) ? grid.values.map((value) => coerceNumber(value, 0)) : [],
  };
}

function coerceToposolid(id: string, name: string, raw: WireRecord): SiteElement {
  const samplesRaw = raw.heightSamples ?? raw.height_samples;
  const heightSamples = Array.isArray(samplesRaw) ? samplesRaw.map(coerceXYZ) : [];
  const heightmapGridMm = readHeightmapGrid(raw);
  return {
    kind: 'toposolid',
    id,
    name,
    boundaryMm: coerceLoop(raw, 'boundaryMm', 'boundary_mm'),
    heightSamples,
    ...(heightmapGridMm ? { heightmapGridMm } : {}),
    thicknessMm: coerceNumber(raw.thicknessMm ?? raw.thickness_mm, 1500),
    ...(raw.baseElevationMm !== undefined || raw.base_elevation_mm !== undefined
      ? { baseElevationMm: coerceNumber(raw.baseElevationMm ?? raw.base_elevation_mm, 0) }
      : {}),
    ...(raw.defaultMaterialKey || raw.default_material_key
      ? { defaultMaterialKey: String(raw.defaultMaterialKey ?? raw.default_material_key) }
      : {}),
    pinned: Boolean(raw.pinned ?? false),
    ...(raw.phaseCreated || raw.phase_created
      ? { phaseCreated: String(raw.phaseCreated ?? raw.phase_created) }
      : {}),
    ...(raw.phaseDemolished || raw.phase_demolished
      ? { phaseDemolished: String(raw.phaseDemolished ?? raw.phase_demolished) }
      : {}),
    ...(raw.discipline ? { discipline: String(raw.discipline) } : {}),
  };
}

function coerceToposolidSubdivision(id: string, name: string, raw: WireRecord): SiteElement {
  return {
    kind: 'toposolid_subdivision',
    id,
    name,
    hostToposolidId: String(raw.hostToposolidId ?? raw.host_toposolid_id ?? ''),
    boundaryMm: coerceLoop(raw, 'boundaryMm', 'boundary_mm'),
    finishCategory: String(raw.finishCategory ?? raw.finish_category ?? 'other') as
      | 'paving'
      | 'lawn'
      | 'road'
      | 'planting'
      | 'other',
    materialKey: String(raw.materialKey ?? raw.material_key ?? ''),
  };
}

function coerceGradedRegion(id: string, raw: WireRecord): SiteElement {
  return {
    kind: 'graded_region',
    id,
    hostToposolidId: String(raw.hostToposolidId ?? raw.host_toposolid_id ?? ''),
    boundaryMm: coerceLoop(raw, 'boundaryMm', 'boundary_mm'),
    targetMode: String(raw.targetMode ?? raw.target_mode ?? 'flat') as 'flat' | 'slope',
    ...(raw.targetZMm !== undefined || raw.target_z_mm !== undefined
      ? { targetZMm: coerceNumber(raw.targetZMm ?? raw.target_z_mm, 0) }
      : {}),
    ...(raw.slopeAxisDeg !== undefined || raw.slope_axis_deg !== undefined
      ? { slopeAxisDeg: coerceNumber(raw.slopeAxisDeg ?? raw.slope_axis_deg, 0) }
      : {}),
    ...(raw.slopeDegPercent !== undefined || raw.slope_deg_percent !== undefined
      ? { slopeDegPercent: coerceNumber(raw.slopeDegPercent ?? raw.slope_deg_percent, 0) }
      : {}),
  };
}

function coerceToposolidExcavation(id: string, raw: WireRecord): SiteElement {
  return {
    kind: 'toposolid_excavation',
    id,
    hostToposolidId: String(raw.hostToposolidId ?? raw.host_toposolid_id ?? ''),
    cutterElementId: String(raw.cutterElementId ?? raw.cutter_element_id ?? ''),
    cutMode: String(raw.cutMode ?? raw.cut_mode ?? 'to_bottom_of_cutter') as
      | 'to_top_of_cutter'
      | 'to_bottom_of_cutter'
      | 'custom_depth',
    offsetMm: coerceNumber(raw.offsetMm ?? raw.offset_mm, 0),
    ...(raw.customDepthMm !== undefined || raw.custom_depth_mm !== undefined
      ? { customDepthMm: coerceNumber(raw.customDepthMm ?? raw.custom_depth_mm, 0) }
      : {}),
    ...(raw.estimatedVolumeM3 !== undefined || raw.estimated_volume_m3 !== undefined
      ? { estimatedVolumeM3: coerceNumber(raw.estimatedVolumeM3 ?? raw.estimated_volume_m3, 0) }
      : {}),
    ...(Array.isArray(raw.boundaryMm) || Array.isArray(raw.boundary_mm)
      ? { boundaryMm: ((raw.boundaryMm ?? raw.boundary_mm) as unknown[]).map(coerceXY) }
      : {}),
    ...(raw.depthMm !== undefined || raw.depth_mm !== undefined
      ? { depthMm: coerceNumber(raw.depthMm ?? raw.depth_mm, 0) }
      : {}),
  };
}

export function coerceSiteElement(id: string, name: string, raw: WireRecord): SiteElement | null {
  switch (raw.kind) {
    case 'toposolid':
      return coerceToposolid(id, name, raw);
    case 'toposolid_subdivision':
      return coerceToposolidSubdivision(id, name, raw);
    case 'graded_region':
      return coerceGradedRegion(id, raw);
    case 'toposolid_excavation':
      return coerceToposolidExcavation(id, raw);
    default:
      return null;
  }
}
