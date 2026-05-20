import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type LinkDxfElement = Extract<Element, { kind: 'link_dxf' }>;

export function LinkDxfInspectorSection({
  el,
  elementsById,
  onPropertyChange,
}: {
  el: LinkDxfElement;
  elementsById: Record<string, Element>;
  onPropertyChange?: (property: string, value: unknown) => void;
}): JSX.Element {
  const levels = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
  );
  const levelNames = Object.fromEntries(levels.map((e) => [e.id, e.name]));
  return (
    <div className="space-y-1 text-[11px]">
      <FieldRow label="Name" value={el.name ?? '(unnamed DXF)'} />
      {onPropertyChange && levels.length > 0 ? (
        <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
          <label className="text-xs text-muted" htmlFor={`link-dxf-level-${el.id}`}>
            Level
          </label>
          <select
            id={`link-dxf-level-${el.id}`}
            className="max-w-[180px] rounded border border-border bg-surface px-1 py-0.5 text-xs"
            value={el.levelId}
            data-testid="inspector-link-dxf-level"
            onChange={(e) => onPropertyChange('levelId', e.currentTarget.value)}
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <FieldRow label="Level" value={levelNames[el.levelId] ?? el.levelId} />
      )}
      <FieldRow
        label="Origin"
        value={`(${Math.round(el.originMm.xMm)}, ${Math.round(el.originMm.yMm)}) mm`}
      />
      <FieldRow label="Rotation" value={`${el.rotationDeg ?? 0}°`} />
      <FieldRow label="Scale" value={`×${el.scaleFactor ?? 1}`} />
      <FieldRow label="Color Mode" value={el.colorMode === 'custom' ? 'Custom' : 'Black & White'} />
      {el.colorMode === 'custom' && el.customColor ? (
        <FieldRow label="Color" value={el.customColor} />
      ) : null}
      <FieldRow label="Opacity" value={`${Math.round((el.overlayOpacity ?? 0.5) * 100)}%`} />
    </div>
  );
}
