import { type JSX, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
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

            <div className="agents-card">
              <h3>Iterations with captures</h3>
              <ul className="agents-iterlist">
                {data.iterations.length === 0 ? <li>None yet.</li> : null}
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
            </div>
          </section>

          <section className="agents-capture-section">
            <h2>Iteration capture {selectedIter ? <code>{selectedIter}</code> : null}</h2>
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
              <p>Pick an iteration above to view captures.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
