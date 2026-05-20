import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type PropertyChange = (property: string, value: unknown) => void;
type TextNoteElement = Extract<Element, { kind: 'text_note' }>;
type LeaderTextElement = Extract<Element, { kind: 'leader_text' }>;

function TextStyleControls({
  element,
  colorLabel,
  onPropertyChange,
}: {
  element: TextNoteElement | LeaderTextElement;
  colorLabel: string;
  onPropertyChange: PropertyChange;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
      <button
        type="button"
        className={`rounded border px-2 py-0.5 text-xs font-bold ${element.bold ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
        data-testid="inspector-text-bold"
        aria-pressed={!!element.bold}
        onClick={() => onPropertyChange('bold', !element.bold)}
      >
        B
      </button>
      <button
        type="button"
        className={`rounded border px-2 py-0.5 text-xs italic ${element.italic ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
        data-testid="inspector-text-italic"
        aria-pressed={!!element.italic}
        onClick={() => onPropertyChange('italic', !element.italic)}
      >
        I
      </button>
      <button
        type="button"
        className={`rounded border px-2 py-0.5 text-xs underline ${element.underline ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
        data-testid="inspector-text-underline"
        aria-pressed={!!element.underline}
        onClick={() => onPropertyChange('underline', !element.underline)}
      >
        U
      </button>
      <span className="mx-1 text-muted">|</span>
      {(['left', 'center', 'right'] as const).map((align) => (
        <button
          key={align}
          type="button"
          className={`rounded border px-2 py-0.5 text-xs ${(element.horizontalAlign ?? 'left') === align ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
          data-testid={`inspector-text-align-${align}`}
          aria-pressed={(element.horizontalAlign ?? 'left') === align}
          onClick={() => onPropertyChange('horizontalAlign', align)}
        >
          {align[0]!.toUpperCase()}
        </button>
      ))}
      <span className="mx-1 text-muted">|</span>
      <input
        type="color"
        className="h-6 w-8 cursor-pointer rounded border border-border bg-surface p-0.5"
        // eslint-disable-next-line bim-ai/no-hex-in-chrome
        value={element.colorHex ?? '#202020'}
        key={`${element.id}-color`}
        aria-label={colorLabel}
        data-testid="inspector-text-color"
        onChange={(e) => onPropertyChange('colorHex', e.currentTarget.value)}
      />
    </div>
  );
}

export function TextNoteInspectorSection({
  element,
  onPropertyChange,
}: {
  element: TextNoteElement;
  onPropertyChange?: PropertyChange;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <FieldRow label="Host View" value={element.hostViewId} mono />
      <FieldRow
        label="Position"
        value={`(${Math.round(element.positionMm.xMm)}, ${Math.round(element.positionMm.yMm)}) mm`}
        mono
      />
      {onPropertyChange ? (
        <>
          <TextStyleControls
            element={element}
            colorLabel="Text note color"
            onPropertyChange={onPropertyChange}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Content</span>
            <textarea
              className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
              rows={3}
              defaultValue={element.text}
              key={`${element.id}-content`}
              aria-label="Text note content"
              data-testid="inspector-text-note-content"
              onBlur={(e) => onPropertyChange('text', e.currentTarget.value)}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Font size (mm)</span>
            <input
              type="number"
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
              defaultValue={element.fontSizeMm ?? 200}
              key={`${element.id}-fontsize`}
              step={50}
              aria-label="Text note font size in millimetres"
              data-testid="inspector-text-note-font-size"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) onPropertyChange('fontSizeMm', v);
              }}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Rotation (°)</span>
            <input
              type="number"
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
              defaultValue={element.rotationDeg ?? 0}
              key={`${element.id}-rotation`}
              step={15}
              aria-label="Text note rotation in degrees"
              data-testid="inspector-text-note-rotation"
              onBlur={(e) => onPropertyChange('rotationDeg', Number(e.currentTarget.value))}
            />
          </div>
        </>
      ) : (
        <FieldRow label="Content" value={element.text} />
      )}
    </div>
  );
}

export function LeaderTextInspectorSection({
  element,
  onPropertyChange,
}: {
  element: LeaderTextElement;
  onPropertyChange?: PropertyChange;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <FieldRow label="Host View" value={element.hostViewId} mono />
      <FieldRow
        label="Anchor"
        value={`(${Math.round(element.anchorMm.xMm)}, ${Math.round(element.anchorMm.yMm)}) mm`}
        mono
      />
      <FieldRow
        label="Text"
        value={`(${Math.round(element.textMm.xMm)}, ${Math.round(element.textMm.yMm)}) mm`}
        mono
      />
      {onPropertyChange ? (
        <>
          <TextStyleControls
            element={element}
            colorLabel="Leader text color"
            onPropertyChange={onPropertyChange}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Content</span>
            <textarea
              className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
              rows={3}
              defaultValue={element.content}
              key={`${element.id}-content`}
              aria-label="Leader text content"
              data-testid="inspector-leader-text-content"
              onBlur={(e) => onPropertyChange('content', e.currentTarget.value)}
            />
          </div>
          <label className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Arrow style</span>
            <select
              className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
              value={element.arrowStyle ?? 'arrow'}
              data-testid="inspector-leader-text-arrow-style"
              onChange={(e) => onPropertyChange('arrowStyle', e.currentTarget.value)}
            >
              <option value="arrow">Arrow</option>
              <option value="dot">Dot</option>
              <option value="none">None</option>
            </select>
          </label>
        </>
      ) : (
        <FieldRow label="Content" value={element.content} />
      )}
    </div>
  );
}
