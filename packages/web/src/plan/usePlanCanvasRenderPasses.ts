import { useEffect, type RefObject } from 'react';
import type { Element, LensMode, ViewLensMode } from '@bim-ai/core';
import * as THREE from 'three';

import { lensFilterFromMode, resolveLensFilter } from '../viewport/useLensFilter';
import type { GroupRegistry } from '../groups/groupTypes';
import { draftingPaintFor } from './planCanvasState';
import { SLICE_Y } from './interaction/planCameraMath';
import { readPlanToken } from './planCanvasHelpers';
import type {
  PlanAnnotationHintsResolved,
  PlanGraphicHintsResolved,
  PlanProjectionPrimitivesV1Wire,
} from './planProjectionWire';
import type { PlanViewResolvedDisplay } from './planProjection';
import { rebuildPlanMeshes } from './symbology';
import {
  buildDriftBadgeCanvas,
  driftBadgeTooltip,
  elementBadgeAnchorMm,
  selectDriftedElements,
} from './monitorDriftBadge';
import {
  applyCropRegionVisibility,
  renderAreaPlanOverlays,
  renderCropRegionOverlay,
  renderDetailComponents,
  renderDraftGrid,
  renderDxfUnderlays,
  renderMaskingRegions,
  renderNeighborhoodMasses,
  renderPlacedTags,
  renderPlanRegionOverlays,
  type PlanCanvasCropRenderState,
} from './planCanvasRenderPasses';
import type { CropBounds } from './cropRegionDragHandles';

export type PlanCanvasDraftingPaint = ReturnType<typeof draftingPaintFor>;

type CropDragState = { currentBounds: CropBounds } | undefined;

