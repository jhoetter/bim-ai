/** Types + parsing for `GET /models/{modelId}/projection/plan` (WP-C02/C03). */

export type Vec2Mm = { xMm: number; yMm: number };

export function coerceVec2Mm(raw: unknown): Vec2Mm {
  const o = raw as Record<string, unknown>;
  const x = Number(o.xMm ?? o.x ?? o.X ?? 0);
  const y = Number(o.yMm ?? o.y ?? o.Y ?? 0);
  return { xMm: x, yMm: y };
}

export type PlanProjectionPrimitivesV1Wire = Record<string, unknown> & {
  format: 'planProjectionPrimitives_v1';
};

export type PlanProjectionWirePayload = Record<string, unknown> & {
  format?: string;
  primitives?: PlanProjectionPrimitivesV1Wire;
};

export type PlanRoomColorLegendRow = {
  label: string;
  schemeColorHex: string;
  programmeCode?: string;
  department?: string;
};

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
    out.push(row);
  }
  return out;
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
