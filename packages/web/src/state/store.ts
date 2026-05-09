import { create } from 'zustand';

import type {
  Element,
  EvidenceRef,
  EvidenceRefKind,
  LensMode,
  PerspectiveId,
  Violation,
  WorkspaceLayoutPreset,
  XY,
} from '@bim-ai/core';

import type { PlanPresentationPreset } from '../plan/symbology';

import type { StoreState } from './storeTypes';

export type {
  PlanRoomSchemeWireReadout,
  ViewerMode,
  PlanTool,
  PresencePeers,
  UxComment,
  ActivityEvent,
  CategoryOverride,
  CategoryOverrides,
} from './storeTypes';

function coerceViolation(v: unknown): Violation {
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

function coerceElement(id: string, raw: Record<string, unknown>): Element | null {
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

  if (kind === 'roof') {
    const rg =
      raw.roofGeometryMode === 'gable_pitched_rectangle' ||
      raw.roof_geometry_mode === 'gable_pitched_rectangle'
        ? ('gable_pitched_rectangle' as const)
        : ('mass_box' as const);
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
    const viewFilters = Array.isArray(vfRaw) ? (vfRaw as import('./storeTypes').ViewFilter[]) : [];
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
      planViewSubtype:
        typeof raw.planViewSubtype === 'string' && raw.planViewSubtype
          ? (raw.planViewSubtype as 'floor_plan' | 'lighting_plan' | 'power_plan' | 'coordination_plan')
          : undefined,
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
      name,
      planViewId: String(raw.planViewId ?? raw.plan_view_id ?? ''),
      positionMm: coerceXY((raw.positionMm ?? raw.position_mm ?? {}) as Record<string, unknown>),
      schemeField: String(raw.schemeField ?? raw.scheme_field ?? 'programmeCode'),
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

function defaultLevelId(elements: Record<string, Element>): string | undefined {
  const levels = Object.values(elements)
    .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
    .sort((a, b) => a.elevationMm - b.elevationMm);
  return levels[0]?.id;
}

/** Theme controls live in `./theme.ts`. These exports preserve the
 * existing call-site API while delegating to the canonical module. */

export {
  initTheme as initThemeFromStorage,
  toggleTheme,
  applyTheme,
  getCurrentTheme,
  readPreferredTheme,
  prefersReducedMotion,
  type Theme,
} from './theme';

import { toggleTheme as _toggleTheme } from './theme';

/** Back-compat: returns `true` when the new theme is dark. */
export function toggleStoredTheme(): boolean {
  return _toggleTheme() === 'dark';
}

export function newPeerIdentity() {
  try {
    const k = crypto.randomUUID();

    return k;
  } catch {
    return `peer-${Math.random().toString(36).slice(2)}`;
  }
}

export const useBimStore = create<StoreState>((set, get) => {
  let peerIdStored = '';

  try {
    peerIdStored = sessionStorage.getItem('bim.peerId') ?? '';
  } catch {
    peerIdStored = '';
  }

  const peerSeed =
    peerIdStored ||
    (() => {
      const p = newPeerIdentity();

      try {
        sessionStorage.setItem('bim.peerId', p);
      } catch {
        /* noop */
      }

      return p;
    })();

  try {
    sessionStorage.setItem('bim.peerId', peerSeed);
  } catch {
    /* noop */
  }

  return {
    revision: 0,

    elementsById: {},

    violations: [],

    viewerMode: 'orbit_3d',

    planTool: 'select',

    wallLocationLine: 'wall-centerline',

    applyAreaRules: true,

    floorBoundaryOffsetMm: 0,

    wallDrawOffsetMm: 0,

    wallDrawHeightMm: 2800,

    activeWallTypeId: null,

    activeFloorTypeId: null,

    orthoSnapHold: false,
    userId: (() => {
      try {
        const u = sessionStorage.getItem('bim.userId');

        if (u) return u;

        const nid = crypto.randomUUID();

        sessionStorage.setItem('bim.userId', nid);

        return nid;
      } catch {
        return `user-${Math.random().toString(36).slice(2)}`;
      }
    })(),

    userDisplayName: (() => {
      try {
        return sessionStorage.getItem('bim.displayName') || 'Collaborator';
      } catch {
        return 'Collaborator';
      }
    })(),

    peerId: peerSeed,

    presencePeers: {},

    comments: [],

    activityEvents: [],

    planHudMm: undefined,

    buildingPreset: (() => {
      try {
        return localStorage.getItem('bim.buildingPreset') || 'residential';
      } catch {
        return 'residential';
      }
    })(),

    workspaceLayoutPreset: ((): WorkspaceLayoutPreset => {
      const allowed: WorkspaceLayoutPreset[] = [
        'classic',
        'split_plan_3d',
        'split_plan_section',
        'coordination',
        'schedules_focus',
        'agent_review',
      ];
      try {
        const raw = localStorage.getItem('bim.workspaceLayout');
        if (raw && allowed.includes(raw as WorkspaceLayoutPreset))
          return raw as WorkspaceLayoutPreset;
      } catch {
        /* noop */
      }
      return 'classic';
    })(),

    perspectiveId: ((): PerspectiveId => {
      const allowed: PerspectiveId[] = [
        'architecture',
        'structure',
        'mep',
        'coordination',
        'construction',
        'agent',
      ];
      try {
        const raw = localStorage.getItem('bim.perspective');
        if (raw && allowed.includes(raw as PerspectiveId)) return raw as PerspectiveId;
      } catch {
        /* noop */
      }
      return 'architecture';
    })(),

    planPresentationPreset: ((): PlanPresentationPreset => {
      const allowed: PlanPresentationPreset[] = ['default', 'opening_focus', 'room_scheme'];

      try {
        const raw = localStorage.getItem('bim.planPresentation');

        if (raw && allowed.includes(raw as PlanPresentationPreset))
          return raw as PlanPresentationPreset;
      } catch {
        /* noop */
      }

      return 'default';
    })(),

    lensMode: 'all' as LensMode,

    viewerClipElevMm: null,

    viewerClipFloorElevMm: null,

    // KRN-06: site/origin markers hidden by default; user toggles via VV.
    viewerCategoryHidden: { site_origin: true },

    // SKB-23: no phase filter active by default — every element renders.
    viewerPhaseFilter: null,

    orbitCameraNonce: 0,

    orbitCameraPoseMm: null,

    activePlanViewId: undefined,

    activeViewpointId: undefined,

    planProjectionPrimitives: null,

    planRoomSchemeWireReadout: null,

    scheduleBudgetHydration: null,

    lastLevelElevationPropagationEvidence: null,

    linkSourceRevisions: {},

    hydrateFromSnapshot: (snap) => {
      const elements: Record<string, Element> = {};

      for (const [id, raw] of Object.entries(snap.elements ?? {})) {
        const typed = coerceElement(id, raw as Record<string, unknown>);
        if (typed) elements[id] = typed;
      }

      const curLevel = get().activeLevelId;
      const prevPv = get().activePlanViewId;
      const prevVp = get().activeViewpointId;

      set({
        modelId: snap.modelId,

        revision: snap.revision,

        elementsById: elements,

        violations: (snap.violations ?? []).map(coerceViolation),

        activeLevelId:
          curLevel && elements[curLevel]?.kind === 'level' ? curLevel : defaultLevelId(elements),
        planProjectionPrimitives: null,

        planRoomSchemeWireReadout: null,

        scheduleBudgetHydration: null,

        lastLevelElevationPropagationEvidence: null,

        linkSourceRevisions:
          snap.linkSourceRevisions && typeof snap.linkSourceRevisions === 'object'
            ? { ...snap.linkSourceRevisions }
            : {},

        activePlanViewId: prevPv && elements[prevPv]?.kind === 'plan_view' ? prevPv : undefined,
        activeViewpointId: prevVp && elements[prevVp]?.kind === 'viewpoint' ? prevVp : undefined,
      });
    },

    applyDelta: (d) => {
      const merged = { ...get().elementsById };

      const dels = Array.isArray((d as { removedIds?: unknown }).removedIds)
        ? (d.removedIds as string[])
        : Array.isArray((d as { removed_ids?: unknown }).removed_ids)
          ? (d as unknown as { removed_ids: string[] }).removed_ids
          : [];

      for (const rid of dels) {
        delete merged[rid];
      }

      for (const [eid, raw] of Object.entries(d.elements ?? {})) {
        const typed = coerceElement(eid, raw as Record<string, unknown>);

        if (typed) merged[eid] = typed;
      }

      const st = get();
      const pv = st.activePlanViewId;
      const vp = st.activeViewpointId;

      set({
        revision: d.revision,

        elementsById: merged,

        violations: (d.violations ?? []).map(coerceViolation),

        planProjectionPrimitives: null,

        planRoomSchemeWireReadout: null,

        scheduleBudgetHydration: null,

        lastLevelElevationPropagationEvidence: null,

        activePlanViewId: pv && merged[pv]?.kind === 'plan_view' ? pv : undefined,
        activeViewpointId: vp && merged[vp]?.kind === 'viewpoint' ? vp : undefined,
      });
    },

    select: (id) => set({ selectedId: id }),

    /** FAM-10: paste-side merge — append elements without deleting any. */
    mergeElements: (elements) =>
      set((s) => {
        const next = { ...s.elementsById };
        for (const el of elements) {
          if (el && typeof (el as { id?: unknown }).id === 'string') {
            next[(el as { id: string }).id] = el as Element;
          }
        }
        return { elementsById: next };
      }),

    /** FAM-10: paste-side family imports — register user families. */
    importFamilyDefinitions: (defs) =>
      set((s) => {
        const next = { ...(s.userFamilies ?? {}) };
        for (const def of defs) next[def.id] = def;
        return { userFamilies: next };
      }),

    setViewerMode: (m) => set({ viewerMode: m }),

    setPlanTool: (t) => set({ planTool: t }),

    setActiveLevelId: (id) => set({ activeLevelId: id }),

    setWallLocationLine: (wallLocationLine) => set({ wallLocationLine }),

    setApplyAreaRules: (v) => set({ applyAreaRules: v }),

    setFloorBoundaryOffsetMm: (floorBoundaryOffsetMm) => set({ floorBoundaryOffsetMm }),

    setWallDrawOffsetMm: (wallDrawOffsetMm) => set({ wallDrawOffsetMm }),

    setWallDrawHeightMm: (wallDrawHeightMm) => set({ wallDrawHeightMm }),

    setActiveWallTypeId: (activeWallTypeId) => set({ activeWallTypeId }),

    setActiveFloorTypeId: (activeFloorTypeId) => set({ activeFloorTypeId }),

    setOrthoSnapHold: (v) => set({ orthoSnapHold: v }),

    setPresencePeers: (peers) => set({ presencePeers: peers }),

    setComments: (c) => set({ comments: c }),

    mergeComment: (c) =>
      set(() => {
        const nx = [...get().comments.filter((x) => x.id !== c.id), c].sort((a, b) =>
          String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
        );

        return { comments: nx };
      }),

    setPlanHud: (mm) => set({ planHudMm: mm }),

    setBuildingPreset: (preset) =>
      set(() => {
        try {
          localStorage.setItem('bim.buildingPreset', preset);
        } catch {
          /* noop */
        }
        return { buildingPreset: preset };
      }),

    setWorkspaceLayoutPreset: (preset) =>
      set(() => {
        try {
          localStorage.setItem('bim.workspaceLayout', preset);
        } catch {
          /* noop */
        }
        return { workspaceLayoutPreset: preset };
      }),

    setPerspectiveId: (perspectiveId) =>
      set(() => {
        try {
          localStorage.setItem('bim.perspective', perspectiveId);
        } catch {
          /* noop */
        }
        return { perspectiveId };
      }),

    setPlanPresentationPreset: (planPresentationPreset) =>
      set(() => {
        try {
          localStorage.setItem('bim.planPresentation', planPresentationPreset);
        } catch {
          /* noop */
        }
        return { planPresentationPreset };
      }),

    setLensMode: (lensMode) => set(() => ({ lensMode })),

    activatePlanView: (planViewElementId) => {
      if (!planViewElementId) {
        // VIE-04: leaving the plan view also drops any temporary visibility
        // override (matches Revit's "switching view clears it" behaviour).
        set({ activePlanViewId: undefined, temporaryVisibility: null });
        return;
      }
      const el = get().elementsById[planViewElementId];
      if (!el || el.kind !== 'plan_view') return;
      const preset = el.planPresentation ?? 'default';
      const normalized: PlanPresentationPreset =
        preset === 'opening_focus' || preset === 'room_scheme' ? preset : 'default';
      try {
        localStorage.setItem('bim.planPresentation', normalized);
      } catch {
        /* noop */
      }
      const prior = get().temporaryVisibility;
      // VIE-04: keep the override only when re-entering the same view.
      const nextTemp = prior && prior.viewId === planViewElementId ? prior : null;
      set({
        activePlanViewId: planViewElementId,
        activeViewpointId: undefined,
        activeLevelId: el.levelId,
        planPresentationPreset: normalized,
        viewerMode: 'plan_canvas',
        temporaryVisibility: nextTemp,
      });
    },

    setActiveViewpointId: (viewpointElementId) => {
      const prior = get().temporaryVisibility;
      // VIE-04: same logic for orbit_3d viewpoints.
      const nextTemp = prior && prior.viewId === viewpointElementId ? prior : null;
      set({ activeViewpointId: viewpointElementId, temporaryVisibility: nextTemp });
    },

    // VIE-03: activate an elevation_view as the central canvas's view scope.
    activateElevationView: (elevationViewElementId) => {
      if (!elevationViewElementId) {
        set({ activeElevationViewId: undefined, temporaryVisibility: null });
        return;
      }
      const el = get().elementsById[elevationViewElementId];
      if (!el || el.kind !== 'elevation_view') return;
      const prior = get().temporaryVisibility;
      // VIE-04: keep the override only when re-entering the same view.
      const nextTemp = prior && prior.viewId === elevationViewElementId ? prior : null;
      set({
        activeElevationViewId: elevationViewElementId,
        activePlanViewId: undefined,
        activeViewpointId: undefined,
        viewerMode: 'plan_canvas',
        temporaryVisibility: nextTemp,
      });
    },

    setViewerClipElevMm: (viewerClipElevMm) => set({ viewerClipElevMm }),

    setViewerClipFloorElevMm: (viewerClipFloorElevMm) => set({ viewerClipFloorElevMm }),

    setPlanProjectionPrimitives: (planProjectionPrimitives) =>
      planProjectionPrimitives === null
        ? set({ planProjectionPrimitives: null, planRoomSchemeWireReadout: null })
        : set({ planProjectionPrimitives }),

    setPlanRoomSchemeWireReadout: (planRoomSchemeWireReadout) => set({ planRoomSchemeWireReadout }),

    setScheduleBudgetHydration: (scheduleBudgetHydration) => set({ scheduleBudgetHydration }),

    toggleViewerCategoryHidden: (semanticKind) =>
      set(() => {
        const prior = get().viewerCategoryHidden[semanticKind];
        const next = { ...get().viewerCategoryHidden, [semanticKind]: !prior };
        return { viewerCategoryHidden: next };
      }),

    applyOrbitViewpointPreset: (opts) =>
      set((state) => {
        const LayerKeys = ['wall', 'floor', 'roof', 'stair', 'door', 'window', 'room'] as const;
        let viewerClipElevMm = state.viewerClipElevMm;
        if ('capElevMm' in opts) {
          const v = opts.capElevMm;
          viewerClipElevMm =
            v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v) ? v : null;
        }
        let viewerClipFloorElevMm = state.viewerClipFloorElevMm;
        if ('floorElevMm' in opts) {
          const v = opts.floorElevMm;
          viewerClipFloorElevMm =
            v !== undefined && v !== null && typeof v === 'number' && Number.isFinite(v) ? v : null;
        }
        let viewerCategoryHidden = state.viewerCategoryHidden;
        if (opts.hideSemanticKinds !== undefined) {
          const hid = new Set(opts.hideSemanticKinds);
          viewerCategoryHidden = { ...state.viewerCategoryHidden };
          for (const lk of LayerKeys) {
            viewerCategoryHidden[lk] = hid.has(lk);
          }
        }
        return {
          viewerClipElevMm,
          viewerClipFloorElevMm,
          viewerCategoryHidden,
        };
      }),

    setOrbitCameraFromViewpointMm: ({ position, target, up }) =>
      set((state) => ({
        orbitCameraPoseMm: { position, target, up },
        orbitCameraNonce: state.orbitCameraNonce + 1,
      })),

    setActivity: (e) => set({ activityEvents: e }),

    setIdentity: (userId, userDisplayName, peerId) =>
      set(() => {
        try {
          sessionStorage.setItem('bim.userId', userId);

          sessionStorage.setItem('bim.displayName', userDisplayName);

          sessionStorage.setItem('bim.peerId', peerId);
        } catch {
          /* noop */
        }

        return { userId, userDisplayName: userDisplayName, peerId };
      }),

    // F-011: default to shaded mode.
    viewerRenderStyle: 'shaded',

    setViewerRenderStyle: (style) => set({ viewerRenderStyle: style }),

    // F-014: reveal hidden elements mode (lightbulb). Off by default.
    revealHiddenMode: false,

    setRevealHiddenMode: (v) => set({ revealHiddenMode: v }),

    // OSM-V3-02: neighborhood mass layer visible by default.
    showNeighborhoodMasses: true,

    toggleNeighborhoodMasses: () =>
      set((s) => ({ showNeighborhoodMasses: !s.showNeighborhoodMasses })),

    vvDialogOpen: false,

    openVVDialog: () => set({ vvDialogOpen: true }),

    closeVVDialog: () => set({ vvDialogOpen: false }),

    setCategoryOverride: (planViewId, categoryKey, override) => {
      const { elementsById } = get();
      const pv = elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const prevOverrides =
        (pv.categoryOverrides as import('./storeTypes').CategoryOverrides) ?? {};
      const newOverrides = { ...prevOverrides, [categoryKey]: override };
      set({
        elementsById: {
          ...elementsById,
          [planViewId]: { ...pv, categoryOverrides: newOverrides },
        },
      });
    },
    addViewFilter: (planViewId, filter) => {
      const { elementsById } = get();
      const pv = elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const prevFilters = (pv.viewFilters as import('./storeTypes').ViewFilter[] | undefined) ?? [];
      const updated = [...prevFilters, filter];
      set({ elementsById: { ...elementsById, [planViewId]: { ...pv, viewFilters: updated } } });
    },
    updateViewFilter: (planViewId, filterId, patch) => {
      const { elementsById } = get();
      const pv = elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const prevFilters = (pv.viewFilters as import('./storeTypes').ViewFilter[] | undefined) ?? [];
      const updated = prevFilters.map((f) => (f.id === filterId ? { ...f, ...patch } : f));
      set({ elementsById: { ...elementsById, [planViewId]: { ...pv, viewFilters: updated } } });
    },
    removeViewFilter: (planViewId, filterId) => {
      const { elementsById } = get();
      const pv = elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const prevFilters = (pv.viewFilters as import('./storeTypes').ViewFilter[] | undefined) ?? [];
      const updated = prevFilters.filter((f) => f.id !== filterId);
      set({ elementsById: { ...elementsById, [planViewId]: { ...pv, viewFilters: updated } } });
    },

    // VIE-04 — temporary isolate / hide category. Lives in client memory only;
    // never round-trips through the engine, never persisted in snapshots.
    temporaryVisibility: null,
    setTemporaryVisibility: (next) => set({ temporaryVisibility: next }),
    clearTemporaryVisibility: () => set({ temporaryVisibility: null }),
    // SKB-23: per-phase preview filter actions.
    setViewerPhaseFilter: (next) => set({ viewerPhaseFilter: next }),
    clearViewerPhaseFilter: () => set({ viewerPhaseFilter: null }),
  };
});

// E2E hook: expose the store on window so Playwright tests can drive
// viewpoint activation without UI interaction. Compiled out of release
// bundles via the DEV / E2E env check (VITE_E2E_DISABLE_WS doubles as a
// general "this is an e2e build" gate; production builds set neither).
try {
  const e2eFlag =
    typeof import.meta.env.VITE_E2E_DISABLE_WS === 'string' &&
    ['1', 'true', 'yes'].includes(import.meta.env.VITE_E2E_DISABLE_WS.trim().toLowerCase());
  if (e2eFlag && typeof window !== 'undefined') {
    (window as unknown as { __bimStore?: typeof useBimStore }).__bimStore = useBimStore;
  }
} catch {
  /* noop */
}
