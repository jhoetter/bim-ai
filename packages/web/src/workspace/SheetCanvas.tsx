import type { Element } from '@bim-ai/core';

import { resolveViewportTitleFromRef } from './sheetViewRef';

/** Paper-space preview: titleblock stripe + viewport frames from semantic `sheet` elements. */

export function SheetCanvas(props: {
  elementsById: Record<string, Element>;
  preferredSheetId?: string;
}) {
  const sheets = Object.values(props.elementsById).filter(
    (e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet',
  );

  const sh =
    sheets.find((s) => s.id === props.preferredSheetId) ??
    sheets.sort((a, b) => a.name.localeCompare(b.name))[0];

  if (!sh) {
    return <div className="text-[11px] text-muted">No sheet elements in this model.</div>;
  }

  const wMm = 42_000;
  const hMm = 29_700;
  const vps = (sh.viewportsMm ?? []) as Array<Record<string, unknown>>;

  return (
    <div
      data-testid="sheet-canvas"
      className="overflow-auto rounded border border-border bg-background p-2"
    >
      <svg
        viewBox={`0 0 ${wMm} ${hMm}`}
        className="h-auto max-h-[360px] w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={wMm} height={hMm} fill="#f8fafc" stroke="#1e293b" strokeWidth={120} />
        <rect x={800} y={800} width={wMm - 1600} height={3600} fill="#edf2ff" opacity={0.9} />

        <text x={2400} y={2400} className="fill-slate-800" style={{ fontSize: '1200px' }}>
          A1 metaphor — {sh.name}
        </text>

        <text x={2400} y={3600} className="fill-slate-500" style={{ fontSize: '800px' }}>
          TB {sh.titleBlock ?? '—'}
        </text>

        {vps.map((vpRaw) => {
          const vp = vpRaw as Record<string, unknown>;
          const xMm = Number(vp.xMm ?? vp.x_mm ?? 0);
          const yMm = Number(vp.yMm ?? vp.y_mm ?? 0);
          const widthMm = Number(vp.widthMm ?? vp.width_mm ?? 1000);
          const heightMm = Number(vp.heightMm ?? vp.height_mm ?? 1000);

          const viewRefRaw = vp.viewRef ?? vp.view_ref;
          const resolved = resolveViewportTitleFromRef(props.elementsById, viewRefRaw);
          const fallback = typeof vp.label === 'string' ? vp.label : 'Viewport';
          const primary = resolved ?? fallback;
          const sub = typeof viewRefRaw === 'string' && viewRefRaw ? viewRefRaw : '';

          return (
            <g key={String(vp.viewportId ?? vp.viewport_id ?? `${xMm}_${yMm}`)}>
              <rect
                x={xMm}
                y={yMm}
                width={widthMm}
                height={heightMm}
                fill="#ffffff"
                stroke="#475569"
                strokeWidth={80}
              />
              <text x={xMm + 200} y={yMm + 900} fill="#475569" style={{ fontSize: '600px' }}>
                {primary}
              </text>
              {sub ? (
                <text x={xMm + 200} y={yMm + 1400} fill="#64748b" style={{ fontSize: '350px' }}>
                  {sub}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="mt-1 font-mono text-[10px] text-muted">{sh.id}</div>
    </div>
  );
}
