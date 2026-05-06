import type { Element } from '@bim-ai/core';

import type { ScheduleFieldMeta } from './schedulePanelRegistryChrome';
import {
  missingRequiredFieldKeys,
  presetById,
  presetFieldReadoutRows,
  presetsForCategory,
  resolvePresetColumnsForExport,
  type SchedulePresetCategory,
} from './scheduleDefinitionPresets';
import { tabToPresetCategory, type TabKey } from './scheduleUtils';

type ServerScheduleData = {
  tab: TabKey;
  scheduleId: string;
  data: Record<string, unknown>;
};

export function ScheduleDefinitionPresetsStrip({
  tab,
  srvActive,
  modelId,
  elementsById,
  onScheduleFiltersCommit,
  presetIdByCategory,
  setPresetIdByCategory,
  sidForTab,
  setRegistryVisibleCols,
}: {
  tab: TabKey;
  srvActive: ServerScheduleData | null;
  modelId: string | undefined;
  elementsById: Record<string, Element>;
  onScheduleFiltersCommit?: (
    scheduleId: string,
    filters: Record<string, unknown>,
    grouping?: Record<string, unknown>,
  ) => void;
  presetIdByCategory: Partial<Record<SchedulePresetCategory, string>>;
  setPresetIdByCategory: React.Dispatch<
    React.SetStateAction<Partial<Record<SchedulePresetCategory, string>>>
  >;
  sidForTab: string | null | undefined;
  setRegistryVisibleCols: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}) {
  const cat = tabToPresetCategory(tab);
  if (!cat || !srvActive || srvActive.tab !== tab || !modelId) return null;

  const d = srvActive.data as Record<string, unknown>;
  const columns = Array.isArray(d.columns) ? (d.columns as string[]) : [];
  if (!columns.length) return null;

  const rawMeta = d.columnMetadata as { fields?: Record<string, ScheduleFieldMeta> } | undefined;
  const fieldMeta = rawMeta?.fields ?? {};

  const list = presetsForCategory(cat);
  if (!list.length) return null;

  const selectedId = presetIdByCategory[cat] ?? list[0]!.id;
  const preset = presetById(selectedId) ?? list[0]!;
  const missing = missingRequiredFieldKeys(preset, columns);
  const readout = presetFieldReadoutRows(preset, fieldMeta);

  function applyPresetToExport() {
    if (!onScheduleFiltersCommit || !sidForTab) return;
    const el = elementsById[sidForTab];
    if (el?.kind !== 'schedule') return;
    const keys = preset.fields.map((f) => f.fieldKey);
    const narrowed = resolvePresetColumnsForExport(keys, columns);
    if (!narrowed.length) return;
    const prevF = (el.filters ?? {}) as Record<string, unknown>;
    onScheduleFiltersCommit(sidForTab, { ...prevF, displayColumnKeys: narrowed });
    setRegistryVisibleCols((prev) => ({ ...prev, [sidForTab]: narrowed }));
  }

  return (
    <div
      data-testid="schedule-definition-presets"
      className="mt-2 rounded border border-border/50 bg-background/30 px-2 py-1.5 text-[10px] text-muted"
    >
      <div className="font-semibold text-foreground">Definition presets · export columns</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <label className="flex flex-wrap items-center gap-2">
          <span>Preset</span>
          <select
            className="max-w-[240px] rounded border border-border bg-background px-2 py-0.5 font-mono text-[10px]"
            value={selectedId}
            onChange={(e) =>
              setPresetIdByCategory((prev) => ({ ...prev, [cat]: e.target.value }))
            }
          >
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {onScheduleFiltersCommit ? (
          <button
            type="button"
            className="rounded border border-border/60 px-2 py-0.5 text-[10px] text-foreground hover:bg-accent/20"
            data-testid="schedule-preset-apply-export"
            onClick={applyPresetToExport}
          >
            Apply to export
          </button>
        ) : null}
      </div>
      {missing.length ? (
        <div className="mt-1 text-[10px] text-amber-500">
          Required fields missing from this table response: {missing.join(', ')}
        </div>
      ) : null}
      <div className="mt-2 max-h-40 overflow-y-auto font-mono leading-snug">
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-border/40 text-left text-muted">
              <th className="py-0.5 pr-2 font-normal">Field</th>
              <th className="py-0.5 pr-2 font-normal">Label</th>
              <th className="py-0.5 pr-2 font-normal">Role</th>
              <th className="py-0.5 pr-2 font-normal">Req</th>
              <th className="py-0.5 font-normal">CSV hint</th>
            </tr>
          </thead>
          <tbody>
            {readout.map((row) => (
              <tr key={row.fieldKey} className="border-b border-border/30 align-top">
                <td className="py-0.5 pr-2 text-foreground">{row.fieldKey}</td>
                <td className="py-0.5 pr-2">{row.label}</td>
                <td className="py-0.5 pr-2">
                  {row.roleReadout}
                  {row.unitHint ? <span className="text-muted"> · {row.unitHint}</span> : null}
                </td>
                <td className="py-0.5 pr-2">{row.token}</td>
                <td className="py-0.5 text-muted">{row.csvExportHint ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
