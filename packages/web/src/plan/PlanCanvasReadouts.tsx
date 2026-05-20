import type { Element } from '@bim-ai/core';

import { fmtElev } from './planCanvasHelpers';

type LevelElement = Extract<Element, { kind: 'level' }>;

export function PlanScaleReadout({
  scaleBarMeters,
  plotScaleN,
}: {
  scaleBarMeters: number;
  plotScaleN: number;
}) {
  return (
    <div className="pointer-events-auto absolute left-3 bottom-3 z-10">
      <div
        data-testid="plan-scale-readout"
        title="Scale readout · scroll to zoom · Space+drag to pan"
        className="flex items-center gap-1.5 rounded border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur"
      >
        <span aria-hidden="true" className="flex flex-col items-center gap-0.5">
          <span className="flex h-[7px] w-[36px] items-end">
            <span className="h-[5px] w-[18px] border border-r-0 border-muted/60 bg-muted/20" />
            <span className="h-[5px] w-[18px] border border-muted/60 bg-surface/80" />
          </span>
          <span>{`${(scaleBarMeters * 100).toFixed(0)} cm`}</span>
        </span>
        <span className="ml-1 text-foreground/70">1:{plotScaleN}</span>
      </div>
    </div>
  );
}

export function PlanLevelDatum({ activeLevel }: { activeLevel?: LevelElement | null }) {
  if (!activeLevel) return null;
  return (
    <>
      <div
        data-testid="plan-level-datum-line"
        className="pointer-events-none absolute left-0 right-0 top-7 z-10"
        aria-hidden="true"
      >
        <div
          className="absolute left-2 right-10 top-0 border-t border-dashed"
          style={{ borderColor: 'rgba(37, 99, 235, 0.9)' }}
        />
        <div
          className="absolute right-3 -top-[7px] h-3.5 w-3.5 rounded-full border bg-surface"
          style={{ borderColor: 'rgba(37, 99, 235, 0.9)' }}
        />
      </div>
      <div
        data-testid="plan-level-elevation-badge"
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          backgroundColor: 'rgba(30, 58, 138, 0.85)',
          color: 'white',
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontFamily: 'monospace',
          pointerEvents: 'none',
          zIndex: 11,
          userSelect: 'none',
        }}
      >
        <span data-testid="plan-work-plane-badge">
          Work plane · {activeLevel.name} | {fmtElev(activeLevel.elevationMm ?? 0)}
        </span>
      </div>
    </>
  );
}

export function PlanNorthPoint() {
  return (
    <div className="pointer-events-none absolute left-3 bottom-14 z-10 opacity-55">
      <svg
        width="26"
        height="30"
        viewBox="0 0 26 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-foreground"
        aria-label="North"
      >
        <path d="M13 2 A11 11 0 0 1 24 13 L13 13 Z" fill="currentColor" />
        <circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="1" />
        <circle cx="13" cy="13" r="1.5" fill="currentColor" />
        <text
          x="13"
          y="29"
          textAnchor="middle"
          fontSize="8"
          fontWeight="600"
          fontFamily="Inter,system-ui,sans-serif"
          fill="currentColor"
        >
          N
        </text>
      </svg>
    </div>
  );
}

export function PlanCanvasReadouts({
  activeLevel,
  scaleBarMeters,
  plotScaleN,
}: {
  activeLevel?: LevelElement | null;
  scaleBarMeters: number;
  plotScaleN: number;
}) {
  return (
    <>
      <PlanScaleReadout scaleBarMeters={scaleBarMeters} plotScaleN={plotScaleN} />
      <PlanLevelDatum activeLevel={activeLevel} />
      <PlanNorthPoint />
    </>
  );
}
