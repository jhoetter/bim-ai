/**
 * Default command-palette runtime wrappers.
 *
 * cmdPalette/ files are metadata-only — they own the registry of palette
 * entries, their labels/keywords/categories/capability metadata, and the
 * declarative shape of `PaletteContext`. They MUST NOT reach into the
 * Zustand store directly (enforced by the `web-cmd-palette-no-state-import`
 * architecture rule).
 *
 * Every store read / write that a palette command needs to perform lives
 * in this file. cmdPalette command bodies call these wrappers (preferring
 * the typed `PaletteContext` callbacks when present, falling back to the
 * runtime wrappers as a legacy bridge for shell-mounted palettes that
 * don't thread every action through context).
 */
import type { Element } from '@bim-ai/core';

import { useBimStore, type PlanTool } from '../../state/store';
import { VIEWER_CATEGORY_KEYS } from '../../viewport/sceneUtils';
import { isPhysicalHostedOpeningWall } from '../../viewport/directAuthoringGuards';
import {
  buildBoundaryWallPlan,
  type BoundaryWallSource,
} from '../../geometry/boundaryWallGeneration';
import { roofParamsFromWallLoop } from '../../plan/roofByFootprint';
import { autoTagElements } from '../../plan/autoTags';

// ---------------------------------------------------------------------------
// Tool / mode / lens setters
// ---------------------------------------------------------------------------

export function runtimeStartPlanTool(toolId: string): void {
  useBimStore.getState().setPlanTool(toolId as PlanTool);
}

export function runtimeSetViewerMode(mode: 'plan_canvas' | 'orbit_3d'): void {
  useBimStore.getState().setViewerMode(mode);
}

export function runtimeSetLensMode(
  lens: Parameters<ReturnType<typeof useBimStore.getState>['setLensMode']>[0],
): void {
  useBimStore.getState().setLensMode(lens);
}

export function runtimeSetPerspectiveId(
  id: Parameters<ReturnType<typeof useBimStore.getState>['setPerspectiveId']>[0],
): void {
  useBimStore.getState().setPerspectiveId(id);
}

// ---------------------------------------------------------------------------
// 3D viewer setters
// ---------------------------------------------------------------------------

export function runtimeSetAll3dCategoriesHidden(hidden: boolean): void {
  const state = useBimStore.getState();
  const viewerCategoryHidden = { ...state.viewerCategoryHidden };
  for (const key of VIEWER_CATEGORY_KEYS) viewerCategoryHidden[key] = hidden;
  useBimStore.setState({ viewerCategoryHidden });
}

export function runtimeSetViewerRenderStyle(
  style: Parameters<ReturnType<typeof useBimStore.getState>['setViewerRenderStyle']>[0],
): void {
  useBimStore.getState().setViewerRenderStyle(style);
}

export function runtimeRequestViewerCameraAction(
  action: Parameters<ReturnType<typeof useBimStore.getState>['requestViewerCameraAction']>[0],
): void {
  useBimStore.getState().requestViewerCameraAction(action);
}

export function runtimeSetViewerProjection(
  projection: Parameters<ReturnType<typeof useBimStore.getState>['setViewerProjection']>[0],
): void {
  useBimStore.getState().setViewerProjection(projection);
}

export function runtimeToggleViewerWalkMode(): void {
  const state = useBimStore.getState();
  state.setViewerWalkModeActive(!state.viewerWalkModeActive);
}

export function runtimeToggleViewerSectionBox(): void {
  const state = useBimStore.getState();
  state.setViewerSectionBoxActive(!state.viewerSectionBoxActive);
}

export function runtimeSetRevealHiddenMode(value: boolean): void {
  useBimStore.getState().setRevealHiddenMode(value);
}

export function runtimeToggleNeighborhoodMasses(): void {
  useBimStore.getState().toggleNeighborhoodMasses();
}

export function runtimeToggleSelectLinked(): void {
  const { selectLinkedEnabled, setSelectLinkedEnabled } = useBimStore.getState();
  setSelectLinkedEnabled(!selectLinkedEnabled);
}

// ---------------------------------------------------------------------------
// Selection / element queries
// ---------------------------------------------------------------------------

