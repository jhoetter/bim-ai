/**
 * SKT-01 — sketch session API client (floor-only slice).
 *
 * Sessions are transient server-side scratch state. The Finish endpoint commits
 * a single `CreateFloor` through the regular engine path so undo/redo and
 * WebSocket deltas behave exactly like any other authoring command.
 */

export type SketchVec2Mm = { xMm: number; yMm: number };

export type SketchLineWire = { fromMm: SketchVec2Mm; toMm: SketchVec2Mm };

export type SketchValidationIssue = {
  code: string;
  message: string;
  lineIndex?: number | null;
  lineIndices?: number[] | null;
};

export type SketchValidationState = {
  valid: boolean;
  issues: SketchValidationIssue[];
};

export type SketchElementKind = 'floor' | 'roof' | 'room_separation' | 'stair_by_sketch';

export type StairSketchFinishOpts = {
  topLevelId: string;
  baseLevelId?: string;
  authoringMode: 'by_sketch';
  boundaryMm: { xMm: number; yMm: number }[];
  treadLines: {
    fromMm: { xMm: number; yMm: number };
    toMm: { xMm: number; yMm: number };
    riserHeightMm?: number;
  }[];
  totalRiseMm: number;
  name?: string;
};
export type PickWallsOffsetMode = 'centerline' | 'interior_face';

export type PickedWallWire = {
  wallId: string;
  lineIndex: number;
};

export type SketchSessionWire = {
  sessionId: string;
  modelId: string;
  elementKind: SketchElementKind;
  levelId: string;
  lines: SketchLineWire[];
  status: 'open' | 'finished' | 'cancelled';
  pickWallsOffsetMode: PickWallsOffsetMode;
  pickedWalls: PickedWallWire[];
};

export type SketchSessionResponse = {
  session: SketchSessionWire;
  validation: SketchValidationState;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function openSketchSession(
  modelId: string,
  levelId: string,
  opts: {
    elementKind?: SketchElementKind;
    pickWallsOffsetMode?: PickWallsOffsetMode;
  } = {},
): Promise<SketchSessionResponse> {
  return postJson<SketchSessionResponse>('/api/sketch-sessions', {
    modelId,
    elementKind: opts.elementKind ?? 'floor',
    levelId,
    pickWallsOffsetMode: opts.pickWallsOffsetMode ?? 'interior_face',
  });
}

export async function getSketchSession(sessionId: string): Promise<SketchSessionResponse> {
  const res = await fetch(`/api/sketch-sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<SketchSessionResponse>;
}

export async function addSketchLine(
  sessionId: string,
  fromMm: SketchVec2Mm,
  toMm: SketchVec2Mm,
): Promise<SketchSessionResponse> {
  return postJson<SketchSessionResponse>(
    `/api/sketch-sessions/${encodeURIComponent(sessionId)}/lines`,
    { fromMm, toMm },
  );
}

export async function removeSketchLine(
  sessionId: string,
  lineIndex: number,
): Promise<SketchSessionResponse> {
  return postJson<SketchSessionResponse>(
    `/api/sketch-sessions/${encodeURIComponent(sessionId)}/remove-line`,
    { lineIndex },
  );
}

export async function moveSketchVertex(
  sessionId: string,
  fromMm: SketchVec2Mm,
  toMm: SketchVec2Mm,
): Promise<SketchSessionResponse> {
  return postJson<SketchSessionResponse>(
    `/api/sketch-sessions/${encodeURIComponent(sessionId)}/move-vertex`,
    { fromMm, toMm },
  );
}

export type FinishSketchResponse = {
  ok: boolean;
  sessionId: string;
  status: 'finished';
  floorId: string | null;
  roofId?: string | null;
  roomSeparationId?: string | null;
  createdElementIds?: string[];
  modelId: string;
  revision: number;
  elements: Record<string, unknown>;
  appliedCommand: Record<string, unknown>;
  appliedCommands?: Record<string, unknown>[];
};

export async function pickWall(sessionId: string, wallId: string): Promise<SketchSessionResponse> {
  return postJson<SketchSessionResponse>(
    `/api/sketch-sessions/${encodeURIComponent(sessionId)}/pick-wall`,
    { wallId },
  );
}

export async function setPickWallsOffsetMode(
  sessionId: string,
  mode: PickWallsOffsetMode,
): Promise<SketchSessionResponse> {
  return postJson<SketchSessionResponse>(
    `/api/sketch-sessions/${encodeURIComponent(sessionId)}/pick-walls-offset-mode`,
    { mode },
  );
}

export async function finishSketchSession(
  sessionId: string,
  opts: {
    name?: string;
    userId?: string;
    clientOpId?: string;
    options?: Record<string, unknown>;
  } = {},
): Promise<FinishSketchResponse> {
  return postJson<FinishSketchResponse>(
    `/api/sketch-sessions/${encodeURIComponent(sessionId)}/finish`,
    {
      name: opts.name,
      userId: opts.userId ?? 'local-dev',
      clientOpId: opts.clientOpId,
      ...(opts.options ? { options: opts.options } : {}),
    },
  );
}

export async function cancelSketchSession(sessionId: string): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(
    `/api/sketch-sessions/${encodeURIComponent(sessionId)}/cancel`,
    {},
  );
}
