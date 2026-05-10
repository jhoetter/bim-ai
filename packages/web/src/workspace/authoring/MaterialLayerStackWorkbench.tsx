import { useEffect, useMemo, useState } from 'react';

import type { Element } from '@bim-ai/core';
import { Icons, ICON_SIZE } from '@bim-ai/ui';

import {
  ALLOWED_WALL_LAYER_FUNCTIONS,
  buildMaterialStackEvidenceToken,
  buildUpsertLayeredTypeCommand,
  formatLayerFunctionRole,
  materialRowsToDraft,
  resolveMaterialDisplayLabel,
  resolveMaterialLayerReadout,
  supportedMaterialLayerWorkbenchKinds,
  validateLayerAuthoringDraft,
  type LayerAuthoringDraftRow,
} from './materialLayerCatalogWorkbench';

function isLayeredTypeElement(
  el: Element | undefined,
): el is Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }> {
  return el?.kind === 'wall_type' || el?.kind === 'floor_type' || el?.kind === 'roof_type';
}

type Props = {
  selected: Element | undefined;
  elementsById: Record<string, Element>;
  revision: number;
  onUpsertSemantic: (cmd: Record<string, unknown>) => void;
};

export function MaterialLayerStackWorkbench({
  selected,
  elementsById,
  revision,
  onUpsertSemantic,
}: Props) {
  const readout = useMemo(
    () => resolveMaterialLayerReadout(selected, elementsById),
    [selected, elementsById],
  );

  const [draftRows, setDraftRows] = useState<LayerAuthoringDraftRow[]>([]);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected || !isLayeredTypeElement(selected)) {
      setDraftRows([]);
      setApplyError(null);
      return;
    }
    const r = resolveMaterialLayerReadout(selected, elementsById);
    if (r?.mode === 'type_element') {
      setDraftRows(materialRowsToDraft(r.layers));
    } else {
      setDraftRows([]);
    }
    setApplyError(null);
  }, [selected, elementsById, revision]);

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

  const typeAuthoring = readout.mode === 'type_element' && isLayeredTypeElement(selected);

  const updateDraft = (index: number, patch: Partial<LayerAuthoringDraftRow>) => {
    setDraftRows((prev) => prev.map((row) => (row.index === index ? { ...row, ...patch } : row)));
  };

  const moveDraftLayer = (index: number, direction: -1 | 1) => {
    setDraftRows((prev) => {
      const from = prev.findIndex((row) => row.index === index);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const moving = next[from]!;
      next[from] = next[to]!;
      next[to] = moving;
      return next.map((row, nextIndex) => ({ ...row, index: nextIndex }));
    });
  };

  const handleApply = () => {
    setApplyError(null);
    if (!typeAuthoring || !isLayeredTypeElement(selected)) return;
    const errs = validateLayerAuthoringDraft(draftRows);
    if (errs.length) {
      setApplyError(errs.join(' '));
      return;
    }
    const cmd = buildUpsertLayeredTypeCommand(selected, draftRows);
    onUpsertSemantic(cmd);
  };

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
            · <span className="text-amber-600 dark:text-amber-400">{readout.skipReason}</span>
          </>
        ) : null}
      </div>

      {readout.mode === 'host' ? (
        <div className="rounded border border-dashed border-border bg-muted/10 p-2 text-[10px] text-muted">
          Layer stack is read-only for wall / floor / roof instances. Select the{' '}
          <span className="font-medium text-foreground">wall_type</span>,{' '}
          <span className="font-medium text-foreground">floor_type</span>, or{' '}
          <span className="font-medium text-foreground">roof_type</span> to edit catalog layers.
        </div>
      ) : null}

      {typeAuthoring && draftRows.length ? (
        <div className="max-h-48 overflow-auto rounded border border-border">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-border border-b bg-muted/40">
                <th scope="col" className="p-1.5 font-medium">
                  #
                </th>
                <th scope="col" className="p-1.5 font-medium">
                  Role
                </th>
                <th scope="col" className="p-1.5 font-medium">
                  Material
                </th>
                <th scope="col" className="p-1.5 font-medium">
                  Display
                </th>
                <th scope="col" className="p-1.5 font-medium text-right">
                  mm
                </th>
                <th scope="col" className="p-1.5 font-medium">
                  Wrap Ends
                </th>
                <th scope="col" className="p-1.5 font-medium">
                  Wrap Inserts
                </th>
                <th scope="col" className="p-1.5 font-medium" />
                <th scope="col" className="p-1.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row, rowPosition) => (
                <tr
                  key={row.index}
                  className="border-border border-b odd:bg-background even:bg-muted/15 last:border-b-0"
                >
                  <td className="p-1.5 font-mono">{row.index}</td>
                  <td className="p-1.5">
                    <select
                      aria-label={`Role for layer ${row.index}`}
                      className="max-w-[6.5rem] rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                      value={row.function}
                      onChange={(e) =>
                        updateDraft(row.index, {
                          function: e.target.value as LayerAuthoringDraftRow['function'],
                        })
                      }
                    >
                      {ALLOWED_WALL_LAYER_FUNCTIONS.map((fn) => (
                        <option key={fn} value={fn}>
                          {formatLayerFunctionRole(fn)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      aria-label={`Material key for layer ${row.index}`}
                      className="w-full min-w-[5rem] rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]"
                      value={row.materialKey}
                      onChange={(e) => updateDraft(row.index, { materialKey: e.target.value })}
                      spellCheck={false}
                    />
                  </td>
                  <td
                    className="max-w-[10rem] truncate text-muted"
                    title={resolveMaterialDisplayLabel(row.materialKey) || undefined}
                  >
                    {resolveMaterialDisplayLabel(row.materialKey) || '—'}
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      aria-label={`Thickness (mm) for layer ${row.index}`}
                      min={0.001}
                      step={0.1}
                      className="w-16 rounded border border-border bg-background px-1 py-0.5 text-right font-mono text-[10px]"
                      value={row.thicknessMm}
                      onChange={(e) =>
                        updateDraft(row.index, { thicknessMm: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Wrap layer ${row.index} at wall ends`}
                      checked={row.wrapsAtEnds}
                      onChange={(e) => updateDraft(row.index, { wrapsAtEnds: e.target.checked })}
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Wrap layer ${row.index} at inserts`}
                      checked={row.wrapsAtInserts}
                      onChange={(e) => updateDraft(row.index, { wrapsAtInserts: e.target.checked })}
                    />
                  </td>
                  <td className="p-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move layer ${row.index} up`}
                        title="Move layer up"
                        disabled={rowPosition === 0}
                        data-testid={`material-layer-move-up-${row.index}`}
                        className="rounded border border-border px-1 text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => moveDraftLayer(row.index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move layer ${row.index} down`}
                        title="Move layer down"
                        disabled={rowPosition === draftRows.length - 1}
                        data-testid={`material-layer-move-down-${row.index}`}
                        className="rounded border border-border px-1 text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => moveDraftLayer(row.index, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="p-1">
                    <button
                      type="button"
                      aria-label="Remove layer"
                      title="Remove layer"
                      className="text-muted hover:text-danger"
                      onClick={() =>
                        setDraftRows((prev) =>
                          prev
                            .filter((r) => r.index !== row.index)
                            .map((r, i) => ({ ...r, index: i })),
                        )
                      }
                    >
                      <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : readout.layers.length ? (
        <div className="max-h-48 overflow-auto rounded border border-border">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-border border-b bg-muted/40">
                <th scope="col" className="p-1.5 font-medium">
                  #
                </th>
                <th scope="col" className="p-1.5 font-medium">
                  Role
                </th>
                <th scope="col" className="p-1.5 font-medium">
                  Material
                </th>
                <th scope="col" className="p-1.5 font-medium">
                  Display
                </th>
                <th scope="col" className="p-1.5 font-medium text-right">
                  mm
                </th>
              </tr>
            </thead>
            <tbody>
              {readout.layers.map((row) => (
                <tr
                  key={row.index}
                  className="border-border border-b odd:bg-background even:bg-muted/15 last:border-b-0"
                >
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

      {typeAuthoring ? (
        <div className="space-y-1">
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-foreground"
            onClick={() =>
              setDraftRows((prev) => [
                ...prev,
                {
                  index: prev.length,
                  thicknessMm: 100,
                  function: 'finish',
                  materialKey: '',
                  wrapsAtEnds: false,
                  wrapsAtInserts: false,
                },
              ])
            }
          >
            + Add layer
          </button>
          <button
            type="button"
            className="rounded bg-accent px-2 py-1 text-[10px] font-medium text-accent-foreground hover:opacity-90"
            onClick={handleApply}
            data-testid="material-layer-apply"
          >
            Apply type stack
          </button>
          {applyError ? (
            <div role="alert" className="text-[10px] text-danger">
              {applyError}
            </div>
          ) : null}
        </div>
      ) : null}

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
              readout.layerStackMatchesCutThickness ? 'text-muted' : 'text-danger font-medium'
            }
          >
            Stack vs cut: {readout.layerStackMatchesCutThickness ? 'aligned' : 'mismatch'}
          </div>
        ) : null}
        {mismatch ? <div className="text-danger">{mismatch}</div> : null}
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
