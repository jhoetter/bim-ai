import { type JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { planViewGraphicsMatrixRows, viewTemplateGraphicsMatrixRows } from '../plan/planProjection';
import { PlanViewGraphicsMatrix } from './PlanViewGraphicsMatrix';
import {
  SavedViewTagGraphicsAuthoring,
  SavedViewTemplateGraphicsAuthoring,
} from './savedViewTagGraphicsAuthoring';

/**
 * Inspector parameter renderers — spec §13.
 *
 * Read-only field panels per element kind. The Apply / Reset footer is
 * left to the controlling Inspector component (which only shows it when
 * dirty=true). Numeric writes through the engine command pipeline land
 * separately when the redesigned palette gains drawing flow.
 */

interface FieldRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function FieldRow({ label, value, mono }: FieldRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={['text-sm text-foreground', mono ? 'font-mono text-xs' : ''].join(' ')}>
        {value}
      </span>
    </div>
  );
}

function fmtMm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} m`;
  return `${value.toFixed(0)} mm`;
}

export function InspectorPropertiesFor(el: Element): JSX.Element {
  switch (el.kind) {
    case 'wall':
      return (
        <div>
          <FieldRow label="Type" value="Generic — wall" />
          <FieldRow label="Thickness" value={fmtMm(el.thicknessMm)} />
          <FieldRow label="Height" value={fmtMm(el.heightMm)} />
          <FieldRow label="Level" value={el.levelId} mono />
          <FieldRow label="Start" value={`${fmtMm(el.start.xMm)} · ${fmtMm(el.start.yMm)}`} mono />
          <FieldRow label="End" value={`${fmtMm(el.end.xMm)} · ${fmtMm(el.end.yMm)}`} mono />
        </div>
      );
    case 'door':
      return (
        <div>
          <FieldRow label="Family" value={el.familyTypeId ?? 'Generic 900 × 2100'} mono />
          <FieldRow label="Width" value={fmtMm(el.widthMm)} />
          <FieldRow label="Wall" value={el.wallId} mono />
          <FieldRow label="Along T" value={el.alongT.toFixed(3)} mono />
        </div>
      );
    case 'window':
      return (
        <div>
          <FieldRow label="Family" value={el.familyTypeId ?? 'Generic 1200 × 1500'} mono />
          <FieldRow label="Width" value={fmtMm(el.widthMm)} />
          <FieldRow label="Height" value={fmtMm(el.heightMm)} />
          <FieldRow label="Sill height" value={fmtMm(el.sillHeightMm)} />
          <FieldRow label="Wall" value={el.wallId} mono />
        </div>
      );
    case 'floor':
      return (
        <div>
          <FieldRow label="Type" value={el.floorTypeId ?? 'Generic 220 mm slab'} mono />
          <FieldRow label="Thickness" value={fmtMm(el.thicknessMm)} />
          <FieldRow label="Structure thickness" value={fmtMm(el.structureThicknessMm)} />
          <FieldRow label="Finish thickness" value={fmtMm(el.finishThicknessMm)} />
          <FieldRow label="Level" value={el.levelId} mono />
          <FieldRow label="Boundary points" value={String(el.boundaryMm.length)} />
        </div>
      );
    case 'roof':
      return (
        <div>
          <FieldRow label="Type" value={el.roofTypeId ?? 'Generic gable'} mono />
          <FieldRow label="Slope" value={`${(el.slopeDeg ?? 0).toFixed(1)}°`} />
          <FieldRow label="Overhang" value={fmtMm(el.overhangMm)} />
          <FieldRow label="Reference level" value={el.referenceLevelId} mono />
          <FieldRow label="Footprint points" value={String(el.footprintMm.length)} />
        </div>
      );
    case 'stair':
      return (
        <div>
          <FieldRow label="Width" value={fmtMm(el.widthMm)} />
          <FieldRow label="Riser" value={fmtMm(el.riserMm)} />
          <FieldRow label="Tread" value={fmtMm(el.treadMm)} />
          <FieldRow label="Base level" value={el.baseLevelId} mono />
          <FieldRow label="Top level" value={el.topLevelId} mono />
        </div>
      );
    case 'room':
      return (
        <div>
          <FieldRow label="Programme" value={el.programmeCode ?? '—'} />
          <FieldRow label="Department" value={el.department ?? '—'} />
          <FieldRow label="Function" value={el.functionLabel ?? '—'} />
          <FieldRow label="Finish set" value={el.finishSet ?? '—'} />
          <FieldRow label="Level" value={el.levelId} mono />
          <FieldRow label="Outline points" value={String(el.outlineMm.length)} />
        </div>
      );
    case 'level':
      return (
        <div>
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow label="Datum kind" value={el.datumKind ?? '—'} mono />
        </div>
      );
    case 'section_cut':
      return (
        <div>
          <FieldRow
            label="Line start"
            value={`${fmtMm(el.lineStartMm.xMm)} · ${fmtMm(el.lineStartMm.yMm)}`}
            mono
          />
          <FieldRow
            label="Line end"
            value={`${fmtMm(el.lineEndMm.xMm)} · ${fmtMm(el.lineEndMm.yMm)}`}
            mono
          />
          <FieldRow label="Crop depth" value={fmtMm(el.cropDepthMm)} />
        </div>
      );
    default:
      return <p className="text-sm text-muted">No parameters surface for `{el.kind}` yet.</p>;
  }
}

export function InspectorConstraintsFor(el: Element): JSX.Element {
  switch (el.kind) {
    case 'wall':
      return (
        <div>
          <FieldRow label="Wall join" value="Auto" />
          <FieldRow label="Wrap rule" value="Default" />
          <FieldRow label="Room bounding" value="Yes" />
          <FieldRow label="Location line" value="Wall centerline" />
        </div>
      );
    case 'floor':
      return (
        <div>
          <FieldRow label="Room bounding" value={el.roomBounded ? 'Yes' : 'No'} />
          <FieldRow label="Slab top elevation" value="(derived)" />
        </div>
      );
    case 'roof':
      return (
        <div>
          <FieldRow label="Geometry mode" value={el.roofGeometryMode ?? 'mass_box'} mono />
        </div>
      );
    default:
      return <p className="text-sm text-muted">No constraints surface for `{el.kind}` yet.</p>;
  }
}

export function InspectorIdentityFor(el: Element): JSX.Element {
  return (
    <div>
      <FieldRow label="Kind" value={el.kind} mono />
      <FieldRow label="Id" value={el.id} mono />
      <FieldRow label="Name" value={(el as { name?: string }).name ?? '—'} />
      <FieldRow label="Mark" value={(el as { mark?: string }).mark ?? '—'} />
      <FieldRow label="Comments" value={(el as { comments?: string }).comments ?? '—'} />
    </div>
  );
}

export function InspectorGraphicsFor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Element;
  elementsById: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element | null {
  if (el.kind === 'plan_view') {
    const rows = planViewGraphicsMatrixRows(elementsById, el.id);
    return (
      <div className="flex flex-col gap-4">
        <PlanViewGraphicsMatrix rows={rows} />
        <SavedViewTagGraphicsAuthoring
          variant="plan_view"
          selected={el as Extract<Element, { kind: 'plan_view' }>}
          revision={revision}
          elementsById={elementsById}
          onPersistProperty={onPersistProperty}
        />
      </div>
    );
  }
  if (el.kind === 'view_template') {
    const rows = viewTemplateGraphicsMatrixRows(elementsById, el.id);
    return (
      <div className="flex flex-col gap-4">
        <PlanViewGraphicsMatrix
          rows={rows}
          footnote="Template defaults — plan_view overrides these when linked."
        />
        <SavedViewTemplateGraphicsAuthoring
          selected={el as Extract<Element, { kind: 'view_template' }>}
          revision={revision}
          elementsById={elementsById}
          onPersistProperty={onPersistProperty}
        />
      </div>
    );
  }
  return null;
}
