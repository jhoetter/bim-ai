import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import {
  getBuiltInWallType,
  resolveWallAssemblyExposedLayers,
} from '../../families/wallTypeCatalog';
import { topLayerIndex, wallTypeExteriorLayerIndex } from '../../viewport/hostMaterialLayerTargets';
import { resolveMaterial } from '../../viewport/materials';

export type MaterialBrowserTargetRequest = {
  kind: 'material-slot';
  elementId: string;
  slot: string;
  label: string;
  currentKey?: string | null;
};

export type OpenMaterialBrowser = (target?: MaterialBrowserTargetRequest) => void;

export function materialLabel(
  materialKey: string | null | undefined,
  fallback: string,
  elementsById?: Record<string, Element>,
): string {
  if (!materialKey) return fallback;
  return resolveMaterial(materialKey, elementsById)?.displayName ?? materialKey;
}

export function faceMaterialOverrideLabel(
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

export function FaceMaterialOverridesSection({
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

export function MaterialAssignmentRow({
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

export function GenericMaterialAssignmentFor({
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

export function MaterialSlotsSection({
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

export function wallTypeExteriorMaterialKey(
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

export function roofTypeTopMaterialKey(
  roof: Extract<Element, { kind: 'roof' }>,
  elementsById: Record<string, Element>,
): string | null {
  if (!roof.roofTypeId) return null;
  const type = elementsById[roof.roofTypeId];
  return type?.kind === 'roof_type'
    ? (type.layers[topLayerIndex(type)]?.materialKey ?? null)
    : null;
}
