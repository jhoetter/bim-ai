import type { Element } from '@bim-ai/core';

import { angleBetweenVectors } from '../../plan/measureGeometry';
import { FieldRow } from './inspectorRows';

type PropertyChange = (property: string, value: unknown) => void;

type AngularDimensionElement = Extract<Element, { kind: 'angular_dimension' }>;
type RadialDimensionElement = Extract<Element, { kind: 'radial_dimension' | 'diameter_dimension' }>;
type ArcLengthDimensionElement = Extract<Element, { kind: 'arc_length_dimension' }>;
type PermanentDimensionElement = Extract<Element, { kind: 'permanent_dimension' }>;
type ReferencedWitnessPoint = PermanentDimensionElement['witnessPointsMm'][number] & {
  referenceEdge?: string;
  referencedElementId?: string;
};

export function AngularDimensionInspectorSection({
  element,
  onPropertyChange,
}: {
  element: AngularDimensionElement;
  onPropertyChange?: PropertyChange;
}) {
  const rayA = {
    xMm: element.rayAMm.xMm - element.vertexMm.xMm,
    yMm: element.rayAMm.yMm - element.vertexMm.yMm,
  };
  const rayB = {
    xMm: element.rayBMm.xMm - element.vertexMm.xMm,
    yMm: element.rayBMm.yMm - element.vertexMm.yMm,
  };
  const angleDeg = angleBetweenVectors(rayA, rayB);
  const offsetMag = element.offsetMm
    ? Math.hypot(element.offsetMm.xMm, element.offsetMm.yMm).toFixed(0)
    : '0';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
        <span className="text-xs text-muted">Angle</span>
        <span
          className="text-sm text-foreground"
          data-testid="inspector-angular-dim-angle"
        >{`${angleDeg.toFixed(1)}°`}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
        <span className="text-xs text-muted">Offset</span>
        <span
          className="text-sm text-foreground"
          data-testid="inspector-angular-dim-offset"
        >{`${offsetMag} mm`}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
        <span className="text-xs text-muted">Arc Radius</span>
        <span
          className="text-sm text-foreground"
          data-testid="inspector-angular-dim-arc-radius"
        >{`${element.arcRadiusMm ?? 400} mm`}</span>
      </div>
      {onPropertyChange ? (
        <>
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <span className="text-xs font-medium text-muted">Text decoration</span>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted">Prefix</span>
              <input
                type="text"
                className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={element.textPrefix ?? ''}
                key={`${element.id}-prefix`}
                placeholder="e.g. ≈"
                aria-label="Angular dimension text prefix"
                data-testid="inspector-angular-dim-prefix"
                onBlur={(e) => onPropertyChange('textPrefix', e.currentTarget.value || null)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted">Suffix</span>
              <input
                type="text"
                className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={element.textSuffix ?? ''}
                key={`${element.id}-suffix`}
                placeholder="e.g. °"
                aria-label="Angular dimension text suffix"
                data-testid="inspector-angular-dim-suffix"
                onBlur={(e) => onPropertyChange('textSuffix', e.currentTarget.value || null)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted">Override</span>
              <input
                type="text"
                className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={element.textOverride ?? ''}
                key={`${element.id}-override`}
                placeholder="replaces computed angle"
                aria-label="Angular dimension text override"
                data-testid="inspector-angular-dim-override"
                onBlur={(e) => onPropertyChange('textOverride', e.currentTarget.value || null)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <button
              type="button"
              className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:bg-surface/80"
              data-testid="inspector-angular-dim-flip"
              onClick={() =>
                onPropertyChange('offsetMm', {
                  xMm: element.offsetMm?.xMm ?? 0,
                  yMm: -(element.offsetMm?.yMm ?? 0),
                })
              }
            >
              Flip
            </button>
          </div>
        </>
      ) : null}
      {element.autoGenerated ? <FieldRow label="Auto-generated" value="Yes" /> : null}
    </div>
  );
}

export function RadialDimensionInspectorSection({
  element,
  onPropertyChange,
}: {
  element: RadialDimensionElement;
  onPropertyChange?: PropertyChange;
}) {
  const computedRadiusMm = Math.hypot(
    element.arcPointMm.xMm - element.centerMm.xMm,
    element.arcPointMm.yMm - element.centerMm.yMm,
  );
  const displayRadiusMm = element.radiusMm ?? computedRadiusMm;
  const isDiameter = element.kind === 'diameter_dimension';
  const valueTestId = isDiameter ? 'inspector-diameter-dim-value' : 'inspector-radial-dim-value';
  const displayValue = isDiameter ? displayRadiusMm * 2 : displayRadiusMm;

  return (
    <div className="flex flex-col gap-2">
      <FieldRow label="Host View" value={element.hostViewId} mono />
      <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
        <span className="text-xs text-muted">{isDiameter ? 'Diameter' : 'Radius'}</span>
        <span
          className="text-sm text-foreground"
          data-testid={valueTestId}
        >{`${Math.round(displayValue)} mm`}</span>
      </div>
      {onPropertyChange ? (
        <>
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted">Prefix</span>
              <input
                type="text"
                className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={element.textPrefix ?? ''}
                key={`${element.id}-prefix`}
                placeholder={isDiameter ? 'Ø' : 'R'}
                aria-label="Dimension text prefix"
                data-testid="inspector-radial-dim-prefix"
                onBlur={(e) => onPropertyChange('textPrefix', e.currentTarget.value || null)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted">Override</span>
              <input
                type="text"
                className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={element.textOverride ?? ''}
                key={`${element.id}-override`}
                placeholder="replaces computed value"
                aria-label="Dimension text override"
                data-testid="inspector-radial-dim-override"
                onBlur={(e) => onPropertyChange('textOverride', e.currentTarget.value || null)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <button
              type="button"
              className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:bg-surface/80"
              data-testid="inspector-radial-dim-flip"
              onClick={() => onPropertyChange('flipped', !element.flipped)}
            >
              Flip
            </button>
          </div>
        </>
      ) : null}
      {element.autoGenerated ? <FieldRow label="Auto-generated" value="Yes" /> : null}
    </div>
  );
}

export function ArcLengthDimensionInspectorSection({
  element,
}: {
  element: ArcLengthDimensionElement;
}) {
  const arcAngleDeg = Math.abs(element.endAngleDeg - element.startAngleDeg);
  const arcLengthMm = (arcAngleDeg / 360) * 2 * Math.PI * element.radiusMm;
  return (
    <div className="flex flex-col gap-2">
      <FieldRow label="Host View" value={element.hostViewId} mono />
      <FieldRow label="Radius" value={`${Math.round(element.radiusMm)} mm`} mono />
      <FieldRow label="Arc Angle" value={`${arcAngleDeg.toFixed(1)}°`} mono />
      <FieldRow label="Arc Length" value={`${Math.round(arcLengthMm)} mm`} mono />
      {element.autoGenerated ? <FieldRow label="Auto-generated" value="Yes" /> : null}
    </div>
  );
}

export function PermanentDimensionInspectorSection({
  element,
  onPropertyChange,
}: {
  element: PermanentDimensionElement;
  onPropertyChange?: PropertyChange;
}) {
  const offsetMag = Math.round(Math.hypot(element.offsetMm.xMm, element.offsetMm.yMm));
  const referencedWitnessPoints = (element.witnessPointsMm as ReferencedWitnessPoint[]).filter(
    (pt) => pt.referencedElementId,
  );

  return (
    <div className="flex flex-col gap-2">
      <FieldRow label="Segments" value={String(element.witnessPointsMm.length - 1)} />
      <FieldRow label="Level" value={element.levelId} mono />
      <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
        <span className="text-xs text-muted">Offset</span>
        <span
          className="text-sm text-foreground"
          data-testid="inspector-dim-offset"
        >{`${offsetMag} mm from chain`}</span>
      </div>
      {onPropertyChange ? (
        <div className="flex items-center gap-2 py-0.5">
          <button
            type="button"
            className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:bg-surface/80"
            data-testid="inspector-permanent-dimension-eq"
            onClick={() => onPropertyChange('eqEnabled', !element.eqEnabled)}
          >
            {element.eqEnabled ? 'EQ On' : 'EQ Off'}
          </button>
          <button
            type="button"
            className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:bg-surface/80"
            data-testid="inspector-dim-flip"
            onClick={() => onPropertyChange('flipped', !element.flipped)}
          >
            Flip
          </button>
        </div>
      ) : (
        <FieldRow label="EQ" value={element.eqEnabled ? 'On' : 'Off'} />
      )}
      {referencedWitnessPoints.length > 0 ? (
        <details style={{ marginTop: 8 }}>
          <summary
            data-testid="inspector-dim-references-summary"
            style={{ cursor: 'pointer', fontSize: 12 }}
          >
            Element References ({referencedWitnessPoints.length})
          </summary>
          <div style={{ marginTop: 4 }}>
            {referencedWitnessPoints.map((pt, i) => (
              <div
                key={i}
                data-testid={`inspector-dim-ref-${i}`}
                className="py-0.5 text-[11px] text-muted"
              >
                Pt {i + 1}: {pt.referencedElementId?.slice(-8)} ({pt.referenceEdge ?? 'auto'})
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