export function runtimeModelHasWall(): boolean {
  return Object.values(useBimStore.getState().elementsById).some(
    (el) => el?.kind === 'wall' && isPhysicalHostedOpeningWall(el),
  );
}

export function runtimeSelectedWall(
  selectedElementIds: readonly string[],
): Extract<Element, { kind: 'wall' }> | null {
  const id = selectedElementIds[0];
  if (!id) return null;
  const el = useBimStore.getState().elementsById[id];
  return el?.kind === 'wall' && isPhysicalHostedOpeningWall(el) ? el : null;
}

export function runtimeSelectedBoundarySource(
  selectedElementIds: readonly string[],
): BoundaryWallSource | null {
  const id = selectedElementIds[0];
  if (!id) return null;
  const el = useBimStore.getState().elementsById[id];
  return el?.kind === 'floor' || el?.kind === 'room' ? el : null;
}

const SOLID_JOIN_KINDS = new Set(['wall', 'floor', 'roof', 'ceiling', 'column', 'beam']);

export function runtimeHasTwoSolidSelection(selectedElementIds: readonly string[]): boolean {
  if (selectedElementIds.length !== 2) return false;
  const elems = useBimStore.getState().elementsById;
  return selectedElementIds.every((id) => {
    const el = elems[id];
    return el != null && SOLID_JOIN_KINDS.has(el.kind);
  });
}

export function runtimeSelectionAnyKindIs(
  selectedElementIds: readonly string[],
  kind: string,
): boolean {
  const elems = useBimStore.getState().elementsById;
  return selectedElementIds.some((id) => elems[id]?.kind === kind);
}

export function runtimeSelectedKindIs(
  selectedElementIds: readonly string[],
  kind: string,
): boolean {
  const id = selectedElementIds[0];
  if (!id) return false;
  return useBimStore.getState().elementsById[id]?.kind === kind;
}

export function runtimeFindSelectedIdOfKind(
  selectedElementIds: readonly string[],
  kind: string,
): string | undefined {
  const elems = useBimStore.getState().elementsById;
  return selectedElementIds.find((id) => elems[id]?.kind === kind);
}

const FAMILY_LIBRARY_KINDS = new Set(['wall_type', 'floor_type', 'roof_type', 'family_definition']);

export function runtimeFamilyLibrarySelectionAvailable(
  selectedElementIds: readonly string[],
): boolean {
  const elems = useBimStore.getState().elementsById;
  return selectedElementIds.some((id) => FAMILY_LIBRARY_KINDS.has(elems[id]?.kind ?? ''));
}

export function runtimeFindFamilyLibrarySelection(
  selectedElementIds: readonly string[],
): string | undefined {
  const elems = useBimStore.getState().elementsById;
  return selectedElementIds.find((id) => FAMILY_LIBRARY_KINDS.has(elems[id]?.kind ?? ''));
}

export function runtimeSelectedGroupDefinitionAvailable(
  selectedElementIds: readonly string[],
): boolean {
  const first = selectedElementIds[0];
  if (!first) return false;
  return useBimStore.getState().elementsById[first]?.kind === 'group_definition';
}

// ---------------------------------------------------------------------------
// Selection mutations
// ---------------------------------------------------------------------------

export function runtimeSelectAllInstancesOfKind(seedElementId: string): void {
  const elems = useBimStore.getState().elementsById;
  const target = elems[seedElementId];
  if (!target) return;
  const sameKind = Object.values(elems)
    .filter((el): el is NonNullable<typeof el> => el != null && el.kind === target.kind)
    .map((el) => el.id);
  if (sameKind.length === 0) return;
  const [primary, ...rest] = sameKind;
  useBimStore.setState({ selectedId: primary, selectedIds: rest });
}

export function runtimeSelectGroupDefinitionElements(definitionId: string): void {
  const { groupRegistry } = useBimStore.getState();
  const def = groupRegistry.definitions[definitionId];
  if (!def || def.elementIds.length === 0) return;
  const [primary, ...rest] = def.elementIds;
  useBimStore.setState({ selectedId: primary, selectedIds: rest });
}

export function runtimeUngroupSelectedInstance(): void {
  const st = useBimStore.getState();
  const id = st.selectedId ?? st.selectedIds[0];
  if (!id) return;
  const { groupRegistry } = st;
  if (!groupRegistry.instances[id]) return;
  const { [id]: _removed, ...remainingInstances } = groupRegistry.instances;
  st.setGroupRegistry({ ...groupRegistry, instances: remainingInstances });
}

