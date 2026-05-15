import type { ModelDelta, Snapshot } from '@bim-ai/core';

export class ApiHttpError extends Error {
  readonly status: number;

  readonly detail: unknown;

  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.detail = detail;
  }
}

async function postJsonOrApiError<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let detail: unknown = text;
  if (text) {
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (parsed && typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
        detail = parsed.detail;
      }
    } catch {
      // keep raw text in detail
    }
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'reason' in detail) {
      const r = (detail as { reason?: unknown }).reason;
      if (typeof r === 'string' && r.trim()) message = r;
    }
    throw new ApiHttpError(res.status, message, detail);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      detail = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
    } catch {
      // noop
    }
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function bootstrap() {
  return fetchJson<{ projects: Record<string, unknown>[] }>(`/api/bootstrap`);
}

export type ApplyCommandResp = {
  revision: number;
  elements?: Record<string, unknown>;

  violations?: unknown[];

  delta?: ModelDelta & { clientOpId?: string };

  levelElevationPropagationEvidence_v0?: unknown;
};

export async function undoModel(
  modelId: string,
  userId?: string,
): Promise<{ ok: boolean } & ApplyCommandResp> {
  return postJsonOrApiError(`/api/models/${encodeURIComponent(modelId)}/undo`, {
    method: 'POST',

    headers: { 'content-type': 'application/json' },

    body: JSON.stringify({ userId: userId ?? 'local-dev' }),
  });
}

export async function redoModel(
  modelId: string,
  userId?: string,
): Promise<{ ok: boolean } & ApplyCommandResp> {
  return postJsonOrApiError(`/api/models/${encodeURIComponent(modelId)}/redo`, {
    method: 'POST',

    headers: { 'content-type': 'application/json' },

    body: JSON.stringify({ userId: userId ?? 'local-dev' }),
  });
}

export async function fetchActivity(modelId: string): Promise<{
  modelId?: string;

  events?: Array<Record<string, unknown>>;
}> {
  return fetchJson(`/api/models/${encodeURIComponent(modelId)}/activity`);
}

export async function fetchComments(modelId: string): Promise<{
  comments?: Array<Record<string, unknown>>;
}> {
  return fetchJson(`/api/models/${encodeURIComponent(modelId)}/comments`);
}

export async function postComment(
  modelId: string,
  payload: {
    userDisplay: string;

    body: string;

    elementId?: string;

    levelId?: string;

    anchorXMm?: number;

    anchorYMm?: number;
  },
) {
  return fetchJson(`/api/models/${encodeURIComponent(modelId)}/comments`, {
    method: 'POST',

    headers: { 'content-type': 'application/json' },

    body: JSON.stringify(payload),
  });
}

