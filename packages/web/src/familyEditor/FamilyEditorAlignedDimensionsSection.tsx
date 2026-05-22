import type { JSX } from 'react';

import type {
  EqConstraint,
  FamilyDimension,
  Param,
  RefPlane,
} from './familyEditorWorkbenchDefaults';

interface DimensionDraft {
  refAId: string;
  refBId: string;
  labelMode: 'existing' | 'new';
  paramKey: string;
  newParamKey: string;
}

type Setter<T> = (value: T | ((prev: T) => T)) => void;

export interface FamilyEditorAlignedDimensionsSectionProps {
  refPlanes: RefPlane[];
  dimensions: FamilyDimension[];
  eqConstraints: EqConstraint[];
  lengthParams: Param[];
  dimensionDraft: DimensionDraft;
  setDimensionDraft: Setter<DimensionDraft>;
  eqOrientation: 'vertical' | 'horizontal';
  setEqOrientation: Setter<'vertical' | 'horizontal'>;
  eqPickedRefIds: string[];
  setEqPickedRefIds: Setter<string[]>;
  setEqPickMode: Setter<boolean>;
  dimensionDisplayValue: (dimension: FamilyDimension) => number;
  toggleEqPickedRef: (planeId: string) => void;
  removeEqConstraint: (id: string) => void;
  createEqConstraint: () => void;
  createPickedEqConstraint: () => void;
  createDimensionParameter: () => void;
  updateDimensionLabel: (dimensionId: string, paramKey: string) => void;
}

/**
 * §13.x — "Aligned dimensions" subsection of the family editor workbench.
 * Renders the dimension canvas (refPlanes + dimensions + EQ glyphs) plus
 * the dimension creation form and the EQ constraint toolbar.
 */
