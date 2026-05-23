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
// The v2 testhouse driver also writes consumedFactIds + sourceEvidence
// + producedElementIds on each phase commit so the agents dashboard
// can render the full doc → fact → element trail per iter card; see
// spec/agents-view-traceability-spec.md (Ask 2) for the contract.
export interface TestHouseSourceEvidence {
  docId: string;
  page: string; // PNG filename inside rendered-pages/<docId>/
  role?: string | null;
  renderedPath?: string | null;
}

export interface TestHousePhaseNarrative {
  input?: string | null;
  reasoning?: string | null;
  outcome?: string | null;
}

export interface TestHouseIterRef {
  house?: string | null;
  iter?: number | null;
  phase?: string | null;
  consumedFactIds?: string[];
  producedElementIds?: string[];
  sourceEvidence?: TestHouseSourceEvidence[];
  // Human-readable trio written by the testhouse driver alongside the
  // commit. The dashboard renders this above the chip lists so reviewers
  // can read what the agent saw / decided / produced without diving into
  // the bundle JSON. Absent on legacy commits (pre-narrative driver).
  narrative?: TestHousePhaseNarrative;
  commandCount?: number;
}

// Per-house global-phase narrative JSON sidecar shape. Written by the
// testhouse driver to ``tmp/reverse-bim/house-<X>/iter-<N>/narrative.json``
// for phases that run BEFORE any bim_models row exists (iter-0 preflight,
// iter-1 reader, iter-2 scope). Served at
// ``/api/agent-runs/houses/{house}/iterations/{iter}/narrative``.
export interface PhaseNarrativeInput {
  path: string;
  fileCount?: number | null;
  [key: string]: unknown;
}

export interface PhaseNarrativeOutput {
  path: string;
  role?: string | null;
  [key: string]: unknown;
}

export interface PhaseNarrativeFile {
  schemaVersion?: string;
  house: string;
  iter: number;
  phase: string;
  narrative: TestHousePhaseNarrative;
  inputs?: PhaseNarrativeInput[];
  outputs?: PhaseNarrativeOutput[];
  summary?: Record<string, unknown>;
  elapsedMs?: number | null;
}

// IR v2 fact shape. The fact endpoint returns whatever lives in
// existing-building-ir.json#extractedFacts[], so we type the fields
// we render and pass the rest through as a passthrough record.
export interface ExtractedFact {
  factId: string;
  kind: string;
  status?: string;
  levelId?: string | null;
  sourceDocId?: string | null;
  sourcePage?: string | null;
  confidence?: string | null;
  note?: string | null;
  // Free-form "how the reader saw it" sentence written by the reader
  // sub-agent (e.g. "Wohnzimmer outline traced from EG-1.png at 1:50
  // scale, clockwise from NW corner"). Optional — older IRs predating
  // the derivation-note channel won't carry this field.
  derivationNote?: string | null;
  text?: string | null;
  valueMm?: number | null;
  vertexMm?: [number, number] | null;
  polygonMm?: Array<[number, number]> | null;
  // Pass-through for unknown keys without losing typing on the known ones.
  [key: string]: unknown;
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
