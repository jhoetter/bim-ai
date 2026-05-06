import type { TabKey } from './scheduleUtils';
import {
  columnMetadataCategoryLine,
  formatSchedulePaginationPlacementReadout,
  formatSchedulePlacementReadout,
  scheduleRegistryEngineReadoutParts,
} from './schedulePanelRegistryChrome';
import {
  formatScheduleSheetExportParityRowLine,
  parseScheduleSheetExportParityRows,
} from './scheduleSheetExportParityReadout';

type ServerScheduleData = {
  tab: TabKey;
  scheduleId: string;
  data: Record<string, unknown>;
};

export function ScheduleRegistryChrome({ srvActive }: { srvActive: ServerScheduleData | null }) {
  if (!srvActive) return null;

  const data = srvActive.data;
  const placementLine = formatSchedulePlacementReadout(data.schedulePlacement);
  const pagLine = formatSchedulePaginationPlacementReadout(
    data.schedulePaginationPlacementEvidence_v0,
  );
  const regLine = columnMetadataCategoryLine(data);
  const engParts = scheduleRegistryEngineReadoutParts(data);
  const parityRows = parseScheduleSheetExportParityRows(data.scheduleSheetExportParityEvidence_v1);

  if (!placementLine && !regLine && engParts.length === 0 && !pagLine && parityRows.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="schedule-registry-chrome"
      className="mt-2 space-y-1 rounded border border-border/50 bg-background/40 px-2 py-1.5 text-[10px] text-muted"
    >
      {regLine ? <div className="text-foreground/90">{regLine}</div> : null}
      {placementLine ? <div className="text-foreground/90">{placementLine}</div> : null}
      {pagLine ? (
        <div
          className="font-mono text-[10px] leading-snug text-foreground/90"
          data-testid="schedule-pagination-placement-readout"
        >
          {pagLine}
        </div>
      ) : null}
      {parityRows.length ? (
        <div
          data-testid="schedule-sheet-export-parity-readout"
          className="font-mono text-[10px] leading-snug text-foreground/90"
        >
          {parityRows.map((row) => (
            <div
              key={`${row.scheduleId}/${row.viewportId ?? ''}`}
              data-parity-token={row.crossFormatParityToken}
              data-schedule-id={row.scheduleId}
            >
              {formatScheduleSheetExportParityRowLine(row)}
            </div>
          ))}
        </div>
      ) : null}
      {engParts.length ? (
        <div className="font-mono text-[10px] leading-snug">{engParts.join(' · ')}</div>
      ) : null}
    </div>
  );
}
