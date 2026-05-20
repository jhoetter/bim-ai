// @ts-nocheck
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import type { DisciplineTag, Element } from '@bim-ai/core';

import { computeFloorTypeThicknessMm } from '../../tools/floorTypeThickness';
import { topLayerIndex } from '../../viewport/hostMaterialLayerTargets';
import { FieldRow, fmtMm } from './inspectorRows';
import {
  FaceMaterialOverridesSection,
  MaterialAssignmentRow,
  faceMaterialOverrideLabel,
  type OpenMaterialBrowser,
  wallTypeExteriorMaterialKey,
} from './materialInspectorSections';
import { PhaseSection } from './phaseInspectorSection';
import { FloorNewTypeRow } from './floorTypeInspectorSections';
import { WallPartsPanel } from './wallPartsPanel';

const DEFAULT_GRAPHICS_OVERRIDE_COLOR = `#${'000000'}`;

type InspectorCommandHandler = (cmd: Record<string, unknown>) => void;
type InspectorSectionOptions = {
  elementsById?: Record<string, Element>;
  onPropertyChange?: (property: string, value: unknown) => void;
};
type WallFloorInspectorArgs = {
  el: Element;
  t: TFunction;
  options?: InspectorSectionOptions;
  elementsById?: Record<string, Element>;
  onDisciplineChange?: (discipline: DisciplineTag | null) => void;
  onEditType?: (typeId: string) => void;
  onOpenMaterialBrowser?: OpenMaterialBrowser;
  onOpenAppearanceAssetBrowser?: OpenMaterialBrowser;
  onEditCurtainGrid?: (wallId: string) => void;
  onDispatchCommand?: InspectorCommandHandler;
};
type MmPoint = { xMm: number; yMm: number };
type WallProfileInspectorElement = Extract<Element, { kind: 'wall' }> & {
  profilePoints?: MmPoint[];
  cutBy?: string[];
};
type FloorSlopePointDraft = MmPoint & {
  id: string;
  elevationOffsetMm: number;
};
type FloorInspectorElement = Extract<Element, { kind: 'floor' }> & {
  slopePoints?: FloorSlopePointDraft[];
  subFloorThicknessMm?: number;
  cutBy?: string[];
};

function InspectorDisciplineDropdown({
  value,
  onChange,
}: {
  value: DisciplineTag | null | undefined;
  onChange: (discipline: DisciplineTag | null) => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-muted w-28 shrink-0">Discipline</span>
      <select
        aria-label="Discipline"
        className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : (v as DisciplineTag));
        }}
      >
        <option value="">Default for kind</option>
        <option value="arch">Architecture</option>
        <option value="struct">Structure</option>
        <option value="mep">MEP</option>
      </select>
    </div>
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

