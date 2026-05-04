import type { PerspectiveId, Violation } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import { filterViolationsForPerspective } from './perspectiveFilter';

export function AdvisorPanel(props: {
  violations: Violation[];
  selectionId?: string;
  preset: string;
  onPreset: (preset: string) => void;
  codePresets?: string[];
  onApplyQuickFix(cmd: Record<string, unknown>): void;
  perspective: PerspectiveId;
}) {
  const scoped = props.selectionId
    ? props.violations.filter((v) => (v.elementIds ?? []).includes(props.selectionId!))
    : props.violations;

  const filtered = filterViolationsForPerspective(scoped, props.perspective);
  const presetKeys = props.codePresets ?? ['residential', 'commercial', 'office'];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-muted">Code preset</span>
        <select
          value={props.preset}
          onChange={(e) => props.onPreset(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1"
        >
          {presetKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        <span className="text-muted">Perspective</span>
        <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px]">
          {props.perspective}
        </span>
      </div>

      {filtered.length ? (
        <ul className="max-h-[40vh] space-y-2 overflow-auto text-xs">
          {filtered.map((v, i) => (
            <li key={`${v.ruleId}-${i}`} className="rounded border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] ${v.blocking ? 'bg-red-500/25' : 'bg-amber-500/15'}`}
                >
                  {v.severity}
                </span>
                <span className="font-mono text-[10px] text-muted">{v.ruleId}</span>

                {v.discipline ? (
                  <span className="rounded bg-muted/30 px-1 py-0.5 text-[9px] text-muted">
                    {v.discipline}
                  </span>
                ) : null}
              </div>

              <div className="mt-1">{v.message}</div>

              {v.quickFixCommand && typeof v.quickFixCommand === 'object' ? (
                <Btn
                  type="button"
                  className="mt-2 px-3 py-1 text-[11px]"
                  variant="quiet"
                  onClick={() =>
                    props.onApplyQuickFix(v.quickFixCommand as Record<string, unknown>)
                  }
                >
                  Apply suggested fix
                </Btn>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded border bg-surface p-4 text-[11px] text-muted">
          {props.selectionId
            ? 'No advisory items for selection.'
            : 'No advisory items — keep sketching!'}
        </div>
      )}
    </div>
  );
}
