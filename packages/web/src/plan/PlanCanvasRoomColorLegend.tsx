type RoomColorLegendRow = {
  label: string;
  schemeColorHex: string;
  programmeCode?: string;
  department?: string;
  functionLabel?: string;
};

type Props = {
  planPresentation: string;
  rows: RoomColorLegendRow[];
};

export function PlanCanvasRoomColorLegend({ planPresentation, rows }: Props) {
  return (
    <div className="pointer-events-none absolute right-3 top-14 z-10 max-w-[min(260px,calc(100%-24px))] rounded border border-border bg-surface/90 px-2 py-2 text-[10px] text-muted backdrop-blur">
      {planPresentation === 'room_scheme' && rows.length ? (
        <div data-testid="plan-room-color-legend">
          <div className="mb-1 font-semibold text-foreground">Room colour legend</div>
          <ul className="space-y-1">
            {rows.map((row) => {
              const subtitle = [row.programmeCode, row.department, row.functionLabel]
                .filter((x): x is string => Boolean(x && x.trim()))
                .filter((x, i, a) => a.indexOf(x) === i)
                .filter((x) => x !== row.label)
                .join(' · ');
              return (
                <li key={`${row.label}-${row.schemeColorHex}`} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 inline-block size-3 shrink-0 rounded-sm border border-border"
                    style={{ backgroundColor: row.schemeColorHex }}
                    title={row.programmeCode ?? row.label}
                  />
                  <span className="leading-tight">
                    <span className="text-foreground">{row.label}</span>
                    {subtitle ? (
                      <span className="mt-0.5 block text-[9px] text-muted">{subtitle}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
