import type { Element, XY } from '@bim-ai/core';

import { coerceNumber, coerceXY, type WireRecord } from './primitives';

type BuildingElement =
  | Extract<Element, { kind: 'level' }>
  | Extract<Element, { kind: 'wall' }>
  | Extract<Element, { kind: 'door' }>
  | Extract<Element, { kind: 'window' }>
  | Extract<Element, { kind: 'grid_line' }>
  | Extract<Element, { kind: 'dimension' }>;

function coerceWallCurve(raw: unknown): Extract<Element, { kind: 'wall' }>['wallCurve'] {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as WireRecord;
  if (row.kind === 'bezier') {
    const rawPoints = row.controlPoints ?? row.control_points;
    if (!Array.isArray(rawPoints) || rawPoints.length !== 4) return null;
    const controlPoints = rawPoints.map((pt) =>
      pt && typeof pt === 'object' ? coerceXY(pt as WireRecord) : null,
    );
    if (controlPoints.some((pt) => pt == null)) return null;
    return { kind: 'bezier', controlPoints: controlPoints as [XY, XY, XY, XY] };
  }
  if (row.kind !== 'arc') return null;
  const centerRaw = row.center;
  const radiusMm = coerceNumber(row.radiusMm ?? row.radius_mm, NaN);
  const startAngleDeg = coerceNumber(row.startAngleDeg ?? row.start_angle_deg, NaN);
  const endAngleDeg = coerceNumber(row.endAngleDeg ?? row.end_angle_deg, NaN);
  const sweepDeg = coerceNumber(row.sweepDeg ?? row.sweep_deg, NaN);
  if (
    !centerRaw ||
    typeof centerRaw !== 'object' ||
    !Number.isFinite(radiusMm) ||
    radiusMm <= 0 ||
    !Number.isFinite(startAngleDeg) ||
    !Number.isFinite(endAngleDeg) ||
    !Number.isFinite(sweepDeg)
  ) {
    return null;
  }
  return {
    kind: 'arc',
    center: coerceXY(centerRaw as WireRecord),
    radiusMm,
    startAngleDeg,
    endAngleDeg,
    sweepDeg,
  };
}

function coerceDimensionAnchor(raw: unknown): Extract<Element, { kind: 'dimension' }>['anchorA'] {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as WireRecord;
  const kind = row.kind === 'feature' ? 'feature' : row.kind === 'free' ? 'free' : null;
  if (!kind) return null;
  const fallbackRaw = row.fallbackPositionMm ?? row.fallback_position_mm;
  if (!fallbackRaw || typeof fallbackRaw !== 'object') return null;
  const fallbackPositionMm = coerceXY(fallbackRaw);
  const featureRaw = row.feature;
  if (kind === 'feature') {
    if (!featureRaw || typeof featureRaw !== 'object') return null;
    const feature = featureRaw as WireRecord;
    const anchor = feature.anchor;
    if (
      typeof feature.elementId !== 'string' ||
      (anchor !== 'start' && anchor !== 'end' && anchor !== 'mid' && anchor !== 'center')
    ) {
      return null;
    }
    return { kind, feature: { elementId: feature.elementId, anchor }, fallbackPositionMm };
  }
  return { kind, fallbackPositionMm };
}

function coerceMonitorSource(raw: WireRecord): {
  linkId?: string | null;
  elementId: string;
  sourceRevisionAtCopy: number;
  drifted?: boolean;
  driftedFields?: string[];
} {
  const linkId = raw.linkId ?? raw.link_id;
  const driftedFieldsRaw = raw.driftedFields ?? raw.drifted_fields;
  const driftedFields = Array.isArray(driftedFieldsRaw)
    ? driftedFieldsRaw.map((field) => String(field))
    : [];
  return {
    ...(linkId ? { linkId: String(linkId) } : {}),
    elementId: String(raw.elementId ?? raw.element_id ?? ''),
    sourceRevisionAtCopy: coerceNumber(raw.sourceRevisionAtCopy ?? raw.source_revision_at_copy, 0),
    ...(raw.drifted ? { drifted: true } : {}),
    ...(driftedFields.length ? { driftedFields } : {}),
  };
}

