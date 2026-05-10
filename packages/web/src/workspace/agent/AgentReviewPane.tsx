import { useMemo, useState } from 'react';

import { Btn } from '@bim-ai/ui';

import { useBimStore } from '../../state/store';
import {
  AgentBriefAcceptanceReadoutV1Table,
  formatAgentBriefAcceptanceReadoutLines,
  parseAgentBriefAcceptanceReadoutV1,
} from './agentBriefAcceptanceReadout';
import {
  formatAgentBriefCommandProtocolReadout,
  parseAgentBriefCommandProtocolV1,
} from './agentBriefCommandProtocol';
import {
  formatAgentGeneratedBundleQaChecklistReadout,
  parseAgentGeneratedBundleQaChecklistV1,
} from './agentGeneratedBundleQaChecklist';
import {
  buildBrowserRenderingBudgetReadoutV1,
  formatBrowserRenderingBudgetLines,
} from '../readouts';
import {
  formatAgentReviewReadoutConsistencyClosureLines,
  parseAgentReviewReadoutConsistencyClosureV1,
} from './agentReviewReadoutConsistencyClosure';
import { EvidenceArtifactCorrelationPanel } from '../review/EvidenceArtifactCorrelationPanel';
import {
  parseEvidenceArtifact,
  parseRoomCandidates,
  type RoomCand,
} from '../review/evidenceArtifactParser';

type JsonText = string;

