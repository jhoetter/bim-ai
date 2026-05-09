import { useState, type JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { DisciplineTag, Element } from '@bim-ai/core';

import { BUILT_IN_FAMILIES, getFamilyById, getTypeById } from '../families/familyCatalog';

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

/**
 * FED-03: render Copy/Monitor inspector rows for an element that may carry
 * either the legacy `monitorSourceId` string or the structured
 * `monitorSource` object. Includes Reconcile buttons (Accept source / Keep
 * host) when the source has drifted; both buttons fire engine commands via
 * `onMonitorReconcile` if supplied.
 */
function MonitorSourceRows({
  el,
  elementsById,
  t,
  onMonitorReconcile,
}: {
  el: Extract<Element, { kind: 'level' } | { kind: 'grid_line' }>;
  elementsById: Record<string, Element>;
  t: TFunction;
  onMonitorReconcile?: (elementId: string, mode: 'accept_source' | 'keep_host') => void;
}): JSX.Element | null {
  const f = (key: string) => t(`inspector.fields.${key}`);
  const ms = el.monitorSource ?? null;
  const legacy = !ms && el.monitorSourceId ? { elementId: el.monitorSourceId } : null;
  if (!ms && !legacy) return null;

  const elementId = ms?.elementId ?? legacy?.elementId ?? '—';
  const linkId = ms?.linkId ?? null;
  const linkLabel = (() => {
    if (!linkId) return '';
    const link = elementsById[linkId];
    if (link && link.kind === 'link_model') return link.name || link.id;
    return linkId;
  })();
  const revisionAtCopy = ms?.sourceRevisionAtCopy ?? null;
  const drifted = Boolean(ms?.drifted);
  const driftedFields = ms?.driftedFields ?? [];
  const headerValue = linkLabel
    ? `${linkLabel} / ${elementId}${revisionAtCopy != null ? ` @r${revisionAtCopy}` : ''}`
    : `${elementId}${revisionAtCopy != null ? ` @r${revisionAtCopy}` : ''}`;

  return (
    <>
      <FieldRow label={f('monitorSource')} value={headerValue} mono />
      {drifted ? (
        <div
          className="flex flex-col gap-1 border-b border-border py-1.5"
          data-testid="monitor-drift-banner"
        >
          <div className="flex items-center gap-2 text-[11px] text-amber-700">
            <span aria-hidden>⚠</span>
            <span>
              {t('inspector.monitorDriftBanner', {
                fields: driftedFields.join(', ') || '—',
              })}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
              onClick={() => onMonitorReconcile?.(el.id, 'accept_source')}
            >
              {t('inspector.acceptSource')}
            </button>
            <button
              type="button"
              className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
              onClick={() => onMonitorReconcile?.(el.id, 'keep_host')}
            >
              {t('inspector.keepHost')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * DSC-V3-01 — reusable discipline tag picker row.
 *
 * Renders a labelled `<select>` with arch / struct / mep options plus a
 * "Default for kind" sentinel (value=""). Fires `onChange` with the new
 * value on every change (null when "Default for kind" is selected); the
 * caller is responsible for forwarding the value to the engine command
 * `setElementDiscipline`. A null discipline in the engine resolves to
 * DEFAULT_DISCIPLINE_BY_KIND[element.kind].
 */
export function InspectorDisciplineDropdown({
  value,
  onChange,
}: {
  value: DisciplineTag | null | undefined;
  onChange: (discipline: DisciplineTag | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-muted w-28 shrink-0">
        {t('inspector.fields.discipline', 'Discipline')}
      </span>
      <select
        className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : (v as DisciplineTag));
        }}
      >
        <option value="">{t('discipline.default', 'Default for kind')}</option>
        <option value="arch">{t('discipline.arch', 'Architecture')}</option>
        <option value="struct">{t('discipline.struct', 'Structure')}</option>
        <option value="mep">{t('discipline.mep', 'MEP')}</option>
      </select>
    </div>
  );
}

export function InspectorPropertiesFor(
  el: Element,
  t: TFunction,
  options?: {
    elementsById?: Record<string, Element>;
    onPropertyChange?: (property: string, value: unknown) => void;
    onMonitorReconcile?: (elementId: string, mode: 'accept_source' | 'keep_host') => void;
    onDisciplineChange?: (discipline: DisciplineTag | null) => void;
  },
): JSX.Element {
  const elementsById = options?.elementsById ?? {};
  const onMonitorReconcile = options?.onMonitorReconcile;
  const onDisciplineChange = options?.onDisciplineChange;
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
    case 'wall': {
      const { elementsById = {}, onPropertyChange } = options ?? {};
      const roofs = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'roof' }> => e.kind === 'roof',
      );
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('thickness')} value={fmtMm(el.thicknessMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label={f('level')} value={el.levelId} mono />

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('roofAttachment')}</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.roofAttachmentId ?? ''}
              onChange={(e2) => onPropertyChange?.('roofAttachmentId', e2.target.value || null)}
            >
              <option value="">— None —</option>
              {roofs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name ?? r.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('curtainWall')}</span>
            <input
              type="checkbox"
              checked={el.isCurtainWall ?? false}
              onChange={(e2) => onPropertyChange?.('isCurtainWall', e2.target.checked)}
              className="accent-primary"
            />
          </div>

          {el.isCurtainWall && (
            <>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">{f('cwVCount')}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="w-16 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={el.curtainWallVCount ?? ''}
                  placeholder="auto"
                  onChange={(e2) =>
                    onPropertyChange?.(
                      'curtainWallVCount',
                      e2.target.value === '' ? null : Number(e2.target.value),
                    )
                  }
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">{f('cwHCount')}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="w-16 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={el.curtainWallHCount ?? ''}
                  placeholder="auto"
                  onChange={(e2) =>
                    onPropertyChange?.(
                      'curtainWallHCount',
                      e2.target.value === '' ? null : Number(e2.target.value),
                    )
                  }
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('wallType')}</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.wallTypeId ?? ''}
              onChange={(e2) => onPropertyChange?.('wallTypeId', e2.target.value || null)}
            >
              <option value="">— None —</option>
              {Object.values(elementsById)
                .filter((e): e is Extract<Element, { kind: 'wall_type' }> => e.kind === 'wall_type')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
        </div>
      );
    }
    case 'door':
      return (
        <div>
          <FieldRow label={f('family')} value={el.familyTypeId ?? 'Generic 900 × 2100'} mono />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('wall')} value={el.wallId} mono />
          <FieldRow label={f('alongT')} value={el.alongT.toFixed(3)} mono />
        </div>
      );
    case 'window':
      return (
        <div>
          <FieldRow label={f('family')} value={el.familyTypeId ?? 'Generic 1200 × 1500'} mono />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label={f('sillHeight')} value={fmtMm(el.sillHeightMm)} />
          <FieldRow label={f('wall')} value={el.wallId} mono />
        </div>
      );
    case 'floor': {
      const { elementsById: floorElementsById = {}, onPropertyChange: floorOnPropertyChange } =
        options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('thickness')} value={fmtMm(el.thicknessMm)} />
          <FieldRow label={f('structureThickness')} value={fmtMm(el.structureThicknessMm)} />
          <FieldRow label={f('finishThickness')} value={fmtMm(el.finishThicknessMm)} />
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('boundaryPoints')} value={String(el.boundaryMm.length)} />

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('floorType')}</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.floorTypeId ?? ''}
              onChange={(e2) => floorOnPropertyChange?.('floorTypeId', e2.target.value || null)}
            >
              <option value="">— None —</option>
              {Object.values(floorElementsById)
                .filter(
                  (e): e is Extract<Element, { kind: 'floor_type' }> => e.kind === 'floor_type',
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
        </div>
      );
    }
    case 'roof': {
      const { elementsById: roofElementsById = {}, onPropertyChange: roofOnPropertyChange } =
        options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('slope')} value={`${(el.slopeDeg ?? 0).toFixed(1)}°`} />
          <FieldRow label={f('overhang')} value={fmtMm(el.overhangMm)} />
          <FieldRow label={f('referenceLevel')} value={el.referenceLevelId} mono />
          <FieldRow label={f('footprintPoints')} value={String(el.footprintMm.length)} />

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('roofType')}</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.roofTypeId ?? ''}
              onChange={(e2) => roofOnPropertyChange?.('roofTypeId', e2.target.value || null)}
            >
              <option value="">— None —</option>
              {Object.values(roofElementsById)
                .filter((e): e is Extract<Element, { kind: 'roof_type' }> => e.kind === 'roof_type')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
        </div>
      );
    }
    case 'stair':
      return (
        <div>
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('riser')} value={fmtMm(el.riserMm)} />
          <FieldRow label={f('tread')} value={fmtMm(el.treadMm)} />
          <FieldRow label={f('baseLevel')} value={el.baseLevelId} mono />
          <FieldRow label={f('topLevel')} value={el.topLevelId} mono />
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
        </div>
      );
    case 'room':
      return (
        <div>
          <FieldRow label={f('programme')} value={el.programmeCode ?? '—'} />
          <FieldRow label={f('department')} value={el.department ?? '—'} />
          <FieldRow label={f('function')} value={el.functionLabel ?? '—'} />
          <FieldRow label={f('finishSet')} value={el.finishSet ?? '—'} />
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
          {el.upperLimitLevelId ? (
            <FieldRow label={f('upperLimit')} value={el.upperLimitLevelId} mono />
          ) : null}
          {el.volumeM3 != null ? (
            <FieldRow label={f('volume')} value={`${el.volumeM3.toFixed(3)} m³`} />
          ) : null}
        </div>
      );
    case 'level':
      return (
        <div>
          <FieldRow label={f('elevation')} value={fmtMm(el.elevationMm)} />
          <FieldRow label={f('datumKind')} value={el.datumKind ?? '—'} mono />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          <MonitorSourceRows
            el={el}
            elementsById={elementsById}
            t={t}
            onMonitorReconcile={onMonitorReconcile}
          />
        </div>
      );
    case 'section_cut':
      return (
        <div>
          <FieldRow
            label={f('lineStart')}
            value={`${fmtMm(el.lineStartMm.xMm)} · ${fmtMm(el.lineStartMm.yMm)}`}
            mono
          />
          <FieldRow
            label={f('lineEnd')}
            value={`${fmtMm(el.lineEndMm.xMm)} · ${fmtMm(el.lineEndMm.yMm)}`}
            mono
          />
          <FieldRow label={f('cropDepth')} value={fmtMm(el.cropDepthMm)} />
        </div>
      );
    case 'plan_view':
      return (
        <div>
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('presentation')} value={el.planPresentation ?? 'default'} />
          {el.viewTemplateId ? (
            <FieldRow label={f('template')} value={el.viewTemplateId} mono />
          ) : null}
          {el.underlayLevelId ? (
            <FieldRow label={f('underlay')} value={el.underlayLevelId} mono />
          ) : null}
        </div>
      );
    case 'viewpoint':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('id')} value={el.id} mono />
        </div>
      );
    case 'view_template':
      return (
        <div>
          <FieldRow label={f('scale')} value={el.scale != null ? String(el.scale) : ''} mono />
          {el.planDetailLevel ? (
            <FieldRow label={f('detailLevel')} value={el.planDetailLevel} />
          ) : null}
        </div>
      );
    case 'shared_param_file':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('paramGroups')} value={String(el.groups.length)} />
        </div>
      );
    case 'project_param':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('paramGuid')} value={el.sharedParamGuid} mono />
          <FieldRow label={f('paramCategories')} value={el.categories.join(', ') || '—'} />
          <FieldRow label={f('instanceOrType')} value={el.instanceOrType} />
        </div>
      );
    case 'color_fill_legend':
      return (
        <div>
          <FieldRow label={f('colorFillLegend')} value={el.planViewId} mono />
          <FieldRow label={f('schemeField')} value={el.schemeField} />
        </div>
      );
    case 'grid_line':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          <MonitorSourceRows
            el={el}
            elementsById={elementsById}
            t={t}
            onMonitorReconcile={onMonitorReconcile}
          />
        </div>
      );
    case 'project_settings':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name ?? '—'} />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {el.startingViewId ? (
            <FieldRow label={f('startingView')} value={el.startingViewId} mono />
          ) : null}
        </div>
      );
    case 'selection_set':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('ruleCount')} value={String(el.filterRules.length)} />
        </div>
      );
    case 'clash_test':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('toleranceMm')} value={`${el.toleranceMm} mm`} />
          <FieldRow label={f('clashResults')} value={String(el.results?.length ?? 0)} />
        </div>
      );
    default:
      return <p className="text-sm text-muted">{t('inspector.noParams', { kind: el.kind })}</p>;
  }
}

