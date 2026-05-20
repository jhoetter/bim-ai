import { useCallback, useMemo } from 'react';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import type { WorkspaceMode } from './shell';
import {
  firstSheetId,
  placeViewOnSheetCommand,
  recommendedSheetViewportsCommand,
  recommendedViewsForSheet,
} from './sheets/sheetRecommendedViewports';
import type { ViewTab } from './tabsModel';

type CameraPoseMm = {
  position: { xMm: number; yMm: number; zMm: number };
  target: { xMm: number; yMm: number; zMm: number };
  up: { xMm: number; yMm: number; zMm: number };
};

export function useWorkspacePaletteActions({
  activeTab,
  effectiveMode,
  elementsById,
  selectedId,
  onSemanticCommand,
  openElementById,
  handleModeChange,
  setOrbitCameraFromViewpointMm,
}: {
  activeTab: ViewTab | null;
  effectiveMode: WorkspaceMode;
  elementsById: Record<string, Element>;
  selectedId: string | undefined;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  openElementById: (id: string) => void;
  handleModeChange: (mode: WorkspaceMode) => void;
  setOrbitCameraFromViewpointMm: (pose: CameraPoseMm) => void;
}) {
  const paletteSectionCuts = useMemo(
    () =>
      (Object.values(elementsById) as Element[])
        .filter((el): el is Extract<Element, { kind: 'section_cut' }> => el.kind === 'section_cut')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [elementsById],
  );
  const paletteActiveScheduleId =
    activeTab?.kind === 'schedule' && activeTab.targetId ? activeTab.targetId : null;
  const paletteFirstSheetId = useMemo(() => firstSheetId(elementsById), [elementsById]);
  const paletteActiveSheetId =
    activeTab?.kind === 'sheet' && activeTab.targetId
      ? activeTab.targetId
      : effectiveMode === 'sheet'
        ? paletteFirstSheetId
        : null;
  const paletteActiveSectionId =
    activeTab?.kind === 'section' && activeTab.targetId
      ? activeTab.targetId
      : effectiveMode === 'section'
        ? elementsById[selectedId ?? '']?.kind === 'section_cut'
          ? (selectedId ?? null)
          : (paletteSectionCuts[0]?.id ?? null)
        : null;
  const paletteSheetPlaceableViews = useMemo(
    () =>
      paletteActiveSheetId
        ? recommendedViewsForSheet(elementsById, paletteActiveSheetId).map((el) => ({
            id: el.id,
            label: el.name,
            keywords: [el.kind, 'sheet viewport', 'place on sheet'].join(' '),
          }))
        : [],
    [elementsById, paletteActiveSheetId],
  );

  const openSelectedScheduleRow = useCallback(() => {
    if (!selectedId || !elementsById[selectedId]) return;
    openElementById(selectedId);
  }, [elementsById, openElementById, selectedId]);

  const placeActiveScheduleOnSheet = useCallback(() => {
    if (!paletteActiveScheduleId || !paletteFirstSheetId) return;
    const cmd = placeViewOnSheetCommand(elementsById, paletteFirstSheetId, paletteActiveScheduleId);
    if (cmd) void onSemanticCommand(cmd);
  }, [elementsById, onSemanticCommand, paletteActiveScheduleId, paletteFirstSheetId]);

  const duplicateActiveSchedule = useCallback(() => {
    if (!paletteActiveScheduleId) return;
    const schedule = elementsById[paletteActiveScheduleId];
    if (schedule?.kind !== 'schedule') return;
    void onSemanticCommand({
      type: 'upsertSchedule',
      id: `${schedule.id}-copy-${Date.now().toString(36)}`,
      name: `${schedule.name} copy`,
      filters: { ...(schedule.filters ?? {}) },
      grouping: { ...(schedule.grouping ?? {}) },
    });
  }, [elementsById, onSemanticCommand, paletteActiveScheduleId]);

  const navigateTo = useCallback(
    (target: { kind: WorkspaceMode; targetId?: string; source: string }) => {
      if (target.targetId) {
        openElementById(target.targetId);
        return;
      }
      handleModeChange(target.kind);
    },
    [handleModeChange, openElementById],
  );

  const openActiveSheetAnchor = useCallback(
    (anchorId: string) => {
      navigateTo({
        kind: 'sheet',
        ...(paletteActiveSheetId ? { targetId: paletteActiveSheetId } : {}),
        source: 'cmdk',
      });
      window.setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ block: 'start' });
      }, 0);
    },
    [navigateTo, paletteActiveSheetId],
  );

  const placeRecommendedViewsOnActiveSheet = useCallback(() => {
    if (!paletteActiveSheetId) return;
    const cmd = recommendedSheetViewportsCommand(elementsById, paletteActiveSheetId);
    if (cmd) void onSemanticCommand(cmd);
  }, [elementsById, onSemanticCommand, paletteActiveSheetId]);

  const placeViewOnActiveSheet = useCallback(
    (viewId: string) => {
      if (!paletteActiveSheetId) return;
      const cmd = placeViewOnSheetCommand(elementsById, paletteActiveSheetId, viewId);
      if (cmd) void onSemanticCommand(cmd);
    },
    [elementsById, onSemanticCommand, paletteActiveSheetId],
  );

  const placeActiveSectionOnSheet = useCallback(() => {
    if (!paletteActiveSectionId || !paletteFirstSheetId) return;
    const cmd = placeViewOnSheetCommand(elementsById, paletteFirstSheetId, paletteActiveSectionId);
    if (cmd) void onSemanticCommand(cmd);
  }, [elementsById, onSemanticCommand, paletteActiveSectionId, paletteFirstSheetId]);

  const openActiveSectionSourcePlan = useCallback(() => {
    if (paletteActiveSectionId) {
      useBimStore.getState().select(paletteActiveSectionId);
    }
    navigateTo({ kind: 'plan', source: 'cmdk' });
  }, [navigateTo, paletteActiveSectionId]);

  const openActiveSection3dContext = useCallback(() => {
    if (!paletteActiveSectionId) return;
    const section = elementsById[paletteActiveSectionId];
    if (section?.kind !== 'section_cut') return;
    const dx = section.lineEndMm.xMm - section.lineStartMm.xMm;
    const dy = section.lineEndMm.yMm - section.lineStartMm.yMm;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-6) {
      navigateTo({ kind: '3d', source: 'section-context' });
      return;
    }
    const centerX = (section.lineStartMm.xMm + section.lineEndMm.xMm) * 0.5;
    const centerY = (section.lineStartMm.yMm + section.lineEndMm.yMm) * 0.5;
    const nx = -dy / len;
    const ny = dx / len;
    const depth = Math.max(2500, Math.min(9000, (section.cropDepthMm ?? 6000) * 0.65));
    const targetZ = 1600;
    useBimStore.getState().select(paletteActiveSectionId);
    setOrbitCameraFromViewpointMm({
      position: {
        xMm: centerX - nx * depth,
        yMm: centerY - ny * depth,
        zMm: targetZ + 500,
      },
      target: {
        xMm: centerX,
        yMm: centerY,
        zMm: targetZ,
      },
      up: { xMm: 0, yMm: 0, zMm: 1 },
    });
    navigateTo({ kind: '3d', source: 'section-context' });
  }, [elementsById, navigateTo, paletteActiveSectionId, setOrbitCameraFromViewpointMm]);

  const adjustActiveSectionCropDepth = useCallback(
    (deltaMm: number) => {
      if (!paletteActiveSectionId) return;
      const section = elementsById[paletteActiveSectionId];
      if (section?.kind !== 'section_cut') return;
      const current = typeof section.cropDepthMm === 'number' ? section.cropDepthMm : 9000;
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: paletteActiveSectionId,
        key: 'cropDepthMm',
        value: Math.max(100, current + deltaMm),
      });
    },
    [elementsById, onSemanticCommand, paletteActiveSectionId],
  );

  const openScheduleControls = useCallback(() => {
    navigateTo({
      kind: 'schedule',
      ...(paletteActiveScheduleId ? { targetId: paletteActiveScheduleId } : {}),
      source: 'cmdk',
    });
  }, [navigateTo, paletteActiveScheduleId]);

  return {
    paletteActiveScheduleId,
    paletteActiveSheetId,
    paletteActiveSectionId,
    paletteSheetPlaceableViews,
    openSelectedScheduleRow,
    placeActiveScheduleOnSheet,
    duplicateActiveSchedule,
    navigateTo,
    openActiveSheetAnchor,
    placeRecommendedViewsOnActiveSheet,
    placeViewOnActiveSheet,
    placeActiveSectionOnSheet,
    openActiveSectionSourcePlan,
    openActiveSection3dContext,
    adjustActiveSectionCropDepth,
    openScheduleControls,
  };
}
