import { create } from 'zustand';

import type {
  Element,
  ModelDelta,
  PerspectiveId,
  Snapshot,
  Violation,
  WorkspaceLayoutPreset,
  XY,
} from '@bim-ai/core';

import type { PlanPresentationPreset } from '../plan/symbology';
import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';

export type ViewerMode = 'plan_canvas' | 'orbit_3d';

export type PlanTool =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'room'
  | 'room_rectangle'
  | 'grid'
  | 'dimension';

export type PresencePeers = Record<
  string,
  {
    peerId?: string;
    userId?: string;
    name?: string;
    color?: string;
    cursorMm?: { xMm: number; yMm: number };
    selectionId?: string;
    viewer?: string;
  }
>;

export type UxComment = {
  id: string;
  userDisplay: string;
  body: string;
  elementId?: string | null;
  levelId?: string | null;
  anchorXMm?: number | null;
  anchorYMm?: number | null;
  resolved: boolean;
  createdAt?: string;
};

export type ActivityEvent = {
  id: number;
  userId: string;
  revisionAfter: number;
  createdAt: string;
  commandTypes: string[];
};

type StoreState = {
  modelId?: string;
  revision: number;
  elementsById: Record<string, Element>;
  violations: Violation[];
  selectedId?: string;
  viewerMode: ViewerMode;
  planTool: PlanTool;
  activeLevelId?: string;
  planPresentationPreset: PlanPresentationPreset;
  activePlanViewId?: string;
  /** Saved 3D viewpoint whose clip/layer tweaks should persist via `updateElementProperty`. */
  activeViewpointId?: string;
  /** When set, plan canvas prefers server `planProjectionWire_v1.primitives` (WP-C02/C03). */
  planProjectionPrimitives: PlanProjectionPrimitivesV1Wire | null;
  viewerClipElevMm: number | null;
  /** Optional lower bound — clips geometry *below* this world Y (mm) for a reproducible slab cut. */
  viewerClipFloorElevMm: number | null;
  /** When true for a semantic kind (`wall`, `roof`, …), that category is hidden in 3D. */
  viewerCategoryHidden: Record<string, boolean>;
  orthoSnapHold: boolean;
  userId: string;
  userDisplayName: string;
  peerId: string;
  presencePeers: PresencePeers;
  comments: UxComment[];
  activityEvents: ActivityEvent[];
  buildingPreset: string;
  planHudMm?: { xMm: number; yMm: number };
  workspaceLayoutPreset: WorkspaceLayoutPreset;
  perspectiveId: PerspectiveId;

  /** Bump to push a saved orbit viewpoint camera into Viewport three.js rig (WP-E02/E03). */
  orbitCameraNonce: number;
  /** Optional camera pose in model mm conventions (plan x/zMm as world-up). */
  orbitCameraPoseMm: {
    position: { xMm: number; yMm: number; zMm: number };
    target: { xMm: number; yMm: number; zMm: number };
    up: { xMm: number; yMm: number; zMm: number };
  } | null;

  hydrateFromSnapshot: (snap: Snapshot) => void;
  applyDelta: (d: ModelDelta) => void;
  select: (id?: string) => void;
  setViewerMode: (m: ViewerMode) => void;
  setPlanTool: (t: PlanTool) => void;
  setActiveLevelId: (id: string | undefined) => void;
  setOrthoSnapHold: (v: boolean) => void;
  setPresencePeers: (peers: PresencePeers) => void;
  setComments: (c: UxComment[]) => void;
  mergeComment: (c: UxComment) => void;
  setBuildingPreset: (preset: string) => void;
  setPlanHud: (mm?: { xMm: number; yMm: number }) => void;
  setWorkspaceLayoutPreset: (p: WorkspaceLayoutPreset) => void;
  setPerspectiveId: (p: PerspectiveId) => void;
  setPlanPresentationPreset: (p: PlanPresentationPreset) => void;

  activatePlanView: (planViewElementId: string | undefined) => void;
  setActiveViewpointId: (viewpointElementId?: string) => void;
  setViewerClipElevMm: (mm: number | null) => void;
  setViewerClipFloorElevMm: (mm: number | null) => void;
  setPlanProjectionPrimitives: (p: PlanProjectionPrimitivesV1Wire | null) => void;
  toggleViewerCategoryHidden: (semanticKind: string) => void;
  /** Apply saved 3D viewpoint clip planes + semantic category hides (WP-E02/E03). */
  applyOrbitViewpointPreset: (opts: {
    capElevMm?: number | null;
    floorElevMm?: number | null;
    hideSemanticKinds?: string[];
  }) => void;
  /** Feed Viewport orbital camera rig from element camera mm payload. */
  setOrbitCameraFromViewpointMm: (opts: {
    position: { xMm: number; yMm: number; zMm: number };
    target: { xMm: number; yMm: number; zMm: number };
    up: { xMm: number; yMm: number; zMm: number };
  }) => void;

  setActivity: (e: ActivityEvent[]) => void;
  setIdentity: (userId: string, display: string, peerId: string) => void;
};

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
    };
  }

  if (kind === 'issue') {
    const statusRaw = raw.status;
    const status =
      statusRaw === 'done' ? 'done' : statusRaw === 'in_progress' ? 'in_progress' : 'open';
    const elementIdsRaw = raw.elementIds ?? raw.element_ids ?? [];
    const elementIds =
      Array.isArray(elementIdsRaw) && elementIdsRaw.every((x) => typeof x === 'string')
        ? elementIdsRaw
        : [];
    const title = typeof raw.title === 'string' ? raw.title : name;
    return {
      kind: 'issue',
      id,
      title,
      status,
      elementIds,
      viewpointId: (raw.viewpointId ?? raw.viewpoint_id ?? null) as string | null,
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
      insulationExtensionMm: Number(raw.insulationExtensionMm ?? raw.insulation_extension_mm ?? 0),
      roomBounded: Boolean(raw.roomBounded ?? raw.room_bounded),
    };
  }

  if (kind === 'roof') {
    return {
      kind: 'roof',
      id,
      name,
      referenceLevelId: String(raw.referenceLevelId ?? raw.reference_level_id ?? ''),
      footprintMm: coerceLoop('footprintMm', 'footprint_mm'),
      overhangMm: Number(raw.overhangMm ?? raw.overhang_mm ?? 400),
      slopeDeg: raw.slopeDeg !== undefined ? Number(raw.slopeDeg) : null,
      edgeSlopeFlags:
        typeof raw.edgeSlopeFlags === 'object' && raw.edgeSlopeFlags
          ? (raw.edgeSlopeFlags as Record<string, boolean>)
          : undefined,
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

  if (kind === 'family_type') {
    const d = raw.discipline;
    const discipline = d === 'door' || d === 'window' || d === 'generic' ? d : 'generic';
    return {
      kind: 'family_type',
      id,
      discipline,
      parameters:
        raw.parameters && typeof raw.parameters === 'object'
          ? (raw.parameters as Record<string, unknown>)
          : {},
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
    return {
      kind: 'view_template',
      id,
      name,
      scale,
      disciplinesVisible: disciplinesVisible.length ? disciplinesVisible : undefined,
      hiddenCategories: hiddenCategories.length ? hiddenCategories : undefined,
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
    return {
      kind: 'bcf',
      id,
      title: typeof raw.title === 'string' ? raw.title : id,
      viewpointRef: (raw.viewpointRef ?? raw.viewpoint_ref ?? null) as string | null,
      status: typeof raw.status === 'string' ? raw.status : 'open',
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

  return null;
}

function defaultLevelId(elements: Record<string, Element>): string | undefined {
  const levels = Object.values(elements)
    .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
    .sort((a, b) => a.elevationMm - b.elevationMm);
  return levels[0]?.id;
}

function readThemeDark(): boolean {
  try {
    return localStorage.getItem('bim.theme') === 'dark';
  } catch {
    return false;
  }
}

function writeThemeDark(dark: boolean) {
  try {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('bim.theme', dark ? 'dark' : 'light');
  } catch {
    /* noop */
  }
}

/** Call once from `main.tsx` before render. */

export function initThemeFromStorage() {
  writeThemeDark(readThemeDark());
}

export function toggleStoredTheme(): boolean {
  try {
    const next = !document.documentElement.classList.contains('dark');
    writeThemeDark(next);

    return next;
  } catch {
    return false;
  }
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

    viewerClipElevMm: null,

    viewerClipFloorElevMm: null,

    viewerCategoryHidden: {},

    orbitCameraNonce: 0,

    orbitCameraPoseMm: null,

    activePlanViewId: undefined,

    activeViewpointId: undefined,

    planProjectionPrimitives: null,

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
        activePlanViewId: pv && merged[pv]?.kind === 'plan_view' ? pv : undefined,
        activeViewpointId: vp && merged[vp]?.kind === 'viewpoint' ? vp : undefined,
      });
    },

    select: (id) => set({ selectedId: id }),

    setViewerMode: (m) => set({ viewerMode: m }),

    setPlanTool: (t) => set({ planTool: t }),

    setActiveLevelId: (id) => set({ activeLevelId: id }),

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

    activatePlanView: (planViewElementId) => {
      if (!planViewElementId) {
        set({ activePlanViewId: undefined });
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
      set({
        activePlanViewId: planViewElementId,
        activeViewpointId: undefined,
        activeLevelId: el.levelId,
        planPresentationPreset: normalized,
      });
    },

    setActiveViewpointId: (viewpointElementId) => set({ activeViewpointId: viewpointElementId }),

    setViewerClipElevMm: (viewerClipElevMm) => set({ viewerClipElevMm }),

    setViewerClipFloorElevMm: (viewerClipFloorElevMm) => set({ viewerClipFloorElevMm }),

    setPlanProjectionPrimitives: (planProjectionPrimitives) => set({ planProjectionPrimitives }),

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
  };
});
