import { columnFieldRoleHint, type ScheduleFieldMeta } from './schedulePanelRegistryChrome';

type RegistrySchedule = {
  columns: string[];
  fieldLabels: Record<string, string>;
  fieldMeta: Record<string, ScheduleFieldMeta>;
  rows: Record<string, unknown>[];
};

export function RegistryColumnPicker({
  registryPickKey,
  registrySchedule,
  visibleRegistryColumns,
  onToggleColumn,
}: {
  registryPickKey: string | null;
  registrySchedule: RegistrySchedule | null;
  visibleRegistryColumns: string[];
  onToggleColumn: (col: string) => void;
}) {
  if (!registryPickKey || !registrySchedule || registrySchedule.columns.length < 2) return null;

  return (
    <div
      data-testid="schedule-column-picker"
      className="mb-2 flex flex-wrap gap-2 border-b border-border/40 pb-2 text-[10px] text-muted"
    >
      <span className="font-semibold text-foreground">Columns</span>
      {registrySchedule.columns.map((c) => {
        const on = visibleRegistryColumns.includes(c);
        return (
          <label key={c} className="flex cursor-pointer items-center gap-1">
            <input type="checkbox" checked={on} onChange={() => onToggleColumn(c)} />
            <span>
              {registrySchedule.fieldLabels[c] ?? c}
              <span className="text-muted opacity-80">
                {columnFieldRoleHint(registrySchedule.fieldMeta[c])}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
