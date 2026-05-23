import { type JSX, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type {
  CommitListItem,
  IterPickerItem,
  IterPickerResponse,
  SessionSummary,
} from './types';
import './agents.css';

interface HouseIteration {
  iteration: string;
  captureCount: number;
  captures: string[];
  allCaptureCount: number;
  scoringReportPresent: boolean;
  scoringReportPath: string | null;
  capturesDir: string;
  mtime: number;
}

interface HouseDashboardResponse {
  house: string;
  present: boolean;
  path?: string;
  irKnown?: boolean;
  format?: string;
  topKeys?: string[];
  factCountsByKind: Record<string, number>;
  factCountsByStatus: Record<string, number>;
  factTotal: number;
  validationReports: string[];
  renderedPageGroups: number;
  readerPassCount: number;
  iterations: HouseIteration[];
  // Wave 4: server-resolved modelId for the iter-picker. Resolves via
  // bim_models.slug='house-<X>' first, then via any commit tagged with
  // context.testhouse_iter.house. Null when neither resolves.
  modelId?: string | null;
}

const VIEW_KINDS = ['3d', 'elev-north', 'elev-east', 'elev-south', 'elev-west'] as const;
type ViewKind = (typeof VIEW_KINDS)[number];

function captureForView(
  captures: string[],
  house: string,
  view: ViewKind,
  variant: 'full' | 'crop',
): string | null {
  const target = `${house}-${view}-${variant}.png`.toLowerCase();
  return captures.find((c) => c.toLowerCase() === target) ?? null;
}

/**
 * Pick the most-common modelId across the house's sessions. Each session
 * carries an `inferred_model_id`; a house typically maps 1:1 to a single
 * BIM model so the majority vote is unambiguous. Sessions with no inferred
 * modelId are ignored.
 */
export function dominantModelId(sessions: SessionSummary[]): string | null {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const mid = s.inferred_model_id;
    if (!mid) continue;
    counts.set(mid, (counts.get(mid) ?? 0) + 1);
  }
  let winner: string | null = null;
  let best = 0;
  for (const [mid, n] of counts) {
    if (n > best) {
      best = n;
      winner = mid;
    }
  }
  return winner;
}

/**
 * Group commits by `context.testhouse_iter.iter` and pick the latest
 * (newest-by-createdAt) commit per iter. The commits list is delivered
 * newest-first by the API, so the FIRST occurrence of each iter is the
 * one we want to point the historical viewer at. Returns iter→commit
 * pairs sorted by iter ascending (so the picker renders iter-1, iter-2, …).
 *
 * Kept for backwards compatibility with `iterPicker.test.ts`; the live
 * dashboard now uses the server-side aggregation from
 * `/agent-runs/houses/{house}/iter-picker` which has access to
 * filesystem evidence (preflight iters) the commit log doesn't carry.
 */
export function lastCommitPerIter(commits: CommitListItem[]): Array<{
  iter: number;
  commit: CommitListItem;
  commitCount: number;
}> {
  const byIter = new Map<number, { commit: CommitListItem; count: number }>();
  for (const c of commits) {
    const iter = c.context?.testhouse_iter?.iter;
    if (typeof iter !== 'number') continue;
    const existing = byIter.get(iter);
    if (existing) {
      existing.count += 1;
    } else {
      byIter.set(iter, { commit: c, count: 1 });
    }
  }
  return [...byIter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([iter, { commit, count }]) => ({ iter, commit, commitCount: count }));
}

/**
 * URL the iter-picker opens in a new tab. The Workspace bootstrap (in
 * useWorkspaceSnapshot) reads `?modelId=` and `?at=`; the path is `/`
 * because that's where Workspace is mounted today. The spec uses
 * `/workspace/<modelId>?at=…`; the functional behaviour is identical and
 * keeping the existing route avoids a router rewrite.
 */
export function historicalViewerUrl(modelId: string, commitId: string): string {
  const params = new URLSearchParams();
  params.set('modelId', modelId);
  params.set('at', commitId);
  return `/?${params.toString()}`;
}

