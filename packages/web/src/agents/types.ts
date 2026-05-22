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
