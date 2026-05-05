import { useMemo } from 'react';

import type { Element } from '@bim-ai/core';

import {
  buildMaterialStackEvidenceToken,
  formatLayerFunctionRole,
  resolveMaterialLayerReadout,
  supportedMaterialLayerWorkbenchKinds,
} from './materialLayerCatalogWorkbench';

type Props = {
  selected: Element | undefined;
  elementsById: Record<string, Element>;
};

export function MaterialLayerStackWorkbench({ selected, elementsById }: Props) {
  const readout = useMemo(
    () => resolveMaterialLayerReadout(selected, elementsById),
    [selected, elementsById],
  );

  if (!selected || !supportedMaterialLayerWorkbenchKinds(selected.kind) || !readout) {
    return null;
  }

  const mismatch =
    readout.layerStackMatchesCutThickness === false
      ? 'Layer stack total does not match instance/cut thickness (see kernel material_assembly_resolve tolerance).'
      : null;

  const hostLabel =
    readout.hostKind != null
      ? `${readout.hostKind} · ${readout.hostElementId ?? ''}`
      : readout.typeElementKind != null
        ? `type · ${readout.typeElementKind}`
        : 'catalog';

  return (
    <div
      className="border-border mb-3 space-y-2 border-b pb-3 text-[11px]"
      data-testid="material-layer-catalog-workbench"
    >
      <div className="font-semibold text-muted">Material / layer stack</div>
      <div className="text-[10px] leading-snug text-muted">
        {hostLabel}
        {readout.assemblyTypeId ? (
          <>
            {' '}
            · assembly <span className="font-mono">{readout.assemblyTypeId}</span>
            {readout.assemblyTypeName ? ` (${readout.assemblyTypeName})` : ''}
          </>
        ) : null}
        {' · '}
        <span className="font-mono">src={readout.layerSource}</span>
        {readout.skipReason ? (
          <>
            {' '}
            ·{' '}
            <span className="text-amber-600 dark:text-amber-400">{readout.skipReason}</span>
          </>
        ) : null}
      </div>

      {readout.layers.length ? (
        <div className="max-h-48 overflow-auto rounded border border-border">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-border border-b bg-muted/40">
                <th className="p-1.5 font-medium">#</th>
                <th className="p-1.5 font-medium">Role</th>
                <th className="p-1.5 font-medium">Material</th>
                <th className="p-1.5 font-medium">Display</th>
                <th className="p-1.5 font-medium text-right">mm</th>
              </tr>
            </thead>
            <tbody>
              {readout.layers.map((row) => (
                <tr key={row.index} className="border-border border-b odd:bg-background even:bg-muted/15 last:border-b-0">
                  <td className="p-1.5 font-mono">{row.index}</td>
                  <td className="p-1.5">{formatLayerFunctionRole(row.function)}</td>
                  <td className="max-w-[8rem] truncate font-mono" title={row.materialKey || '—'}>
                    {row.materialKey || '—'}
                  </td>
                  <td className="max-w-[10rem] truncate" title={row.materialDisplay || '—'}>
                    {row.materialDisplay || '—'}
                  </td>
                  <td className="p-1.5 text-right font-mono">{row.thicknessMm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border border-dashed border-border p-2 text-[10px] text-muted">
          No resolved layers for this selection.
        </div>
      )}

      <div className="space-y-0.5 text-[10px] text-muted">
        <div>
          Stack total:{' '}
          <span className="font-mono text-foreground">{readout.layerTotalThicknessMm}</span> mm
        </div>
        {readout.cutProxyThicknessMm != null ? (
          <div>
            Instance / cut thickness:{' '}
            <span className="font-mono text-foreground">{readout.cutProxyThicknessMm}</span> mm
          </div>
        ) : (
          <div>Instance / cut thickness: — (not applicable for roof stack readout)</div>
        )}
        {readout.layerStackMatchesCutThickness != null ? (
          <div
            className={
              readout.layerStackMatchesCutThickness ? 'text-muted' : 'text-destructive font-medium'
            }
          >
            Stack vs cut: {readout.layerStackMatchesCutThickness ? 'aligned' : 'mismatch'}
          </div>
        ) : null}
        {mismatch ? <div className="text-destructive">{mismatch}</div> : null}
      </div>

      <div
        className="break-all rounded bg-muted/30 p-1.5 font-mono text-[10px] text-foreground"
        data-testid="material-layer-stack-evidence"
        title="Deterministic summary for agents / evidence"
      >
        {buildMaterialStackEvidenceToken(readout)}
      </div>
    </div>
  );
}
