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
      return { assumptionLogFormat: 'assumptionLog_v0', assumptions: [], error: 'Invalid JSON array' };
    }
  }, [assumeLogTxt]);

  return (
    <div className="space-y-3 text-[11px]">
      <div>
        <div className="font-semibold text-muted">Guided workflow</div>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted">
          <li>
            Inspect schema + attach an <strong>assumption log</strong> (JSON array of strings).
          </li>
          <li>Paste a command bundle and run bundle dry-run (no commit).</li>
          <li>Fetch validation + evidence-package JSON and compare with Playwright screenshots in CI.</li>
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
        </div>
      </div>

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
            <code className="text-[10px]">bim-ai apply-bundle --dry-run &lt;bundle.json</code> — commit
            preview
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
                setEvidenceTxt(JSON.stringify({ assumptions: assumptionsJson, payload: body }, null, 2));
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
