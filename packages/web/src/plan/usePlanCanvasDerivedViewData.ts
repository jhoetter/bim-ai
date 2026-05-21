import { useMemo } from 'react';

import type { Element } from '@bim-ai/core';

import { collectCenterAnchors, collectSnapLines, collectWallAnchors } from './snapEngine';
import type { PlanCanvasCropRenderState } from './planCanvasRenderPasses';
import {
  resolvePlanAnnotationHints,
  resolvePlanGraphicHints,
  resolvePlanTagStyleLane,
  resolvePlanViewDisplay,
} from './planProjection';
import type { PlanPresentationPreset } from './symbology';
import type {
  PlanAnnotationHintsResolved,
  PlanGraphicHintsResolved,
  PlanTagStyleHintsWire,
} from './planProjectionWire';

const VIEW_DEF_KINDS = new Set<string>([
  'plan_view',
  'view_template',
  'viewpoint',
  'sheet',
  'schedule',
  'level',
  'project_settings',
  'callout',
]);

type TemporaryVisibility = {
  mode: 'hide' | 'isolate';
  categories: string[];
  elementIds?: string[];
} | null;

export function usePlanCanvasDerivedViewData({
  elementsByIdRaw,
  temporaryVisibility,
  activePlanViewId,
  activeLevelResolvedId,
  planPresentation,
  wireGraphicHints,
  wireAnnotationHints,
  wireTagStyleHints,
}: {
  elementsByIdRaw: Record<string, Element>;
  temporaryVisibility: TemporaryVisibility;
  activePlanViewId: string | undefined;
  activeLevelResolvedId: string;
  planPresentation: PlanPresentationPreset;
  wireGraphicHints: PlanGraphicHintsResolved | null;
  wireAnnotationHints: PlanAnnotationHintsResolved | null;
  wireTagStyleHints: PlanTagStyleHintsWire | null;
}) {
  const elementsById = useMemo(() => {
    if (temporaryVisibility === null) return elementsByIdRaw;
    const next: Record<string, Element> = {};
    for (const [id, el] of Object.entries(elementsByIdRaw)) {
      if (VIEW_DEF_KINDS.has(el.kind)) {
        next[id] = el;
        continue;
      }
      const inSet =
        temporaryVisibility.categories.includes(el.kind) ||
        (temporaryVisibility.elementIds ?? []).includes(id);
      const visible = temporaryVisibility.mode === 'isolate' ? inSet : !inSet;
      if (visible) next[id] = el;
    }
    return next;
  }, [elementsByIdRaw, temporaryVisibility]);

  const display = useMemo(
    () =>
      resolvePlanViewDisplay(
        elementsById,
        activePlanViewId,
        activeLevelResolvedId || undefined,
        planPresentation,
      ),
    [elementsById, activePlanViewId, activeLevelResolvedId, planPresentation],
  );

  const activeCropState = useMemo(():
    | (PlanCanvasCropRenderState & { planViewId: string })
    | null => {
    if (!activePlanViewId) return null;
    const el = elementsById[activePlanViewId];
    if (!el || el.kind !== 'plan_view') return null;
    if (!el.cropMinMm || !el.cropMaxMm) return null;
    return {
      planViewId: el.id,
      cropMinMm: el.cropMinMm,
      cropMaxMm: el.cropMaxMm,
      cropEnabled: !!el.cropEnabled,
      cropRegionVisible: el.cropRegionVisible !== false,
    };
  }, [activePlanViewId, elementsById]);

  const mergedGraphicHints = useMemo(() => {
    if (wireGraphicHints) return wireGraphicHints;
    return resolvePlanGraphicHints(elementsById, activePlanViewId);
  }, [wireGraphicHints, elementsById, activePlanViewId]);

  const mergedAnnotationHints = useMemo(() => {
    if (wireAnnotationHints !== null) return wireAnnotationHints;
    return resolvePlanAnnotationHints(elementsById, activePlanViewId);
  }, [wireAnnotationHints, elementsById, activePlanViewId]);

  const planTagFontScales = useMemo(() => {
    const pvId = display.planViewElementId;
    const ro = resolvePlanTagStyleLane(elementsById, pvId, 'opening');
    const rr = resolvePlanTagStyleLane(elementsById, pvId, 'room');
    const bo = wireTagStyleHints?.opening?.textSizePt;
    const br = wireTagStyleHints?.room?.textSizePt;
    const openingPt = typeof bo === 'number' && Number.isFinite(bo) ? bo : ro.textSizePt;
    const roomPt = typeof br === 'number' && Number.isFinite(br) ? br : rr.textSizePt;
    return { opening: openingPt / 10, room: roomPt / 10 };
  }, [wireTagStyleHints, elementsById, display.planViewElementId]);

  const hiddenKey = useMemo(
    () => [...display.hiddenSemanticKinds].sort().join('|'),
    [display.hiddenSemanticKinds],
  );
  const hiddenElementIdsKey = useMemo(
    () => [...display.hiddenElementIds].sort().join('|'),
    [display.hiddenElementIds],
  );

  const displayLevelId = display.activeLevelId;
  const anchors = useMemo(
    () => collectWallAnchors(elementsById, displayLevelId || undefined),
    [elementsById, displayLevelId],
  );
  const centerAnchors = useMemo(
    () => collectCenterAnchors(elementsById, displayLevelId || undefined),
    [elementsById, displayLevelId],
  );
  const snapLines = useMemo(
    () => collectSnapLines(elementsById, displayLevelId || undefined),
    [elementsById, displayLevelId],
  );

  return {
    elementsById,
    display,
    activeCropState,
    mergedGraphicHints,
    mergedAnnotationHints,
    planTagFontScales,
    hiddenKey,
    hiddenElementIdsKey,
    displayLevelId,
    anchors,
    centerAnchors,
    snapLines,
  };
}
