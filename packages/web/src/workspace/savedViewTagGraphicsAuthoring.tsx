import type { Element } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';

type PlanViewEl = Extract<Element, { kind: 'plan_view' }>;
type ViewTemplateEl = Extract<Element, { kind: 'view_template' }>;

type OnPersist = (key: string, value: string) => void;

/** Graphic overrides + annotation tri-states for a saved floor plan (persists via `updateElementProperty`). */

export function SavedViewTagGraphicsAuthoring(props: {
  variant: 'plan_view';
  selected: PlanViewEl;
  revision: number;
  onPersistProperty: OnPersist;
}) {
  const { selected, revision, onPersistProperty } = props;

  return (
    <>
      <div className="border-border mt-3 space-y-2 border-t pt-2">
        <div className="font-semibold text-muted">Graphic overrides</div>
        <label className="block text-[10px] text-muted">
          Plan detail level (stored)
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
            value={selected.planDetailLevel ?? ''}
            onChange={(e) => {
              onPersistProperty('planDetailLevel', e.target.value);
            }}
          >
            <option value="">inherit from template</option>
            <option value="coarse">coarse</option>
            <option value="medium">medium</option>
            <option value="fine">fine</option>
          </select>
        </label>
        <label className="block text-[10px] text-muted">
          Room fill opacity scale (0–1; empty on blur clears override)
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            key={`pv-fill-${selected.id}-${selected.planRoomFillOpacityScale ?? 'null'}-${revision}`}
            defaultValue={
              selected.planRoomFillOpacityScale == null
                ? ''
                : String(selected.planRoomFillOpacityScale)
            }
            placeholder="inherit"
            type="text"
            inputMode="decimal"
            onBlur={(e) => {
              onPersistProperty('planRoomFillOpacityScale', e.target.value.trim());
            }}
          />
        </label>
        <Btn
          type="button"
          variant="quiet"
          className="w-full text-[10px]"
          onClick={() => onPersistProperty('planRoomFillOpacityScale', '')}
        >
          Clear fill override
        </Btn>
      </div>

      <div className="border-border mt-3 space-y-2 border-t pt-2">
        <div className="font-semibold text-muted">Annotations</div>
        <label className="block text-[10px] text-muted">
          Opening tags
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
            value={
              selected.planShowOpeningTags === undefined
                ? ''
                : selected.planShowOpeningTags
                  ? 'true'
                  : 'false'
            }
            onChange={(e) => {
              onPersistProperty('planShowOpeningTags', e.target.value);
            }}
          >
            <option value="">inherit</option>
            <option value="true">on</option>
            <option value="false">off</option>
          </select>
        </label>
        <label className="block text-[10px] text-muted">
          Room labels
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
            value={
              selected.planShowRoomLabels === undefined
                ? ''
                : selected.planShowRoomLabels
                  ? 'true'
                  : 'false'
            }
            onChange={(e) => {
              onPersistProperty('planShowRoomLabels', e.target.value);
            }}
          >
            <option value="">inherit</option>
            <option value="true">on</option>
            <option value="false">off</option>
          </select>
        </label>
        <label className="block text-[10px] text-muted">
          Opening tag definition id (empty inherits)
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            key={`pv-opening-tag-${selected.id}-${selected.planOpeningTagDefinitionId ?? 'null'}-${revision}`}
            defaultValue={selected.planOpeningTagDefinitionId ?? ''}
            placeholder="inherit"
            type="text"
            onBlur={(e) => {
              onPersistProperty('planOpeningTagDefinitionId', e.target.value.trim());
            }}
          />
        </label>
        <label className="block text-[10px] text-muted">
          Room tag definition id (empty inherits)
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            key={`pv-room-tag-${selected.id}-${selected.planRoomTagDefinitionId ?? 'null'}-${revision}`}
            defaultValue={selected.planRoomTagDefinitionId ?? ''}
            placeholder="inherit"
            type="text"
            onBlur={(e) => {
              onPersistProperty('planRoomTagDefinitionId', e.target.value.trim());
            }}
          />
        </label>
      </div>
    </>
  );
}

/** Persisted defaults on `view_template` for plan graphic detail, fill, and tag visibility. */

export function SavedViewTemplateGraphicsAuthoring(props: {
  selected: ViewTemplateEl;
  revision: number;
  onPersistProperty: OnPersist;
}) {
  const { selected, revision, onPersistProperty } = props;

  return (
    <>
      <label className="block text-[10px] text-muted">
        Plan detail level (template default)
        <select
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
          value={selected.planDetailLevel ?? ''}
          onChange={(e) => {
            onPersistProperty('planDetailLevel', e.target.value);
          }}
        >
          <option value="">inherit → medium when resolving</option>
          <option value="coarse">coarse</option>
          <option value="medium">medium</option>
          <option value="fine">fine</option>
        </select>
      </label>
      <label className="block text-[10px] text-muted">
        Room fill opacity scale (0–1)
        <input
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
          key={`vt-fill-${selected.id}-${selected.planRoomFillOpacityScale ?? 'null'}-${revision}`}
          defaultValue={String(selected.planRoomFillOpacityScale ?? 1)}
          type="text"
          inputMode="decimal"
          onBlur={(e) => {
            onPersistProperty('planRoomFillOpacityScale', e.target.value.trim());
          }}
        />
      </label>
      <Btn
        type="button"
        variant="quiet"
        className="w-full text-[10px]"
        onClick={() => onPersistProperty('planRoomFillOpacityScale', '')}
      >
        Reset fill to default (1.0)
      </Btn>
      <label className="block text-[10px] text-muted">
        Opening tags default
        <select
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
          value={selected.planShowOpeningTags ? 'true' : 'false'}
          onChange={(e) => {
            onPersistProperty('planShowOpeningTags', e.target.value);
          }}
        >
          <option value="false">off</option>
          <option value="true">on</option>
        </select>
      </label>
      <label className="block text-[10px] text-muted">
        Room labels default
        <select
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
          value={selected.planShowRoomLabels ? 'true' : 'false'}
          onChange={(e) => {
            onPersistProperty('planShowRoomLabels', e.target.value);
          }}
        >
          <option value="false">off</option>
          <option value="true">on</option>
        </select>
      </label>
      <label className="block text-[10px] text-muted">
        Opening tag definition id
        <input
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
          key={`vt-opening-tag-${selected.id}-${selected.planOpeningTagDefinitionId ?? 'null'}-${revision}`}
          defaultValue={selected.planOpeningTagDefinitionId ?? ''}
          placeholder="none"
          type="text"
          onBlur={(e) => {
            onPersistProperty('planOpeningTagDefinitionId', e.target.value.trim());
          }}
        />
      </label>
      <label className="block text-[10px] text-muted">
        Room tag definition id
        <input
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
          key={`vt-room-tag-${selected.id}-${selected.planRoomTagDefinitionId ?? 'null'}-${revision}`}
          defaultValue={selected.planRoomTagDefinitionId ?? ''}
          placeholder="none"
          type="text"
          onBlur={(e) => {
            onPersistProperty('planRoomTagDefinitionId', e.target.value.trim());
          }}
        />
      </label>
    </>
  );
}
