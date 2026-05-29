/**
 * Store-level coercion of untyped JSON / wire payloads into the typed
 * `Element` / `Violation` / `EvidenceRef` shapes the Zustand store
 * promises to its consumers. Pure data flow — no DOM dependency.
 *
 * ---------------------------------------------------------------
 * DOC-CQ-02 — `as unknown` trust boundary
 * ---------------------------------------------------------------
 * This file is one of two sanctioned `as unknown` casting sites in the
 * web package (the other is `clipboard/copyPaste.ts`). Every other
 * `as unknown` cast in `packages/web/src/**` should be considered a
 * code smell unless it is migrated under this boundary.
 *
 * WHERE UNTYPED JSON ENTERS THE SYSTEM
 *   - WebSocket envelopes from `/api/v3/.../ws` carry server-side
 *     dicts that the FastAPI route serialises with `model_dump()`.
 *     They are `unknown` until validated client-side.
 *   - REST hydration: `/state` and `/seed-models/*` return raw JSON
 *     parsed via `await res.json()` — also `unknown`.
 *   - Authoring undo/redo replay: persisted `Violation` and
 *     `EvidenceRef` records may have shipped from older clients with
 *     drifted field names (snake_case vs camelCase, `quick_fix_command`
 *     vs `quickFixCommand` — both are normalised below).
 *
 * WHY `as unknown as Record<string, unknown>` IS THE CONTRACT
 *   - The store API surface promises typed `Element`, `Violation`,
 *     `EvidenceRef`. Each coerce* function takes one `unknown`, casts
 *     once to `Record<string, unknown>`, then defensively reads each
 *     field with a type guard (`typeof x === 'string'`, `Array.isArray`,
 *     etc.). Missing / mistyped fields fall back to typed defaults.
 *   - The `as unknown as Record<string, unknown>` cast is the explicit
 *     "I am crossing a trust boundary" signal. The cast must always be
 *     paired with downstream guards — never with a bare property
 *     assignment that assumes the field exists or has the right type.
 *
 * THE RULE
 *   - No `as unknown` outside this trust boundary. Downstream callers
 *     consume typed values from this module — they should never need
 *     to cast through `unknown` again. If they do, that is a signal
 *     this file's API surface is missing a coercion helper.
 *   - If a NEW trust-boundary site is needed (e.g. a new wire route
 *     payload), it must (a) live under `state/coercion/`, `clipboard/`,
 *     or `lib/`, (b) carry an equivalent doc block, and (c) be added
 *     to DOC-CQ-02's allowlist.
 *
 * FOLLOW-UP (DOC-CQ-02 optional scope, deferred): an ESLint custom
 * rule that flags `as unknown` outside the allowlist. See the matching
 * note in `clipboard/copyPaste.ts`.
 */
import type { Element, EvidenceRef, EvidenceRefKind, VGFilter, Violation, XY } from '@bim-ai/core';
import { coerceCheckpointRetentionLimit } from './backupRetention';
import { coerceAssetElement } from './coercion/assetElements';
import { coerceBuildingElement } from './coercion/buildingElements';
import { coerceCoordinationElement } from './coercion/coordinationElements';
import { coerceLinkElement } from './coercion/linkElements';
import { coerceProjectReferenceElement } from './coercion/projectReferenceElements';
import { coerceSiteElement } from './coercion/siteElements';
import { coerceSpatialElement } from './coercion/spatialElements';
import {
  coerceLoop as coerceWireLoop,
  coerceXY,
  coerceXYZ,
  type WireRecord,
} from './coercion/primitives';
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
  const viewpointRefRaw = vv.viewpointRef ?? vv.viewpoint_ref;
  const viewpointRef =
    typeof viewpointRefRaw === 'string' && viewpointRefRaw.trim()
      ? viewpointRefRaw.trim()
      : undefined;
  const evidenceRefsRaw = vv.evidenceRefs ?? vv.evidence_refs;
  const evidenceRefs = Array.isArray(evidenceRefsRaw)
    ? evidenceRefsRaw.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object'),
      )
    : undefined;
  const viewpointEvidenceRaw = vv.viewpointEvidence ?? vv.viewpoint_evidence;
  const viewpointEvidence =
    viewpointEvidenceRaw && typeof viewpointEvidenceRaw === 'object'
      ? (viewpointEvidenceRaw as Record<string, unknown>)
      : undefined;

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
    ...(viewpointRef ? { viewpointRef } : {}),
    ...(evidenceRefs ? { evidenceRefs } : {}),
    ...(viewpointEvidence ? { viewpointEvidence } : {}),
  };
}

function finiteNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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

function coerceGeoreference(raw: unknown): {
  georeference?: {
    anchorLat: number;
    anchorLon: number;
    bboxNorth: number;
    bboxSouth: number;
    bboxEast: number;
    bboxWest: number;
    contextRadiusM?: number;
  };
} {
  if (!raw || typeof raw !== 'object') return {};
  const g = raw as Record<string, unknown>;
  const anchorLat = typeof g.anchorLat === 'number' ? g.anchorLat : null;
  const anchorLon = typeof g.anchorLon === 'number' ? g.anchorLon : null;
  if (anchorLat === null || anchorLon === null) return {};
  const bboxNorth = typeof g.bboxNorth === 'number' ? g.bboxNorth : null;
  const bboxSouth = typeof g.bboxSouth === 'number' ? g.bboxSouth : null;
  const bboxEast = typeof g.bboxEast === 'number' ? g.bboxEast : null;
  const bboxWest = typeof g.bboxWest === 'number' ? g.bboxWest : null;
  if (bboxNorth === null || bboxSouth === null || bboxEast === null || bboxWest === null) {
    const contextRadiusM = typeof g.contextRadiusM === 'number' ? g.contextRadiusM : undefined;
    return {
      georeference: {
        anchorLat,
        anchorLon,
        bboxNorth: 0,
        bboxSouth: 0,
        bboxEast: 0,
        bboxWest: 0,
        contextRadiusM,
      },
    };
  }
  return { georeference: { anchorLat, anchorLon, bboxNorth, bboxSouth, bboxEast, bboxWest } };
}

