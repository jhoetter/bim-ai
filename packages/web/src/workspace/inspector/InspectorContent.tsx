import { useState, type JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type {
  DisciplineTag,
  Element,
  FamilySweptBlend,
  ViewTemplateControlledField,
} from '@bim-ai/core';

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
import { roomAreaM2, roomNetAreaM2 } from '../../plan/roomArea';
import {
  getBuiltInWallType,
  resolveWallAssemblyExposedLayers,
} from '../../families/wallTypeCatalog';
import {
  materialTargetLayerIndex,
  topLayerIndex,
  wallTypeExteriorLayerIndex,
} from '../../viewport/hostMaterialLayerTargets';
import { resolveMaterial } from '../../viewport/materials';
import { PlanViewGraphicsMatrix } from './PlanViewGraphicsMatrix';
import { SavedViewTagGraphicsAuthoring, SavedViewTemplateGraphicsAuthoring } from '../authoring';
import { computeFloorTypeThicknessMm } from '../../tools/floorTypeThickness';
import { WallTypeLayerEditor } from '../families/WallTypeLayerEditor';
import { stairBoundaryMm } from '../../plan/stairBoundingBox';
import { angleBetweenVectors } from '../../plan/measureGeometry';
import { getStairComponents } from '../../plan/stairComponentList';
import { buildShaftSideWalls } from '../../plan/buildShaftSideWalls';

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

function FaceMaterialOverridesSection({
  elementId,
  overrides,
  elementsById,
  onDispatchCommand,
}: {
  elementId: string;
  overrides: Record<string, string> | null | undefined;
  elementsById: Record<string, Element>;
  onDispatchCommand?: (cmd: Record<string, unknown>) => void;
}): JSX.Element | null {
  if (!overrides || Object.keys(overrides).length === 0) return null;
  return (
    <div data-testid="inspector-face-overrides" className="border-t border-border pt-1.5">
      <div className="mb-1 text-xs text-muted">Face Material Overrides</div>
      <div className="flex flex-col gap-1">
        {Object.entries(overrides).map(([faceId, materialId]) => {
          const mat = elementsById[materialId];
          const matName =
            mat && 'name' in mat && typeof mat.name === 'string' ? mat.name : materialId;
          return (
            <div
              key={faceId}
              data-testid={`face-override-${faceId}`}
              className="flex items-center justify-between gap-2 py-0.5"
            >
              <span className="text-xs text-muted">{faceId}</span>
              <span className="text-xs text-foreground">{matName}</span>
              <button
                type="button"
                data-testid={`face-override-remove-${faceId}`}
                className="text-xs text-muted hover:text-foreground"
                onClick={() =>
                  onDispatchCommand?.({
                    type: 'paint_face',
                    elementId,
                    faceId,
                    materialId: null,
                  })
                }
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  if (type?.kind === 'wall_type') {
    return type.layers[wallTypeExteriorLayerIndex(type)]?.materialKey ?? null;
  }
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
  return type?.kind === 'roof_type'
    ? (type.layers[topLayerIndex(type)]?.materialKey ?? null)
    : null;
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
  const mep = el as Record<string, unknown>;
  return (
    <>
      <FieldRow label="System Type" value={(mep.systemType as string | null | undefined) ?? '—'} />
      <FieldRow label="System Name" value={(mep.systemName as string | null | undefined) ?? '—'} />
      <FieldRow
        label="Flow Direction"
        value={(mep.flowDirection as string | null | undefined) ?? '—'}
      />
      <FieldRow
        label="Service Level"
        value={(mep.serviceLevel as string | null | undefined) ?? '—'}
      />
      <FieldRow label="Insulation" value={mep.insulation ? 'Yes' : '—'} />
      <FieldRow
        label="Connectors"
        value={String((mep.connectors as unknown[] | undefined)?.length ?? 0)}
        mono
      />
      {mep.clearanceZone ? <FieldRow label="Clearance Zone" value="Defined" /> : null}
      {mep.maintainAccessZone ? <FieldRow label="Access Zone" value="Defined" /> : null}
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

function PhaseSection({
  phaseCreated,
  phaseDemolished,
  phases,
  onPropertyChange,
}: {
  phaseCreated: string | null | undefined;
  phaseDemolished: string | null | undefined;
  phases: Extract<Element, { kind: 'phase' }>[];
  onPropertyChange?: (property: string, value: unknown) => void;
}): JSX.Element {
  const sorted = [...phases].sort((a, b) => a.ord - b.ord);
  return (
    <>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Phase Created</span>
        <select
          data-testid="inspector-phase-created"
          className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
          value={phaseCreated ?? ''}
          onChange={(e) => onPropertyChange?.('phaseCreated', e.target.value || null)}
        >
          <option value="">—</option>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Phase Demolished</span>
        <select
          data-testid="inspector-phase-demolished"
          className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
          value={phaseDemolished ?? ''}
          onChange={(e) => onPropertyChange?.('phaseDemolished', e.target.value || null)}
        >
          <option value="">—</option>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function FloorNewTypeRow({
  onPropertyChange,
  onDispatchCommand,
}: {
  floorId: string;
  onPropertyChange?: (property: string, value: unknown) => void;
  onDispatchCommand?: (cmd: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('New Floor Type');
  if (!open) {
    return (
      <button
        type="button"
        data-testid="inspector-floor-new-type"
        className="self-start text-xs text-muted hover:text-foreground border border-border rounded px-2 py-0.5"
        onClick={() => setOpen(true)}
      >
        New Floor Type…
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        data-testid="inspector-floor-new-type-name"
        className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="button"
        data-testid="inspector-floor-new-type-confirm"
        className="shrink-0 text-xs border border-border rounded px-2 py-0.5 hover:bg-surface-strong"
        onClick={() => {
          const newId = crypto.randomUUID();
          onDispatchCommand?.({
            type: 'create_floor_type',
            id: newId,
            name: name.trim() || 'New Floor Type',
            layers: [{ thicknessMm: 200, function: 'structure', materialKey: null }],
          });
          onPropertyChange?.('floorTypeId', newId);
          setOpen(false);
          setName('New Floor Type');
        }}
      >
        Create
      </button>
      <button
        type="button"
        className="shrink-0 text-xs text-muted hover:text-foreground"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
    </div>
  );
}

function WallPartsPanel({
  wall,
  elementsById,
  onPropertyChange,
}: {
  wall: Extract<Element, { kind: 'wall' }>;
  elementsById: Record<string, Element>;
  onPropertyChange?: (property: string, value: unknown) => void;
}): JSX.Element | null {
  const [createCount, setCreateCount] = useState(3);

  if (!wall.parts || wall.parts.length === 0) return null;

  const wallLengthMm = Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);

  const materials = Object.values(elementsById)
    .filter((e): e is Extract<Element, { kind: 'material' }> => e.kind === 'material')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="border-t border-border pt-1.5">
      <div className="mb-1 text-xs text-muted">Parts</div>
      <div className="flex flex-col gap-1">
        {wall.parts.map((part, i) => {
          const lengthMm = ((part.endT - part.startT) * wallLengthMm).toFixed(0);
          return (
            <div key={part.id} className="flex flex-col gap-1 pb-1 mb-0.5">
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-20 shrink-0">Label</span>
                <input
                  type="text"
                  data-testid={`inspector-part-label-${i}`}
                  className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={part.label ?? `Part ${i + 1}`}
                  key={`${part.id}-label`}
                  onBlur={(e) => {
                    const updated = wall.parts!.map((p, j) =>
                      j === i ? { ...p, label: e.currentTarget.value || null } : p,
                    );
                    onPropertyChange?.('parts', updated);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-20 shrink-0">Material</span>
                <select
                  data-testid={`inspector-part-material-${i}`}
                  className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={part.materialId ?? ''}
                  onChange={(e) => {
                    const updated = wall.parts!.map((p, j) =>
                      j === i ? { ...p, materialId: e.target.value || null } : p,
                    );
                    onPropertyChange?.('parts', updated);
                  }}
                >
                  <option value="">— (none) —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span
                  data-testid={`inspector-part-length-${i}`}
                  className="text-xs text-foreground"
                >
                  {lengthMm} mm
                </span>
                <button
                  type="button"
                  data-testid={`inspector-part-remove-${i}`}
                  className="ml-auto text-xs text-muted hover:text-foreground border border-border rounded px-1.5 py-0.5"
                  onClick={() => {
                    const updated = wall.parts!.filter((p) => p.id !== part.id);
                    onPropertyChange?.('parts', updated.length > 0 ? updated : null);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-2 py-0.5">
          <input
            type="number"
            min={2}
            max={20}
            className="w-12 text-xs bg-surface border border-border rounded px-1 py-0.5"
            value={createCount}
            onChange={(e) => setCreateCount(Number(e.target.value))}
          />
          <button
            type="button"
            data-testid="inspector-parts-create"
            className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
            onClick={() => {
              const n = Math.max(1, Math.floor(createCount));
              const newParts = Array.from({ length: n }, (_, idx) => ({
                id: crypto.randomUUID(),
                startT: parseFloat((idx / n).toFixed(10)),
                endT: parseFloat(((idx + 1) / n).toFixed(10)),
              }));
              onPropertyChange?.('parts', newParts);
            }}
          >
            Create {createCount} Equal Parts
          </button>
        </div>
      </div>
    </div>
  );
}

/** Look up a human-readable name for an element ID, falling back to the raw ID. */
function StairAssemblySection({
  stairId,
  elementsById,
  onSemanticCommand,
}: {
  stairId: string;
  elementsById: Record<string, Element>;
  onSemanticCommand?: (cmd: any) => void;
}) {
  const { runs, landings } = getStairComponents(stairId, elementsById);

  return (
    <details style={{ marginTop: 8 }}>
      <summary
        data-testid="inspector-stair-assembly-summary"
        style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
      >
        Assembly ({runs.length} runs, {landings.length} landings)
      </summary>
      <div style={{ marginTop: 6 }}>
        {runs.map((run, i) => (
          <div
            key={run.id}
            data-testid={`inspector-stair-run-row-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 2 }}
          >
            <span>
              Run {i + 1}: {(run as any).riserCount ?? '?'} risers, {(run as any).runWidthMm ?? '?'}
              mm wide
            </span>
            <button
              data-testid={`inspector-stair-run-remove-${i}`}
              onClick={() =>
                onSemanticCommand?.({ type: 'removeStairComponent', componentId: run.id })
              }
              style={{ color: '#f87171', fontSize: 10 }}
            >
              ✕
            </button>
          </div>
        ))}
        {landings.map((landing, i) => (
          <div
            key={landing.id}
            data-testid={`inspector-stair-landing-row-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 2 }}
          >
            <span>
              Landing {i + 1}: {(landing as any).depthMm ?? (landing as any).elevationMm ?? '?'}mm
            </span>
            <button
              data-testid={`inspector-stair-landing-remove-${i}`}
              onClick={() =>
                onSemanticCommand?.({ type: 'removeStairComponent', componentId: landing.id })
              }
              style={{ color: '#f87171', fontSize: 10 }}
            >
              ✕
            </button>
          </div>
        ))}
        {runs.length === 0 && landings.length === 0 && (
          <p data-testid="inspector-stair-assembly-empty" style={{ fontSize: 11, color: '#888' }}>
            No components. Use the Stair by Component tool to add runs and landings.
          </p>
        )}
        <button
          data-testid="inspector-stair-add-run-btn"
          onClick={() =>
            onSemanticCommand?.({
              type: 'addStairRun',
              run: {
                id: crypto.randomUUID(),
                kind: 'stair_run',
                stairId,
                riserCount: 10,
                runWidthMm: 1200,
                runIndex: 0,
                startMm: { xMm: 0, yMm: 0 },
                endMm: { xMm: 0, yMm: 3000 },
              },
            })
          }
          style={{ fontSize: 11, marginTop: 4, marginRight: 8 }}
        >
          + Add Run
        </button>
        <button
          data-testid="inspector-stair-add-landing-btn"
          onClick={() =>
            onSemanticCommand?.({
              type: 'addStairLanding',
              landing: {
                id: crypto.randomUUID(),
                kind: 'stair_landing',
                stairId,
                landingIndex: 0,
                elevationMm: 0,
                perimeterMm: [
                  { xMm: 0, yMm: 0 },
                  { xMm: 1200, yMm: 0 },
                  { xMm: 1200, yMm: 1200 },
                  { xMm: 0, yMm: 1200 },
                ],
              },
            })
          }
          style={{ fontSize: 11, marginTop: 4 }}
        >
          + Add Landing
        </button>
      </div>
    </details>
  );
}

function ShaftSideWallsButton({
  shaft,
  onDispatchCommand,
}: {
  shaft: Extract<Element, { kind: 'shaft' }>;
  onDispatchCommand?: (cmd: Record<string, unknown>) => void;
}) {
  const [sideWallsAdded, setSideWallsAdded] = useState<number | null>(null);
  return (
    <>
      <button
        type="button"
        className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
        data-testid="inspector-shaft-add-side-walls"
        style={{ marginTop: 8 }}
        onClick={() => {
          const walls = buildShaftSideWalls(shaft as any, (shaft as any).baseLevelId ?? 'L1');
          for (const wall of walls) {
            onDispatchCommand?.({ type: 'createElement', element: wall });
          }
          setSideWallsAdded(walls.length);
        }}
      >
        Add Side Walls
      </button>
      {sideWallsAdded !== null && (
        <p
          data-testid="inspector-shaft-side-walls-added"
          style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}
        >
          {sideWallsAdded} side walls added
        </p>
      )}
    </>
  );
}

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
    onEditBoundary?: (element: Extract<Element, { kind: 'floor' | 'roof' | 'ceiling' }>) => void;
    onOpenMaterialBrowser?: OpenMaterialBrowser;
    onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
    onEditCurtainGrid?: (wallId: string) => void;
    onDispatchCommand?: (cmd: Record<string, unknown>) => void;
  },
): JSX.Element {
  const elementsById = options?.elementsById ?? {};
  const onMonitorReconcile = options?.onMonitorReconcile;
  const onDisciplineChange = options?.onDisciplineChange;
  const onEditType = options?.onEditType;
  const onOpenMaterialBrowser = options?.onOpenMaterialBrowser;
  const onOpenAppearanceAssetBrowser = options?.onOpenAppearanceAssetBrowser;
  const onEditCurtainGrid = options?.onEditCurtainGrid;
  const onDispatchCommand = options?.onDispatchCommand;
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
    case 'wall': {
      const { elementsById = {}, onPropertyChange } = options ?? {};
      const roofs = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'roof' }> => e.kind === 'roof',
      );
      const wallPhases = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
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
            <span className="text-xs text-muted w-28 shrink-0">Top Constraint</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.topConstraintLevelId ?? ''}
              onChange={(e) => onPropertyChange?.('topConstraintLevelId', e.target.value || null)}
              data-testid="inspector-wall-top-level"
            >
              <option value="">Unconnected</option>
              {Object.values(elementsById)
                .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
                .sort((a, b) => a.elevationMm - b.elevationMm)
                .map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
            </select>
          </div>
          {el.topConstraintLevelId && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Top Offset (mm)</span>
              <input
                type="number"
                className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                defaultValue={el.topConstraintOffsetMm ?? 0}
                key={`${el.id}-top`}
                step={1}
                min={-10000}
                max={10000}
                onBlur={(e) =>
                  onPropertyChange?.('topConstraintOffsetMm', Number(e.currentTarget.value))
                }
                data-testid="inspector-wall-top-offset"
              />
            </div>
          )}
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />

          <details open={el.slopeAngleDeg != null && el.slopeAngleDeg !== 0} className="py-0.5">
            <summary className="text-xs text-muted cursor-pointer select-none">
              Profile &amp; Slope
            </summary>
            <div className="flex flex-col gap-2 mt-1 pl-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted w-28 shrink-0">Slope (°)</span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={el.slopeAngleDeg ?? 0}
                  key={`${el.id}-slope`}
                  step={0.5}
                  min={-45}
                  max={45}
                  placeholder="0° (plumb)"
                  onBlur={(e) => onPropertyChange?.('slopeAngleDeg', Number(e.currentTarget.value))}
                  data-testid="inspector-wall-slope-angle"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted w-28 shrink-0">Top thickness (mm)</span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={el.topThicknessMm ?? ''}
                  key={`${el.id}-topthick`}
                  step={10}
                  min={1}
                  placeholder="(same as base)"
                  onBlur={(e) => {
                    const v = e.currentTarget.value;
                    onPropertyChange?.('topThicknessMm', v === '' ? null : Number(v));
                  }}
                  data-testid="inspector-wall-top-thickness"
                />
              </div>
              <button
                type="button"
                className="text-xs text-muted underline text-left w-fit"
                data-testid="inspector-wall-reset-slope"
                onClick={() => {
                  onPropertyChange?.('slopeAngleDeg', 0);
                  onPropertyChange?.('topThicknessMm', null);
                }}
              >
                Reset to plumb/rectangular
              </button>
            </div>
          </details>

          <details className="py-0.5">
            <summary className="text-xs text-muted cursor-pointer select-none">
              Edit Profile
            </summary>
            <div className="flex flex-col gap-2 mt-1 pl-1">
              <button
                type="button"
                className="text-xs text-muted underline text-left w-fit"
                data-testid="inspector-wall-edit-profile"
                onClick={() => onPropertyChange?.('editProfileActive', true)}
              >
                Edit Profile
              </button>
              {el.profilePoints && el.profilePoints.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted underline text-left w-fit"
                  data-testid="inspector-wall-reset-profile"
                  onClick={() => onPropertyChange?.('profilePoints', [])}
                >
                  Reset to Rectangular
                </button>
              )}
              {el.profilePoints && (
                <span data-testid="inspector-wall-profile-point-count">
                  {el.profilePoints.length} profile points
                </span>
              )}
            </div>
          </details>

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
                  data-testid="inspector-curtain-v-grid-count"
                  className="w-16 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={el.curtainWallData?.gridV?.count ?? el.curtainWallVCount ?? ''}
                  placeholder="auto"
                  onChange={(e2) => {
                    const v = e2.target.value === '' ? undefined : Number(e2.target.value);
                    if (onDispatchCommand) {
                      onDispatchCommand({
                        type: 'update_curtain_grid',
                        wallId: el.id,
                        vGridCount: v,
                      });
                    } else {
                      onPropertyChange?.(
                        'curtainWallVCount',
                        e2.target.value === '' ? null : Number(e2.target.value),
                      );
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">{f('cwHCount')}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  data-testid="inspector-curtain-h-grid-count"
                  className="w-16 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={el.curtainWallData?.gridH?.count ?? el.curtainWallHCount ?? ''}
                  placeholder="auto"
                  onChange={(e2) => {
                    const v = e2.target.value === '' ? undefined : Number(e2.target.value);
                    if (onDispatchCommand) {
                      onDispatchCommand({
                        type: 'update_curtain_grid',
                        wallId: el.id,
                        hGridCount: v,
                      });
                    } else {
                      onPropertyChange?.(
                        'curtainWallHCount',
                        e2.target.value === '' ? null : Number(e2.target.value),
                      );
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">{f('cwPanelType')}</span>
                <select
                  data-testid="inspector-curtain-panel-type"
                  className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={el.curtainWallData?.panelType ?? el.curtainWallPanelType ?? ''}
                  onChange={(e2) => {
                    if (onDispatchCommand) {
                      onDispatchCommand({
                        type: 'update_curtain_grid',
                        wallId: el.id,
                        panelType: e2.target.value || undefined,
                      });
                    } else {
                      onPropertyChange?.('curtainWallPanelType', e2.target.value || null);
                    }
                  }}
                >
                  <option value="">— Default —</option>
                  <option value="glass">Glass</option>
                  <option value="solid">Solid</option>
                  <option value="empty">Empty</option>
                </select>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">{f('cwMullionType')}</span>
                <select
                  data-testid="inspector-curtain-mullion-type"
                  className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={el.curtainWallData?.mullionType ?? el.curtainWallMullionType ?? ''}
                  onChange={(e2) => {
                    if (onDispatchCommand) {
                      onDispatchCommand({
                        type: 'update_curtain_grid',
                        wallId: el.id,
                        mullionType: e2.target.value || undefined,
                      });
                    } else {
                      onPropertyChange?.('curtainWallMullionType', e2.target.value || null);
                    }
                  }}
                >
                  <option value="">— Default —</option>
                  <option value="rectangular">Rectangular</option>
                  <option value="circular">Circular</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <button
                  type="button"
                  data-testid="inspector-edit-curtain-grid"
                  className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
                  onClick={() => onEditCurtainGrid?.(el.id)}
                >
                  Edit Grid…
                </button>
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
          <WallPartsPanel
            wall={el}
            elementsById={elementsById}
            onPropertyChange={onPropertyChange}
          />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
          <PhaseSection
            phaseCreated={el.phaseCreated}
            phaseDemolished={el.phaseDemolished}
            phases={wallPhases}
            onPropertyChange={onPropertyChange}
          />
          <div className="border-t border-border pt-1.5">
            <div className="mb-1 text-xs text-muted">Graphics Override</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Fill color</span>
                <input
                  type="color"
                  className="h-6 w-10 cursor-pointer rounded border border-border"
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.graphicsOverride?.fillColorHex ?? '#000000'}
                  key={`${el.id}-fill-color-${el.graphicsOverride?.fillColorHex ?? 'none'}`}
                  onChange={(e) =>
                    onPropertyChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      fillColorHex: e.target.value,
                    })
                  }
                  data-testid="inspector-override-fill-color"
                />
                <button
                  type="button"
                  className="text-xs rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground"
                  onClick={() =>
                    onPropertyChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      fillColorHex: null,
                    })
                  }
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Surface color</span>
                <input
                  type="color"
                  className="h-6 w-10 cursor-pointer rounded border border-border"
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.graphicsOverride?.surfaceColorHex ?? '#000000'}
                  key={`${el.id}-surface-color-${el.graphicsOverride?.surfaceColorHex ?? 'none'}`}
                  onChange={(e) =>
                    onPropertyChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      surfaceColorHex: e.target.value,
                    })
                  }
                  data-testid="inspector-override-surface-color"
                />
                <button
                  type="button"
                  className="text-xs rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground"
                  onClick={() =>
                    onPropertyChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      surfaceColorHex: null,
                    })
                  }
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          {/* Cut geometry readout */}
          {(el as any).cutBy?.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary
                data-testid="inspector-cut-by-summary"
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                Cut By ({(el as any).cutBy.length})
              </summary>
              <div style={{ marginTop: 4 }}>
                {(el as any).cutBy.map((cutterId: string, i: number) => (
                  <div
                    key={cutterId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      marginBottom: 2,
                    }}
                  >
                    <span data-testid={`inspector-cut-by-id-${i}`} style={{ color: '#aaa' }}>
                      {cutterId.slice(-8)}
                    </span>
                    <button
                      data-testid={`inspector-cut-by-remove-${i}`}
                      onClick={() =>
                        onSemanticCommand?.({ type: 'removeCutGeometry', cutterId, hostId: el.id })
                      }
                      style={{ color: '#f87171', fontSize: 11 }}
                    >
                      Remove Cut
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
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
        floorType?.kind === 'floor_type'
          ? (floorType.layers[topLayerIndex(floorType)]?.materialKey ?? null)
          : null;
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label={f('thickness')} value={fmtMm(el.thicknessMm)} />
          <FieldRow label={f('structureThickness')} value={fmtMm(el.structureThicknessMm)} />
          <FieldRow label={f('finishThickness')} value={fmtMm(el.finishThicknessMm)} />
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label={f('boundaryPoints')} value={String(el.boundaryMm.length)} />
          {options?.onEditBoundary ? (
            <div
              className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1.5"
              data-testid="inspector-floor-boundary-actions"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">Boundary</div>
                <div className="text-[10px] text-muted">Plan vertex grips</div>
              </div>
              <button
                type="button"
                data-testid="inspector-floor-edit-boundary"
                className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
                onClick={() => options.onEditBoundary?.(el)}
              >
                Edit Boundary
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('floorType')}</span>
            <select
              data-testid="inspector-floor-type-select"
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.floorTypeId ?? ''}
              onChange={(e2) => floorOnPropertyChange?.('floorTypeId', e2.target.value || null)}
            >
              <option value="">— None —</option>
              {Object.values(floorElementsById)
                .filter(
                  (e): e is Extract<Element, { kind: 'floor_type' }> => e.kind === 'floor_type',
                )
                .sort((a, b) => a.name.localeCompare(b.name))
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
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Type Thickness</span>
            <span data-testid="inspector-floor-type-thickness" className="text-xs text-foreground">
              {floorType?.kind === 'floor_type'
                ? `${computeFloorTypeThicknessMm(floorType)} mm`
                : '—'}
            </span>
          </div>
          <FloorNewTypeRow
            floorId={el.id}
            onPropertyChange={floorOnPropertyChange}
            onDispatchCommand={onDispatchCommand}
          />
          {floorType?.kind === 'floor_type' ? (
            <MaterialAssignmentRow
              label="Type Top Material"
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
          <PhaseSection
            phaseCreated={el.phaseCreated}
            phaseDemolished={el.phaseDemolished}
            phases={Object.values(floorElementsById).filter(
              (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
            )}
            onPropertyChange={floorOnPropertyChange}
          />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Slope</span>
            <input
              type="number"
              step={0.1}
              min={0}
              max={100}
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              data-testid="inspector-floor-slope-percent"
              defaultValue={el.slopePercent ?? 0}
              key={`${el.id}-slope-pct`}
              onBlur={(e) => floorOnPropertyChange?.('slopePercent', Number(e.currentTarget.value))}
            />
            <span className="text-xs text-muted">%</span>
          </div>
          {el.slopeArrowTailMm && el.slopeArrowHeadMm ? (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Slope dir</span>
              <span
                data-testid="inspector-floor-slope-direction"
                className="text-xs text-foreground"
              >
                {(() => {
                  const ddx = el.slopeArrowHeadMm.xMm - el.slopeArrowTailMm.xMm;
                  const ddy = el.slopeArrowHeadMm.yMm - el.slopeArrowTailMm.yMm;
                  const deg = ((Math.atan2(ddx, -ddy) * 180) / Math.PI + 360) % 360;
                  return `${deg.toFixed(0)}°`;
                })()}
              </span>
            </div>
          ) : null}
          <p className="text-[10px] text-muted">Drag slope arrow in plan to set direction.</p>
          <div className="border-t border-border pt-1.5">
            <div className="mb-1 text-xs text-muted">Graphics Override</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Fill color</span>
                <input
                  type="color"
                  className="h-6 w-10 cursor-pointer rounded border border-border"
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.graphicsOverride?.fillColorHex ?? '#000000'}
                  key={`${el.id}-fill-color-${el.graphicsOverride?.fillColorHex ?? 'none'}`}
                  onChange={(e) =>
                    floorOnPropertyChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      fillColorHex: e.target.value,
                    })
                  }
                  data-testid="inspector-override-fill-color"
                />
                <button
                  type="button"
                  className="text-xs rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground"
                  onClick={() =>
                    floorOnPropertyChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      fillColorHex: null,
                    })
                  }
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Surface color</span>
                <input
                  type="color"
                  className="h-6 w-10 cursor-pointer rounded border border-border"
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.graphicsOverride?.surfaceColorHex ?? '#000000'}
                  key={`${el.id}-surface-color-${el.graphicsOverride?.surfaceColorHex ?? 'none'}`}
                  onChange={(e) =>
                    floorOnPropertyChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      surfaceColorHex: e.target.value,
                    })
                  }
                  data-testid="inspector-override-surface-color"
                />
                <button
                  type="button"
                  className="text-xs rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground"
                  onClick={() =>
                    floorOnPropertyChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      surfaceColorHex: null,
                    })
                  }
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          {(() => {
            const availableRoofs = Object.values(floorElementsById).filter(
              (e): e is Extract<Element, { kind: 'roof' }> => e.kind === 'roof',
            );
            if (el.attachedToRoofId) {
              return (
                <button
                  type="button"
                  data-testid="inspector-floor-detach"
                  className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
                  onClick={() =>
                    onDispatchCommand?.({
                      type: 'attach_floor_to_roof',
                      floorId: el.id,
                      roofId: '',
                    })
                  }
                >
                  Detach from Roof
                </button>
              );
            }
            if (availableRoofs.length > 0) {
              return (
                <button
                  type="button"
                  data-testid="inspector-floor-attach"
                  className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
                  onClick={() =>
                    onDispatchCommand?.({
                      type: 'attach_floor_to_roof',
                      floorId: el.id,
                      roofId: availableRoofs[0].id,
                    })
                  }
                >
                  Attach to Roof
                </button>
              );
            }
            return null;
          })()}
          <FaceMaterialOverridesSection
            elementId={el.id}
            overrides={el.faceMaterialOverrides}
            elementsById={elementsById}
            onDispatchCommand={onDispatchCommand}
          />
          <details>
            <summary data-testid="inspector-floor-edge-profile-toggle">Edge Profile</summary>
            <div>
              {(el.edgeProfileMm ?? []).length === 0 ? (
                <span data-testid="inspector-floor-edge-no-profile">No custom profile</span>
              ) : (
                (el.edgeProfileMm ?? []).map((pt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="number"
                      data-testid={`inspector-floor-edge-pt-x-${i}`}
                      value={pt.xMm}
                      onChange={(e) => {
                        const updated = [...(el.edgeProfileMm ?? [])];
                        updated[i] = { ...updated[i]!, xMm: +e.target.value };
                        floorOnPropertyChange?.('edgeProfileMm', updated);
                      }}
                    />
                    <input
                      type="number"
                      data-testid={`inspector-floor-edge-pt-y-${i}`}
                      value={pt.yMm}
                      onChange={(e) => {
                        const updated = [...(el.edgeProfileMm ?? [])];
                        updated[i] = { ...updated[i]!, yMm: +e.target.value };
                        floorOnPropertyChange?.('edgeProfileMm', updated);
                      }}
                    />
                  </div>
                ))
              )}
              <button
                type="button"
                data-testid="inspector-floor-edge-add-pt"
                onClick={() =>
                  floorOnPropertyChange?.('edgeProfileMm', [
                    ...(el.edgeProfileMm ?? []),
                    { xMm: 0, yMm: 0 },
                  ])
                }
              >
                + Point
              </button>
              {(el.edgeProfileMm ?? []).length > 0 && (
                <button
                  type="button"
                  data-testid="inspector-floor-edge-clear"
                  onClick={() => floorOnPropertyChange?.('edgeProfileMm', [])}
                >
                  Clear
                </button>
              )}
            </div>
          </details>
          {el.autoDetectedBoundary && (
            <span data-testid="inspector-floor-auto-boundary">Auto-detected boundary</span>
          )}
          {/* Drainage Slope Points */}
          <details style={{ marginTop: 8 }}>
            <summary
              data-testid="inspector-floor-slope-points-summary"
              style={{ cursor: 'pointer', fontWeight: 600 }}
            >
              Drainage Slope Points ({(el as any).slopePoints?.length ?? 0})
            </summary>
            <div style={{ marginTop: 6 }}>
              {((el as any).slopePoints ?? []).map((pt: any, idx: number) => (
                <div
                  key={pt.id}
                  style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}
                >
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 60 }}>
                    Pt {idx + 1}: ({pt.xMm.toFixed(0)}, {pt.yMm.toFixed(0)})
                  </span>
                  <input
                    type="number"
                    data-testid={`inspector-floor-slope-pt-elevation-${idx}`}
                    value={pt.elevationOffsetMm}
                    style={{ width: 70 }}
                    onChange={(e) =>
                      onDispatchCommand?.({
                        type: 'updateFloorSlopePoint',
                        floorId: el.id,
                        pointId: pt.id,
                        elevationOffsetMm: +e.target.value,
                      })
                    }
                  />
                  <span style={{ fontSize: 11 }}>mm offset</span>
                  <button
                    data-testid={`inspector-floor-slope-pt-remove-${idx}`}
                    onClick={() =>
                      onDispatchCommand?.({
                        type: 'removeFloorSlopePoint',
                        floorId: el.id,
                        pointId: pt.id,
                      })
                    }
                    style={{ color: '#f87171', fontSize: 11 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                data-testid="inspector-floor-add-slope-point"
                onClick={() =>
                  onDispatchCommand?.({
                    type: 'addFloorSlopePoint',
                    floorId: el.id,
                    point: {
                      id: crypto.randomUUID(),
                      xMm: 0,
                      yMm: 0,
                      elevationOffsetMm: -50,
                    },
                  })
                }
                style={{ fontSize: 12, marginTop: 4 }}
              >
                + Add Slope Point
              </button>
            </div>
          </details>
          {/* Sub-floor Pad Thickness */}
          <div className="flex items-center gap-2 py-0.5" style={{ marginTop: 8 }}>
            <span className="text-xs text-muted w-28 shrink-0">Sub-floor Pad</span>
            <input
              data-testid="inspector-floor-sub-thickness"
              type="number"
              min={0}
              step={10}
              className="w-20 text-sm bg-transparent border-b border-border/40 focus:outline-none"
              value={(el as any).subFloorThicknessMm ?? 0}
              onChange={(e) =>
                onDispatchCommand?.({
                  type: 'setSubFloorThickness',
                  floorId: el.id,
                  subFloorThicknessMm: Number(e.target.value) || null,
                })
              }
            />
            <span className="text-xs text-muted">mm</span>
          </div>
          {/* Cut geometry readout */}
          {(el as any).cutBy?.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary
                data-testid="inspector-cut-by-summary"
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                Cut By ({(el as any).cutBy.length})
              </summary>
              <div style={{ marginTop: 4 }}>
                {(el as any).cutBy.map((cutterId: string, i: number) => (
                  <div
                    key={cutterId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      marginBottom: 2,
                    }}
                  >
                    <span data-testid={`inspector-cut-by-id-${i}`} style={{ color: '#aaa' }}>
                      {cutterId.slice(-8)}
                    </span>
                    <button
                      data-testid={`inspector-cut-by-remove-${i}`}
                      onClick={() =>
                        onSemanticCommand?.({ type: 'removeCutGeometry', cutterId, hostId: el.id })
                      }
                      style={{ color: '#f87171', fontSize: 11 }}
                    >
                      Remove Cut
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
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
          {options?.onEditBoundary ? (
            <div
              className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1.5"
              data-testid="inspector-roof-boundary-actions"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">Footprint</div>
                <div className="text-[10px] text-muted">Plan vertex grips</div>
              </div>
              <button
                type="button"
                data-testid="inspector-roof-edit-boundary"
                className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
                onClick={() => options.onEditBoundary?.(el)}
              >
                Edit Boundary
              </button>
            </div>
          ) : null}

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
          <PhaseSection
            phaseCreated={el.phaseCreated}
            phaseDemolished={el.phaseDemolished}
            phases={Object.values(roofElementsById).filter(
              (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
            )}
            onPropertyChange={roofOnPropertyChange}
          />
          <FaceMaterialOverridesSection
            elementId={el.id}
            overrides={el.faceMaterialOverrides}
            elementsById={elementsById}
            onDispatchCommand={onDispatchCommand}
          />
          <div className="border-t border-border pt-1.5">
            <div className="mb-1 text-xs font-semibold text-foreground">Slope Arrow</div>
            <div className="flex flex-col gap-1">
              <label
                data-testid="inspector-roof-use-slope-arrow"
                className="flex items-center gap-2 py-0.5 text-xs text-foreground cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={el.useSlopeArrow ?? false}
                  onChange={(e) => roofOnPropertyChange?.('useSlopeArrow', e.currentTarget.checked)}
                />
                Use Slope Arrow
              </label>
              {el.useSlopeArrow && el.slopeArrow ? (
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-xs text-muted w-28 shrink-0">Slope %</span>
                  <input
                    type="number"
                    className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                    data-testid="inspector-roof-slope-pct"
                    defaultValue={(el.slopeArrow.slopeRatio * 100).toFixed(0)}
                    key={`${el.id}-slope-pct`}
                    step={1}
                    min={0}
                    onBlur={(e) =>
                      roofOnPropertyChange?.('slopeArrow', {
                        ...el.slopeArrow,
                        slopeRatio: Number(e.currentTarget.value) / 100,
                      })
                    }
                  />
                  <span className="text-xs text-muted">%</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    }
    case 'conical_roof': {
      const { onPropertyChange: conicalPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Level" value={resolveElName(el.levelId, elementsById)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Radius (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.baseRadiusMm}
              key={`${el.id}-radius`}
              step={100}
              min={100}
              onBlur={(e) => conicalPropChange?.('baseRadiusMm', Number(e.currentTarget.value))}
              data-testid="inspector-conical-roof-radius"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightMm}
              key={`${el.id}-height`}
              step={100}
              min={100}
              onBlur={(e) => conicalPropChange?.('heightMm', Number(e.currentTarget.value))}
              data-testid="inspector-conical-roof-height"
            />
          </div>
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialId ?? null}
            fallback="By category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    }
    case 'dome_roof': {
      const { onPropertyChange: domePropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Level" value={resolveElName(el.levelId, elementsById)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Radius (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.baseRadiusMm}
              key={`${el.id}-radius`}
              step={100}
              min={100}
              onBlur={(e) => domePropChange?.('baseRadiusMm', Number(e.currentTarget.value))}
              data-testid="inspector-dome-roof-radius"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Rise Ratio</span>
            <input
              type="range"
              className="flex-1"
              min={0.1}
              max={1.0}
              step={0.01}
              defaultValue={el.riseRatio}
              key={`${el.id}-rise`}
              onBlur={(e) => domePropChange?.('riseRatio', Number(e.currentTarget.value))}
              data-testid="inspector-dome-roof-rise-ratio"
            />
            <span className="text-xs text-muted w-10 text-right">
              {(el.riseRatio ?? 0.5).toFixed(2)}
            </span>
          </div>
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialId ?? null}
            fallback="By category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    }
    case 'spire_roof': {
      const { onPropertyChange: spirePropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Level" value={resolveElName(el.levelId, elementsById)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Radius (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.baseRadiusMm}
              key={`${el.id}-radius`}
              step={100}
              min={100}
              onBlur={(e) => spirePropChange?.('baseRadiusMm', Number(e.currentTarget.value))}
              data-testid="inspector-spire-roof-radius"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.heightMm}
              key={`${el.id}-height`}
              step={500}
              min={100}
              onBlur={(e) => spirePropChange?.('heightMm', Number(e.currentTarget.value))}
              data-testid="inspector-spire-roof-height"
            />
          </div>
          <MaterialAssignmentRow
            label="Material"
            materialKey={el.materialId ?? null}
            fallback="By category"
            elementsById={elementsById}
            onOpenMaterialBrowser={onOpenMaterialBrowser}
            onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
          />
        </div>
      );
    }
    case 'family_extrusion': {
      const { onPropertyChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <label>
            Frame Inner Width (mm)
            <input
              type="number"
              data-testid="inspector-family-frame-inner-width"
              value={(el as any).frameInnerWidthMm ?? 50}
              onChange={(e) => onPropertyChange?.('frameInnerWidthMm', +e.target.value)}
            />
          </label>
          <label>
            Sill Depth (mm)
            <input
              type="number"
              data-testid="inspector-family-frame-sill-depth"
              value={(el as any).frameSillDepthMm ?? 100}
              onChange={(e) => onPropertyChange?.('frameSillDepthMm', +e.target.value)}
            />
          </label>
          <label>
            Is Glazing Panel
            <input
              type="checkbox"
              data-testid="inspector-family-is-glazing"
              checked={(el as any).isGlazing ?? false}
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
      const fsb = el as FamilySweptBlend;
      return (
        <div data-testid="inspector-family-swept-blend" className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Path Points</span>
            <span data-testid="inspector-fsb-path-count" className="text-sm">
              {fsb.pathMm?.length ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Start Profile</span>
            <span data-testid="inspector-fsb-start-count" className="text-sm">
              {fsb.startProfileMm?.length ?? 0} pts
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">End Profile</span>
            <span data-testid="inspector-fsb-end-count" className="text-sm">
              {fsb.endProfileMm?.length ?? 0} pts
            </span>
          </div>
        </div>
      );
    }
    case 'family_component': {
      return (
        <div style={{ padding: 8 }}>
          <div className="text-xs font-semibold mb-1">Nested Component</div>
          <div className="text-xs text-muted" data-testid="inspector-family-component-type">
            Type: {(el as any).componentTypeId}
          </div>
          <div className="text-xs text-muted" data-testid="inspector-family-component-label">
            Label: {(el as any).label ?? (el as any).componentTypeId}
          </div>
          <div className="text-xs text-muted">
            Origin: ({(el as any).originMm?.xMm?.toFixed(0)},{' '}
            {(el as any).originMm?.yMm?.toFixed(0)}, {(el as any).originMm?.zMm?.toFixed(0)}) mm
          </div>
        </div>
      );
    }
    case 'family_parameter': {
      const fp = el as Extract<Element, { kind: 'family_parameter' }>;
      const { onPropertyChange: fpPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 py-0.5 text-xs">
            <span className="text-muted w-28 shrink-0">Name</span>
            <input
              data-testid="inspector-family-param-name"
              className="w-40 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={fp.name}
              onChange={(e) => fpPropChange?.('name', e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Type</span>
            <span data-testid="inspector-family-param-type" className="text-sm text-foreground">
              {fp.paramType}
            </span>
          </div>
          <label className="flex items-center gap-2 py-0.5 text-xs">
            <span className="text-muted w-28 shrink-0">Default Value</span>
            <input
              type="number"
              data-testid="inspector-family-param-value"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={fp.defaultValue as number}
              onChange={(e) => fpPropChange?.('defaultValue', +e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 py-0.5 text-xs">
            <span className="text-muted w-28 shrink-0">Instance Parameter</span>
            <input
              type="checkbox"
              data-testid="inspector-family-param-instance"
              checked={fp.isInstance}
              onChange={(e) => fpPropChange?.('isInstance', e.target.checked)}
            />
          </label>
        </div>
      );
    }
    case 'family_constraint': {
      const fc = el as Extract<Element, { kind: 'family_constraint' }>;
      return (
        <div data-testid="inspector-family-constraint" className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Parameter</span>
            <span data-testid="inspector-fc-param-name" className="text-sm">
              {fc.paramName}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Axis</span>
            <span data-testid="inspector-fc-axis" className="text-sm">
              {fc.axis.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Ref Plane 1</span>
            <span data-testid="inspector-fc-ref1" className="text-xs text-muted">
              {fc.refPlaneId1.slice(-8)}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Ref Plane 2</span>
            <span data-testid="inspector-fc-ref2" className="text-xs text-muted">
              {fc.refPlaneId2.slice(-8)}
            </span>
          </div>
          <button
            data-testid="inspector-fc-remove"
            className="text-xs text-red-400 text-left mt-1"
            onClick={() =>
              onSemanticCommand?.({ type: 'removeFamilyConstraint', constraintId: fc.id })
            }
          >
            Remove Constraint
          </button>
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
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Riser Count</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.riserCount ?? undefined}
              key={`${el.id}-riser-count`}
              step={1}
              min={2}
              max={50}
              aria-label="Number of risers per run"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v >= 2 && v <= 50) stairPropChange?.('riserCount', v);
              }}
              data-testid="inspector-stair-riser-count"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Tread Depth (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.treadDepthMm ?? undefined}
              key={`${el.id}-tread-depth`}
              step={10}
              min={200}
              max={450}
              aria-label="Tread depth in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v >= 200 && v <= 450) stairPropChange?.('treadDepthMm', v);
              }}
              data-testid="inspector-stair-tread-depth"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Run Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.runWidthMm ?? el.widthMm}
              key={`${el.id}-run-width`}
              step={100}
              min={600}
              aria-label="Run width in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v >= 600) stairPropChange?.('runWidthMm', v);
              }}
              data-testid="inspector-stair-run-width"
            />
          </div>
          {(el.runs?.length ?? 0) >= 2 && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Landing Depth (mm)</span>
              <input
                type="number"
                className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                defaultValue={el.landingDepthMm ?? 1200}
                key={`${el.id}-landing-depth`}
                step={100}
                min={600}
                aria-label="Landing depth in millimetres"
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v) && v >= 600) stairPropChange?.('landingDepthMm', v);
                }}
                data-testid="inspector-stair-landing-depth"
              />
            </div>
          )}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Total Height (mm)</span>
            <span className="text-xs text-foreground" data-testid="inspector-stair-total-height">
              {el.totalHeightMm ?? (el.riserCount ?? 0) * (el.riserHeightMm ?? el.riserMm ?? 175)}
            </span>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Riser Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.riserHeightMm ?? el.riserMm}
              key={`${el.id}-riser-height`}
              step={5}
              min={100}
              max={220}
              aria-label="Riser height in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v >= 100 && v <= 220) stairPropChange?.('riserHeightMm', v);
              }}
              data-testid="inspector-stair-riser-height"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Multi-storey</span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border border-border"
              defaultChecked={el.multiStorey ?? false}
              key={`${el.id}-multi-storey`}
              aria-label="Multi-storey stair"
              onChange={(e) => stairPropChange?.('multiStorey', e.currentTarget.checked)}
              data-testid="inspector-stair-multi-storey"
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
          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              data-testid="inspector-stair-create-opening"
              className="self-start text-xs border border-border rounded px-2 py-0.5 hover:bg-surface-strong"
              onClick={() => {
                const boundaryMm = stairBoundaryMm(el);
                onDispatchCommand?.({
                  type: 'create_shaft',
                  id: crypto.randomUUID(),
                  boundaryMm,
                  baseLevelId: el.baseLevelId,
                  topLevelId: el.topLevelId,
                });
              }}
            >
              Create Floor Opening
            </button>
            <p className="text-xs text-muted">
              Creates a shaft opening through the floor(s) above this stair.
            </p>
          </div>
          <div className="border-t border-border pt-1.5">
            <div className="mb-1 text-xs text-muted">Shaft Opening</div>
            {el.linkedShaftId ? (
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-foreground">Auto-created shaft</span>
                <span className="font-mono text-[10px] text-muted">
                  {el.linkedShaftId.slice(0, 8)}
                </span>
              </div>
            ) : (
              <button
                type="button"
                data-testid="inspector-stair-create-shaft"
                className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
                onClick={() =>
                  onDispatchCommand?.({ type: 'inspector_create_shaft_for_stair', stairId: el.id })
                }
              >
                Create Shaft Opening
              </button>
            )}
          </div>
          {onDisciplineChange ? (
            <InspectorDisciplineDropdown value={el.discipline} onChange={onDisciplineChange} />
          ) : null}
          {/* §8.6.4 stair edit mode panel */}
          <div style={{ marginTop: 8, borderTop: '1px solid #ddd', paddingTop: 8 }}>
            {(el as any).editStairActive ? (
              <>
                <strong data-testid="inspector-stair-edit-mode-active">Edit Mode</strong>
                {(
                  (el as any).runs ?? [
                    {
                      runIndex: 0,
                      riserCount: (el as any).riserCount ?? 10,
                      runWidthMm: (el as any).runWidthMm ?? 1200,
                    },
                  ]
                ).map((run: any) => (
                  <div
                    key={run.runIndex}
                    data-testid={`inspector-stair-run-${run.runIndex}`}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}
                  >
                    <span>Run {run.runIndex + 1}</span>
                    <label>
                      Risers
                      <input
                        type="number"
                        data-testid={`inspector-stair-run-risers-${run.runIndex}`}
                        value={run.riserCount}
                        min={1}
                        onChange={(e) =>
                          void onDispatchCommand?.({
                            type: 'updateStairRun',
                            stairId: el.id,
                            runIndex: run.runIndex,
                            riserCount: +e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Width (mm)
                      <input
                        type="number"
                        data-testid={`inspector-stair-run-width-${run.runIndex}`}
                        value={run.runWidthMm}
                        min={600}
                        onChange={(e) =>
                          void onDispatchCommand?.({
                            type: 'updateStairRun',
                            stairId: el.id,
                            runIndex: run.runIndex,
                            runWidthMm: +e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <button
                  data-testid="inspector-stair-finish-edit-btn"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    void onDispatchCommand?.({ type: 'exitStairEditMode', stairId: el.id })
                  }
                >
                  Finish Editing
                </button>
              </>
            ) : (
              <button
                data-testid="inspector-stair-edit-btn"
                onClick={() =>
                  void onDispatchCommand?.({ type: 'enterStairEditMode', stairId: el.id })
                }
              >
                Edit Stair
              </button>
            )}
          </div>
          {/* §8.6.2: Stair Assembly — list linked run/landing components */}
          <StairAssemblySection
            stairId={el.id}
            elementsById={elementsById}
            onSemanticCommand={onDispatchCommand as any}
          />
        </div>
      );
    }
    case 'stair_run': {
      const stairRunEl = el as Extract<Element, { kind: 'stair_run' }>;
      const { onPropertyChange: srPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Run Width (mm)</span>
            <input
              type="number"
              data-testid="inspector-stair-run-width"
              className="inspector-input"
              value={stairRunEl.runWidthMm}
              onChange={(e) => srPropChange?.('runWidthMm', +e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Riser Count</span>
            <input
              type="number"
              data-testid="inspector-stair-run-risers"
              className="inspector-input"
              value={stairRunEl.riserCount}
              onChange={(e) => srPropChange?.('riserCount', +e.target.value)}
            />
          </div>
          <span data-testid="inspector-stair-run-index" className="text-xs text-muted">
            Run {stairRunEl.runIndex + 1}
          </span>
        </div>
      );
    }
    case 'stair_landing': {
      const stairLandingEl = el as Extract<Element, { kind: 'stair_landing' }>;
      const { onPropertyChange: slPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <input
              type="number"
              data-testid="inspector-stair-landing-elevation"
              className="inspector-input"
              value={stairLandingEl.elevationMm}
              onChange={(e) => slPropChange?.('elevationMm', +e.target.value)}
            />
          </div>
          <span data-testid="inspector-stair-landing-points" className="text-xs text-muted">
            {stairLandingEl.perimeterMm.length} boundary points
          </span>
        </div>
      );
    }
    case 'ramp': {
      const { onPropertyChange: rampPropChange } = options ?? {};
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
              aria-label="Ramp width in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) rampPropChange?.('widthMm', v);
              }}
              data-testid="inspector-ramp-width"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Slope (%)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.slopePercent}
              key={`${el.id}-slope`}
              step={0.5}
              min={0.5}
              max={20}
              aria-label="Ramp slope percentage"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) rampPropChange?.('slopePercent', v);
              }}
              data-testid="inspector-ramp-slope"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Railing Left</span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border border-border"
              defaultChecked={el.hasRailingLeft}
              key={`${el.id}-railing-left`}
              aria-label="Ramp railing on left side"
              onChange={(e) => rampPropChange?.('hasRailingLeft', e.currentTarget.checked)}
              data-testid="inspector-ramp-handrails"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Railing Right</span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border border-border"
              defaultChecked={el.hasRailingRight}
              key={`${el.id}-railing-right`}
              aria-label="Ramp railing on right side"
              onChange={(e) => rampPropChange?.('hasRailingRight', e.currentTarget.checked)}
            />
          </div>
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
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
            <span className="text-xs text-muted w-28 shrink-0">Usage</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.columnUsage ?? 'architectural'}
              onChange={(e) =>
                colPropChange?.('columnUsage', e.target.value as 'architectural' | 'structural')
              }
              data-testid="inspector-column-usage"
            >
              <option value="architectural">Architectural</option>
              <option value="structural">Structural</option>
            </select>
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
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Top Offset X (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.topOffsetXMm ?? 0}
              key={`${el.id}-top-offset-x`}
              step={100}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) colPropChange?.('topOffsetXMm', v);
              }}
              data-testid="inspector-column-top-offset-x"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Top Offset Y (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.topOffsetYMm ?? 0}
              key={`${el.id}-top-offset-y`}
              step={100}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) colPropChange?.('topOffsetYMm', v);
              }}
              data-testid="inspector-column-top-offset-y"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Top Constraint</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.topConstraintLevelId ?? ''}
              onChange={(e) => colPropChange?.('topConstraintLevelId', e.target.value || null)}
              data-testid="inspector-column-top-level"
            >
              <option value="">Unconnected</option>
              {Object.values(elementsById)
                .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
                .sort((a, b) => a.elevationMm - b.elevationMm)
                .map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
            </select>
          </div>
          {el.topConstraintLevelId && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Top Offset (mm)</span>
              <input
                type="number"
                className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                defaultValue={el.topConstraintOffsetMm ?? 0}
                key={`${el.id}-col-top`}
                step={1}
                min={-10000}
                max={10000}
                onBlur={(e) =>
                  colPropChange?.('topConstraintOffsetMm', Number(e.currentTarget.value))
                }
                data-testid="inspector-column-top-offset"
              />
            </div>
          )}
          <PhaseSection
            phaseCreated={el.phaseCreated}
            phaseDemolished={el.phaseDemolished}
            phases={Object.values(elementsById).filter(
              (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
            )}
            onPropertyChange={colPropChange}
          />
          <div className="border-t border-border pt-1.5">
            <div className="mb-1 text-xs text-muted">Graphics Override</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Fill color</span>
                <input
                  type="color"
                  className="h-6 w-10 cursor-pointer rounded border border-border"
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.graphicsOverride?.fillColorHex ?? '#000000'}
                  key={`${el.id}-fill-color-${el.graphicsOverride?.fillColorHex ?? 'none'}`}
                  onChange={(e) =>
                    colPropChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      fillColorHex: e.target.value,
                    })
                  }
                  data-testid="inspector-override-fill-color"
                />
                <button
                  type="button"
                  className="text-xs rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground"
                  onClick={() =>
                    colPropChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      fillColorHex: null,
                    })
                  }
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Surface color</span>
                <input
                  type="color"
                  className="h-6 w-10 cursor-pointer rounded border border-border"
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.graphicsOverride?.surfaceColorHex ?? '#000000'}
                  key={`${el.id}-surface-color-${el.graphicsOverride?.surfaceColorHex ?? 'none'}`}
                  onChange={(e) =>
                    colPropChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      surfaceColorHex: e.target.value,
                    })
                  }
                  data-testid="inspector-override-surface-color"
                />
                <button
                  type="button"
                  className="text-xs rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground"
                  onClick={() =>
                    colPropChange?.('graphicsOverride', {
                      ...el.graphicsOverride,
                      surfaceColorHex: null,
                    })
                  }
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          {/* Cut geometry readout */}
          {(el as any).cutBy?.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary
                data-testid="inspector-cut-by-summary"
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                Cut By ({(el as any).cutBy.length})
              </summary>
              <div style={{ marginTop: 4 }}>
                {(el as any).cutBy.map((cutterId: string, i: number) => (
                  <div
                    key={cutterId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      marginBottom: 2,
                    }}
                  >
                    <span data-testid={`inspector-cut-by-id-${i}`} style={{ color: '#aaa' }}>
                      {cutterId.slice(-8)}
                    </span>
                    <button
                      data-testid={`inspector-cut-by-remove-${i}`}
                      onClick={() =>
                        onSemanticCommand?.({ type: 'removeCutGeometry', cutterId, hostId: el.id })
                      }
                      style={{ color: '#f87171', fontSize: 11 }}
                    >
                      Remove Cut
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
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
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Section Profile</span>
            <select
              className="w-32 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.sectionProfile ?? 'rectangular'}
              onChange={(e) => {
                beamPropChange?.('sectionProfile', e.currentTarget.value || 'rectangular');
              }}
              data-testid="inspector-beam-section-profile"
            >
              <option value="rectangular">Rectangular</option>
              <option value="I">I-Beam</option>
              <option value="H">H-Beam</option>
              <option value="C">C-Channel</option>
              <option value="L">L-Angle</option>
              <option value="T">T-Section</option>
              <option value="HSS">HSS</option>
            </select>
          </div>
          {(el.sectionProfile === 'I' ||
            el.sectionProfile === 'H' ||
            el.sectionProfile === 'C') && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Flange Width (mm)</span>
              <input
                type="number"
                className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                defaultValue={el.flangeWidthMm ?? el.widthMm}
                key={`${el.id}-flange-width`}
                step={10}
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v) && v > 0) beamPropChange?.('flangeWidthMm', v);
                }}
                data-testid="inspector-beam-flange-width"
              />
            </div>
          )}
          {(el.sectionProfile === 'I' || el.sectionProfile === 'H') && (
            <>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Web Thickness (mm)</span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={el.webThicknessMm ?? Math.max(20, el.widthMm * 0.1)}
                  key={`${el.id}-web-thickness`}
                  step={5}
                  onBlur={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (!isNaN(v) && v > 0) beamPropChange?.('webThicknessMm', v);
                  }}
                  data-testid="inspector-beam-web-thickness"
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Flange Thickness (mm)</span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={el.flangeThicknessMm ?? Math.max(15, el.heightMm * 0.1)}
                  key={`${el.id}-flange-thickness`}
                  step={5}
                  onBlur={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (!isNaN(v) && v > 0) beamPropChange?.('flangeThicknessMm', v);
                  }}
                  data-testid="inspector-beam-flange-thickness"
                />
              </div>
            </>
          )}
          {/* §9.2 (WP-B): beamProfileType — 3D geometry profile */}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Profile</span>
            <select
              className="w-32 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.beamProfileType ?? 'rectangular'}
              onChange={(e) => beamPropChange?.('beamProfileType', e.currentTarget.value)}
              data-testid="inspector-beam-profile-type"
            >
              <option value="rectangular">Rectangular</option>
              <option value="I-beam">I-Beam</option>
              <option value="H-beam">H-Beam (Wide Flange)</option>
              <option value="HSS-round">HSS Round</option>
              <option value="HSS-square">HSS Square</option>
            </select>
          </div>
          {(el.beamProfileType === 'I-beam' || el.beamProfileType === 'H-beam') && (
            <>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Flange Width (mm)</span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={el.flangeWidthMm ?? el.widthMm}
                  key={`${el.id}-bp-flange-width`}
                  step={10}
                  onBlur={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (!isNaN(v) && v > 0) beamPropChange?.('flangeWidthMm', v);
                  }}
                  data-testid="inspector-beam-flange-width-bp"
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Flange Thickness (mm)</span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={el.flangeThicknessMm ?? 15}
                  key={`${el.id}-bp-flange-thickness`}
                  step={5}
                  onBlur={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (!isNaN(v) && v > 0) beamPropChange?.('flangeThicknessMm', v);
                  }}
                  data-testid="inspector-beam-flange-thickness-bp"
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Web Thickness (mm)</span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={el.webThicknessMm ?? 10}
                  key={`${el.id}-bp-web-thickness`}
                  step={5}
                  onBlur={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (!isNaN(v) && v > 0) beamPropChange?.('webThicknessMm', v);
                  }}
                  data-testid="inspector-beam-web-thickness-bp"
                />
              </div>
            </>
          )}
          {(el.beamProfileType === 'HSS-round' || el.beamProfileType === 'HSS-square') && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Wall Thickness (mm)</span>
              <input
                type="number"
                className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                defaultValue={el.wallThicknessMm ?? 8}
                key={`${el.id}-bp-wall-thickness`}
                step={1}
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v) && v > 0) beamPropChange?.('wallThicknessMm', v);
                }}
                data-testid="inspector-beam-wall-thickness"
              />
            </div>
          )}
          <PhaseSection
            phaseCreated={el.phaseCreated}
            phaseDemolished={el.phaseDemolished}
            phases={Object.values(elementsById).filter(
              (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
            )}
            onPropertyChange={beamPropChange}
          />
        </div>
      );
    }
    case 'steel_connection': {
      const { onPropertyChange: scPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Connection Type</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.connectionType}
              onChange={(e) => scPropChange?.('connectionType', e.currentTarget.value)}
              data-testid="inspector-steel-connection-type"
            >
              <option value="end_plate">End Plate</option>
              <option value="bolted_flange">Bolted Flange</option>
              <option value="shear_tab">Shear Tab</option>
            </select>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Plate Width (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.plateSizeMm?.width ?? 150}
              key={`${el.id}-plate-w`}
              step={10}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) {
                  scPropChange?.('plateSizeMm', {
                    ...(el.plateSizeMm ?? { width: 150, height: 200, thickness: 10 }),
                    width: v,
                  });
                }
              }}
              data-testid="inspector-steel-plate-width"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Plate Height (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.plateSizeMm?.height ?? 200}
              key={`${el.id}-plate-h`}
              step={10}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) {
                  scPropChange?.('plateSizeMm', {
                    ...(el.plateSizeMm ?? { width: 150, height: 200, thickness: 10 }),
                    height: v,
                  });
                }
              }}
              data-testid="inspector-steel-plate-height"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Bolt Rows</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.boltRows ?? 2}
              key={`${el.id}-bolt-rows`}
              min={1}
              max={8}
              step={1}
              onBlur={(e) => {
                const v = Math.round(Number(e.currentTarget.value));
                if (!isNaN(v) && v >= 1 && v <= 8) scPropChange?.('boltRows', v);
              }}
              data-testid="inspector-steel-bolt-rows"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Bolt Columns</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.boltCols ?? 2}
              key={`${el.id}-bolt-cols`}
              min={1}
              max={8}
              step={1}
              onBlur={(e) => {
                const v = Math.round(Number(e.currentTarget.value));
                if (!isNaN(v) && v >= 1 && v <= 8) scPropChange?.('boltCols', v);
              }}
              data-testid="inspector-steel-bolt-cols"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Bolt Diameter (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.boltDiameterMm ?? 20}
              key={`${el.id}-bolt-diam`}
              step={2}
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) scPropChange?.('boltDiameterMm', v);
              }}
              data-testid="inspector-steel-bolt-diameter"
            />
          </div>
          <FieldRow label="Host Element" value={el.hostElementId} mono />
        </div>
      );
    }
    case 'beam_system': {
      const { onPropertyChange: bsPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <div data-testid="inspector-beam-level">
            <FieldRow label="Level" value={resolveElName(el.levelId, elementsById)} />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Spacing (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.spacingMm}
              key={`${el.id}-spacing`}
              step={100}
              min={100}
              aria-label="Beam system spacing in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v) && v > 0) bsPropChange?.('spacingMm', v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v) && v > 0) bsPropChange?.('spacingMm', v);
                }
              }}
              data-testid="inspector-beam-spacing"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Direction (°)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.directionDeg}
              key={`${el.id}-direction`}
              step={1}
              min={0}
              max={359}
              aria-label="Beam system direction in degrees"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) bsPropChange?.('directionDeg', v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v)) bsPropChange?.('directionDeg', v);
                }
              }}
              data-testid="inspector-beam-direction"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Beam Count</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.beamCount ?? ''}
              key={`${el.id}-count`}
              step={1}
              min={1}
              placeholder="—"
              aria-label="Beam count override"
              onBlur={(e) => {
                const raw = e.currentTarget.value;
                bsPropChange?.('beamCount', raw === '' ? null : Number(raw));
              }}
              data-testid="inspector-beam-count"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Justification</span>
            <select
              className="w-32 text-xs bg-surface border border-border rounded px-1 py-0.5"
              value={el.justification ?? 'center'}
              onChange={(e) => bsPropChange?.('justification', e.currentTarget.value || null)}
              data-testid="inspector-beam-justification"
            >
              <option value="beginning">Beginning</option>
              <option value="center">Center</option>
              <option value="end">End</option>
            </select>
          </div>
        </div>
      );
    }
    case 'room': {
      const roomColumns = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'column' }> => e.kind === 'column',
      );
      const grossAreaM2 = roomAreaM2(el.outlineMm);
      const netAreaM2 = roomNetAreaM2(el.outlineMm, roomColumns);
      return (
        <div>
          <FieldRow label={f('programme')} value={el.programmeCode ?? '—'} />
          <FieldRow label={f('department')} value={el.department ?? '—'} />
          <FieldRow label={f('function')} value={el.functionLabel ?? '—'} />
          <FieldRow label={f('finishSet')} value={el.finishSet ?? '—'} />
          <FieldRow label={f('level')} value={resolveElName(el.levelId, elementsById)} />
          <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
          <div className="flex items-center gap-2 py-0.5" data-testid="inspector-room-gross-area">
            <span className="text-xs text-muted w-28 shrink-0">Gross Area</span>
            <span className="text-xs">{grossAreaM2.toFixed(2)} m²</span>
          </div>
          <div className="flex items-center gap-2 py-0.5" data-testid="inspector-room-net-area">
            <span className="text-xs text-muted w-28 shrink-0">Net Area</span>
            <span className="text-xs">{netAreaM2.toFixed(2)} m²</span>
          </div>
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
    }
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
          {/* F-088 + ANN-11 — text label offset + text decoration inputs */}
          {dimPropChange ? (
            <>
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
              <div className="flex flex-col gap-1 border-t border-border pt-2">
                <span className="text-xs font-medium text-muted">Text decoration</span>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Prefix</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textPrefix ?? ''}
                    key={`${el.id}-prefix`}
                    placeholder="e.g. ≈"
                    aria-label="Dimension text prefix"
                    data-testid="dimension-text-prefix"
                    onBlur={(e) => dimPropChange('textPrefix', e.currentTarget.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Suffix</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textSuffix ?? ''}
                    key={`${el.id}-suffix`}
                    placeholder="e.g. (EQ)"
                    aria-label="Dimension text suffix"
                    data-testid="dimension-text-suffix"
                    onBlur={(e) => dimPropChange('textSuffix', e.currentTarget.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Override</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textOverride ?? ''}
                    key={`${el.id}-override`}
                    placeholder="replaces measured value"
                    aria-label="Dimension text override"
                    data-testid="dimension-text-override"
                    onBlur={(e) => dimPropChange('textOverride', e.currentTarget.value || null)}
                  />
                </div>
              </div>
            </>
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
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Grid tile (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.gridPatternMm ?? 0}
              key={`${el.id}-grid`}
              step={100}
              min={0}
              max={3000}
              aria-label="Ceiling grid tile size in millimetres"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) ceilPropChange?.('gridPatternMm', v === 0 ? null : v);
              }}
              data-testid="inspector-ceiling-grid-size"
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Grid angle (°)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.gridAngleDeg ?? 0}
              key={`${el.id}-gridangle`}
              step={5}
              min={0}
              max={90}
              aria-label="Ceiling grid angle in degrees"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v)) ceilPropChange?.('gridAngleDeg', v === 0 ? null : v);
              }}
              data-testid="inspector-ceiling-grid-angle"
            />
          </div>
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm?.length ?? 0)} mono />
          {options?.onEditBoundary ? (
            <div
              className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1.5"
              data-testid="inspector-ceiling-boundary-actions"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">Boundary</div>
                <div className="text-[10px] text-muted">Plan vertex grips</div>
              </div>
              <button
                type="button"
                data-testid="inspector-ceiling-edit-boundary"
                className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
                onClick={() => options.onEditBoundary?.(el)}
              >
                Edit Boundary
              </button>
            </div>
          ) : null}
          <FaceMaterialOverridesSection
            elementId={el.id}
            overrides={el.faceMaterialOverrides}
            elementsById={elementsById}
            onDispatchCommand={onDispatchCommand}
          />
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
    case 'section_cut': {
      const { onPropertyChange: scPropChange } = options ?? {};
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
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Level Lines</span>
            <input
              data-testid="inspector-section-cut-show-level-lines"
              type="checkbox"
              checked={el.showLevelLines ?? false}
              onChange={(e) => scPropChange?.('showLevelLines', e.target.checked)}
              className="accent-primary"
            />
          </div>
        </div>
      );
    }
    case 'plan_view': {
      const { onPropertyChange: pvPropChange } = options ?? {};
      const lineworkOverrides =
        (el as Extract<Element, { kind: 'plan_view' }>).lineworkOverrides ?? [];
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
          {lineworkOverrides.length > 0 ? (
            <div data-testid="inspector-linework-overrides" className="flex flex-col gap-1 mt-2">
              <span className="text-xs font-medium text-muted">Linework Overrides</span>
              {lineworkOverrides.map((ov) => (
                <div
                  key={ov.elementId}
                  data-testid={`inspector-linework-override-${ov.elementId}`}
                  className="flex items-center gap-1"
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      background: ov.colorHex,
                      border: '1px solid #888',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-xs flex-1">
                    {ov.elementId.slice(0, 8)}… {ov.lineWeightPx}px
                  </span>
                  <button
                    type="button"
                    data-testid={`inspector-linework-remove-${ov.elementId}`}
                    className="text-xs"
                    onClick={() => {
                      const next = lineworkOverrides.filter((o) => o.elementId !== ov.elementId);
                      pvPropChange?.('lineworkOverrides', next);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                data-testid="inspector-linework-clear-all"
                className="text-xs mt-1"
                onClick={() => pvPropChange?.('lineworkOverrides', [])}
              >
                Clear All
              </button>
            </div>
          ) : null}
        </div>
      );
    }
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
    case 'floor_type':
    case 'roof_type': {
      const PRIORITY_LABELS: Record<number, string> = {
        1: 'Structure',
        2: 'Substrate',
        3: 'Thermal/Air',
        4: 'Finish 1',
        5: 'Finish 2',
      };
      const uniquePriorities =
        el.kind === 'wall_type'
          ? [...new Set(el.layers.flatMap((l) => (l.priority != null ? [l.priority] : [])))].sort(
              (a, b) => a - b,
            )
          : [];
      const prioritySummary =
        uniquePriorities.length > 0
          ? uniquePriorities.map((p) => `${PRIORITY_LABELS[p] ?? String(p)} (${p})`).join(' · ')
          : null;
      return (
        <div className="flex flex-col gap-2">
          <WallTypeLayerEditor
            typeElement={el}
            onUpdate={(patch) =>
              onDispatchCommand?.({ type: 'update_wall_type', id: el.id, patch })
            }
          />
          {prioritySummary != null ? (
            <p data-testid="inspector-wall-type-priority-summary" className="text-xs text-muted">
              Layer Priorities: {prioritySummary}
            </p>
          ) : null}
        </div>
      );
    }
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
    case 'text_note': {
      const { onPropertyChange: tnPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow
            label="Position"
            value={`(${Math.round(el.positionMm.xMm)}, ${Math.round(el.positionMm.yMm)}) mm`}
            mono
          />
          {tnPropChange ? (
            <>
              <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
                <button
                  type="button"
                  className={`rounded border px-2 py-0.5 text-xs font-bold ${el.bold ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
                  data-testid="inspector-text-bold"
                  aria-pressed={!!el.bold}
                  onClick={() => tnPropChange('bold', !el.bold)}
                >
                  B
                </button>
                <button
                  type="button"
                  className={`rounded border px-2 py-0.5 text-xs italic ${el.italic ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
                  data-testid="inspector-text-italic"
                  aria-pressed={!!el.italic}
                  onClick={() => tnPropChange('italic', !el.italic)}
                >
                  I
                </button>
                <button
                  type="button"
                  className={`rounded border px-2 py-0.5 text-xs underline ${el.underline ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
                  data-testid="inspector-text-underline"
                  aria-pressed={!!el.underline}
                  onClick={() => tnPropChange('underline', !el.underline)}
                >
                  U
                </button>
                <span className="mx-1 text-muted">|</span>
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    className={`rounded border px-2 py-0.5 text-xs ${(el.horizontalAlign ?? 'left') === align ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
                    data-testid={`inspector-text-align-${align}`}
                    aria-pressed={(el.horizontalAlign ?? 'left') === align}
                    onClick={() => tnPropChange('horizontalAlign', align)}
                  >
                    {align[0]!.toUpperCase()}
                  </button>
                ))}
                <span className="mx-1 text-muted">|</span>
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border border-border bg-surface p-0.5"
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.colorHex ?? '#202020'}
                  key={`${el.id}-color`}
                  aria-label="Text note color"
                  data-testid="inspector-text-color"
                  onChange={(e) => tnPropChange('colorHex', e.currentTarget.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Content</span>
                <textarea
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                  rows={3}
                  defaultValue={el.text}
                  key={`${el.id}-content`}
                  aria-label="Text note content"
                  data-testid="inspector-text-note-content"
                  onBlur={(e) => tnPropChange('text', e.currentTarget.value)}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Font size (mm)</span>
                <input
                  type="number"
                  className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.fontSizeMm ?? 200}
                  key={`${el.id}-fontsize`}
                  step={50}
                  aria-label="Text note font size in millimetres"
                  data-testid="inspector-text-note-font-size"
                  onBlur={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (!isNaN(v) && v > 0) tnPropChange('fontSizeMm', v);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Rotation (°)</span>
                <input
                  type="number"
                  className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.rotationDeg ?? 0}
                  key={`${el.id}-rotation`}
                  step={15}
                  aria-label="Text note rotation in degrees"
                  data-testid="inspector-text-note-rotation"
                  onBlur={(e) => tnPropChange('rotationDeg', Number(e.currentTarget.value))}
                />
              </div>
            </>
          ) : (
            <FieldRow label="Content" value={el.text} />
          )}
        </div>
      );
    }
    case 'leader_text': {
      const { onPropertyChange: ltPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow
            label="Anchor"
            value={`(${Math.round(el.anchorMm.xMm)}, ${Math.round(el.anchorMm.yMm)}) mm`}
            mono
          />
          <FieldRow
            label="Text"
            value={`(${Math.round(el.textMm.xMm)}, ${Math.round(el.textMm.yMm)}) mm`}
            mono
          />
          {ltPropChange ? (
            <>
              <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
                <button
                  type="button"
                  className={`rounded border px-2 py-0.5 text-xs font-bold ${el.bold ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
                  data-testid="inspector-text-bold"
                  aria-pressed={!!el.bold}
                  onClick={() => ltPropChange('bold', !el.bold)}
                >
                  B
                </button>
                <button
                  type="button"
                  className={`rounded border px-2 py-0.5 text-xs italic ${el.italic ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
                  data-testid="inspector-text-italic"
                  aria-pressed={!!el.italic}
                  onClick={() => ltPropChange('italic', !el.italic)}
                >
                  I
                </button>
                <button
                  type="button"
                  className={`rounded border px-2 py-0.5 text-xs underline ${el.underline ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
                  data-testid="inspector-text-underline"
                  aria-pressed={!!el.underline}
                  onClick={() => ltPropChange('underline', !el.underline)}
                >
                  U
                </button>
                <span className="mx-1 text-muted">|</span>
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    className={`rounded border px-2 py-0.5 text-xs ${(el.horizontalAlign ?? 'left') === align ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
                    data-testid={`inspector-text-align-${align}`}
                    aria-pressed={(el.horizontalAlign ?? 'left') === align}
                    onClick={() => ltPropChange('horizontalAlign', align)}
                  >
                    {align[0]!.toUpperCase()}
                  </button>
                ))}
                <span className="mx-1 text-muted">|</span>
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border border-border bg-surface p-0.5"
                  // eslint-disable-next-line bim-ai/no-hex-in-chrome
                  value={el.colorHex ?? '#202020'}
                  key={`${el.id}-color`}
                  aria-label="Leader text color"
                  data-testid="inspector-text-color"
                  onChange={(e) => ltPropChange('colorHex', e.currentTarget.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Content</span>
                <textarea
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                  rows={3}
                  defaultValue={el.content}
                  key={`${el.id}-content`}
                  aria-label="Leader text content"
                  data-testid="inspector-leader-text-content"
                  onBlur={(e) => ltPropChange('content', e.currentTarget.value)}
                />
              </div>
              <label className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Arrow style</span>
                <select
                  className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  value={el.arrowStyle ?? 'arrow'}
                  data-testid="inspector-leader-text-arrow-style"
                  onChange={(e) => ltPropChange('arrowStyle', e.currentTarget.value)}
                >
                  <option value="arrow">Arrow</option>
                  <option value="dot">Dot</option>
                  <option value="none">None</option>
                </select>
              </label>
            </>
          ) : (
            <FieldRow label="Content" value={el.content} />
          )}
        </div>
      );
    }
    case 'angular_dimension': {
      const { onPropertyChange: angPropChange } = options ?? {};
      const rayA = {
        xMm: el.rayAMm.xMm - el.vertexMm.xMm,
        yMm: el.rayAMm.yMm - el.vertexMm.yMm,
      };
      const rayB = {
        xMm: el.rayBMm.xMm - el.vertexMm.xMm,
        yMm: el.rayBMm.yMm - el.vertexMm.yMm,
      };
      const angleDeg = angleBetweenVectors(rayA, rayB);
      const offsetMag = el.offsetMm ? Math.hypot(el.offsetMm.xMm, el.offsetMm.yMm).toFixed(0) : '0';
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
          {angPropChange ? (
            <>
              <div className="flex flex-col gap-1 border-t border-border pt-2">
                <span className="text-xs font-medium text-muted">Text decoration</span>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Prefix</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textPrefix ?? ''}
                    key={`${el.id}-prefix`}
                    placeholder="e.g. ≈"
                    aria-label="Angular dimension text prefix"
                    data-testid="inspector-angular-dim-prefix"
                    onBlur={(e) => angPropChange('textPrefix', e.currentTarget.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Suffix</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textSuffix ?? ''}
                    key={`${el.id}-suffix`}
                    placeholder="e.g. °"
                    aria-label="Angular dimension text suffix"
                    data-testid="inspector-angular-dim-suffix"
                    onBlur={(e) => angPropChange('textSuffix', e.currentTarget.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Override</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textOverride ?? ''}
                    key={`${el.id}-override`}
                    placeholder="replaces computed angle"
                    aria-label="Angular dimension text override"
                    data-testid="inspector-angular-dim-override"
                    onBlur={(e) => angPropChange('textOverride', e.currentTarget.value || null)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <button
                  type="button"
                  className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:bg-surface/80"
                  data-testid="inspector-angular-dim-flip"
                  onClick={() =>
                    angPropChange('offsetMm', {
                      xMm: el.offsetMm?.xMm ?? 0,
                      yMm: -(el.offsetMm?.yMm ?? 0),
                    })
                  }
                >
                  Flip
                </button>
              </div>
            </>
          ) : null}
          {el.autoGenerated ? <FieldRow label="Auto-generated" value="Yes" /> : null}
        </div>
      );
    }
    case 'radial_dimension':
    case 'diameter_dimension': {
      const { onPropertyChange: radPropChange } = options ?? {};
      const computedRadiusMm = Math.hypot(
        el.arcPointMm.xMm - el.centerMm.xMm,
        el.arcPointMm.yMm - el.centerMm.yMm,
      );
      const displayRadiusMm = el.radiusMm ?? computedRadiusMm;
      const isDiameter = el.kind === 'diameter_dimension';
      const valueTestId = isDiameter
        ? 'inspector-diameter-dim-value'
        : 'inspector-radial-dim-value';
      const displayValue = isDiameter ? displayRadiusMm * 2 : displayRadiusMm;
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
            <span className="text-xs text-muted">{isDiameter ? 'Diameter' : 'Radius'}</span>
            <span
              className="text-sm text-foreground"
              data-testid={valueTestId}
            >{`${Math.round(displayValue)} mm`}</span>
          </div>
          {radPropChange ? (
            <>
              <div className="flex flex-col gap-1 border-t border-border pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Prefix</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textPrefix ?? ''}
                    key={`${el.id}-prefix`}
                    placeholder={isDiameter ? 'Ø' : 'R'}
                    aria-label="Dimension text prefix"
                    data-testid="inspector-radial-dim-prefix"
                    onBlur={(e) => radPropChange('textPrefix', e.currentTarget.value || null)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted">Override</span>
                  <input
                    type="text"
                    className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                    defaultValue={el.textOverride ?? ''}
                    key={`${el.id}-override`}
                    placeholder="replaces computed value"
                    aria-label="Dimension text override"
                    data-testid="inspector-radial-dim-override"
                    onBlur={(e) => radPropChange('textOverride', e.currentTarget.value || null)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <button
                  type="button"
                  className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:bg-surface/80"
                  data-testid="inspector-radial-dim-flip"
                  onClick={() => radPropChange('flipped', !el.flipped)}
                >
                  Flip
                </button>
              </div>
            </>
          ) : null}
          {el.autoGenerated ? <FieldRow label="Auto-generated" value="Yes" /> : null}
        </div>
      );
    }
    case 'arc_length_dimension': {
      const arcAngleDeg = Math.abs(el.endAngleDeg - el.startAngleDeg);
      const arcLengthMm = (arcAngleDeg / 360) * 2 * Math.PI * el.radiusMm;
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow label="Radius" value={`${Math.round(el.radiusMm)} mm`} mono />
          <FieldRow label="Arc Angle" value={`${arcAngleDeg.toFixed(1)}°`} mono />
          <FieldRow label="Arc Length" value={`${Math.round(arcLengthMm)} mm`} mono />
          {el.autoGenerated ? <FieldRow label="Auto-generated" value="Yes" /> : null}
        </div>
      );
    }
    case 'angular_dimension': {
      return (
        <div style={{ padding: 8 }}>
          <div className="text-xs font-semibold mb-1">Angular Dimension</div>
          <div className="text-xs text-muted">
            Vertex: ({(el as any).vertexMm?.xMm?.toFixed(0)},{' '}
            {(el as any).vertexMm?.yMm?.toFixed(0)})
          </div>
          <div className="text-xs text-muted" data-testid="inspector-angular-dim-arc-radius">
            Arc radius: {(el as any).arcRadiusMm ?? 400} mm
          </div>
        </div>
      );
    }
    case 'radial_dimension': {
      const dx = ((el as any).arcPointMm?.xMm ?? 0) - ((el as any).centerMm?.xMm ?? 0);
      const dy = ((el as any).arcPointMm?.yMm ?? 0) - ((el as any).centerMm?.yMm ?? 0);
      const radiusMm = Math.round(Math.hypot(dx, dy));
      return (
        <div style={{ padding: 8 }}>
          <div className="text-xs font-semibold mb-1">Radial Dimension</div>
          <div className="text-xs text-muted" data-testid="inspector-radial-dim-radius">
            Radius: {radiusMm} mm
          </div>
        </div>
      );
    }
    case 'diameter_dimension': {
      const dxD = ((el as any).arcPointMm?.xMm ?? 0) - ((el as any).centerMm?.xMm ?? 0);
      const dyD = ((el as any).arcPointMm?.yMm ?? 0) - ((el as any).centerMm?.yMm ?? 0);
      const diameterMm = Math.round(Math.hypot(dxD, dyD) * 2);
      return (
        <div style={{ padding: 8 }}>
          <div className="text-xs font-semibold mb-1">Diameter Dimension</div>
          <div className="text-xs text-muted" data-testid="inspector-diameter-dim-diameter">
            Diameter: {diameterMm} mm
          </div>
        </div>
      );
    }
    case 'permanent_dimension': {
      const { onPropertyChange: pdPropChange } = options ?? {};
      const offsetMag = Math.round(Math.hypot(el.offsetMm.xMm, el.offsetMm.yMm));
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Segments" value={String(el.witnessPointsMm.length - 1)} />
          <FieldRow label="Level" value={el.levelId} mono />
          <div className="flex items-center justify-between gap-4 border-b border-border py-1.5">
            <span className="text-xs text-muted">Offset</span>
            <span
              className="text-sm text-foreground"
              data-testid="inspector-dim-offset"
            >{`${offsetMag} mm from chain`}</span>
          </div>
          {pdPropChange ? (
            <div className="flex items-center gap-2 py-0.5">
              <button
                type="button"
                className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:bg-surface/80"
                data-testid="inspector-permanent-dimension-eq"
                onClick={() => pdPropChange('eqEnabled', !el.eqEnabled)}
              >
                {el.eqEnabled ? 'EQ On' : 'EQ Off'}
              </button>
              <button
                type="button"
                className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium hover:bg-surface/80"
                data-testid="inspector-dim-flip"
                onClick={() => pdPropChange('flipped', !el.flipped)}
              >
                Flip
              </button>
            </div>
          ) : (
            <FieldRow label="EQ" value={el.eqEnabled ? 'On' : 'Off'} />
          )}
          {/* Dimension element references */}
          {(el as any).witnessPointsMm?.some((pt: any) => pt.referencedElementId) && (
            <details style={{ marginTop: 8 }}>
              <summary
                data-testid="inspector-dim-references-summary"
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                Element References (
                {(el as any).witnessPointsMm.filter((pt: any) => pt.referencedElementId).length})
              </summary>
              <div style={{ marginTop: 4 }}>
                {(el as any).witnessPointsMm
                  .filter((pt: any) => pt.referencedElementId)
                  .map((pt: any, i: number) => (
                    <div
                      key={i}
                      data-testid={`inspector-dim-ref-${i}`}
                      style={{ fontSize: 11, color: '#aaa', padding: '2px 0' }}
                    >
                      Pt {i + 1}: {pt.referencedElementId?.slice(-8)} ({pt.referenceEdge ?? 'auto'})
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      );
    }
    case 'interior_elevation_marker': {
      const { onPropertyChange: iemPropChange } = options ?? {};
      const levels = Object.values(elementsById).filter(
        (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
      );
      const allQuadrants = ['N', 'S', 'E', 'W'] as const;
      const activeQs: ('N' | 'S' | 'E' | 'W')[] = el.activeQuadrants ?? ['N', 'S', 'E', 'W'];
      return (
        <div className="flex flex-col gap-2">
          <FieldRow
            label="Position"
            value={`(${Math.round(el.positionMm.xMm)}, ${Math.round(el.positionMm.yMm)}) mm`}
            mono
          />
          {iemPropChange ? (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Level</span>
              <select
                className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
                value={el.levelId}
                data-testid="inspector-iel-level"
                onChange={(e) => iemPropChange('levelId', e.currentTarget.value)}
              >
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <FieldRow label="Level" value={el.levelId} mono />
          )}
          {iemPropChange ? (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Radius (mm)</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={el.radiusMm ?? 3000}
                key={`${el.id}-radius`}
                step={100}
                aria-label="Elevation marker radius in millimetres"
                data-testid="inspector-iel-radius"
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (!isNaN(v) && v > 0) iemPropChange('radiusMm', v);
                }}
              />
            </div>
          ) : (
            <FieldRow label="Radius (mm)" value={String(el.radiusMm ?? 3000)} mono />
          )}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Quadrants</span>
            <div className="flex gap-2" data-testid="inspector-iel-quadrants">
              {allQuadrants.map((q) => (
                <label key={q} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={activeQs.includes(q)}
                    onChange={(e) => {
                      if (!iemPropChange) return;
                      const next = e.currentTarget.checked
                        ? [...activeQs, q]
                        : activeQs.filter((x) => x !== q);
                      iemPropChange('activeQuadrants', next);
                    }}
                  />
                  {q}
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case 'spot_elevation': {
      const { onPropertyChange: sePropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow
            label="Position"
            value={`(${Math.round(el.positionMm.xMm)}, ${Math.round(el.positionMm.yMm)}) mm`}
            mono
          />
          <FieldRow label="Elevation" value={`${(el.elevationMm / 1000).toFixed(3)} m`} mono />
          {sePropChange ? (
            <>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
                <input
                  type="number"
                  className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.elevationMm}
                  key={`${el.id}-elev`}
                  step={100}
                  aria-label="Spot elevation in millimetres"
                  data-testid="inspector-spot-elevation-mm"
                  onBlur={(e) => sePropChange('elevationMm', Number(e.currentTarget.value))}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Elevation mode</span>
                <select
                  className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  value={el.elevationMode ?? 'absolute'}
                  data-testid="inspector-spot-elevation-mode"
                  onChange={(e) => sePropChange('elevationMode', e.currentTarget.value)}
                >
                  <option value="absolute">Absolute</option>
                  <option value="relative-to-level">Relative to level</option>
                </select>
              </div>
              <label className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  defaultChecked={el.showIn3D !== false}
                  key={`${el.id}-show3d`}
                  data-testid="inspector-spot-elevation-show3d"
                  onChange={(e) => sePropChange('showIn3D', e.currentTarget.checked)}
                />
                <span className="text-xs text-muted">Show in 3D</span>
              </label>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Prefix</span>
                <input
                  type="text"
                  className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.prefix ?? ''}
                  key={`${el.id}-prefix`}
                  aria-label="Elevation text prefix"
                  data-testid="inspector-spot-elevation-prefix"
                  onBlur={(e) => sePropChange('prefix', e.currentTarget.value)}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">Suffix</span>
                <input
                  type="text"
                  className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  defaultValue={el.suffix ?? ''}
                  key={`${el.id}-suffix`}
                  aria-label="Elevation text suffix"
                  data-testid="inspector-spot-elevation-suffix"
                  onBlur={(e) => sePropChange('suffix', e.currentTarget.value)}
                />
              </div>
            </>
          ) : null}
        </div>
      );
    }
    case 'spot_coordinate': {
      const { onPropertyChange: scPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow
            label="Position"
            value={`(${Math.round(el.positionMm.xMm)}, ${Math.round(el.positionMm.yMm)}) mm`}
            mono
          />
          <div className="flex items-center gap-2 py-0.5">
            <label className="flex items-center gap-2 py-0.5 w-full">
              <span className="text-xs text-muted w-28 shrink-0">N (Northing)</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={el.coordinateN ?? el.northMm ?? 0}
                key={`${el.id}-coord-n`}
                data-testid="inspector-spot-coord-n"
                onChange={(e) => scPropChange?.('coordinateN', +e.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <label className="flex items-center gap-2 py-0.5 w-full">
              <span className="text-xs text-muted w-28 shrink-0">E (Easting)</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={el.coordinateE ?? el.eastMm ?? 0}
                key={`${el.id}-coord-e`}
                data-testid="inspector-spot-coord-e"
                onChange={(e) => scPropChange?.('coordinateE', +e.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <span className="text-xs" data-testid="inspector-spot-coord-elevation">
              {el.elevationMm ?? 0}
            </span>
          </div>
        </div>
      );
    }
    case 'spot_slope': {
      const { onPropertyChange: slPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Host View" value={el.hostViewId} mono />
          <FieldRow
            label="Position"
            value={`(${Math.round(el.positionMm.xMm)}, ${Math.round(el.positionMm.yMm)}) mm`}
            mono
          />
          {slPropChange ? (
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs text-muted w-28 shrink-0">Slope (%)</span>
              <input
                type="number"
                className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
                defaultValue={el.slopePct}
                key={`${el.id}-slope`}
                step={0.5}
                aria-label="Slope percentage"
                data-testid="inspector-spot-slope-pct"
                onBlur={(e) => slPropChange('slopePct', Number(e.currentTarget.value))}
              />
            </div>
          ) : (
            <FieldRow label="Slope" value={`${el.slopePct}%`} />
          )}
        </div>
      );
    }
    case 'slope_annotation': {
      const { onPropertyChange: saPropChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
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
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Slope (%)</span>
            <input
              type="number"
              step={0.1}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs"
              defaultValue={el.slopePct}
              key={`${el.id}-sa-slope`}
              data-testid="inspector-slope-annotation-pct"
              onChange={(e) => saPropChange?.('slopePct', +e.target.value)}
            />
          </div>
          <span className="text-xs text-muted" data-testid="inspector-slope-annotation-ratio">
            1:{(100 / Math.max(el.slopePct, 0.01)).toFixed(0)}
          </span>
        </div>
      );
    }
    case 'toposolid': {
      const { onPropertyChange } = options ?? {};
      const samples = el.heightSamples ?? [];
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Contour interval (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.contourIntervalMm ?? 0}
              key={`${el.id}-contour`}
              step={250}
              min={0}
              max={10000}
              data-testid="inspector-topo-contour-interval"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                onPropertyChange?.('contourIntervalMm', v > 0 ? v : null);
              }}
            />
          </div>
          <div className="border-t border-border pt-1">
            <div className="px-0 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Control Points
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-xs text-muted" data-testid="inspector-topo-point-count">
                {samples.length} control points
              </span>
              <button
                type="button"
                data-testid="inspector-topo-clear-points"
                className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
                onClick={() =>
                  onDispatchCommand?.({
                    type: 'update_toposolid',
                    id: el.id,
                    patch: { heightSamples: [] },
                  })
                }
              >
                Clear
              </button>
            </div>
            {samples.map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">
                  ({Math.round(s.xMm)}, {Math.round(s.yMm)})
                </span>
                <input
                  type="number"
                  className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={s.zMm}
                  key={`${el.id}-pt-${i}`}
                  step={100}
                  data-testid={`inspector-topo-point-${i}-z`}
                  onBlur={(e) => {
                    const updated = samples.map((pt, j) =>
                      j === i ? { ...pt, zMm: Number(e.currentTarget.value) } : pt,
                    );
                    onDispatchCommand?.({
                      type: 'update_toposolid',
                      id: el.id,
                      patch: { heightSamples: updated },
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'graded_region': {
      const { onPropertyChange } = options ?? {};
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Lower Elevation (mm)</span>
            <input
              type="number"
              data-testid="inspector-graded-region-lower"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.lowerElevationMm ?? 0}
              key={`${el.id}-lower`}
              step={100}
              onBlur={(e) => onPropertyChange?.('lowerElevationMm', +e.currentTarget.value)}
            />
          </label>
          <label className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Upper Elevation (mm)</span>
            <input
              type="number"
              data-testid="inspector-graded-region-upper"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.upperElevationMm ?? 500}
              key={`${el.id}-upper`}
              step={100}
              onBlur={(e) => onPropertyChange?.('upperElevationMm', +e.currentTarget.value)}
            />
          </label>
        </div>
      );
    }
    case 'toposolid_excavation': {
      const { onPropertyChange } = options ?? {};
      const pts = el.boundaryMm ?? [];
      const shoelace = pts.reduce((acc, p, i) => {
        const q = pts[(i + 1) % pts.length]!;
        return acc + p.xMm * q.yMm - q.xMm * p.yMm;
      }, 0);
      const areaMm2 = Math.abs(shoelace) / 2;
      const areaM2 = areaMm2 / 1_000_000;
      const depth = el.depthMm ?? el.customDepthMm ?? 1500;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Depth (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={depth}
              key={`${el.id}-depth`}
              step={100}
              min={100}
              max={50000}
              data-testid="inspector-excavation-depth"
              onBlur={(e) => {
                const raw = Number(e.currentTarget.value);
                const clamped = Math.max(100, Math.min(50000, raw));
                onPropertyChange?.('depthMm', clamped);
              }}
            />
          </div>
          <FieldRow label="Area" value={`${areaM2.toFixed(2)} m²`} />
        </div>
      );
    }
    case 'toposolid_pad': {
      const { onPropertyChange } = options ?? {};
      const pts = el.boundaryMm ?? [];
      const shoelace = pts.reduce((acc, p, i) => {
        const q = pts[(i + 1) % pts.length]!;
        return acc + p.xMm * q.yMm - q.xMm * p.yMm;
      }, 0);
      const areaM2 = Math.abs(shoelace) / 2 / 1_000_000;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <input
              type="number"
              className="w-20 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={el.elevationMm}
              key={`${el.id}-elevation`}
              step={100}
              data-testid="inspector-pad-elevation"
              onBlur={(e) => {
                const raw = Number(e.currentTarget.value);
                onPropertyChange?.('elevationMm', raw);
              }}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5" data-testid="inspector-pad-area">
            <span className="text-xs text-muted w-28 shrink-0">Area</span>
            <span className="text-xs">{areaM2.toFixed(1)} m²</span>
          </div>
        </div>
      );
    }
    case 'mass_box':
    case 'mass_extrusion':
    case 'mass_revolution': {
      return (
        <div className="flex flex-col gap-2">
          {el.kind === 'mass_box' && (
            <>
              <FieldRow label="Width (mm)" value={String(el.widthMm)} />
              <FieldRow label="Depth (mm)" value={String(el.depthMm)} />
              <FieldRow label="Height (mm)" value={String(el.heightMm)} />
            </>
          )}
          {el.kind === 'mass_extrusion' && (
            <FieldRow label="Height (mm)" value={String(el.heightMm)} />
          )}
          <div className="border-t border-border pt-1">
            <div className="px-0 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Generate from Mass
            </div>
            <div className="flex flex-col gap-1 pt-0.5">
              <button
                type="button"
                data-testid="mass-gen-floors-btn"
                className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground text-left"
                onClick={() =>
                  onDispatchCommand?.({ type: 'generate_floors_from_mass', massId: el.id })
                }
              >
                Generate Floors by Level
              </button>
              <button
                type="button"
                data-testid="mass-apply-curtain-btn"
                className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground text-left"
                onClick={() =>
                  onDispatchCommand?.({ type: 'apply_curtain_to_mass', massId: el.id })
                }
              >
                Apply Curtain System
              </button>
            </div>
          </div>
        </div>
      );
    }
    case 'placed_tag': {
      const { onPropertyChange } = options ?? {};
      const tagEl = el as Extract<Element, { kind: 'placed_tag' }>;
      const targetEl = elementsById[tagEl.hostElementId];
      const targetName = targetEl
        ? ((targetEl as { name?: string }).name ?? tagEl.hostElementId)
        : tagEl.hostElementId;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Mark</span>
            <input
              type="text"
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={tagEl.fields?.mark ?? ''}
              key={`${tagEl.id}-mark`}
              data-testid="inspector-tag-mark"
              onBlur={(e) =>
                onPropertyChange?.('fields', {
                  ...tagEl.fields,
                  mark: e.currentTarget.value || null,
                })
              }
            />
          </div>
          {tagEl.fields?.typeName ? <FieldRow label="Type" value={tagEl.fields.typeName} /> : null}
          <div data-testid="inspector-tag-type" style={{ display: 'none' }}>
            {tagEl.fields?.typeName ?? ''}
          </div>
          <FieldRow label="Target" value={targetName} />
          <div data-testid="inspector-tag-target" style={{ display: 'none' }}>
            {targetName}
          </div>
          {tagEl.categoryKind === 'room' ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-muted">Room Tag Fields</div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  data-testid="inspector-tag-show-number"
                  checked={tagEl.showRoomNumber !== false}
                  onChange={(e) => onPropertyChange?.('showRoomNumber', e.target.checked)}
                />
                Show Room Number
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  data-testid="inspector-tag-show-name"
                  checked={tagEl.showRoomName !== false}
                  onChange={(e) => onPropertyChange?.('showRoomName', e.target.checked)}
                />
                Show Room Name
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  data-testid="inspector-tag-show-area"
                  checked={tagEl.showRoomArea === true}
                  onChange={(e) => onPropertyChange?.('showRoomArea', e.target.checked)}
                />
                Show Area (m²)
              </label>
              <FieldRow
                label="Area"
                value={
                  tagEl.fields?.roomArea != null
                    ? `${(tagEl.fields.roomArea / 1e6).toFixed(2)} m²`
                    : '—'
                }
              />
            </div>
          ) : null}
        </div>
      );
    }
    case 'detail_group': {
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Members" value={String(el.memberIds?.length ?? 0)} />
          <button
            type="button"
            data-testid="inspector-group-edit"
            className="rounded border border-border bg-surface-strong px-2 py-1 text-xs hover:bg-accent-soft self-start"
            onClick={() => onDispatchCommand?.({ type: 'editGroup', groupDefinitionId: el.id })}
          >
            Edit Group
          </button>
        </div>
      );
    }
    case 'project_base_point': {
      const { onPropertyChange: pbpPropChange } = options ?? {};
      const posMm = el.positionMm as { xMm: number; yMm: number; zMm?: number };
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Position X (mm)</span>
            <input
              type="number"
              className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={posMm.xMm}
              key={`${el.id}-pbp-x`}
              step={100}
              data-testid="inspector-pbp-x"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v))
                  pbpPropChange?.('positionMm', {
                    xMm: v,
                    yMm: posMm.yMm,
                    zMm: posMm.zMm ?? 0,
                  });
              }}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Position Y (mm)</span>
            <input
              type="number"
              className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={posMm.yMm}
              key={`${el.id}-pbp-y`}
              step={100}
              data-testid="inspector-pbp-y"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v))
                  pbpPropChange?.('positionMm', {
                    xMm: posMm.xMm,
                    yMm: v,
                    zMm: posMm.zMm ?? 0,
                  });
              }}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Elevation (mm)</span>
            <input
              type="number"
              className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={(posMm as { zMm?: number }).zMm ?? 0}
              key={`${el.id}-pbp-elevation`}
              step={100}
              data-testid="inspector-pbp-elevation"
              onBlur={(e) => {
                const v = Number(e.currentTarget.value);
                if (!isNaN(v))
                  pbpPropChange?.('positionMm', {
                    xMm: posMm.xMm,
                    yMm: posMm.yMm,
                    zMm: v,
                  });
              }}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Name</span>
            <input
              type="text"
              className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
              defaultValue={(el as { name?: string | null }).name ?? ''}
              key={`${el.id}-pbp-name`}
              data-testid="inspector-pbp-name"
              onBlur={(e) => {
                pbpPropChange?.('name', e.currentTarget.value || null);
              }}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Shared Coordinates</span>
            <input
              type="checkbox"
              className="text-xs"
              defaultChecked={false}
              key={`${el.id}-pbp-shared`}
              data-testid="inspector-pbp-shared"
              onChange={(e) => {
                pbpPropChange?.('isShared', e.currentTarget.checked);
              }}
            />
          </div>
        </div>
      );
    }
    case 'decal': {
      const { onPropertyChange } = options ?? {};
      const decalEl = el as Extract<Element, { kind: 'decal' }>;
      return (
        <div className="flex flex-col gap-2" data-testid="inspector-decal">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Image</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {(decalEl as { imageSrc?: string | null }).imageSrc ? (
                <img
                  src={(decalEl as { imageSrc?: string | null }).imageSrc!}
                  alt="decal preview"
                  data-testid="inspector-decal-preview"
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: 'contain',
                    border: '1px solid var(--color-border)',
                  }}
                />
              ) : (
                <div
                  data-testid="inspector-decal-no-image"
                  style={{
                    width: 64,
                    height: 64,
                    background: 'var(--color-muted, #f0f0f0)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                  }}
                >
                  No image
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                data-testid="inspector-decal-file-input"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    onPropertyChange?.('imageSrc', dataUrl);
                  };
                  reader.readAsDataURL(file);
                }}
                style={{ fontSize: 11 }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Width (mm)</span>
            <input
              type="number"
              className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
              data-testid="inspector-decal-width"
              value={(decalEl as { widthMm?: number }).widthMm ?? 500}
              onChange={(e) => onPropertyChange?.('widthMm', +e.currentTarget.value)}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Height (mm)</span>
            <input
              type="number"
              className="w-24 text-xs bg-surface border border-border rounded px-1 py-0.5"
              data-testid="inspector-decal-height"
              value={(decalEl as { heightMm?: number }).heightMm ?? 500}
              onChange={(e) => onPropertyChange?.('heightMm', +e.currentTarget.value)}
            />
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              data-testid="inspector-decal-opacity"
              value={(decalEl as { opacity?: number }).opacity ?? 1}
              onChange={(e) => onPropertyChange?.('opacity', +e.currentTarget.value)}
            />
          </div>
        </div>
      );
    }
    case 'detail_line': {
      const { onPropertyChange: dlPropChange } = options ?? {};
      const dlEl = el as Extract<Element, { kind: 'detail_line' }>;
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            Line Weight (px)
            <input
              type="number"
              data-testid="inspector-detail-line-weight"
              className="w-20 bg-surface border border-border rounded px-1 py-0.5"
              value={dlEl.lineWeightPx ?? 1}
              onChange={(e) => dlPropChange?.('lineWeightPx', +e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            Color
            <input
              type="color"
              data-testid="inspector-detail-line-color"
              value={dlEl.colorHex ?? '#000000'}
              onChange={(e) => dlPropChange?.('colorHex', e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            Style
            <select
              data-testid="inspector-detail-line-style"
              className="bg-surface border border-border rounded px-1 py-0.5"
              value={dlEl.lineStyle ?? 'solid'}
              onChange={(e) => dlPropChange?.('lineStyle', e.target.value)}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>
          <span data-testid="inspector-detail-line-points" className="text-xs text-muted">
            {(dlEl.pointsMm ?? []).length} points
          </span>
        </div>
      );
    }
    case 'detail_filled_region': {
      const { onPropertyChange: dfrPropChange } = options ?? {};
      const dfrEl = el as Extract<Element, { kind: 'detail_filled_region' }>;
      return (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            Fill Pattern
            <select
              data-testid="inspector-detail-filled-region-pattern"
              className="bg-surface border border-border rounded px-1 py-0.5"
              value={dfrEl.fillPattern ?? 'solid'}
              onChange={(e) => dfrPropChange?.('fillPattern', e.target.value)}
            >
              <option value="solid">Solid</option>
              <option value="hatch-45">Hatch 45°</option>
              <option value="hatch-90">Hatch 90°</option>
              <option value="cross">Cross</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            Color
            <input
              type="color"
              data-testid="inspector-detail-filled-region-color"
              value={dfrEl.colorHex ?? '#cccccc'}
              onChange={(e) => dfrPropChange?.('colorHex', e.target.value)}
            />
          </label>
          <span data-testid="inspector-detail-filled-region-points" className="text-xs text-muted">
            {(dfrEl.perimeterMm ?? []).length} points
          </span>
        </div>
      );
    }
    case 'detail_arc': {
      const darcEl = el as Extract<Element, { kind: 'detail_arc' }>;
      return (
        <div className="flex flex-col gap-2">
          <FieldRow
            label="Center"
            value={`(${Math.round(darcEl.centerMm.xMm)}, ${Math.round(darcEl.centerMm.yMm)}) mm`}
            mono
          />
          <FieldRow label="Radius" value={`${Math.round(darcEl.radiusMm)} mm`} mono />
          <FieldRow
            label="Angles"
            value={`${darcEl.startAngleDeg}° → ${darcEl.endAngleDeg}°`}
            mono
          />
        </div>
      );
    }
    case 'shaft': {
      const { onPropertyChange } = options ?? {};
      const levels = Object.values(elementsById)
        .filter((e): e is Extract<Element, { kind: 'level' }> => e?.kind === 'level')
        .sort((a, b) => a.elevationMm - b.elevationMm);
      return (
        <div className="flex flex-col gap-2">
          <FieldRow label="Boundary Vertices" value={String(el.boundaryMm.length)} mono />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Base Level</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              data-testid="inspector-shaft-base-level"
              value={el.baseLevelId ?? ''}
              onChange={(e) => onPropertyChange?.('baseLevelId', e.target.value || null)}
            >
              <option value="">— none —</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">Top Level</span>
            <select
              className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
              data-testid="inspector-shaft-top-level"
              value={el.topLevelId ?? ''}
              onChange={(e) => onPropertyChange?.('topLevelId', e.target.value || null)}
            >
              <option value="">— none —</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
            data-testid="inspector-shaft-recompute"
            onClick={() => onDispatchCommand?.({ type: 'recomputeShaftCuts', shaftId: el.id })}
          >
            Recompute Cuts
          </button>
          <button
            type="button"
            className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
            data-testid="inspector-shaft-apply-cut"
            onClick={() =>
              onDispatchCommand?.({ type: 'applyShaftCut', shaftId: el.id, cutFloorIds: [] })
            }
          >
            Apply Shaft Cut
          </button>
          <span data-testid="inspector-shaft-cut-floor-count" className="text-xs text-muted">
            Cuts {((el as any).cutFloorIds ?? []).length} floor(s)
          </span>
          <ShaftSideWallsButton shaft={el} onDispatchCommand={onDispatchCommand} />
        </div>
      );
    }
    default: {
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
          data-testid="inspector-room-target-area"
          onBlur={(e) => onPersistProperty('targetAreaM2', e.target.value.trim())}
        />
      </label>
      <label className={LABEL_CLS}>
        Room Number
        <input
          className={INPUT_CLS}
          defaultValue={el.numberLabel ?? ''}
          key={`rm-num-${el.id}-${el.numberLabel ?? ''}-${revision}`}
          data-testid="inspector-room-number"
          onBlur={(e) => onPersistProperty('numberLabel', e.target.value.trim())}
        />
      </label>
      <label className={LABEL_CLS}>
        Gross Area
        <input
          className={INPUT_CLS}
          value={el.outlineMm.length >= 3 ? `${roomAreaM2(el.outlineMm).toFixed(1)} m²` : '—'}
          readOnly
          data-testid="inspector-room-area-gross"
          onChange={() => undefined}
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
  const geo = el.georeference;
  const [latDraft, setLatDraft] = useState(String(geo?.anchorLat ?? ''));
  const [lonDraft, setLonDraft] = useState(String(geo?.anchorLon ?? ''));
  const [radiusDraft, setRadiusDraft] = useState(String(geo?.contextRadiusM ?? 300));
  const [geoSearchDraft, setGeoSearchDraft] = useState('');
  const [geoSearchBusy, setGeoSearchBusy] = useState(false);

  function commitGeoreference(lat: number, lon: number, radius: number) {
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(radius)) return;
    onPersistProperty(
      'georeference',
      JSON.stringify({ anchorLat: lat, anchorLon: lon, contextRadiusM: radius }),
    );
  }

  function handleGeoSearch() {
    const q = geoSearchDraft.trim();
    if (!q) return;
    setGeoSearchBusy(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      {
        headers: { 'Accept-Language': 'en' },
      },
    )
      .then((r) => r.json())
      .then((results: Array<{ lat: string; lon: string }>) => {
        const first = results[0];
        if (!first) return;
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        const radius = parseFloat(radiusDraft) || 300;
        setLatDraft(lat.toFixed(6));
        setLonDraft(lon.toFixed(6));
        commitGeoreference(lat, lon, radius);
      })
      .catch(() => undefined)
      .finally(() => setGeoSearchBusy(false));
  }

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

      <div className="border-t border-border pt-2">
        <p
          className="mb-1.5 text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em' }}
        >
          Site Context (OSM)
        </p>
        <div className="flex gap-1">
          <input
            className={`${INPUT_CLS} flex-1`}
            type="text"
            placeholder="Search address…"
            value={geoSearchDraft}
            onChange={(e) => setGeoSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGeoSearch();
            }}
            data-testid="inspector-geo-search"
          />
          <button
            type="button"
            className="rounded border border-border bg-surface px-2 py-0.5 text-[10px] text-muted hover:border-accent hover:text-accent disabled:opacity-40"
            disabled={geoSearchBusy || !geoSearchDraft.trim()}
            onClick={handleGeoSearch}
            data-testid="inspector-geo-search-btn"
          >
            {geoSearchBusy ? '…' : 'Find'}
          </button>
        </div>
        <div className="mt-1 flex gap-1">
          <label className="flex flex-1 flex-col gap-0.5">
            <span className="text-[9px] text-muted">Lat</span>
            <input
              className={INPUT_CLS}
              type="number"
              step="0.000001"
              value={latDraft}
              onChange={(e) => setLatDraft(e.target.value)}
              onBlur={() => {
                const lat = parseFloat(latDraft);
                const lon = parseFloat(lonDraft);
                const radius = parseFloat(radiusDraft) || 300;
                commitGeoreference(lat, lon, radius);
              }}
              data-testid="inspector-geo-lat"
            />
          </label>
          <label className="flex flex-1 flex-col gap-0.5">
            <span className="text-[9px] text-muted">Lon</span>
            <input
              className={INPUT_CLS}
              type="number"
              step="0.000001"
              value={lonDraft}
              onChange={(e) => setLonDraft(e.target.value)}
              onBlur={() => {
                const lat = parseFloat(latDraft);
                const lon = parseFloat(lonDraft);
                const radius = parseFloat(radiusDraft) || 300;
                commitGeoreference(lat, lon, radius);
              }}
              data-testid="inspector-geo-lon"
            />
          </label>
        </div>
        <label className={`${LABEL_CLS} mt-1`}>
          <span>Radius (m)</span>
          <select
            className={INPUT_CLS}
            value={radiusDraft}
            onChange={(e) => {
              setRadiusDraft(e.target.value);
              const lat = parseFloat(latDraft);
              const lon = parseFloat(lonDraft);
              const radius = parseFloat(e.target.value);
              commitGeoreference(lat, lon, radius);
            }}
            data-testid="inspector-geo-radius"
          >
            <option value="100">100 m</option>
            <option value="300">300 m</option>
            <option value="500">500 m</option>
            <option value="1000">1000 m</option>
          </select>
        </label>
        {geo && (
          <button
            type="button"
            className="mt-1 text-[10px] text-danger hover:underline"
            onClick={() => {
              onPersistProperty('georeference', 'null');
              setLatDraft('');
              setLonDraft('');
            }}
            data-testid="inspector-geo-clear"
          >
            Clear georeference
          </button>
        )}
      </div>
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
