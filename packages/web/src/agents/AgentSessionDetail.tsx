import { type JSX, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { SessionDetailResponse, TimelineEvent } from './types';
import './agents.css';

function eventTitle(event: TimelineEvent): string {
  switch (event.kind) {
    case 'user':
      return 'User message';
    case 'assistant_text':
      return 'Assistant';
    case 'assistant_thinking':
      return 'Thinking';
    case 'tool_use': {
      const name = typeof event.payload.name === 'string' ? event.payload.name : 'tool';
      return `Tool: ${name}`;
    }
    case 'sub_agent': {
      const name = typeof event.payload.name === 'string' ? event.payload.name : 'sub-agent';
      return `Sub-agent: ${name}`;
    }
    case 'tool_result':
      return 'Tool result';
    case 'raw':
      return 'System';
    default:
      return event.kind;
  }
}

function formatTime(ts: string | null): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function EventBody({ event }: { event: TimelineEvent }): JSX.Element | null {
  const p = event.payload;
  switch (event.kind) {
    case 'user':
    case 'assistant_text':
    case 'assistant_thinking':
      return <pre className="agents-text">{(p.text as string) ?? ''}</pre>;
    case 'tool_use':
    case 'sub_agent':
      return (
        <details className="agents-detail" open={event.kind === 'sub_agent'}>
          <summary>input</summary>
          <pre>{safeStringify(p.input)}</pre>
        </details>
      );
    case 'tool_result':
      return (
        <details className="agents-detail">
          <summary>{p.isError ? 'error result' : 'result'}</summary>
          <pre>{safeStringify(p.content)}</pre>
        </details>
      );
    case 'raw':
      return (
        <details className="agents-detail">
          <summary>raw</summary>
          <pre>{safeStringify(p.raw)}</pre>
        </details>
      );
    default:
      return null;
  }
}

export function AgentSessionDetail(): JSX.Element {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeRaw, setIncludeRaw] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/agent-runs/sessions/${encodeURIComponent(sessionId)}?includeRaw=${includeRaw}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<SessionDetailResponse>;
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
  }, [sessionId, includeRaw]);

  const events = data?.events ?? [];
  const filtered = filter
    ? events.filter((e) => {
        const t = eventTitle(e).toLowerCase();
        const text = safeStringify(e.payload).toLowerCase();
        return t.includes(filter.toLowerCase()) || text.includes(filter.toLowerCase());
      })
    : events;

  return (
    <div className="agents-page">
      <header className="agents-header">
        <p>
          <Link to="/agents" className="agents-link">
            ← All sessions
          </Link>
        </p>
        <h1>
          Session <code>{sessionId.slice(0, 8)}…</code>
        </h1>
        {data?.summary ? (
          <ul className="agents-meta">
            <li>
              <strong>House / iter:</strong> {data.summary.inferred_house ?? '—'}
              {data.summary.inferred_iteration ? ` / ${data.summary.inferred_iteration}` : ''}
            </li>
            <li>
              <strong>Model:</strong>{' '}
              {data.summary.inferred_model_id ? <code>{data.summary.inferred_model_id}</code> : '—'}
            </li>
            <li>
              <strong>Branch:</strong> {data.summary.git_branch ?? '—'}
            </li>
            <li>
              <strong>Tool calls:</strong> {data.summary.tool_calls}
            </li>
            <li>
              <strong>Sub-agents:</strong> {data.summary.sub_agent_dispatches}
            </li>
            <li>
              <strong>User msgs:</strong> {data.summary.user_messages}
            </li>
            <li>
              <strong>Assistant msgs:</strong> {data.summary.assistant_messages}
            </li>
          </ul>
        ) : null}
        <div className="agents-toolbar">
          <label>
            <input
              type="checkbox"
              checked={includeRaw}
              onChange={(e) => setIncludeRaw(e.currentTarget.checked)}
            />{' '}
            include system/raw events
          </label>
          <input
            type="search"
            placeholder="filter by tool name or text…"
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            className="agents-filter"
          />
        </div>
      </header>

      {loading ? <p>Loading session…</p> : null}
      {error ? <p className="agents-error">Failed to load: {error}</p> : null}

      {data && !loading ? (
        <>
          {data.truncated ? (
            <p className="agents-warning">
              Timeline truncated to {events.length} events. Increase <code>limitEvents</code> on the
              API to see more.
            </p>
          ) : null}
          <ol className="agents-timeline">
            {filtered.map((event) => (
              <li key={event.sequence} className={`agents-event agents-event--${event.kind}`}>
                <header className="agents-event-header">
                  <span className="agents-event-time">{formatTime(event.timestamp)}</span>
                  <span className="agents-event-title">{eventTitle(event)}</span>
                  <span className="agents-event-seq">#{event.sequence}</span>
                </header>
                <EventBody event={event} />
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