export function coerceElement(id: string, raw: Record<string, unknown>): Element | null {
  const kind = raw.kind;
  const name =
    typeof raw.name === 'string' ? raw.name : kind === 'issue' ? ((raw.title as string) ?? id) : id;

  const buildingElement = coerceBuildingElement(id, name, raw as WireRecord);
  if (buildingElement) return buildingElement;

  const spatialElement = coerceSpatialElement(id, name, raw as WireRecord);
  if (spatialElement) return spatialElement;

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
            viewerClipCapElevMm: finiteNumberOrNull(
              raw.viewerClipCapElevMm !== undefined
                ? raw.viewerClipCapElevMm
                : raw.viewer_clip_cap_elev_mm,
            ),
          }
        : {}),
      ...(raw.viewerClipFloorElevMm !== undefined || raw.viewer_clip_floor_elev_mm !== undefined
        ? {
            viewerClipFloorElevMm: finiteNumberOrNull(
              raw.viewerClipFloorElevMm !== undefined
                ? raw.viewerClipFloorElevMm
                : raw.viewer_clip_floor_elev_mm,
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
      ...(raw.planOverlayEnabled !== undefined || raw.plan_overlay_enabled !== undefined
        ? { planOverlayEnabled: Boolean(raw.planOverlayEnabled ?? raw.plan_overlay_enabled) }
        : {}),
      ...(typeof raw.planOverlaySourcePlanViewId === 'string' ||
      typeof raw.plan_overlay_source_plan_view_id === 'string'
        ? {
            planOverlaySourcePlanViewId: String(
              raw.planOverlaySourcePlanViewId ?? raw.plan_overlay_source_plan_view_id,
            ),
          }
        : raw.planOverlaySourcePlanViewId === null || raw.plan_overlay_source_plan_view_id === null
          ? { planOverlaySourcePlanViewId: null }
          : {}),
      ...(raw.planOverlayOffsetMm !== undefined || raw.plan_overlay_offset_mm !== undefined
        ? {
            planOverlayOffsetMm: finiteNumberOrNull(
              raw.planOverlayOffsetMm ?? raw.plan_overlay_offset_mm,
            ),
          }
        : {}),
      ...(raw.planOverlayOpacity !== undefined || raw.plan_overlay_opacity !== undefined
        ? {
            planOverlayOpacity: finiteNumberOrNull(
              raw.planOverlayOpacity ?? raw.plan_overlay_opacity,
            ),
          }
        : {}),
      ...(raw.planOverlayLineOpacity !== undefined || raw.plan_overlay_line_opacity !== undefined
        ? {
            planOverlayLineOpacity: finiteNumberOrNull(
              raw.planOverlayLineOpacity ?? raw.plan_overlay_line_opacity,
            ),
          }
        : {}),
      ...(raw.planOverlayFillOpacity !== undefined || raw.plan_overlay_fill_opacity !== undefined
        ? {
            planOverlayFillOpacity: finiteNumberOrNull(
              raw.planOverlayFillOpacity ?? raw.plan_overlay_fill_opacity,
            ),
          }
        : {}),
      ...(raw.planOverlayAnnotationsVisible !== undefined ||
      raw.plan_overlay_annotations_visible !== undefined
        ? {
            planOverlayAnnotationsVisible: Boolean(
              raw.planOverlayAnnotationsVisible ?? raw.plan_overlay_annotations_visible,
            ),
          }
        : {}),
      ...(raw.planOverlayWitnessLinesVisible !== undefined ||
      raw.plan_overlay_witness_lines_visible !== undefined
        ? {
            planOverlayWitnessLinesVisible: Boolean(
              raw.planOverlayWitnessLinesVisible ?? raw.plan_overlay_witness_lines_visible,
            ),
          }
        : {}),
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
    return coerceWireLoop(raw, keyA, keyS);
  };

  if (kind === 'project_settings') {
    const projectNumber = raw.projectNumber ?? raw.project_number;
    const clientName = raw.clientName ?? raw.client_name;
    const projectAddress = raw.projectAddress ?? raw.project_address;
    const projectStatus = raw.projectStatus ?? raw.project_status;
    return {
      kind: 'project_settings',
      id,
      name,
      projectNumber: projectNumber ? String(projectNumber) : null,
      clientName: clientName ? String(clientName) : null,
      projectAddress: projectAddress ? String(projectAddress) : null,
      projectStatus: projectStatus ? String(projectStatus) : null,
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
      ...coerceGeoreference(raw.georeference ?? raw.georef),
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

  const siteElement = coerceSiteElement(id, name, raw as WireRecord);
  if (siteElement) return siteElement;

  if (kind === 'roof') {
    const rawMode = String(raw.roofGeometryMode ?? raw.roof_geometry_mode ?? 'mass_box');
    const rg =
      rawMode === 'gable_pitched_rectangle' ||
      rawMode === 'asymmetric_gable' ||
      rawMode === 'gable_pitched_l_shape' ||
      rawMode === 'hip' ||
      rawMode === 'flat' ||
      rawMode === 'mono_pitch'
        ? rawMode
        : 'mass_box';
    // ISSUE-53: Pultdach high-edge passes through unchanged when present.
    const rawHighEdge = raw.monoPitchHighEdge ?? raw.mono_pitch_high_edge;
    const monoPitchHighEdge: 'n' | 'e' | 's' | 'w' | undefined =
      typeof rawHighEdge === 'string' && ['n', 'e', 's', 'w'].includes(rawHighEdge)
        ? (rawHighEdge as 'n' | 'e' | 's' | 'w')
        : undefined;
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
      ...(monoPitchHighEdge ? { monoPitchHighEdge } : {}),
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

  if (kind === 'roof_join') {
    const seamModeRaw = String(raw.seamMode ?? raw.seam_mode ?? 'clip_secondary_into_primary');
    return {
      kind: 'roof_join',
      id,
      name,
      primaryRoofId: String(raw.primaryRoofId ?? raw.primary_roof_id ?? ''),
      secondaryRoofId: String(raw.secondaryRoofId ?? raw.secondary_roof_id ?? ''),
      seamMode: seamModeRaw === 'merge_at_ridge' ? 'merge_at_ridge' : 'clip_secondary_into_primary',
      pinned: Boolean(raw.pinned),
      ...(raw.phaseCreated || raw.phase_created
        ? { phaseCreated: String(raw.phaseCreated ?? raw.phase_created) }
        : {}),
      ...(raw.phaseDemolished || raw.phase_demolished
        ? { phaseDemolished: String(raw.phaseDemolished ?? raw.phase_demolished) }
        : {}),
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

  if (kind === 'facade_bay') {
    // Issue #102 — accept snake_case and camelCase keys; default unknown
    // shape values to 'rectangular' so an out-of-band payload still renders.
    const shapeRaw = String(raw.shape ?? 'rectangular');
    const shape: 'rectangular' | 'chamfered' | 'curved' = (
      ['rectangular', 'chamfered', 'curved'] as const
    ).includes(shapeRaw as never)
      ? (shapeRaw as 'rectangular' | 'chamfered' | 'curved')
      : 'rectangular';
    const chamferAngleRaw = raw.chamferAngleDeg ?? raw.chamfer_angle_deg;
    const levelIdRaw = raw.levelId ?? raw.level_id;
    const materialKeyRaw = raw.materialKey ?? raw.material_key;
    return {
      kind: 'facade_bay',
      id,
      name,
      hostWallId: String(raw.hostWallId ?? raw.host_wall_id ?? ''),
      startAlongWallMm: Number(raw.startAlongWallMm ?? raw.start_along_wall_mm ?? 0),
      endAlongWallMm: Number(raw.endAlongWallMm ?? raw.end_along_wall_mm ?? 0),
      projectionMm: Number(raw.projectionMm ?? raw.projection_mm ?? 0),
      shape,
      ...(chamferAngleRaw != null ? { chamferAngleDeg: Number(chamferAngleRaw) } : {}),
      ...(typeof levelIdRaw === 'string' ? { levelId: levelIdRaw } : {}),
      ...(typeof materialKeyRaw === 'string' ? { materialKey: materialKeyRaw } : {}),
    };
  }

  if (kind === 'structural_facade_grid') {
    // Issue #113 — Huf-Haus Pfosten-Riegel grid. Accept snake_case +
    // camelCase keys; default unknown strut patterns to 'single' so a
    // misauthored payload still renders the signature Huf-Haus diagonal.
    const patternRaw = String(raw.diagonalStrutPattern ?? raw.diagonal_strut_pattern ?? 'single');
    const diagonalStrutPattern: 'none' | 'cross' | 'single' = (
      ['none', 'cross', 'single'] as const
    ).includes(patternRaw as never)
      ? (patternRaw as 'none' | 'cross' | 'single')
      : 'single';
    const rawBeams = raw.beamHeights ?? raw.beam_heights ?? [];
    const beamHeights: number[] = Array.isArray(rawBeams)
      ? rawBeams.map((v) => Number(v)).filter((v): v is number => Number.isFinite(v) && v >= 0)
      : [];
    const memberThickRaw = raw.memberThicknessMm ?? raw.member_thickness_mm;
    const proudOffsetRaw = raw.proudOffsetMm ?? raw.proud_offset_mm;
    const timberRaw = raw.timberMaterialKey ?? raw.timber_material_key;
    const infillRaw = raw.infillMaterialKey ?? raw.infill_material_key;
    const levelIdRaw = raw.levelId ?? raw.level_id;
    return {
      kind: 'structural_facade_grid',
      id,
      name,
      hostWallId: String(raw.hostWallId ?? raw.host_wall_id ?? ''),
      postSpacingMm: Number(raw.postSpacingMm ?? raw.post_spacing_mm ?? 1500),
      beamHeights,
      diagonalStrutPattern,
      ...(memberThickRaw != null ? { memberThicknessMm: Number(memberThickRaw) } : {}),
      ...(proudOffsetRaw != null ? { proudOffsetMm: Number(proudOffsetRaw) } : {}),
      ...(typeof timberRaw === 'string' ? { timberMaterialKey: timberRaw } : {}),
      ...(typeof infillRaw === 'string' ? { infillMaterialKey: infillRaw } : {}),
      ...(typeof levelIdRaw === 'string' ? { levelId: levelIdRaw } : {}),
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

  if (kind === 'family_instance') {
    const familyTypeId = raw.familyTypeId ?? raw.family_type_id;
    if (typeof familyTypeId !== 'string') return null;
    const paramValues = raw.paramValues ?? raw.param_values;
    return {
      kind: 'family_instance',
      id,
      name,
      familyTypeId,
      ...(raw.levelId || raw.level_id ? { levelId: String(raw.levelId ?? raw.level_id) } : {}),
      ...(raw.hostViewId || raw.host_view_id
        ? { hostViewId: String(raw.hostViewId ?? raw.host_view_id) }
        : {}),
      positionMm: coerceXY((raw.positionMm ?? raw.position_mm) as Record<string, unknown>),
      rotationDeg: Number(raw.rotationDeg ?? raw.rotation_deg ?? 0),
      ...(paramValues && typeof paramValues === 'object' && !Array.isArray(paramValues)
        ? { paramValues: paramValues as Record<string, unknown> }
        : {}),
      ...(raw.hostElementId || raw.host_element_id
        ? { hostElementId: String(raw.hostElementId ?? raw.host_element_id) }
        : {}),
      ...(raw.hostAlongT !== undefined || raw.host_along_t !== undefined
        ? { hostAlongT: Number(raw.hostAlongT ?? raw.host_along_t) }
        : {}),
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
    const vgFilters = Array.isArray(raw.vgFilters ?? raw.vg_filters)
      ? ((raw.vgFilters ?? raw.vg_filters) as VGFilter[])
      : [];
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
      vgFilters,
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

  if (kind === 'view_concept_board') {
    const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];
    const attachments = rawAttachments
      .filter((attachment): attachment is Record<string, unknown> => {
        if (!attachment || typeof attachment !== 'object') return false;
        const kind = attachment.kind;
        return kind === 'image' || kind === 'pdf_page' || kind === 'note' || kind === 'model_link';
      })
      .map((attachment) => {
        const rect = (attachment.rectMm ?? attachment.rect_mm ?? {}) as Record<string, unknown>;
        const rawThreads = attachment.commentThreadIds ?? attachment.comment_thread_ids;
        return {
          id: String(attachment.id ?? ''),
          kind: attachment.kind as 'image' | 'pdf_page' | 'note' | 'model_link',
          rectMm: {
            xMm: Number(rect.xMm ?? rect.x_mm ?? 0),
            yMm: Number(rect.yMm ?? rect.y_mm ?? 0),
            widthMm: Number(rect.widthMm ?? rect.width_mm ?? 320),
            heightMm: Number(rect.heightMm ?? rect.height_mm ?? 220),
          },
          payload: attachment.payload ?? {},
          ...(Array.isArray(rawThreads)
            ? { commentThreadIds: rawThreads.map(String).filter(Boolean) }
            : {}),
        };
      });
    return {
      kind: 'view_concept_board',
      id,
      name,
      attachments,
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

  const projectReferenceElement = coerceProjectReferenceElement(id, name, raw as WireRecord);
  if (projectReferenceElement) return projectReferenceElement;

  const linkElement = coerceLinkElement(id, name, raw as WireRecord);
  if (linkElement) return linkElement;

  const assetElement = coerceAssetElement(id, name, raw as WireRecord);
  if (assetElement) return assetElement;

  const coordinationElement = coerceCoordinationElement(id, name, raw as WireRecord);
  if (coordinationElement) return coordinationElement;

  return null;
}

export function defaultLevelId(elements: Record<string, Element>): string | undefined {
  const levels = Object.values(elements)
    .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
    .sort((a, b) => a.elevationMm - b.elevationMm);
  return levels[0]?.id;
}