export function usePlanCanvasRenderPasses({
  rootRef,
  camRef,
  draftingRef,
  lastPlotScaleRef,
  cropOverlayRef,
  cropDragRef,
  mergedGraphicHints,
  mergedAnnotationHints,
  planTagFontScales,
  display,
  displayLevelId,
  elementsById,
  geomEpoch,
  hiddenKey,
  hiddenElementIdsKey,
  planProjectionPrimitives,
  modelId,
  planTool,
  activeLevelResolvedId,
  revealHiddenMode,
  selectedId,
  activeCropState,
  activePlanViewId,
  showNeighborhoodMasses,
  thinLinesEnabled,
  draftGridVisible,
  lensMode,
  groupRegistry,
  groupEditModeDefinitionId,
  joinedPairs,
}: {
  rootRef: RefObject<THREE.Group | null>;
  camRef: RefObject<{ half: number }>;
  draftingRef: RefObject<PlanCanvasDraftingPaint | null>;
  lastPlotScaleRef: RefObject<number>;
  cropOverlayRef: RefObject<THREE.Group | null>;
  cropDragRef: RefObject<CropDragState>;
  mergedGraphicHints: PlanGraphicHintsResolved | null;
  mergedAnnotationHints: PlanAnnotationHintsResolved | null;
  planTagFontScales: { opening: number; room: number } | null;
  display: PlanViewResolvedDisplay;
  displayLevelId?: string;
  elementsById: Record<string, Element>;
  geomEpoch: number;
  hiddenKey: string;
  hiddenElementIdsKey: string;
  planProjectionPrimitives: PlanProjectionPrimitivesV1Wire | null | undefined;
  modelId: string | null | undefined;
  planTool: string | null | undefined;
  activeLevelResolvedId: string;
  revealHiddenMode: boolean;
  selectedId: string | undefined;
  activeCropState: PlanCanvasCropRenderState | null;
  activePlanViewId: string | undefined;
  showNeighborhoodMasses: boolean;
  thinLinesEnabled: boolean;
  draftGridVisible: boolean;
  lensMode: string;
  groupRegistry: GroupRegistry;
  groupEditModeDefinitionId: string | null | undefined;
  joinedPairs: [string, string][];
}): void {
  useEffect(() => {
    const grp = rootRef.current;
    if (!grp) return;

    const worldHalfMm = camRef.current.half * 1000;
    const plotScale = worldHalfMm / 500;
    draftingRef.current = draftingPaintFor(plotScale);
    lastPlotScaleRef.current = plotScale;

    renderNeighborhoodMasses(grp, elementsById, activePlanViewId, showNeighborhoodMasses);

    const wirePrimitives = modelId && !revealHiddenMode ? planProjectionPrimitives : null;
    const elementsByIdForRender =
      !revealHiddenMode && display.hiddenElementIds.size > 0
        ? Object.fromEntries(
            Object.entries(elementsById).filter(([id]) => !display.hiddenElementIds.has(id)),
          )
        : elementsById;

    const activePvForPhase = activePlanViewId ? elementsById[activePlanViewId] : null;
    const viewPhaseId =
      activePvForPhase?.kind === 'plan_view' ? (activePvForPhase.phaseId ?? null) : null;
    const phaseFilterMode =
      activePvForPhase?.kind === 'plan_view'
        ? ((activePvForPhase.phaseFilterMode ?? null) as
            | 'new_construction'
            | 'demolition'
            | 'existing'
            | 'as_built'
            | null)
        : null;

    rebuildPlanMeshes(grp, elementsByIdForRender, {
      activeLevelId: displayLevelId || undefined,
      activeViewId: activePlanViewId || undefined,
      selectedId,
      presentation: display.presentation,
      hiddenSemanticKinds: revealHiddenMode ? new Set<string>() : display.hiddenSemanticKinds,
      revealHiddenKinds: revealHiddenMode ? display.hiddenSemanticKinds : undefined,
      wirePrimitives,
      planGraphicHints: mergedGraphicHints,
      planAnnotationHints: mergedAnnotationHints,
      planTagFontScales,
      plotScale,
      lineWeights: thinLinesEnabled
        ? {
            cutMajor: 1,
            cutMinor: 1,
            projMajor: 1,
            projMinor: 1,
            witness: 1,
            gridMajor: draftingRef.current.lineWeights.gridMajor !== null ? 1 : null,
            gridMinor: draftingRef.current.lineWeights.gridMinor !== null ? 1 : null,
          }
        : draftingRef.current.lineWeights,
      viewPhaseId,
      phaseFilterMode,
      groupRegistry,
      groupEditModeDefinitionId,
      joinedPairs,
      lineworkOverrides:
        activePvForPhase?.kind === 'plan_view'
          ? (activePvForPhase.lineworkOverrides ?? null)
          : null,
    });

    if (revealHiddenMode && display.hiddenElementIds.size > 0) {
      for (const child of grp.children) {
        const pickId = (child.userData as { bimPickId?: string }).bimPickId;
        if (pickId && display.hiddenElementIds.has(pickId)) {
          child.traverse((node) => {
            const mesh = node as THREE.Mesh | THREE.Line;
            if (!(mesh instanceof THREE.Mesh) && !(mesh instanceof THREE.Line)) return;
            if (!mesh.material) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mesh.material = mats.map((m: THREE.Material) => {
              const c = m.clone();
              if ('color' in c) (c as unknown as { color: THREE.Color }).color.setHex(0xff00ff);
              (c as unknown as { transparent: boolean; opacity: number }).transparent = true;
              (c as unknown as { transparent: boolean; opacity: number }).opacity = 0.55;
              return c;
            });
          });
        }
      }
    }

    for (const ch of grp.children) {
      if (typeof (ch.userData as { hatchKind?: string }).hatchKind === 'string') {
        ch.visible = draftingRef.current.visibleHatches.some(
          (h) => h.kind === (ch.userData as { hatchKind: string }).hatchKind,
        );
      }
    }

    const planView = activePlanViewId ? elementsById[activePlanViewId] : null;
    const filter =
      lensMode && lensMode !== 'all'
        ? lensFilterFromMode(lensMode as LensMode)
        : resolveLensFilter(
            planView && 'defaultLens' in planView
              ? (planView as { defaultLens?: ViewLensMode })
              : null,
          );
    if (lensMode !== 'all' || (planView && 'defaultLens' in planView)) {
      const witnessColor = readPlanToken('--draft-witness', '#64748b');
      const witnessThree = new THREE.Color(witnessColor);
      grp.traverse((ch) => {
        const pickId = (ch.userData as { bimPickId?: string }).bimPickId;
        if (typeof pickId !== 'string') return;
        const el = elementsById[pickId];
        if (!el) return;
        const isGhost = filter(el) === 'ghost';
        if (ch instanceof THREE.Mesh) {
          const mat = ch.material as THREE.Material | THREE.Material[];
          const applyGhost = (m: THREE.Material) => {
            m.transparent = true;
            m.opacity = isGhost ? 0.25 : 1.0;
            const anyMat = m as THREE.Material & { color?: THREE.Color };
            if (isGhost && anyMat.color instanceof THREE.Color) {
              anyMat.color.copy(witnessThree);
            }
          };
          if (Array.isArray(mat)) mat.forEach(applyGhost);
          else applyGhost(mat);
        }
      });
    }

    renderDraftGrid(
      grp,
      camRef.current.half,
      draftGridVisible,
      draftingRef.current?.lineWeights ?? { gridMajor: 1, gridMinor: null },
    );

    renderDxfUnderlays(
      grp,
      elementsById,
      displayLevelId || activeLevelResolvedId,
      activePlanViewId,
    );

    renderMaskingRegions(grp, elementsById, activePlanViewId);
    renderPlanRegionOverlays(grp, elementsById, displayLevelId || activeLevelResolvedId);
    renderAreaPlanOverlays(
      grp,
      elementsById,
      activePlanViewId,
      display.hiddenSemanticKinds,
      display.hiddenElementIds,
      revealHiddenMode,
    );

    for (let i = grp.children.length - 1; i >= 0; i--) {
      const ch = grp.children[i]!;
      if ((ch.userData as { driftBadge?: unknown }).driftBadge) grp.remove(ch);
    }
    const driftedElems = selectDriftedElements(elementsById);
    for (const elem of driftedElems) {
      const anchor = elementBadgeAnchorMm(elem);
      if (!anchor) continue;
      const badgeTexture = new THREE.CanvasTexture(buildDriftBadgeCanvas(64));
      badgeTexture.minFilter = THREE.LinearFilter;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: badgeTexture, transparent: true, depthTest: false }),
      );
      sprite.scale.set(0.32, 0.32, 1);
      sprite.position.set(anchor.xMm / 1000, SLICE_Y + 0.02, anchor.yMm / 1000);
      sprite.userData.driftBadge = true;
      sprite.userData.bimPickId = elem.id;
      sprite.userData.driftTooltip = driftBadgeTooltip(elem);
      grp.add(sprite);
    }

    renderDetailComponents(
      grp,
      elementsById,
      activePlanViewId,
      display.hiddenSemanticKinds,
      display.hiddenElementIds,
      revealHiddenMode,
    );

    renderPlacedTags(
      grp,
      elementsById,
      activePlanViewId,
      display.hiddenSemanticKinds,
      display.hiddenElementIds,
      revealHiddenMode,
    );

    renderCropRegionOverlay(
      grp,
      cropOverlayRef,
      activeCropState,
      cropDragRef.current?.currentBounds,
      camRef.current.half,
    );

    applyCropRegionVisibility(grp, activeCropState, elementsById);
  }, [
    rootRef,
    camRef,
    draftingRef,
    lastPlotScaleRef,
    cropOverlayRef,
    cropDragRef,
    mergedGraphicHints,
    mergedAnnotationHints,
    planTagFontScales,
    display.presentation,
    display.hiddenElementIds,
    display.hiddenSemanticKinds,
    displayLevelId,
    elementsById,
    geomEpoch,
    hiddenKey,
    hiddenElementIdsKey,
    planProjectionPrimitives,
    modelId,
    planTool,
    activeLevelResolvedId,
    revealHiddenMode,
    selectedId,
    activeCropState,
    activePlanViewId,
    showNeighborhoodMasses,
    thinLinesEnabled,
    draftGridVisible,
    lensMode,
    groupRegistry,
    groupEditModeDefinitionId,
    joinedPairs,
  ]);
}