/** Agent-style review workflow: assumptions, dry-run bundle, validate + evidence-package. */
export function AgentReviewPane() {
  const [schemaTxt, setSchemaTxt] = useState<JsonText | null>(null);
  const [evidenceTxt, setEvidenceTxt] = useState<JsonText | null>(null);
  const [bundleText, setBundleText] = useState<string>('{"commands":[]}');
  const [dryRunTxt, setDryRunTxt] = useState<JsonText | null>(null);
  const [roomCandTxt, setRoomCandTxt] = useState<JsonText | null>(null);
  const [roomCandError, setRoomCandError] = useState<string | null>(null);
  const [assumeLogTxt, setAssumeLogTxt] = useState<JsonText>(
    JSON.stringify(
      [
        'Golden bundles target an isolated model revision — avoid stacking repeats blindly.',
        'Coordinates are mm; disciplines default residential unless commanded otherwise.',
      ],
      null,
      2,
    ),
  );
  const [stepLog, setStepLog] = useState<string[]>([]);

  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);

  function pushStep(line: string) {
    setStepLog((p) => [...p.slice(-80), `[${new Date().toISOString()}] ${line}`]);
  }

  const assumptionsJson = useMemo(() => {
    try {
      const raw = assumeLogTxt.trim();
      const parsed = JSON.parse(raw === '' ? '[]' : raw) as unknown;
      const arr = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
      return { assumptionLogFormat: 'assumptionLog_v0', assumptions: arr };
    } catch {
      return {
        assumptionLogFormat: 'assumptionLog_v0',
        assumptions: [],
        error: 'Invalid JSON array',
      };
    }
  }, [assumeLogTxt]);

  const dryRunBriefProtocol = useMemo(() => {
    if (!dryRunTxt) return null;
    try {
      const root = JSON.parse(dryRunTxt) as Record<string, unknown>;
      const dr = root.dryRun;
      if (dr !== null && typeof dr === 'object' && !Array.isArray(dr)) {
        return parseAgentBriefCommandProtocolV1(
          (dr as Record<string, unknown>).agentBriefCommandProtocol_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [dryRunTxt]);

  const evidenceBriefProtocol = useMemo(() => {
    if (!evidenceTxt) return null;
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const pay = root.payload ?? root.evidencePackage;
      if (pay !== null && typeof pay === 'object' && !Array.isArray(pay)) {
        return parseAgentBriefCommandProtocolV1(
          (pay as Record<string, unknown>).agentBriefCommandProtocol_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [evidenceTxt]);

  const evidenceQaChecklist = useMemo(() => {
    if (!evidenceTxt) return null;
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const pay = root.payload ?? root.evidencePackage;
      if (pay !== null && typeof pay === 'object' && !Array.isArray(pay)) {
        return parseAgentGeneratedBundleQaChecklistV1(
          (pay as Record<string, unknown>).agentGeneratedBundleQaChecklist_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [evidenceTxt]);

  const dryRunQaChecklist = useMemo(() => {
    if (!dryRunTxt) return null;
    try {
      const root = JSON.parse(dryRunTxt) as Record<string, unknown>;
      const dr = root.dryRun;
      if (dr !== null && typeof dr === 'object' && !Array.isArray(dr)) {
        return parseAgentGeneratedBundleQaChecklistV1(
          (dr as Record<string, unknown>).agentGeneratedBundleQaChecklist_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [dryRunTxt]);

  const evidenceAcceptanceReadout = useMemo(() => {
    if (!evidenceTxt) return null;
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const pay = root.payload ?? root.evidencePackage;
      if (pay !== null && typeof pay === 'object' && !Array.isArray(pay)) {
        return parseAgentBriefAcceptanceReadoutV1(
          (pay as Record<string, unknown>).agentBriefAcceptanceReadout_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [evidenceTxt]);

  const dryRunAcceptanceReadout = useMemo(() => {
    if (!dryRunTxt) return null;
    try {
      const root = JSON.parse(dryRunTxt) as Record<string, unknown>;
      const dr = root.dryRun;
      if (dr !== null && typeof dr === 'object' && !Array.isArray(dr)) {
        return parseAgentBriefAcceptanceReadoutV1(
          (dr as Record<string, unknown>).agentBriefAcceptanceReadout_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [dryRunTxt]);

  const evidenceConsistencyClosure = useMemo(() => {
    if (!evidenceTxt) return null;
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const pay = root.payload ?? root.evidencePackage;
      if (pay !== null && typeof pay === 'object' && !Array.isArray(pay)) {
        return parseAgentReviewReadoutConsistencyClosureV1(
          (pay as Record<string, unknown>).agentReviewReadoutConsistencyClosure_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [evidenceTxt]);

  const dryRunConsistencyClosure = useMemo(() => {
    if (!dryRunTxt) return null;
    try {
      const root = JSON.parse(dryRunTxt) as Record<string, unknown>;
      const dr = root.dryRun;
      if (dr !== null && typeof dr === 'object' && !Array.isArray(dr)) {
        return parseAgentReviewReadoutConsistencyClosureV1(
          (dr as Record<string, unknown>).agentReviewReadoutConsistencyClosure_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [dryRunTxt]);

  const elementsById = useBimStore((s) => s.elementsById);

  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const scheduleBudgetHydration = useBimStore((s) => s.scheduleBudgetHydration);

  const browserRenderingBudgetReadout = useMemo(
    () =>
      buildBrowserRenderingBudgetReadoutV1({
        elementsById,
        planProjectionPrimitives,
        scheduleHydratedRowCount: scheduleBudgetHydration?.rowCount ?? null,
        scheduleHydratedTab: scheduleBudgetHydration?.tab ?? null,
      }),
    [elementsById, planProjectionPrimitives, scheduleBudgetHydration],
  );

  const browserRenderingBudgetLines = useMemo(
    () => formatBrowserRenderingBudgetLines(browserRenderingBudgetReadout),
    [browserRenderingBudgetReadout],
  );

  const authoredRoomStats = useMemo(() => {
    const rooms = Object.values(elementsById).filter((e) => e.kind === 'room');

    return { count: rooms.length };
  }, [elementsById]);

  const evidenceArtifactSummary = useMemo(
    () => parseEvidenceArtifact(evidenceTxt, revision),
    [evidenceTxt, revision],
  );

  const roomCandPreview = useMemo(() => parseRoomCandidates(roomCandTxt), [roomCandTxt]);

  function appendRoomCandidateCommands(cands: RoomCand[]) {
    const flat: unknown[] = [];
    for (const c of cands) {
      const sb = c.suggestedBundleCommands;
      if (Array.isArray(sb)) {
        for (const cmd of sb) {
          flat.push(cmd);
        }
      }
    }
    if (!flat.length) return;
    try {
      const env = JSON.parse(bundleText || '{}') as { commands?: unknown[] };
      const existing = Array.isArray(env.commands) ? env.commands : [];
      env.commands = [...existing, ...flat];
      setBundleText(JSON.stringify(env, null, 2));
      pushStep(`appended ${flat.length} commands from room derivation candidates`);
    } catch {
      pushStep('failed to merge room candidate commands into bundle JSON');
    }
  }

  return (
    <div className="space-y-3 text-[11px]">
      <div>
        <div className="font-semibold text-muted">Guided workflow</div>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted">
          <li>
            Inspect schema + attach an <strong>assumption log</strong> (JSON array of strings).
          </li>
          <li>Paste a command bundle and run bundle dry-run (no commit).</li>
          <li>
            Fetch validation + evidence-package JSON and compare with Playwright screenshots in CI.
          </li>
          <li>
            Use advisor quick-fixes before applying bundles to production models. Watch{' '}
            <code className="text-[10px]">schedule_opening_*</code> rows for hosted openings and use
            the Schedules panel definition presets to confirm required export columns are present on
            the server table.
          </li>
        </ol>
      </div>

      <div>
        <div className="font-semibold text-muted">Model context</div>
        <p className="mt-1 text-muted">
          Active model <code className="text-[10px]">{modelId ?? '—'}</code> · revision r{revision}
        </p>
      </div>

      <div
        className="rounded border border-border bg-background/40 p-2"
        data-testid="agent-review-browser-rendering-budget"
      >
        <div className="text-[10px] font-semibold text-muted">
          Browser rendering budget (browserRenderingBudgetReadout_v1)
        </div>
        <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
          {browserRenderingBudgetLines.map((ln, idx) => (
            <li key={`br-${idx}`}>
              <code className="whitespace-pre-wrap break-all font-mono text-[9px]">{ln}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded border border-border bg-background/40 p-2">
        <label className="block text-[10px] font-semibold text-muted">
          Assumption log (JSON string array — attached to bundled evidence previews)
          <textarea
            className="mt-1 w-full rounded border border-border bg-background p-2 font-mono text-[10px]"
            rows={6}
            value={assumeLogTxt}
            onChange={(e) => setAssumeLogTxt(e.target.value)}
          />
        </label>
        {'error' in assumptionsJson && assumptionsJson.error ? (
          <div className="mt-1 text-[10px] text-amber-500">{assumptionsJson.error}</div>
        ) : (
          <div className="mt-2 text-[10px] text-muted">
            Attached shape:{' '}
            <code className="text-[10px]">{JSON.stringify(assumptionsJson, null, 0)}</code>
          </div>
        )}
      </div>

      <div className="rounded border border-border bg-background/40 p-2">
        <div className="font-semibold text-muted">Command bundle (JSON)</div>
        <textarea
          aria-label="Command bundle (JSON)"
          className="mt-2 w-full rounded border border-border bg-background p-2 font-mono text-[10px]"
          rows={6}
          spellCheck={false}
          value={bundleText}
          onChange={(e) => setBundleText(e.target.value)}
        />

        <div className="mt-2 flex flex-wrap gap-2">
          <Btn
            type="button"
            variant="quiet"
            className="text-[11px]"
            disabled={!modelId}
            title={!modelId ? 'Bootstrap a model first' : undefined}
            onClick={() =>
              void (async () => {
                if (!modelId) return;
                try {
                  const env = JSON.parse(bundleText || '{}') as { commands?: unknown };
                  const commands = Array.isArray(env.commands) ? env.commands : [];
                  const res = await fetch(
                    `/api/models/${encodeURIComponent(modelId)}/commands/bundle/dry-run`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ commands }),
                    },
                  );
                  const body = JSON.parse(await res.text()) as unknown;
                  const merged = { assumptionPreview: assumptionsJson, dryRun: body };
                  setDryRunTxt(JSON.stringify(merged, null, 2));
                  pushStep(`bundle dry-run ${res.ok ? 'ok' : 'failed'}`);
                  if (!res.ok) throw new Error(JSON.stringify(body));
                } catch (e) {
                  setDryRunTxt(e instanceof Error ? e.message : String(e));
                  pushStep(`bundle dry-run error`);
                }
              })()
            }
          >
            POST bundle dry-run
          </Btn>

          <Btn
            type="button"
            variant="quiet"
            className="text-[11px]"
            disabled={!modelId}
            title={!modelId ? 'Bootstrap a model first' : undefined}
            onClick={() =>
              void (async () => {
                if (!modelId) return;
                try {
                  const valRes = await fetch(`/api/models/${encodeURIComponent(modelId)}/validate`);
                  const val = JSON.parse(await valRes.text()) as unknown;

                  const evRes = await fetch(
                    `/api/models/${encodeURIComponent(modelId)}/evidence-package`,
                  );
                  const ev = JSON.parse(await evRes.text()) as unknown;
                  const merged = {
                    assumptions: assumptionsJson,
                    validate: val,
                    evidencePackage: ev,
                  };
                  setEvidenceTxt(JSON.stringify(merged, null, 2));
                  pushStep(`validate+evidence ${valRes.ok && evRes.ok ? 'ok' : 'partial failure'}`);
                } catch (e) {
                  setEvidenceTxt(e instanceof Error ? e.message : String(e));
                  pushStep('validate+evidence error');
                }
              })()
            }
          >
            Validate + fetch evidence-package
          </Btn>

          <Btn
            type="button"
            variant="quiet"
            className="text-[11px]"
            disabled={!modelId}
            title={!modelId ? 'Bootstrap a model first' : undefined}
            onClick={() =>
              void (async () => {
                if (!modelId) return;
                try {
                  const res = await fetch(
                    `/api/models/${encodeURIComponent(modelId)}/room-derivation-candidates`,
                  );
                  const body = JSON.parse(await res.text()) as unknown;
                  if (!res.ok) throw new Error(JSON.stringify(body));
                  setRoomCandTxt(JSON.stringify(body, null, 2));
                  setRoomCandError(null);
                  pushStep('room-derivation-candidates fetch ok');
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  setRoomCandError(msg);
                  setRoomCandTxt(null);
                  pushStep('room-derivation-candidates error');
                }
              })()
            }
          >
            Fetch room-derivation-candidates
          </Btn>
        </div>
      </div>

      {roomCandError ? (
        <div className="rounded border border-border border-amber-500/40 bg-background/40 p-2 text-[10px] text-amber-600">
          {roomCandError}
        </div>
      ) : null}

      {roomCandTxt ? (
        <div className="rounded border border-border bg-background/40 p-2">
          <div className="font-semibold text-muted">Room derivation (review)</div>
          <p className="mt-1 text-[10px] text-muted" data-testid="room-derivation-browser-context">
            Browser snapshot: {authoredRoomStats.count} authored room(s). Use comparison below
            against server candidates.
          </p>
          {roomCandPreview && roomCandPreview.length > 0 ? (
            <div data-testid="room-derivation-comparison" className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted">
                    <th className="py-1 pe-2">Candidate</th>
                    <th className="py-1 pe-2">Level</th>
                    <th className="py-1 pe-2">A (m²)</th>
                    <th className="py-1 pe-2">Perim (m)</th>
                    <th className="py-1 pe-2">Best room</th>
                    <th className="py-1 pe-2">IoU≈</th>
                    <th className="py-1 pe-2">Warnings</th>
                    <th className="py-1">Hint</th>
                  </tr>
                </thead>
                <tbody>
                  {roomCandPreview.map((row) => (
                    <tr key={row.id} className="border-t border-border/40">
                      <td className="py-1 pe-2 font-mono">{row.id.slice(0, 12)}…</td>
                      <td className="py-1 pe-2">{row.level || '—'}</td>
                      <td className="py-1 pe-2">{row.area != null ? row.area.toFixed(2) : '—'}</td>
                      <td className="py-1 pe-2">
                        {row.perimeter != null ? row.perimeter.toFixed(2) : '—'}
                      </td>
                      <td className="py-1 pe-2 font-mono">{row.bestRoomId || '—'}</td>
                      <td className="py-1 pe-2">
                        {row.bestIou != null ? row.bestIou.toFixed(2) : '—'}
                      </td>
                      <td className="py-1 pe-2">{row.warnCount}</td>
                      <td className="py-1">
                        {row.hint ? (
                          <span
                            className="inline-block size-3 rounded-full border border-border"
                            style={{ backgroundColor: row.hint }}
                            title={row.hint}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn
              type="button"
              variant="quiet"
              className="text-[11px]"
              onClick={() => {
                try {
                  const parsed = JSON.parse(roomCandTxt || '{}') as { candidates?: RoomCand[] };
                  const cands = Array.isArray(parsed.candidates) ? parsed.candidates : [];
                  appendRoomCandidateCommands(cands);
                } catch {
                  pushStep('room candidate merge parse error');
                }
              }}
            >
              Append all suggested bundle commands
            </Btn>
          </div>
          <pre className="mt-2 max-h-40 overflow-auto rounded border bg-background p-2 text-[10px]">
            {roomCandTxt}
          </pre>
        </div>
      ) : null}

      <div>
        <div className="font-semibold text-muted">Evidence checklist (CLI)</div>
        <p className="mt-1 text-muted">
          Run from a shell with <code className="text-[10px]">BIM_AI_MODEL_ID</code> and optional{' '}
          <code className="text-[10px]">BIM_AI_BASE_URL</code> pointing at this stack.
        </p>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted">
          <li>
            <code className="text-[10px]">bim-ai presets</code> — schema + preset ids
          </li>
          <li>
            <code className="text-[10px]">bim-ai schema</code> — full command wire schema
          </li>
          <li>
            <code className="text-[10px]">bim-ai evidence</code> — snapshot counts + validate rollup
          </li>
          <li>
            <code className="text-[10px]">bim-ai apply-bundle --dry-run &lt;bundle.json</code> —
            commit preview
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <Btn
          type="button"
          variant="quiet"
          className="text-[11px]"
          onClick={() =>
            void (async () => {
              try {
                const res = await fetch('/api/schema');
                const body = JSON.parse(await res.text()) as unknown;
                if (!res.ok) throw new Error(String(body));
                setSchemaTxt(JSON.stringify(body, null, 2));
              } catch {
                setSchemaTxt('failed to fetch /api/schema');
              }
            })()
          }
        >
          Load /api/schema
        </Btn>

        <Btn
          type="button"
          variant="quiet"
          className="text-[11px]"
          disabled={!modelId}
          title={!modelId ? 'Bootstrap a model first' : undefined}
          onClick={() =>
            void (async () => {
              if (!modelId) return;
              try {
                const snapRes = await fetch(`/api/models/${encodeURIComponent(modelId)}/snapshot`);
                const snap = JSON.parse(await snapRes.text()) as Record<string, unknown>;
                const valRes = await fetch(`/api/models/${encodeURIComponent(modelId)}/validate`);
                const val = JSON.parse(await valRes.text()) as Record<string, unknown>;
                if (!snapRes.ok) throw new Error(JSON.stringify(snap));
                if (!valRes.ok) throw new Error(JSON.stringify(val));

                const elements = snap.elements as
                  | Record<string, Record<string, unknown>>
                  | undefined;
                const counts: Record<string, number> = {};
                if (elements) {
                  for (const row of Object.values(elements)) {
                    const k = typeof row.kind === 'string' ? row.kind : '?';
                    counts[k] = (counts[k] ?? 0) + 1;
                  }
                }
                const bundled = {
                  assumptions: assumptionsJson,
                  generatedAt: new Date().toISOString(),
                  modelId,
                  revision: snap.revision,
                  elementCount: elements ? Object.keys(elements).length : 0,
                  countsByKind: counts,
                  validate: val,
                };
                setEvidenceTxt(JSON.stringify(bundled, null, 2));
              } catch (e) {
                setEvidenceTxt(e instanceof Error ? e.message : String(e));
              }
            })()
          }
        >
          Fetch browser evidence bundle (snapshot + validate)
        </Btn>

        <Btn
          type="button"
          variant="quiet"
          className="text-[11px]"
          disabled={!modelId}
          title={!modelId ? 'Bootstrap a model first' : undefined}
          onClick={() =>
            void (async () => {
              if (!modelId) return;
              try {
                const res = await fetch(
                  `/api/models/${encodeURIComponent(modelId)}/evidence-package`,
                );
                const body = JSON.parse(await res.text()) as unknown;
                if (!res.ok) throw new Error(String(body));
                setEvidenceTxt(
                  JSON.stringify({ assumptions: assumptionsJson, payload: body }, null, 2),
                );
              } catch (e) {
                setEvidenceTxt(e instanceof Error ? e.message : String(e));
              }
            })()
          }
        >
          Fetch evidence-package JSON
        </Btn>
      </div>

      {stepLog.length ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold text-muted">Run trace</div>
          <pre className="max-h-32 overflow-auto rounded border bg-background p-2 text-[10px]">
            {stepLog.join('\n')}
          </pre>
        </div>
      ) : null}

      {dryRunBriefProtocol !== null || evidenceBriefProtocol !== null ? (
        <div
          data-testid="agent-brief-command-protocol"
          className="rounded border border-border bg-background/40 p-2"
        >
          <div className="text-[10px] font-semibold text-muted">Brief → command protocol</div>
          <p className="mt-1 text-[10px] text-muted">
            Deterministic readout from model state + validation violations + optional command
            preview (evidence-package uses an empty proposed-command list; dry-run uses your
            bundle).
          </p>
          {evidenceBriefProtocol !== null ? (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted">
                Evidence-package snapshot (proposedCommandCount from server digest)
              </div>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px]">
                {formatAgentBriefCommandProtocolReadout(evidenceBriefProtocol).join('\n')}
              </pre>
            </div>
          ) : null}
          {dryRunBriefProtocol !== null ? (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted">Last bundle dry-run preview</div>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px]">
                {formatAgentBriefCommandProtocolReadout(dryRunBriefProtocol).join('\n')}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {evidenceQaChecklist !== null || dryRunQaChecklist !== null ? (
        <div
          data-testid="agent-generated-bundle-qa-checklist"
          className="rounded border border-border bg-background/40 p-2"
        >
          <div className="text-[10px] font-semibold text-muted">Generated bundle QA checklist</div>
          <p className="mt-2 text-[11px] font-medium text-foreground">
            Deterministic QA summary only. It does not auto-execute commands on the model, does not
            apply remediation, and does not replace human review.
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Row order is stable and matches the evidence-package / dry-run payloads. Use Fetch
            evidence-package JSON for full coverage rows; bundle dry-run narrows command +
            validation preview.
          </p>
          {evidenceQaChecklist !== null ? (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted">
                Evidence-package checklist (agentGeneratedBundleQaChecklist_v1)
              </div>
              <pre className="mt-1 max-h-48 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug">
                {formatAgentGeneratedBundleQaChecklistReadout(evidenceQaChecklist).join('\n')}
              </pre>
            </div>
          ) : null}
          {dryRunQaChecklist !== null ? (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted">
                Last dry-run checklist (agentGeneratedBundleQaChecklist_v1)
              </div>
              <pre className="mt-1 max-h-48 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug">
                {formatAgentGeneratedBundleQaChecklistReadout(dryRunQaChecklist).join('\n')}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {evidenceAcceptanceReadout !== null || dryRunAcceptanceReadout !== null ? (
        <div
          data-testid="agent-brief-acceptance-readout"
          className="rounded border border-border bg-background/40 p-2"
        >
          <div className="text-[10px] font-semibold text-muted">Brief acceptance gates</div>
          <p className="mt-1 text-[10px] text-muted">
            Deterministic closure readout (
            <code className="text-[9px]">agentBriefAcceptanceReadout_v1</code>) from
            evidence-package and bundle dry-run payloads. Line preview:
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <pre className="max-h-32 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[9px]">
              {formatAgentBriefAcceptanceReadoutLines(evidenceAcceptanceReadout).join('\n')}
            </pre>
            <pre className="max-h-32 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[9px]">
              {formatAgentBriefAcceptanceReadoutLines(dryRunAcceptanceReadout).join('\n')}
            </pre>
          </div>
          <AgentBriefAcceptanceReadoutV1Table
            title="Evidence-package readout (preferred for artifact expectations)"
            readout={evidenceAcceptanceReadout}
          />
          <AgentBriefAcceptanceReadoutV1Table
            title="Last bundle dry-run readout"
            readout={dryRunAcceptanceReadout}
          />
        </div>
      ) : null}

      {evidenceConsistencyClosure !== null || dryRunConsistencyClosure !== null ? (
        <div
          data-testid="agent-review-readout-consistency-closure"
          className="rounded border border-border bg-background/40 p-2"
        >
          <div className="text-[10px] font-semibold text-muted">
            Agent Review readout consistency closure (agentReviewReadoutConsistencyClosure_v1)
          </div>
          <p className="mt-1 text-[10px] text-muted">
            Cross-checks field presence, bundle id, and evidence digest drift across the five Agent
            Review readouts. Rows are <code className="text-[9px]">aligned</code>,{' '}
            <code className="text-[9px]">missing_fields</code>,{' '}
            <code className="text-[9px]">bundle_id_drift</code>, or{' '}
            <code className="text-[9px]">digest_drift</code>.
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium text-muted">Evidence-package snapshot</div>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug">
                {formatAgentReviewReadoutConsistencyClosureLines(evidenceConsistencyClosure).join(
                  '\n',
                )}
              </pre>
            </div>
            <div>
              <div className="text-[10px] font-medium text-muted">Last bundle dry-run</div>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug">
                {formatAgentReviewReadoutConsistencyClosureLines(dryRunConsistencyClosure).join(
                  '\n',
                )}
              </pre>
            </div>
          </div>
          {(evidenceConsistencyClosure?.advisoryFindings.length ?? 0) > 0 ? (
            <div className="mt-2 rounded border border-amber-500/35 bg-amber-500/5 p-2">
              <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-400">
                Consistency advisories ({evidenceConsistencyClosure!.advisoryFindings.length})
              </div>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
                {evidenceConsistencyClosure!.advisoryFindings.map((f, i) => (
                  <li key={i}>
                    <code className="font-mono text-[9px]">
                      [{f.severity}] {f.ruleId}
                    </code>{' '}
                    ({f.readoutId}){': '}
                    {f.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {dryRunTxt ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold text-muted">Bundle dry-run</div>
          <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px]">
            {dryRunTxt}
          </pre>
        </div>
      ) : null}

      {schemaTxt ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold text-muted">Schema</div>
          <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px]">
            {schemaTxt}
          </pre>
        </div>
      ) : null}

      {evidenceArtifactSummary.sheetRows.length ||
      evidenceArtifactSummary.view3dRows.length ||
      evidenceArtifactSummary.planViewRows.length ||
      evidenceArtifactSummary.sectionCutRows.length ||
      evidenceArtifactSummary.semanticDigestPrefix16 ||
      evidenceArtifactSummary.closureHints ||
      evidenceArtifactSummary.closureReview ||
      evidenceArtifactSummary.lifecycleSignal ||
      evidenceArtifactSummary.diffFixLoop?.needsFixLoop ||
      evidenceArtifactSummary.performanceGate ||
      evidenceArtifactSummary.baselineLifecycleReadout ||
      evidenceArtifactSummary.prdCloseoutCrossCorrelation ||
      evidenceArtifactSummary.evidenceFreshness ||
      evidenceArtifactSummary.reviewActions.length ? (
        <EvidenceArtifactCorrelationPanel
          evidenceArtifactSummary={evidenceArtifactSummary}
          pushStep={pushStep}
        />
      ) : null}

      {evidenceTxt ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold text-muted">Evidence payloads</div>
          <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px]">
            {evidenceTxt}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
