import { useMemo, useState } from 'react';

import { Btn } from '@bim-ai/ui';

import { useBimStore } from '../state/store';

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

  type EvidenceArtifactSummary = {
    semanticDigestPrefix16: string | null;
    semanticDigestSha256Tail: string | null;
    modelRevision: number | null;
    sheetRows: {
      sheetId: string;
      sheetName?: string;
      pngViewport?: string;
      pngFullSheet?: string;
      bundleJson?: string;
    }[];
    suggestedBasenameHint: string | null;
    mismatchNotes: string[];
  };

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

  type RoomCand = {
    candidateId?: string;
    approxAreaM2?: number;
    levelName?: string;
    perimeterApproxM?: number;
    warnings?: { code?: string; message?: string; severity?: string }[];
    comparisonToAuthoredRooms?: {
      roomId?: string;
      roomName?: string;
      iouApprox?: number;
    }[];
    classificationHints?: { schemeColorHint?: string };
    suggestedBundleCommands?: unknown[];
  };

  const elementsById = useBimStore((s) => s.elementsById);

  const authoredRoomStats = useMemo(() => {
    const rooms = Object.values(elementsById).filter((e) => e.kind === 'room');

    return { count: rooms.length };
  }, [elementsById]);

  const evidenceArtifactSummary = useMemo((): EvidenceArtifactSummary => {
    if (!evidenceTxt)
      return {
        semanticDigestPrefix16: null,
        semanticDigestSha256Tail: null,
        modelRevision: null,
        sheetRows: [],
        suggestedBasenameHint: null,
        mismatchNotes: [],
      };
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const payload =
        root && typeof root.payload === 'object' && root.payload !== null
          ? (root.payload as Record<string, unknown>)
          : root;

      const prefix =
        typeof payload.semanticDigestPrefix16 === 'string' ? payload.semanticDigestPrefix16 : null;

      const dig =
        typeof payload.semanticDigestSha256 === 'string' ? payload.semanticDigestSha256 : null;
      const shaTail = dig && dig.length >= 12 ? dig.slice(-12) : dig;

      const revRaw = payload.modelRevision ?? payload.revision;
      const modelRevision =
        typeof revRaw === 'number' && Number.isFinite(revRaw)
          ? revRaw
          : typeof revRaw === 'string'
            ? Number(revRaw)
            : null;

      const basename =
        typeof payload.suggestedEvidenceArtifactBasename === 'string'
          ? payload.suggestedEvidenceArtifactBasename
          : null;

      const dse = payload.deterministicSheetEvidence;
      const rowsRaw = Array.isArray(dse) ? dse : [];
      const sheetRows = rowsRaw.map((row) => {
        const r = row as Record<string, unknown>;
        const pwRaw = r.playwrightSuggestedFilenames;
        const pw = pwRaw && typeof pwRaw === 'object' ? (pwRaw as Record<string, unknown>) : {};
        const corrRaw = r.correlation;
        const corr =
          corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
        return {
          sheetId: String(r.sheetId ?? r.sheet_id ?? ''),
          sheetName:
            typeof r.sheetName === 'string'
              ? r.sheetName
              : typeof r.sheet_name === 'string'
                ? r.sheet_name
                : undefined,
          pngViewport: typeof pw.pngViewport === 'string' ? pw.pngViewport : undefined,
          pngFullSheet: typeof pw.pngFullSheet === 'string' ? pw.pngFullSheet : undefined,
          bundleJson:
            typeof corr.suggestedEvidenceBundleEvidencePackageJson === 'string'
              ? corr.suggestedEvidenceBundleEvidencePackageJson
              : typeof corr.suggested_evidence_bundle_evidence_package_json === 'string'
                ? corr.suggested_evidence_bundle_evidence_package_json
                : undefined,
        };
      });

      const mismatchNotes: string[] = [];
      for (let i = 0; i < rowsRaw.length; i++) {
        const sr = sheetRows[i];
        if (!sr?.sheetId) continue;
        const cRaw = rowsRaw[i] as Record<string, unknown>;
        const corrRaw = cRaw?.correlation;
        const corr =
          corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
        const rowPrefix =
          typeof corr.semanticDigestPrefix16 === 'string' ? corr.semanticDigestPrefix16 : null;
        if (prefix && rowPrefix && rowPrefix !== prefix) {
          mismatchNotes.push(
            `Sheet ${sr.sheetId}: correlation semanticDigestPrefix16 (${rowPrefix}) ≠ package (${prefix}).`,
          );
        }
      }

      const liveRev = typeof revision === 'number' ? revision : null;
      if (modelRevision !== null && liveRev !== null && modelRevision !== liveRev) {
        mismatchNotes.push(
          `Evidence package modelRevision (${modelRevision}) ≠ loaded store revision (${liveRev}) — regenerate or re-fetch.`,
        );
      }

      return {
        semanticDigestPrefix16: prefix,
        semanticDigestSha256Tail: shaTail,
        modelRevision:
          modelRevision !== null && Number.isFinite(modelRevision) ? modelRevision : null,
        sheetRows,
        suggestedBasenameHint: basename,
        mismatchNotes,
      };
    } catch {
      return {
        semanticDigestPrefix16: null,
        semanticDigestSha256Tail: null,
        modelRevision: null,
        sheetRows: [],
        suggestedBasenameHint: null,
        mismatchNotes: ['Could not parse evidence JSON for artifact summary.'],
      };
    }
  }, [evidenceTxt, revision]);

  const roomCandPreview = useMemo(() => {
    if (!roomCandTxt) return null;

    try {
      const parsed = JSON.parse(roomCandTxt) as { candidates?: RoomCand[] };

      const cands = Array.isArray(parsed.candidates) ? parsed.candidates : [];

      return cands.map((c) => {
        const topMatch = Array.isArray(c.comparisonToAuthoredRooms)
          ? c.comparisonToAuthoredRooms[0]
          : undefined;

        return {
          id: String(c.candidateId ?? '—'),

          area: typeof c.approxAreaM2 === 'number' ? c.approxAreaM2 : null,

          level: typeof c.levelName === 'string' ? c.levelName : '',

          perimeter: typeof c.perimeterApproxM === 'number' ? c.perimeterApproxM : null,

          warnCount: Array.isArray(c.warnings) ? c.warnings.length : 0,

          hint:
            typeof c.classificationHints?.schemeColorHint === 'string'
              ? c.classificationHints.schemeColorHint
              : '',
          bestRoomId: typeof topMatch?.roomId === 'string' ? topMatch.roomId : '',
          bestIou:
            typeof topMatch?.iouApprox === 'number'
              ? topMatch.iouApprox
              : topMatch?.iouApprox != null
                ? Number(topMatch.iouApprox)
                : null,
        };
      });
    } catch {
      return null;
    }
  }, [roomCandTxt]);

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
          <li>Use advisor quick-fixes before applying bundles to production models.</li>
        </ol>
      </div>

      <div>
        <div className="font-semibold text-muted">Model context</div>
        <p className="mt-1 text-muted">
          Active model <code className="text-[10px]">{modelId ?? '—'}</code> · revision r{revision}
        </p>
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
      evidenceArtifactSummary.semanticDigestPrefix16 ? (
        <div className="rounded border border-border bg-background/40 p-2">
          <div className="text-[10px] font-semibold text-muted">Evidence artifact correlation</div>
          <ul className="mt-1 list-disc space-y-1 ps-4 text-[10px] text-muted">
            {evidenceArtifactSummary.semanticDigestPrefix16 ? (
              <li>
                semanticDigestPrefix16:{' '}
                <code className="text-[10px]">
                  {evidenceArtifactSummary.semanticDigestPrefix16}
                </code>
              </li>
            ) : null}
            {evidenceArtifactSummary.semanticDigestSha256Tail ? (
              <li>
                semanticDigest tail:{' '}
                <code className="text-[10px]">
                  {evidenceArtifactSummary.semanticDigestSha256Tail}
                </code>
              </li>
            ) : null}
            {evidenceArtifactSummary.suggestedBasenameHint ? (
              <li>
                suggested basename:{' '}
                <code className="text-[10px]">{evidenceArtifactSummary.suggestedBasenameHint}</code>
              </li>
            ) : null}
            {evidenceArtifactSummary.modelRevision !== null ? (
              <li>package modelRevision: {evidenceArtifactSummary.modelRevision}</li>
            ) : null}
          </ul>
          {evidenceArtifactSummary.sheetRows.length ? (
            <div className="mt-2 overflow-auto">
              <table className="w-full border-collapse border border-border text-[10px]">
                <thead>
                  <tr className="bg-surface/50">
                    <th className="border border-border px-1 py-1 text-left">Sheet</th>
                    <th className="border border-border px-1 py-1 text-left">PNG viewport</th>
                    <th className="border border-border px-1 py-1 text-left">PNG full bleed</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceArtifactSummary.sheetRows.map((sr) => (
                    <tr key={sr.sheetId}>
                      <td className="border border-border px-1 py-1 align-top">
                        <div className="font-mono">{sr.sheetId}</div>
                        {sr.sheetName ? <div className="text-muted">{sr.sheetName}</div> : null}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {sr.pngViewport ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {sr.pngFullSheet ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {evidenceArtifactSummary.mismatchNotes.length ? (
            <ul className="mt-2 list-disc space-y-1 ps-4 text-[10px] text-amber-500">
              {evidenceArtifactSummary.mismatchNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
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