export function FamilyEditorAlignedDimensionsSection({
  refPlanes,
  dimensions,
  eqConstraints,
  lengthParams,
  dimensionDraft,
  setDimensionDraft,
  eqOrientation,
  setEqOrientation,
  eqPickedRefIds,
  setEqPickedRefIds,
  setEqPickMode,
  dimensionDisplayValue,
  toggleEqPickedRef,
  removeEqConstraint,
  createEqConstraint,
  createPickedEqConstraint,
  createDimensionParameter,
  updateDimensionLabel,
}: FamilyEditorAlignedDimensionsSectionProps): JSX.Element {
  return (
    <section className="rounded border p-3 space-y-2" aria-label="Aligned dimensions">
      <h2 className="font-semibold">Aligned Dimensions</h2>
      <svg
        role="img"
        aria-label="Family dimension canvas"
        data-testid="family-dimension-canvas"
        viewBox="0 0 480 180"
        className="h-44 w-full rounded border border-border bg-surface"
      >
        <line x1="240" y1="0" x2="240" y2="180" stroke="var(--color-border)" />
        <line x1="0" y1="90" x2="480" y2="90" stroke="var(--color-border)" />
        {refPlanes.map((plane) =>
          plane.isVertical ? (
            <line
              key={plane.id}
              data-testid={`dimension-ref-plane-${plane.id}`}
              x1={240 + plane.offsetMm / 5}
              y1="12"
              x2={240 + plane.offsetMm / 5}
              y2="168"
              stroke={
                plane.referenceType === 'not_reference'
                  ? 'var(--color-muted-foreground)'
                  : 'var(--color-accent)'
              }
              strokeDasharray={plane.referenceType === 'strong_reference' ? undefined : '5 4'}
              strokeWidth={eqPickedRefIds.includes(plane.id) ? 3 : 1}
              onClick={() => toggleEqPickedRef(plane.id)}
            />
          ) : (
            <line
              key={plane.id}
              data-testid={`dimension-ref-plane-${plane.id}`}
              x1="12"
              y1={90 - plane.offsetMm / 5}
              x2="468"
              y2={90 - plane.offsetMm / 5}
              stroke={
                plane.referenceType === 'not_reference'
                  ? 'var(--color-muted-foreground)'
                  : 'var(--color-accent)'
              }
              strokeDasharray={plane.referenceType === 'strong_reference' ? undefined : '5 4'}
              strokeWidth={eqPickedRefIds.includes(plane.id) ? 3 : 1}
              onClick={() => toggleEqPickedRef(plane.id)}
            />
          ),
        )}
        {dimensions.map((dimension) => {
          const a = refPlanes.find((plane) => plane.id === dimension.refAId);
          const b = refPlanes.find((plane) => plane.id === dimension.refBId);
          if (!a || !b || a.isVertical !== b.isVertical) return null;
          const label = `${dimension.paramKey} = ${dimensionDisplayValue(dimension)} mm`;
          if (a.isVertical) {
            const x1 = 240 + a.offsetMm / 5;
            const x2 = 240 + b.offsetMm / 5;
            const y = Math.max(16, 90 - dimension.canvasOffsetMm / 5);
            return (
              <g key={dimension.id} data-testid={`family-dimension-canvas-dim-${dimension.id}`}>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke="var(--color-warning)" />
                <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} stroke="var(--color-warning)" />
                <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} stroke="var(--color-warning)" />
                <text x={(x1 + x2) / 2} y={y - 7} textAnchor="middle" fontSize="11">
                  {label}
                </text>
              </g>
            );
          }
          const y1 = 90 - a.offsetMm / 5;
          const y2 = 90 - b.offsetMm / 5;
          const x = Math.min(464, 240 + dimension.canvasOffsetMm / 5);
          return (
            <g key={dimension.id} data-testid={`family-dimension-canvas-dim-${dimension.id}`}>
              <line x1={x} y1={y1} x2={x} y2={y2} stroke="var(--color-warning)" />
              <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} stroke="var(--color-warning)" />
              <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} stroke="var(--color-warning)" />
              <text x={x + 7} y={(y1 + y2) / 2} fontSize="11">
                {label}
              </text>
            </g>
          );
        })}
        {eqConstraints.map((constraint) => {
          const selected = constraint.refPlaneIds
            .map((id) => refPlanes.find((plane) => plane.id === id))
            .filter((plane): plane is RefPlane => Boolean(plane))
            .sort((a, b) => a.offsetMm - b.offsetMm);
          if (selected.length < 2) return null;
          const first = selected[0]!;
          const last = selected[selected.length - 1]!;
          const x =
            constraint.orientation === 'vertical'
              ? 240 + (first.offsetMm + last.offsetMm) / 10
              : 240 + 36;
          const y =
            constraint.orientation === 'vertical' ? 28 : 90 - (first.offsetMm + last.offsetMm) / 10;
          return (
            <g
              key={constraint.id}
              role="button"
              tabIndex={0}
              aria-label={`eq-glyph-${constraint.id}`}
              data-testid={`eq-glyph-${constraint.id}`}
              onDoubleClick={() => removeEqConstraint(constraint.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  removeEqConstraint(constraint.id);
                }
              }}
            >
              <rect
                x={x - 13}
                y={y - 9}
                width="26"
                height="16"
                rx="2"
                fill="var(--color-warning)"
              />
              <text x={x} y={y + 3} textAnchor="middle" fontSize="10">
                EQ
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          aria-label="dimension-reference-a"
          value={dimensionDraft.refAId || refPlanes[0]?.id || ''}
          onChange={(e) => setDimensionDraft((prev) => ({ ...prev, refAId: e.target.value }))}
        >
          <option value="">Reference A</option>
          {refPlanes.map((plane) => (
            <option key={plane.id} value={plane.id}>
              {plane.name} {plane.isVertical ? 'V' : 'H'} {plane.offsetMm}mm
            </option>
          ))}
        </select>
        <select
          aria-label="dimension-reference-b"
          value={dimensionDraft.refBId || refPlanes[1]?.id || ''}
          onChange={(e) => setDimensionDraft((prev) => ({ ...prev, refBId: e.target.value }))}
        >
          <option value="">Reference B</option>
          {refPlanes.map((plane) => (
            <option key={plane.id} value={plane.id}>
              {plane.name} {plane.isVertical ? 'V' : 'H'} {plane.offsetMm}mm
            </option>
          ))}
        </select>
        <select
          aria-label="dimension-label-mode"
          value={dimensionDraft.labelMode}
          onChange={(e) =>
            setDimensionDraft((prev) => ({
              ...prev,
              labelMode: e.target.value as 'existing' | 'new',
            }))
          }
        >
          <option value="new">Create Parameter</option>
          <option value="existing">Existing Parameter</option>
        </select>
        {dimensionDraft.labelMode === 'existing' ? (
          <select
            aria-label="dimension-existing-parameter"
            value={dimensionDraft.paramKey || lengthParams[0]?.key || ''}
            onChange={(e) => setDimensionDraft((prev) => ({ ...prev, paramKey: e.target.value }))}
          >
            <option value="">Label: &lt;None&gt;</option>
            {lengthParams.map((param) => (
              <option key={param.key} value={param.key}>
                {param.label || param.key}
              </option>
            ))}
          </select>
        ) : null}
        <input
          aria-label="dimension-parameter-name"
          value={dimensionDraft.newParamKey}
          placeholder={`dimension_${dimensions.length + 1}`}
          onChange={(e) => setDimensionDraft((prev) => ({ ...prev, newParamKey: e.target.value }))}
          disabled={dimensionDraft.labelMode === 'existing'}
        />
        <button
          type="button"
          onClick={createDimensionParameter}
          disabled={refPlanes.length < 2}
          data-testid="dimension-create-parameter"
        >
          Create Parameter
        </button>
      </div>
      <ul className="space-y-1 text-xs" data-testid="family-dimensions-list">
        {dimensions.map((dimension) => (
          <li key={dimension.id} className="flex flex-wrap items-center gap-2">
            <span>
              {dimension.paramKey}: {dimensionDisplayValue(dimension)} mm
            </span>
            <select
              aria-label={`dimension-label-${dimension.id}`}
              value={dimension.paramKey}
              onChange={(e) => updateDimensionLabel(dimension.id, e.target.value)}
            >
              <option value="">Label: &lt;None&gt;</option>
              {lengthParams.map((param) => (
                <option key={param.key} value={param.key}>
                  {param.label || param.key}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
        <span>EQ</span>
        <select
          aria-label="eq-reference-orientation"
          value={eqOrientation}
          onChange={(e) => setEqOrientation(e.target.value as 'vertical' | 'horizontal')}
        >
          <option value="vertical">Vertical reference planes</option>
          <option value="horizontal">Horizontal reference planes</option>
        </select>
        <button
          type="button"
          onClick={createEqConstraint}
          disabled={
            refPlanes.filter((plane) => plane.isVertical === (eqOrientation === 'vertical'))
              .length < 3
          }
          data-testid="dimension-eq-create"
        >
          Equalize
        </button>
        <button
          type="button"
          onClick={() => {
            setEqPickMode((prev) => !prev);
            setEqPickedRefIds([]);
          }}
          data-testid="dimension-eq-pick-mode"
        >
          Pick EQ refs
        </button>
        <button
          type="button"
          onClick={createPickedEqConstraint}
          disabled={eqPickedRefIds.length < 3}
          data-testid="dimension-eq-create-picked"
        >
          Equalize picked
        </button>
        <span data-testid="dimension-eq-picked-count">{eqPickedRefIds.length} picked</span>
      </div>
      <ul className="space-y-1 text-xs" data-testid="family-eq-constraints-list">
        {eqConstraints.map((constraint) => (
          <li key={constraint.id}>
            EQ {constraint.orientation}: {constraint.refPlaneIds.length} refs · gap{' '}
            {constraint.equalGapMm} mm
          </li>
        ))}
      </ul>
    </section>
  );
}
