import { type JSX } from 'react';

import type {
  FamilyParamDef,
  FamilyVisibilityViewType,
  SketchLine,
  SweepGeometryNode,
  VisibilityBinding,
  VisibilityByDetailLevel,
  VisibilityByViewType,
} from '../families/types';
import { resolveMaterial } from '../viewport/materials';

export type DetailLevelKey = 'coarse' | 'medium' | 'fine';
export type PreviewViewTypeKey = FamilyVisibilityViewType;

export const FAMILY_VISIBILITY_VIEW_TYPES: { key: PreviewViewTypeKey; label: string }[] = [
  { key: 'plan_rcp', label: 'Plan/RCP' },
  { key: 'front_back', label: 'Front/Back' },
  { key: 'left_right', label: 'Left/Right' },
  { key: 'three_d', label: '3D Views' },
  { key: 'elevation', label: 'Elevations' },
  { key: 'section', label: 'Sections' },
];

type Param = {
  key: string;
  label: string;
  type: FamilyParamDef['type'];
  default: unknown;
  formula: string;
  instanceOverridable: boolean;
};

export type SymbolicLineSubcategory = 'symbolic' | 'opening_projection' | 'hidden_cut';

export type SymbolicLine = SketchLine & {
  subcategory: SymbolicLineSubcategory;
  alignmentLock?: { refPlaneId: string };
  visibilityBinding?: VisibilityBinding;
  visibilityByDetailLevel?: VisibilityByDetailLevel;
  visibilityByViewType?: VisibilityByViewType;
};

type SymbolicLineStyle = {
  label: string;
  objectStyle: string;
  stroke: string;
  strokeWidth: number;
  dashArray?: string;
};

export const SYMBOLIC_LINE_OBJECT_STYLES: Record<SymbolicLineSubcategory, SymbolicLineStyle> = {
  symbolic: {
    label: 'Symbolic Lines',
    objectStyle: 'Family: Symbolic Lines',
    stroke: 'var(--color-foreground)',
    strokeWidth: 2,
  },
  opening_projection: {
    label: 'Opening Projection',
    objectStyle: 'Family: Opening Projection',
    stroke: 'var(--color-accent)',
    strokeWidth: 3,
  },
  hidden_cut: {
    label: 'Hidden Lines (Cut)',
    objectStyle: 'Family: Hidden Lines (Cut)',
    stroke: 'var(--color-muted-foreground)',
    strokeWidth: 2,
    dashArray: '8 5',
  },
};

interface SweepPropertiesPanelProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  sweep: SweepGeometryNode;
  params: Param[];
  onUpdate: (binding: VisibilityBinding | undefined) => void;
  onUpdateMaterial: (materialKey: string | null) => void;
  onUpdatePathLengthParam: (paramName: string | null) => void;
  onUpdatePathStartOffsetParam: (paramName: string | null) => void;
  onUpdatePathEndOffsetParam: (paramName: string | null) => void;
  onUpdateMaterialParam: (paramName: string | null) => void;
  onAssociateVisibility: () => void;
  onAssociatePathLength: () => void;
  onAssociatePathStart: () => void;
  onAssociatePathEnd: () => void;
  onOpenMaterialBrowser: () => void;
  onOpenAppearanceAssetBrowser: () => void;
  onUpdateDetailLevel: (level: DetailLevelKey, visible: boolean) => void;
  onUpdateViewType: (viewType: PreviewViewTypeKey, visible: boolean) => void;
}

const VISIBLE_ALWAYS = '__always__';