export function InspectorConstraintsFor(el: Element, t: TFunction): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
    case 'wall':
      return (
        <div>
          <FieldRow label={f('wallJoin')} value="Auto" />
          <FieldRow label={f('wrapRule')} value="Default" />
          <FieldRow label={f('roomBounding')} value="Yes" />
          <FieldRow label={f('locationLine')} value="Wall centerline" />
        </div>
      );
    case 'floor':
      return (
        <div>
          <FieldRow label={f('roomBounding')} value={el.roomBounded ? 'Yes' : 'No'} />
          <FieldRow label={f('slabTopElevation')} value="(derived)" />
        </div>
      );
    case 'roof':
      return (
        <div>
          <FieldRow label={f('geometryMode')} value={el.roofGeometryMode ?? 'mass_box'} mono />
        </div>
      );
    default:
      return (
        <p className="text-sm text-muted">{t('inspector.noConstraints', { kind: el.kind })}</p>
      );
  }
}

export function InspectorIdentityFor(el: Element, t: TFunction): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  return (
    <div>
      <FieldRow label={f('kind')} value={el.kind} mono />
      <FieldRow label={f('id')} value={el.id} mono />
      <FieldRow label={f('name')} value={(el as { name?: string }).name ?? '—'} />
      <FieldRow label={f('mark')} value={(el as { mark?: string }).mark ?? '—'} />
      <FieldRow label={f('comments')} value={(el as { comments?: string }).comments ?? '—'} />
    </div>
  );
}

