import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FAMILY_CATEGORIES } from '../../familyEditor/familyCategories';

type FamilyInspectorElement = Extract<
  Element,
  {
    kind:
      | 'family_extrusion'
      | 'family_blend'
      | 'family_sweep'
      | 'family_swept_blend'
      | 'family_opening_cut'
      | 'family_component'
      | 'family_definition'
      | 'family_parameter'
      | 'family_constraint'
      | 'family_reference_plane';
  }
>;

type FamilyInspectorOptions = {
  onPropertyChange?: (property: string, value: unknown) => void;
  onDispatchCommand?: (cmd: Record<string, unknown>) => void;
};

type FamilyInspectorSectionProps = {
  el: FamilyInspectorElement;
  options?: FamilyInspectorOptions;
};

export function FamilyInspectorSection({ el, options }: FamilyInspectorSectionProps): JSX.Element {
  const onSemanticCommand = options?.onDispatchCommand;

  switch (el.kind) {
    case 'family_extrusion': {
      const { onPropertyChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <label>
            Frame Inner Width (mm)
            <input
              type="number"
              data-testid="inspector-family-frame-inner-width"
              value={el.frameInnerWidthMm ?? 50}
              onChange={(e) => onPropertyChange?.('frameInnerWidthMm', +e.target.value)}
            />
          </label>
          <label>
            Sill Depth (mm)
            <input
              type="number"
              data-testid="inspector-family-frame-sill-depth"
              value={el.frameSillDepthMm ?? 100}
              onChange={(e) => onPropertyChange?.('frameSillDepthMm', +e.target.value)}
            />
          </label>
          <label>
            Is Glazing Panel
            <input
              type="checkbox"
              data-testid="inspector-family-is-glazing"
              checked={el.isGlazing ?? false}
              onChange={(e) => onPropertyChange?.('isGlazing', e.target.checked)}
            />
          </label>
        </div>
      );
    }
    case 'family_blend': {
      const { onPropertyChange: blendPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightMm}
              key={`${el.id}-height`}
              step={100}
              min={1}
              onBlur={(e) => blendPropChange?.('heightMm', Number(e.currentTarget.value))}
              data-testid="inspector-family-blend-height"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Elevation (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.baseElevationMm}
              key={`${el.id}-base-elevation`}
              step={100}
              onBlur={(e) => blendPropChange?.('baseElevationMm', Number(e.currentTarget.value))}
              data-testid="inspector-family-blend-base-elevation"
            />
          </div>
          <div
            className="flex items-center justify-between gap-4 border-b border-border py-1.5"
            data-testid="inspector-family-blend-bottom-pts"
          >
            <span className="text-xs text-muted">Bottom pts</span>
            <span className="text-sm text-foreground">{el.bottomProfileMm.length}</span>
          </div>
          <div
            className="flex items-center justify-between gap-4 border-b border-border py-1.5"
            data-testid="inspector-family-blend-top-pts"
          >
            <span className="text-xs text-muted">Top pts</span>
            <span className="text-sm text-foreground">{el.topProfileMm.length}</span>
          </div>
        </div>
      );
    }
    case 'family_sweep': {
      const pathLengthMm = el.pathMm.reduce((acc, pt, i) => {
        if (i === 0) return 0;
        const prev = el.pathMm[i - 1]!;
        const dx = pt.xMm - prev.xMm;
        const dy = pt.yMm - prev.yMm;
        const dz = pt.zMm - prev.zMm;
        return acc + Math.sqrt(dx * dx + dy * dy + dz * dz);
      }, 0);
      return (
        <div className="flex flex-col gap-2">
          <div
            className="flex items-center justify-between gap-4 border-b border-border py-1.5"
            data-testid="inspector-family-sweep-profile-pts"
          >
            <span className="text-xs text-muted">Profile pts</span>
            <span className="text-sm text-foreground">{el.profileMm.length}</span>
          </div>
          <div
            className="flex items-center justify-between gap-4 border-b border-border py-1.5"
            data-testid="inspector-family-sweep-path-pts"
          >
            <span className="text-xs text-muted">Path pts</span>
            <span className="text-sm text-foreground">{el.pathMm.length}</span>
          </div>
          <div
            className="flex items-center justify-between gap-4 border-b border-border py-1.5"
            data-testid="inspector-family-sweep-path-length"
          >
            <span className="text-xs text-muted">Path length (mm)</span>
            <span className="text-sm text-foreground">{pathLengthMm.toFixed(0)}</span>
          </div>
        </div>
      );
    }
    case 'family_swept_blend': {
      return (
        <div data-testid="inspector-family-swept-blend" className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Path Points</span>
            <span data-testid="inspector-fsb-path-count" className="text-sm">
              {el.pathMm?.length ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Start Profile</span>
            <span data-testid="inspector-fsb-start-count" className="text-sm">
              {el.startProfileMm?.length ?? 0} pts
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">End Profile</span>
            <span data-testid="inspector-fsb-end-count" className="text-sm">
              {el.endProfileMm?.length ?? 0} pts
            </span>
          </div>
        </div>
      );
    }
    case 'family_opening_cut': {
      return (
        <div style={{ padding: 8 }}>
          <div className="text-xs font-semibold mb-2">Opening Cut</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, width: 60 }}>Width</span>
              <span data-testid="inspector-opening-cut-width" style={{ fontSize: 11 }}>
                {el.widthMm} mm
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, width: 60 }}>Height</span>
              <span data-testid="inspector-opening-cut-height" style={{ fontSize: 11 }}>
                {el.heightMm} mm
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, width: 60 }}>Sill offset</span>
              <span data-testid="inspector-opening-cut-sill" style={{ fontSize: 11 }}>
                {el.sillOffsetMm ?? 0} mm
              </span>
            </div>
          </div>
        </div>
      );
    }
    case 'family_component': {
      return (
        <div style={{ padding: 8 }}>
          <div className="text-xs font-semibold mb-1">Nested Component</div>
          <div className="text-xs text-muted" data-testid="inspector-family-component-type">
            Type: {el.componentTypeId}
          </div>
          <div className="text-xs text-muted" data-testid="inspector-family-component-label">
            Label: {el.label ?? el.componentTypeId}
          </div>
          <div className="text-xs text-muted">
            Origin: ({el.originMm?.xMm?.toFixed(0)}, {el.originMm?.yMm?.toFixed(0)},{' '}
            {el.originMm?.zMm?.toFixed(0)}) mm
          </div>
        </div>
      );
    }
    case 'family_definition': {
      return (
        <div style={{ padding: 8 }}>
          <div className="text-xs font-semibold mb-2">Family Definition</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, width: 70 }}>Category</span>
            <select
              data-testid="inspector-family-category"
              value={el.categoryKey ?? ''}
              onChange={(e) =>
                onSemanticCommand?.({
                  type: 'setFamilyCategory',
                  familyId: el.id,
                  categoryKey: e.target.value,
                })
              }
              style={{ fontSize: 11, flex: 1 }}
            >
              <option value="">-- Select Category --</option>
              {FAMILY_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }
    case 'family_parameter': {
      const { onPropertyChange: fpPropChange } = options ?? {};
      const numericDefaultValue =
        typeof el.defaultValue === 'number' ? el.defaultValue : Number(el.defaultValue) || 0;
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 py-0.5 text-xs">
            <span className="text-muted w-28 shrink-0">Name</span>
            <input
              data-testid="inspector-family-param-name"
              className="w-40 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.name}
              onChange={(e) => fpPropChange?.('name', e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Type</span>
            <span data-testid="inspector-family-param-type" className="text-sm text-foreground">
              {el.paramType}
            </span>
          </div>
          <label className="flex items-center gap-2 py-0.5 text-xs">
            <span className="text-muted w-28 shrink-0">Default Value</span>
            <input
              type="number"
              data-testid="inspector-family-param-value"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={numericDefaultValue}
              onChange={(e) => fpPropChange?.('defaultValue', +e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 py-0.5 text-xs">
            <span className="text-muted w-28 shrink-0">Instance Parameter</span>
            <input
              type="checkbox"
              data-testid="inspector-family-param-instance"
              checked={el.isInstance}
              onChange={(e) => fpPropChange?.('isInstance', e.target.checked)}
            />
          </label>
        </div>
      );
    }
    case 'family_constraint': {
      return (
        <div data-testid="inspector-family-constraint" className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Parameter</span>
            <span data-testid="inspector-fc-param-name" className="text-sm">
              {el.paramName}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Axis</span>
            <span data-testid="inspector-fc-axis" className="text-sm">
              {el.axis.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Ref Plane 1</span>
            <span data-testid="inspector-fc-ref1" className="text-xs text-muted">
              {el.refPlaneId1.slice(-8)}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Ref Plane 2</span>
            <span data-testid="inspector-fc-ref2" className="text-xs text-muted">
              {el.refPlaneId2.slice(-8)}
            </span>
          </div>
          <button
            data-testid="inspector-fc-remove"
            className="text-xs text-red-400 text-left mt-1"
            onClick={() =>
              onSemanticCommand?.({ type: 'removeFamilyConstraint', constraintId: el.id })
            }
          >
            Remove Constraint
          </button>
        </div>
      );
    }
    case 'family_reference_plane': {
      return (
        <div style={{ fontSize: 11, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Reference Plane</div>
          <label>
            Name
            <input
              data-testid="inspector-ref-plane-name"
              type="text"
              value={el.name ?? ''}
              onChange={(e) =>
                onSemanticCommand?.({
                  type: 'updateElementProperty',
                  elementId: el.id,
                  key: 'name',
                  value: e.target.value,
                })
              }
              style={{ marginLeft: 6, fontSize: 11, width: 120 }}
            />
          </label>
          <label>
            Axis
            <select
              data-testid="inspector-ref-plane-axis"
              value={el.axis ?? 'x'}
              onChange={(e) =>
                onSemanticCommand?.({
                  type: 'updateElementProperty',
                  elementId: el.id,
                  key: 'axis',
                  value: e.target.value,
                })
              }
              style={{ marginLeft: 6, fontSize: 11 }}
            >
              <option value="x">X (vertical)</option>
              <option value="z">Z (horizontal)</option>
            </select>
          </label>
          <label>
            Offset (mm)
            <input
              data-testid="inspector-ref-plane-offset"
              type="number"
              value={el.offsetMm ?? 0}
              onChange={(e) =>
                onSemanticCommand?.({
                  type: 'updateElementProperty',
                  elementId: el.id,
                  key: 'offsetMm',
                  value: Number(e.target.value),
                })
              }
              style={{ marginLeft: 6, fontSize: 11, width: 70 }}
            />
          </label>
        </div>
      );
    }
  }
}
