/** Types + parsing for `GET /models/{modelId}/projection/plan` (WP-C02/C03). */

export type Vec2Mm = { xMm: number; yMm: number };

export function coerceVec2Mm(raw: unknown): Vec2Mm {
  if (Array.isArray(raw) && raw.length >= 2) {
    return { xMm: Number(raw[0] ?? 0), yMm: Number(raw[1] ?? 0) };
  }
  const o = raw as Record<string, unknown>;
  const x = Number(o.xMm ?? o.x ?? o.X ?? 0);
  const y = Number(o.yMm ?? o.y ?? o.Y ?? 0);
  return { xMm: x, yMm: y };
}

export type PlanProjectionPrimitivesV1Wire = Record<string, unknown> & {
  format: 'planProjectionPrimitives_v1';
};

export type PlanTagStyleHintLaneWire = {
  resolvedStyleId: string;
  resolvedStyleName: string;
  source: string;
  textSizePt: number;
  labelFields?: string[];
  tagTarget?: string;
};

export type PlanTagStyleHintsWire = {
  opening?: PlanTagStyleHintLaneWire;
  room?: PlanTagStyleHintLaneWire;
};

export type PlanProjectionWirePayload = Record<string, unknown> & {
  format?: string;
  primitives?: PlanProjectionPrimitivesV1Wire;
  planTagStyleHints?: PlanTagStyleHintsWire;
};

/** Resolved template + presentation graphic multipliers (`plan_projection_wire.planGraphicHints`). */
export type PlanGraphicHintsResolved = {
  detailLevel: string;
  lineWeightScale: number;
  roomFillOpacityScale: number;
};

/** Effective plan overlay toggles (`plan_projection_wire.planAnnotationHints`). */

export type PlanAnnotationHintsResolved = {
  openingTagsVisible: boolean;
  roomLabelsVisible: boolean;
};

function readWireAnnotationBool(raw: unknown): boolean {
  if (raw === true || raw === 1 || raw === '1') return true;
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'true') return true;
  return false;
}
export type PlanRoomColorLegendRow = {
  label: string;
  schemeColorHex: string;
  programmeCode?: string;
  department?: string;
  functionLabel?: string;
};

export type RoomProgrammeLegendEvidenceV0 = {
  format: 'roomProgrammeLegendEvidence_v0';
  legendDigestSha256: string;
  rowCount: number;
  colorSeedPolicy?: string;
  orthogonalTo?: string[];
  notes?: string;
  /** Present when authoritative `bim-room-color-scheme` rows override hash fallback colours. */
  schemeOverridesSource?: string;
  schemeOverrideRowCount?: number;
};

export function extractPlanGraphicHints(
  payload: Record<string, unknown> | null | undefined,
): PlanGraphicHintsResolved | null {
  if (!payload || typeof payload !== 'object') return null;
  const h = payload.planGraphicHints ?? payload.plan_graphic_hints;
  if (!h || typeof h !== 'object') return null;
  const o = h as Record<string, unknown>;
  const detailLevel = typeof o.detailLevel === 'string' ? o.detailLevel : 'medium';
  const lineWeightScale = Number(o.lineWeightScale ?? o.line_weight_scale ?? 1);
  const roomFillOpacityScale = Number(o.roomFillOpacityScale ?? o.room_fill_opacity_scale ?? 1);
  if (!Number.isFinite(lineWeightScale) || !Number.isFinite(roomFillOpacityScale)) return null;
  return { detailLevel, lineWeightScale, roomFillOpacityScale };
}

/** Defaults to both false when the server omits the block (backward compatible). */

export function extractPlanAnnotationHints(
  payload: Record<string, unknown> | null | undefined,
): PlanAnnotationHintsResolved {
  const def = { openingTagsVisible: false, roomLabelsVisible: false };
  if (!payload || typeof payload !== 'object') return def;
  const h = payload.planAnnotationHints ?? payload.plan_annotation_hints;
  if (!h || typeof h !== 'object') return def;
  const o = h as Record<string, unknown>;
  return {
    openingTagsVisible: readWireAnnotationBool(o.openingTagsVisible ?? o.opening_tags_visible),
    roomLabelsVisible: readWireAnnotationBool(o.roomLabelsVisible ?? o.room_labels_visible),
  };
}

export function extractRoomColorLegend(
  payload: PlanProjectionWirePayload | null | undefined,
): PlanRoomColorLegendRow[] {
  if (!payload) return [];
  const raw =
    (payload.roomColorLegend as unknown) ??
    ((payload as { room_color_legend?: unknown }).room_color_legend as unknown);
  if (!Array.isArray(raw)) return [];
  const out: PlanRoomColorLegendRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label : '';
    const hex = String(o.schemeColorHex ?? o.scheme_color_hex ?? '#888888');
    if (!label) continue;
    const row: PlanRoomColorLegendRow = { label, schemeColorHex: hex };
    if (typeof o.programmeCode === 'string') row.programmeCode = o.programmeCode;
    if (typeof o.department === 'string') row.department = o.department;
    if (typeof o.functionLabel === 'string') row.functionLabel = o.functionLabel;
    out.push(row);
  }
  return out;
}