/**
 * VIE-07: pin / unpin toggle exposed in the Inspector header. Renders nothing
 * for element kinds that don't carry a `pinned` field, so it's safe to drop in
 * unconditionally on any selected element.
 */
export function InspectorPinToggle({
  el,
  onPin,
  onUnpin,
}: {
  el: Element;
  onPin: (elementId: string) => void;
  onUnpin: (elementId: string) => void;
}): JSX.Element | null {
  const pinned = (el as { pinned?: boolean }).pinned ?? false;
  // The 'pinned' marker is optional on the union; treat its presence (even
  // when false) as "this kind supports pinning". Since TypeScript widens the
  // union at runtime, gate on a known set of pinnable kinds.
  const PINNABLE = new Set<string>([
    'wall',
    'door',
    'window',
    'level',
    'grid_line',
    'room',
    'floor',
    'roof',
    'stair',
    'slab_opening',
    'railing',
    'balcony',
    'dimension',
    'room_separation',
    'section_cut',
  ]);
  if (!PINNABLE.has(el.kind)) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pinned}
      data-pin-toggle="1"
      data-pinned={pinned ? '1' : '0'}
      onClick={() => (pinned ? onUnpin(el.id) : onPin(el.id))}
      className={[
        'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs',
        pinned ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-border text-muted',
      ].join(' ')}
      title={pinned ? 'Unpin (UP)' : 'Pin (UP)'}
    >
      <span aria-hidden>📌</span>
      <span>{pinned ? 'Pinned' : 'Pin'}</span>
    </button>
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

