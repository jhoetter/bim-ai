import { type JSX, useEffect, useState } from 'react';
import type { Element } from '@bim-ai/core';
import { useBimStore, type PlanTool } from '../../state/store';
import { applyCommand } from '../../lib/api';
import { WALL_LOCATION_LINE_ORDER, type WallLocationLine } from '../../tools/toolGrammar';

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
  const activeWallTypeId = useBimStore((s) => s.activeWallTypeId);
  const setActiveWallTypeId = useBimStore((s) => s.setActiveWallTypeId);
  const activeFloorTypeId = useBimStore((s) => s.activeFloorTypeId);
  const setActiveFloorTypeId = useBimStore((s) => s.setActiveFloorTypeId);
  const applyAreaRules = useBimStore((s) => s.applyAreaRules);
  const setApplyAreaRules = useBimStore((s) => s.setApplyAreaRules);
  const [showComputations, setShowComputations] = useState(false);
  const [, setComponentSelectionRevision] = useState(0);

  useEffect(() => {
    if (!showComputations) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowComputations(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showComputations]);

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

  if (planTool === 'floor') {
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
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
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
              setActiveComponentAssetId(e.target.value || null);
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

  return null;
}
