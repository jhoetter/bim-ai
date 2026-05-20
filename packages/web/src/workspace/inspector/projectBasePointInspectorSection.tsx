import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

type ProjectBasePointElement = Extract<Element, { kind: 'project_base_point' }>;
type PropertyChangeHandler = (property: string, value: unknown) => void;

export function ProjectBasePointInspectorSection({
  el,
  onPropertyChange,
}: {
  el: ProjectBasePointElement;
  onPropertyChange?: PropertyChangeHandler;
}): JSX.Element {
  const posMm = el.positionMm as { xMm: number; yMm: number; zMm?: number };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Position X (mm)</span>
        <input
          type="number"
          className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={posMm.xMm}
          key={`${el.id}-pbp-x`}
          step={100}
          data-testid="inspector-pbp-x"
          onBlur={(event) => {
            const value = Number(event.currentTarget.value);
            if (!isNaN(value)) {
              onPropertyChange?.('positionMm', {
                xMm: value,
                yMm: posMm.yMm,
                zMm: posMm.zMm ?? 0,
              });
            }
          }}
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Position Y (mm)</span>
        <input
          type="number"
          className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={posMm.yMm}
          key={`${el.id}-pbp-y`}
          step={100}
          data-testid="inspector-pbp-y"
          onBlur={(event) => {
            const value = Number(event.currentTarget.value);
            if (!isNaN(value)) {
              onPropertyChange?.('positionMm', {
                xMm: posMm.xMm,
                yMm: value,
                zMm: posMm.zMm ?? 0,
              });
            }
          }}
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
        <input
          type="number"
          className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={posMm.zMm ?? 0}
          key={`${el.id}-pbp-elevation`}
          step={100}
          data-testid="inspector-pbp-elevation"
          onBlur={(event) => {
            const value = Number(event.currentTarget.value);
            if (!isNaN(value)) {
              onPropertyChange?.('positionMm', {
                xMm: posMm.xMm,
                yMm: posMm.yMm,
                zMm: value,
              });
            }
          }}
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Name</span>
        <input
          type="text"
          className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={(el as { name?: string | null }).name ?? ''}
          key={`${el.id}-pbp-name`}
          data-testid="inspector-pbp-name"
          onBlur={(event) => {
            onPropertyChange?.('name', event.currentTarget.value || null);
          }}
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Shared Coordinates</span>
        <input
          type="checkbox"
          className="text-xs"
          defaultChecked={false}
          key={`${el.id}-pbp-shared`}
          data-testid="inspector-pbp-shared"
          onChange={(event) => {
            onPropertyChange?.('isShared', event.currentTarget.checked);
          }}
        />
      </div>
    </div>
  );
}