const INPUT_CLS =
  'mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]';
const LABEL_CLS = 'block text-[10px] text-muted';

/** Editable inspector for plan_view elements (Properties tab). */
export function InspectorPlanViewEditor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'plan_view' }>;
  elementsById: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const levels = (Object.values(elementsById) as Element[]).filter(
    (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
  );
  const templates = (Object.values(elementsById) as Element[]).filter(
    (e): e is Extract<Element, { kind: 'view_template' }> => e.kind === 'view_template',
  );

  const { t } = useTranslation();
  const pv = (key: string) => t(`inspector.planView.${key}`);

  const [cropDraft, setCropDraft] = useState({
    minX: el.cropMinMm ? String(el.cropMinMm.xMm) : '',
    minY: el.cropMinMm ? String(el.cropMinMm.yMm) : '',
    maxX: el.cropMaxMm ? String(el.cropMaxMm.xMm) : '',
    maxY: el.cropMaxMm ? String(el.cropMaxMm.yMm) : '',
  });

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {pv('namePlaceholder')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`pv-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>

      <label className={LABEL_CLS}>
        {pv('planPresentation')}
        <select
          className={INPUT_CLS}
          value={el.planPresentation ?? 'default'}
          onChange={(e) => onPersistProperty('planPresentation', e.target.value)}
        >
          <option value="default">{pv('neutralPresentation')}</option>
          <option value="opening_focus">{pv('openingFocus')}</option>
          <option value="room_scheme">{pv('roomScheme')}</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        {pv('underlayLevel')}
        <select
          className={INPUT_CLS}
          value={
            el.underlayLevelId && levels.some((l) => l.id === el.underlayLevelId)
              ? el.underlayLevelId
              : ''
          }
          onChange={(e) => onPersistProperty('underlayLevelId', e.target.value)}
        >
          <option value="">{pv('none')}</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      {templates.length > 0 ? (
        <>
          <label className={LABEL_CLS}>
            {pv('viewTemplateLink')}
            <select
              className={INPUT_CLS}
              value={
                el.viewTemplateId && templates.some((tmpl) => tmpl.id === el.viewTemplateId)
                  ? el.viewTemplateId
                  : ''
              }
              onChange={(e) => onPersistProperty('viewTemplateId', e.target.value)}
            >
              <option value="">{pv('none')}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLS}>
            {pv('applyTemplate')}
            <select
              className={INPUT_CLS}
              value=""
              onChange={(e) => {
                const tid = e.target.value;
                if (!tid) return;
                onPersistProperty(
                  '__applyTemplate__',
                  JSON.stringify({ planViewId: el.id, templateId: tid }),
                );
              }}
            >
              <option value="">{pv('selectToApply')}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <div className="border-t border-border pt-2 space-y-2">
        <div className="font-semibold text-muted">{pv('crop')}</div>
        <div className="grid grid-cols-2 gap-2">
          {(['minX', 'minY', 'maxX', 'maxY'] as const).map((k) => (
            <label key={k} className={LABEL_CLS}>
              {k}
              <input
                className={INPUT_CLS}
                value={cropDraft[k]}
                onChange={(e) => setCropDraft((d) => ({ ...d, [k]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-[10px] hover:bg-surface-strong"
            onClick={() => {
              const nx = Number(cropDraft.minX),
                ny = Number(cropDraft.minY);
              const xx = Number(cropDraft.maxX),
                xy = Number(cropDraft.maxY);
              if (![nx, ny, xx, xy].every(Number.isFinite)) return;
              onPersistProperty('cropMinMm', JSON.stringify({ xMm: nx, yMm: ny }));
              onPersistProperty('cropMaxMm', JSON.stringify({ xMm: xx, yMm: xy }));
            }}
          >
            {pv('applyCrop')}
          </button>
          <button
            type="button"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-[10px] hover:bg-surface-strong"
            onClick={() => {
              onPersistProperty('cropMinMm', '');
              onPersistProperty('cropMaxMm', '');
              setCropDraft({ minX: '', minY: '', maxX: '', maxY: '' });
            }}
          >
            {pv('clearCrop')}
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-2 space-y-2">
        <div className="font-semibold text-muted">{pv('viewRange')}</div>
        {(
          [
            { key: 'viewRangeBottomMm', label: pv('rangeBottom'), val: el.viewRangeBottomMm },
            { key: 'viewRangeTopMm', label: pv('rangeTop'), val: el.viewRangeTopMm },
            { key: 'cutPlaneOffsetMm', label: pv('cutPlaneOffset'), val: el.cutPlaneOffsetMm },
          ] as { key: string; label: string; val: number | null | undefined }[]
        ).map(({ key, label, val }) => (
          <label key={key} className={LABEL_CLS}>
            {label}
            <input
              className={INPUT_CLS}
              defaultValue={val == null ? '' : String(val)}
              key={`${key}-${el.id}-${val ?? 'null'}-${revision}`}
              placeholder={pv('emptyClearsPlaceholder')}
              inputMode="decimal"
              onBlur={(e) => onPersistProperty(key, e.target.value.trim())}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Editable inspector for room elements (Properties tab). */
export function InspectorRoomEditor({
  el,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'room' }>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const r = (key: string) => t(`inspector.room.${key}`);
  const fields: {
    key: string;
    label: string;
    val: string | null | undefined;
    inputMode?: string;
  }[] = [
    { key: 'name', label: f('name'), val: el.name },
    { key: 'programmeCode', label: r('programmeCode'), val: el.programmeCode },
    { key: 'department', label: f('department'), val: el.department },
    { key: 'functionLabel', label: r('functionLabel'), val: el.functionLabel },
    { key: 'finishSet', label: f('finishSet'), val: el.finishSet },
  ];

  return (
    <div className="space-y-2 text-[11px]">
      {fields.map(({ key, label, val }) => (
        <label key={key} className={LABEL_CLS}>
          {label}
          <input
            className={INPUT_CLS}
            defaultValue={val ?? ''}
            key={`rm-${key}-${el.id}-${val ?? ''}-${revision}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (key === 'name' && (!v || v === val)) return;
              onPersistProperty(key, v);
            }}
          />
        </label>
      ))}
      <label className={LABEL_CLS}>
        {r('targetArea')}
        <input
          className={INPUT_CLS}
          defaultValue={el.targetAreaM2 == null ? '' : String(el.targetAreaM2)}
          key={`rm-tgt-${el.id}-${el.targetAreaM2 ?? 'x'}-${revision}`}
          placeholder={r('optional')}
          inputMode="decimal"
          onBlur={(e) => onPersistProperty('targetAreaM2', e.target.value.trim())}
        />
      </label>
      <FieldRow label={f('level')} value={el.levelId} mono />
      <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
    </div>
  );
}

