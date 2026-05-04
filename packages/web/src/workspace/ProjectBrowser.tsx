import type { Element } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

import { useBimStore } from '../state/store';

/** Lightweight project-browser band: plan views grouped separately from mixed explorer. */

export function ProjectBrowser(props: { elementsById: Record<string, Element> }) {
  const activatePlanView = useBimStore((s) => s.activatePlanView);

  const planViews = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view')
    .sort((a, b) => a.name.localeCompare(b.name));

  const schedules = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule')
    .sort((a, b) => a.name.localeCompare(b.name));

  const sheets = Object.values(props.elementsById)
    .filter((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet')
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!planViews.length && !schedules.length && !sheets.length)
    return <div className="text-[10px] text-muted">No documented views yet.</div>;

  return (
    <div className="space-y-2 text-[11px]">
      <div className="font-semibold text-muted">Project browser</div>
      {planViews.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Plan views</div>
          <ul className="space-y-0.5">
            {planViews.map((pv) => (
              <li key={pv.id}>
                <Btn
                  type="button"
                  variant="quiet"
                  className="w-full px-2 py-0.5 text-left text-[10px]"
                  onClick={() => activatePlanView(pv.id)}
                >
                  plan_view · {pv.name}
                </Btn>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {schedules.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Schedules (refs)</div>
          <ul className="font-mono text-[10px] text-muted">
            {schedules.map((s) => (
              <li key={s.id}>
                · {s.name}{' '}
                <button
                  type="button"
                  className="underline"
                  title="Inspect in explorer"
                  onClick={() => useBimStore.getState().select(s.id)}
                >
                  [{s.id}]
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sheets.length ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">Sheets</div>
          <ul className="font-mono text-[10px] text-muted">
            {sheets.map((s) => (
              <li key={s.id}>
                sheet ·{' '}
                <button
                  type="button"
                  className="underline"
                  title="Inspect in explorer"
                  onClick={() => useBimStore.getState().select(s.id)}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