function coerceOptionalString(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.length ? raw : undefined;
}

function coerceOpeningShared(raw: WireRecord): {
  familyTypeId?: string;
  materialKey?: string;
  hostCutDepthMm?: number;
  revealInteriorMm?: number;
  interlockGrade?: string;
  lodPlan?: 'simple' | 'detailed';
} {
  return {
    ...(raw.familyTypeId || raw.family_type_id
      ? { familyTypeId: String(raw.familyTypeId ?? raw.family_type_id) }
      : {}),
    ...(typeof raw.materialKey === 'string' || typeof raw.material_key === 'string'
      ? { materialKey: String(raw.materialKey ?? raw.material_key) }
      : {}),
    ...(raw.hostCutDepthMm !== undefined
      ? { hostCutDepthMm: coerceNumber(raw.hostCutDepthMm, 0) }
      : {}),
    ...(raw.revealInteriorMm !== undefined
      ? { revealInteriorMm: coerceNumber(raw.revealInteriorMm, 0) }
      : {}),
    ...(typeof raw.interlockGrade === 'string' ? { interlockGrade: raw.interlockGrade } : {}),
    ...(raw.lodPlan === 'simple' || raw.lodPlan === 'detailed' ? { lodPlan: raw.lodPlan } : {}),
  };
}

function coerceLevel(
  id: string,
  name: string,
  raw: WireRecord,
): Extract<Element, { kind: 'level' }> {
  return {
    kind: 'level',
    id,
    name,
    elevationMm: coerceNumber(raw.elevationMm ?? raw.elevation_mm, 0),
    ...(coerceOptionalString(raw.datumKind ?? raw.datum_kind)
      ? { datumKind: String(raw.datumKind ?? raw.datum_kind) }
      : {}),
    ...(typeof raw.parentLevelId === 'string' || typeof raw.parent_level_id === 'string'
      ? { parentLevelId: String(raw.parentLevelId ?? raw.parent_level_id) }
      : {}),
    offsetFromParentMm: coerceNumber(raw.offsetFromParentMm ?? raw.offset_from_parent_mm, 0),
    ...((raw.worksetId ?? raw.workset_id)
      ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
      : {}),
    ...((raw.monitorSourceId ?? raw.monitor_source_id)
      ? { monitorSourceId: String(raw.monitorSourceId ?? raw.monitor_source_id) }
      : {}),
    ...((raw.monitorSource ?? raw.monitor_source)
      ? {
          monitorSource: coerceMonitorSource(
            (raw.monitorSource ?? raw.monitor_source) as WireRecord,
          ),
        }
      : {}),
  };
}