export async function patchCommentResolved(modelId: string, commentId: string, resolved: boolean) {
  return fetchJson(
    `/api/models/${encodeURIComponent(modelId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'PATCH',

      headers: { 'content-type': 'application/json' },

      body: JSON.stringify({ resolved }),
    },
  );
}

export async function applyCommand(
  modelId: string,

  command: Record<string, unknown>,

  extras?: {
    userId?: string;

    clientOpId?: string;
  },
): Promise<{ ok: boolean } & ApplyCommandResp> {
  const body: Record<string, unknown> = { command };

  if (extras?.clientOpId) body.clientOpId = extras.clientOpId;

  if (extras?.userId) body.userId = extras.userId;

  return postJsonOrApiError(`/api/models/${encodeURIComponent(modelId)}/commands`, {
    method: 'POST',

    headers: { 'content-type': 'application/json' },

    body: JSON.stringify(body),
  });
}

/** Apply multiple commands in one server transaction */
export async function applyCommandBundle(
  modelId: string,
  commands: Record<string, unknown>[],
  extras?: { userId?: string },
): Promise<{ ok: boolean } & ApplyCommandResp> {
  const body: Record<string, unknown> = { commands };

  if (extras?.userId) body.userId = extras.userId;

  return postJsonOrApiError(`/api/models/${encodeURIComponent(modelId)}/commands/bundle`, {
    method: 'POST',

    headers: { 'content-type': 'application/json' },

    body: JSON.stringify(body),
  });
}

export async function fetchApiSchema(): Promise<Record<string, unknown>> {
  return fetchJson<Record<string, unknown>>('/api/schema');
}

export type BackendRaytraceVectorM = { x: number; y: number; z: number };

export type BackendRaytraceRenderRequest = {
  width: number;
  height: number;
  samples: number;
  timeoutSeconds?: number;
  camera?: {
    position: BackendRaytraceVectorM;
    target: BackendRaytraceVectorM;
    up: BackendRaytraceVectorM;
    fovDeg?: number;
  };
};

export async function renderBackendRaytracePng(
  modelId: string,
  request: BackendRaytraceRenderRequest,
): Promise<Blob> {
  const res = await fetch(
    `/api/models/${encodeURIComponent(modelId)}/renders/backend-raytrace.png`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    let detail: unknown = text;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      detail = parsed.detail ?? parsed;
    } catch {
      // keep raw text
    }
    const message =
      detail && typeof detail === 'object' && 'message' in detail
        ? String((detail as { message?: unknown }).message)
        : `${res.status} ${res.statusText}`;
    throw new ApiHttpError(res.status, message, detail);
  }
  return res.blob();
}

export function parseSnapshot(wsPayload: Record<string, unknown>): Snapshot | null {
  const modelId =
    typeof wsPayload.modelId === 'string'
      ? wsPayload.modelId
      : typeof wsPayload.model_id === 'string'
        ? wsPayload.model_id
        : undefined;

  if (!modelId) return null;

  const revisionNum = wsPayload.revision;

  const revision = typeof revisionNum === 'number' ? revisionNum : Number(revisionNum ?? 0);

  const elements = (wsPayload.elements ?? {}) as Record<string, unknown>;

  const violations = (wsPayload.violations ?? []) as Snapshot['violations'];

  return { modelId, revision, elements, violations };
}

export function coerceDelta(wsPayload: Record<string, unknown>): ModelDelta | null {
  const revisionRaw = wsPayload.revision;
  const revision = typeof revisionRaw === 'number' ? revisionRaw : Number(revisionRaw ?? NaN);

  if (!Number.isFinite(revision)) return null;

  const removed = (wsPayload.removedIds as unknown) ?? wsPayload.removed_ids;

  const removedIds = Array.isArray(removed)
    ? (removed.filter((x) => typeof x === 'string') as string[])
    : [];

  const elements =
    wsPayload.elements && typeof wsPayload.elements === 'object'
      ? (wsPayload.elements as Record<string, unknown>)
      : {};

  const violations =
    wsPayload.violations && Array.isArray(wsPayload.violations)
      ? wsPayload.violations.map((v) => v as Snapshot['violations'][number])
      : [];

  const opId =
    typeof wsPayload.clientOpId === 'string'
      ? wsPayload.clientOpId
      : typeof wsPayload.client_op_id === 'string'
        ? wsPayload.client_op_id
        : undefined;

  return {
    revision,

    removedIds,

    elements,

    violations,

    clientOpId: opId,
  };
}

/** Keys of `bim_ai.codes.BUILDING_PRESETS`. */
export async function fetchBuildingPresets(): Promise<string[]> {
  const j = await fetchJson<{ presets?: Record<string, unknown> }>('/api/building-presets');
  return Object.keys(j.presets ?? {}).sort((a, b) => a.localeCompare(b));
}

export type ConstructabilityFinding = {
  ruleId: string;
  severity: string;
  message: string;
  elementIds: string[];
  discipline?: string;
  blockingClass?: string;
  recommendation?: string;
};

export type ConstructabilityIssue = {
  fingerprint: string;
  ruleId: string;
  elementIds: string[];
  pairKey?: string | null;
  status: string;
  firstSeenRevision?: string | number | null;
  lastSeenRevision?: string | number | null;
  resolvedRevision?: string | number | null;
  severity?: string | null;
  message?: string | null;
  discipline?: string | null;
  blockingClass?: string | null;
  recommendation?: string | null;
  suppression?: {
    id: string;
    ruleId?: string | null;
    elementIds: string[];
    reason: string;
    expiresRevision?: number | null;
  };
};

export type ConstructabilityReport = {
  format: 'constructabilityReport_v1';
  modelId?: string;
  revision: string | number;
  profile: string;
  summary: {
    findingCount: number;
    issueCount: number;
    suppressedFindingCount?: number;
    severityCounts: Record<string, number>;
    ruleCounts: Record<string, number>;
    statusCounts: Record<string, number>;
  };
  findings: ConstructabilityFinding[];
  issues: ConstructabilityIssue[];
};

export async function fetchConstructabilityReport(
  modelId: string,
  profile?: string,
): Promise<ConstructabilityReport> {
  const suffix = profile ? `?profile=${encodeURIComponent(profile)}` : '';
  return fetchJson<ConstructabilityReport>(
    `/api/models/${encodeURIComponent(modelId)}/constructability-report${suffix}`,
  );
}

export type ConstructabilityBcfTopic = {
  stableTopicId: string;
  topicKind: 'bcf';
  topicId: string;
  title: string;
  status: string;
  elementIds: string[];
  viewpointRef?: string;
  evidenceRefs: Array<Record<string, unknown>>;
  violationRuleIds: string[];
  constructabilityIssueFingerprint: string;
  severity?: string | null;
  discipline?: string | null;
  blockingClass?: string | null;
  recommendation?: string | null;
  message?: string | null;
};

export type ConstructabilityBcfViewpoint = {
  viewpointId: string;
  name: string;
  mode: 'orbit_3d';
  elementIds: string[];
  bboxMm: Record<string, number>;
  camera: Record<string, unknown>;
  sectionBoxMinMm: Record<string, number>;
  sectionBoxMaxMm: Record<string, number>;
};

export type ConstructabilityBcfExport = {
  format: 'constructabilityBcfExport_v1';
  modelId?: string;
  revision: string | number;
  profile: string;
  topicCount: number;
  viewpointCount: number;
  topics: ConstructabilityBcfTopic[];
  viewpoints: ConstructabilityBcfViewpoint[];
};

export async function fetchConstructabilityBcfExport(
  modelId: string,
  profile?: string,
): Promise<ConstructabilityBcfExport> {
  const suffix = profile ? `?profile=${encodeURIComponent(profile)}` : '';
  return fetchJson<ConstructabilityBcfExport>(
    `/api/models/${encodeURIComponent(modelId)}/constructability-bcf${suffix}`,
  );
}

/** FED-04b: upload a DXF file from the browser via multipart form. */
export type DxfImportOptions = {
  originAlignmentMode?: 'origin_to_origin' | 'project_origin' | 'shared_coords';
  unitOverride?:
    | 'source'
    | 'unitless'
    | 'inches'
    | 'feet'
    | 'millimeters'
    | 'centimeters'
    | 'meters';
  colorMode?: 'black_white' | 'native' | 'custom';
  customColor?: string;
  overlayOpacity?: number;
  hiddenLayerNames?: string[];
};

export async function uploadDxfFile(
  modelId: string,
  file: File,
  levelId: string,
  options: DxfImportOptions = {},
): Promise<{ linkDxfId: string; name: string }> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('levelId', levelId);
  form.append('name', file.name.replace(/\.dxf$/i, ''));
  form.append('originAlignmentMode', options.originAlignmentMode ?? 'origin_to_origin');
  form.append('unitOverride', options.unitOverride ?? 'source');
  form.append('colorMode', options.colorMode ?? 'black_white');
  if (options.customColor) form.append('customColor', options.customColor);
  form.append('overlayOpacity', String(options.overlayOpacity ?? 0.5));
  if (options.hiddenLayerNames?.length) {
    form.append('hiddenLayerNames', options.hiddenLayerNames.join(','));
  }
  const res = await fetch(`/api/models/${encodeURIComponent(modelId)}/upload-dxf-file`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`DXF upload failed: ${res.status}`);
  return res.json() as Promise<{ linkDxfId: string; name: string }>;
}
