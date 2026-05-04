import { useState } from 'react';

import { Btn } from '@bim-ai/ui';

import { useBimStore } from '../state/store';

/** Ergonomics for agent-style review: CLI evidence steps + API smoke + stated assumptions. */
export function AgentReviewPane() {
  const [schemaTxt, setSchemaTxt] = useState<string | null>(null);
  const [evidenceTxt, setEvidenceTxt] = useState<string | null>(null);

  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);

  return (
    <div className="space-y-3 text-[11px]">
      <div>
        <div className="font-semibold text-muted">Model context</div>
        <p className="mt-1 text-muted">
          Active model <code className="text-[10px]">{modelId ?? '—'}</code> · revision r{revision}
        </p>
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
            (agent artifact)
          </li>
          <li>
            <code className="text-[10px]">bim-ai summary</code> /{' '}
            <code className="text-[10px]">bim-ai validate</code> — drills
          </li>
          <li>
            <code className="text-[10px]">bim-ai apply-bundle --dry-run &lt;bundle.json</code> —
            non-destructive commit preview
          </li>
        </ol>
      </div>

      <div className="rounded border border-border bg-background/40 p-2">
        <div className="font-semibold text-muted">Assumptions (golden starter)</div>
        <ul className="mt-1 list-disc space-y-1 ps-4 text-muted">
          <li>
            The shipped <code className="text-[10px]">plan-house</code> bundle targets an{' '}
            <strong>empty</strong> model — do not stack repeats without a reset.
          </li>
          <li>
            Coordinates are millimetres; discipline defaults follow the residential bootstrap
            preset.
          </li>
          <li>
            Sheets / view templates / schedules are authoring scaffolds — export to IFC is not
            implied.
          </li>
        </ul>
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
          Fetch browser evidence bundle
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
                setEvidenceTxt(JSON.stringify(body, null, 2));
              } catch (e) {
                setEvidenceTxt(e instanceof Error ? e.message : String(e));
              }
            })()
          }
        >
          Fetch evidence-package JSON
        </Btn>
      </div>

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
          <div className="mb-1 text-[10px] font-semibold text-muted">
            Evidence (snapshot + validate or evidence-package)
          </div>
          <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px]">
            {evidenceTxt}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
