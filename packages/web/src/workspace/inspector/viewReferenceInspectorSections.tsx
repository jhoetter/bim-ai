import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type ViewReferenceElement = Extract<Element, { kind: 'viewpoint' | 'elevation_view' | 'callout' }>;

function resolveElementName(
  id: string | null | undefined,
  elementsById: Record<string, Element>,
): string {
  if (!id) return '—';
  const element = elementsById[id];
  if (!element) return id;
  return 'name' in element && typeof element.name === 'string' ? element.name : id;
}

export function ViewReferenceInspectorSection({
  el,
  elementsById,
  fieldLabel,
}: {
  el: ViewReferenceElement;
  elementsById: Record<string, Element>;
  fieldLabel: (key: string) => string;
}): JSX.Element {
  switch (el.kind) {
    case 'viewpoint':
      return (
        <div>
          <FieldRow label={fieldLabel('name')} value={el.name} />
          <FieldRow label={fieldLabel('id')} value={el.id} mono />
        </div>
      );

    case 'elevation_view':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Direction" value={el.direction} />
          {el.customAngleDeg != null ? (
            <FieldRow label="Angle" value={`${el.customAngleDeg}°`} />
          ) : null}
          {el.scale != null ? (
            <FieldRow label={fieldLabel('scale')} value={`1:${el.scale}`} />
          ) : null}
          {el.planDetailLevel ? <FieldRow label="Detail Level" value={el.planDetailLevel} /> : null}
        </div>
      );

    case 'callout':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={fieldLabel('name')} value={el.name} />
          <FieldRow
            label="Parent Sheet"
            value={resolveElementName(el.parentSheetId, elementsById)}
          />
          <FieldRow label="Outline Vertices" value={String(el.outlineMm.length)} mono />
        </div>
      );
  }
}
