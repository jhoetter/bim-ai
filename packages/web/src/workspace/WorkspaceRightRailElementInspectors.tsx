import { useRef, type JSX } from 'react';
import type { Element, ParamSchemaEntry } from '@bim-ai/core';

import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import type { FamilyDefinition, FamilyParamDef } from '../families/types';
import {
  buildAuthoredFamilyDefinition,
  FAMILY_EDITOR_DEFINITION_PARAM,
  FAMILY_EDITOR_DOCUMENT_PARAM,
  type AuthoredFamilyDocument,
} from '../familyEditor/familyEditorPersistence';
import { InspectorPropertiesFor, type MaterialBrowserTargetRequest } from './inspector';

export type FamilyTypeElement = Extract<Element, { kind: 'family_type' }>;

function isFamilyDefinition(value: unknown): value is FamilyDefinition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    Array.isArray((value as { params?: unknown }).params),
  );
}

function familyDefinitionForType(type: FamilyTypeElement | undefined): FamilyDefinition | null {
  if (!type) return null;
  const embedded = type.parameters[FAMILY_EDITOR_DEFINITION_PARAM];
  if (isFamilyDefinition(embedded)) return embedded;
  const document = type.parameters[FAMILY_EDITOR_DOCUMENT_PARAM];
  if (document && typeof document === 'object') {
    return buildAuthoredFamilyDefinition(document as AuthoredFamilyDocument);
  }
  return BUILT_IN_FAMILIES.find((definition) => definition.id === type.familyId) ?? null;
}

function familyInstanceSiblingTypes(
  type: FamilyTypeElement | undefined,
  elementsById: Record<string, Element>,
): FamilyTypeElement[] {
  if (!type) return [];
  return Object.values(elementsById)
    .filter(
      (candidate): candidate is FamilyTypeElement =>
        candidate.kind === 'family_type' && candidate.familyId === type.familyId,
    )
    .sort((a, b) =>
      String(a.parameters.name ?? a.name).localeCompare(String(b.parameters.name ?? b.name)),
    );
}

type MaterialEditableInstance = Extract<
  Element,
  {
    kind:
      | 'toposolid'
      | 'toposolid_subdivision'
      | 'wall'
      | 'door'
      | 'window'
      | 'roof'
      | 'column'
      | 'beam'
      | 'text_3d'
      | 'sweep'
      | 'mass'
      | 'pipe';
  }
>;

function hasInstanceMaterialKey(element: Element): element is MaterialEditableInstance {
  switch (element.kind) {
    case 'toposolid':
    case 'toposolid_subdivision':
    case 'wall':
    case 'door':
    case 'window':
    case 'roof':
    case 'column':
    case 'beam':
    case 'text_3d':
    case 'sweep':
    case 'mass':
    case 'pipe':
      return true;
    default:
      return false;
  }
}

export function hasMaterialEditableTarget(
  element: Element,
  elementsById: Record<string, Element>,
): boolean {
  if (
    element.kind === 'wall_type' ||
    element.kind === 'floor_type' ||
    element.kind === 'roof_type'
  ) {
    return true;
  }
  if (element.kind === 'wall' && element.wallTypeId) {
    return elementsById[element.wallTypeId]?.kind === 'wall_type';
  }
  if (element.kind === 'roof' && element.roofTypeId) {
    return elementsById[element.roofTypeId]?.kind === 'roof_type';
  }
  if (hasInstanceMaterialKey(element)) return true;
  if (element.kind === 'floor') {
    const typeId = element.floorTypeId;
    if (!typeId) return false;
    const type = elementsById[typeId];
    return type?.kind === 'floor_type';
  }
  return false;
}

