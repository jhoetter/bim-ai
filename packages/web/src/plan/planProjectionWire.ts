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
