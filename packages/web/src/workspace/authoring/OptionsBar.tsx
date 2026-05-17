import { type JSX, useEffect, useState } from 'react';
import type { Element } from '@bim-ai/core';
import { useBimStore, type PlanTool } from '../../state/store';
import { applyCommand } from '../../lib/api';
import { WALL_LOCATION_LINE_ORDER, type WallLocationLine } from '../../tools/toolGrammar';
import { columnPositionsAtGridIntersections } from '../../plan/columnAtGrids';

const LOCATION_LINE_LABELS: Record<WallLocationLine, string> = {
  'wall-centerline': 'Wall Centerline',
  'finish-face-exterior': 'Finish Face: Exterior',
  'finish-face-interior': 'Finish Face: Interior',
  'core-centerline': 'Core Centerline',
  'core-face-exterior': 'Core Face: Exterior',
  'core-face-interior': 'Core Face: Interior',
};

const BAR_CLASS = 'flex items-center gap-4 border-b border-border bg-surface py-1 px-3 text-xs';

/**
 * Module-level flag for the mirror tool "Copy" option.
 * Exported so PlanCanvas can read it without a Zustand store change.
 * Defaults to true (keep original + add mirrored copy).
 */
export let mirrorCopyEnabled = true;

/**
 * Module-level flag for the copy tool "Multiple copies" option (F-116).
 * When true (default) the tool stays active after each copy for multi-copy mode.
 * When false a single copy is placed and the tool returns to select.
 * Exported so PlanCanvas can read it at click-time.
 */
export let copyMultipleEnabled = true;

/**
 * Module-level selected asset ID for the component placement tool.
 * Exported so PlanCanvas can read it on click without a Zustand store change.
 */
export let activeComponentAssetId: string | null = null;
export function setActiveComponentAssetId(v: string | null): void {
  activeComponentAssetId = v;
  if (!v || activeComponentAssetPreviewEntry?.id !== v) {
    activeComponentAssetPreviewEntry = null;
  }
}

export let activeComponentAssetPreviewEntry: Extract<
  Element,
  { kind: 'asset_library_entry' }
> | null = null;
export function setActiveComponentAssetPreviewEntry(
  entry: Extract<Element, { kind: 'asset_library_entry' }> | null,
): void {
  activeComponentAssetPreviewEntry = entry;
  if (entry) activeComponentAssetId = entry.id;
}

/**
 * Module-level selected family_type ID for loaded-family placement.
 * This shares the component placement tool with asset placement but emits
 * `placeFamilyInstance` instead of `PlaceAsset`.
 */
export let activeComponentFamilyTypeId: string | null = null;
export function setActiveComponentFamilyTypeId(v: string | null): void {
  activeComponentFamilyTypeId = v;
}

/**
 * Module-level pending rotation for the component placement tool.
 * Spacebar in PlanCanvas increments this by 90° (mod 360).
 * Read at click-time by PlanCanvas and passed to PlaceAsset.
 * Reset to 0 when the tool changes away from 'component'.
 */
export let pendingComponentRotationDeg = 0;
export function setPendingComponentRotationDeg(v: number): void {
  pendingComponentRotationDeg = v;
}

export let dispatchColumnAtGridsSelectAll: ((gridIds: string[]) => void) | null = null;
export function setDispatchColumnAtGridsSelectAll(fn: ((gridIds: string[]) => void) | null): void {
  dispatchColumnAtGridsSelectAll = fn;
}

/** §9.1.1 — column usage for the next placed column. Read at click-time by PlanCanvas. */
// eslint-disable-next-line prefer-const
export let columnDrawUsage: 'architectural' | 'structural' = 'architectural';

/** §3.3.7 — Linework override options. Read at click-time by PlanCanvas. */
// eslint-disable-next-line prefer-const, bim-ai/no-hex-in-chrome
export let lineworkColorHex = '#ff0000';
// eslint-disable-next-line prefer-const
export let lineworkLineWeightPx: number = 1;
// eslint-disable-next-line prefer-const
export let lineworkStyle: 'solid' | 'dashed' | 'hidden' = 'solid';
export function getLineworkLineDash(): number[] | undefined {
  if (lineworkStyle === 'dashed') return [4, 4];
  if (lineworkStyle === 'hidden') return [2, 6];
  return undefined;
}

