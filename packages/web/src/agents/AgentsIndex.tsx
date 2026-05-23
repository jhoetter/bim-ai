import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type {
  HouseListItem,
  HouseListResponse,
  SessionListResponse,
  SessionSummary,
} from './types';
import './agents.css';

function houseProvenanceTag(h: HouseListItem): string {
  if (h.inDatabase) return 'active model';
  if (h.inFilesystem) return 'artifacts only';
  return 'seed (nothing yet)';
}

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
  const [houses, setHouses] = useState<HouseListResponse | null>(null);
  const [housesError, setHousesError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent-runs/houses')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<HouseListResponse>;
      })
      .then((payload) => {
        if (!cancelled) setHouses(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setHousesError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only show houses with a live BIM model (i.e., a bim_models row).
  // FS-only and seed-only houses stay reachable by URL but don't
  // clutter the index — see spec/trackers/agent-run-inspector-tracker.md
  // "What landed (truthful UI pass)" for the rationale.
  const allHouses = houses?.items ?? [];
  const liveHouses = allHouses
    .filter((h) => h.inDatabase)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const offlineHouses = allHouses.filter((h) => !h.inDatabase);

  return (
    <div className="agents-page">
      <header className="agents-header">
        <h1>Agent Runs</h1>
        <p className="agents-subtitle">
          Two data sources joined here: live BIM models (postgres) and Claude Code
          session transcripts on disk.
        </p>
        {data?.sessionsDir ? (
          <p className="agents-source">
            sessions: <code>{data.sessionsDir}</code>
          </p>
        ) : null}
        {housesError ? (
          <p className="agents-error">Failed to load houses: {housesError}</p>
        ) : null}
        {liveHouses.length > 0 ? (
          <p className="agents-house-links">
            <strong>Per-house dashboards:</strong>{' '}
            {liveHouses.map((h, i) => (
              <span key={h.name}>
                {i > 0 ? ' · ' : ''}
                <Link
                  to={`/agents/houses/${h.name}`}
                  className="agents-link"
                  title={`${h.name} · ${houseProvenanceTag(h)}`}
                >
                  {h.name}
                </Link>
              </span>
            ))}
          </p>
        ) : (
          <p className="agents-house-links">
            <em>
              No live BIM model for any house yet. The first testhouse rebuild
              commit will populate this list.
            </em>
          </p>
        )}
        {offlineHouses.length > 0 ? (
          <details className="agents-detail">
            <summary>
              {offlineHouses.length} house
              {offlineHouses.length === 1 ? '' : 's'} on disk without a live model
            </summary>
            <ul className="agents-stats">
              {offlineHouses.map((h) => (
                <li key={h.name}>
                  <Link
                    to={`/agents/houses/${h.name}`}
                    className="agents-link"
                    title={`${h.name} · ${houseProvenanceTag(h)}`}
                  >
                    {h.name}
                  </Link>{' '}
                  <small>({houseProvenanceTag(h)})</small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </header>

      {loading ? <p>Loading sessions…</p> : null}
      {error ? <p className="agents-error">Failed to load: {error}</p> : null}

      {data && !loading ? (
        <details className="agents-detail">
          <summary>
            <strong>Historical Claude Code sessions</strong> — {data.returned} of{' '}
            {data.total} transcripts on disk (collapsed by default)
          </summary>
          <p className="agents-count">
            Sessions persist across testhouse rebuilds — older rows may reference
            model ids that no longer exist. Use the per-house dashboards above for
            current live state.
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
        </details>
      ) : null}
    </div>
  );
}
