import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { SessionListResponse, SessionSummary } from './types';
import './agents.css';

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function formatDuration(first: string | null, last: string | null): string {
  if (!first || !last) return '—';
  const a = new Date(first).getTime();
  const b = new Date(last).getTime();
  const ms = Math.max(0, b - a);
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function topTools(counts: Record<string, number>, n: number): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => `${name}×${count}`)
    .join(' · ');
}

export function AgentsIndex(): JSX.Element {
  const [data, setData] = useState<SessionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/agent-runs/sessions?limit=200')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<SessionListResponse>;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="agents-page">
      <header className="agents-header">
        <h1>Agent Runs</h1>
        <p className="agents-subtitle">
          Claude Code session transcripts. Each row is one session on disk.
        </p>
        {data?.sessionsDir ? (
          <p className="agents-source">
            <code>{data.sessionsDir}</code>
          </p>
        ) : null}
      </header>

      {loading ? <p>Loading sessions…</p> : null}
      {error ? <p className="agents-error">Failed to load: {error}</p> : null}

      {data && !loading ? (
        <>
          <p className="agents-count">
            {data.returned} of {data.total} sessions
          </p>
          <table className="agents-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Last activity</th>
                <th>Duration</th>
                <th>House / iter</th>
                <th>Model</th>
                <th>Branch</th>
                <th>Tool calls</th>
                <th>Sub-agents</th>
                <th>Top tools</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s: SessionSummary) => (
                <tr key={s.session_id}>
                  <td>
                    <Link to={`/agents/sessions/${s.session_id}`} className="agents-link">
                      <code>{s.session_id.slice(0, 8)}…</code>
                    </Link>
                  </td>
                  <td>{formatTimestamp(s.last_ts)}</td>
                  <td>{formatDuration(s.first_ts, s.last_ts)}</td>
                  <td>
                    {s.inferred_house ?? '—'}
                    {s.inferred_iteration ? ` / ${s.inferred_iteration}` : ''}
                  </td>
                  <td>
                    {s.inferred_model_id ? (
                      <code title={s.inferred_model_id}>{s.inferred_model_id.slice(0, 8)}…</code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{s.git_branch ?? '—'}</td>
                  <td>{s.tool_calls}</td>
                  <td>{s.sub_agent_dispatches}</td>
                  <td className="agents-tools">{topTools(s.tool_call_counts_by_name, 3)}</td>
                  <td>{formatSize(s.size_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