// ---------------------------------------------------------------------------
// Element queries for batch commands (pinned, tag-all, etc.)
// ---------------------------------------------------------------------------

export function runtimeCollectPinnedElementIds(): string[] {
  const elems = useBimStore.getState().elementsById;
  return Object.values(elems)
    .filter(
      (el): el is NonNullable<typeof el> =>
        el != null && (el as { pinned?: boolean }).pinned === true,
    )
    .map((el) => el.id);
}

export function runtimeActiveAutoDimensionLevelId(): string | null {
  return useBimStore.getState().activeLevelId ?? null;
}

export type AutoTagDispatch = {
  /** Plan-view id that should host the generated tags. */
  hostViewId: string;
  /** Tag commands that the palette host should dispatch. */
  commands: Array<Record<string, unknown>>;
};

export function runtimeBuildAutoTagsForActivePlan(): AutoTagDispatch | null {
  const state = useBimStore.getState();
  const { activeLevelId, activePlanViewId, elementsById } = state;
  if (!activeLevelId || !activePlanViewId) return null;
  const tags = autoTagElements(
    Object.values(elementsById).filter((e): e is NonNullable<typeof e> => e != null),
    activeLevelId,
  );
  const commands: Array<Record<string, unknown>> = [];
  for (const tag of tags) {
    if (elementsById[tag.id]) continue;
    commands.push({
      type: 'placeTag',
      id: tag.id,
      hostElementId: tag.targetElementId,
      hostViewId: activePlanViewId,
      positionMm: tag.positionMm,
      categoryKind: tag.categoryKind,
      leaderEndMm: tag.leaderEndMm,
      fields: tag.fields,
      autoGenerated: true,
    });
  }
  return { hostViewId: activePlanViewId, commands };
}

// ---------------------------------------------------------------------------
// Domain-aware command builders that fold store state into a semantic command
// ---------------------------------------------------------------------------

export function runtimeBuildBoundaryWallCommand(
  selectedElementIds: readonly string[],
): Record<string, unknown> | null {
  const source = runtimeSelectedBoundarySource(selectedElementIds);
  if (!source) return null;
  const state = useBimStore.getState();
  const plan = buildBoundaryWallPlan(source, state.elementsById, {
    wallTypeId: state.activeWallTypeId,
    wallHeightMm: state.wallDrawHeightMm,
    locationLine: state.wallLocationLine,
    skipExistingOverlaps: true,
  });
  return plan.command ?? null;
}

export type RoofFromWallsCommand = {
  type: 'createRoof';
  referenceLevelId: string;
  footprintMm: ReturnType<typeof roofParamsFromWallLoop> extends infer T
    ? T extends { footprintMm: infer F }
      ? F
      : never
    : never;
  overhangMm: number;
  slopeDeg: number;
};

export function runtimeAllSelectedAreWalls(selectedElementIds: readonly string[]): boolean {
  if (selectedElementIds.length < 3) return false;
  const elems = useBimStore.getState().elementsById;
  return selectedElementIds.every((id) => elems[id]?.kind === 'wall');
}

export function runtimeBuildRoofFromWallsCommand(
  selectedElementIds: readonly string[],
): Record<string, unknown> | null {
  const state = useBimStore.getState();
  const walls = selectedElementIds
    .map((id) => state.elementsById[id])
    .filter((e): e is Extract<(typeof state.elementsById)[string] & object, { kind: 'wall' }> =>
      Boolean(e && (e as { kind?: string }).kind === 'wall'),
    );
  const levelId =
    (walls[0] as { levelId?: string } | undefined)?.levelId ?? state.activeLevelId ?? '';
  if (!levelId || walls.length < 3) return null;
  const params = roofParamsFromWallLoop(
    walls as Parameters<typeof roofParamsFromWallLoop>[0],
    levelId,
    500,
    30,
  );
  if (!params) return null;
  return {
    type: 'createRoof',
    referenceLevelId: params.referenceLevelId,
    footprintMm: params.footprintMm,
    overhangMm: params.overhangMm,
    slopeDeg: params.slopeDeg,
  };
}