export function SymbolicLinePropertiesPanel({
  line,
  params,
  onUpdate,
  onAssociateVisibility,
  onUpdateDetailLevel,
  onUpdateViewType,
}: {
  line: SymbolicLine;
  params: Param[];
  onUpdate: (binding: VisibilityBinding | undefined) => void;
  onAssociateVisibility: () => void;
  onUpdateDetailLevel: (level: DetailLevelKey, visible: boolean) => void;
  onUpdateViewType: (viewType: PreviewViewTypeKey, visible: boolean) => void;
}): JSX.Element {
  const booleanParams = params.filter((p) => p.type === 'boolean');
  const binding = line.visibilityBinding;
  const selected = binding ? binding.paramName : VISIBLE_ALWAYS;
  const whenTrue = binding ? binding.whenTrue : true;
  const detailVisible = (level: DetailLevelKey): boolean =>
    line.visibilityByDetailLevel?.[level] !== false;
  const viewTypeVisible = (viewType: PreviewViewTypeKey): boolean =>
    line.visibilityByViewType?.[viewType] !== false;
  const style = SYMBOLIC_LINE_OBJECT_STYLES[line.subcategory];

  function onParamChange(value: string) {
    if (value === VISIBLE_ALWAYS) {
      onUpdate(undefined);
    } else {
      onUpdate({ paramName: value, whenTrue });
    }
  }

  function onWhenChange(next: boolean) {
    if (!binding) return;
    onUpdate({ paramName: binding.paramName, whenTrue: next });
  }

  return (
    <div className="rounded border p-3 text-sm" role="region" aria-label="Symbolic line properties">
      <h3 className="mb-2 font-semibold text-sm">Symbolic Line Properties</h3>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span>Object Style</span>
        <span data-testid="selected-symbolic-object-style">
          {style.objectStyle} · weight {style.strokeWidth}
          {style.dashArray ? ' · dashed' : ''}
        </span>
      </div>
      <label className="flex items-center gap-2">
        <span className="w-32">Visible when</span>
        <select
          aria-label="Symbolic line visible when"
          value={selected}
          onChange={(e) => onParamChange(e.target.value)}
        >
          <option value={VISIBLE_ALWAYS}>Always visible</option>
          {booleanParams.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label || p.key}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs"
          onClick={onAssociateVisibility}
          data-testid="symbolic-associate-visible"
        >
          Associate Family Parameter
        </button>
      </label>
      {binding ? (
        <div className="mt-2 flex gap-3">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="symbolicVisibilityWhen"
              checked={whenTrue}
              onChange={() => onWhenChange(true)}
              aria-label="symbolic-show-when-true"
            />
            Show when true
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="symbolicVisibilityWhen"
              checked={!whenTrue}
              onChange={() => onWhenChange(false)}
              aria-label="symbolic-show-when-false"
            />
            Show when false
          </label>
        </div>
      ) : null}
      <div className="mt-2" role="group" aria-label="Symbolic visibility by detail level">
        <div className="font-medium">Detail levels</div>
        <div className="mt-1 flex gap-4">
          {(['coarse', 'medium', 'fine'] as const).map((level) => (
            <label key={level} className="inline-flex items-center gap-1 capitalize">
              <input
                type="checkbox"
                aria-label={`symbolic-visibility-${level}`}
                checked={detailVisible(level)}
                onChange={(e) => onUpdateDetailLevel(level, e.target.checked)}
              />
              {level}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-2" role="group" aria-label="Symbolic visibility by view type">
        <div className="font-medium">View types</div>
        <div className="mt-1 flex flex-wrap gap-4">
          {FAMILY_VISIBILITY_VIEW_TYPES.map((option) => (
            <label key={option.key} className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                aria-label={`symbolic-visibility-view-${option.key}`}
                checked={viewTypeVisible(option.key)}
                onChange={(e) => onUpdateViewType(option.key, e.target.checked)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SweepPropertiesPanel({
  t,
  sweep,
  params,
  onUpdate,
  onUpdateMaterial,
  onUpdatePathLengthParam,
  onUpdatePathStartOffsetParam,
  onUpdatePathEndOffsetParam,
  onUpdateMaterialParam,
  onAssociateVisibility,
  onAssociatePathLength,
  onAssociatePathStart,
  onAssociatePathEnd,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
  onUpdateDetailLevel,
  onUpdateViewType,
}: SweepPropertiesPanelProps): JSX.Element {
  const booleanParams = params.filter((p) => p.type === 'boolean');
  const lengthParams = params.filter((p) => p.type === 'length_mm');
  const materialParams = params.filter((p) => p.type === 'material_key');
  const binding = sweep.visibilityBinding;
  const selected = binding ? binding.paramName : VISIBLE_ALWAYS;
  const whenTrue = binding ? binding.whenTrue : true;
  const detailVis = sweep.visibilityByDetailLevel;
  const detailVisible = (level: DetailLevelKey): boolean => detailVis?.[level] !== false;
  const viewTypeVisible = (viewType: PreviewViewTypeKey): boolean =>
    sweep.visibilityByViewType?.[viewType] !== false;
  const material = resolveMaterial(sweep.materialKey);
  const associatedPathLength = sweep.pathLengthParam ?? VISIBLE_ALWAYS;
  const associatedPathStart = sweep.pathStartOffsetParam ?? VISIBLE_ALWAYS;
  const associatedPathEnd = sweep.pathEndOffsetParam ?? VISIBLE_ALWAYS;
  const associatedMaterial = sweep.materialKeyParam ?? VISIBLE_ALWAYS;

  function onParamChange(value: string) {
    if (value === VISIBLE_ALWAYS) {
      onUpdate(undefined);
    } else {
      onUpdate({ paramName: value, whenTrue });
    }
  }

  function onWhenChange(next: boolean) {
    if (!binding) return;
    onUpdate({ paramName: binding.paramName, whenTrue: next });
  }

  return (
    <div
      className="border rounded p-3 space-y-2 mt-2"
      role="region"
      aria-label={t('familyEditor.geometryPropertiesAriaLabel')}
    >
      <h3 className="font-semibold text-sm">{t('familyEditor.geometryPropertiesHeading')}</h3>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32">Path Length</span>
        <select
          aria-label="Associate path length parameter"
          value={associatedPathLength}
          onChange={(e) =>
            onUpdatePathLengthParam(e.target.value === VISIBLE_ALWAYS ? null : e.target.value)
          }
        >
          <option value={VISIBLE_ALWAYS}>Unassociated</option>
          {lengthParams.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label || p.key}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs"
          onClick={onAssociatePathLength}
          data-testid="sweep-associate-path-length"
        >
          Associate Family Parameter
        </button>
        {sweep.pathLengthParam ? (
          <span className="text-xs text-muted" data-testid="sweep-path-length-association">
            associated with {sweep.pathLengthParam}
          </span>
        ) : null}
      </label>
      <div className="rounded border border-border p-2" aria-label="Elevation extrusion controls">
        <div className="mb-2 text-sm font-medium">Elevation Extents</div>
        <svg
          role="img"
          aria-label="Elevation extrusion sketch"
          data-testid="elevation-extrusion-sketch"
          viewBox="0 0 280 120"
          className="mb-2 h-28 w-full rounded border border-border bg-surface"
        >
          <line x1="32" y1="96" x2="248" y2="96" stroke="var(--color-border)" />
          <rect x="96" y="32" width="88" height="64" fill="var(--color-accent)" opacity="0.18" />
          <line x1="80" y1="96" x2="200" y2="96" stroke="var(--color-warning)" strokeWidth="2" />
          <line x1="80" y1="32" x2="200" y2="32" stroke="var(--color-warning)" strokeWidth="2" />
          <circle cx="200" cy="96" r="5" fill="var(--color-warning)" />
          <circle cx="200" cy="32" r="5" fill="var(--color-warning)" />
          <text x="206" y="100" fontSize="10">
            {sweep.pathStartOffsetParam ?? 'Start'}
          </text>
          <text x="206" y="36" fontSize="10">
            {sweep.pathEndOffsetParam ?? sweep.pathLengthParam ?? 'End'}
          </text>
        </svg>
        <label className="mb-1 flex items-center gap-2 text-sm">
          <span className="w-32">Extrusion Start</span>
          <select
            aria-label="Associate extrusion start parameter"
            value={associatedPathStart}
            onChange={(e) =>
              onUpdatePathStartOffsetParam(
                e.target.value === VISIBLE_ALWAYS ? null : e.target.value,
              )
            }
          >
            <option value={VISIBLE_ALWAYS}>Unassociated</option>
            {lengthParams.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label || p.key}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded border px-2 py-0.5 text-xs"
            onClick={onAssociatePathStart}
            data-testid="sweep-associate-path-start"
          >
            Associate Family Parameter
          </button>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-32">Extrusion End</span>
          <select
            aria-label="Associate extrusion end parameter"
            value={associatedPathEnd}
            onChange={(e) =>
              onUpdatePathEndOffsetParam(e.target.value === VISIBLE_ALWAYS ? null : e.target.value)
            }
          >
            <option value={VISIBLE_ALWAYS}>Unassociated</option>
            {lengthParams.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label || p.key}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded border px-2 py-0.5 text-xs"
            onClick={onAssociatePathEnd}
            data-testid="sweep-associate-path-end"
          >
            Associate Family Parameter
          </button>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-32">Material</span>
        <span
          className="h-5 w-5 rounded border border-border"
          style={{ backgroundColor: material?.baseColor ?? 'var(--color-surface-strong)' }}
          aria-hidden="true"
        />
        <span data-testid="selected-sweep-material">
          {material ? material.displayName : (sweep.materialKey ?? 'None')}
        </span>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs"
          onClick={onOpenMaterialBrowser}
        >
          Browse
        </button>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs"
          onClick={onOpenAppearanceAssetBrowser}
        >
          Asset Browser
        </button>
        {sweep.materialKey ? (
          <button
            type="button"
            className="rounded border px-2 py-0.5 text-xs"
            onClick={() => onUpdateMaterial(null)}
          >
            Clear
          </button>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32">Material parameter</span>
        <select
          aria-label="Associate material parameter"
          value={associatedMaterial}
          onChange={(e) =>
            onUpdateMaterialParam(e.target.value === VISIBLE_ALWAYS ? null : e.target.value)
          }
        >
          <option value={VISIBLE_ALWAYS}>Unassociated</option>
          {materialParams.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label || p.key}
            </option>
          ))}
        </select>
        {sweep.materialKeyParam ? (
          <span className="text-xs text-muted" data-testid="sweep-material-association">
            associated with {sweep.materialKeyParam}
          </span>
        ) : null}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32">{t('familyEditor.visibleWhenLabel')}</span>
        <select
          aria-label={t('familyEditor.visibleWhenLabel')}
          value={selected}
          onChange={(e) => onParamChange(e.target.value)}
        >
          <option value={VISIBLE_ALWAYS}>{t('familyEditor.visibleAlways')}</option>
          {booleanParams.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label || p.key}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs"
          onClick={onAssociateVisibility}
          data-testid="sweep-associate-visible"
        >
          Associate Family Parameter
        </button>
      </label>
      {binding && (
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="visibilityWhen"
              checked={whenTrue}
              onChange={() => onWhenChange(true)}
              aria-label={t('familyEditor.showWhenTrue')}
            />
            {t('familyEditor.showWhenTrue')}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="visibilityWhen"
              checked={!whenTrue}
              onChange={() => onWhenChange(false)}
              aria-label={t('familyEditor.showWhenFalse')}
            />
            {t('familyEditor.showWhenFalse')}
          </label>
        </div>
      )}
      <div role="group" aria-label={t('familyEditor.visibilityByDetailHeading')}>
        <div className="text-sm font-medium">{t('familyEditor.visibilityByDetailHeading')}</div>
        <div className="flex gap-4 text-sm mt-1">
          {(['coarse', 'medium', 'fine'] as const).map((level) => {
            const labelKey = `familyEditor.visibilityDetail${level.charAt(0).toUpperCase() + level.slice(1)}`;
            return (
              <label key={level} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  aria-label={`visibility-${level}`}
                  checked={detailVisible(level)}
                  onChange={(e) => onUpdateDetailLevel(level, e.target.checked)}
                />
                {t(labelKey)}
              </label>
            );
          })}
        </div>
      </div>
      <div role="group" aria-label="Visibility by view type">
        <div className="text-sm font-medium">View types</div>
        <div className="mt-1 flex flex-wrap gap-4 text-sm">
          {FAMILY_VISIBILITY_VIEW_TYPES.map((option) => (
            <label key={option.key} className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                aria-label={`visibility-view-${option.key}`}
                checked={viewTypeVisible(option.key)}
                onChange={(e) => onUpdateViewType(option.key, e.target.checked)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
