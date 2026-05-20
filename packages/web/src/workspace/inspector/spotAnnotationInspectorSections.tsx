import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type SpotAnnotationElement = Extract<
  Element,
  { kind: 'spot_elevation' | 'spot_coordinate' | 'spot_slope' | 'slope_annotation' }
>;

type PropertyChangeHandler = (property: string, value: unknown) => void;

function positionLabel(positionMm: { xMm: number; yMm: number }): string {
  return `(${Math.round(positionMm.xMm)}, ${Math.round(positionMm.yMm)}) mm`;
}

export function SpotAnnotationInspectorSection({
  el,
  onPropertyChange,
}: {
  el: SpotAnnotationElement;
  onPropertyChange?: PropertyChangeHandler;
}): JSX.Element {
  switch (el.kind) {
    case 'spot_elevation':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow label="Position" value={positionLabel(el.positionMm)} mono />
          <FieldRow label="Elevation" value={`${(el.elevationMm / 1000).toFixed(3)} m`} mono />
          {onPropertyChange ? (
            <>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
                <input
                  type="number"
                  className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.elevationMm}
                  key={`${el.id}-elev`}
                  step={100}
                  aria-label="Spot elevation in millimetres"
                  data-testid="inspector-spot-elevation-mm"
                  onBlur={(event) =>
                    onPropertyChange('elevationMm', Number(event.currentTarget.value))
                  }
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Elevation mode</span>
                <select
                  className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  value={el.elevationMode ?? 'absolute'}
                  data-testid="inspector-spot-elevation-mode"
                  onChange={(event) => onPropertyChange('elevationMode', event.currentTarget.value)}
                >
                  <option value="absolute">Absolute</option>
                  <option value="relative-to-level">Relative to level</option>
                </select>
              </div>
              <label className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  defaultChecked={el.showIn3D !== false}
                  key={`${el.id}-show3d`}
                  data-testid="inspector-spot-elevation-show3d"
                  onChange={(event) => onPropertyChange('showIn3D', event.currentTarget.checked)}
                />
                <span className="text-xs text-muted">Show in 3D</span>
              </label>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Prefix</span>
                <input
                  type="text"
                  className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.prefix ?? ''}
                  key={`${el.id}-prefix`}
                  aria-label="Elevation text prefix"
                  data-testid="inspector-spot-elevation-prefix"
                  onBlur={(event) => onPropertyChange('prefix', event.currentTarget.value)}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Suffix</span>
                <input
                  type="text"
                  className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.suffix ?? ''}
                  key={`${el.id}-suffix`}
                  aria-label="Elevation text suffix"
                  data-testid="inspector-spot-elevation-suffix"
                  onBlur={(event) => onPropertyChange('suffix', event.currentTarget.value)}
                />
              </div>
            </>
          ) : null}
        </div>
      );

    case 'spot_coordinate':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow label="Position" value={positionLabel(el.positionMm)} mono />
          <div className="flex items-center gap-2 py-0.5">
            <label className="flex items-center gap-2 py-0.5 w-full">
              <span className="text-xs text-muted w-28 shrink-0">N (Northing)</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={el.coordinateN ?? el.northMm ?? 0}
                key={`${el.id}-coord-n`}
                data-testid="inspector-spot-coord-n"
                onChange={(event) => onPropertyChange?.('coordinateN', +event.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <label className="flex items-center gap-2 py-0.5 w-full">
              <span className="text-xs text-muted w-28 shrink-0">E (Easting)</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={el.coordinateE ?? el.eastMm ?? 0}
                key={`${el.id}-coord-e`}
                data-testid="inspector-spot-coord-e"
                onChange={(event) => onPropertyChange?.('coordinateE', +event.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <span className="text-xs" data-testid="inspector-spot-coord-elevation">
              {el.elevationMm ?? 0}
            </span>
          </div>
        </div>
      );

    case 'spot_slope':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow label="Position" value={positionLabel(el.positionMm)} mono />
          {onPropertyChange ? (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Slope (%)</span>
              <input
                type="number"
                className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={el.slopePct}
                key={`${el.id}-slope`}
                step={0.5}
                aria-label="Slope percentage"
                data-testid="inspector-spot-slope-pct"
                onBlur={(event) => onPropertyChange('slopePct', Number(event.currentTarget.value))}
              />
            </div>
          ) : (
            <FieldRow label="Slope" value={`${el.slopePct}%`} />
          )}
        </div>
      );

    case 'slope_annotation':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Start" value={positionLabel(el.startMm)} mono />
          <FieldRow label="End" value={positionLabel(el.endMm)} mono />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Slope (%)</span>
            <input
              type="number"
              step={0.1}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
              defaultValue={el.slopePct}
              key={`${el.id}-sa-slope`}
              data-testid="inspector-slope-annotation-pct"
              onChange={(event) => onPropertyChange?.('slopePct', +event.target.value)}
            />
          </div>
          <span className="text-xs text-muted" data-testid="inspector-slope-annotation-ratio">
            1:{(100 / Math.max(el.slopePct, 0.01)).toFixed(0)}
          </span>
        </div>
      );
  }
}
