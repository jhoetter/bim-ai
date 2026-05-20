import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type DetailDocumentationElement = Extract<
  Element,
  { kind: 'detail_line' | 'detail_filled_region' | 'detail_arc' }
>;

type PropertyChangeHandler = (property: string, value: unknown) => void;

export function DetailDocumentationInspectorSection({
  el,
  onPropertyChange,
}: {
  el: DetailDocumentationElement;
  onPropertyChange?: PropertyChangeHandler;
}): JSX.Element {
  switch (el.kind) {
    case 'detail_line':
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            Line Weight (px)
            <input
              type="number"
              data-testid="inspector-detail-line-weight"
              className="w-20 bg-surface border border-border rounded px-1 py-0.5"
              value={el.lineWeightPx ?? 1}
              onChange={(event) => onPropertyChange?.('lineWeightPx', +event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            Color
            <input
              type="color"
              data-testid="inspector-detail-line-color"
              value={el.colorHex ?? '#000000'}
              onChange={(event) => onPropertyChange?.('colorHex', event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            Style
            <select
              data-testid="inspector-detail-line-style"
              className="bg-surface border border-border rounded px-1 py-0.5"
              value={el.lineStyle ?? 'solid'}
              onChange={(event) => onPropertyChange?.('lineStyle', event.target.value)}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>
          <span data-testid="inspector-detail-line-points" className="text-xs text-muted">
            {(el.pointsMm ?? []).length} points
          </span>
        </div>
      );

    case 'detail_filled_region':
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            Fill Pattern
            <select
              data-testid="inspector-detail-filled-region-pattern"
              className="bg-surface border border-border rounded px-1 py-0.5"
              value={el.fillPattern ?? 'solid'}
              onChange={(event) => onPropertyChange?.('fillPattern', event.target.value)}
            >
              <option value="solid">Solid</option>
              <option value="hatch-45">Hatch 45°</option>
              <option value="hatch-90">Hatch 90°</option>
              <option value="cross">Cross</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            Color
            <input
              type="color"
              data-testid="inspector-detail-filled-region-color"
              value={el.colorHex ?? '#cccccc'}
              onChange={(event) => onPropertyChange?.('colorHex', event.target.value)}
            />
          </label>
          <span data-testid="inspector-detail-filled-region-points" className="text-xs text-muted">
            {(el.perimeterMm ?? []).length} points
          </span>
        </div>
      );

    case 'detail_arc':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow
            label="Center"
            value={`(${Math.round(el.centerMm.xMm)}, ${Math.round(el.centerMm.yMm)}) mm`}
            mono
          />
          <FieldRow label="Radius" value={`${Math.round(el.radiusMm)} mm`} mono />
          <FieldRow label="Angles" value={`${el.startAngleDeg}° → ${el.endAngleDeg}°`} mono />
        </div>
      );
  }
}
