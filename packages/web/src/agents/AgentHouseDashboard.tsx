import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type {
  CommitListItem,
  CommitListResponse,
  ExtractedFact,
  IterPickerItem,
  IterPickerResponse,
  PhaseNarrativeFile,
  PhaseNarrativeOutput,
  SessionSummary,
  TestHousePhaseNarrative,
  TestHouseSourceEvidence,
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
export function historicalViewerUrl(
  modelId: string,
  commitId: string,
  selectElementId?: string,
): string {
  const params = new URLSearchParams();
  params.set('modelId', modelId);
  params.set('at', commitId);
  if (selectElementId) params.set('select', selectElementId);
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
  // All per-phase commits for this house, newest first. Used by the
  // trail section to render one card PER commit (not collapsed to one
  // per iter), surfacing consumedFactIds / sourceEvidence /
  // producedElementIds for full traceability.
  const [houseCommits, setHouseCommits] = useState<CommitListItem[] | null>(null);
  const [houseCommitsError, setHouseCommitsError] = useState<string | null>(null);
  // Per-iter scoring markdown, fetched on demand when its parent
  // ``iterations[]`` entry reports ``scoringReportPresent``. Keyed by
  // iter label (``iter-3``) → markdown text. Missing = not yet fetched
  // or 404. The fetch is lazy so we don't fan out N requests on first
  // render for houses with many iters.
  const [iterScoring, setIterScoring] = useState<Record<string, string>>({});
  // Global-phase narratives (iter-0 preflight, iter-1 reader, iter-2
  // scope). These run BEFORE any bim_models row exists so they can't
  // ride on the commit-context carrier; instead the driver writes a
  // sidecar JSON we fetch here. Map iter label → narrative file (or
  // null = 404 = not yet written).
  const [globalPhaseNarratives, setGlobalPhaseNarratives] = useState<
    Record<string, PhaseNarrativeFile | null>
  >({});
  const [globalPhaseLoading, setGlobalPhaseLoading] = useState(true);

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

  // Fetch ALL per-phase commits for this house so the trail section can
  // render one card per commit (not one per iter). Resolved modelId
  // comes from the iter-picker / dashboard endpoint chain; we wait for
  // it before issuing the fetch to avoid a doomed call against an empty
  // model id.
  const trailModelId = iterPicker?.modelId ?? data?.modelId ?? null;
  useEffect(() => {
    if (!house || !trailModelId) {
      setHouseCommits(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/models/${encodeURIComponent(trailModelId)}/commits?testhouse_house=${encodeURIComponent(house)}&limit=50`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<CommitListResponse>;
      })
      .then((payload) => {
        if (cancelled) return;
        setHouseCommits(payload.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setHouseCommitsError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [house, trailModelId]);

  // Fetch the three global-phase narrative sidecars in parallel.
  // 404 is the common-and-expected case (driver hasn't run yet or
  // didn't write a sidecar for that phase), so we store null on 404
  // and surface a placeholder when ALL three are missing.
  useEffect(() => {
    if (!house) {
      setGlobalPhaseNarratives({});
      setGlobalPhaseLoading(false);
      return;
    }
    let cancelled = false;
    setGlobalPhaseLoading(true);
    const iters = ['iter-0', 'iter-1', 'iter-2'];
    Promise.all(
      iters.map(async (iter) => {
        const res = await fetch(
          `/api/agent-runs/houses/${encodeURIComponent(house)}/iterations/${encodeURIComponent(iter)}/narrative`,
        );
        if (res.status === 404) return [iter, null] as const;
        if (!res.ok) {
          // Treat unexpected errors as "absent" for the placeholder
          // path; we don't want a flaky endpoint to crash the page.
          return [iter, null] as const;
        }
        const payload = (await res.json()) as PhaseNarrativeFile;
        return [iter, payload] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        const next: Record<string, PhaseNarrativeFile | null> = {};
        for (const [iter, file] of entries) next[iter] = file;
        setGlobalPhaseNarratives(next);
        setGlobalPhaseLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setGlobalPhaseNarratives({});
        setGlobalPhaseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [house]);

  // Ordered iter-0/1/2 entries for the global-phase section. Skipped
  // entries (404) drop out; if ALL drop out we render a placeholder.
  const globalPhaseEntries = useMemo<Array<{ iter: string; file: PhaseNarrativeFile }>>(() => {
    const order = ['iter-0', 'iter-1', 'iter-2'];
    const out: Array<{ iter: string; file: PhaseNarrativeFile }> = [];
    for (const iter of order) {
      const file = globalPhaseNarratives[iter];
      if (file) out.push({ iter, file });
    }
    return out;
  }, [globalPhaseNarratives]);

  const selected = useMemo(
    () => data?.iterations.find((it) => it.iteration === selectedIter) ?? null,
    [data, selectedIter],
  );

  // Group commits into iters in the same order the testhouse driver
  // produces them. Returns iters newest-first (matches the API), and
  // within each iter we keep the commit order the server delivered
  // (newest first → oldest), then reverse so the UI reads phase-by-
  // phase chronologically inside one iter card.
  const commitsByIter = useMemo(() => {
    type Group = { iter: number; iterLabel: string; commits: CommitListItem[] };
    if (!houseCommits) return [] as Group[];
    const groups = new Map<number, Group>();
    for (const c of houseCommits) {
      const iter = c.context?.testhouse_iter?.iter;
      if (typeof iter !== 'number') continue;
      let g = groups.get(iter);
      if (!g) {
        g = { iter, iterLabel: `iter-${iter}`, commits: [] };
        groups.set(iter, g);
      }
      g.commits.push(c);
    }
    // Iter ordering: newest iter first (matches the rest of the page).
    // Within an iter the API delivered newest-first; reverse so the
    // earliest phase commit of the iter renders at the top of the card.
    return [...groups.values()]
      .sort((a, b) => b.iter - a.iter)
      .map((g) => ({ ...g, commits: [...g.commits].reverse() }));
  }, [houseCommits]);

  // Lazy-load scoring markdown for an iter when its panel is expanded.
  // The fetch caches into iterScoring so re-expanding doesn't re-fetch;
  // the empty-string sentinel covers 404 (gate present in iterations[]
  // metadata but markdown missing on disk — shouldn't happen but we
  // tolerate it gracefully).
  const ensureScoringLoaded = useCallback(
    (iterLabel: string) => {
      if (!house) return;
      if (iterLabel in iterScoring) return;
      // Mark as in-flight by setting empty string first to avoid double-fetch.
      setIterScoring((prev) => ({ ...prev, [iterLabel]: '' }));
      fetch(
        `/api/agent-runs/houses/${encodeURIComponent(house)}/iterations/${encodeURIComponent(iterLabel)}/scoring`,
      )
        .then((res) => {
          if (res.status === 404) return '_No scoring report on disk for this iter._';
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          return res.text();
        })
        .then((text) => {
          setIterScoring((prev) => ({ ...prev, [iterLabel]: text }));
        })
        .catch((err) => {
          setIterScoring((prev) => ({
            ...prev,
            [iterLabel]: `Failed to load scoring: ${err instanceof Error ? err.message : String(err)}`,
          }));
        });
    },
    [house, iterScoring],
  );

  // Convenience map iter-label → boolean from the dashboard summary
  // (iterations[].scoringReportPresent is the truth source; legacy iter-
  // captures dirs are the only ones the dashboard summary scans, but
  // scoring sidecars live in iter-N-scoring/ keyed by iter label, so we
  // also fall back to "always offer" the report load action and let
  // the endpoint 404 when absent).
  const scoringPresentByIter = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const it of data?.iterations ?? []) {
      out[it.iteration] = !!it.scoringReportPresent;
    }
    return out;
  }, [data]);

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
                    (hasCommit ? '' : ' agents-iter-pick-btn--global');
                  const phase = it.commit?.phase ?? null;
                  const tooltip = hasCommit
                    ? `${it.iter}` +
                      (phase ? ` · ${phase}` : '') +
                      ` · ${it.commit?.commitId}`
                    : `${it.iter} · global pre-MCP phase (click to jump to its trace card below)`;
                  return (
                    <li key={it.iter}>
                      <button
                        type="button"
                        className={className}
                        data-testid={`agents-iter-pick-${it.iter}`}
                        data-commit-id={it.commit?.commitId ?? ''}
                        data-model-id={it.commit?.modelId ?? ''}
                        data-has-commit={hasCommit ? 'true' : 'false'}
                        title={tooltip}
                        onClick={() => {
                          if (hasCommit) {
                            setPreviewIter(it);
                            return;
                          }
                          // Global pre-MCP iter (iter-0 preflight,
                          // iter-1 reader, iter-2 scope) — no live BIM
                          // commit to preview, so scroll the dashboard
                          // to that iter's narrative card in the
                          // global-phase section instead.
                          const target = document.querySelector(
                            `[data-testid="agents-global-phase-${it.iter}"]`,
                          );
                          if (target instanceof HTMLElement) {
                            target.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            });
                            target.classList.add('agents-global-phase-card--flash');
                            window.setTimeout(() => {
                              target.classList.remove(
                                'agents-global-phase-card--flash',
                              );
                            }, 1600);
                          }
                        }}
                      >
                        {it.iter}
                        {phase ? <small>{phase}</small> : null}
                        {!hasCommit ? <small>narrative ↓</small> : null}
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

          <section
            className="agents-global-phase-section"
            data-testid="agents-global-phase-section"
          >
            <h2>Global preflight + reader trace</h2>
            <p className="agents-count">
              Narrative of what the testhouse driver did during the global
              pre-MCP phases (iter-0 preflight, iter-1 reader, iter-2 scope).
              Each phase runs before any BIM model exists, so it can't ride
              on the per-commit narrative — the driver writes a sidecar
              JSON we surface here instead.
            </p>
            {globalPhaseLoading ? (
              <p>Loading global-phase narratives…</p>
            ) : null}
            {!globalPhaseLoading && globalPhaseEntries.length === 0 ? (
              <p className="agents-warning">
                No global-phase narratives yet — run preflight / reader /
                scope to populate.
              </p>
            ) : null}
            {globalPhaseEntries.length > 0 ? (
              <ul className="agents-global-phase-list">
                {globalPhaseEntries.map(({ iter, file }) => (
                  <li key={iter}>
                    <GlobalPhaseCard iter={iter} file={file} house={house} />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section
            className="agents-trail-section"
            data-testid="agents-trail-section"
          >
            <h2>Doc → fact → element trail</h2>
            <p className="agents-count">
              One card per phase commit, newest iter first. Each card shows
              which IR facts the slice consumed, the rendered source pages
              it drew evidence from, and the BIM elements it produced.
            </p>
            {houseCommitsError ? (
              <p className="agents-error">
                Failed to load commits: {houseCommitsError}
              </p>
            ) : null}
            {!houseCommits && !houseCommitsError ? (
              <p>Loading commits…</p>
            ) : null}
            {houseCommits && commitsByIter.length === 0 ? (
              <p>
                No phase commits with <code>testhouse_iter</code> context
                found for <code>{house}</code>.
              </p>
            ) : null}
            {commitsByIter.map((group) => {
              const scoringText = iterScoring[group.iterLabel];
              const scoringFlag = scoringPresentByIter[group.iterLabel];
              return (
                <div
                  key={group.iter}
                  className="agents-trail-iter"
                  data-testid={`agents-trail-${group.iterLabel}`}
                >
                  <h3 className="agents-trail-iter-title">
                    <span>{group.iterLabel}</span>
                    <small>
                      {group.commits.length} phase commit
                      {group.commits.length === 1 ? '' : 's'}
                    </small>
                  </h3>
                  <ul className="agents-trail-commit-list">
                    {group.commits.map((c) => (
                      <CommitTrailCard
                        key={c.commitId}
                        commit={c}
                        house={house}
                        modelId={c.modelId}
                      />
                    ))}
                  </ul>
                  <details
                    className="agents-trail-scoring"
                    onToggle={(e) => {
                      if ((e.target as HTMLDetailsElement).open) {
                        ensureScoringLoaded(group.iterLabel);
                      }
                    }}
                  >
                    <summary>
                      Visual-fidelity scoring report
                      {scoringFlag ? (
                        <small> (present)</small>
                      ) : (
                        <small> (may be absent — opens to check)</small>
                      )}
                    </summary>
                    {scoringText === undefined ? (
                      <p>Click to load.</p>
                    ) : scoringText === '' ? (
                      <p>Loading…</p>
                    ) : (
                      <pre className="agents-scoring">{scoringText}</pre>
                    )}
                  </details>
                </div>
              );
            })}
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

          <RunLogTail house={house} />


          {data.iterations.length > 0 ? (
          <details className="agents-detail agents-capture-section">
            <summary>
              <strong>Legacy iter-N captures</strong>{' '}
              <small>
                ({data.iterations.length} from the pre-rebuild{' '}
                <code>iter-N-captures/</code> layout, collapsed by default)
              </small>
            </summary>
            <p className="agents-count">
              The new rebuild layout puts captures under{' '}
              <code>tmp/reverse-bim/house-{house}/iter-N/</code> and is rendered
              live via the iter picker above. This section is here only to surface
              evidence from the prior pre-rebuild runs that still exists on disk.
            </p>
            <ul className="agents-iterlist">
              {data.iterations.map((it) => (
                <li key={it.iteration}>
                  <button
                    type="button"
                    className={
                      'agents-iter-btn' +
                      (selectedIter === it.iteration ? ' agents-iter-btn--active' : '')
                    }
                    onClick={() => setSelectedIter(it.iteration)}
                    disabled={it.captureCount === 0}
                  >
                    {it.iteration}{' '}
                    <span className="agents-iter-count">
                      {it.captureCount} {it.scoringReportPresent ? '★' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
          </details>
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

interface CommitTrailCardProps {
  commit: CommitListItem;
  house: string;
  modelId: string;
}

/**
 * One trail card per phase commit. Renders three orthogonal slices of
 * the v2 commit-context block (``testhouse_iter.{consumedFactIds,
 * sourceEvidence, producedElementIds}``):
 *
 *  - **consumedFactIds** as chip buttons. Click → lazy-fetch the fact
 *    JSON from the IR endpoint and pop a small inline detail panel.
 *  - **sourceEvidence** as a thumbnail strip. Each thumbnail loads the
 *    rendered source page via the per-house source-page endpoint
 *    (Ask 1). Click → opens the full PNG in a new tab.
 *  - **producedElementIds** as chip links to the historical viewer at
 *    ``/?modelId=<m>&at=<commit>&select=<elementId>``.
 *
 * Empty arrays are tolerated silently (e.g. the v1 commit
 * `01KSA86DE7T4FMP0A61EZ40P0N` and any future phase commits the driver
 * hasn't filled out yet — the card just renders the title and a hint).
 */
function CommitTrailCard({
  commit,
  house,
  modelId,
}: CommitTrailCardProps): JSX.Element {
  const block = commit.context?.testhouse_iter;
  const facts = block?.consumedFactIds ?? [];
  const evidence = block?.sourceEvidence ?? [];
  const elements = block?.producedElementIds ?? [];
  const phase = block?.phase ?? null;
  const narrative = block?.narrative;
  const commandCount = block?.commandCount;
  const narrativePresent =
    !!narrative &&
    (typeof narrative.input === 'string' ||
      typeof narrative.reasoning === 'string' ||
      typeof narrative.outcome === 'string');
  return (
    <li
      className="agents-trail-card"
      data-testid={`agents-trail-commit-${commit.commitId}`}
    >
      <div className="agents-trail-card-header">
        <span className="agents-trail-phase">
          {phase ? <code>{phase}</code> : <em>no phase</em>}
        </span>
        {typeof commandCount === 'number' && commandCount > 0 ? (
          <small className="agents-trail-cmd-count">
            {commandCount} cmd{commandCount === 1 ? '' : 's'}
          </small>
        ) : null}
        <span className="agents-trail-card-spacer" />
        <a
          className="agents-trail-card-link"
          href={historicalViewerUrl(modelId, commit.commitId)}
          target="_blank"
          rel="noreferrer noopener"
          title={`Open commit ${commit.commitId} in the historical viewer`}
        >
          <code>{commit.commitId.slice(0, 12)}…</code>
        </a>
      </div>
      {narrativePresent ? <NarrativeTrio narrative={narrative} /> : null}
      {facts.length === 0 && evidence.length === 0 && elements.length === 0 ? (
        <p className="agents-trail-empty">
          No v2 trail metadata on this commit (legacy or v1 row).
        </p>
      ) : null}
      {facts.length > 0 ? (
        <div className="agents-trail-block">
          <span className="agents-trail-label">Consumed facts</span>
          <ul className="agents-chip-list">
            {facts.map((fid) => (
              <li key={fid}>
                <FactChip house={house} factId={fid} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {evidence.length > 0 ? (
        <div className="agents-trail-block">
          <span className="agents-trail-label">Source evidence</span>
          <ul className="agents-thumb-strip">
            {evidence.map((ev, i) => (
              <li key={`${ev.docId}-${ev.page}-${i}`}>
                <SourceThumb evidence={ev} house={house} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {elements.length > 0 ? (
        <div className="agents-trail-block">
          <span className="agents-trail-label">Produced elements</span>
          <ul className="agents-chip-list">
            {elements.map((eid) => (
              <li key={eid}>
                <a
                  className="agents-chip agents-chip--element"
                  href={historicalViewerUrl(modelId, commit.commitId, eid)}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={`Open ${eid} at this commit`}
                >
                  <code>{eid}</code>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

interface FactChipProps {
  house: string;
  factId: string;
}

/**
 * A chip that lazily loads the underlying IR fact via the per-house
 * fact endpoint when expanded. Renders the chip text as the factId and
 * a compact value summary in the popover (one of valueMm, vertexMm,
 * polygonMm-vertex-count, or text — whichever is present).
 */
function FactChip({ house, factId }: FactChipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [fact, setFact] = useState<ExtractedFact | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    if (next && !fact && !loading && !err) {
      setLoading(true);
      fetch(
        `/api/agent-runs/houses/${encodeURIComponent(house)}/facts/${encodeURIComponent(factId)}`,
      )
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          return res.json() as Promise<ExtractedFact>;
        })
        .then((payload) => {
          setFact(payload);
          setLoading(false);
        })
        .catch((e) => {
          setErr(e instanceof Error ? e.message : String(e));
          setLoading(false);
        });
    }
  };

  return (
    <div className={'agents-chip-wrap' + (open ? ' agents-chip-wrap--open' : '')}>
      <button
        type="button"
        className="agents-chip agents-chip--fact"
        onClick={toggle}
        aria-expanded={open}
        title={`Show details for ${factId}`}
      >
        <code>{factId}</code>
      </button>
      {open ? (
        <div className="agents-chip-popover" role="dialog">
          {loading ? <p>Loading…</p> : null}
          {err ? <p className="agents-error">{err}</p> : null}
          {fact ? <FactDetails fact={fact} house={house} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function FactDetails({ fact, house }: { fact: ExtractedFact; house: string }): JSX.Element {
  // Pick the most-load-bearing value field to summarise. Order matches
  // the IR schema's most-specific-first preference: a polygonMm fact
  // (room outline) reads as N vertices, a vertexMm fact (single point)
  // reads as a coordinate, a valueMm fact (height) reads as the
  // millimetre integer, and a text-only fact reads as the text.
  let valueSummary: JSX.Element | null = null;
  if (Array.isArray(fact.polygonMm)) {
    valueSummary = (
      <>
        <strong>polygonMm:</strong> {fact.polygonMm.length} vertices
      </>
    );
  } else if (Array.isArray(fact.vertexMm)) {
    valueSummary = (
      <>
        <strong>vertexMm:</strong> [{fact.vertexMm[0]}, {fact.vertexMm[1]}]
      </>
    );
  } else if (typeof fact.valueMm === 'number') {
    valueSummary = (
      <>
        <strong>valueMm:</strong> {fact.valueMm} mm
      </>
    );
  } else if (typeof fact.text === 'string' && fact.text.length > 0) {
    valueSummary = (
      <>
        <strong>text:</strong> {fact.text}
      </>
    );
  }
  return (
    <dl className="agents-fact-details">
      <dt>kind</dt>
      <dd>
        <code>{fact.kind}</code>
      </dd>
      <dt>status</dt>
      <dd>
        <code>{fact.status ?? '—'}</code>
      </dd>
      {fact.levelId ? (
        <>
          <dt>level</dt>
          <dd>
            <code>{fact.levelId}</code>
          </dd>
        </>
      ) : null}
      {fact.confidence ? (
        <>
          <dt>confidence</dt>
          <dd>{fact.confidence}</dd>
        </>
      ) : null}
      {valueSummary ? (
        <>
          <dt>value</dt>
          <dd>{valueSummary}</dd>
        </>
      ) : null}
      {fact.sourcePage ? (
        <>
          <dt>source</dt>
          <dd>
            <code>{fact.sourcePage}</code>
            {fact.sourceDocId ? (
              <FactSourceThumb
                house={house}
                docId={fact.sourceDocId}
                page={fact.sourcePage}
              />
            ) : null}
          </dd>
        </>
      ) : null}
      {fact.derivationNote ? (
        <>
          <dt>derived</dt>
          <dd>
            <span className="agents-fact-derivation-label">
              How the reader saw it:
            </span>{' '}
            {fact.derivationNote}
          </dd>
        </>
      ) : null}
      {fact.note ? (
        <>
          <dt>note</dt>
          <dd>{fact.note}</dd>
        </>
      ) : null}
    </dl>
  );
}

interface FactSourceThumbProps {
  house: string;
  docId: string;
  page: string;
}

/**
 * Inline thumbnail of the rendered source PNG that backs a fact. The
 * fact carries ``sourceDocId`` + ``sourcePage`` (e.g. ``"EG-1.png"``);
 * we reuse the per-house source-pages endpoint so the popover shows
 * the reader's evidence inline. Click → full PNG in a new tab.
 */
function FactSourceThumb({ house, docId, page }: FactSourceThumbProps): JSX.Element {
  const url = `/api/agent-runs/houses/${encodeURIComponent(house)}/source-pages/${encodeURIComponent(docId)}/${encodeURIComponent(page)}`;
  return (
    <a
      className="agents-fact-source-thumb"
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={`Open ${docId}/${page} in a new tab`}
    >
      <img src={url} alt={`Source page ${page}`} loading="lazy" />
    </a>
  );
}

interface SourceThumbProps {
  evidence: TestHouseSourceEvidence;
  house: string;
}

/**
 * Renders one ``<a>`` wrapping a thumbnail ``<img>`` for a source-
 * evidence row. The `page` field carries the PNG filename (e.g.
 * "EG-1.png") and the docId picks the rendered-pages subfolder. The
 * source-page endpoint serves the full PNG; the browser scales it
 * down for the thumbnail without a separate thumb file.
 */
function SourceThumb({ evidence, house }: SourceThumbProps): JSX.Element {
  const url = `/api/agent-runs/houses/${encodeURIComponent(house)}/source-pages/${encodeURIComponent(evidence.docId)}/${encodeURIComponent(evidence.page)}`;
  return (
    <a
      className="agents-thumb"
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={`${evidence.docId} / ${evidence.page}${evidence.role ? ` · role=${evidence.role}` : ''}`}
    >
      <img src={url} alt={`${evidence.docId} ${evidence.page}`} loading="lazy" />
      <span className="agents-thumb-caption">
        <code>{evidence.page}</code>
        {evidence.role ? <small>{evidence.role}</small> : null}
      </span>
    </a>
  );
}

interface NarrativeTrioProps {
  narrative: TestHousePhaseNarrative | undefined;
}

/**
 * Renders the three-block "Input / Reasoning / Outcome" narrative
 * panel used in two places:
 *   1. Inside each per-commit trail card (the per-commit narrative
 *      carrier the v2 driver writes alongside chip lists).
 *   2. Inside each global-phase card (preflight / reader / scope).
 *
 * Empty fields render as a hyphen so the layout doesn't collapse;
 * the caller decides whether to mount the component at all.
 */
function NarrativeTrio({ narrative }: NarrativeTrioProps): JSX.Element {
  const input = narrative?.input ?? '';
  const reasoning = narrative?.reasoning ?? '';
  const outcome = narrative?.outcome ?? '';
  return (
    <div className="agents-narrative-panel">
      <div className="agents-narrative-block">
        <span className="agents-narrative-label">Input</span>
        <p className="agents-narrative-text">{input || <em>—</em>}</p>
      </div>
      <div className="agents-narrative-block">
        <span className="agents-narrative-label">Reasoning</span>
        <p className="agents-narrative-text">{reasoning || <em>—</em>}</p>
      </div>
      <div className="agents-narrative-block">
        <span className="agents-narrative-label">Outcome</span>
        <p className="agents-narrative-text">{outcome || <em>—</em>}</p>
      </div>
    </div>
  );
}

interface GlobalPhaseCardProps {
  iter: string;
  file: PhaseNarrativeFile;
  house: string;
}

/**
 * One card per global pre-MCP phase (iter-0 preflight, iter-1 reader,
 * iter-2 scope). Displays the narrative trio, the list of inputs the
 * phase consumed, the list of outputs it produced (rendered-pages
 * outputs expand to a thumbnail strip via the per-house source-page
 * endpoint), and the elapsed-ms metric in the corner.
 */
function GlobalPhaseCard({ iter, file, house }: GlobalPhaseCardProps): JSX.Element {
  const inputs = Array.isArray(file.inputs) ? file.inputs : [];
  const outputs = Array.isArray(file.outputs) ? file.outputs : [];
  const elapsedSeconds =
    typeof file.elapsedMs === 'number' && file.elapsedMs > 0
      ? (file.elapsedMs / 1000).toFixed(1)
      : null;
  return (
    <div
      className="agents-global-phase-card"
      data-testid={`agents-global-phase-${iter}`}
    >
      <div className="agents-global-phase-header">
        <span className="agents-global-phase-iter">
          <code>{iter}</code>
        </span>
        <span className="agents-global-phase-phase">{file.phase}</span>
        <span className="agents-trail-card-spacer" />
        {elapsedSeconds ? (
          <span className="agents-global-phase-elapsed" title="Elapsed wall-time">
            {elapsedSeconds}s
          </span>
        ) : null}
      </div>
      <NarrativeTrio narrative={file.narrative} />
      {inputs.length > 0 ? (
        <div className="agents-global-phase-section">
          <span className="agents-global-phase-section-label">Inputs</span>
          <ul className="agents-global-phase-inputs">
            {inputs.map((inp, i) => (
              <li key={`${inp.path}-${i}`}>
                <span className="agents-global-phase-input-idx">
                  Input {i + 1}:
                </span>{' '}
                <code>{inp.path}</code>
                {typeof inp.fileCount === 'number' ? (
                  <small> ({inp.fileCount} files)</small>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {outputs.length > 0 ? (
        <div className="agents-global-phase-section">
          <span className="agents-global-phase-section-label">Outputs</span>
          <ul className="agents-global-phase-outputs">
            {outputs.map((out, i) => (
              <li key={`${out.path}-${i}`}>
                <GlobalPhaseOutput output={out} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface GlobalPhaseOutputProps {
  output: PhaseNarrativeOutput;
}

/**
 * Render one entry from a phase's ``outputs[]`` list. We show the
 * role tag (e.g. "manifest", "renderedPages") plus the on-disk path.
 * Path strings are relative to the repo root and surfaced as plain
 * code — they're not directly clickable without a filesystem-browse
 * endpoint (the per-fact source-evidence chip strip already provides
 * the visual thumbnail path through the source-pages endpoint).
 */
function GlobalPhaseOutput({ output }: GlobalPhaseOutputProps): JSX.Element {
  const role = output.role ?? null;
  return (
    <span className="agents-global-phase-output">
      {role ? <code className="agents-global-phase-output-role">{role}</code> : null}
      <code className="agents-global-phase-output-path">{output.path}</code>
    </span>
  );
}

interface RunLogEvent {
  ts?: string;
  level?: string;
  logger?: string;
  msg?: string;
  category?: string;
  severity?: string;
  house?: string;
  iter?: number | null;
  phase?: string;
  correlation_id?: string;
  [k: string]: unknown;
}

interface RunLogTailResponse {
  house: string;
  path: string;
  lineCount: number;
  events: RunLogEvent[];
}

interface RunLogTailProps {
  house: string;
}

/**
 * Tail of the per-house ``run.jsonl`` log written by the testhouse
 * driver. Lets a reviewer scroll the full agent timeline without
 * grepping stderr. Lazy-loaded on first <details> open and refreshed
 * on demand. The endpoint reads at most the last 1 MB tail so it
 * stays cheap on long runs.
 */
function RunLogTail({ house }: RunLogTailProps): JSX.Element {
  const [data, setData] = useState<RunLogTailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchTail = (): void => {
    setLoading(true);
    setErr(null);
    fetch(
      `/api/agent-runs/houses/${encodeURIComponent(house)}/log-tail?lines=300`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<RunLogTailResponse>;
      })
      .then((p) => {
        setData(p);
        setLoading(false);
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  };

  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>): void => {
    if (e.currentTarget.open && !data && !loading) fetchTail();
  };

  return (
    <details
      className="agents-detail agents-run-log-section"
      onToggle={onToggle}
      data-testid="agents-run-log"
    >
      <summary>
        <strong>Run log (run.jsonl tail)</strong>{" "}
        <small>
          {data
            ? `${data.lineCount} events`
            : loading
              ? "loading…"
              : "click to load"}
        </small>{" "}
        <button
          type="button"
          className="agents-run-log-refresh"
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            fetchTail();
          }}
        >
          refresh
        </button>
      </summary>
      {err ? <p className="agents-error">Failed: {err}</p> : null}
      {data ? (
        <ol className="agents-run-log-events" data-testid="agents-run-log-events">
          {data.events.map((ev, i) => {
            const severity = String(ev.severity ?? ev.level ?? "info");
            const msg = String(ev.msg ?? "");
            const category = String(
              ev.category ??
                (msg.includes("ortho_capture") || msg.includes("captured")
                  ? "capture"
                  : msg.includes("grade")
                    ? "grade"
                    : msg.includes("narrative")
                      ? "narrative_global"
                      : msg.includes("skipped") || msg.includes("skip")
                        ? "skip"
                        : msg.endsWith(".end")
                          ? "phase_end"
                          : msg.endsWith(".start")
                            ? "phase_start"
                            : msg.endsWith(".commit_opened") ||
                                msg.endsWith(".commit_closed")
                              ? "commit"
                              : "phase"),
            );
            const icon =
              severity === "error"
                ? "⛔"
                : severity === "warn"
                  ? "⚠️"
                  : category.startsWith("capture")
                    ? "📸"
                    : category.startsWith("grade")
                      ? "🏁"
                      : category.startsWith("narrative")
                        ? "📝"
                        : category.startsWith("skip")
                          ? "⤵️"
                          : category === "phase_start"
                            ? "▶"
                            : category === "phase_end"
                              ? "✓"
                              : category === "commit"
                                ? "💾"
                                : "•";
            const ts = String(ev.ts ?? "");
            const phase = String(ev.phase ?? "");
            const iter =
              ev.iter === null || ev.iter === undefined ? "" : `iter-${ev.iter}`;
            return (
              <li key={i} className={`agents-run-log-event sev-${severity}`}>
                <span className="agents-run-log-icon" title={category}>
                  {icon}
                </span>
                <code className="agents-run-log-ts">{ts}</code>{" "}
                {iter ? <code className="agents-run-log-iter">{iter}</code> : null}{" "}
                {phase ? <code className="agents-run-log-phase">{phase}</code> : null}{" "}
                <span className="agents-run-log-msg">{String(ev.msg ?? "")}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </details>
  );
}