/** Editable name field for viewpoint elements (Properties tab). */
export function InspectorViewpointEditor({
  el,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'viewpoint' }>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] text-muted">{t('inspector.viewpoint.hint')}</p>
      <label className={LABEL_CLS}>
        {t('inspector.fields.name')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`vp-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>
    </div>
  );
}

type CustomFamilyTypeElem = Extract<Element, { kind: 'family_type' }>;

function CustomTypeForm({
  discipline,
  onSave,
  onCancel,
}: {
  discipline: 'door' | 'window';
  onSave: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onCancel: () => void;
}): JSX.Element {
  const families = BUILT_IN_FAMILIES.filter((f) => f.discipline === discipline);
  const [baseFamilyId, setBaseFamilyId] = useState(families[0]?.id ?? '');
  const [name, setName] = useState('');
  const [paramDraft, setParamDraft] = useState<Record<string, string>>({});

  const baseFam = getFamilyById(baseFamilyId);
  const lengthParams = baseFam?.params.filter((p) => p.type === 'length_mm') ?? [];

  function handleSave(): void {
    const params: Record<string, unknown> = { name: name.trim(), baseFamilyId };
    for (const p of lengthParams) {
      const raw = paramDraft[p.key];
      const val = raw !== undefined ? Number(raw) : (p.default as number);
      if (Number.isFinite(val)) params[p.key] = val;
    }
    onSave(baseFamilyId, name.trim(), params);
  }

  return (
    <div className="mt-1 space-y-1.5 rounded border border-border bg-background p-2">
      <label className={LABEL_CLS}>
        Base family
        <select
          className={INPUT_CLS}
          value={baseFamilyId}
          onChange={(e) => {
            setBaseFamilyId(e.target.value);
            setParamDraft({});
          }}
        >
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL_CLS}>
        Type name
        <input
          className={INPUT_CLS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Wide fire door"
          autoFocus
        />
      </label>
      {lengthParams.map((p) => (
        <label key={p.key} className={LABEL_CLS}>
          {p.label} (mm)
          <input
            className={INPUT_CLS}
            type="number"
            value={paramDraft[p.key] ?? String(p.default as number)}
            onChange={(e) => setParamDraft((d) => ({ ...d, [p.key]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          disabled={!name.trim()}
          onClick={handleSave}
          className="flex-1 rounded border border-border bg-surface-strong px-2 py-0.5 text-[10px] hover:bg-accent-soft disabled:opacity-40"
        >
          Save type
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-surface-strong"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Editable family type picker for door elements (Properties tab). */
export function InspectorDoorEditor({
  el,
  revision,
  elementsById = {},
  onPersistProperty,
  onCreateType,
  onDisciplineChange,
}: {
  el: Extract<Element, { kind: 'door' }>;
  revision: number;
  elementsById?: Record<string, Element>;
  onPersistProperty: (key: string, value: string) => void;
  onCreateType?: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onDisciplineChange?: (discipline: DisciplineTag | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const [showForm, setShowForm] = useState(false);
  const doorFamilies = BUILT_IN_FAMILIES.filter((fam) => fam.discipline === 'door');
  const customTypes = (Object.values(elementsById) as Element[]).filter(
    (e): e is CustomFamilyTypeElem => e.kind === 'family_type' && e.discipline === 'door',
  );

  // resolve display name: built-in types use catalog name; custom types use parameters.name
  function typeLabel(id: string): string {
    const builtin = getTypeById(id);
    if (builtin) return builtin.name;
    const custom = elementsById[id] as CustomFamilyTypeElem | undefined;
    return String(custom?.parameters.name ?? id);
  }
  void typeLabel; // used via select option text directly

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {f('family')}
        <select
          className={INPUT_CLS}
          value={el.familyTypeId ?? ''}
          key={`door-ft-${el.id}-${el.familyTypeId ?? ''}-${revision}`}
          onChange={(e) => onPersistProperty('familyTypeId', e.target.value)}
        >
          <option value="">Generic</option>
          {doorFamilies.map((fam) => (
            <optgroup key={fam.id} label={fam.name}>
              {fam.defaultTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </optgroup>
          ))}
          {customTypes.length > 0 && (
            <optgroup label="Custom">
              {customTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {String(ct.parameters.name ?? ct.id)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {onCreateType && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-[10px] text-accent hover:underline"
        >
          + New custom type…
        </button>
      )}
      {onCreateType && showForm && (
        <CustomTypeForm
          discipline="door"
          onSave={(baseFamilyId, name, params) => {
            onCreateType(baseFamilyId, name, params);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
      <FieldRow label={f('wall')} value={el.wallId} mono />
      <FieldRow label={f('alongT')} value={el.alongT.toFixed(3)} mono />
      {onDisciplineChange ? (
        <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
      ) : null}
    </div>
  );
}

/** Editable family type picker for window elements (Properties tab). */
export function InspectorWindowEditor({
  el,
  revision,
  elementsById = {},
  onPersistProperty,
  onCreateType,
  onDisciplineChange,
}: {
  el: Extract<Element, { kind: 'window' }>;
  revision: number;
  elementsById?: Record<string, Element>;
  onPersistProperty: (key: string, value: string) => void;
  onCreateType?: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onDisciplineChange?: (discipline: DisciplineTag | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const [showForm, setShowForm] = useState(false);
  const windowFamilies = BUILT_IN_FAMILIES.filter((fam) => fam.discipline === 'window');
  const customTypes = (Object.values(elementsById) as Element[]).filter(
    (e): e is CustomFamilyTypeElem => e.kind === 'family_type' && e.discipline === 'window',
  );

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {f('family')}
        <select
          className={INPUT_CLS}
          value={el.familyTypeId ?? ''}
          key={`win-ft-${el.id}-${el.familyTypeId ?? ''}-${revision}`}
          onChange={(e) => onPersistProperty('familyTypeId', e.target.value)}
        >
          <option value="">Generic</option>
          {windowFamilies.map((fam) => (
            <optgroup key={fam.id} label={fam.name}>
              {fam.defaultTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </optgroup>
          ))}
          {customTypes.length > 0 && (
            <optgroup label="Custom">
              {customTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {String(ct.parameters.name ?? ct.id)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {onCreateType && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-[10px] text-accent hover:underline"
        >
          + New custom type…
        </button>
      )}
      {onCreateType && showForm && (
        <CustomTypeForm
          discipline="window"
          onSave={(baseFamilyId, name, params) => {
            onCreateType(baseFamilyId, name, params);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
      <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
      <FieldRow label={f('sillHeight')} value={fmtMm(el.sillHeightMm)} />
      <FieldRow label={f('wall')} value={el.wallId} mono />
      {onDisciplineChange ? (
        <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
      ) : null}
    </div>
  );
}

/** Editable inspector for view_template elements (Properties tab).
 *
 * VIS-V3-09: replaces the standalone ViewTemplateEditPanel floating card.
 * name is persisted via updateElementProperty; scale/detailLevel/phase/phaseFilter
 * are persisted via the __updateViewTemplate__ sentinel key which WorkspaceRightRail
 * routes to the UpdateViewTemplate engine command (same propagation path).
 */
export function InspectorViewTemplateEditor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'view_template' }>;
  elementsById?: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();

  const phases = elementsById
    ? (Object.values(elementsById) as Element[]).filter(
        (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
      )
    : [];

  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] font-semibold text-muted">{t('inspector.viewTemplate.heading')}</p>

      <label className={LABEL_CLS}>
        {t('inspector.fields.name')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`vt-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>

      <label className={LABEL_CLS}>
        {t('inspector.fields.scale')}
        <input
          type="number"
          className={INPUT_CLS}
          defaultValue={el.scale != null ? String(el.scale) : ''}
          key={`vt-scale-${el.id}-${el.scale ?? 'null'}-${revision}`}
          placeholder="inherit"
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const n = raw === '' ? null : Number(raw);
            if (n !== null && !Number.isFinite(n)) return;
            onPersistProperty(
              '__updateViewTemplate__',
              JSON.stringify({ scale: n }),
            );
          }}
        />
      </label>

      <label className={LABEL_CLS}>
        {t('inspector.fields.detailLevel', 'Detail level')}
        <select
          className={INPUT_CLS}
          value={el.detailLevel ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onPersistProperty(
              '__updateViewTemplate__',
              JSON.stringify({ detailLevel: v || null }),
            );
          }}
        >
          <option value="">— inherit —</option>
          <option value="coarse">Coarse</option>
          <option value="medium">Medium</option>
          <option value="fine">Fine</option>
        </select>
      </label>

      {phases.length > 0 ? (
        <label className={LABEL_CLS}>
          {t('inspector.fields.phase', 'Phase')}
          <select
            className={INPUT_CLS}
            value={el.phase ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onPersistProperty(
                '__updateViewTemplate__',
                JSON.stringify({ phase: v || null }),
              );
            }}
          >
            <option value="">— none —</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className={LABEL_CLS}>
        {t('inspector.fields.phaseFilter', 'Phase filter')}
        <select
          className={INPUT_CLS}
          value={el.phaseFilter ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onPersistProperty(
              '__updateViewTemplate__',
              JSON.stringify({ phaseFilter: v || null }),
            );
          }}
        >
          <option value="">— none —</option>
          <option value="all">All</option>
          <option value="existing">Existing</option>
          <option value="demolition">Demolition</option>
          <option value="new">New</option>
        </select>
      </label>
    </div>
  );
}

export function InspectorPlanRegionEditor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'plan_region' }>;
  elementsById: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const level = elementsById[el.levelId];
  const levelName = level && 'name' in level ? String(level.name) : el.levelId;
  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] font-semibold text-muted">Plan Region</p>
      <label className={LABEL_CLS}>
        {t('inspector.fields.name')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`pr-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>
      <label className={LABEL_CLS}>
        Cut-plane height (mm)
        <input
          className={INPUT_CLS}
          type="number"
          defaultValue={el.cutPlaneOffsetMm ?? -500}
          key={`pr-cut-${el.id}-${el.cutPlaneOffsetMm}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) return;
            onPersistProperty('cutPlaneOffsetMm', v);
          }}
        />
      </label>
      <FieldRow label="Parent level" value={levelName} />
    </div>
  );
}
