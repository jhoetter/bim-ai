import type { Element } from '@bim-ai/core';

import { Panel } from '@bim-ai/ui';

import { useBimStore } from '../state/store';

function segmentLengthMm(a: { xMm: number; yMm: number }, b: { xMm: number; yMm: number }): number {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  return Math.round(Math.hypot(dx, dy));
}

/** Lists modeled section cuts; live section graphics stay on the roadmap. */
export function SectionPlaceholderPane(props: { activeLevelLabel: string }) {
  const elementsById = useBimStore((s) => s.elementsById);

  const cuts = Object.values(elementsById)
    .filter((e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Panel title={`Sections (${props.activeLevelLabel})`}>
      <p className="text-[11px] leading-snug text-muted">
        Section cuts authored in the model (Revit-like sheet/view refs can target these ids). Raster
        / live 3D section graphics are still a preview placeholder.
      </p>

      {cuts.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted">
          No <code className="text-[10px]">section_cut</code> elements in this snapshot.
        </p>
      ) : (
        <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[11px]">
          {cuts.map((sc) => {
            const crop = typeof sc.cropDepthMm === 'number' ? sc.cropDepthMm : undefined;
            const run = segmentLengthMm(sc.lineStartMm, sc.lineEndMm);
            return (
              <li key={sc.id} className="rounded border border-border px-2 py-1">
                <div className="font-medium">{sc.name}</div>
                <div className="text-muted">
                  id <code className="text-[10px]">{sc.id}</code> · cut line ≈{' '}
                  {run.toLocaleString()} mm
                  {crop != null ? ` · crop depth ${crop.toLocaleString()} mm` : ''}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
