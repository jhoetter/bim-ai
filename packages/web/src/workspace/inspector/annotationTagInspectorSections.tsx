import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type AnnotationTagElement = Extract<Element, { kind: 'placed_tag' | 'material_tag' }>;
type PropertyChangeHandler = (property: string, value: unknown) => void;

function elementDisplayName(element: Element | undefined, fallback: string): string {
  if (!element) return fallback;
  return 'name' in element && typeof element.name === 'string' ? element.name : fallback;
}

function materialTagLabel(
  tagEl: Extract<Element, { kind: 'material_tag' }>,
  elementsById: Record<string, Element>,
): string {
  if (tagEl.textOverride) return tagEl.textOverride;
  const target = elementsById[tagEl.hostElementId];
  if (!target) return '—';

  const targetMaterial = target as { materialKey?: string; wallTypeId?: string };
  const wallType = targetMaterial.wallTypeId ? elementsById[targetMaterial.wallTypeId] : null;
  const layers = (wallType as { layers?: Array<{ materialKey?: string | null }> } | null)?.layers;
  if (layers && layers.length > 0) {
    const index = tagEl.layerIndex ?? 0;
    return layers[index]?.materialKey ?? '—';
  }
  return targetMaterial.materialKey ?? '—';
}

function PlacedTagInspectorSection({
  tagEl,
  elementsById,
  onPropertyChange,
}: {
  tagEl: Extract<Element, { kind: 'placed_tag' }>;
  elementsById: Record<string, Element>;
  onPropertyChange?: PropertyChangeHandler;
}): JSX.Element {
  const targetName = elementDisplayName(elementsById[tagEl.hostElementId], tagEl.hostElementId);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Mark</span>
        <input
          type="text"
          className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={tagEl.fields?.mark ?? ''}
          key={`${tagEl.id}-mark`}
          data-testid="inspector-tag-mark"
          onBlur={(event) =>
            onPropertyChange?.('fields', {
              ...tagEl.fields,
              mark: event.currentTarget.value || null,
            })
          }
        />
      </div>
      {tagEl.fields?.typeName ? <FieldRow label="Type" value={tagEl.fields.typeName} /> : null}
      <div data-testid="inspector-tag-type" style={{ display: 'none' }}>
        {tagEl.fields?.typeName ?? ''}
      </div>
      <FieldRow label="Target" value={targetName} />
      <div data-testid="inspector-tag-target" style={{ display: 'none' }}>
        {targetName}
      </div>
      {tagEl.categoryKind === 'room' ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-muted">Room Tag Fields</div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-testid="inspector-tag-show-number"
              checked={tagEl.showRoomNumber !== false}
              onChange={(event) => onPropertyChange?.('showRoomNumber', event.target.checked)}
            />
            Show Room Number
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-testid="inspector-tag-show-name"
              checked={tagEl.showRoomName !== false}
              onChange={(event) => onPropertyChange?.('showRoomName', event.target.checked)}
            />
            Show Room Name
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-testid="inspector-tag-show-area"
              checked={tagEl.showRoomArea === true}
              onChange={(event) => onPropertyChange?.('showRoomArea', event.target.checked)}
            />
            Show Area (m²)
          </label>
          <FieldRow
            label="Area"
            value={
              tagEl.fields?.roomArea != null
                ? `${(tagEl.fields.roomArea / 1e6).toFixed(2)} m²`
                : '—'
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function MaterialTagInspectorSection({
  tagEl,
  elementsById,
  onPropertyChange,
}: {
  tagEl: Extract<Element, { kind: 'material_tag' }>;
  elementsById: Record<string, Element>;
  onPropertyChange?: PropertyChangeHandler;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Material</span>
        <span data-testid="inspector-material-tag-resolved" className="text-xs font-semibold">
          {materialTagLabel(tagEl, elementsById)}
        </span>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Override</span>
        <input
          data-testid="inspector-material-tag-override"
          type="text"
          className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={tagEl.textOverride ?? ''}
          key={`${tagEl.id}-override`}
          placeholder="(auto)"
          onBlur={(event) => onPropertyChange?.('textOverride', event.currentTarget.value || null)}
        />
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Layer index</span>
        <input
          data-testid="inspector-material-tag-layer"
          type="number"
          min={0}
          className="w-16 text-xs bg-surface border border-border rounded px-1 py-0.5"
          defaultValue={tagEl.layerIndex ?? 0}
          key={`${tagEl.id}-layer`}
          onBlur={(event) => {
            const value = parseInt(event.currentTarget.value, 10);
            if (!isNaN(value)) onPropertyChange?.('layerIndex', value);
          }}
        />
      </div>
    </div>
  );
}

export function AnnotationTagInspectorSection({
  el,
  elementsById,
  onPropertyChange,
}: {
  el: AnnotationTagElement;
  elementsById: Record<string, Element>;
  onPropertyChange?: PropertyChangeHandler;
}): JSX.Element {
  if (el.kind === 'placed_tag') {
    return (
      <PlacedTagInspectorSection
        tagEl={el}
        elementsById={elementsById}
        onPropertyChange={onPropertyChange}
      />
    );
  }
  return (
    <MaterialTagInspectorSection
      tagEl={el}
      elementsById={elementsById}
      onPropertyChange={onPropertyChange}
    />
  );
}
