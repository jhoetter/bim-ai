import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type InteriorElevationMarkerElement = Extract<Element, { kind: 'interior_elevation_marker' }>;
type PropertyChangeHandler = (property: string, value: unknown) => void;

const ELEVATION_MARKER_QUADRANTS = ['N', 'S', 'E', 'W'] as const;

export function InteriorElevationMarkerInspectorSection({
  el,
  elementsById,
  onPropertyChange,
}: {
  el: InteriorElevationMarkerElement;
  elementsById: Record<string, Element>;
  onPropertyChange?: PropertyChangeHandler;
}): JSX.Element {
  const levels = Object.values(elementsById).filter(
    (candidate): candidate is Extract<Element, { kind: 'level' }> => candidate.kind === 'level',
  );
  const activeQuadrants = el.activeQuadrants ?? ELEVATION_MARKER_QUADRANTS;
  return (
    <div className="flex flex-col gap-2">
      <FieldRow
        label="Position"
        value={`(${Math.round(el.positionMm.xMm)}, ${Math.round(el.positionMm.yMm)}) mm`}
        mono
      />
      {onPropertyChange ? (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-xs text-muted w-28 shrink-0">Level</span>
          <select
            className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
            value={el.levelId}
            data-testid="inspector-iel-level"
            onChange={(event) => onPropertyChange('levelId', event.currentTarget.value)}
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <FieldRow label="Level" value={el.levelId} mono />
      )}
      {onPropertyChange ? (
        <div className="flex items-center gap-2 py-0.5">
          <span className="text-xs text-muted w-28 shrink-0">Radius (mm)</span>
          <input
            type="number"
            className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs"
            defaultValue={el.radiusMm ?? 3000}
            key={`${el.id}-radius`}
            step={100}
            aria-label="Elevation marker radius in millimetres"
            data-testid="inspector-iel-radius"
            onBlur={(event) => {
              const value = Number(event.currentTarget.value);
              if (!isNaN(value) && value > 0) onPropertyChange('radiusMm', value);
            }}
          />
        </div>
      ) : (
        <FieldRow label="Radius (mm)" value={String(el.radiusMm ?? 3000)} mono />
      )}
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Quadrants</span>
        <div className="flex gap-2" data-testid="inspector-iel-quadrants">
          {ELEVATION_MARKER_QUADRANTS.map((quadrant) => (
            <label key={quadrant} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={activeQuadrants.includes(quadrant)}
                onChange={(event) => {
                  if (!onPropertyChange) return;
                  const next = event.currentTarget.checked
                    ? [...activeQuadrants, quadrant]
                    : activeQuadrants.filter((active) => active !== quadrant);
                  onPropertyChange('activeQuadrants', next);
                }}
              />
              {quadrant}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
