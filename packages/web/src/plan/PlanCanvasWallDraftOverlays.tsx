import type { PlanTool } from '../state/store';
import type { PickedWallLine } from './wallPickLines';

type MmPoint = {
  xMm: number;
  yMm: number;
};

type ScreenPoint = {
  pxX: number;
  pxY: number;
};

type Props = {
  hudMm: MmPoint | null;
  worldToScreen: (point: MmPoint) => ScreenPoint;
  wallPickLineHint: PickedWallLine | null;
  planTool: PlanTool;
  wallDraftActive: boolean;
  wallLocationLine: string;
  wallDrawOffsetMm: number;
  wallDrawRadiusMm?: number | null;
  wallDrawHeightMm: number;
  activeWallTypeName: string;
  wallDraftNotice: string | null;
  snapLabel: string | null;
};

function WallPickLinePreview({
  wallPickLineHint,
  worldToScreen,
}: Pick<Props, 'wallPickLineHint' | 'worldToScreen'>) {
  if (!wallPickLineHint) return null;

  const start = worldToScreen(wallPickLineHint.start);
  const end = worldToScreen(wallPickLineHint.end);
  return (
    <svg
      data-testid="wall-pick-line-preview"
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden="true"
    >
      <line
        x1={start.pxX}
        y1={start.pxY}
        x2={end.pxX}
        y2={end.pxY}
        stroke="rgba(37, 99, 235, 0.95)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="8 5"
      />
      <circle cx={start.pxX} cy={start.pxY} r={5} fill="rgba(37, 99, 235, 0.95)" />
      <circle
        cx={end.pxX}
        cy={end.pxY}
        r={6}
        fill="white"
        stroke="rgba(37, 99, 235, 0.95)"
        strokeWidth={2}
      />
    </svg>
  );
}

function WallPlacementOverlay({
  hudMm,
  wallPickLineHint,
  planTool,
  wallDraftActive,
  wallLocationLine,
  wallDrawOffsetMm,
  wallDrawRadiusMm,
  wallDrawHeightMm,
  activeWallTypeName,
  wallDraftNotice,
}: Omit<Props, 'worldToScreen' | 'snapLabel'>) {
  if (planTool !== 'wall' || !hudMm) return null;

  return (
    <div className="pointer-events-none absolute left-3 bottom-14 z-10 max-w-[min(360px,calc(100%-24px))] rounded border border-border bg-surface/90 px-2 py-1.5 text-[10px] text-foreground shadow-elev-1 backdrop-blur">
      <div className="font-semibold">Wall placement</div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-muted">
        <span>
          {wallDraftActive
            ? 'Pick endpoint'
            : wallPickLineHint
              ? `Click to use ${wallPickLineHint.sourceLabel}`
              : 'Pick start point or existing boundary line'}
        </span>
        <span>line {wallLocationLine.replace(/-/g, ' ')}</span>
        <span>offset {wallDrawOffsetMm} mm</span>
        <span>radius {wallDrawRadiusMm ?? 0} mm</span>
        <span>height {wallDrawHeightMm} mm</span>
        <span>type {activeWallTypeName}</span>
      </div>
      <div className="mt-0.5 text-[9px] text-muted">Tab cycles location line · Esc cancels</div>
      {wallDraftNotice ? (
        <div
          data-testid="wall-draft-notice"
          className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 text-[9px] text-amber-200"
        >
          {wallDraftNotice}
        </div>
      ) : null}
    </div>
  );
}

export function PlanCanvasWallDraftOverlays({
  hudMm,
  worldToScreen,
  wallPickLineHint,
  planTool,
  wallDraftActive,
  wallLocationLine,
  wallDrawOffsetMm,
  wallDrawRadiusMm,
  wallDrawHeightMm,
  activeWallTypeName,
  wallDraftNotice,
  snapLabel,
}: Props) {
  return (
    <>
      <div className="pointer-events-none absolute right-3 bottom-14 z-10 rounded border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur">
        {hudMm
          ? `X ${(hudMm.xMm / 1000).toFixed(2)} m · Y ${(hudMm.yMm / 1000).toFixed(2)} m`
          : '—'}
      </div>
      <WallPickLinePreview wallPickLineHint={wallPickLineHint} worldToScreen={worldToScreen} />
      <WallPlacementOverlay
        hudMm={hudMm}
        wallPickLineHint={wallPickLineHint}
        planTool={planTool}
        wallDraftActive={wallDraftActive}
        wallLocationLine={wallLocationLine}
        wallDrawOffsetMm={wallDrawOffsetMm}
        wallDrawRadiusMm={wallDrawRadiusMm}
        wallDrawHeightMm={wallDrawHeightMm}
        activeWallTypeName={activeWallTypeName}
        wallDraftNotice={wallDraftNotice}
      />
      {snapLabel ? (
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded border border-border bg-surface/90 px-2 py-0.5 font-mono text-[10px] text-foreground backdrop-blur">
          {snapLabel}
        </div>
      ) : null}
    </>
  );
}