export function extractRoomProgrammeLegendEvidenceV0(
  payload: PlanProjectionWirePayload | null | undefined,
): RoomProgrammeLegendEvidenceV0 | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw =
    (payload as { roomProgrammeLegendEvidence_v0?: unknown }).roomProgrammeLegendEvidence_v0 ??
    (payload as { roomProgrammeLegendEvidenceV0?: unknown }).roomProgrammeLegendEvidenceV0;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const fmt = o.format ?? o.Format;
  if (fmt !== 'roomProgrammeLegendEvidence_v0') return null;
  const digest = String(o.legendDigestSha256 ?? o.legend_digest_sha256 ?? '').trim();
  const rc = o.rowCount ?? o.row_count;
  let rowCount: number | undefined;
  if (typeof rc === 'number' && Number.isFinite(rc)) {
    rowCount = rc;
  } else if (typeof rc === 'string' && rc.trim()) {
    const parsed = Number(rc);
    rowCount = Number.isFinite(parsed) ? parsed : undefined;
  }
  if (!digest || rowCount === undefined) return null;
  const policy =
    typeof o.colorSeedPolicy === 'string'
      ? o.colorSeedPolicy
      : typeof o.color_seed_policy === 'string'
        ? o.color_seed_policy
        : undefined;
  const orthoRaw = o.orthogonalTo ?? o.orthogonal_to;
  let orthogonalTo: string[] | undefined;
  if (Array.isArray(orthoRaw)) {
    orthogonalTo = orthoRaw.filter((x): x is string => typeof x === 'string');
  }
  const notes = typeof o.notes === 'string' ? o.notes : undefined;
  const sos = o.schemeOverridesSource ?? o.scheme_overrides_source;
  const schemeOverridesSource = typeof sos === 'string' && sos.trim() ? sos.trim() : undefined;
  const sorc = o.schemeOverrideRowCount ?? o.scheme_override_row_count;
  let schemeOverrideRowCount: number | undefined;
  if (typeof sorc === 'number' && Number.isFinite(sorc)) {
    schemeOverrideRowCount = sorc;
  } else if (typeof sorc === 'string' && sorc.trim()) {
    const p = Number(sorc);
    if (Number.isFinite(p)) schemeOverrideRowCount = p;
  }
  return {
    format: 'roomProgrammeLegendEvidence_v0',
    legendDigestSha256: digest,
    rowCount,
    ...(policy !== undefined ? { colorSeedPolicy: policy } : {}),
    ...(orthogonalTo !== undefined && orthogonalTo.length ? { orthogonalTo } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(schemeOverridesSource !== undefined ? { schemeOverridesSource } : {}),
    ...(schemeOverrideRowCount !== undefined ? { schemeOverrideRowCount } : {}),
  };
}

function readPlanTagStyleLaneHint(raw: unknown): PlanTagStyleHintLaneWire | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.resolvedStyleId === 'string' ? o.resolvedStyleId : '';
  const nm = typeof o.resolvedStyleName === 'string' ? o.resolvedStyleName : '';
  const src = typeof o.source === 'string' ? o.source : '';
  const tsp = Number(o.textSizePt ?? o.text_size_pt ?? 10);
  if (!id || !src || !Number.isFinite(tsp)) return null;
  const lfRaw = o.labelFields ?? o.label_fields;
  const labelFields = Array.isArray(lfRaw)
    ? lfRaw.filter((x): x is string => typeof x === 'string')
    : undefined;
  const tt = o.tagTarget ?? o.tag_target;
  return {
    resolvedStyleId: id,
    resolvedStyleName: nm,
    source: src,
    textSizePt: tsp,
    ...(labelFields?.length ? { labelFields } : {}),
    ...(typeof tt === 'string' && tt ? { tagTarget: tt } : {}),
  };
}

/** Server `planTagStyleHints` when plan view is pinned (WP-C02). */

export function extractPlanTagStyleHints(
  payload: Record<string, unknown> | null | undefined,
): PlanTagStyleHintsWire | null {
  if (!payload || typeof payload !== 'object') return null;
  const h = payload.planTagStyleHints ?? payload.plan_tag_style_hints;
  if (!h || typeof h !== 'object') return null;
  const o = h as Record<string, unknown>;
  const opening = readPlanTagStyleLaneHint(o.opening);
  const room = readPlanTagStyleLaneHint(o.room);
  if (!opening && !room) return null;
  return { ...(opening ? { opening } : {}), ...(room ? { room } : {}) };
}

export function isPlanProjectionPrimitivesV1(p: unknown): p is PlanProjectionPrimitivesV1Wire {
  const o = p as Record<string, unknown> | null;
  return Boolean(o && o.format === 'planProjectionPrimitives_v1');
}

export function extractPlanPrimitives(
  payload: Record<string, unknown> | null | undefined,
): PlanProjectionPrimitivesV1Wire | null {
  if (!payload) return null;
  const p = payload.primitives;
  return isPlanProjectionPrimitivesV1(p) ? p : null;
}

export function buildPlanProjectionQuery(params: {
  planViewId?: string;
  fallbackLevelId?: string;
  globalPresentation: string;
}): URLSearchParams {
  const qs = new URLSearchParams();
  if (params.planViewId) qs.set('planViewId', params.planViewId);
  if (params.fallbackLevelId) qs.set('fallbackLevelId', params.fallbackLevelId);
  qs.set('globalPresentation', params.globalPresentation);
  return qs;
}

export async function fetchPlanProjectionWire(
  modelId: string,
  qs: URLSearchParams,
): Promise<PlanProjectionWirePayload> {
  const url = `/api/models/${encodeURIComponent(modelId)}/projection/plan?${qs.toString()}`;
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${txt}`);
  return JSON.parse(txt) as PlanProjectionWirePayload;
}
