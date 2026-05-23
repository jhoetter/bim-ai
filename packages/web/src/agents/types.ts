// Wire types for the developer-only /agents observability surface.
// Mirrors app/bim_ai/agent_run_parser.py + routes_agent_runs.py.

export interface SessionSummary {
  session_id: string;
  path: string;
  size_bytes: number;
  first_ts: string | null;
  last_ts: string | null;
  user_messages: number;
  assistant_messages: number;
  tool_calls: number;
  sub_agent_dispatches: number;
  tool_call_counts_by_name: Record<string, number>;
  inferred_model_id: string | null;
  inferred_house: string | null;
  inferred_iteration: string | null;
  git_branch: string | null;
  parse_errors: number;
}

export interface SessionListResponse {
  sessionsDir: string;
  total: number;
  returned: number;
  items: SessionSummary[];
}

export type TimelineEventKind =
  | 'user'
  | 'assistant_text'
  | 'assistant_thinking'
  | 'tool_use'
  | 'sub_agent'
  | 'tool_result'
  | 'raw';

export interface TimelineEvent {
  kind: TimelineEventKind;
  timestamp: string | null;
  uuid: string | null;
  parentUuid: string | null;
  sequence: number;
  payload: Record<string, unknown>;
}

export interface SessionDetailResponse {
  summary: SessionSummary;
  events: TimelineEvent[];
  truncated: boolean;
}

// Time-travel Wave 4: wire types for the per-house iter-picker.
// Mirrors app/bim_ai/routes/time_travel.py:list_commits().
export interface TestHouseIterRef {
  house?: string | null;
  iter?: number | null;
  phase?: string | null;
}

export interface CommitListItem {
  commitId: string;
  modelId: string;
  parentCommitId: string | null;
  firstRevision: number;
  lastRevision: number;
  state: 'open' | 'closed' | 'aborted' | string;
  summary: string;
  context: Record<string, unknown> & { testhouse_iter?: TestHouseIterRef };
  createdAt: string | null;
  closedAt: string | null;
  snapshotId: number | null;
  snapshot?: unknown;
}

export interface CommitListResponse {
  modelId: string;
  items: CommitListItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

// Wave 4 unified iter-picker: mirrors
// app/bim_ai/routes/agent_runs.py:get_house_iter_picker().
export interface IterPickerCommit {
  commitId: string;
  modelId: string;
  phase: string | null;
  summary: string;
  state: 'open' | 'closed' | 'aborted' | string;
  createdAt: string | null;
  firstRevision: number;
  lastRevision: number;
}

export interface IterPickerItem {
  iter: string; // e.g. "iter-3"
  iterNumber: number | null;
  fsPath: string | null;
  captureCount: number;
  commit: IterPickerCommit | null; // null when this iter has no model commit
}

export interface IterPickerResponse {
  house: string;
  modelId: string | null;
  items: IterPickerItem[];
}

// Mirrors app/bim_ai/routes/agent_runs.py:list_houses() — used by the
// /agents index to render per-house links truthfully (no hardcoded
// alpha/beta/gamma list).
export interface HouseListItem {
  name: string;
  present: boolean;
  path: string;
  inSeed: boolean;
  inFilesystem: boolean;
  inDatabase: boolean;
}

export interface HouseListResponse {
  reverseBimDir: string;
  items: HouseListItem[];
}
