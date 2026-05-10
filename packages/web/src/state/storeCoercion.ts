import type { Element, EvidenceRef, EvidenceRefKind, Violation, XY } from '@bim-ai/core';
import { coerceCheckpointRetentionLimit } from './backupRetention';
import type { ViewFilter } from './storeTypes';

export function coerceViolation(v: unknown): Violation {
  const vv = v as Record<string, unknown>;
  const ruleId =
    typeof vv.ruleId === 'string' ? vv.ruleId : typeof vv.rule_id === 'string' ? vv.rule_id : '';
  const sev = vv.severity as string | undefined;
  const severity =
    sev === 'error' || sev === 'warning' || sev === 'info' ? sev : ('warning' as const);
  const elementIdsRaw = vv.elementIds ?? vv.element_ids;
  const elementIds =
    Array.isArray(elementIdsRaw) && elementIdsRaw.every((x) => typeof x === 'string')
      ? elementIdsRaw
      : [];
  const message = typeof vv.message === 'string' ? vv.message : '';
  const blocking = typeof vv.blocking === 'boolean' ? vv.blocking : undefined;
  const disciplineRaw = vv.discipline ?? vv.Discipline;
  const discipline =
    typeof disciplineRaw === 'string' && disciplineRaw.length ? disciplineRaw : undefined;
  const qf = vv.quickFixCommand ?? vv.quick_fix_command;

  const quickFixCommand =
    qf !== undefined && qf !== null && typeof qf === 'object'
      ? (qf as Record<string, unknown>)
      : null;

  return {
    ruleId,
    severity: severity as Violation['severity'],
    message,
    elementIds,

    ...(blocking !== undefined ? { blocking } : {}),

    ...(discipline !== undefined ? { discipline } : {}),

    ...(quickFixCommand ? { quickFixCommand } : {}),
  };
}

function coerceXY(raw: Record<string, unknown>): { xMm: number; yMm: number } {
  return {
    xMm: Number(raw.xMm ?? raw.x_mm ?? 0),
    yMm: Number(raw.yMm ?? raw.y_mm ?? 0),
  };
}

function coerceWallCurve(raw: unknown): Extract<Element, { kind: 'wall' }>['wallCurve'] {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.kind !== 'arc') return null;
  const centerRaw = row.center;
  const radiusMm = Number(row.radiusMm ?? row.radius_mm);
  const startAngleDeg = Number(row.startAngleDeg ?? row.start_angle_deg);
  const endAngleDeg = Number(row.endAngleDeg ?? row.end_angle_deg);
  const sweepDeg = Number(row.sweepDeg ?? row.sweep_deg);
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
    center: coerceXY(centerRaw as Record<string, unknown>),
    radiusMm,
    startAngleDeg,
    endAngleDeg,
    sweepDeg,
  };
}

function coerceXYZ(raw: Record<string, unknown>): { xMm: number; yMm: number; zMm: number } {
  return {
    xMm: Number(raw.xMm ?? raw.x_mm ?? 0),
    yMm: Number(raw.yMm ?? raw.y_mm ?? 0),
    zMm: Number(raw.zMm ?? raw.z_mm ?? 0),
  };
}

function coerceMonitorSource(raw: Record<string, unknown>): {
  linkId?: string | null;
  elementId: string;
  sourceRevisionAtCopy: number;
  drifted?: boolean;
  driftedFields?: string[];
} {
  const linkId = (raw.linkId ?? raw.link_id) as string | null | undefined;
  const elementId = String(raw.elementId ?? raw.element_id ?? '');
  const sourceRevisionAtCopy = Number(raw.sourceRevisionAtCopy ?? raw.source_revision_at_copy ?? 0);
  const drifted = Boolean(raw.drifted);
  const driftedFieldsRaw = raw.driftedFields ?? raw.drifted_fields;
  const driftedFields = Array.isArray(driftedFieldsRaw)
    ? driftedFieldsRaw.map((s) => String(s))
    : [];
  return {
    ...(linkId ? { linkId: String(linkId) } : {}),
    elementId,
    sourceRevisionAtCopy,
    ...(drifted ? { drifted: true } : {}),
    ...(driftedFields.length ? { driftedFields } : {}),
  };
}

const _EVIDENCE_REF_KINDS = new Set<EvidenceRefKind>([
  'sheet',
  'viewpoint',
  'plan_view',
  'section_cut',
  'deterministic_png',
]);

function coerceEvidenceRefs(rawUnknown: unknown): EvidenceRef[] {
  if (!Array.isArray(rawUnknown)) return [];
  const refs: EvidenceRef[] = [];
  for (const item of rawUnknown) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const kindRaw = o.kind;
    if (typeof kindRaw !== 'string' || !_EVIDENCE_REF_KINDS.has(kindRaw as EvidenceRefKind)) {
      continue;
    }
    const kind = kindRaw as EvidenceRefKind;
    const sheetId =
      typeof (o.sheetId ?? o.sheet_id) === 'string' ? String(o.sheetId ?? o.sheet_id) : undefined;
    const viewpointId =
      typeof (o.viewpointId ?? o.viewpoint_id) === 'string'
        ? String(o.viewpointId ?? o.viewpoint_id)
        : undefined;
    const planViewId =
      typeof (o.planViewId ?? o.plan_view_id) === 'string'
        ? String(o.planViewId ?? o.plan_view_id)
        : undefined;
    const sectionCutId =
      typeof (o.sectionCutId ?? o.section_cut_id) === 'string'
        ? String(o.sectionCutId ?? o.section_cut_id)
        : undefined;
    const pngBasename =
      typeof (o.pngBasename ?? o.png_basename) === 'string'
        ? String(o.pngBasename ?? o.png_basename)
        : undefined;
    refs.push({
      kind,
      ...(sheetId !== undefined ? { sheetId } : {}),
      ...(viewpointId !== undefined ? { viewpointId } : {}),
      ...(planViewId !== undefined ? { planViewId } : {}),
      ...(sectionCutId !== undefined ? { sectionCutId } : {}),
      ...(pngBasename !== undefined ? { pngBasename } : {}),
    });
  }
  refs.sort((a, b) => {
    const ak = `${a.kind}|${a.sheetId ?? ''}|${a.viewpointId ?? ''}|${a.planViewId ?? ''}|${a.sectionCutId ?? ''}|${a.pngBasename ?? ''}`;
    const bk = `${b.kind}|${b.sheetId ?? ''}|${b.viewpointId ?? ''}|${b.planViewId ?? ''}|${b.sectionCutId ?? ''}|${b.pngBasename ?? ''}`;
    return ak.localeCompare(bk);
  });
  return refs;
}

function readPlanViewBoolOverride(raw: unknown): boolean | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === '') return undefined;
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return undefined;
}

function readViewTemplateBool(raw: unknown, defaultVal: boolean): boolean {
  const o = readPlanViewBoolOverride(raw);
  return o === undefined ? defaultVal : o;
}

function coerceAreaScheme(raw: unknown): 'gross_building' | 'net' | 'rentable' {
  return raw === 'net' || raw === 'rentable' ? raw : 'gross_building';
}