export function AgentHouseDashboard(): JSX.Element {
  const { house = '' } = useParams<{ house: string }>();
  const [data, setData] = useState<HouseDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIter, setSelectedIter] = useState<string | null>(null);
  const [scoring, setScoring] = useState<string>('');
  const [scoringLoading, setScoringLoading] = useState(false);
  const [view, setView] = useState<ViewKind>('3d');
  const [variant, setVariant] = useState<'full' | 'crop'>('full');
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [iterPicker, setIterPicker] = useState<IterPickerResponse | null>(null);
  const [iterPickerError, setIterPickerError] = useState<string | null>(null);
  // Which iter the inline live-BIM iframe is currently rendering. Null
  // means "no iframe loaded" — picking an iter sets it; users can also
  // explicitly unload via the close button to free the embedded viewer.
  const [previewIter, setPreviewIter] = useState<IterPickerItem | null>(null);

  useEffect(() => {
    if (!house) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agent-runs/houses/${encodeURIComponent(house)}/dashboard`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<HouseDashboardResponse>;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setLoading(false);
        // Default selection: newest iteration with captures.
        const newest = [...payload.iterations].reverse().find((it) => it.captureCount > 0);
        if (newest) setSelectedIter(newest.iteration);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [house]);

  useEffect(() => {
    if (!house) return;
    let cancelled = false;
    fetch(`/api/agent-runs/sessions?house=${encodeURIComponent(house)}&limit=200`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<{ items: SessionSummary[] }>;
      })
      .then((payload) => {
        if (cancelled) return;
        setSessions(payload.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionsError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [house]);

  useEffect(() => {
    if (!house || !selectedIter) {
      setScoring('');
      return;
    }
    let cancelled = false;
    setScoringLoading(true);
    fetch(
      `/api/agent-runs/houses/${encodeURIComponent(house)}/iterations/${encodeURIComponent(selectedIter)}/scoring`,
    )
      .then((res) => {
        if (res.status === 404) return '';
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setScoring(text);
        setScoringLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setScoring(`Failed to load scoring: ${err instanceof Error ? err.message : String(err)}`);
        setScoringLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [house, selectedIter]);

  // Prefer the server-resolved modelId (slug → commit-tag chain) then
  // fall back to the dominant session attribution. The iter-picker
  // endpoint itself ALSO returns modelId, so this is kept primarily
  // for parts of the dashboard that don't fetch the iter-picker.
  const houseModelId = useMemo(
    () => iterPicker?.modelId ?? data?.modelId ?? dominantModelId(sessions ?? []),
    [iterPicker?.modelId, data?.modelId, sessions],
  );

  // Unified iter-picker fetch: server merges filesystem (preflight + new
  // rebuild iter-N/ dirs) with commits (live BIM state). The 200-row
  // limit on the commits side lives server-side via the SELECT order;
  // here we just pull whatever the endpoint produced.
  useEffect(() => {
    if (!house) {
      setIterPicker(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/agent-runs/houses/${encodeURIComponent(house)}/iter-picker`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<IterPickerResponse>;
      })
      .then((payload) => {
        if (cancelled) return;
        setIterPicker(payload);
      })
      .catch((err) => {
        if (cancelled) return;
        setIterPickerError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [house]);

  // When the picker payload changes (initial load or refresh), auto-select
  // the latest committed iter so the iframe lands on the most recent
  // state without an extra click. Preflight-only iters never auto-select.
  useEffect(() => {
    if (!iterPicker || previewIter) return;
    const latestCommitted = [...iterPicker.items].reverse().find((it) => it.commit !== null);
    if (latestCommitted) setPreviewIter(latestCommitted);
  }, [iterPicker, previewIter]);

  const selected = useMemo(
    () => data?.iterations.find((it) => it.iteration === selectedIter) ?? null,
    [data, selectedIter],
  );

  const currentCapture = useMemo(() => {
    if (!selected) return null;
    return captureForView(selected.captures, house, view, variant);
  }, [selected, house, view, variant]);

  return (
    <div className="agents-page">
      <header className="agents-header">
        <p>
          <Link to="/agents" className="agents-link">
            ← All sessions
          </Link>
        </p>
        <h1>
          House <strong>{house}</strong>
        </h1>
        {data?.path ? (
          <p className="agents-source">
            <code>{data.path}</code>
          </p>
        ) : null}
      </header>

      {loading ? <p>Loading dashboard…</p> : null}
      {error ? <p className="agents-error">Failed to load: {error}</p> : null}

      {data && !loading && !data.present ? (
        <p className="agents-empty">
          No artifacts found under <code>tmp/reverse-bim/house-{house}/</code>.
        </p>
      ) : null}

      {data && !loading && data.present ? (
        <>
          <section className="agents-dashboard-grid">
            <div className="agents-card">
              <h3>Fact ledger</h3>
              {data.factTotal > 0 ? (
                <>
                  <p>
                    <strong>{data.factTotal}</strong> facts in
                    <code> existing-building-ir.json</code>
                  </p>
                  <details>
                    <summary>By kind</summary>
                    <ul className="agents-stats">
                      {Object.entries(data.factCountsByKind)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, n]) => (
                          <li key={k}>
                            <code>{k}</code>: {n}
                          </li>
                        ))}
                    </ul>
                  </details>
                  <details>
                    <summary>By status</summary>
                    <ul className="agents-stats">
                      {Object.entries(data.factCountsByStatus)
                        .sort((a, b) => b[1] - a[1])
                        .map(([s, n]) => (
                          <li key={s}>
                            <code>{s}</code>: {n}
                          </li>
                        ))}
                    </ul>
                  </details>
                </>
              ) : (
                <p>No fact ledger found.</p>
              )}
            </div>

            <div className="agents-card">
              <h3>Source &amp; readers</h3>
              <ul className="agents-stats">
                <li>Rendered-page groups: {data.renderedPageGroups}</li>
                <li>Reader passes: {data.readerPassCount}</li>
                <li>
                  Validation reports:{' '}
                  {data.validationReports.length === 0 ? 'none' : data.validationReports.join(', ')}
                </li>
              </ul>
            </div>

          </section>

          <section
            className="agents-iter-picker-section"
            data-testid="agents-iter-picker"
          >
            <h2>
              Iter picker{' '}
              {houseModelId ? (
                <code className="agents-iter-count">
                  model {houseModelId.slice(0, 8)}…
                </code>
              ) : (
                <span className="agents-iter-count">(no model yet)</span>
              )}
            </h2>
            {iterPickerError ? (
              <p className="agents-error">Failed to load iter list: {iterPickerError}</p>
            ) : null}
            {!iterPicker && !iterPickerError ? <p>Loading iter list…</p> : null}
            {iterPicker && iterPicker.items.length === 0 ? (
              <p>
                No iters for <code>{house}</code> yet — neither on disk under{' '}
                <code>tmp/reverse-bim/house-{house}/iter-*/</code> nor as commits
                tagged with <code>agent_context.testhouse_iter</code>.
              </p>
            ) : null}
            {iterPicker && iterPicker.items.length > 0 ? (
              <ol className="agents-iter-strip" data-testid="agents-iter-strip">
                {iterPicker.items.map((it) => {
                  const hasCommit = it.commit !== null;
                  const selected = previewIter?.iter === it.iter;
                  const className =
                    'agents-iter-pick-btn' +
                    (selected ? ' agents-iter-pick-btn--active' : '') +
                    (hasCommit ? '' : ' agents-iter-pick-btn--disabled');
                  const phase = it.commit?.phase ?? null;
                  const tooltip = hasCommit
                    ? `${it.iter}` +
                      (phase ? ` · ${phase}` : '') +
                      ` · ${it.commit?.commitId}`
                    : `${it.iter} · preflight (no model commit yet)`;
                  return (
                    <li key={it.iter}>
                      <button
                        type="button"
                        className={className}
                        data-testid={`agents-iter-pick-${it.iter}`}
                        data-commit-id={it.commit?.commitId ?? ''}
                        data-model-id={it.commit?.modelId ?? ''}
                        data-has-commit={hasCommit ? 'true' : 'false'}
                        disabled={!hasCommit}
                        title={tooltip}
                        onClick={() => {
                          if (!hasCommit) return;
                          setPreviewIter(it);
                        }}
                      >
                        {it.iter}
                        {phase ? <small>{phase}</small> : null}
                        {!hasCommit ? <small>preflight</small> : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {previewIter && previewIter.commit ? (
              <div
                className="agents-iter-preview"
                data-testid="agents-iter-preview"
              >
                <div className="agents-iter-preview-toolbar">
                  <span>
                    Live BIM at <strong>{previewIter.iter}</strong>
                    {previewIter.commit.phase ? (
                      <>
                        {' '}
                        · phase <code>{previewIter.commit.phase}</code>
                      </>
                    ) : null}{' '}
                    · commit{' '}
                    <code>{previewIter.commit.commitId.slice(0, 12)}…</code>
                  </span>
                  <span className="agents-iter-preview-spacer" />
                  <a
                    className="agents-iter-preview-newtab"
                    href={historicalViewerUrl(
                      previewIter.commit.modelId,
                      previewIter.commit.commitId,
                    )}
                    target="_blank"
                    rel="noreferrer noopener"
                    data-testid="agents-iter-preview-newtab"
                  >
                    ↗ Open in new tab
                  </a>
                  <button
                    type="button"
                    className="agents-iter-preview-close"
                    onClick={() => setPreviewIter(null)}
                    aria-label="Close inline preview"
                    title="Close inline preview"
                  >
                    ×
                  </button>
                </div>
                <iframe
                  key={previewIter.commit.commitId}
                  src={historicalViewerUrl(
                    previewIter.commit.modelId,
                    previewIter.commit.commitId,
                  )}
                  title={`Historical BIM viewer · ${previewIter.iter} · ${previewIter.commit.commitId}`}
                  className="agents-iter-preview-iframe"
                  data-testid="agents-iter-preview-iframe"
                />
              </div>
            ) : null}
          </section>

          <section className="agents-sessions-section">
            {sessionsError ? (
              <p className="agents-error">Failed to load sessions: {sessionsError}</p>
            ) : null}
            {sessions ? (
              <SessionsForHouse
                sessions={sessions}
                house={house}
                currentModelId={houseModelId}
              />
            ) : null}
          </section>

          {data.iterations.length > 0 ? (
          <section className="agents-capture-section">
            <h2>Legacy iter-N captures {selectedIter ? <code>{selectedIter}</code> : null}</h2>
            <p className="agents-count">
              From the pre-rebuild <code>tmp/reverse-bim/iter-N-captures/</code> layout.
              The new rebuild layout puts captures under{' '}
              <code>tmp/reverse-bim/house-{house}/iter-N/</code> and is rendered live via
              the iter picker above.
            </p>
            {selected ? (
              <>
                <div className="agents-capture-toolbar">
                  <div className="agents-tab-row">
                    {VIEW_KINDS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={'agents-tab' + (view === v ? ' agents-tab--active' : '')}
                        onClick={() => setView(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <div className="agents-tab-row">
                    {(['full', 'crop'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={'agents-tab' + (variant === v ? ' agents-tab--active' : '')}
                        onClick={() => setVariant(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="agents-capture-frame">
                  {currentCapture ? (
                    <img
                      src={`/api/agent-runs/houses/${encodeURIComponent(house)}/iterations/${encodeURIComponent(selected.iteration)}/captures/${encodeURIComponent(currentCapture)}`}
                      alt={`${house} ${selected.iteration} ${view} ${variant}`}
                      className="agents-capture-img"
                    />
                  ) : (
                    <p>
                      No capture for view "{view} / {variant}".
                    </p>
                  )}
                </div>

                <details className="agents-detail">
                  <summary>
                    All capture filenames in this iteration ({selected.captureCount})
                  </summary>
                  <ul className="agents-stats">
                    {selected.captures.map((c) => (
                      <li key={c}>
                        <code>{c}</code>
                      </li>
                    ))}
                  </ul>
                </details>

                <h3 className="agents-scoring-title">Visual-fidelity scoring</h3>
                {scoringLoading ? <p>Loading scoring…</p> : null}
                {!scoringLoading && scoring ? (
                  <pre className="agents-scoring">{scoring}</pre>
                ) : !scoringLoading ? (
                  <p className="agents-warning">No scoring report for this iteration.</p>
                ) : null}
              </>
            ) : (
              <p>Pick a legacy iter above to view captures.</p>
            )}
          </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface SessionsForHouseProps {
  sessions: SessionSummary[];
  house: string;
  currentModelId: string | null;
}

/**
 * Split sessions for a house into three buckets so the user can tell
 * "this iter relates to the live model" from "this iter is stale from
 * a wiped rebuild":
 *
 *  - **current**: ``inferred_model_id === currentModelId``.
 *  - **historical**: a different ``inferred_model_id`` (the model has
 *    been deleted or replaced — common after a testhouse rebuild).
 *  - **unattributed**: ``inferred_model_id`` is null (the REST-driven
 *    testhouse runs always land here; some pre-MCP sessions too).
 *
 * Only the "current" bucket renders expanded. The others stay
 * collapsed behind summary counts to defuse the iter-19 / iter-9
 * confusion that drove this rework.
 */
function SessionsForHouse({
  sessions,
  house,
  currentModelId,
}: SessionsForHouseProps): JSX.Element {
  const current: SessionSummary[] = [];
  const historical: SessionSummary[] = [];
  const unattributed: SessionSummary[] = [];
  for (const s of sessions) {
    if (s.inferred_model_id === null || s.inferred_model_id === undefined) {
      unattributed.push(s);
    } else if (currentModelId && s.inferred_model_id === currentModelId) {
      current.push(s);
    } else {
      historical.push(s);
    }
  }

  return (
    <>
      <h2 className="agents-section-heading">
        Sessions referencing <code>{house}</code>
      </h2>
      <p className="agents-count">
        {currentModelId ? (
          <>
            Current model: <code>{currentModelId.slice(0, 8)}…</code>. Session
            transcripts persist across testhouse rebuilds — sessions tagged
            <code> {house}</code> from old runs reference deleted models and are
            grouped under "Historical" below.
          </>
        ) : (
          <>
            No live model is resolved for this house yet. Every session in this
            view is historical or unattributed.
          </>
        )}
      </p>
      <SessionTable
        title={`Current model · ${current.length} session${current.length === 1 ? '' : 's'}`}
        sessions={current}
        emptyMsg="No sessions reference the current model yet (REST-driven testhouse runs don't appear here — they show under Unattributed)."
        defaultOpen
        testId="agents-sessions-current"
      />
      <SessionTable
        title={`Historical (different model) · ${historical.length} session${historical.length === 1 ? '' : 's'}`}
        sessions={historical}
        emptyMsg="No historical sessions for this house name."
        defaultOpen={false}
        testId="agents-sessions-historical"
      />
      <SessionTable
        title={`Unattributed · ${unattributed.length} session${unattributed.length === 1 ? '' : 's'}`}
        sessions={unattributed}
        emptyMsg="No unattributed sessions for this house name."
        defaultOpen={false}
        testId="agents-sessions-unattributed"
      />
    </>
  );
}

interface SessionTableProps {
  title: string;
  sessions: SessionSummary[];
  emptyMsg: string;
  defaultOpen: boolean;
  testId: string;
}

function SessionTable({
  title,
  sessions,
  emptyMsg,
  defaultOpen,
  testId,
}: SessionTableProps): JSX.Element {
  return (
    <details className="agents-detail" open={defaultOpen} data-testid={testId}>
      <summary>{title}</summary>
      {sessions.length === 0 ? (
        <p>{emptyMsg}</p>
      ) : (
        <table className="agents-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Last activity</th>
              <th>Iter</th>
              <th>Model</th>
              <th>Tool calls</th>
              <th>Sub-agents</th>
              <th>Branch</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.session_id}>
                <td>
                  <Link to={`/agents/sessions/${s.session_id}`} className="agents-link">
                    <code>{s.session_id.slice(0, 8)}…</code>
                  </Link>
                </td>
                <td>{s.last_ts ? new Date(s.last_ts).toLocaleString() : '—'}</td>
                <td>{s.inferred_iteration ?? '—'}</td>
                <td>
                  {s.inferred_model_id ? (
                    <code title={s.inferred_model_id}>
                      {s.inferred_model_id.slice(0, 8)}…
                    </code>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{s.tool_calls}</td>
                <td>{s.sub_agent_dispatches}</td>
                <td>{s.git_branch ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
