import { useState, type JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { DisciplineTag, Element, ViewTemplateControlledField } from '@bim-ai/core';

import { BUILT_IN_FAMILIES, getFamilyById, getTypeById } from '../../families/familyCatalog';
import {
  coerceCheckpointRetentionLimit,
  DEFAULT_CHECKPOINT_RETENTION_LIMIT,
  MAX_CHECKPOINT_RETENTION_LIMIT,
  MIN_CHECKPOINT_RETENTION_LIMIT,
} from '../../state/backupRetention';

import {
  planViewGraphicsMatrixRows,
  viewTemplateGraphicsMatrixRows,
} from '../../plan/planProjection';
import {
  getBuiltInWallType,
  resolveWallAssemblyExposedLayers,
} from '../../families/wallTypeCatalog';
import { resolveMaterial } from '../../viewport/materials';
import { PlanViewGraphicsMatrix } from './PlanViewGraphicsMatrix';
import { SavedViewTagGraphicsAuthoring, SavedViewTemplateGraphicsAuthoring } from '../authoring';

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

export type MaterialBrowserTargetRequest = {
  kind: 'material-slot';
  elementId: string;
  slot: string;
  label: string;
  currentKey?: string | null;
};

type OpenMaterialBrowser = (target?: MaterialBrowserTargetRequest) => void;

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

function materialLabel(
  materialKey: string | null | undefined,
  fallback: string,
  elementsById?: Record<string, Element>,
): string {
  if (!materialKey) return fallback;
  return resolveMaterial(materialKey, elementsById)?.displayName ?? materialKey;
}

function faceMaterialOverrideLabel(
  override: NonNullable<Extract<Element, { kind: 'wall' }>['faceMaterialOverrides']>[number],
  elementsById?: Record<string, Element>,
): string {
  const parts = [
    override.faceKind,
    materialLabel(override.materialKey, 'By material', elementsById),
  ];
  const transform: string[] = [];
  if (typeof override.uvRotationDeg === 'number') transform.push(`rot ${override.uvRotationDeg}°`);
  if (override.uvOffsetMm) {
    transform.push(`offset ${override.uvOffsetMm.uMm ?? 0}/${override.uvOffsetMm.vMm ?? 0} mm`);
  }
  if (override.uvScaleMm) {
    transform.push(`scale ${override.uvScaleMm.uMm ?? 0}/${override.uvScaleMm.vMm ?? 0} mm`);
  }
  if (transform.length) parts.push(transform.join(', '));
  return parts.join(' · ');
}

function MaterialAssignmentRow({
  label,
  materialKey,
  fallback,
  elementsById,
  assignmentTarget,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  label: string;
  materialKey: string | null | undefined;
  fallback: string;
  elementsById?: Record<string, Element>;
  assignmentTarget?: MaterialBrowserTargetRequest;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-sm text-foreground" title={materialKey ?? fallback}>
          {materialLabel(materialKey, fallback, elementsById)}
        </span>
        {onOpenMaterialBrowser ? (
          <button
            type="button"
            data-testid="inspector-material-row-browser"
            className="shrink-0 rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-foreground"
            onClick={() => onOpenMaterialBrowser(assignmentTarget)}
          >
            Materials...
          </button>
        ) : null}
        {onOpenAppearanceAssetBrowser ? (
          <button
            type="button"
            data-testid="inspector-material-row-appearance"
            className="shrink-0 rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-foreground"
            onClick={() => onOpenAppearanceAssetBrowser(assignmentTarget)}
          >
            Assets...
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GenericMaterialAssignmentFor({
  el,
  elementsById,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  el: Element;
  elementsById?: Record<string, Element>;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
}): JSX.Element | null {
  switch (el.kind) {
    case 'toposolid':
      return (
        <MaterialAssignmentRow
          label="Default Material"
          materialKey={el.defaultMaterialKey ?? null}
          fallback="By category"
          elementsById={elementsById}
          onOpenMaterialBrowser={onOpenMaterialBrowser}
          onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
        />
      );
    case 'toposolid_subdivision':
    case 'text_3d':
    case 'sweep':
    case 'mass':
    case 'pipe':
      return (
        <MaterialAssignmentRow
          label="Material"
          materialKey={el.materialKey ?? null}
          fallback="By category"
          elementsById={elementsById}
          onOpenMaterialBrowser={onOpenMaterialBrowser}
          onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
        />
      );
    default:
      return null;
  }
}

function slotMaterialKey(
  slots: Record<string, string | null> | null | undefined,
  slot: string,
): string | null {
  const value = slots?.[slot];
  return typeof value === 'string' && value.trim() ? value : null;
}

function MaterialSlotsSection({
  title = 'Material Slots',
  elementId,
  slots,
  rows,
  elementsById,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  title?: string;
  elementId: string;
  slots: Record<string, string | null> | null | undefined;
  rows: { slot: string; label: string; fallback?: string }[];
  elementsById?: Record<string, Element>;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
}): JSX.Element {
  return (
    <div className="border-t border-border pt-1">
      <div className="px-0 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </div>
      {rows.map((row) => {
        const materialKey = slotMaterialKey(slots, row.slot);
        const target: MaterialBrowserTargetRequest = {
          kind: 'material-slot',
          elementId,
          slot: row.slot,
          label: row.label,
          currentKey: materialKey,
        };
        return (
          <MaterialAssignmentRow
            key={row.slot}
            label={row.label}
            materialKey={materialKey}
            fallback={row.fallback ?? 'By family/category'}
            elementsById={elementsById}
            assignmentTarget={target}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        );
      })}
    </div>
  );
}

function wallTypeExteriorMaterialKey(
  wall: Extract<Element, { kind: 'wall' }>,
  elementsById: Record<string, Element>,
): string | null {
  if (!wall.wallTypeId) return null;
  const type = elementsById[wall.wallTypeId];
  if (type?.kind === 'wall_type') return type.layers[0]?.materialKey ?? null;
  const builtIn = getBuiltInWallType(wall.wallTypeId);
  if (!builtIn) return null;
  return resolveWallAssemblyExposedLayers(builtIn).exterior?.materialKey ?? null;
}

function roofTypeTopMaterialKey(
  roof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
): string | null {
  if (!roof.roofTypeId) return null;
  const type = elementsById[roof.roofTypeId];
  return type?.kind === 'roof_type' ? (type.layers[0]?.materialKey ?? null) : null;
}

function fmtMm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} m`;
  return `${value.toFixed(0)} mm`;
}

function fmtWatts(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} kW`;
  return `${value.toFixed(0)} W`;
}

function fmtMepRecord(value: Record<string, unknown> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return '—';
  return Object.entries(value)
    .map(([key, row]) => `${key}: ${String(row)}`)
    .join(' · ');
}

function MepCommonRows({
  el,
}: {
  el: Extract<
    Element,
    {
      kind:
        | 'pipe'
        | 'duct'
        | 'cable_tray'
        | 'mep_equipment'
        | 'fixture'
        | 'mep_terminal'
        | 'mep_opening_request';
    }
  >;
}): JSX.Element {
  return (
    <>
      <FieldRow label="System Type" value={el.systemType ?? '—'} />
      <FieldRow label="System Name" value={el.systemName ?? '—'} />
      <FieldRow label="Flow Direction" value={el.flowDirection ?? '—'} />
      <FieldRow label="Service Level" value={el.serviceLevel ?? '—'} />
      <FieldRow label="Insulation" value={el.insulation ?? '—'} />
      <FieldRow label="Connectors" value={String(el.connectors?.length ?? 0)} mono />
      {el.clearanceZone ? <FieldRow label="Clearance Zone" value="Defined" /> : null}
      {el.maintainAccessZone ? <FieldRow label="Access Zone" value="Defined" /> : null}
    </>
  );
}

function parseTypeParameterDraft(value: string, prior: unknown): unknown {
  if (typeof prior === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : prior;
  }
  if (typeof prior === 'boolean') return value === 'true';
  return value;
}

function TypeTextInput({
  label,
  value,
  testId,
  onCommit,
}: {
  label: string;
  value: string;
  testId: string;
  onCommit?: (value: string) => void;
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 py-0.5">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <input
        className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
        defaultValue={value}
        data-testid={testId}
        onBlur={(e) => {
          const next = e.currentTarget.value.trim();
          if (next && next !== value) onCommit?.(next);
        }}
      />
    </label>
  );
}

function TypeLayerSummary({
  layers,
}: {
  layers: Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }>['layers'];
}): JSX.Element {
  const totalMm = layers.reduce((sum, layer) => sum + (Number(layer.thicknessMm) || 0), 0);
  return (
    <div className="rounded border border-border bg-surface-strong p-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-foreground">Type Layers</span>
        <span className="text-muted">
          {layers.length} layer{layers.length === 1 ? '' : 's'} · {fmtMm(totalMm)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {layers.map((layer, index) => (
          <div
            key={`${layer.function}-${layer.materialKey ?? 'mat'}-${index}`}
            className="grid grid-cols-[1fr_72px_72px] gap-2 border-t border-border pt-1 first:border-t-0 first:pt-0"
          >
            <span className="truncate" title={layer.materialKey ?? layer.function}>
              {layer.materialKey ?? 'By category'}
            </span>
            <span className="text-muted">{layer.function}</span>
            <span className="text-right font-mono">{fmtMm(layer.thicknessMm)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FamilyTypeParameterTable({
  parameters,
  onPropertyChange,
}: {
  parameters: Record<string, unknown>;
  onPropertyChange?: (property: string, value: unknown) => void;
}): JSX.Element {
  const entries = Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="rounded border border-border bg-surface-strong p-2 text-xs">
      <div className="mb-1 font-medium text-foreground">Type Parameters</div>
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {entries.map(([key, value]) => {
          const display = value == null ? '' : String(value);
          return (
            <label key={key} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2">
              <span className="truncate text-muted" title={key}>
                {key}
              </span>
              {typeof value === 'boolean' ? (
                <select
                  className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  value={String(value)}
                  data-testid={`inspector-family-type-param-${key}`}
                  onChange={(e) =>
                    onPropertyChange?.(
                      `parameters.${key}`,
                      parseTypeParameterDraft(e.currentTarget.value, value),
                    )
                  }
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-xs"
                  defaultValue={display}
                  data-testid={`inspector-family-type-param-${key}`}
                  onBlur={(e) => {
                    const next = e.currentTarget.value;
                    if (next !== display) {
                      onPropertyChange?.(`parameters.${key}`, parseTypeParameterDraft(next, value));
                    }
                  }}
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
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
        aria-label={t('inspector.fields.discipline', 'Discipline')}
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

/** Look up a human-readable name for an element ID, falling back to the raw ID. */
function resolveElName(id: string | null | undefined, eb: Record<string, Element>): string {
  if (!id) return '—';
  const e = eb[id];
  if (!e) return id;
  return 'name' in e && typeof (e as { name?: unknown }).name === 'string'
    ? ((e as { name: string }).name ?? id)
    : id;
}

export function InspectorPropertiesFor(
  el: Element,
  t: TFunction,
  options?: {
    elementsById?: Record<string, Element>;
    onPropertyChange?: (property: string, value: unknown) => void;
    onMonitorReconcile?: (elementId: string, mode: 'accept_source' | 'keep_host') => void;
    onDisciplineChange?: (discipline: DisciplineTag | null) => void;
    onEditType?: (typeId: string) => void;
    onOpenMaterialBrowser?: OpenMaterialBrowser;
    onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
  },
): JSX.Element {
  const elementsById = options?.elementsById ?? {};
  const onMonitorReconcile = options?.onMonitorReconcile;
  const onDisciplineChange = options?.onDisciplineChange;
  const onEditType = options?.onEditType;
  const onOpenMaterialBrowser = options?.onOpenMaterialBrowser;
  const onOpenAppearanceAssetBrowser = options?.onOpenAppearanceAssetBrowser;
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
    case 'wall': {
      const { elementsById = {}, onPropertyChange } = options ?? {};
      const roofs = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'roof' }> => e.kind === 'roof',
      );
      const typedExteriorMaterialKey = wallTypeExteriorMaterialKey(el, elementsById);
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('thickness')} value={fmtMm(el.thicknessMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Offset (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.baseConstraintOffsetMm ?? 0}
              key={`${el.id}-base`}
              step={50}
              onBlur={(e) =>
                onPropertyChange?.('baseConstraintOffsetMm', Number(e.currentTarget.value))
              }
              data-testid="inspector-wall-base-offset"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Top Offset (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.topConstraintOffsetMm ?? 0}
              key={`${el.id}-top`}
              step={50}
              onBlur={(e) =>
                onPropertyChange?.('topConstraintOffsetMm', Number(e.currentTarget.value))
              }
              data-testid="inspector-wall-top-offset"
            />
          </div>
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />

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
            {el.wallTypeId && onEditType ? (
              <button
                type="button"
                data-testid="inspector-edit-type"
                className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted hover:text-foreground"
                onClick={() => onEditType(el.wallTypeId!)}
              >
                Edit Type
              </button>
            ) : null}
          </div>
          {el.wallTypeId ? (
            <MaterialAssignmentRow
              label="Type Exterior Material"
              materialKey={typedExteriorMaterialKey}
              fallback="By type"
              elementsById={elementsById}
              onOpenMaterialBrowser={
                elementsById[el.wallTypeId]?.kind === 'wall_type'
                  ? onOpenMaterialBrowser
                  : undefined
              }
              onOpenAppearanceAssetBrowser={
                elementsById[el.wallTypeId]?.kind === 'wall_type'
                  ? onOpenAppearanceAssetBrowser
                  : undefined
              }
            />
          ) : (
            <MaterialAssignmentRow
              label="Instance Material"
              materialKey={el.materialKey ?? null}
              fallback="By category"
              elementsById={elementsById}
              onOpenMaterialBrowser={onOpenMaterialBrowser}
              onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
            />
          )}
          {el.faceMaterialOverrides?.length ? (
            <div className="border-b border-border py-1.5">
              <div className="mb-1 text-xs text-muted">Face Materials</div>
              <div className="flex flex-col gap-1">
                {el.faceMaterialOverrides.map((override, index) => (
                  <div
                    key={`${override.faceKind}-${override.generatedFaceId ?? 'box'}-${index}`}
                    className="truncate font-mono text-[11px] text-foreground"
                    title={faceMaterialOverrideLabel(override, elementsById)}
                  >
                    {faceMaterialOverrideLabel(override, elementsById)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
        </div>
      );
    }
    case 'door':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('family')} value={el.familyTypeId ?? 'Generic 900 × 2100'} mono />
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialKey ?? null}
            fallback="By family/category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <MaterialSlotsSection
            elementId={el.id}
            slots={el.materialSlots}
            rows={[
              { slot: 'frame', label: 'Frame' },
              { slot: 'panel', label: 'Panel' },
              { slot: 'hardware', label: 'Hardware' },
              { slot: 'threshold', label: 'Threshold' },
            ]}
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('wall')} value={resolveElName(el.wallId, elementsById)} />
          <FieldRow label={f('alongT')} value={el.alongT.toFixed(3)} mono />
        </div>
      );
    case 'window':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('family')} value={el.familyTypeId ?? 'Generic 1200 × 1500'} mono />
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialKey ?? null}
            fallback="By family/category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <MaterialSlotsSection
            elementId={el.id}
            slots={el.materialSlots}
            rows={[
              { slot: 'frame', label: 'Frame' },
              { slot: 'sash', label: 'Sash' },
              { slot: 'glass', label: 'Glass', fallback: 'Default clear glass' },
              { slot: 'spacer', label: 'Spacer' },
              { slot: 'hardware', label: 'Hardware' },
              { slot: 'shading', label: 'Shading' },
            ]}
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label={f('sillHeight')} value={fmtMm(el.sillHeightMm)} />
          <FieldRow label={f('wall')} value={resolveElName(el.wallId, elementsById)} />
        </div>
      );
    case 'floor': {
      const { elementsById: floorElementsById = {}, onPropertyChange: floorOnPropertyChange } =
        options ?? {};
      const floorType = el.floorTypeId ? floorElementsById[el.floorTypeId] : undefined;
      const floorTypeMaterialKey =
        floorType?.kind === 'floor_type' ? (floorType.layers[0]?.materialKey ?? null) : null;
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('thickness')} value={fmtMm(el.thicknessMm)} />
          <FieldRow label={f('structureThickness')} value={fmtMm(el.structureThicknessMm)} />
          <FieldRow label={f('finishThickness')} value={fmtMm(el.finishThicknessMm)} />
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
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
            {el.floorTypeId && onEditType ? (
              <button
                type="button"
                data-testid="inspector-edit-type"
                className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted hover:text-foreground"
                onClick={() => onEditType(el.floorTypeId!)}
              >
                Edit Type
              </button>
            ) : null}
          </div>
          {floorType?.kind === 'floor_type' ? (
            <MaterialAssignmentRow
              label="Type Material"
              materialKey={floorTypeMaterialKey}
              fallback="By category"
              elementsById={floorElementsById}
              onOpenMaterialBrowser={onOpenMaterialBrowser}
              onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
            />
          ) : null}
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
      const roofTypeMaterialKey = roofTypeTopMaterialKey(el, roofElementsById);
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('slope')} value={`${(el.slopeDeg ?? 0).toFixed(1)}°`} />
          <FieldRow label={f('overhang')} value={fmtMm(el.overhangMm)} />
          <FieldRow
            label={f('referenceLevel')}
            value={resolveElName(el.referenceLevelId, elementsById)}
          />
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
            {el.roofTypeId && onEditType ? (
              <button
                type="button"
                data-testid="inspector-edit-type"
                className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted hover:text-foreground"
                onClick={() => onEditType(el.roofTypeId!)}
              >
                Edit Type
              </button>
            ) : null}
          </div>
          {el.roofTypeId ? (
            <MaterialAssignmentRow
              label="Type Top Material"
              materialKey={roofTypeMaterialKey}
              fallback="By type"
              elementsById={roofElementsById}
              onOpenMaterialBrowser={
                roofElementsById[el.roofTypeId]?.kind === 'roof_type'
                  ? onOpenMaterialBrowser
                  : undefined
              }
              onOpenAppearanceAssetBrowser={
                roofElementsById[el.roofTypeId]?.kind === 'roof_type'
                  ? onOpenAppearanceAssetBrowser
                  : undefined
              }
            />
          ) : (
            <MaterialAssignmentRow
              label="Instance Material"
              materialKey={el.materialKey ?? null}
              fallback="By category"
              elementsById={roofElementsById}
              onOpenMaterialBrowser={onOpenMaterialBrowser}
              onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
            />
          )}
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
        </div>
      );
    }
    case 'stair': {
      const { onPropertyChange: stairPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.widthMm}
              key={`${el.id}-width`}
              step={100}
              aria-label="Stair width in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) stairPropChange?.('widthMm', v);
              }}
              data-testid="inspector-stair-width"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Riser (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.riserMm}
              key={`${el.id}-riser`}
              step={10}
              aria-label="Stair riser height in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) stairPropChange?.('riserMm', v);
              }}
              data-testid="inspector-stair-riser"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Tread (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.treadMm}
              key={`${el.id}-tread`}
              step={10}
              aria-label="Stair tread depth in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) stairPropChange?.('treadMm', v);
              }}
              data-testid="inspector-stair-tread"
            />
          </div>
          <FieldRow label={f('baseLevel')} value={resolveElName(el.baseLevelId, elementsById)} />
          <FieldRow label={f('topLevel')} value={resolveElName(el.topLevelId, elementsById)} />
          <MaterialSlotsSection
            elementId={el.id}
            slots={el.materialSlots}
            rows={[
              { slot: 'tread', label: 'Tread' },
              { slot: 'riser', label: 'Riser' },
              { slot: 'stringer', label: 'Stringer' },
              { slot: 'landing', label: 'Landing' },
              { slot: 'support', label: 'Support' },
              { slot: 'nosing', label: 'Nosing' },
            ]}
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
        </div>
      );
    }
    case 'column': {
      const { onPropertyChange: colPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialKey ?? null}
            fallback="By category"
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <FieldRow label={f('width')} value={fmtMm(el.bMm)} />
          <FieldRow label={f('depth')} value={fmtMm(el.hMm)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightMm}
              key={`${el.id}-height`}
              step={100}
              onBlur={(e) => colPropChange?.('heightMm', Number(e.currentTarget.value))}
              data-testid="inspector-column-height"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Rotation (°)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.rotationDeg ?? 0}
              key={`${el.id}-rotation`}
              step={15}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (!isNaN(v)) colPropChange?.('rotationDeg', v);
              }}
              data-testid="inspector-column-rotation"
              aria-label="Column rotation in degrees"
            />
          </div>
        </div>
      );
    }
    case 'beam': {
      const { onPropertyChange: beamPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialKey ?? null}
            fallback="By category"
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
          <FieldRow
            label="Start"
            value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`}
            mono
          />
          <FieldRow label="End" value={`${fmtMm(el.endMm.xMm)} · ${fmtMm(el.endMm.yMm)}`} mono />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightMm}
              key={`${el.id}-height`}
              step={50}
              aria-label="Beam height in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) beamPropChange?.('heightMm', v);
              }}
              data-testid="inspector-beam-height"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.widthMm}
              key={`${el.id}-width`}
              step={50}
              aria-label="Beam width in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) beamPropChange?.('widthMm', v);
              }}
              data-testid="inspector-beam-width"
            />
          </div>
        </div>
      );
    }
    case 'room':
      return (
        <div>
          <FieldRow label={f('programme')} value={el.programmeCode ?? '—'} />
          <FieldRow label={f('department')} value={el.department ?? '—'} />
          <FieldRow label={f('function')} value={el.functionLabel ?? '—'} />
          <FieldRow label={f('finishSet')} value={el.finishSet ?? '—'} />
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
          {el.upperLimitLevelId ? (
            <FieldRow
              label={f('upperLimit')}
              value={resolveElName(el.upperLimitLevelId, elementsById)}
            />
          ) : null}
          {el.volumeM3 != null ? (
            <FieldRow label={f('volume')} value={`${el.volumeM3.toFixed(3)} m³`} />
          ) : null}
          <FieldRow label="Ventilation Zone" value={el.ventilationZone ?? '—'} />
          <FieldRow label="Heating/Cooling Zone" value={el.heatingCoolingZone ?? '—'} />
          <FieldRow
            label="Design ACH"
            value={
              el.designAirChangeRate != null ? `${el.designAirChangeRate.toFixed(2)} 1/h` : '—'
            }
          />
          <FieldRow
            label="Fixture/Equipment Loads"
            value={fmtMepRecord(el.fixtureEquipmentLoads)}
          />
          <FieldRow label="Electrical Loads" value={fmtMepRecord(el.electricalLoadSummary)} />
          <FieldRow
            label="Service Requirements"
            value={el.serviceRequirements?.join(', ') || '—'}
          />
        </div>
      );
    case 'duct':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label="Shape" value={el.shape ?? 'rectangular'} />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow
            label="Start"
            value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`}
            mono
          />
          <FieldRow label="End" value={`${fmtMm(el.endMm.xMm)} · ${fmtMm(el.endMm.yMm)}`} mono />
          <MepCommonRows el={el} />
        </div>
      );
    case 'pipe':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label="Diameter" value={fmtMm(el.diameterMm)} />
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow
            label="Start"
            value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`}
            mono
          />
          <FieldRow label="End" value={`${fmtMm(el.endMm.xMm)} · ${fmtMm(el.endMm.yMm)}`} mono />
          <MepCommonRows el={el} />
        </div>
      );
    case 'cable_tray':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow
            label="Start"
            value={`${fmtMm(el.startMm.xMm)} · ${fmtMm(el.startMm.yMm)}`}
            mono
          />
          <FieldRow label="End" value={`${fmtMm(el.endMm.xMm)} · ${fmtMm(el.endMm.yMm)}`} mono />
          <MepCommonRows el={el} />
        </div>
      );
    case 'mep_equipment':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label="Equipment Type" value={el.equipmentType ?? '—'} />
          <FieldRow label={f('family')} value={el.familyTypeId ?? '—'} mono />
          <FieldRow
            label="Position"
            value={`${fmtMm(el.positionMm.xMm)} · ${fmtMm(el.positionMm.yMm)}`}
            mono
          />
          <FieldRow label="Elevation" value={fmtMm(el.elevationMm)} />
          <FieldRow label="Electrical Load" value={fmtWatts(el.electricalLoadW)} />
          <MepCommonRows el={el} />
        </div>
      );
    case 'fixture':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label="Fixture Type" value={el.fixtureType ?? '—'} />
          <FieldRow label="Room" value={resolveElName(el.roomId ?? null, elementsById)} />
          <FieldRow
            label="Position"
            value={`${fmtMm(el.positionMm.xMm)} · ${fmtMm(el.positionMm.yMm)}`}
            mono
          />
          <FieldRow label="Electrical Load" value={fmtWatts(el.electricalLoadW)} />
          <MepCommonRows el={el} />
        </div>
      );
    case 'mep_terminal':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label="Terminal Kind" value={el.terminalKind ?? 'terminal'} />
          <FieldRow label="Room" value={resolveElName(el.roomId ?? null, elementsById)} />
          <FieldRow
            label="Position"
            value={`${fmtMm(el.positionMm.xMm)} · ${fmtMm(el.positionMm.yMm)}`}
            mono
          />
          <MepCommonRows el={el} />
        </div>
      );
    case 'mep_opening_request':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host" value={resolveElName(el.hostElementId, elementsById)} />
          <FieldRow label={f('level')} value={resolveElName(el.levelId ?? null, elementsById)} />
          <FieldRow label="Opening Kind" value={el.openingKind ?? 'wall'} />
          <FieldRow label="Status" value={el.status ?? 'requested'} />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label="Diameter" value={fmtMm(el.diameterMm)} />
          <FieldRow label="Clearance" value={fmtMm(el.clearanceMm)} />
          <FieldRow label="Requesters" value={el.requesterElementIds?.join(', ') || '—'} mono />
          <FieldRow label="Approval Note" value={el.approvalNote ?? '—'} />
          <MepCommonRows el={el} />
        </div>
      );
    case 'level': {
      const { onPropertyChange: lvlPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <input
              type="number"
              className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.elevationMm}
              key={`${el.id}-elev`}
              step={100}
              aria-label="Level elevation in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) lvlPropChange?.('elevationMm', v);
              }}
              data-testid="inspector-level-elevation"
            />
          </div>
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
    }
    case 'area': {
      const { onPropertyChange: areaPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <label className={LABEL_CLS}>
            <span>Area Scheme</span>
            <select
              className={INPUT_CLS}
              value={el.areaScheme ?? 'gross_building'}
              onChange={(e) => areaPropChange?.('areaScheme', e.target.value)}
              data-testid="inspector-area-scheme"
            >
              <option value="gross_building">Gross Building</option>
              <option value="net">Net</option>
              <option value="rentable">Rentable</option>
            </select>
          </label>
          <FieldRow
            label="Rule Set"
            value={el.ruleSet === 'gross' ? 'Gross' : el.ruleSet === 'net' ? 'Net' : 'No Rules'}
          />
          {el.computedAreaSqMm !== undefined ? (
            <FieldRow
              label="Area"
              value={`${(el.computedAreaSqMm / 1_000_000).toFixed(2)} m²`}
              mono
            />
          ) : null}
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm.length)} mono />
        </div>
      );
    }
    case 'dimension': {
      const distMm = Math.hypot(el.bMm.xMm - el.aMm.xMm, el.bMm.yMm - el.aMm.yMm);
      const { onPropertyChange: dimPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow
            label="Measured"
            value={`${(distMm / 1000).toFixed(3)} m (${Math.round(distMm)} mm)`}
            mono
          />
          <FieldRow label="Point A" value={`${fmtMm(el.aMm.xMm)} · ${fmtMm(el.aMm.yMm)}`} mono />
          <FieldRow label="Point B" value={`${fmtMm(el.bMm.xMm)} · ${fmtMm(el.bMm.yMm)}`} mono />
          {el.autoGenerated ? <FieldRow label="Auto-generated" value="Yes" /> : null}
          <div className="flex items-center gap-2 border-t border-border pt-2">
            <span className="w-20 shrink-0 text-xs text-muted">Binding</span>
            <div
              role="radiogroup"
              aria-label="Dimension binding state"
              className="flex rounded border border-border bg-surface-strong p-0.5 text-xs"
            >
              {(['linked', 'partial', 'unlinked'] as const).map((state) => {
                const active = (el.state ?? 'unlinked') === state;
                return (
                  <button
                    key={state}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`dimension-state-${state}`}
                    className={[
                      'rounded px-2 py-0.5 capitalize',
                      active
                        ? state === 'unlinked'
                          ? 'bg-drift text-background'
                          : 'bg-accent text-accent-foreground'
                        : 'text-muted hover:text-foreground',
                    ].join(' ')}
                    onClick={() => dimPropChange?.('state', state)}
                  >
                    {state}
                  </button>
                );
              })}
            </div>
          </div>
          {/* F-088 — text label offset inputs */}
          {dimPropChange ? (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              <span className="text-xs font-medium text-muted">Text label offset</span>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-muted">X offset (mm)</span>
                <input
                  type="number"
                  className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.textOffsetMm?.xMm ?? 0}
                  key={`${el.id}-text-x`}
                  step={10}
                  aria-label="Dimension text label X offset in millimetres"
                  data-testid="dimension-text-offset-x"
                  onBlur={(e) => {
                    const xMm = Number(e.currentTarget.value);
                    if (!isNaN(xMm)) {
                      dimPropChange('textOffsetMm', { xMm, yMm: el.textOffsetMm?.yMm ?? 0 });
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-muted">Y offset (mm)</span>
                <input
                  type="number"
                  className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.textOffsetMm?.yMm ?? 0}
                  key={`${el.id}-text-y`}
                  step={10}
                  aria-label="Dimension text label Y offset in millimetres"
                  data-testid="dimension-text-offset-y"
                  onBlur={(e) => {
                    const yMm = Number(e.currentTarget.value);
                    if (!isNaN(yMm)) {
                      dimPropChange('textOffsetMm', { xMm: el.textOffsetMm?.xMm ?? 0, yMm });
                    }
                  }}
                />
              </div>
              <div className="flex gap-2 pt-0.5">
                <button
                  className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
                  data-testid="dimension-text-offset-reset"
                  onClick={() => dimPropChange('textOffsetMm', null)}
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}
        </div>
      );
    }
    case 'railing': {
      const { onPropertyChange: railPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name} />
          {el.hostedStairId ? (
            <FieldRow label="Hosted Stair" value={resolveElName(el.hostedStairId, elementsById)} />
          ) : null}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Guard Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.guardHeightMm ?? 1100}
              key={`${el.id}-guard`}
              step={50}
              aria-label="Railing guard height in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) railPropChange?.('guardHeightMm', v);
              }}
              data-testid="inspector-railing-guard-height"
            />
          </div>
          <FieldRow label="Path Vertices" value={String(el.pathMm.length)} mono />
          <MaterialSlotsSection
            elementId={el.id}
            slots={el.materialSlots}
            rows={[
              { slot: 'topRail', label: 'Top rail' },
              { slot: 'handrail', label: 'Handrail' },
              { slot: 'post', label: 'Post' },
              { slot: 'baluster', label: 'Baluster' },
              { slot: 'panel', label: 'Panel' },
              { slot: 'cable', label: 'Cable' },
              { slot: 'bracket', label: 'Bracket' },
            ]}
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    }
    case 'ceiling': {
      const { onPropertyChange: ceilPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height Offset (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightOffsetMm ?? 0}
              key={`${el.id}-hoffset`}
              step={100}
              aria-label="Ceiling height offset in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) ceilPropChange?.('heightOffsetMm', v);
              }}
              data-testid="inspector-ceiling-height-offset"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Thickness (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.thicknessMm ?? 50}
              key={`${el.id}-thickness`}
              step={10}
              aria-label="Ceiling thickness in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) ceilPropChange?.('thicknessMm', v);
              }}
              data-testid="inspector-ceiling-thickness"
            />
          </div>
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm?.length ?? 0)} mono />
        </div>
      );
    }
    case 'property_line':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name ?? '—'} />
          <FieldRow
            label="Start"
            value={`(${Math.round(el.startMm.xMm)}, ${Math.round(el.startMm.yMm)}) mm`}
            mono
          />
          <FieldRow
            label="End"
            value={`(${Math.round(el.endMm.xMm)}, ${Math.round(el.endMm.yMm)}) mm`}
            mono
          />
          <FieldRow label="Setback" value={`${el.setbackMm ?? 0} mm`} />
          <FieldRow label="Classification" value={el.classification ?? '—'} />
        </div>
      );
    case 'reference_plane': {
      const levels = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
      );
      const levelNames: Record<string, string> = Object.fromEntries(
        levels.map((lv) => [lv.id, lv.name]),
      );
      const levelId = 'levelId' in el ? el.levelId : undefined;
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name ?? '—'} />
          <FieldRow
            label={f('level')}
            value={levelId ? (levelNames[levelId] ?? levelId) : '—'}
            mono
          />
        </div>
      );
    }
    case 'link_dxf': {
      const { onPropertyChange: linkDxfPropChange } = options ?? {};
      const levels = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
      );
      const levelNames = Object.fromEntries(levels.map((e) => [e.id, e.name]));
      return (
        <div className="space-y-1 text-[11px]">
          <FieldRow label="Name" value={el.name ?? '(unnamed DXF)'} />
          {linkDxfPropChange && levels.length > 0 ? (
            <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
              <label className="text-xs text-muted" htmlFor={`link-dxf-level-${el.id}`}>
                Level
              </label>
              <select
                id={`link-dxf-level-${el.id}`}
                className="max-w-[180px] rounded border border-border bg-surface px-1 py-0.5 text-xs"
                value={el.levelId}
                data-testid="inspector-link-dxf-level"
                onChange={(e) => linkDxfPropChange('levelId', e.currentTarget.value)}
              >
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <FieldRow label="Level" value={levelNames[el.levelId] ?? el.levelId} />
          )}
          <FieldRow
            label="Origin"
            value={`(${Math.round(el.originMm.xMm)}, ${Math.round(el.originMm.yMm)}) mm`}
          />
          <FieldRow label="Rotation" value={`${el.rotationDeg ?? 0}°`} />
          <FieldRow label="Scale" value={`×${el.scaleFactor ?? 1}`} />
          <FieldRow
            label="Color Mode"
            value={el.colorMode === 'custom' ? 'Custom' : 'Black & White'}
          />
          {el.colorMode === 'custom' && el.customColor ? (
            <FieldRow label="Color" value={el.customColor} />
          ) : null}
          <FieldRow label="Opacity" value={`${Math.round((el.overlayOpacity ?? 0.5) * 100)}%`} />
        </div>
      );
    }
    case 'masking_region': {
      const { onPropertyChange: mrPropChange } = options ?? {};
      const hostView = elementsById[el.hostViewId];
      const viewName = hostView && 'name' in hostView ? String(hostView.name) : el.hostViewId;
      // eslint-disable-next-line bim-ai/no-hex-in-chrome -- fallback when element has no color
      const fillColor = el.fillColor ?? '#ffffff';
      return (
        <div className="space-y-1 text-[11px]">
          <FieldRow label="Host View" value={viewName} />
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm.length)} />
          <FieldRow label="Void Loops" value={String(el.voidBoundariesMm?.length ?? 0)} />
          {/* KRN-10 / F-077: editable fill color */}
          <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
            <span className="text-xs text-muted">Fill Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={fillColor}
                data-testid="inspector-masking-fillcolor"
                onChange={(e) => mrPropChange?.('fillColor', e.target.value)}
                className="h-6 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
              />
              <span className="font-mono text-[10px] text-muted">{fillColor}</span>
            </div>
          </div>
          <FieldRow label="Edit Boundary" value="Vertex grips" />
        </div>
      );
    }
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
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label={f('presentation')} value={el.planPresentation ?? 'default'} />
          {el.viewTemplateId ? (
            <FieldRow
              label={f('template')}
              value={resolveElName(el.viewTemplateId, elementsById)}
            />
          ) : null}
          {el.underlayLevelId ? (
            <FieldRow
              label={f('underlay')}
              value={resolveElName(el.underlayLevelId, elementsById)}
            />
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
    case 'elevation_view':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Direction" value={el.direction} />
          {el.customAngleDeg != null ? (
            <FieldRow label="Angle" value={`${el.customAngleDeg}°`} />
          ) : null}
          {el.scale != null ? <FieldRow label={f('scale')} value={`1:${el.scale}`} /> : null}
          {el.planDetailLevel ? <FieldRow label="Detail Level" value={el.planDetailLevel} /> : null}
        </div>
      );
    case 'callout':
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label="Parent Sheet" value={resolveElName(el.parentSheetId, elementsById)} />
          <FieldRow label="Outline Vertices" value={String(el.outlineMm.length)} mono />
        </div>
      );
    case 'family_type':
      return (
        <div className="flex flex-col gap-2">
          <TypeTextInput
            label={f('name')}
            value={String(el.parameters.name ?? el.name)}
            testId="inspector-family-type-name"
            onCommit={(value) => options?.onPropertyChange?.('name', value)}
          />
          <FieldRow label="Discipline" value={el.discipline} />
          <FamilyTypeParameterTable
            parameters={el.parameters}
            onPropertyChange={options?.onPropertyChange}
          />
          {el.isBuiltIn ? <FieldRow label="Type" value="Built-in" /> : null}
        </div>
      );
    case 'wall_type':
      return (
        <div className="flex flex-col gap-2">
          <TypeTextInput
            label={f('name')}
            value={el.name}
            testId="inspector-wall-type-name"
            onCommit={(value) => options?.onPropertyChange?.('name', value)}
          />
          <label className="flex items-center gap-2 py-0.5">
            <span className="w-28 shrink-0 text-xs text-muted">Basis Line</span>
            <select
              className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
              value={el.basisLine ?? 'center'}
              data-testid="inspector-wall-type-basis-line"
              onChange={(e) => options?.onPropertyChange?.('basisLine', e.currentTarget.value)}
            >
              <option value="center">Centerline</option>
              <option value="face_interior">Finish Face: Interior</option>
              <option value="face_exterior">Finish Face: Exterior</option>
            </select>
          </label>
          <TypeLayerSummary layers={el.layers} />
          <MaterialAssignmentRow
            label="First Layer Material"
            materialKey={el.layers[0]?.materialKey ?? null}
            fallback="By category"
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    case 'floor_type':
      return (
        <div className="flex flex-col gap-2">
          <TypeTextInput
            label={f('name')}
            value={el.name}
            testId="inspector-floor-type-name"
            onCommit={(value) => options?.onPropertyChange?.('name', value)}
          />
          <TypeLayerSummary layers={el.layers} />
          <MaterialAssignmentRow
            label="First Layer Material"
            materialKey={el.layers[0]?.materialKey ?? null}
            fallback="By category"
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    case 'roof_type':
      return (
        <div className="flex flex-col gap-2">
          <TypeTextInput
            label={f('name')}
            value={el.name}
            testId="inspector-roof-type-name"
            onCommit={(value) => options?.onPropertyChange?.('name', value)}
          />
          <TypeLayerSummary layers={el.layers} />
          <MaterialAssignmentRow
            label="First Layer Material"
            materialKey={el.layers[0]?.materialKey ?? null}
            fallback="By category"
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
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
          <FieldRow
            label={f('colorFillLegend')}
            value={resolveElName(el.hostViewId, elementsById)}
          />
          <FieldRow label={f('schemeParameter')} value={el.schemeParameter} />
          <FieldRow label={f('title')} value={el.title} />
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
          <FieldRow
            label="Checkpoint Retention"
            value={String(el.checkpointRetentionLimit ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT)}
            mono
          />
          {el.startingViewId ? (
            <FieldRow
              label={f('startingView')}
              value={resolveElName(el.startingViewId, elementsById)}
            />
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
    case 'sheet': {
      const legacyViewportCount = Array.isArray(el.viewportsMm) ? el.viewportsMm.length : 0;
      const placementCount = el.viewPlacements?.length ?? 0;
      return (
        <div>
          {el.number ? <FieldRow label={f('number')} value={el.number} /> : null}
          {el.size ? <FieldRow label={f('size')} value={el.size} /> : null}
          {el.orientation ? <FieldRow label={f('orientation')} value={el.orientation} /> : null}
          {el.titleblockTypeId ? (
            <FieldRow label={f('titleblock')} value={el.titleblockTypeId} mono />
          ) : null}
          <FieldRow label={f('viewports')} value={String(legacyViewportCount + placementCount)} />
          <FieldRow
            label={f('viewPlacementSource')}
            value={legacyViewportCount ? 'sheet viewports' : 'view placements'}
          />
        </div>
      );
    }
    case 'schedule':
      return (
        <div>
          {el.category ? <FieldRow label={f('category')} value={el.category} /> : null}
          <FieldRow label={f('columns')} value={String(el.columns?.length ?? 0)} />
          {el.filterExpr ? <FieldRow label={f('filter')} value={el.filterExpr} mono /> : null}
          {el.sortKey ? (
            <FieldRow label={f('sort')} value={`${el.sortKey} ${el.sortDir ?? 'asc'}`} mono />
          ) : null}
        </div>
      );
    default:
      const materialAssignment = GenericMaterialAssignmentFor({
        el,
        elementsById,
        onOpenMaterialBrowser,
        onOpenAppearanceAssetBrowser,
      });
      if (materialAssignment)
        return <div className="flex flex-col gap-2">{materialAssignment}</div>;
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
    'link_model',
    'link_dxf',
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
const VIEW_TEMPLATE_CONTROL_FIELDS: Array<{
  field: ViewTemplateControlledField;
  label: string;
}> = [
  { field: 'scale', label: 'Scale' },
  { field: 'detailLevel', label: 'Detail level' },
  { field: 'phase', label: 'Phase' },
  { field: 'phaseFilter', label: 'Phase filter' },
  { field: 'elementOverrides', label: 'Element overrides' },
];

function viewTemplateControlState(
  el: Extract<Element, { kind: 'view_template' }>,
  field: ViewTemplateControlledField,
): { included: boolean; locked: boolean } {
  const control = el.templateControlMatrix?.[field];
  const included = control?.included ?? true;
  return { included, locked: control?.locked ?? included };
}

function viewTemplateControlPatch(
  field: ViewTemplateControlledField,
  included: boolean,
  locked: boolean,
): string {
  return JSON.stringify({
    templateControlMatrix: {
      [field]: { included, locked: included ? locked : false },
    },
  });
}

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
        <span>Discipline</span>
        <select
          className={INPUT_CLS}
          value={el.discipline ?? ''}
          onChange={(e) => onPersistProperty('discipline', e.target.value)}
          data-testid="inspector-plan-view-discipline"
        >
          <option value="">(Default)</option>
          <option value="arch">Architecture</option>
          <option value="struct">Structural</option>
          <option value="mep">MEP</option>
          <option value="coordination">Coordination</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span>Sub-discipline</span>
        <select
          className={INPUT_CLS}
          value={el.viewSubdiscipline ?? ''}
          onChange={(e) => onPersistProperty('viewSubdiscipline', e.target.value)}
          data-testid="inspector-plan-view-subdiscipline"
        >
          <option value="">(None)</option>
          <option value="Architecture">Architecture</option>
          <option value="Interior">Interior</option>
          <option value="Structural">Structural</option>
          <option value="Mechanical">Mechanical</option>
          <option value="Electrical">Electrical</option>
          <option value="Plumbing">Plumbing</option>
          <option value="Coordination">Coordination</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span>View Type</span>
        <select
          className={INPUT_CLS}
          value={el.planViewSubtype ?? 'floor_plan'}
          onChange={(e) => onPersistProperty('planViewSubtype', e.target.value)}
          data-testid="inspector-plan-view-subtype"
        >
          <option value="floor_plan">Floor Plan</option>
          <option value="area_plan">Area Plan</option>
          <option value="lighting_plan">Lighting Plan</option>
          <option value="power_plan">Power Plan</option>
          <option value="coordination_plan">Coordination Plan</option>
        </select>
      </label>

      {el.planViewSubtype === 'area_plan' ? (
        <label className={LABEL_CLS}>
          <span>Area Scheme</span>
          <select
            className={INPUT_CLS}
            value={el.areaScheme ?? 'gross_building'}
            onChange={(e) => onPersistProperty('areaScheme', e.target.value)}
            data-testid="inspector-plan-view-area-scheme"
          >
            <option value="gross_building">Gross Building</option>
            <option value="net">Net</option>
            <option value="rentable">Rentable</option>
          </select>
        </label>
      ) : null}

      <label className={LABEL_CLS}>
        <span>Room Labels</span>
        <input
          type="checkbox"
          checked={el.planShowRoomLabels ?? false}
          onChange={(e) => onPersistProperty('planShowRoomLabels', String(e.target.checked))}
          data-testid="inspector-plan-show-room-labels"
        />
      </label>

      <label className={LABEL_CLS}>
        <span>Opening Tags</span>
        <input
          type="checkbox"
          checked={el.planShowOpeningTags ?? false}
          onChange={(e) => onPersistProperty('planShowOpeningTags', String(e.target.checked))}
          data-testid="inspector-plan-show-opening-tags"
        />
      </label>

      <label className={LABEL_CLS}>
        <span>Room Fill Opacity</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={el.planRoomFillOpacityScale ?? 1}
            key={`pv-rfill-${el.id}-${el.planRoomFillOpacityScale ?? 1}-${revision}`}
            className="w-24"
            onBlur={(e) => onPersistProperty('planRoomFillOpacityScale', e.target.value)}
            data-testid="inspector-plan-room-fill-opacity"
          />
          <span className="font-mono text-[10px]">
            {((el.planRoomFillOpacityScale ?? 1) * 100).toFixed(0)}%
          </span>
        </div>
      </label>

      <label className={LABEL_CLS}>
        <span>Detail Level</span>
        <select
          className={INPUT_CLS}
          value={el.planDetailLevel ?? ''}
          onChange={(e) => onPersistProperty('planDetailLevel', e.target.value)}
          data-testid="inspector-plan-detail-level"
        >
          <option value="">{pv('none')} (inherit)</option>
          <option value="coarse">Coarse</option>
          <option value="medium">Medium</option>
          <option value="fine">Fine</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        <span>Phase Filter</span>
        <select
          className={INPUT_CLS}
          value={el.phaseFilter ?? ''}
          onChange={(e) => onPersistProperty('phaseFilter', e.target.value)}
          data-testid="inspector-plan-phase-filter"
        >
          <option value="">— none —</option>
          <option value="all">All</option>
          <option value="existing">Existing</option>
          <option value="demolition">Demolition</option>
          <option value="new">New Construction</option>
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
          <div className={LABEL_CLS}>
            <span>View Template</span>
            <button
              type="button"
              data-testid="inspector-save-as-template"
              onClick={() =>
                onPersistProperty(
                  '__saveAsTemplate__',
                  JSON.stringify({
                    name: `Copy of ${el.name}`,
                    detailLevel: el.planDetailLevel ?? null,
                    phaseFilter: ((el as Record<string, unknown>).phaseFilter as string) ?? null,
                  }),
                )
              }
              style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
              title="Create a new view template from this view's current settings"
            >
              Save as Template…
            </button>
          </div>
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
            {
              key: 'viewRangeBottomMm',
              label: pv('rangeBottom'),
              val: el.viewRangeBottomMm,
              defaultVal: -500,
              testid: 'inspector-plan-view-range-bottom',
              ariaLabel: 'View range bottom in mm',
            },
            {
              key: 'viewRangeTopMm',
              label: pv('rangeTop'),
              val: el.viewRangeTopMm,
              defaultVal: 2000,
              testid: 'inspector-plan-view-range-top',
              ariaLabel: 'View range top in mm',
            },
            {
              key: 'cutPlaneOffsetMm',
              label: pv('cutPlaneOffset'),
              val: el.cutPlaneOffsetMm,
              defaultVal: 1200,
              testid: 'inspector-plan-view-cut-plane',
              ariaLabel: 'Cut plane offset in mm',
            },
          ] as {
            key: string;
            label: string;
            val: number | null | undefined;
            defaultVal: number;
            testid: string;
            ariaLabel: string;
          }[]
        ).map(({ key, label, val, defaultVal, testid, ariaLabel }) => (
          <label key={key} className={LABEL_CLS}>
            {label}
            <input
              type="number"
              className={INPUT_CLS}
              defaultValue={val ?? defaultVal}
              key={`${key}-${el.id}-${val ?? 'null'}-${revision}`}
              step={100}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== '') onPersistProperty(key, v);
              }}
              data-testid={testid}
              aria-label={ariaLabel}
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
  const roomPropString = (key: string): string => {
    const value = el.props?.[key];
    if (value == null) return '';
    return typeof value === 'string' ? value : String(value);
  };
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
  const architectureFields: {
    key: string;
    label: string;
    val: string;
  }[] = [
    { key: 'roomFunction', label: r('roomFunction'), val: roomPropString('roomFunction') },
    { key: 'finishSetId', label: r('finishSetId'), val: roomPropString('finishSetId') },
    { key: 'designIntent', label: r('designIntent'), val: roomPropString('designIntent') },
    {
      key: 'documentationStatus',
      label: r('documentationStatus'),
      val: roomPropString('documentationStatus'),
    },
    { key: 'occupancyNotes', label: r('occupancyNotes'), val: roomPropString('occupancyNotes') },
    { key: 'roomBounding', label: r('roomBounding'), val: roomPropString('roomBounding') },
  ];
  const consultantBadges = [
    ['Fire', roomPropString('fireRating') || roomPropString('fireResistanceRating')],
    ['Acoustic', roomPropString('acousticRating') || roomPropString('stcRating')],
    ['Energy', roomPropString('energyZone') || roomPropString('heatingStatus')],
    ['Cost', roomPropString('costCode') || roomPropString('costGroup')],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

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
      {architectureFields.map(({ key, label, val }) => (
        <label key={key} className={LABEL_CLS}>
          {label}
          <input
            className={INPUT_CLS}
            defaultValue={val}
            key={`rm-prop-${key}-${el.id}-${val}-${revision}`}
            data-testid={`inspector-room-${key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`}
            onBlur={(e) => onPersistProperty(key, e.target.value.trim())}
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
      <label className={LABEL_CLS}>
        Room fill override
        <input
          className={INPUT_CLS}
          defaultValue={el.roomFillOverrideHex ?? ''}
          key={`rm-fill-${el.id}-${el.roomFillOverrideHex ?? 'none'}-${revision}`}
          placeholder="#RRGGBB"
          pattern="^#[0-9a-fA-F]{6}$"
          data-testid="inspector-room-fill-override"
          onBlur={(e) => onPersistProperty('roomFillOverrideHex', e.target.value.trim())}
        />
      </label>
      <label className={LABEL_CLS}>
        Room fill pattern
        <select
          className={INPUT_CLS}
          value={el.roomFillPatternOverride ?? ''}
          key={`rm-fill-pattern-${el.id}-${el.roomFillPatternOverride ?? 'none'}-${revision}`}
          data-testid="inspector-room-fill-pattern-override"
          onChange={(e) => onPersistProperty('roomFillPatternOverride', e.target.value)}
        >
          <option value="">View default</option>
          <option value="solid">Solid</option>
          <option value="hatch_45">45 degree hatch</option>
          <option value="hatch_90">90 degree hatch</option>
          <option value="crosshatch">Crosshatch</option>
          <option value="dots">Dots</option>
        </select>
      </label>
      {consultantBadges.length ? (
        <div
          className="flex flex-wrap gap-1.5 border-b border-border py-1.5"
          data-testid="inspector-room-consultant-badges"
        >
          {consultantBadges.map(([label, value]) => (
            <span
              key={label}
              className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted"
              title={`${label}: ${value}`}
            >
              <span className="font-medium text-foreground">{label}</span> {value}
            </span>
          ))}
        </div>
      ) : null}
      {el.volumeM3 != null ? (
        <FieldRow label={f('volume')} value={`${el.volumeM3.toFixed(3)} m³`} />
      ) : null}
      {el.phaseCreated ? <FieldRow label={f('phaseCreated')} value={el.phaseCreated} /> : null}
      {el.phaseDemolished ? (
        <FieldRow label={f('phaseDemolished')} value={el.phaseDemolished} />
      ) : null}
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
  onDuplicateType,
  onDisciplineChange,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  el: Extract<Element, { kind: 'door' }>;
  revision: number;
  elementsById?: Record<string, Element>;
  onPersistProperty: (key: string, value: string) => void;
  onCreateType?: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onDuplicateType?: (familyTypeId: string | null | undefined) => void;
  onDisciplineChange?: (discipline: DisciplineTag | null) => void;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
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
      <div className="flex flex-wrap gap-2">
        {onCreateType && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[10px] text-accent hover:underline"
          >
            + New custom type…
          </button>
        ) : null}
        {onDuplicateType && el.familyTypeId ? (
          <button
            type="button"
            data-testid="inspector-door-duplicate-type"
            onClick={() => onDuplicateType(el.familyTypeId)}
            className="text-[10px] text-accent hover:underline"
          >
            Duplicate type
          </button>
        ) : null}
      </div>
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
      <MaterialAssignmentRow
        label="Material"
        materialKey={el.materialKey ?? null}
        fallback="By family/category"
        elementsById={elementsById}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <MaterialSlotsSection
        elementId={el.id}
        slots={el.materialSlots}
        rows={[
          { slot: 'frame', label: 'Frame' },
          { slot: 'panel', label: 'Panel' },
          { slot: 'hardware', label: 'Hardware' },
          { slot: 'threshold', label: 'Threshold' },
        ]}
        elementsById={elementsById}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
      <FieldRow label={f('wall')} value={resolveElName(el.wallId, elementsById)} />
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
  onDuplicateType,
  onDisciplineChange,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  el: Extract<Element, { kind: 'window' }>;
  revision: number;
  elementsById?: Record<string, Element>;
  onPersistProperty: (key: string, value: string) => void;
  onCreateType?: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onDuplicateType?: (familyTypeId: string | null | undefined) => void;
  onDisciplineChange?: (discipline: DisciplineTag | null) => void;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
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
      <div className="flex flex-wrap gap-2">
        {onCreateType && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[10px] text-accent hover:underline"
          >
            + New custom type…
          </button>
        ) : null}
        {onDuplicateType && el.familyTypeId ? (
          <button
            type="button"
            data-testid="inspector-window-duplicate-type"
            onClick={() => onDuplicateType(el.familyTypeId)}
            className="text-[10px] text-accent hover:underline"
          >
            Duplicate type
          </button>
        ) : null}
      </div>
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
      <MaterialAssignmentRow
        label="Material"
        materialKey={el.materialKey ?? null}
        fallback="By family/category"
        elementsById={elementsById}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <MaterialSlotsSection
        elementId={el.id}
        slots={el.materialSlots}
        rows={[
          { slot: 'frame', label: 'Frame' },
          { slot: 'sash', label: 'Sash' },
          { slot: 'glass', label: 'Glass', fallback: 'Default clear glass' },
          { slot: 'spacer', label: 'Spacer' },
          { slot: 'hardware', label: 'Hardware' },
          { slot: 'shading', label: 'Shading' },
        ]}
        elementsById={elementsById}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />
      <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
      <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
      <FieldRow label={f('sillHeight')} value={fmtMm(el.sillHeightMm)} />
      <FieldRow label={f('wall')} value={resolveElName(el.wallId, elementsById)} />
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

      <div className="rounded border border-border">
        <div className="grid grid-cols-[1fr_54px_44px] gap-1 border-b border-border px-2 py-1 text-[9px] font-semibold uppercase text-muted">
          <span>Property</span>
          <span>Include</span>
          <span>Lock</span>
        </div>
        {VIEW_TEMPLATE_CONTROL_FIELDS.map(({ field, label }) => {
          const control = viewTemplateControlState(el, field);
          return (
            <div
              key={field}
              className="grid grid-cols-[1fr_54px_44px] items-center gap-1 px-2 py-1 text-[10px]"
            >
              <span className="truncate text-muted">{label}</span>
              <input
                type="checkbox"
                data-testid={`inspector-vt-control-${field}-include`}
                aria-label={`${label} include`}
                checked={control.included}
                onChange={(e) => {
                  const included = e.target.checked;
                  onPersistProperty(
                    '__updateViewTemplate__',
                    viewTemplateControlPatch(field, included, included ? control.locked : false),
                  );
                }}
              />
              <input
                type="checkbox"
                data-testid={`inspector-vt-control-${field}-lock`}
                aria-label={`${label} lock`}
                checked={control.locked}
                disabled={!control.included}
                onChange={(e) => {
                  onPersistProperty(
                    '__updateViewTemplate__',
                    viewTemplateControlPatch(field, control.included, e.target.checked),
                  );
                }}
              />
            </div>
          );
        })}
      </div>

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
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ scale: n }));
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
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ detailLevel: v || null }));
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
              onPersistProperty('__updateViewTemplate__', JSON.stringify({ phase: v || null }));
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
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ phaseFilter: v || null }));
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

/** Editable inspector for project_settings elements (F-096 partial). */
export function InspectorProjectSettingsEditor({
  el,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'project_settings' }>;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        <span>Checkpoint Retention</span>
        <input
          className={INPUT_CLS}
          type="number"
          min={MIN_CHECKPOINT_RETENTION_LIMIT}
          max={MAX_CHECKPOINT_RETENTION_LIMIT}
          defaultValue={String(el.checkpointRetentionLimit ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT)}
          key={`checkpoint-retention-${el.id}-${el.checkpointRetentionLimit ?? 'default'}`}
          onBlur={(e) => {
            const next = coerceCheckpointRetentionLimit(e.target.value);
            e.currentTarget.value = String(next);
            if (next !== (el.checkpointRetentionLimit ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT)) {
              onPersistProperty('checkpointRetentionLimit', String(next));
            }
          }}
          data-testid="inspector-checkpoint-retention-limit"
        />
      </label>
      <p className="text-[10px] leading-4 text-muted">
        Retained database checkpoints; equivalent to Revit maximum backups for this project.
      </p>
      <label className={LABEL_CLS}>
        <span>Volume Computed At</span>
        <select
          className={INPUT_CLS}
          value={el.volumeComputedAt ?? 'finish_faces'}
          onChange={(e) => onPersistProperty('volumeComputedAt', e.target.value)}
          data-testid="inspector-volume-computed-at"
        >
          <option value="finish_faces">Finish Faces</option>
          <option value="core_faces">Core Faces</option>
        </select>
      </label>
      <label className={LABEL_CLS}>
        <span>Room Area Computation</span>
        <select
          className={INPUT_CLS}
          value={el.roomAreaComputationBasis ?? 'wall_finish'}
          onChange={(e) => onPersistProperty('roomAreaComputationBasis', e.target.value)}
          data-testid="inspector-room-area-computation"
        >
          <option value="wall_finish">At Wall Finish</option>
          <option value="wall_centerline">At Wall Centerline</option>
          <option value="wall_core_layer">At Wall Core Layer</option>
          <option value="wall_core_center">At Wall Core Center</option>
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
