import type { ModelDelta, Snapshot } from '@bim-ai/core';

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

  delta?: Record<string, unknown>;
};

export async function undoModel(
  modelId: string,
  userId?: string,
): Promise<{ ok: boolean } & ApplyCommandResp> {
  return fetchJson(`/api/models/${encodeURIComponent(modelId)}/undo`, {
    method: 'POST',

    headers: { 'content-type': 'application/json' },

    body: JSON.stringify({ userId: userId ?? 'local-dev' }),
  });
}

export async function redoModel(
  modelId: string,
  userId?: string,
): Promise<{ ok: boolean } & ApplyCommandResp> {
  return fetchJson(`/api/models/${encodeURIComponent(modelId)}/redo`, {
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

  return fetchJson(`/api/models/${encodeURIComponent(modelId)}/commands`, {
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

  return fetchJson(`/api/models/${encodeURIComponent(modelId)}/commands/bundle`, {
    method: 'POST',

    headers: { 'content-type': 'application/json' },

    body: JSON.stringify(body),
  });
}

export async function fetchApiSchema(): Promise<Record<string, unknown>> {
  return fetchJson<Record<string, unknown>>('/api/schema');
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
