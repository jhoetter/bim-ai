import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type SiteTerrainElement = Extract<
  Element,
  { kind: 'toposolid' | 'graded_region' | 'toposolid_excavation' | 'toposolid_pad' }
>;

type PropertyChangeHandler = (property: string, value: unknown) => void;
type CommandDispatcher = (cmd: Record<string, unknown>) => void;

function polygonAreaM2(points: Array<{ xMm: number; yMm: number }>): number {
  const shoelace = points.reduce((acc, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return acc + point.xMm * next.yMm - next.xMm * point.yMm;
  }, 0);
  return Math.abs(shoelace) / 2 / 1_000_000;
}

export function SiteTerrainInspectorSection({
  el,
  onPropertyChange,
  onDispatchCommand,
}: {
  el: SiteTerrainElement;
  onPropertyChange?: PropertyChangeHandler;
  onDispatchCommand?: CommandDispatcher;
}): JSX.Element {
  switch (el.kind) {
    case 'toposolid': {
      const samples = el.heightSamples ?? [];
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Contour interval (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.contourIntervalMm ?? 0}
              key={`${el.id}-contour`}
              step={250}
              min={0}
              max={10000}
              data-testid="inspector-topo-contour-interval"
              onBlur={(event) => {
                const value = Number(event.currentTarget.value);
                onPropertyChange?.('contourIntervalMm', value > 0 ? value : null);
              }}
            />
          </div>
          <div className="border-t border-border pt-1">
            <div className="px-0 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Control Points
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-xs text-muted" data-testid="inspector-topo-point-count">
                {samples.length} control points
              </span>
              <button
                type="button"
                data-testid="inspector-topo-clear-points"
                className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
                onClick={() =>
                  onDispatchCommand?.({
                    type: 'update_toposolid',
                    id: el.id,
                    patch: { heightSamples: [] },
                  })
                }
              >
                Clear
              </button>
            </div>
            {samples.map((sample, index) => (
              <div key={index} className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">
                  ({Math.round(sample.xMm)}, {Math.round(sample.yMm)})
                </span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={sample.zMm}
                  key={`${el.id}-pt-${index}`}
                  step={100}
                  data-testid={`inspector-topo-point-${index}-z`}
                  onBlur={(event) => {
                    const updated = samples.map((point, pointIndex) =>
                      pointIndex === index
                        ? { ...point, zMm: Number(event.currentTarget.value) }
                        : point,
                    );
                    onDispatchCommand?.({
                      type: 'update_toposolid',
                      id: el.id,
                      patch: { heightSamples: updated },
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'graded_region':
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Lower Elevation (mm)</span>
            <input
              type="number"
              data-testid="inspector-graded-region-lower"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.lowerElevationMm ?? 0}
              key={`${el.id}-lower`}
              step={100}
              onBlur={(event) => onPropertyChange?.('lowerElevationMm', +event.currentTarget.value)}
            />
          </label>
          <label className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Upper Elevation (mm)</span>
            <input
              type="number"
              data-testid="inspector-graded-region-upper"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.upperElevationMm ?? 500}
              key={`${el.id}-upper`}
              step={100}
              onBlur={(event) => onPropertyChange?.('upperElevationMm', +event.currentTarget.value)}
            />
          </label>
        </div>
      );

    case 'toposolid_excavation': {
      const depth = el.depthMm ?? el.customDepthMm ?? 1500;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Depth (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={depth}
              key={`${el.id}-depth`}
              step={100}
              min={100}
              max={50000}
              data-testid="inspector-excavation-depth"
              onBlur={(event) => {
                const raw = Number(event.currentTarget.value);
                onPropertyChange?.('depthMm', Math.max(100, Math.min(50000, raw)));
              }}
            />
          </div>
          <FieldRow label="Area" value={`${polygonAreaM2(el.boundaryMm ?? []).toFixed(2)} m²`} />
        </div>
      );
    }

    case 'toposolid_pad':
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.elevationMm}
              key={`${el.id}-elevation`}
              step={100}
              data-testid="inspector-pad-elevation"
              onBlur={(event) => {
                onPropertyChange?.('elevationMm', Number(event.currentTarget.value));
              }}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5" data-testid="inspector-pad-area">
            <span className="text-xs text-muted w-28 shrink-0">Area</span>
            <span className="text-xs">{polygonAreaM2(el.boundaryMm ?? []).toFixed(1)} m²</span>
          </div>
        </div>
      );
  }
}