function coerceWall(id: string, name: string, raw: WireRecord): Extract<Element, { kind: 'wall' }> {
  return {
    kind: 'wall',
    id,
    name,
    levelId: String(raw.levelId ?? ''),
    start: coerceXY(raw.start),
    end: coerceXY(raw.end),
    ...(raw.wallCurve || raw.wall_curve
      ? { wallCurve: coerceWallCurve(raw.wallCurve ?? raw.wall_curve) }
      : {}),
    thicknessMm: coerceNumber(raw.thicknessMm ?? raw.thickness_mm, 200),
    heightMm: coerceNumber(raw.heightMm ?? raw.height_mm, 2800),
    ...(typeof raw.materialKey === 'string' || typeof raw.material_key === 'string'
      ? { materialKey: String(raw.materialKey ?? raw.material_key) }
      : {}),
    ...(raw.wallTypeId || raw.wall_type_id
      ? { wallTypeId: String(raw.wallTypeId ?? raw.wall_type_id) }
      : {}),
    ...(raw.baseConstraintLevelId || raw.base_constraint_level_id
      ? { baseConstraintLevelId: String(raw.baseConstraintLevelId ?? raw.base_constraint_level_id) }
      : {}),
    ...(raw.topConstraintLevelId || raw.top_constraint_level_id
      ? { topConstraintLevelId: String(raw.topConstraintLevelId ?? raw.top_constraint_level_id) }
      : {}),
    ...(raw.topConstraintHostId || raw.top_constraint_host_id
      ? { topConstraintHostId: String(raw.topConstraintHostId ?? raw.top_constraint_host_id) }
      : {}),
    ...(raw.topConstraintHostFace || raw.top_constraint_host_face
      ? {
          topConstraintHostFace: String(
            raw.topConstraintHostFace ?? raw.top_constraint_host_face,
          ) as 'bottom' | 'top',
        }
      : {}),
    baseConstraintOffsetMm: coerceNumber(
      raw.baseConstraintOffsetMm ?? raw.base_constraint_offset_mm,
      0,
    ),
    topConstraintOffsetMm: coerceNumber(
      raw.topConstraintOffsetMm ?? raw.top_constraint_offset_mm,
      0,
    ),
    ...(raw.roofAttachmentId || raw.roof_attachment_id
      ? { roofAttachmentId: String(raw.roofAttachmentId ?? raw.roof_attachment_id) }
      : {}),
    insulationExtensionMm: coerceNumber(
      raw.insulationExtensionMm ?? raw.insulation_extension_mm,
      0,
    ),
    ...(raw.isCurtainWall != null || raw.is_curtain_wall != null
      ? { isCurtainWall: Boolean(raw.isCurtainWall ?? raw.is_curtain_wall) }
      : {}),
    ...(raw.curtainWallPanelType || raw.curtain_wall_panel_type
      ? { curtainWallPanelType: String(raw.curtainWallPanelType ?? raw.curtain_wall_panel_type) }
      : {}),
    ...(raw.curtainWallMullionType || raw.curtain_wall_mullion_type
      ? {
          curtainWallMullionType: String(
            raw.curtainWallMullionType ?? raw.curtain_wall_mullion_type,
          ),
        }
      : {}),
    ...(raw.locationLine || raw.location_line
      ? {
          locationLine: String(
            raw.locationLine ?? raw.location_line,
          ) as import('@bim-ai/core').WallLocationLine,
        }
      : {}),
    ...((raw.worksetId ?? raw.workset_id)
      ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
      : {}),
    ...(raw.floorEdgeStripDisabled != null || raw.floor_edge_strip_disabled != null
      ? {
          floorEdgeStripDisabled: Boolean(
            raw.floorEdgeStripDisabled ?? raw.floor_edge_strip_disabled,
          ),
        }
      : {}),
    ...(Array.isArray(raw.recessZones) || Array.isArray(raw.recess_zones)
      ? {
          recessZones: ((raw.recessZones ?? raw.recess_zones) as WireRecord[])
            .map((zone) => {
              const start = coerceNumber(zone.alongTStart ?? zone.along_t_start, NaN);
              const end = coerceNumber(zone.alongTEnd ?? zone.along_t_end, NaN);
              const setback = coerceNumber(zone.setbackMm ?? zone.setback_mm, NaN);
              if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(setback)) {
                return null;
              }
              return {
                alongTStart: start,
                alongTEnd: end,
                setbackMm: setback,
                ...(zone.sillHeightMm != null || zone.sill_height_mm != null
                  ? { sillHeightMm: coerceNumber(zone.sillHeightMm ?? zone.sill_height_mm, 0) }
                  : {}),
                ...(zone.headHeightMm != null || zone.head_height_mm != null
                  ? { headHeightMm: coerceNumber(zone.headHeightMm ?? zone.head_height_mm, 0) }
                  : {}),
                ...(zone.floorContinues != null || zone.floor_continues != null
                  ? { floorContinues: Boolean(zone.floorContinues ?? zone.floor_continues) }
                  : {}),
              };
            })
            .filter((zone): zone is NonNullable<typeof zone> => zone !== null),
        }
      : {}),
  };
}