function BeamSystemJustificationSelect(): JSX.Element {
  const [justification, setJustification] = useState<'beginning' | 'center' | 'end'>('center');
  return (
    <select
      value={justification}
      onChange={(e) => setJustification(e.target.value as 'beginning' | 'center' | 'end')}
      className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
      aria-label="Beam justification"
      data-testid="options-bar-beam-justification"
    >
      <option value="beginning">Beginning</option>
      <option value="center">Center</option>
      <option value="end">End</option>
    </select>
  );
}

export function OptionsBar({
  activeTool,
}: {
  activeTool?: PlanTool | null;
} = {}): JSX.Element | null {
  const storePlanTool = useBimStore((s) => s.planTool);
  const planTool = activeTool ?? storePlanTool;
  const elementsById = useBimStore((s) => s.elementsById);
  const wallLocationLine = useBimStore((s) => s.wallLocationLine);
  const setWallLocationLine = useBimStore((s) => s.setWallLocationLine);
  const floorBoundaryOffsetMm = useBimStore((s) => s.floorBoundaryOffsetMm);
  const setFloorBoundaryOffsetMm = useBimStore((s) => s.setFloorBoundaryOffsetMm);
  const wallDrawOffsetMm = useBimStore((s) => s.wallDrawOffsetMm);
  const setWallDrawOffsetMm = useBimStore((s) => s.setWallDrawOffsetMm);
  const wallDrawRadiusMm = useBimStore((s) => s.wallDrawRadiusMm);
  const setWallDrawRadiusMm = useBimStore((s) => s.setWallDrawRadiusMm);
  const wallDrawHeightMm = useBimStore((s) => s.wallDrawHeightMm);
  const setWallDrawHeightMm = useBimStore((s) => s.setWallDrawHeightMm);
  const beamSystemSpacingMm = useBimStore((s) => s.beamSystemSpacingMm);
  const setBeamSystemSpacingMm = useBimStore((s) => s.setBeamSystemSpacingMm);
  const beamSystemDirectionDeg = useBimStore((s) => s.beamSystemDirectionDeg);
  const setBeamSystemDirectionDeg = useBimStore((s) => s.setBeamSystemDirectionDeg);
  const activeWallTypeId = useBimStore((s) => s.activeWallTypeId);
  const setActiveWallTypeId = useBimStore((s) => s.setActiveWallTypeId);
  const activeFloorTypeId = useBimStore((s) => s.activeFloorTypeId);
  const setActiveFloorTypeId = useBimStore((s) => s.setActiveFloorTypeId);
  const floorDrawOffsetMm = useBimStore((s) => s.floorDrawOffsetMm);
  const setFloorDrawOffsetMm = useBimStore((s) => s.setFloorDrawOffsetMm);
  const columnDrawHeightMm = useBimStore((s) => s.columnDrawHeightMm);
  const setColumnDrawHeightMm = useBimStore((s) => s.setColumnDrawHeightMm);
  const columnDrawWidthMm = useBimStore((s) => s.columnDrawWidthMm);
  const setColumnDrawWidthMm = useBimStore((s) => s.setColumnDrawWidthMm);
  const columnDrawDepthMm = useBimStore((s) => s.columnDrawDepthMm);
  const setColumnDrawDepthMm = useBimStore((s) => s.setColumnDrawDepthMm);
  const stairDrawBaseLevelId = useBimStore((s) => s.stairDrawBaseLevelId);
  const setStairDrawBaseLevelId = useBimStore((s) => s.setStairDrawBaseLevelId);
  const stairDrawTopLevelId = useBimStore((s) => s.stairDrawTopLevelId);
  const setStairDrawTopLevelId = useBimStore((s) => s.setStairDrawTopLevelId);
  const stairDrawWidthMm = useBimStore((s) => s.stairDrawWidthMm);
  const setStairDrawWidthMm = useBimStore((s) => s.setStairDrawWidthMm);
  const stairDrawRunWidthMm = useBimStore((s) => s.stairDrawRunWidthMm);
  const setStairDrawRunWidthMm = useBimStore((s) => s.setStairDrawRunWidthMm);
  const roomDrawName = useBimStore((s) => s.roomDrawName);
  const setRoomDrawName = useBimStore((s) => s.setRoomDrawName);
  const roomDrawNumber = useBimStore((s) => s.roomDrawNumber);
  const setRoomDrawNumber = useBimStore((s) => s.setRoomDrawNumber);
  const roomDrawUpperLevelId = useBimStore((s) => s.roomDrawUpperLevelId);
  const setRoomDrawUpperLevelId = useBimStore((s) => s.setRoomDrawUpperLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const columnAtGridsSelectedIds = useBimStore((s) => s.columnAtGridsSelectedIds);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const applyAreaRules = useBimStore((s) => s.applyAreaRules);
  const setApplyAreaRules = useBimStore((s) => s.setApplyAreaRules);
  const activePaintMaterialId = useBimStore((s) => s.activePaintMaterialId);
  const setActivePaintMaterialId = useBimStore((s) => s.setActivePaintMaterialId);
  const [showComputations, setShowComputations] = useState(false);
  const [, setComponentSelectionRevision] = useState(0);
  const [localColumnUsage, setLocalColumnUsage] = useState<'architectural' | 'structural'>(
    columnDrawUsage,
  );

  useEffect(() => {
    if (!showComputations) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowComputations(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showComputations]);

  useEffect(() => {
    if (planTool !== 'component' || !activeComponentAssetId) return;
    const asset = elementsById[activeComponentAssetId];
    if (asset?.kind === 'asset_library_entry') {
      setActiveComponentAssetPreviewEntry(asset);
    }
  }, [elementsById, planTool]);

  if (planTool === 'wall') {
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Type:</span>
          <select
            value={activeWallTypeId ?? ''}
            onChange={(e) => setActiveWallTypeId(e.target.value || null)}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Wall type"
            data-testid="options-bar-wall-type"
          >
            <option value="">(Default)</option>
            {Object.values(elementsById)
              .filter((e): e is Extract<Element, { kind: 'wall_type' }> => e.kind === 'wall_type')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <span className="text-muted">Location Line:</span>
        <select
          value={wallLocationLine}
          onChange={(e) => setWallLocationLine(e.target.value as WallLocationLine)}
          className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
          aria-label="Wall location line"
        >
          {WALL_LOCATION_LINE_ORDER.map((loc) => (
            <option key={loc} value={loc}>
              {LOCATION_LINE_LABELS[loc]}
            </option>
          ))}
        </select>
        <span className="text-muted opacity-60">Tab to cycle</span>
        <label className="flex items-center gap-2">
          <span className="text-muted">Offset:</span>
          <input
            type="number"
            value={wallDrawOffsetMm}
            step={50}
            onChange={(e) => setWallDrawOffsetMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Wall baseline offset in mm"
            data-testid="options-bar-wall-offset"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Height:</span>
          <input
            type="number"
            value={wallDrawHeightMm}
            step={100}
            min={100}
            onChange={(e) => setWallDrawHeightMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Wall height in mm"
            data-testid="options-bar-wall-height"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={wallDrawRadiusMm !== null}
            onChange={(e) => setWallDrawRadiusMm(e.target.checked ? 500 : null)}
            aria-label="Enable wall corner radius"
            data-testid="options-bar-wall-radius-toggle"
          />
          <span className="text-muted">Radius:</span>
          <input
            type="number"
            value={wallDrawRadiusMm ?? 500}
            step={100}
            min={0}
            disabled={wallDrawRadiusMm === null}
            onChange={(e) => setWallDrawRadiusMm(Math.max(0, Number(e.target.value)))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground disabled:opacity-45"
            aria-label="Wall corner radius in mm"
            data-testid="options-bar-wall-radius"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
      </div>
    );
  }

  if (planTool === 'floor' || planTool === 'floor-sketch') {
    const floorLevels = Object.values(elementsById)
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Type:</span>
          <select
            value={activeFloorTypeId ?? ''}
            onChange={(e) => setActiveFloorTypeId(e.target.value || null)}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Floor type"
            data-testid="options-bar-floor-type"
          >
            <option value="">(Default)</option>
            {Object.values(elementsById)
              .filter((e): e is Extract<Element, { kind: 'floor_type' }> => e.kind === 'floor_type')
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Level:</span>
          <select
            value={activeLevelId ?? ''}
            onChange={(e) => setActiveLevelId(e.target.value || undefined)}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Floor level"
            data-testid="options-bar-floor-level"
          >
            {floorLevels.map((lv) => (
              <option key={lv.id} value={lv.id}>
                {lv.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Offset:</span>
          <input
            type="number"
            value={floorDrawOffsetMm}
            step={50}
            onChange={(e) => setFloorDrawOffsetMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Floor vertical offset in mm"
            data-testid="options-bar-floor-offset"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Boundary Offset:</span>
          <input
            type="number"
            value={floorBoundaryOffsetMm}
            onChange={(e) => setFloorBoundaryOffsetMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Floor boundary offset in mm"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
      </div>
    );
  }

  if (planTool === 'column') {
    const columnLevels = Object.values(elementsById)
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Level:</span>
          <select
            value={activeLevelId ?? ''}
            onChange={(e) => setActiveLevelId(e.target.value || undefined)}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Column level"
            data-testid="options-bar-column-level"
          >
            {columnLevels.map((lv) => (
              <option key={lv.id} value={lv.id}>
                {lv.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Height:</span>
          <input
            type="number"
            value={columnDrawHeightMm}
            step={100}
            min={100}
            onChange={(e) => setColumnDrawHeightMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Column height in mm"
            data-testid="options-bar-column-height"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Width:</span>
          <input
            type="number"
            value={columnDrawWidthMm}
            step={50}
            min={50}
            onChange={(e) => setColumnDrawWidthMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Column width in mm"
            data-testid="options-bar-column-width"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Depth:</span>
          <input
            type="number"
            value={columnDrawDepthMm}
            step={50}
            min={50}
            onChange={(e) => setColumnDrawDepthMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Column depth in mm"
            data-testid="options-bar-column-depth"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Usage</span>
          <select
            data-testid="options-column-usage"
            className="text-xs bg-surface border border-border rounded px-1 py-0.5"
            value={localColumnUsage}
            onChange={(e) => {
              const v = e.target.value as 'architectural' | 'structural';
              columnDrawUsage = v;
              setLocalColumnUsage(v);
            }}
          >
            <option value="architectural">Architectural</option>
            <option value="structural">Structural</option>
          </select>
        </div>
      </div>
    );
  }

  if (planTool === 'stair') {
    const stairLevels = Object.values(elementsById)
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const baseLvlId = stairDrawBaseLevelId ?? activeLevelId;
    const baseLvlIndex = stairLevels.findIndex((lv) => lv.id === baseLvlId);
    const defaultTopLvl = stairLevels[baseLvlIndex + 1];
    const topLvlId = stairDrawTopLevelId ?? defaultTopLvl?.id ?? '';
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Base Level:</span>
          <select
            value={baseLvlId ?? ''}
            onChange={(e) => setStairDrawBaseLevelId(e.target.value || null)}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Stair base level"
            data-testid="options-bar-stair-base-level"
          >
            {stairLevels.map((lv) => (
              <option key={lv.id} value={lv.id}>
                {lv.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Top Level:</span>
          <select
            value={topLvlId}
            onChange={(e) => setStairDrawTopLevelId(e.target.value || null)}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Stair top level"
            data-testid="options-bar-stair-top-level"
          >
            {stairLevels.map((lv) => (
              <option key={lv.id} value={lv.id}>
                {lv.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Width:</span>
          <input
            type="number"
            value={stairDrawWidthMm}
            step={100}
            min={600}
            onChange={(e) => setStairDrawWidthMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Stair width in mm"
            data-testid="options-bar-stair-width"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Run Width:</span>
          <input
            type="number"
            value={stairDrawRunWidthMm}
            step={10}
            min={100}
            onChange={(e) => setStairDrawRunWidthMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Stair run width in mm"
            data-testid="options-bar-stair-run-width"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
      </div>
    );
  }

  if (planTool === 'room') {
    const roomLevels = Object.values(elementsById)
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const activeLvlIndex = roomLevels.findIndex((lv) => lv.id === activeLevelId);
    const defaultUpperLvl = roomLevels[activeLvlIndex + 1];
    const upperLvlId = roomDrawUpperLevelId ?? defaultUpperLvl?.id ?? '';
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Name:</span>
          <input
            type="text"
            value={roomDrawName}
            onChange={(e) => setRoomDrawName(e.target.value)}
            className="w-28 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Room name"
            data-testid="options-bar-room-name"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Number:</span>
          <input
            type="text"
            value={roomDrawNumber}
            onChange={(e) => setRoomDrawNumber(e.target.value)}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Room number"
            data-testid="options-bar-room-number"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Upper Limit:</span>
          <select
            value={upperLvlId}
            onChange={(e) => setRoomDrawUpperLevelId(e.target.value || null)}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Room upper limit level"
            data-testid="options-bar-room-upper-level"
          >
            {roomLevels.map((lv) => (
              <option key={lv.id} value={lv.id}>
                {lv.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (planTool === 'area-boundary') {
    const projectSettings = Object.values(elementsById).find(
      (e): e is Extract<Element, { kind: 'project_settings' }> => e.kind === 'project_settings',
    );

    const dispatchProjectSettingProperty = async (key: string, value: string): Promise<void> => {
      if (!projectSettings) return;
      const { modelId, userId, hydrateFromSnapshot } = useBimStore.getState();
      if (!modelId) return;
      const r = await applyCommand(
        modelId,
        { type: 'updateElementProperty', elementId: projectSettings.id, key, value },
        { userId },
      );
      if (r.revision !== undefined) {
        hydrateFromSnapshot({
          modelId,
          revision: r.revision,
          elements: r.elements ?? {},
          violations: [],
        });
      }
    };

    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-1 text-[11px]">
          <input
            type="checkbox"
            checked={applyAreaRules}
            onChange={(e) => setApplyAreaRules(e.target.checked)}
            aria-label="Apply area rules"
            data-testid="options-bar-apply-area-rules"
          />
          <span>Apply Area Rules</span>
        </label>
        <div className="relative">
          <button
            type="button"
            data-testid="options-bar-area-computations"
            aria-expanded={showComputations}
            aria-haspopup="dialog"
            onClick={() => setShowComputations((v) => !v)}
            className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] hover:bg-surface-strong"
          >
            ⚙ Computations…
          </button>
          {showComputations && projectSettings && (
            <div
              role="dialog"
              aria-label="Area computation settings"
              className="absolute top-full left-0 z-50 mt-1 flex flex-col gap-2 rounded border border-border bg-surface p-2 shadow-md"
              data-testid="area-computations-dialog"
            >
              <label className="flex flex-col gap-0.5 text-[11px]">
                <span className="text-muted">Volume Computed At</span>
                <select
                  className="rounded border border-border bg-surface px-1 py-0.5 text-[11px]"
                  value={projectSettings.volumeComputedAt ?? 'finish_faces'}
                  data-testid="area-computations-volume"
                  onChange={(e) =>
                    void dispatchProjectSettingProperty('volumeComputedAt', e.target.value)
                  }
                >
                  <option value="finish_faces">Finish Faces</option>
                  <option value="core_faces">Core Faces</option>
                </select>
              </label>
              <label className="flex flex-col gap-0.5 text-[11px]">
                <span className="text-muted">Room Area Computation</span>
                <select
                  className="rounded border border-border bg-surface px-1 py-0.5 text-[11px]"
                  value={projectSettings.roomAreaComputationBasis ?? 'wall_finish'}
                  data-testid="area-computations-basis"
                  onChange={(e) =>
                    void dispatchProjectSettingProperty('roomAreaComputationBasis', e.target.value)
                  }
                >
                  <option value="wall_finish">At Wall Finish</option>
                  <option value="wall_centerline">At Wall Centerline</option>
                  <option value="wall_core_layer">At Wall Core Layer</option>
                  <option value="wall_core_center">At Wall Core Center</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (planTool === 'mirror') {
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-1 text-[11px]">
          <input
            type="checkbox"
            defaultChecked={mirrorCopyEnabled}
            onChange={(e) => {
              mirrorCopyEnabled = e.target.checked;
            }}
            aria-label="Copy (keep original)"
            data-testid="options-bar-mirror-copy"
          />
          <span>Copy</span>
        </label>
        <span className="text-muted opacity-60">
          Click to set axis start, click again to mirror
        </span>
      </div>
    );
  }

  if (planTool === 'copy') {
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-1 text-[11px]">
          <input
            type="checkbox"
            defaultChecked={copyMultipleEnabled}
            onChange={(e) => {
              copyMultipleEnabled = e.target.checked;
            }}
            aria-label="Multiple copies"
            data-testid="options-bar-copy-multiple"
          />
          <span>Multiple</span>
        </label>
        <span className="text-muted opacity-60">
          Click reference point, click destination to place copy
        </span>
      </div>
    );
  }

  if (planTool === 'move') {
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <span className="text-muted opacity-60">
          Click reference point, click destination to move selection
        </span>
      </div>
    );
  }

  if (planTool === 'component') {
    const assetLibraryEntries = Object.values(elementsById).filter(
      (e): e is Extract<Element, { kind: 'asset_library_entry' }> =>
        e.kind === 'asset_library_entry',
    );
    const componentFamilyTypes = Object.values(elementsById)
      .filter(
        (e): e is Extract<Element, { kind: 'family_type' }> =>
          e.kind === 'family_type' && e.discipline === 'generic',
      )
      .sort((a, b) =>
        String(a.parameters.name ?? a.name).localeCompare(String(b.parameters.name ?? b.name)),
      );
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Asset:</span>
          <select
            data-testid="options-bar-component-asset"
            value={activeComponentAssetId ?? ''}
            onChange={(e) => {
              const nextAssetId = e.target.value || null;
              const nextAsset = nextAssetId ? elementsById[nextAssetId] : null;
              if (nextAsset?.kind === 'asset_library_entry') {
                setActiveComponentAssetPreviewEntry(nextAsset);
              } else {
                setActiveComponentAssetId(nextAssetId);
              }
              setActiveComponentFamilyTypeId(null);
              setComponentSelectionRevision((revision) => revision + 1);
            }}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Component asset"
          >
            <option value="">— select asset —</option>
            {assetLibraryEntries.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Type:</span>
          <select
            data-testid="options-bar-component-family-type"
            value={activeComponentFamilyTypeId ?? ''}
            onChange={(e) => {
              setActiveComponentFamilyTypeId(e.target.value || null);
              setActiveComponentAssetId(null);
              setComponentSelectionRevision((revision) => revision + 1);
            }}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Component family type"
          >
            <option value="">— select family type —</option>
            {componentFamilyTypes.map((familyType) => (
              <option key={familyType.id} value={familyType.id}>
                {String(familyType.parameters.name ?? familyType.name)}
              </option>
            ))}
          </select>
        </label>
        <span className="text-muted opacity-60">Click to place · Spacebar to rotate 90°</span>
      </div>
    );
  }

  if (planTool === 'beam-system') {
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Spacing:</span>
          <input
            type="number"
            value={beamSystemSpacingMm}
            min={100}
            step={100}
            onChange={(e) => setBeamSystemSpacingMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Beam spacing in mm"
            data-testid="options-bar-beam-spacing"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Direction:</span>
          <input
            type="number"
            value={beamSystemDirectionDeg}
            min={0}
            max={359}
            step={1}
            onChange={(e) => setBeamSystemDirectionDeg(Number(e.target.value))}
            className="w-16 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Beam direction in degrees"
            data-testid="options-bar-beam-direction"
          />
          <span className="text-muted opacity-60">°</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Justification:</span>
          <BeamSystemJustificationSelect />
        </label>
      </div>
    );
  }

  if (planTool === 'column-at-grids') {
    const levels = Object.values(elementsById)
      .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);

    const columnTypes = Object.values(elementsById)
      .filter(
        (e): e is Extract<Element, { kind: 'column_type' }> =>
          (e as { kind: string }).kind === 'column_type',
      )
      .sort((a, b) => (a as { name: string }).name.localeCompare((b as { name: string }).name));

    const selectedGridElems = columnAtGridsSelectedIds
      .map((id) => elementsById[id])
      .filter((e): e is Extract<Element, { kind: 'grid_line' }> => e?.kind === 'grid_line');
    const intersectionCount = columnPositionsAtGridIntersections(selectedGridElems).length;

    const allGridIds = Object.values(elementsById)
      .filter((e) => e.kind === 'grid_line')
      .map((e) => e.id);

    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Column Type:</span>
          <select
            data-testid="options-column-at-grids-type"
            defaultValue=""
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Column type"
            onChange={() => undefined}
          >
            <option value="">(Default)</option>
            {columnTypes.map((ct) => (
              <option key={(ct as { id: string }).id} value={(ct as { id: string }).id}>
                {(ct as { name: string }).name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Level:</span>
          <select
            data-testid="options-column-at-grids-level"
            value={activeLevelId ?? ''}
            onChange={(e) => setActiveLevelId(e.target.value || undefined)}
            className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Column level"
          >
            <option value="">(Active Level)</option>
            {levels.map((lv) => (
              <option key={lv.id} value={lv.id}>
                {lv.name}
              </option>
            ))}
          </select>
        </label>
        <span
          data-testid="options-column-at-grids-count"
          className="text-muted opacity-70"
          aria-label="Column placement count"
        >
          {intersectionCount} intersections selected
        </span>
        <button
          type="button"
          data-testid="options-bar-cat-select-all"
          onClick={() => dispatchColumnAtGridsSelectAll?.(allGridIds)}
          className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
          aria-label="Select all grids"
        >
          Select All
        </button>
      </div>
    );
  }

  if (planTool === 'paint') {
    const materials = Object.values(elementsById)
      .filter((e): e is Extract<Element, { kind: 'material' }> => e?.kind === 'material')
      .sort((a, b) => a.name.localeCompare(b.name));
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Material:</span>
          <select
            value={activePaintMaterialId ?? ''}
            onChange={(e) => setActivePaintMaterialId(e.target.value || null)}
            data-testid="options-bar-paint-material"
          >
            <option value="">— None —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          data-testid="options-bar-paint-remove"
          onClick={() => setActivePaintMaterialId(null)}
        >
          Remove Override
        </button>
      </div>
    );
  }

  if (planTool === 'linework') {
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Color:</span>
          <input
            type="color"
            defaultValue={lineworkColorHex}
            data-testid="options-linework-color"
            onChange={(e) => {
              lineworkColorHex = e.target.value;
            }}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Weight:</span>
          <select
            defaultValue={String(lineworkLineWeightPx)}
            data-testid="options-linework-weight"
            onChange={(e) => {
              lineworkLineWeightPx = Number(e.target.value);
            }}
          >
            <option value="0.5">0.5</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Style:</span>
          <select
            defaultValue={lineworkStyle}
            data-testid="options-linework-style"
            onChange={(e) => {
              lineworkStyle = e.target.value as 'solid' | 'dashed' | 'hidden';
            }}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
      </div>
    );
  }

  return null;
}