export function PlacedAssetInspector({
  el,
  assetEntry,
  onSemanticCommand,
}: {
  el: Extract<Element, { kind: 'placed_asset' }>;
  assetEntry?: Extract<Element, { kind: 'asset_library_entry' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  const dxRef = useRef<HTMLInputElement | null>(null);
  const dyRef = useRef<HTMLInputElement | null>(null);
  const params = assetEntry?.paramSchema ?? [];

  function currentParamValue(param: ParamSchemaEntry): unknown {
    return el.paramValues && param.key in el.paramValues
      ? el.paramValues[param.key]
      : param.default;
  }

  function commitParamValue(param: ParamSchemaEntry, value: unknown): void {
    const next = { ...(el.paramValues ?? {}), [param.key]: value };
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: el.id,
      key: 'paramValues',
      value: next,
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-foreground">{el.name}</div>
      <div className="space-y-1 text-xs text-muted">
        <div>
          <span className="font-medium">Asset ID:</span>{' '}
          <span className="font-mono">{el.assetId}</span>
        </div>
        <div>
          <span className="font-medium">X:</span> {el.positionMm.xMm.toFixed(1)} mm
        </div>
        <div>
          <span className="font-medium">Y:</span> {el.positionMm.yMm.toFixed(1)} mm
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">Rotation:</span>
          <input
            type="number"
            step={15}
            defaultValue={el.rotationDeg ?? 0}
            className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-asset-rotation"
            onChange={(e) => {
              void onSemanticCommand({
                type: 'updateElementProperty',
                elementId: el.id,
                key: 'rotationDeg',
                value: Number(e.target.value),
              });
            }}
          />
          <span>{'\u00b0'}</span>
        </div>
      </div>
      {params.length > 0 ? (
        <div className="border-t border-border pt-2 space-y-2">
          <div
            className="text-[10px] font-semibold uppercase text-muted"
            style={{ letterSpacing: '0.08em', opacity: 0.7 }}
          >
            Instance Parameters
          </div>
          {params.map((param) => (
            <PlacedAssetParamField
              key={param.key}
              param={param}
              value={currentParamValue(param)}
              onCommit={(value) => commitParamValue(param, value)}
            />
          ))}
        </div>
      ) : null}
      <div className="border-t border-border pt-2 space-y-1">
        <div
          className="text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em', opacity: 0.7 }}
        >
          Move {'\u0394'}x/{'\u0394'}y (mm)
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted">
            {'\u0394'}x
            <input
              ref={dxRef}
              type="number"
              step={50}
              defaultValue={0}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
              data-testid="inspector-asset-move-dx"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            {'\u0394'}y
            <input
              ref={dyRef}
              type="number"
              step={50}
              defaultValue={0}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
              data-testid="inspector-asset-move-dy"
            />
          </label>
          <button
            type="button"
            className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
            data-testid="inspector-asset-move-apply"
            onClick={() => {
              const dx = Number(dxRef.current?.value ?? 0);
              const dy = Number(dyRef.current?.value ?? 0);
              if (dx === 0 && dy === 0) return;
              void onSemanticCommand({
                type: 'moveAssetDelta',
                elementId: el.id,
                dxMm: dx,
                dyMm: dy,
              });
              if (dxRef.current) dxRef.current.value = '0';
              if (dyRef.current) dyRef.current.value = '0';
            }}
          >
            Apply
          </button>
        </div>
      </div>
      <div className="border-t border-border pt-2">
        <button
          type="button"
          className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-red-500 hover:bg-surface-strong"
          data-testid="inspector-asset-delete"
          onClick={() => {
            void onSemanticCommand({ type: 'deleteElement', elementId: el.id });
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function FamilyInstanceInspector({
  el,
  familyType,
  elementsById,
  onSemanticCommand,
}: {
  el: Extract<Element, { kind: 'family_instance' }>;
  familyType?: FamilyTypeElement;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  const params =
    familyDefinitionForType(familyType)?.params.filter((param) => param.instanceOverridable) ?? [];
  const siblingTypes = familyInstanceSiblingTypes(familyType, elementsById);

  function currentParamValue(param: FamilyParamDef): unknown {
    if (el.paramValues && param.key in el.paramValues) return el.paramValues[param.key];
    if (familyType?.parameters && param.key in familyType.parameters) {
      return familyType.parameters[param.key];
    }
    return param.default;
  }

  function commitParamValue(param: FamilyParamDef, value: unknown): void {
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: el.id,
      key: 'paramValues',
      value: { ...(el.paramValues ?? {}), [param.key]: value },
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-foreground">{el.name}</div>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Type
        <select
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          value={el.familyTypeId}
          data-testid="inspector-family-instance-type"
          onChange={(event) => {
            void onSemanticCommand({
              type: 'updateElementProperty',
              elementId: el.id,
              key: 'familyTypeId',
              value: event.target.value,
            });
          }}
        >
          {siblingTypes.length === 0 ? (
            <option value={el.familyTypeId}>{familyType?.name ?? el.familyTypeId}</option>
          ) : (
            siblingTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {String(type.parameters.name ?? type.name)}
              </option>
            ))
          )}
        </select>
      </label>
      <div className="space-y-1 text-xs text-muted">
        <div>
          <span className="font-medium">X:</span> {el.positionMm.xMm.toFixed(1)} mm
        </div>
        <div>
          <span className="font-medium">Y:</span> {el.positionMm.yMm.toFixed(1)} mm
        </div>
        <div>
          <span className="font-medium">Rotation:</span> {el.rotationDeg ?? 0}
          {'\u00b0'}
        </div>
      </div>
      {params.length > 0 ? (
        <div className="border-t border-border pt-2 space-y-2">
          <div
            className="text-[10px] font-semibold uppercase text-muted"
            style={{ letterSpacing: '0.08em', opacity: 0.7 }}
          >
            Instance Parameters
          </div>
          {params.map((param) => (
            <FamilyInstanceParamField
              key={param.key}
              param={param}
              value={currentParamValue(param)}
              onCommit={(value) => commitParamValue(param, value)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded border border-border bg-background p-2 text-xs text-muted">
          This family type has no instance parameters.
        </div>
      )}
    </div>
  );
}

function FamilyInstanceParamField({
  param,
  value,
  onCommit,
}: {
  param: FamilyParamDef;
  value: unknown;
  onCommit: (value: unknown) => void;
}): JSX.Element {
  const label =
    param.type === 'length_mm' ? `${param.label || param.key} (mm)` : param.label || param.key;
  const fieldId = `inspector-family-instance-param-${param.key}`;

  if (param.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={Boolean(value)}
          data-testid={fieldId}
          onChange={(event) => onCommit(event.target.checked)}
        />
        {param.label || param.key}
      </label>
    );
  }

  if (param.type === 'option') {
    const options = param.options ?? [];
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <select
          value={String(value ?? '')}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          data-testid={fieldId}
          onChange={(event) => onCommit(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (param.type === 'length_mm' || param.type === 'angle_deg') {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <input
          type="number"
          step={param.type === 'angle_deg' ? 1 : 25}
          value={Number.isFinite(Number(value)) ? Number(value) : Number(param.default ?? 0)}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          data-testid={fieldId}
          onChange={(event) => onCommit(Number(event.target.value))}
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="text"
        value={String(value ?? '')}
        className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
        data-testid={fieldId}
        onChange={(event) => onCommit(event.target.value)}
      />
    </label>
  );
}

function PlacedAssetParamField({
  param,
  value,
  onCommit,
}: {
  param: ParamSchemaEntry;
  value: unknown;
  onCommit: (value: unknown) => void;
}): JSX.Element {
  const label = param.kind === 'mm' ? `${param.key} (mm)` : param.key;
  const fieldId = `inspector-asset-param-${param.key}`;

  if (param.kind === 'bool') {
    return (
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={Boolean(value)}
          data-testid={fieldId}
          onChange={(e) => onCommit(e.target.checked)}
        />
        {param.key}
      </label>
    );
  }

  if (param.kind === 'enum') {
    const opts = Array.isArray(param.constraints) ? (param.constraints as string[]) : [];
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <select
          value={String(value ?? '')}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          data-testid={fieldId}
          onChange={(e) => onCommit(e.target.value)}
        >
          {opts.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (param.kind === 'mm') {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <input
          type="number"
          step={25}
          value={Number.isFinite(Number(value)) ? Number(value) : Number(param.default ?? 0)}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          data-testid={fieldId}
          onChange={(e) => onCommit(Number(e.target.value))}
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="text"
        value={String(value ?? '')}
        className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
        data-testid={fieldId}
        onChange={(e) => onCommit(e.target.value)}
      />
    </label>
  );
}

type InspectorTranslate = Parameters<typeof InspectorPropertiesFor>[1];

export function ColumnInspector({
  el,
  onSemanticCommand,
  t,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  el: Extract<Element, { kind: 'column' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  t: InspectorTranslate;
  onOpenMaterialBrowser?: (target?: MaterialBrowserTargetRequest) => void;
  onOpenAppearanceAssetBrowser?: (target?: MaterialBrowserTargetRequest) => void;
}): JSX.Element {
  const dxRef = useRef<HTMLInputElement | null>(null);
  const dyRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-2">
      {InspectorPropertiesFor(el, t, {
        onPropertyChange: (property, value) =>
          void onSemanticCommand({
            type: 'updateElementProperty',
            elementId: el.id,
            key: property,
            value,
          }),
        onOpenMaterialBrowser,
        onOpenAppearanceAssetBrowser,
      })}
      <div
        className="border-t border-border pt-2 space-y-1"
        data-testid="inspector-column-move-delta"
      >
        <div
          className="text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em', opacity: 0.7 }}
        >
          Move {'\u0394'}x/{'\u0394'}y (mm)
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted">
            {'\u0394'}x
            <input
              ref={dxRef}
              type="number"
              step={50}
              defaultValue={0}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
              data-testid="inspector-column-move-dx"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            {'\u0394'}y
            <input
              ref={dyRef}
              type="number"
              step={50}
              defaultValue={0}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
              data-testid="inspector-column-move-dy"
            />
          </label>
          <button
            type="button"
            className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
            data-testid="inspector-column-move-apply"
            onClick={() => {
              const dx = Number(dxRef.current?.value ?? 0);
              const dy = Number(dyRef.current?.value ?? 0);
              if (dx === 0 && dy === 0) return;
              void onSemanticCommand({
                type: 'moveColumnDelta',
                elementId: el.id,
                dxMm: dx,
                dyMm: dy,
              });
              if (dxRef.current) dxRef.current.value = '0';
              if (dyRef.current) dyRef.current.value = '0';
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export function CoordinatePointInspector({
  el,
  onSemanticCommand,
}: {
  el: Extract<Element, { kind: 'project_base_point' | 'survey_point' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  const label = el.kind === 'project_base_point' ? 'Project Base Point' : 'Survey Point';
  const elevationMm = el.kind === 'survey_point' ? el.sharedElevationMm : 0;
  const clipped = el.clipped ?? false;

  function commitPosition(xMm: number, yMm: number) {
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: el.id,
      key: 'positionMm',
      value: { xMm, yMm, zMm: el.positionMm.zMm },
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-foreground">{label}</div>
      <label className="flex items-center justify-between gap-2 rounded border border-border bg-surface/60 px-2 py-1 text-xs text-foreground">
        <span>{clipped ? 'Clipped' : 'Unclipped'}</span>
        <input
          type="checkbox"
          checked={clipped}
          data-testid="inspector-coordinate-clipped"
          aria-label={`${label} clipped`}
          onChange={(e) =>
            void onSemanticCommand({
              type: 'updateElementProperty',
              elementId: el.id,
              key: 'clipped',
              value: e.currentTarget.checked,
            })
          }
        />
      </label>
      <div className="space-y-1 text-xs text-muted">
        <div className="flex items-center gap-1">
          <span className="font-medium w-20">X (E/W):</span>
          <input
            type="number"
            step={100}
            defaultValue={el.positionMm.xMm}
            aria-label="X coordinate (E/W) in mm"
            className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-coord-x"
            onBlur={(e) => {
              commitPosition(Number(e.target.value), el.positionMm.yMm);
            }}
          />
          <span>mm</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium w-20">Y (N/S):</span>
          <input
            type="number"
            step={100}
            defaultValue={el.positionMm.yMm}
            aria-label="Y coordinate (N/S) in mm"
            className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-coord-y"
            onBlur={(e) => {
              commitPosition(el.positionMm.xMm, Number(e.target.value));
            }}
          />
          <span>mm</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium w-20">Elevation:</span>
          <input
            type="number"
            value={elevationMm}
            readOnly
            aria-label="Elevation (read-only) in mm"
            className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground opacity-60 cursor-not-allowed"
            data-testid="inspector-coord-elevation"
          />
          <span>mm</span>
        </div>
      </div>
      <div className="border-t border-border pt-2 space-y-1">
        <div
          className="text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em', opacity: 0.7 }}
        >
          Shared Coordinates
        </div>
        <div className="text-xs text-muted">{label}</div>
        <div className="text-[10px] text-muted opacity-60">
          Used as origin reference for linked models
        </div>
      </div>
    </div>
  );
}

export function WallJoinDisallowSection({
  wall,
  onToggle,
}: {
  wall: Extract<Element, { kind: 'wall' }>;
  onToggle: (endpoint: 'start' | 'end', disallow: boolean) => void;
}): JSX.Element {
  const startDisallowed = wall.joinDisallowStart ?? false;
  const endDisallowed = wall.joinDisallowEnd ?? false;
  return (
    <div className="mt-3 border-t border-border pt-2 space-y-1">
      <div
        className="text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: '0.08em', opacity: 0.7 }}
      >
        Wall Join
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={startDisallowed}
          data-testid="inspector-wall-join-disallow-start"
          onChange={(e) => onToggle('start', e.target.checked)}
        />
        Disallow Join at Start
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={endDisallowed}
          data-testid="inspector-wall-join-disallow-end"
          onChange={(e) => onToggle('end', e.target.checked)}
        />
        Disallow Join at End
      </label>
    </div>
  );
}

export function WallMoveSection({
  onMove,
}: {
  onMove: (dxMm: number, dyMm: number) => void;
}): JSX.Element {
  const dxRef = useRef<HTMLInputElement | null>(null);
  const dyRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="mt-3 border-t border-border pt-2 space-y-1">
      <div
        className="text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: '0.08em', opacity: 0.7 }}
      >
        Move (mm)
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted">
          {'\u0394'}x
          <input
            ref={dxRef}
            type="number"
            step={50}
            defaultValue={0}
            className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-wall-move-dx"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          {'\u0394'}y
          <input
            ref={dyRef}
            type="number"
            step={50}
            defaultValue={0}
            className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-wall-move-dy"
          />
        </label>
        <button
          type="button"
          className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
          data-testid="inspector-wall-move-apply"
          onClick={() => {
            const dx = Number(dxRef.current?.value ?? 0);
            const dy = Number(dyRef.current?.value ?? 0);
            if (dx === 0 && dy === 0) return;
            onMove(dx, dy);
            if (dxRef.current) dxRef.current.value = '0';
            if (dyRef.current) dyRef.current.value = '0';
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