export function coerceBuildingElement(
  id: string,
  name: string,
  raw: WireRecord,
): BuildingElement | null {
  switch (raw.kind) {
    case 'level':
      return coerceLevel(id, name, raw);
    case 'wall':
      return coerceWall(id, name, raw);
    case 'door':
      return {
        kind: 'door',
        id,
        name,
        wallId: String(raw.wallId ?? ''),
        alongT: coerceNumber(raw.alongT, 0),
        widthMm: coerceNumber(raw.widthMm, 900),
        ...coerceOpeningShared(raw),
        ...(typeof raw.operationType === 'string' || typeof raw.operation_type === 'string'
          ? {
              operationType: String(raw.operationType ?? raw.operation_type) as Extract<
                Element,
                { kind: 'door' }
              >['operationType'],
            }
          : {}),
        ...(typeof raw.slidingTrackSide === 'string' || typeof raw.sliding_track_side === 'string'
          ? {
              slidingTrackSide: String(raw.slidingTrackSide ?? raw.sliding_track_side) as Extract<
                Element,
                { kind: 'door' }
              >['slidingTrackSide'],
            }
          : {}),
      };
    case 'window':
      return {
        kind: 'window',
        id,
        name,
        wallId: String(raw.wallId ?? ''),
        alongT: coerceNumber(raw.alongT, 0),
        widthMm: coerceNumber(raw.widthMm, 1200),
        sillHeightMm: coerceNumber(raw.sillHeightMm ?? raw.sill_height_mm, 900),
        heightMm: coerceNumber(raw.heightMm ?? raw.height_mm, 1500),
        ...coerceOpeningShared(raw),
        ...(raw.sealRebateMm !== undefined
          ? { sealRebateMm: coerceNumber(raw.sealRebateMm, 0) }
          : {}),
        ...(typeof raw.outlineKind === 'string' || typeof raw.outline_kind === 'string'
          ? {
              outlineKind: String(raw.outlineKind ?? raw.outline_kind) as Extract<
                Element,
                { kind: 'window' }
              >['outlineKind'],
            }
          : {}),
        ...(typeof raw.attachedRoofId === 'string' || typeof raw.attached_roof_id === 'string'
          ? { attachedRoofId: String(raw.attachedRoofId ?? raw.attached_roof_id) }
          : {}),
      };
    case 'grid_line': {
      const levelId = raw.levelId ?? raw.level_id;
      return {
        kind: 'grid_line',
        id,
        name,
        label: typeof raw.label === 'string' ? raw.label : '',
        start: coerceXY(raw.start),
        end: coerceXY(raw.end),
        levelId: typeof levelId === 'string' ? levelId : null,
        ...((raw.worksetId ?? raw.workset_id)
          ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
          : {}),
        ...((raw.monitorSourceId ?? raw.monitor_source_id)
          ? { monitorSourceId: String(raw.monitorSourceId ?? raw.monitor_source_id) }
          : {}),
        ...((raw.monitorSource ?? raw.monitor_source)
          ? {
              monitorSource: coerceMonitorSource(
                (raw.monitorSource ?? raw.monitor_source) as WireRecord,
              ),
            }
          : {}),
      };
    }
    case 'dimension':
      return {
        kind: 'dimension',
        id,
        name,
        levelId: String(raw.levelId ?? ''),
        aMm: coerceXY(raw.aMm ?? raw.a_mm ?? {}),
        bMm: coerceXY(raw.bMm ?? raw.b_mm ?? {}),
        offsetMm: coerceXY(raw.offsetMm ?? raw.offset_mm ?? {}),
        anchorA: coerceDimensionAnchor(raw.anchorA ?? raw.anchor_a),
        anchorB: coerceDimensionAnchor(raw.anchorB ?? raw.anchor_b),
        state:
          raw.state === 'linked' || raw.state === 'partial' || raw.state === 'unlinked'
            ? raw.state
            : undefined,
        refElementIdA:
          typeof raw.refElementIdA === 'string'
            ? raw.refElementIdA
            : typeof raw.ref_element_id_a === 'string'
              ? raw.ref_element_id_a
              : null,
        refElementIdB:
          typeof raw.refElementIdB === 'string'
            ? raw.refElementIdB
            : typeof raw.ref_element_id_b === 'string'
              ? raw.ref_element_id_b
              : null,
        tagDefinitionId:
          typeof raw.tagDefinitionId === 'string'
            ? raw.tagDefinitionId
            : typeof raw.tag_definition_id === 'string'
              ? raw.tag_definition_id
              : null,
      };
    default:
      return null;
  }
}