export function WallInspectorSection(args: WallFloorInspectorArgs): JSX.Element {
  const {
    el,
    t,
    options,
    onDisciplineChange,
    onEditType,
    onOpenMaterialBrowser,
    onOpenAppearanceAssetBrowser,
    onEditCurtainGrid,
    onDispatchCommand,
  } = args;
  const onSemanticCommand = onDispatchCommand;
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

          {/* §3.5.5: wall profile editor — point list, SVG preview, add/remove/reset */}
          <details style={{ marginTop: 8 }}>
            <summary
              style={{ fontSize: 11, cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}
            >
              Profile Points ({((el as WallProfileInspectorElement).profilePoints ?? []).length})
            </summary>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Mini SVG preview */}
              {((el as WallProfileInspectorElement).profilePoints ?? []).length >= 3 && (
                <svg
                  data-testid="wall-profile-preview"
                  width={120}
                  height={60}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 3,
                    background: 'var(--color-foreground)',
                  }}
                >
                  {(() => {
                    const pts = (el as WallProfileInspectorElement).profilePoints ?? [];
                    const xs = pts.map((p) => p.xMm);
                    const ys = pts.map((p) => p.yMm);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    const scaleX = 110 / (maxX - minX || 1);
                    const scaleY = 50 / (maxY - minY || 1);
                    const pathD =
                      pts
                        .map(
                          (p, i) =>
                            `${i === 0 ? 'M' : 'L'} ${5 + (p.xMm - minX) * scaleX} ${55 - (p.yMm - minY) * scaleY}`,
                        )
                        .join(' ') + ' Z';
                    return (
                      <path
                        d={pathD}
                        stroke="var(--color-info)"
                        strokeWidth={1.5}
                        fill="color-mix(in srgb, var(--color-info) 10%, transparent)"
                      />
                    );
                  })()}
                </svg>
              )}
              {/* Point list */}
              {((el as WallProfileInspectorElement).profilePoints ?? []).map(
                (pt: MmPoint, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr 1fr',
                      gap: 4,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--color-muted-foreground)' }}>
                      {i + 1}
                    </span>
                    <input
                      data-testid={`wall-profile-pt-x-${i}`}
                      type="number"
                      value={pt.xMm}
                      onChange={(e) => {
                        const pts = [...((el as WallProfileInspectorElement).profilePoints ?? [])];
                        pts[i] = { ...pts[i], xMm: Number(e.target.value) };
                        onDispatchCommand?.({
                          type: 'updateWallProfile',
                          wallId: el.id,
                          profilePoints: pts,
                        });
                      }}
                      style={{
                        fontSize: 11,
                        padding: '1px 4px',
                        border: '1px solid var(--border)',
                        borderRadius: 2,
                        background: 'transparent',
                        color: 'inherit',
                      }}
                    />
                    <input
                      data-testid={`wall-profile-pt-y-${i}`}
                      type="number"
                      value={pt.yMm}
                      onChange={(e) => {
                        const pts = [...((el as WallProfileInspectorElement).profilePoints ?? [])];
                        pts[i] = { ...pts[i], yMm: Number(e.target.value) };
                        onDispatchCommand?.({
                          type: 'updateWallProfile',
                          wallId: el.id,
                          profilePoints: pts,
                        });
                      }}
                      style={{
                        fontSize: 11,
                        padding: '1px 4px',
                        border: '1px solid var(--border)',
                        borderRadius: 2,
                        background: 'transparent',
                        color: 'inherit',
                      }}
                    />
                  </div>
                ),
              )}
              {/* Buttons */}
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button
                  data-testid="wall-profile-add-point"
                  onClick={() => {
                    const pts = [...((el as WallProfileInspectorElement).profilePoints ?? [])];
                    pts.push({ xMm: 0, yMm: 0 });
                    onDispatchCommand?.({
                      type: 'updateWallProfile',
                      wallId: el.id,
                      profilePoints: pts,
                    });
                  }}
                  style={{ fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
                >
                  + Point
                </button>
                <button
                  data-testid="wall-profile-remove-last"
                  onClick={() => {
                    const pts = [
                      ...((el as WallProfileInspectorElement).profilePoints ?? []),
                    ].slice(0, -1);
                    onDispatchCommand?.({
                      type: 'updateWallProfile',
                      wallId: el.id,
                      profilePoints: pts.length >= 3 ? pts : null,
                    });
                  }}
                  style={{ fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
                >
                  - Last
                </button>
                <button
                  data-testid="wall-profile-reset"
                  onClick={() =>
                    onDispatchCommand?.({
                      type: 'updateWallProfile',
                      wallId: el.id,
                      profilePoints: null,
                    })
                  }
                  style={{ fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
                >
                  Reset
                </button>
              </div>
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
                  value={el.graphicsOverride?.fillColorHex ?? DEFAULT_GRAPHICS_OVERRIDE_COLOR}
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
                  value={el.graphicsOverride?.surfaceColorHex ?? DEFAULT_GRAPHICS_OVERRIDE_COLOR}
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
          {((el as WallProfileInspectorElement).cutBy?.length ?? 0) > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary
                data-testid="inspector-cut-by-summary"
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                Cut By ({(el as WallProfileInspectorElement).cutBy?.length ?? 0})
              </summary>
              <div style={{ marginTop: 4 }}>
                {((el as WallProfileInspectorElement).cutBy ?? []).map((cutterId, i) => (
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
                    <span
                      data-testid={`inspector-cut-by-id-${i}`}
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      {cutterId.slice(-8)}
                    </span>
                    <button
                      data-testid={`inspector-cut-by-remove-${i}`}
                      onClick={() =>
                        onSemanticCommand?.({ type: 'removeCutGeometry', cutterId, hostId: el.id })
                      }
                      style={{ color: 'var(--color-danger)', fontSize: 11 }}
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

    default:
      return null as unknown as JSX.Element;
  }
}

export function FloorInspectorSection(args: WallFloorInspectorArgs): JSX.Element {
  const {
    el,
    t,
    options,
    elementsById,
    onDisciplineChange,
    onEditType,
    onOpenMaterialBrowser,
    onOpenAppearanceAssetBrowser,
    onDispatchCommand,
  } = args;
  const onSemanticCommand = onDispatchCommand;
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
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
                  value={el.graphicsOverride?.fillColorHex ?? DEFAULT_GRAPHICS_OVERRIDE_COLOR}
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
                  value={el.graphicsOverride?.surfaceColorHex ?? DEFAULT_GRAPHICS_OVERRIDE_COLOR}
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
              Drainage Slope Points ({(el as FloorInspectorElement).slopePoints?.length ?? 0})
            </summary>
            <div style={{ marginTop: 6 }}>
              {((el as FloorInspectorElement).slopePoints ?? []).map((pt, idx) => (
                <div
                  key={pt.id}
                  style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}
                >
                  <span
                    style={{ fontSize: 11, color: 'var(--color-muted-foreground)', minWidth: 60 }}
                  >
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
                    style={{ color: 'var(--color-danger)', fontSize: 11 }}
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
              value={(el as FloorInspectorElement).subFloorThicknessMm ?? 0}
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
          {((el as FloorInspectorElement).cutBy?.length ?? 0) > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary
                data-testid="inspector-cut-by-summary"
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                Cut By ({(el as FloorInspectorElement).cutBy?.length ?? 0})
              </summary>
              <div style={{ marginTop: 4 }}>
                {((el as FloorInspectorElement).cutBy ?? []).map((cutterId, i) => (
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
                    <span
                      data-testid={`inspector-cut-by-id-${i}`}
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      {cutterId.slice(-8)}
                    </span>
                    <button
                      data-testid={`inspector-cut-by-remove-${i}`}
                      onClick={() =>
                        onSemanticCommand?.({ type: 'removeCutGeometry', cutterId, hostId: el.id })
                      }
                      style={{ color: 'var(--color-danger)', fontSize: 11 }}
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

    default:
      return null as unknown as JSX.Element;
  }
}
