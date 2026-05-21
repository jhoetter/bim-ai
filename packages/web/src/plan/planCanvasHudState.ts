import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { PlanTool } from '../state/store';
import {
  componentPreviewSymbolKind,
  resolveActiveComponentAsset,
} from './planCanvasComponentPreview';

type WorldToScreen = (xy: { xMm: number; yMm: number }) => { pxX: number; pxY: number };

export function resolvePlanCanvasHudState({
  halfUi,
  planTool,
  activeComponentAssetId,
  elementsById,
  previewEntry,
  hudMm,
  worldToScreen,
}: {
  halfUi: number;
  planTool: PlanTool;
  activeComponentAssetId?: string | null;
  elementsById: Record<string, Element | undefined>;
  previewEntry?: Parameters<typeof resolveActiveComponentAsset>[0]['previewEntry'];
  hudMm: { xMm: number; yMm: number } | null | undefined;
  worldToScreen: WorldToScreen;
}) {
  const activeComponentAsset = resolveActiveComponentAsset({
    planTool,
    activeComponentAssetId,
    elementsById,
    previewEntry,
  });
  return {
    scaleBarMeters: THREE.MathUtils.clamp(halfUi * 0.25, 0.2, 6),
    plotScaleN: Math.round(halfUi * 2),
    componentPreviewScreen: hudMm && activeComponentAsset ? worldToScreen(hudMm) : null,
    componentPreviewSymbol: componentPreviewSymbolKind(activeComponentAsset),
  };
}
