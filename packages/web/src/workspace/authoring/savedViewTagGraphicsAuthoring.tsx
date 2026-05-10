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
  elementsById: Record<string, Element>;
  onPersistProperty: OnPersist;
}) {
  const { selected, revision, onPersistProperty, elementsById } = props;

  const openingStyles = Object.values(elementsById)
    .filter(
      (e): e is Extract<Element, { kind: 'plan_tag_style' }> =>
        e.kind === 'plan_tag_style' && e.tagTarget === 'opening',
    )
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
  const roomStyles = Object.values(elementsById)
    .filter(
      (e): e is Extract<Element, { kind: 'plan_tag_style' }> =>
        e.kind === 'plan_tag_style' && e.tagTarget === 'room',
    )
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

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
          Opening tag style (stored)
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
            value={selected.planOpeningTagStyleId ?? ''}
            onChange={(e) => {
              onPersistProperty('planOpeningTagStyleId', e.target.value);
            }}
          >
            <option value="">inherit from template</option>
            {openingStyles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.id}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] text-muted">
          Room tag style (stored)
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
            value={selected.planRoomTagStyleId ?? ''}
            onChange={(e) => {
              onPersistProperty('planRoomTagStyleId', e.target.value);
            }}
          >
            <option value="">inherit from template</option>
            {roomStyles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.id}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

/** Persisted defaults on `view_template` for plan graphic detail, fill, and tag visibility. */

export function SavedViewTemplateGraphicsAuthoring(props: {
  selected: ViewTemplateEl;
  revision: number;
  elementsById: Record<string, Element>;
  onPersistProperty: OnPersist;
}) {
  const { selected, revision, onPersistProperty, elementsById } = props;

  const openingStyles = Object.values(elementsById)
    .filter(
      (e): e is Extract<Element, { kind: 'plan_tag_style' }> =>
        e.kind === 'plan_tag_style' && e.tagTarget === 'opening',
    )
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));
  const roomStyles = Object.values(elementsById)
    .filter(
      (e): e is Extract<Element, { kind: 'plan_tag_style' }> =>
        e.kind === 'plan_tag_style' && e.tagTarget === 'room',
    )
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

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
        Default opening tag style
        <select
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
          value={selected.defaultPlanOpeningTagStyleId ?? ''}
          onChange={(e) => {
            onPersistProperty('defaultPlanOpeningTagStyleId', e.target.value);
          }}
        >
          <option value="">builtin / none</option>
          {openingStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.id}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[10px] text-muted">
        Default room tag style
        <select
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
          value={selected.defaultPlanRoomTagStyleId ?? ''}
          onChange={(e) => {
            onPersistProperty('defaultPlanRoomTagStyleId', e.target.value);
          }}
        >
          <option value="">builtin / none</option>
          {roomStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.id}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