export function coerceElement(id: string, raw: Record<string, unknown>): Element | null {
  const kind = raw.kind;
  const name =
    typeof raw.name === 'string' ? raw.name : kind === 'issue' ? ((raw.title as string) ?? id) : id;

  if (kind === 'level') {
    return {
      kind: 'level',
      id,
      name,
      elevationMm: Number(raw.elevationMm ?? raw.elevation_mm ?? 0),
      ...(typeof raw.datumKind === 'string' || raw.datum_kind
        ? { datumKind: (raw.datumKind ?? raw.datum_kind) as string }
        : {}),
      ...(typeof raw.parentLevelId === 'string' || typeof raw.parent_level_id === 'string'
        ? { parentLevelId: String(raw.parentLevelId ?? raw.parent_level_id) }
        : {}),
      offsetFromParentMm: Number(raw.offsetFromParentMm ?? raw.offset_from_parent_mm ?? 0),
      ...((raw.worksetId ?? raw.workset_id)
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
      ...((raw.monitorSourceId ?? raw.monitor_source_id)
        ? { monitorSourceId: String(raw.monitorSourceId ?? raw.monitor_source_id) }
        : {}),
      ...((raw.monitorSource ?? raw.monitor_source)
        ? {
            monitorSource: coerceMonitorSource(
              (raw.monitorSource ?? raw.monitor_source) as Record<string, unknown>,
            ),
          }
        : {}),
    };
  }

  if (kind === 'wall') {
    return {
      kind: 'wall',
      id,
      name,
      levelId: String(raw.levelId ?? ''),
      start: coerceXY(raw.start as Record<string, unknown>),
      end: coerceXY(raw.end as Record<string, unknown>),
      ...(raw.wallCurve || raw.wall_curve
        ? { wallCurve: coerceWallCurve(raw.wallCurve ?? raw.wall_curve) }
        : {}),
      thicknessMm: Number(raw.thicknessMm ?? raw.thickness_mm ?? 200),
      heightMm: Number(raw.heightMm ?? raw.height_mm ?? 2800),
      ...(typeof raw.materialKey === 'string' || typeof raw.material_key === 'string'
        ? { materialKey: String(raw.materialKey ?? raw.material_key) }
        : {}),
      ...(raw.wallTypeId || raw.wall_type_id
        ? { wallTypeId: String(raw.wallTypeId ?? raw.wall_type_id) }
        : {}),
      ...(raw.baseConstraintLevelId || raw.base_constraint_level_id
        ? {
            baseConstraintLevelId: String(
              raw.baseConstraintLevelId ?? raw.base_constraint_level_id,
            ),
          }
        : {}),
      ...(raw.topConstraintLevelId || raw.top_constraint_level_id
        ? { topConstraintLevelId: String(raw.topConstraintLevelId ?? raw.top_constraint_level_id) }
        : {}),
      baseConstraintOffsetMm: Number(
        raw.baseConstraintOffsetMm ?? raw.base_constraint_offset_mm ?? 0,
      ),
      topConstraintOffsetMm: Number(raw.topConstraintOffsetMm ?? raw.top_constraint_offset_mm ?? 0),
      ...(raw.roofAttachmentId || raw.roof_attachment_id
        ? { roofAttachmentId: String(raw.roofAttachmentId ?? raw.roof_attachment_id) }
        : {}),
      insulationExtensionMm: Number(raw.insulationExtensionMm ?? raw.insulation_extension_mm ?? 0),
      ...(raw.isCurtainWall != null || raw.is_curtain_wall != null
        ? { isCurtainWall: Boolean(raw.isCurtainWall ?? raw.is_curtain_wall) }
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
            recessZones: ((raw.recessZones ?? raw.recess_zones) as Record<string, unknown>[])
              .map((z) => {
                const start = Number(z.alongTStart ?? z.along_t_start);
                const end = Number(z.alongTEnd ?? z.along_t_end);
                const setback = Number(z.setbackMm ?? z.setback_mm);
                if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(setback)) {
                  return null;
                }
                return {
                  alongTStart: start,
                  alongTEnd: end,
                  setbackMm: setback,
                  ...(z.sillHeightMm != null || z.sill_height_mm != null
                    ? { sillHeightMm: Number(z.sillHeightMm ?? z.sill_height_mm) }
                    : {}),
                  ...(z.headHeightMm != null || z.head_height_mm != null
                    ? { headHeightMm: Number(z.headHeightMm ?? z.head_height_mm) }
                    : {}),
                  ...(z.floorContinues != null || z.floor_continues != null
                    ? { floorContinues: Boolean(z.floorContinues ?? z.floor_continues) }
                    : {}),
                };
              })
              .filter((z): z is NonNullable<typeof z> => z !== null),
          }
        : {}),
    };
  }

  if (kind === 'door') {
    return {
      kind: 'door',
      id,
      name,
      wallId: String(raw.wallId ?? ''),
      alongT: Number(raw.alongT ?? 0),
      widthMm: Number(raw.widthMm ?? 900),
      ...(raw.familyTypeId || raw.family_type_id
        ? { familyTypeId: String(raw.familyTypeId ?? raw.family_type_id) }
        : {}),
      ...(typeof raw.materialKey === 'string' || typeof raw.material_key === 'string'
        ? { materialKey: String(raw.materialKey ?? raw.material_key) }
        : {}),
      hostCutDepthMm: raw.hostCutDepthMm !== undefined ? Number(raw.hostCutDepthMm) : undefined,
      revealInteriorMm:
        raw.revealInteriorMm !== undefined ? Number(raw.revealInteriorMm) : undefined,
      interlockGrade: typeof raw.interlockGrade === 'string' ? raw.interlockGrade : undefined,
      lodPlan: raw.lodPlan === 'simple' || raw.lodPlan === 'detailed' ? raw.lodPlan : undefined,
      // KRN-13 — operationType allows sliding_double / bi_fold / pivot etc.
      // Previously stripped by coerceElement.
      ...(typeof raw.operationType === 'string' || typeof raw.operation_type === 'string'
        ? {
            operationType: String(raw.operationType ?? raw.operation_type) as
              | 'swing_single'
              | 'swing_double'
              | 'sliding_single'
              | 'sliding_double'
              | 'bi_fold'
              | 'pocket'
              | 'pivot'
              | 'automatic_double',
          }
        : {}),
      ...(typeof raw.slidingTrackSide === 'string' || typeof raw.sliding_track_side === 'string'
        ? {
            slidingTrackSide: String(raw.slidingTrackSide ?? raw.sliding_track_side) as
              | 'wall_face'
              | 'in_pocket',
          }
        : {}),
    };
  }

  if (kind === 'window') {
    return {
      kind: 'window',
      id,
      name,
      wallId: String(raw.wallId ?? ''),
      alongT: Number(raw.alongT ?? 0),
      widthMm: Number(raw.widthMm ?? 1200),
      sillHeightMm: Number(raw.sillHeightMm ?? raw.sill_height_mm ?? 900),
      heightMm: Number(raw.heightMm ?? raw.height_mm ?? 1500),
      ...(raw.familyTypeId || raw.family_type_id
        ? { familyTypeId: String(raw.familyTypeId ?? raw.family_type_id) }
        : {}),
      ...(typeof raw.materialKey === 'string' || typeof raw.material_key === 'string'
        ? { materialKey: String(raw.materialKey ?? raw.material_key) }
        : {}),
      hostCutDepthMm: raw.hostCutDepthMm !== undefined ? Number(raw.hostCutDepthMm) : undefined,
      revealInteriorMm:
        raw.revealInteriorMm !== undefined ? Number(raw.revealInteriorMm) : undefined,
      interlockGrade: typeof raw.interlockGrade === 'string' ? raw.interlockGrade : undefined,
      sealRebateMm: raw.sealRebateMm !== undefined ? Number(raw.sealRebateMm) : undefined,
      lodPlan: raw.lodPlan === 'simple' || raw.lodPlan === 'detailed' ? raw.lodPlan : undefined,
      // KRN-12 — outlineKind allows gable_trapezoid / arched_top / etc.
      // Was previously stripped by coerceElement so the seed-target-house
      // trapezoidal slope-following window rendered as a rectangle.
      ...(typeof raw.outlineKind === 'string' || typeof raw.outline_kind === 'string'
        ? {
            outlineKind: String(raw.outlineKind ?? raw.outline_kind) as
              | 'rectangle'
              | 'arched_top'
              | 'gable_trapezoid'
              | 'circle'
              | 'octagon'
              | 'custom',
          }
        : {}),
      ...(typeof raw.attachedRoofId === 'string' || typeof raw.attached_roof_id === 'string'
        ? { attachedRoofId: String(raw.attachedRoofId ?? raw.attached_roof_id) }
        : {}),
    };
  }

  if (kind === 'room') {
    const outline = Array.isArray(raw.outlineMm) ? raw.outlineMm : [];
    return {
      kind: 'room',
      id,
      name,
      levelId: String(raw.levelId ?? ''),
      outlineMm: outline.map((p) => coerceXY((p ?? {}) as Record<string, unknown>)),
      ...(raw.upperLimitLevelId || raw.upper_limit_level_id
        ? {
            upperLimitLevelId: String(raw.upperLimitLevelId ?? raw.upper_limit_level_id),
          }
        : {}),
      volumeCeilingOffsetMm:
        raw.volumeCeilingOffsetMm !== undefined || raw.volume_ceiling_offset_mm !== undefined
          ? Number(raw.volumeCeilingOffsetMm ?? raw.volume_ceiling_offset_mm)
          : undefined,
      ...(typeof raw.programmeCode === 'string' || typeof raw.programme_code === 'string'
        ? {
            programmeCode: String(raw.programmeCode ?? raw.programme_code),
          }
        : {}),
      ...(typeof raw.department === 'string' ? { department: raw.department } : {}),
      ...(typeof raw.functionLabel === 'string' || typeof raw.function_label === 'string'
        ? { functionLabel: String(raw.functionLabel ?? raw.function_label) }
        : {}),
      ...(typeof raw.finishSet === 'string' || typeof raw.finish_set === 'string'
        ? { finishSet: String(raw.finishSet ?? raw.finish_set) }
        : {}),
      ...(raw.targetAreaM2 !== undefined || raw.target_area_m2 !== undefined
        ? {
            targetAreaM2:
              raw.targetAreaM2 === null || raw.target_area_m2 === null
                ? null
                : Number(raw.targetAreaM2 ?? raw.target_area_m2),
          }
        : {}),
      ...(raw.volumeM3 !== undefined || raw.volume_m3 !== undefined
        ? {
            volumeM3:
              raw.volumeM3 === null || raw.volume_m3 === null
                ? null
                : Number(raw.volumeM3 ?? raw.volume_m3),
          }
        : {}),
      ...(typeof raw.roomFillOverrideHex === 'string' ||
      typeof raw.room_fill_override_hex === 'string'
        ? { roomFillOverrideHex: String(raw.roomFillOverrideHex ?? raw.room_fill_override_hex) }
        : {}),
    };
  }

  if (kind === 'area') {
    const ruleRaw = raw.ruleSet ?? raw.rule_set;
    const ruleSet = ruleRaw === 'gross' || ruleRaw === 'net' ? ruleRaw : ('no_rules' as const);
    const computedRaw = raw.computedAreaSqMm ?? raw.computed_area_sq_mm;
    const boundaryRaw = raw.boundaryMm ?? raw.boundary_mm;
    const computedAreaSqMm =
      typeof computedRaw === 'number' && Number.isFinite(computedRaw)
        ? computedRaw
        : typeof computedRaw === 'string' && computedRaw.trim() !== ''
          ? Number(computedRaw)
          : undefined;
    return {
      kind: 'area',
      id,
      name,
      levelId: String(raw.levelId ?? raw.level_id ?? ''),
      boundaryMm: Array.isArray(boundaryRaw)
        ? boundaryRaw.map((p) => coerceXY((p ?? {}) as Record<string, unknown>))
        : [],
      ruleSet,
      areaScheme: coerceAreaScheme(raw.areaScheme ?? raw.area_scheme),
      ...(computedAreaSqMm !== undefined && Number.isFinite(computedAreaSqMm)
        ? { computedAreaSqMm }
        : {}),
      ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
      phaseCreated: (raw.phaseCreated ?? raw.phase_created ?? null) as string | null,
      phaseDemolished: (raw.phaseDemolished ?? raw.phase_demolished ?? null) as string | null,
    };
  }

  if (kind === 'grid_line') {
    const lid = raw.levelId ?? raw.level_id;
    return {
      kind: 'grid_line',
      id,
      name,
      label: typeof raw.label === 'string' ? raw.label : '',
      start: coerceXY(raw.start as Record<string, unknown>),
      end: coerceXY(raw.end as Record<string, unknown>),
      levelId: typeof lid === 'string' ? lid : null,
      ...((raw.worksetId ?? raw.workset_id)
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
      ...((raw.monitorSourceId ?? raw.monitor_source_id)
        ? { monitorSourceId: String(raw.monitorSourceId ?? raw.monitor_source_id) }
        : {}),
      ...((raw.monitorSource ?? raw.monitor_source)
        ? {
            monitorSource: coerceMonitorSource(
              (raw.monitorSource ?? raw.monitor_source) as Record<string, unknown>,
            ),
          }
        : {}),
    };
  }

  if (kind === 'dimension') {
    return {
      kind: 'dimension',
      id,
      name,
      levelId: String(raw.levelId ?? ''),
      aMm: coerceXY((raw.aMm ?? raw.a_mm ?? {}) as Record<string, unknown>),
      bMm: coerceXY((raw.bMm ?? raw.b_mm ?? {}) as Record<string, unknown>),
      offsetMm: coerceXY((raw.offsetMm ?? raw.offset_mm ?? {}) as Record<string, unknown>),
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
  }

  if (kind === 'viewpoint') {
    const cam = (raw.camera ?? {}) as Record<string, unknown>;
    const xyzKey = (k: string) =>
      coerceXYZ(((cam[k] as Record<string, unknown>) ?? {}) as Record<string, unknown>);
    const modeRaw = raw.mode;
    const mode =
      modeRaw === 'plan_2d' ? 'plan_2d' : modeRaw === 'plan_canvas' ? 'plan_canvas' : 'orbit_3d';
    return {
      kind: 'viewpoint',
      id,
      name,
      camera: {
        position: xyzKey('position'),
        target: xyzKey('target'),
        up: xyzKey('up'),
      },
      mode,
      ...(raw.viewerClipCapElevMm !== undefined || raw.viewer_clip_cap_elev_mm !== undefined
        ? {
            viewerClipCapElevMm: Number(
              raw.viewerClipCapElevMm ?? raw.viewer_clip_cap_elev_mm ?? null,
            ),
          }
        : {}),
      ...(raw.viewerClipFloorElevMm !== undefined || raw.viewer_clip_floor_elev_mm !== undefined
        ? {
            viewerClipFloorElevMm: Number(
              raw.viewerClipFloorElevMm ?? raw.viewer_clip_floor_elev_mm ?? null,
            ),
          }
        : {}),
      ...(Array.isArray(raw.hiddenSemanticKinds3d) || Array.isArray(raw.hidden_semantic_kinds_3d)
        ? {
            hiddenSemanticKinds3d: (
              (raw.hiddenSemanticKinds3d ?? raw.hidden_semantic_kinds_3d) as unknown[]
            )
              .filter((x): x is string => typeof x === 'string')
              .map((s) => s),
          }
        : {}),
      ...(() => {
        const csRaw = raw.cutawayStyle ?? raw.cutaway_style;
        if (csRaw !== 'none' && csRaw !== 'cap' && csRaw !== 'floor' && csRaw !== 'box') return {};
        return { cutawayStyle: csRaw };
      })(),
      ...(Array.isArray(raw.hiddenElementIds) || Array.isArray(raw.hidden_element_ids)
        ? {
            hiddenElementIds: (
              (raw.hiddenElementIds ?? raw.hidden_element_ids) as unknown[]
            ).filter((x): x is string => typeof x === 'string'),
          }
        : {}),
      ...(Array.isArray(raw.isolatedElementIds) || Array.isArray(raw.isolated_element_ids)
        ? {
            isolatedElementIds: (
              (raw.isolatedElementIds ?? raw.isolated_element_ids) as unknown[]
            ).filter((x): x is string => typeof x === 'string'),
          }
        : {}),
    };
  }

  if (kind === 'issue') {
    const statusRaw = raw.status;
    const status =
      statusRaw === 'done' ? 'done' : statusRaw === 'in_progress' ? 'in_progress' : 'open';
    const elementIdsRaw = raw.elementIds ?? raw.element_ids ?? [];
    const elementIds =
      Array.isArray(elementIdsRaw) && elementIdsRaw.every((x) => typeof x === 'string')
        ? [...elementIdsRaw].sort()
        : [];
    const title = typeof raw.title === 'string' ? raw.title : name;
    const evidenceRefs = coerceEvidenceRefs(raw.evidenceRefs ?? raw.evidence_refs);
    return {
      kind: 'issue',
      id,
      title,
      status,
      elementIds,
      viewpointId: (raw.viewpointId ?? raw.viewpoint_id ?? null) as string | null,
      ...(evidenceRefs.length ? { evidenceRefs } : {}),
    };
  }

  const coerceLoop = (keyA: string, keyS: string): XY[] => {
    const arr = raw[keyA] ?? raw[keyS];
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => coerceXY((p ?? {}) as Record<string, unknown>));
  };

  if (kind === 'project_settings') {
    return {
      kind: 'project_settings',
      id,
      name,
      lengthUnit: String(raw.lengthUnit ?? raw.length_unit ?? 'millimeter'),
      angularUnitDeg: String(raw.angularUnitDeg ?? raw.angular_unit_deg ?? 'degree'),
      displayLocale: String(raw.displayLocale ?? raw.display_locale ?? 'en-US'),
      ...((raw.worksetId ?? raw.workset_id)
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
      ...((raw.startingViewId ?? raw.starting_view_id)
        ? { startingViewId: String(raw.startingViewId ?? raw.starting_view_id) }
        : {}),
      checkpointRetentionLimit: coerceCheckpointRetentionLimit(
        raw.checkpointRetentionLimit ?? raw.checkpoint_retention_limit,
      ),
      volumeComputedAt: (raw.volumeComputedAt ?? 'finish_faces') as 'finish_faces' | 'core_faces',
      roomAreaComputationBasis: (raw.roomAreaComputationBasis ?? 'wall_finish') as
        | 'wall_finish'
        | 'wall_centerline'
        | 'wall_core_layer'
        | 'wall_core_center',
    };
  }

  if (kind === 'room_color_scheme') {
    const srRaw = raw.schemeRows ?? raw.scheme_rows ?? [];
    const schemeRows =
      Array.isArray(srRaw) && srRaw.length
        ? srRaw.map((row) => {
            const rr = (row ?? {}) as Record<string, unknown>;
            const pc = rr.programmeCode ?? rr.programme_code;
            const dp = rr.department;
            const hx = rr.schemeColorHex ?? rr.scheme_color_hex;
            return {
              ...(typeof pc === 'string' ? { programmeCode: pc } : {}),
              ...(typeof dp === 'string' ? { department: dp } : {}),
              schemeColorHex: typeof hx === 'string' ? hx : '',
            };
          })
        : [];
    return {
      kind: 'room_color_scheme',
      id,
      ...(name ? { name } : {}),
      schemeRows,
    };
  }

  if (kind === 'wall_type') {
    const layersRaw = Array.isArray(raw.layers) ? raw.layers : [];
    const layers = layersRaw.map((l) => {
      const rr = (l ?? {}) as Record<string, unknown>;
      return {
        thicknessMm: Number(rr.thicknessMm ?? rr.thickness_mm ?? 0),
        function: (rr.function as 'structure' | 'insulation' | 'finish') ?? 'structure',
        materialKey: (rr.materialKey ?? rr.material_key) as string | null | undefined,
      };
    });
    return {
      kind: 'wall_type',
      id,
      name,
      layers,
      basisLine: (raw.basisLine ?? raw.basis_line) as 'center' | 'face_interior' | 'face_exterior',
    };
  }

  if (kind === 'floor_type') {
    const layersRaw = Array.isArray(raw.layers) ? raw.layers : [];
    const layers = layersRaw.map((l) => {
      const rr = (l ?? {}) as Record<string, unknown>;
      return {
        thicknessMm: Number(rr.thicknessMm ?? rr.thickness_mm ?? 0),
        function: (rr.function as 'structure' | 'insulation' | 'finish') ?? 'structure',
        materialKey: (rr.materialKey ?? rr.material_key) as string | null | undefined,
      };
    });
    return {
      kind: 'floor_type',
      id,
      name,
      layers,
    };
  }

  if (kind === 'roof_type') {
    const layersRaw = Array.isArray(raw.layers) ? raw.layers : [];
    const layers = layersRaw.map((l) => {
      const rr = (l ?? {}) as Record<string, unknown>;
      return {
        thicknessMm: Number(rr.thicknessMm ?? rr.thickness_mm ?? 0),
        function: (rr.function as 'structure' | 'insulation' | 'finish') ?? 'structure',
        materialKey: (rr.materialKey ?? rr.material_key) as string | null | undefined,
      };
    });
    return {
      kind: 'roof_type',
      id,
      name,
      layers,
    };
  }

  if (kind === 'floor') {
    return {
      kind: 'floor',
      id,
      name,
      levelId: String(raw.levelId ?? ''),
      boundaryMm: coerceLoop('boundaryMm', 'boundary_mm'),
      thicknessMm: Number(raw.thicknessMm ?? raw.thickness_mm ?? 220),
      structureThicknessMm: Number(raw.structureThicknessMm ?? raw.structure_thickness_mm ?? 140),
      finishThicknessMm: Number(raw.finishThicknessMm ?? raw.finish_thickness_mm ?? 0),
      ...(raw.floorTypeId || raw.floor_type_id
        ? { floorTypeId: String(raw.floorTypeId ?? raw.floor_type_id) }
        : {}),
      insulationExtensionMm: Number(raw.insulationExtensionMm ?? raw.insulation_extension_mm ?? 0),
      roomBounded: Boolean(raw.roomBounded ?? raw.room_bounded),
      ...((raw.worksetId ?? raw.workset_id)
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
    };
  }

  if (kind === 'masking_region') {
    const voidsRaw = raw.voidBoundariesMm ?? raw.void_boundaries_mm;
    const voidBoundariesMm = Array.isArray(voidsRaw)
      ? voidsRaw
          .filter((loop): loop is Record<string, unknown>[] => Array.isArray(loop))
          .map((loop) =>
            loop
              .filter((pt): pt is Record<string, unknown> => pt != null && typeof pt === 'object')
              .map(coerceXY),
          )
          .filter((loop) => loop.length >= 3)
      : [];
    return {
      kind: 'masking_region',
      id,
      hostViewId: String(raw.hostViewId ?? raw.host_view_id ?? ''),
      boundaryMm: coerceLoop('boundaryMm', 'boundary_mm'),
      voidBoundariesMm,
      fillColor:
        typeof (raw.fillColor ?? raw.fill_color) === 'string'
          ? String(raw.fillColor ?? raw.fill_color)
          : '#ffffff',
    };
  }

  if (kind === 'roof') {
    const rawMode = String(raw.roofGeometryMode ?? raw.roof_geometry_mode ?? 'mass_box');
    const rg =
      rawMode === 'gable_pitched_rectangle' ||
      rawMode === 'asymmetric_gable' ||
      rawMode === 'gable_pitched_l_shape' ||
      rawMode === 'hip' ||
      rawMode === 'flat'
        ? rawMode
        : 'mass_box';
    return {
      kind: 'roof',
      id,
      name,
      referenceLevelId: String(raw.referenceLevelId ?? raw.reference_level_id ?? ''),
      footprintMm: coerceLoop('footprintMm', 'footprint_mm'),
      overhangMm: Number(raw.overhangMm ?? raw.overhang_mm ?? 400),
      slopeDeg:
        raw.slopeDeg !== undefined
          ? Number(raw.slopeDeg)
          : raw.slope_deg !== undefined
            ? Number(raw.slope_deg)
            : null,
      edgeSlopeFlags:
        typeof raw.edgeSlopeFlags === 'object' && raw.edgeSlopeFlags
          ? (raw.edgeSlopeFlags as Record<string, boolean>)
          : undefined,
      roofGeometryMode: rg,
      ridgeOffsetTransverseMm:
        raw.ridgeOffsetTransverseMm !== undefined
          ? Number(raw.ridgeOffsetTransverseMm)
          : raw.ridge_offset_transverse_mm !== undefined
            ? Number(raw.ridge_offset_transverse_mm)
            : undefined,
      eaveHeightLeftMm:
        raw.eaveHeightLeftMm !== undefined
          ? Number(raw.eaveHeightLeftMm)
          : raw.eave_height_left_mm !== undefined
            ? Number(raw.eave_height_left_mm)
            : undefined,
      eaveHeightRightMm:
        raw.eaveHeightRightMm !== undefined
          ? Number(raw.eaveHeightRightMm)
          : raw.eave_height_right_mm !== undefined
            ? Number(raw.eave_height_right_mm)
            : undefined,
      ...(raw.materialKey || raw.material_key
        ? { materialKey: String(raw.materialKey ?? raw.material_key) }
        : {}),
      ...(raw.roofTypeId || raw.roof_type_id
        ? { roofTypeId: String(raw.roofTypeId ?? raw.roof_type_id) }
        : {}),
    };
  }

  if (kind === 'stair') {
    return {
      kind: 'stair',
      id,
      name,
      baseLevelId: String(raw.baseLevelId ?? raw.base_level_id ?? ''),
      topLevelId: String(raw.topLevelId ?? raw.top_level_id ?? ''),
      runStartMm: coerceXY((raw.runStartMm ?? raw.run_start_mm ?? {}) as Record<string, unknown>),
      runEndMm: coerceXY((raw.runEndMm ?? raw.run_end_mm ?? {}) as Record<string, unknown>),
      widthMm: Number(raw.widthMm ?? raw.width_mm ?? 1000),
      riserMm: Number(raw.riserMm ?? raw.riser_mm ?? 175),
      treadMm: Number(raw.treadMm ?? raw.tread_mm ?? 275),
    };
  }

  if (kind === 'slab_opening') {
    return {
      kind: 'slab_opening',
      id,
      name,
      hostFloorId: String(raw.hostFloorId ?? raw.host_floor_id ?? ''),
      boundaryMm: coerceLoop('boundaryMm', 'boundary_mm'),
      isShaft: Boolean(raw.isShaft ?? raw.is_shaft),
    };
  }

  if (kind === 'roof_opening') {
    return {
      kind: 'roof_opening',
      id,
      name,
      hostRoofId: String(raw.hostRoofId ?? raw.host_roof_id ?? ''),
      boundaryMm: coerceLoop('boundaryMm', 'boundary_mm'),
      pinned: Boolean(raw.pinned),
    };
  }

  if (kind === 'railing') {
    return {
      kind: 'railing',
      id,
      name,
      hostedStairId: (raw.hostedStairId ?? raw.hosted_stair_id ?? null) as string | null,
      pathMm: coerceLoop('pathMm', 'path_mm'),
      guardHeightMm: Number(raw.guardHeightMm ?? raw.guard_height_mm ?? 1040),
    };
  }

  if (kind === 'balcony') {
    return {
      kind: 'balcony',
      id,
      name,
      wallId: String(raw.wallId ?? raw.wall_id ?? ''),
      elevationMm: Number(raw.elevationMm ?? raw.elevation_mm ?? 0),
      ...(raw.projectionMm != null || raw.projection_mm != null
        ? { projectionMm: Number(raw.projectionMm ?? raw.projection_mm) }
        : {}),
      ...(raw.slabThicknessMm != null || raw.slab_thickness_mm != null
        ? { slabThicknessMm: Number(raw.slabThicknessMm ?? raw.slab_thickness_mm) }
        : {}),
      ...(raw.balustradeHeightMm != null || raw.balustrade_height_mm != null
        ? { balustradeHeightMm: Number(raw.balustradeHeightMm ?? raw.balustrade_height_mm) }
        : {}),
    };
  }

  if (kind === 'sweep') {
    const rawPath = (raw.pathMm ?? raw.path_mm) as Record<string, unknown>[] | undefined;
    const rawProfile = (raw.profileMm ?? raw.profile_mm) as Record<string, unknown>[] | undefined;
    if (!Array.isArray(rawPath) || !Array.isArray(rawProfile)) return null;
    const planeRaw = String(raw.profilePlane ?? raw.profile_plane ?? 'work_plane');
    const profilePlane: 'normal_to_path_start' | 'work_plane' =
      planeRaw === 'normal_to_path_start' ? 'normal_to_path_start' : 'work_plane';
    return {
      kind: 'sweep',
      id,
      name,
      levelId: String(raw.levelId ?? raw.level_id ?? ''),
      pathMm: rawPath
        .map((p) => {
          const xMm = Number(p.xMm ?? p.x_mm);
          const yMm = Number(p.yMm ?? p.y_mm);
          if (!Number.isFinite(xMm) || !Number.isFinite(yMm)) return null;
          const zRaw = p.zMm ?? p.z_mm;
          const out: { xMm: number; yMm: number; zMm?: number } = { xMm, yMm };
          if (zRaw != null && Number.isFinite(Number(zRaw))) out.zMm = Number(zRaw);
          return out;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
      profileMm: rawProfile
        .map((p) => {
          const uMm = Number(p.uMm ?? p.u_mm);
          const vMm = Number(p.vMm ?? p.v_mm);
          if (!Number.isFinite(uMm) || !Number.isFinite(vMm)) return null;
          return { uMm, vMm };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
      profilePlane,
      ...(typeof raw.materialKey === 'string' || typeof raw.material_key === 'string'
        ? { materialKey: String(raw.materialKey ?? raw.material_key) }
        : {}),
    };
  }

  if (kind === 'dormer') {
    const posRaw = (raw.positionOnRoof ?? raw.position_on_roof) as
      | Record<string, unknown>
      | undefined;
    if (!posRaw) return null;
    const dormerRoofKindRaw = String(raw.dormerRoofKind ?? raw.dormer_roof_kind ?? 'flat');
    const dormerRoofKind: 'flat' | 'shed' | 'gable' | 'hipped' = (
      ['flat', 'shed', 'gable', 'hipped'] as const
    ).includes(dormerRoofKindRaw as never)
      ? (dormerRoofKindRaw as 'flat' | 'shed' | 'gable' | 'hipped')
      : 'flat';
    return {
      kind: 'dormer',
      id,
      name,
      hostRoofId: String(raw.hostRoofId ?? raw.host_roof_id ?? ''),
      positionOnRoof: {
        alongRidgeMm: Number(posRaw.alongRidgeMm ?? posRaw.along_ridge_mm ?? 0),
        acrossRidgeMm: Number(posRaw.acrossRidgeMm ?? posRaw.across_ridge_mm ?? 0),
      },
      widthMm: Number(raw.widthMm ?? raw.width_mm ?? 1000),
      wallHeightMm: Number(raw.wallHeightMm ?? raw.wall_height_mm ?? 2400),
      depthMm: Number(raw.depthMm ?? raw.depth_mm ?? 1000),
      dormerRoofKind,
      ...(raw.dormerRoofPitchDeg != null || raw.dormer_roof_pitch_deg != null
        ? { dormerRoofPitchDeg: Number(raw.dormerRoofPitchDeg ?? raw.dormer_roof_pitch_deg) }
        : {}),
      ...(raw.ridgeHeightMm != null || raw.ridge_height_mm != null
        ? { ridgeHeightMm: Number(raw.ridgeHeightMm ?? raw.ridge_height_mm) }
        : {}),
      ...(typeof raw.wallMaterialKey === 'string' || typeof raw.wall_material_key === 'string'
        ? { wallMaterialKey: String(raw.wallMaterialKey ?? raw.wall_material_key) }
        : {}),
      ...(typeof raw.roofMaterialKey === 'string' || typeof raw.roof_material_key === 'string'
        ? { roofMaterialKey: String(raw.roofMaterialKey ?? raw.roof_material_key) }
        : {}),
      ...(raw.hasFloorOpening != null || raw.has_floor_opening != null
        ? { hasFloorOpening: Boolean(raw.hasFloorOpening ?? raw.has_floor_opening) }
        : {}),
    };
  }

  if (kind === 'mass') {
    return {
      kind: 'mass',
      id,
      name,
      levelId: String(raw.levelId ?? raw.level_id ?? ''),
      footprintMm: coerceLoop('footprintMm', 'footprint_mm'),
      heightMm: Number(raw.heightMm ?? raw.height_mm ?? 3000),
      ...(raw.rotationDeg != null || raw.rotation_deg != null
        ? { rotationDeg: Number(raw.rotationDeg ?? raw.rotation_deg) }
        : {}),
      ...(typeof raw.materialKey === 'string' || typeof raw.material_key === 'string'
        ? { materialKey: String(raw.materialKey ?? raw.material_key) }
        : {}),
    };
  }

  if (kind === 'family_type') {
    const validDisciplines = [
      'door',
      'window',
      'stair',
      'railing',
      'wall_type',
      'floor_type',
      'roof_type',
      'column',
      'beam',
      'generic',
    ] as const;
    const d = raw.discipline;
    const discipline = validDisciplines.includes(d as never)
      ? (d as (typeof validDisciplines)[number])
      : 'generic';
    const csRaw = (raw.catalogSource ?? raw.catalog_source) as
      | {
          catalogId?: unknown;
          familyId?: unknown;
          version?: unknown;
          catalog_id?: unknown;
          family_id?: unknown;
        }
      | undefined;
    const catalogSource =
      csRaw && typeof csRaw === 'object'
        ? {
            catalogId: String(csRaw.catalogId ?? csRaw.catalog_id ?? ''),
            familyId: String(csRaw.familyId ?? csRaw.family_id ?? ''),
            version: String(csRaw.version ?? ''),
          }
        : undefined;
    return {
      kind: 'family_type',
      id,
      name: typeof raw.name === 'string' ? raw.name : '',
      familyId:
        typeof raw.familyId === 'string'
          ? raw.familyId
          : typeof raw.family_id === 'string'
            ? raw.family_id
            : '',
      discipline,
      parameters:
        raw.parameters && typeof raw.parameters === 'object'
          ? (raw.parameters as Record<string, unknown>)
          : {},
      ...(raw.isBuiltIn != null ? { isBuiltIn: Boolean(raw.isBuiltIn) } : {}),
      ...(catalogSource && catalogSource.catalogId ? { catalogSource } : {}),
    };
  }

  if (kind === 'room_separation') {
    return {
      kind: 'room_separation',
      id,
      name,
      levelId: String(raw.levelId ?? ''),
      start: coerceXY((raw.start ?? {}) as Record<string, unknown>),
      end: coerceXY((raw.end ?? {}) as Record<string, unknown>),
    };
  }

  if (kind === 'plan_region') {
    return {
      kind: 'plan_region',
      id,
      name,
      levelId: String(raw.levelId ?? ''),
      outlineMm: coerceLoop('outlineMm', 'outline_mm'),
      cutPlaneOffsetMm: Number(raw.cutPlaneOffsetMm ?? raw.cut_plane_offset_mm ?? -500),
    };
  }

  if (kind === 'tag_definition') {
    const tkRaw = raw.tagKind ?? raw.tag_kind;
    const tagKind =
      tkRaw === 'room' || tkRaw === 'sill' || tkRaw === 'slab_finish' ? tkRaw : ('custom' as const);
    return {
      kind: 'tag_definition',
      id,
      name,
      tagKind,
      discipline: typeof raw.discipline === 'string' ? raw.discipline : 'architecture',
    };
  }

  if (kind === 'join_geometry') {
    const j = raw.joinedElementIds ?? raw.joined_element_ids ?? [];
    return {
      kind: 'join_geometry',
      id,
      joinedElementIds: Array.isArray(j) ? j.filter((x): x is string => typeof x === 'string') : [],
      notes: typeof raw.notes === 'string' ? raw.notes : '',
    };
  }

  if (kind === 'section_cut') {
    return {
      kind: 'section_cut',
      id,
      name,
      lineStartMm: coerceXY(
        (raw.lineStartMm ?? raw.line_start_mm ?? {}) as Record<string, unknown>,
      ),
      lineEndMm: coerceXY((raw.lineEndMm ?? raw.line_end_mm ?? {}) as Record<string, unknown>),
      cropDepthMm: Number(raw.cropDepthMm ?? raw.crop_depth_mm ?? 8500),
    };
  }

  if (kind === 'elevation_view') {
    const directionRaw = raw.direction;
    const direction =
      directionRaw === 'south' ||
      directionRaw === 'east' ||
      directionRaw === 'west' ||
      directionRaw === 'custom'
        ? directionRaw
        : 'north';
    const cropMinRaw = raw.cropMinMm ?? raw.crop_min_mm;
    const cropMaxRaw = raw.cropMaxMm ?? raw.crop_max_mm;
    const customAngleRaw = raw.customAngleDeg ?? raw.custom_angle_deg;
    const customAngleDeg =
      typeof customAngleRaw === 'number'
        ? customAngleRaw
        : typeof customAngleRaw === 'string' && customAngleRaw.trim() !== ''
          ? Number(customAngleRaw)
          : null;
    const scaleRaw = raw.scale;
    const scale =
      typeof scaleRaw === 'number'
        ? scaleRaw
        : typeof scaleRaw === 'string' && scaleRaw.trim() !== ''
          ? Number(scaleRaw)
          : 100;
    const pdlRaw = raw.planDetailLevel ?? raw.plan_detail_level;
    const planDetailLevel =
      pdlRaw === 'coarse' || pdlRaw === 'fine' || pdlRaw === 'medium' ? pdlRaw : null;
    const markerSlotRaw = raw.markerSlot ?? raw.marker_slot;
    const markerSlot =
      markerSlotRaw === 'north' ||
      markerSlotRaw === 'south' ||
      markerSlotRaw === 'east' ||
      markerSlotRaw === 'west' ||
      markerSlotRaw === 'custom'
        ? markerSlotRaw
        : null;
    return {
      kind: 'elevation_view',
      id,
      name,
      direction,
      customAngleDeg: Number.isFinite(customAngleDeg) ? customAngleDeg : null,
      cropMinMm:
        cropMinRaw && typeof cropMinRaw === 'object'
          ? coerceXY(cropMinRaw as Record<string, unknown>)
          : null,
      cropMaxMm:
        cropMaxRaw && typeof cropMaxRaw === 'object'
          ? coerceXY(cropMaxRaw as Record<string, unknown>)
          : null,
      scale: Number.isFinite(scale) ? scale : 100,
      planDetailLevel,
      markerGroupId:
        typeof (raw.markerGroupId ?? raw.marker_group_id) === 'string'
          ? String(raw.markerGroupId ?? raw.marker_group_id).trim() || null
          : null,
      markerSlot,
      ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
    };
  }

  if (kind === 'plan_view') {
    const pres = raw.planPresentation ?? raw.plan_presentation;
    const planPresentation =
      pres === 'opening_focus' || pres === 'room_scheme' ? pres : ('default' as const);
    const hidRaw = raw.categoriesHidden ?? raw.categories_hidden;
    const categoriesHidden = Array.isArray(hidRaw)
      ? hidRaw.filter((x): x is string => typeof x === 'string')
      : [];
    const cropMinRaw = raw.cropMinMm ?? raw.crop_min_mm;
    const cropMaxRaw = raw.cropMaxMm ?? raw.crop_max_mm;
    const cropMinMm =
      cropMinRaw && typeof cropMinRaw === 'object'
        ? coerceXY(cropMinRaw as Record<string, unknown>)
        : null;
    const cropMaxMm =
      cropMaxRaw && typeof cropMaxRaw === 'object'
        ? coerceXY(cropMaxRaw as Record<string, unknown>)
        : null;
    const vrb = raw.viewRangeBottomMm ?? raw.view_range_bottom_mm;
    const vrt = raw.viewRangeTopMm ?? raw.view_range_top_mm;
    const cpo = raw.cutPlaneOffsetMm ?? raw.cut_plane_offset_mm;
    const pdlRaw = raw.planDetailLevel ?? raw.plan_detail_level;
    const planDetailLevel =
      pdlRaw === 'coarse' || pdlRaw === 'fine' || pdlRaw === 'medium' ? pdlRaw : undefined;
    const pfoRaw = raw.planRoomFillOpacityScale ?? raw.plan_room_fill_opacity_scale;
    let planRoomFillOpacityScale: number | undefined;
    if (
      pfoRaw !== null &&
      pfoRaw !== undefined &&
      pfoRaw !== '' &&
      typeof pfoRaw === 'number' &&
      Number.isFinite(pfoRaw)
    ) {
      planRoomFillOpacityScale = Math.max(0, Math.min(1, pfoRaw));
    } else if (typeof pfoRaw === 'string' && pfoRaw.trim() !== '') {
      const n = Number(pfoRaw);
      if (Number.isFinite(n)) planRoomFillOpacityScale = Math.max(0, Math.min(1, n));
    }
    const pso = readPlanViewBoolOverride(raw.planShowOpeningTags ?? raw.plan_show_opening_tags);
    const psr = readPlanViewBoolOverride(raw.planShowRoomLabels ?? raw.plan_show_room_labels);
    const pot =
      typeof (raw.planOpeningTagStyleId ?? raw.plan_opening_tag_style_id) === 'string'
        ? String(raw.planOpeningTagStyleId ?? raw.plan_opening_tag_style_id).trim()
        : null;
    const prt =
      typeof (raw.planRoomTagStyleId ?? raw.plan_room_tag_style_id) === 'string'
        ? String(raw.planRoomTagStyleId ?? raw.plan_room_tag_style_id).trim()
        : null;
    const coRaw = raw.categoryOverrides ?? raw.category_overrides;
    const categoryOverrides: Record<string, unknown> =
      coRaw && typeof coRaw === 'object' && !Array.isArray(coRaw)
        ? (coRaw as Record<string, unknown>)
        : {};
    const vfRaw = raw.viewFilters ?? raw.view_filters;
    const viewFilters = Array.isArray(vfRaw) ? (vfRaw as ViewFilter[]) : [];
    return {
      kind: 'plan_view',
      id,
      name,
      levelId: String(raw.levelId ?? raw.level_id ?? ''),
      viewTemplateId: (raw.viewTemplateId ?? raw.view_template_id ?? null) as string | null,
      planPresentation,
      underlayLevelId: (raw.underlayLevelId ?? raw.underlay_level_id ?? null) as string | null,
      discipline:
        typeof raw.discipline === 'string' && raw.discipline ? raw.discipline : 'architecture',
      viewSubdiscipline:
        typeof (raw.viewSubdiscipline ?? raw.view_subdiscipline) === 'string' &&
        String(raw.viewSubdiscipline ?? raw.view_subdiscipline).trim()
          ? String(raw.viewSubdiscipline ?? raw.view_subdiscipline).trim()
          : null,
      planViewSubtype:
        typeof (raw.planViewSubtype ?? raw.plan_view_subtype) === 'string' &&
        (raw.planViewSubtype ?? raw.plan_view_subtype)
          ? ((raw.planViewSubtype ?? raw.plan_view_subtype) as
              | 'floor_plan'
              | 'area_plan'
              | 'lighting_plan'
              | 'power_plan'
              | 'coordination_plan')
          : undefined,
      areaScheme: coerceAreaScheme(raw.areaScheme ?? raw.area_scheme),
      phaseId: (raw.phaseId ?? raw.phase_id ?? null) as string | null,
      cropMinMm,
      cropMaxMm,
      viewRangeBottomMm:
        typeof vrb === 'number' ? vrb : typeof vrb === 'string' ? Number(vrb) || null : null,
      viewRangeTopMm:
        typeof vrt === 'number' ? vrt : typeof vrt === 'string' ? Number(vrt) || null : null,
      cutPlaneOffsetMm:
        typeof cpo === 'number' ? cpo : typeof cpo === 'string' ? Number(cpo) || null : null,
      categoriesHidden,
      ...(planDetailLevel !== undefined ? { planDetailLevel } : {}),
      ...(planRoomFillOpacityScale !== undefined ? { planRoomFillOpacityScale } : {}),
      ...(pso !== undefined ? { planShowOpeningTags: pso } : {}),
      ...(psr !== undefined ? { planShowRoomLabels: psr } : {}),
      ...(pot ? { planOpeningTagStyleId: pot } : {}),
      ...(prt ? { planRoomTagStyleId: prt } : {}),
      categoryOverrides,
      viewFilters,
    };
  }

  if (kind === 'view_template') {
    const s = raw.scale;
    const scale = s === 'scale_50' || s === 'scale_200' ? s : ('scale_100' as const);
    const dvRaw = raw.disciplinesVisible ?? raw.disciplines_visible;
    const disciplinesVisible = Array.isArray(dvRaw)
      ? dvRaw.filter((x): x is string => typeof x === 'string')
      : [];
    const hcRaw = raw.hiddenCategories ?? raw.hidden_categories;
    const hiddenCategories = Array.isArray(hcRaw)
      ? hcRaw.filter((x): x is string => typeof x === 'string')
      : [];
    const pdlT = raw.planDetailLevel ?? raw.plan_detail_level;
    const planDetailLevel =
      pdlT === 'coarse' || pdlT === 'fine' || pdlT === 'medium' ? pdlT : undefined;
    const pfoT = raw.planRoomFillOpacityScale ?? raw.plan_room_fill_opacity_scale;
    let planRoomFillOpacityScale: number | undefined;
    if (typeof pfoT === 'number' && Number.isFinite(pfoT)) {
      planRoomFillOpacityScale = Math.max(0, Math.min(1, pfoT));
    } else if (typeof pfoT === 'string' && pfoT.trim() !== '') {
      const n = Number(pfoT);
      if (Number.isFinite(n)) planRoomFillOpacityScale = Math.max(0, Math.min(1, n));
    }
    const planShowOpeningTags = readViewTemplateBool(
      raw.planShowOpeningTags ?? raw.plan_show_opening_tags,
      false,
    );
    const planShowRoomLabels = readViewTemplateBool(
      raw.planShowRoomLabels ?? raw.plan_show_room_labels,
      false,
    );
    const dpo =
      typeof (raw.defaultPlanOpeningTagStyleId ?? raw.default_plan_opening_tag_style_id) ===
      'string'
        ? String(raw.defaultPlanOpeningTagStyleId ?? raw.default_plan_opening_tag_style_id).trim()
        : null;
    const dpr =
      typeof (raw.defaultPlanRoomTagStyleId ?? raw.default_plan_room_tag_style_id) === 'string'
        ? String(raw.defaultPlanRoomTagStyleId ?? raw.default_plan_room_tag_style_id).trim()
        : null;
    return {
      kind: 'view_template',
      id,
      name,
      scale,
      disciplinesVisible: disciplinesVisible.length ? disciplinesVisible : undefined,
      hiddenCategories: hiddenCategories.length ? hiddenCategories : undefined,
      ...(planDetailLevel !== undefined ? { planDetailLevel } : {}),
      ...(planRoomFillOpacityScale !== undefined ? { planRoomFillOpacityScale } : {}),
      planShowOpeningTags,
      planShowRoomLabels,
      ...(dpo ? { defaultPlanOpeningTagStyleId: dpo } : {}),
      ...(dpr ? { defaultPlanRoomTagStyleId: dpr } : {}),
    };
  }

  if (kind === 'sheet') {
    const tpRaw = raw.titleblockParameters ?? raw.titleblock_parameters;
    const titleblockParameters =
      typeof tpRaw === 'object' &&
      tpRaw !== null &&
      !Array.isArray(tpRaw) &&
      Object.entries(tpRaw as Record<string, unknown>).every(
        ([k, v]) => typeof k === 'string' && typeof v === 'string',
      )
        ? (tpRaw as Record<string, string>)
        : undefined;
    return {
      kind: 'sheet',
      id,
      name,
      titleBlock: (raw.titleBlock ?? raw.title_block ?? null) as string | null,
      viewportsMm: Array.isArray(raw.viewportsMm) ? raw.viewportsMm : [],
      paperWidthMm:
        raw.paperWidthMm !== undefined
          ? Number(raw.paperWidthMm)
          : raw.paper_width_mm !== undefined
            ? Number(raw.paper_width_mm)
            : undefined,
      paperHeightMm:
        raw.paperHeightMm !== undefined
          ? Number(raw.paperHeightMm)
          : raw.paper_height_mm !== undefined
            ? Number(raw.paper_height_mm)
            : undefined,
      ...(titleblockParameters !== undefined ? { titleblockParameters } : {}),
    };
  }

  if (kind === 'schedule') {
    return {
      kind: 'schedule',
      id,
      name,
      sheetId: (raw.sheetId ?? raw.sheet_id ?? null) as string | null,
      filters:
        typeof raw.filters === 'object' && raw.filters
          ? (raw.filters as Record<string, unknown>)
          : {},
      grouping:
        typeof raw.grouping === 'object' && raw.grouping
          ? (raw.grouping as Record<string, unknown>)
          : {},
    };
  }

  if (kind === 'callout') {
    return {
      kind: 'callout',
      id,
      name,
      parentSheetId: String(raw.parentSheetId ?? raw.parent_sheet_id ?? ''),
      outlineMm: coerceLoop('outlineMm', 'outline_mm'),
    };
  }

  if (kind === 'bcf') {
    const elementIdsRaw = raw.elementIds ?? raw.element_ids ?? [];
    const elementIds =
      Array.isArray(elementIdsRaw) && elementIdsRaw.every((x) => typeof x === 'string')
        ? [...elementIdsRaw].sort()
        : [];
    const evidenceRefs = coerceEvidenceRefs(raw.evidenceRefs ?? raw.evidence_refs);
    return {
      kind: 'bcf',
      id,
      title: typeof raw.title === 'string' ? raw.title : id,
      viewpointRef: (raw.viewpointRef ?? raw.viewpoint_ref ?? null) as string | null,
      status: typeof raw.status === 'string' ? raw.status : 'open',
      ...(elementIds.length ? { elementIds } : {}),
      planViewId: (raw.planViewId ?? raw.plan_view_id ?? null) as string | null,
      sectionCutId: (raw.sectionCutId ?? raw.section_cut_id ?? null) as string | null,
      ...(evidenceRefs.length ? { evidenceRefs } : {}),
    };
  }

  if (kind === 'agent_assumption') {
    const relatedRaw = raw.relatedElementIds ?? raw.related_element_ids ?? [];
    const relatedElementIds =
      Array.isArray(relatedRaw) && relatedRaw.every((x) => typeof x === 'string')
        ? [...relatedRaw].sort()
        : [];
    const src = raw.source;
    const source =
      src === 'bundle_dry_run' || src === 'evidence_summary' ? src : ('manual' as const);
    const cs = raw.closureStatus ?? raw.closure_status;
    const closureStatus =
      cs === 'open' || cs === 'resolved' || cs === 'accepted' || cs === 'deferred'
        ? cs
        : ('resolved' as const);
    return {
      kind: 'agent_assumption',
      id,
      statement: typeof raw.statement === 'string' ? raw.statement : '',
      source,
      ...(closureStatus !== 'resolved' ? { closureStatus } : {}),
      ...(relatedElementIds.length ? { relatedElementIds } : {}),
      relatedTopicId: (raw.relatedTopicId ?? raw.related_topic_id ?? null) as string | null,
    };
  }

  if (kind === 'agent_deviation') {
    const sev = raw.severity;
    const severity =
      sev === 'info' || sev === 'warning' || sev === 'error' ? sev : ('warning' as const);
    const ack = raw.acknowledged;
    const acknowledged = typeof ack === 'boolean' ? ack : true;
    const relatedRaw = raw.relatedElementIds ?? raw.related_element_ids ?? [];
    const relatedElementIds =
      Array.isArray(relatedRaw) && relatedRaw.every((x) => typeof x === 'string')
        ? [...relatedRaw].sort()
        : [];
    return {
      kind: 'agent_deviation',
      id,
      statement: typeof raw.statement === 'string' ? raw.statement : '',
      severity,
      ...(acknowledged ? {} : { acknowledged: false }),
      relatedAssumptionId: (raw.relatedAssumptionId ?? raw.related_assumption_id ?? null) as
        | string
        | null,
      ...(relatedElementIds.length ? { relatedElementIds } : {}),
    };
  }

  if (kind === 'plan_tag_style') {
    const ttRaw = raw.tagTarget ?? raw.tag_target;
    const tagTarget: 'opening' | 'room' = ttRaw === 'room' ? 'room' : 'opening';
    const lfRaw = raw.labelFields ?? raw.label_fields;
    const labelFields = Array.isArray(lfRaw)
      ? lfRaw.filter((x): x is string => typeof x === 'string')
      : [];
    const bs = raw.badgeStyle ?? raw.badge_style;
    const badgeStyle = bs === 'rounded' || bs === 'flag' ? bs : ('none' as const);
    const tsp = Number(raw.textSizePt ?? raw.text_size_pt ?? 10);
    return {
      kind: 'plan_tag_style',
      id,
      name,
      tagTarget,
      labelFields,
      textSizePt: Number.isFinite(tsp) && tsp > 0 ? tsp : 10,
      leaderVisible: readViewTemplateBool(raw.leaderVisible ?? raw.leader_visible, true),
      badgeStyle,
      colorToken:
        typeof raw.colorToken === 'string' || typeof raw.color_token === 'string'
          ? String(raw.colorToken ?? raw.color_token)
          : 'default',
      sortKey: Number(raw.sortKey ?? raw.sort_key ?? 0) || 0,
    };
  }

  if (kind === 'validation_rule') {
    return {
      kind: 'validation_rule',
      id,
      name,
      ruleJson: (typeof raw.ruleJson === 'object' && raw.ruleJson
        ? raw.ruleJson
        : typeof raw.rule_json === 'object' && raw.rule_json
          ? raw.rule_json
          : {}) as Record<string, unknown>,
    };
  }

  if (kind === 'color_fill_legend') {
    return {
      kind: 'color_fill_legend',
      id,
      hostViewId: String(raw.hostViewId ?? raw.host_view_id ?? ''),
      positionMm: coerceXY((raw.positionMm ?? raw.position_mm ?? {}) as Record<string, unknown>),
      schemeParameter: String(raw.schemeParameter ?? raw.scheme_parameter ?? 'Name'),
      title: String(raw.title ?? 'Color Fill Legend'),
    };
  }

  if (kind === 'shared_param_file') {
    const rawGroups = raw.groups ?? raw.param_groups;
    const groups = Array.isArray(rawGroups)
      ? rawGroups.map((g: Record<string, unknown>) => ({
          groupName: String(g.groupName ?? g.group_name ?? ''),
          parameters: Array.isArray(g.parameters)
            ? g.parameters.map((p: Record<string, unknown>) => ({
                guid: String(p.guid ?? ''),
                name: String(p.name ?? ''),
                dataType: String(p.dataType ?? p.data_type ?? 'text') as
                  | 'text'
                  | 'number'
                  | 'integer'
                  | 'yesno'
                  | 'length'
                  | 'area'
                  | 'volume',
              }))
            : [],
        }))
      : [];
    return { kind: 'shared_param_file', id, name, groups };
  }

  if (kind === 'project_param') {
    const rawCats = raw.categories ?? raw.param_categories;
    const iot = raw.instanceOrType ?? raw.instance_or_type;
    return {
      kind: 'project_param',
      id,
      name,
      sharedParamGuid: String(raw.sharedParamGuid ?? raw.shared_param_guid ?? ''),
      categories: Array.isArray(rawCats)
        ? rawCats.filter((x): x is string => typeof x === 'string')
        : [],
      instanceOrType: iot === 'type' ? 'type' : 'instance',
    };
  }

  if (kind === 'reference_plane') {
    const rawLevelId = raw.levelId ?? raw.level_id;
    if (rawLevelId != null && String(rawLevelId).length > 0) {
      // KRN-05: project-scope reference plane (level-anchored).
      const start = (raw.startMm ?? raw.start_mm ?? raw.start) as
        | Record<string, unknown>
        | undefined;
      const end = (raw.endMm ?? raw.end_mm ?? raw.end) as Record<string, unknown> | undefined;
      const out: Record<string, unknown> = {
        kind: 'reference_plane',
        id,
        levelId: String(rawLevelId),
        startMm: {
          xMm: Number(start?.xMm ?? start?.x_mm ?? 0),
          yMm: Number(start?.yMm ?? start?.y_mm ?? 0),
        },
        endMm: {
          xMm: Number(end?.xMm ?? end?.x_mm ?? 0),
          yMm: Number(end?.yMm ?? end?.y_mm ?? 0),
        },
      };
      if (typeof raw.name === 'string' && raw.name) out.name = raw.name;
      if (raw.isWorkPlane != null || raw.is_work_plane != null) {
        out.isWorkPlane = Boolean(raw.isWorkPlane ?? raw.is_work_plane);
      }
      if (raw.pinned != null) out.pinned = Boolean(raw.pinned);
      return out as Element;
    }
    return {
      kind: 'reference_plane',
      id,
      name,
      familyEditorId: String(raw.familyEditorId ?? raw.family_editor_id ?? ''),
      isVertical: Boolean(raw.isVertical ?? raw.is_vertical),
      offsetMm: Number(raw.offsetMm ?? raw.offset_mm ?? 0),
      ...(raw.isSymmetryRef != null || raw.is_symmetry_ref != null
        ? { isSymmetryRef: Boolean(raw.isSymmetryRef ?? raw.is_symmetry_ref) }
        : {}),
    };
  }

  if (kind === 'property_line') {
    const start = (raw.startMm ?? raw.start_mm ?? raw.start) as Record<string, unknown> | undefined;
    const end = (raw.endMm ?? raw.end_mm ?? raw.end) as Record<string, unknown> | undefined;
    const cls = raw.classification;
    const validCls =
      cls === 'street' || cls === 'rear' || cls === 'side' || cls === 'other' ? cls : undefined;
    const out: Record<string, unknown> = {
      kind: 'property_line',
      id,
      startMm: {
        xMm: Number(start?.xMm ?? start?.x_mm ?? 0),
        yMm: Number(start?.yMm ?? start?.y_mm ?? 0),
      },
      endMm: {
        xMm: Number(end?.xMm ?? end?.x_mm ?? 0),
        yMm: Number(end?.yMm ?? end?.y_mm ?? 0),
      },
    };
    if (typeof raw.name === 'string' && raw.name) out.name = raw.name;
    if (raw.setbackMm != null || raw.setback_mm != null) {
      out.setbackMm = Number(raw.setbackMm ?? raw.setback_mm);
    }
    if (validCls) out.classification = validCls;
    if (raw.pinned != null) out.pinned = Boolean(raw.pinned);
    return out as Element;
  }

  if (kind === 'selection_set') {
    const rulesRaw = raw.filterRules ?? raw.filter_rules ?? [];
    const filterRules = Array.isArray(rulesRaw)
      ? rulesRaw
          .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
          .map((r) => ({
            field: (['category', 'level', 'typeName'].includes(r.field as string)
              ? r.field
              : 'category') as 'category' | 'level' | 'typeName',
            operator: (r.operator === 'contains' ? 'contains' : 'equals') as 'equals' | 'contains',
            value: String(r.value ?? ''),
          }))
      : [];
    return { kind: 'selection_set', id, name, filterRules };
  }

  if (kind === 'link_model') {
    const pos = coerceXYZ((raw.positionMm ?? raw.position_mm) as Record<string, unknown>);
    const sourceModelId = String(raw.sourceModelId ?? raw.source_model_id ?? '');
    if (!sourceModelId) return null;
    const rev = raw.sourceModelRevision ?? raw.source_model_revision;
    const alignRaw = String(raw.originAlignmentMode ?? raw.origin_alignment_mode ?? '');
    const align: 'origin_to_origin' | 'project_origin' | 'shared_coords' =
      alignRaw === 'project_origin' || alignRaw === 'shared_coords' ? alignRaw : 'origin_to_origin';
    const visRaw = String(raw.visibilityMode ?? raw.visibility_mode ?? '');
    const visibilityMode: 'host_view' | 'linked_view' =
      visRaw === 'linked_view' ? 'linked_view' : 'host_view';
    return {
      kind: 'link_model',
      id,
      name,
      sourceModelId,
      ...(rev == null ? {} : { sourceModelRevision: Number(rev) }),
      positionMm: pos,
      rotationDeg: Number(raw.rotationDeg ?? raw.rotation_deg ?? 0),
      originAlignmentMode: align,
      visibilityMode,
      ...(raw.hidden != null ? { hidden: Boolean(raw.hidden) } : {}),
      ...(raw.pinned != null ? { pinned: Boolean(raw.pinned) } : {}),
    };
  }

  if (kind === 'link_dxf') {
    const levelId = String(raw.levelId ?? raw.level_id ?? '');
    if (!levelId) return null;
    const alignRaw = String(raw.originAlignmentMode ?? raw.origin_alignment_mode ?? '');
    const align: 'origin_to_origin' | 'project_origin' | 'shared_coords' =
      alignRaw === 'project_origin' || alignRaw === 'shared_coords' ? alignRaw : 'origin_to_origin';
    const colorRaw = raw.colorMode ?? raw.color_mode;
    const colorMode: 'black_white' | 'custom' | 'native' =
      colorRaw === 'custom' || colorRaw === 'native' ? colorRaw : 'black_white';
    const opacityRaw = raw.overlayOpacity ?? raw.overlay_opacity;
    const hiddenLayerNamesRaw = raw.hiddenLayerNames ?? raw.hidden_layer_names;
    const out: Record<string, unknown> = {
      kind: 'link_dxf',
      id,
      name,
      levelId,
      originMm: coerceXY((raw.originMm ?? raw.origin_mm) as Record<string, unknown>),
      originAlignmentMode: align,
      unitOverride: raw.unitOverride ?? raw.unit_override ?? undefined,
      unitScaleToMm:
        raw.unitScaleToMm != null || raw.unit_scale_to_mm != null
          ? Number(raw.unitScaleToMm ?? raw.unit_scale_to_mm)
          : undefined,
      rotationDeg: Number(raw.rotationDeg ?? raw.rotation_deg ?? 0),
      scaleFactor: Number(raw.scaleFactor ?? raw.scale_factor ?? 1),
      linework: Array.isArray(raw.linework) ? raw.linework : [],
      dxfLayers: Array.isArray(raw.dxfLayers ?? raw.dxf_layers)
        ? (raw.dxfLayers ?? raw.dxf_layers)
        : [],
      hiddenLayerNames: Array.isArray(hiddenLayerNamesRaw)
        ? hiddenLayerNamesRaw.map((v: unknown) => String(v))
        : [],
      colorMode,
      loaded: raw.loaded == null ? true : Boolean(raw.loaded),
    };
    if (typeof raw.customColor === 'string' || typeof raw.custom_color === 'string') {
      out.customColor = String(raw.customColor ?? raw.custom_color);
    }
    if (opacityRaw != null) out.overlayOpacity = Number(opacityRaw);
    if (typeof raw.sourcePath === 'string' || typeof raw.source_path === 'string') {
      out.sourcePath = String(raw.sourcePath ?? raw.source_path);
    }
    if (raw.pinned != null) out.pinned = Boolean(raw.pinned);
    return out as Element;
  }

  if (kind === 'link_external') {
    const typeRaw = raw.externalLinkType ?? raw.external_link_type;
    const externalLinkType: 'ifc' | 'pdf' | 'image' =
      typeRaw === 'pdf' || typeRaw === 'image' ? typeRaw : 'ifc';
    const sourcePath = String(raw.sourcePath ?? raw.source_path ?? '');
    if (!sourcePath) return null;
    const alignRaw = String(raw.originAlignmentMode ?? raw.origin_alignment_mode ?? '');
    const align: 'origin_to_origin' | 'project_origin' | 'shared_coords' =
      alignRaw === 'project_origin' || alignRaw === 'shared_coords' ? alignRaw : 'origin_to_origin';
    const statusRaw = raw.reloadStatus ?? raw.reload_status;
    const reloadStatus: 'not_reloaded' | 'ok' | 'source_missing' | 'parse_error' =
      statusRaw === 'ok' || statusRaw === 'source_missing' || statusRaw === 'parse_error'
        ? statusRaw
        : 'not_reloaded';
    const opacityRaw = raw.overlayOpacity ?? raw.overlay_opacity;
    const out: Record<string, unknown> = {
      kind: 'link_external',
      id,
      name: name || String(raw.sourceName ?? raw.source_name ?? sourcePath.split('/').pop() ?? ''),
      externalLinkType,
      sourcePath,
      reloadStatus,
      loaded: raw.loaded == null ? true : Boolean(raw.loaded),
      hidden: Boolean(raw.hidden ?? false),
      originAlignmentMode: align,
      rotationDeg: Number(raw.rotationDeg ?? raw.rotation_deg ?? 0),
      scaleFactor: Number(raw.scaleFactor ?? raw.scale_factor ?? 1),
    };
    if (typeof raw.sourceName === 'string' || typeof raw.source_name === 'string') {
      out.sourceName = String(raw.sourceName ?? raw.source_name);
    }
    if (raw.sourceMetadata != null || raw.source_metadata != null) {
      const meta = raw.sourceMetadata ?? raw.source_metadata;
      out.sourceMetadata = meta && typeof meta === 'object' ? meta : {};
    }
    if (typeof raw.lastReloadMessage === 'string' || typeof raw.last_reload_message === 'string') {
      out.lastReloadMessage = String(raw.lastReloadMessage ?? raw.last_reload_message);
    }
    if (raw.originMm != null || raw.origin_mm != null) {
      out.originMm = coerceXY((raw.originMm ?? raw.origin_mm) as Record<string, unknown>);
    }
    if (raw.pinned != null) out.pinned = Boolean(raw.pinned);
    if (opacityRaw != null) out.overlayOpacity = Number(opacityRaw);
    return out as Element;
  }

  if (kind === 'project_base_point') {
    return {
      kind: 'project_base_point',
      id,
      positionMm: coerceXYZ((raw.positionMm ?? raw.position_mm) as Record<string, unknown>),
      angleToTrueNorthDeg: Number(raw.angleToTrueNorthDeg ?? raw.angle_to_true_north_deg ?? 0),
      clipped: Boolean(raw.clipped ?? false),
    };
  }

  if (kind === 'survey_point') {
    return {
      kind: 'survey_point',
      id,
      positionMm: coerceXYZ((raw.positionMm ?? raw.position_mm) as Record<string, unknown>),
      sharedElevationMm: Number(raw.sharedElevationMm ?? raw.shared_elevation_mm ?? 0),
      clipped: Boolean(raw.clipped ?? false),
    };
  }

  if (kind === 'asset_library_entry') {
    const listOfStrings = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const isAssetSymbolKind = (
      v: unknown,
    ): v is Extract<Element, { kind: 'asset_library_entry' }>['planSymbolKind'] =>
      v === 'bed' ||
      v === 'wardrobe' ||
      v === 'lamp' ||
      v === 'rug' ||
      v === 'fridge' ||
      v === 'oven' ||
      v === 'sink' ||
      v === 'counter' ||
      v === 'sofa' ||
      v === 'table' ||
      v === 'chair' ||
      v === 'toilet' ||
      v === 'bath' ||
      v === 'shower' ||
      v === 'bathroom_layout' ||
      v === 'generic';
    const thumbnailWidth = raw.thumbnailWidthMm ?? raw.thumbnail_width_mm;
    const thumbnailHeight = raw.thumbnailHeightMm ?? raw.thumbnail_height_mm;
    const planSymbolKind = raw.planSymbolKind ?? raw.plan_symbol_kind;
    const renderProxyKind = raw.renderProxyKind ?? raw.render_proxy_kind;
    const paramSchema = raw.paramSchema ?? raw.param_schema;
    return {
      kind: 'asset_library_entry',
      id,
      name,
      assetKind:
        raw.assetKind === 'family_instance' ||
        raw.assetKind === 'kit' ||
        raw.assetKind === 'decal' ||
        raw.assetKind === 'profile'
          ? raw.assetKind
          : 'block_2d',
      category:
        raw.category === 'kitchen' ||
        raw.category === 'bathroom' ||
        raw.category === 'door' ||
        raw.category === 'window' ||
        raw.category === 'decal' ||
        raw.category === 'profile' ||
        raw.category === 'casework'
          ? raw.category
          : 'furniture',
      tags: listOfStrings(raw.tags),
      disciplineTags: listOfStrings(raw.disciplineTags ?? raw.discipline_tags).filter(
        (x): x is 'arch' | 'struct' | 'mep' => x === 'arch' || x === 'struct' || x === 'mep',
      ),
      thumbnailKind: raw.thumbnailKind === 'rendered_3d' ? 'rendered_3d' : 'schematic_plan',
      ...(thumbnailWidth != null && Number.isFinite(Number(thumbnailWidth))
        ? { thumbnailWidthMm: Number(thumbnailWidth) }
        : {}),
      ...(thumbnailHeight != null && Number.isFinite(Number(thumbnailHeight))
        ? { thumbnailHeightMm: Number(thumbnailHeight) }
        : {}),
      ...(isAssetSymbolKind(planSymbolKind) ? { planSymbolKind } : {}),
      ...(isAssetSymbolKind(renderProxyKind) ? { renderProxyKind } : {}),
      ...(Array.isArray(paramSchema) ? { paramSchema } : {}),
      ...(raw.publishedFromOrgId || raw.published_from_org_id
        ? { publishedFromOrgId: String(raw.publishedFromOrgId ?? raw.published_from_org_id) }
        : {}),
      ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    };
  }

  if (kind === 'placed_asset') {
    const assetId = raw.assetId ?? raw.asset_id;
    const levelId = raw.levelId ?? raw.level_id;
    if (typeof assetId !== 'string' || typeof levelId !== 'string') return null;
    const paramValues = raw.paramValues ?? raw.param_values;
    return {
      kind: 'placed_asset',
      id,
      name,
      assetId,
      levelId,
      positionMm: coerceXY((raw.positionMm ?? raw.position_mm) as Record<string, unknown>),
      rotationDeg: Number(raw.rotationDeg ?? raw.rotation_deg ?? 0),
      ...(paramValues && typeof paramValues === 'object' && !Array.isArray(paramValues)
        ? { paramValues: paramValues as Record<string, unknown> }
        : {}),
      ...(raw.hostElementId || raw.host_element_id
        ? { hostElementId: String(raw.hostElementId ?? raw.host_element_id) }
        : {}),
    };
  }

  if (kind === 'clash_test') {
    const coerceIds = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const resultsRaw = raw.results ?? [];
    const results = Array.isArray(resultsRaw)
      ? resultsRaw
          .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
          .map((r) => ({
            elementIdA: String(r.elementIdA ?? r.element_id_a ?? ''),
            elementIdB: String(r.elementIdB ?? r.element_id_b ?? ''),
            distanceMm: Number(r.distanceMm ?? r.distance_mm ?? 0),
          }))
      : [];
    return {
      kind: 'clash_test',
      id,
      name,
      setAIds: coerceIds(raw.setAIds ?? raw.set_a_ids),
      setBIds: coerceIds(raw.setBIds ?? raw.set_b_ids),
      toleranceMm: Number(raw.toleranceMm ?? raw.tolerance_mm ?? 50),
      ...(results.length ? { results } : {}),
    };
  }

  return null;
}

export function defaultLevelId(elements: Record<string, Element>): string | undefined {
  const levels = Object.values(elements)
    .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
    .sort((a, b) => a.elevationMm - b.elevationMm);
  return levels[0]?.id;
}
