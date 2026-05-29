/**
 * Component-placement module state shared between the workspace OptionsBar
 * (writer / UI) and the 3D viewport tool dispatcher (reader).
 *
 * Previously these lived inside `workspace/authoring/OptionsBar.tsx`, which
 * forced `viewport/direct3dToolHelpers.ts` to import from workspace chrome —
 * violating `web-viewport-no-workspace-shell` ("3D rendering modules should
 * stay independent from workspace chrome").
 *
 * Both ends now depend on this neutral lib module: the OptionsBar React
 * component imports the setters to mutate state when the user picks an asset
 * or family type, and the viewport tool dispatcher imports the read-only
 * bindings at click-time. This preserves the existing module-singleton
 * semantics (and live `export let` bindings via re-export from OptionsBar
 * for backwards compatibility with the many plan-canvas readers) without
 * introducing a workspace dependency from the viewport layer.
 */
import type { Element } from '@bim-ai/core';

/**
 * Module-level selected asset ID for the component placement tool.
 * Read at click-time by the 2D plan canvas and the 3D viewport tool
 * dispatcher; written by OptionsBar when the user picks an asset.
 */
export let activeComponentAssetId: string | null = null;

/**
 * Currently-previewing asset library entry (used by the placement preview).
 * Kept in lock-step with `activeComponentAssetId`.
 */
export let activeComponentAssetPreviewEntry: Extract<
  Element,
  { kind: 'asset_library_entry' }
> | null = null;

export function setActiveComponentAssetId(v: string | null): void {
  activeComponentAssetId = v;
  if (!v || activeComponentAssetPreviewEntry?.id !== v) {
    activeComponentAssetPreviewEntry = null;
  }
}

export function setActiveComponentAssetPreviewEntry(
  entry: Extract<Element, { kind: 'asset_library_entry' }> | null,
): void {
  activeComponentAssetPreviewEntry = entry;
  if (entry) activeComponentAssetId = entry.id;
}

/**
 * Module-level selected family_type ID for loaded-family placement.
 * Shares the component placement tool with asset placement but emits
 * `placeFamilyInstance` instead of `PlaceAsset`.
 */
export let activeComponentFamilyTypeId: string | null = null;
export function setActiveComponentFamilyTypeId(v: string | null): void {
  activeComponentFamilyTypeId = v;
}

/**
 * Module-level pending rotation for the component placement tool.
 * Spacebar in the plan canvas / viewport increments this by 90° (mod 360).
 * Read at click-time and passed into the resulting PlaceAsset /
 * placeFamilyInstance command. Reset to 0 when the tool changes away from
 * `component`.
 */
export let pendingComponentRotationDeg = 0;
export function setPendingComponentRotationDeg(v: number): void {
  pendingComponentRotationDeg = v;
}
