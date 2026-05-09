import { VirtualScrollRows } from './VirtualScrollRows';
import { formatScheduleCell, SCHED_TABLE_ROW_PX, SCHED_TABLE_VIEWPORT_PX } from './scheduleUtils';
import {
  SCHEDULE_TABLE_EMPTY_V1,
  type ScheduleTableBodyRowV1,
  type ScheduleTableModelV1,
} from './scheduleTableRenderer';

export function ScheduleRegistryTable({ model }: { model: ScheduleTableModelV1 }) {
  const cols = model.columns.map((c) => c.key);
  const colSpan = Math.max(cols.length, 1);

  const colGroup = (
    <colgroup>
      {model.columns.map((c) => (
        <col key={c.key} style={{ width: `${c.displayWidthHintPx}px` }} />
      ))}
    </colgroup>
  );

  const headerRow = (
    <tr>
      {model.columns.map((c) => (
        <th scope="col" key={c.key} className="align-bottom px-1 text-left text-[10px] font-normal">
          <div>{c.headerLabel}</div>
          {c.unitLabel || c.roleLabel ? (
            <div className="text-[9px] font-normal text-muted opacity-90">
              {[c.unitLabel, c.roleLabel].filter(Boolean).join(' · ')}
            </div>
          ) : null}
        </th>
      ))}
    </tr>
  );

  const maxVisualRows = Math.max(model.bodyRows.length, 1);

  return (
    <div data-testid="schedule-registry-table">
      <div
        data-testid="schedule-table-title"
        className="mb-1 text-[11px] font-semibold leading-snug text-foreground"
      >
        {model.title}
      </div>

      {!model.bodyRows.length ? (
        <div
          data-testid="schedule-table-empty"
          className="rounded border border-border/40 px-2 py-1 font-mono text-[10px] text-muted"
          title={model.emptyToken ?? SCHEDULE_TABLE_EMPTY_V1}
        >
          {model.emptyToken ?? SCHEDULE_TABLE_EMPTY_V1}
        </div>
      ) : (
        <VirtualScrollRows<ScheduleTableBodyRowV1>
          maxHeightPx={Math.min(SCHED_TABLE_VIEWPORT_PX, SCHED_TABLE_ROW_PX * maxVisualRows)}
          rowHeightPx={SCHED_TABLE_ROW_PX}
          colSpan={colSpan}
          colGroup={colGroup}
          rows={model.bodyRows}
          header={headerRow}
          renderRow={(row) => {
            switch (row.kind) {
              case 'groupHeader': {
                return (
                  <tr className="border-t border-border/60 bg-accent/15">
                    <td
                      colSpan={colSpan}
                      className="px-2 py-0.5 text-[10px] font-semibold text-muted"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              case 'data': {
                return (
                  <tr className="border-t border-border/60">
                    {cols.map((cKey) => (
                      <td
                        key={cKey}
                        className="max-w-[140px] truncate px-1 text-[10px]"
                        title={String(row.record[cKey] ?? '')}
                      >
                        {formatScheduleCell(row.record[cKey])}
                      </td>
                    ))}
                  </tr>
                );
              }

              default: {
                const exhaustive: never = row;
                return exhaustive;
              }
            }
          }}
        />
      )}
    </div>
  );
}
