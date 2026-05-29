import { useCallback } from 'react';
import type { Element } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import type { ViewerMode, PlanTool } from '../state/store';
import type { WorkspaceMode } from './shell';
import { slugToken } from './workspacePresentation';

type MmVector = {
  xMm: number;
  yMm: number;
  zMm: number;
};

type OrbitCameraPoseMm = {
  position: MmVector;
  target: MmVector;
  up: MmVector;
};

function sortedLevels(elementsById: Record<string, Element>) {
  return (Object.values(elementsById) as Element[])
    .filter((element): element is Extract<Element, { kind: 'level' }> => element.kind === 'level')
    .sort((a, b) => a.elevationMm - b.elevationMm);
}

function planViewNames(elementsById: Record<string, Element>) {
  return new Set(
    (Object.values(elementsById) as Element[])
      .filter(
        (element): element is Extract<Element, { kind: 'plan_view' }> =>
          element.kind === 'plan_view',
      )
      .map((element) => element.name),
  );
}

export function useWorkspaceCreateViews({
  activePlanViewId,
  activeViewpointId,
  elementsById: elementsByIdArg,
  onSemanticCommand,
  openElementById,
  orbitCameraPoseMm,
  setFocusedPanePlanTool,
  setMode,
  setSeedError,
  setViewerMode,
  viewerCategoryHidden,
  viewerClipElevMm,
  viewerClipFloorElevMm,
  viewerProjection,
}: {
  activePlanViewId: string | null | undefined;
  activeViewpointId: string | null | undefined;
  /**
   * FE-CQ-01-followup: optional. When omitted, the hook subscribes to
   * `elementsById` internally — see the contract comment on
   * `useStructuralValidationViolations`. The create-view callbacks need
   * fresh element data each invocation (existing level/plan-view names,
   * active plan resolution) so a reactive read is appropriate.
   */
  elementsById?: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  openElementById: (id: string) => void;
  orbitCameraPoseMm: OrbitCameraPoseMm | null | undefined;
  setFocusedPanePlanTool: (tool: PlanTool) => void;
  setMode: (mode: WorkspaceMode) => void;
  setSeedError: (message: string | null) => void;
  setViewerMode: (mode: ViewerMode) => void;
  viewerCategoryHidden: Record<string, boolean>;
  viewerClipElevMm: number | null | undefined;
  viewerClipFloorElevMm: number | null | undefined;
  viewerProjection: string;
}) {
  const elementsByIdFromStore = useBimStore((s) => s.elementsById);
  const elementsById = elementsByIdArg ?? elementsByIdFromStore;
  const createFloorPlanView = useCallback(async () => {
    const activePlan = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const activePlanLevelId = activePlan?.kind === 'plan_view' ? activePlan.levelId : undefined;
    const levels = sortedLevels(elementsById);
    const selectedLevel =
      (activePlanLevelId && levels.find((level) => level.id === activePlanLevelId)) || levels[0];
    if (!selectedLevel) {
      setSeedError('No level is available to host a new floor plan.');
      return;
    }
    const existingNames = planViewNames(elementsById);
    let seq = 1;
    let name = `${selectedLevel.name} plan`;
    while (existingNames.has(name)) {
      seq += 1;
      name = `${selectedLevel.name} plan ${seq}`;
    }
    const id = `pv-${slugToken(selectedLevel.name)}-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'upsertPlanView',
      id,
      name,
      levelId: selectedLevel.id,
      planViewSubtype: 'floor_plan',
      discipline: 'architecture',
    });
    openElementById(id);
  }, [activePlanViewId, elementsById, onSemanticCommand, openElementById, setSeedError]);

  const createCeilingPlanView = useCallback(async () => {
    const activePlan = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const activePlanLevelId = activePlan?.kind === 'plan_view' ? activePlan.levelId : undefined;
    const levels = sortedLevels(elementsById);
    const selectedLevel =
      (activePlanLevelId && levels.find((level) => level.id === activePlanLevelId)) || levels[0];
    if (!selectedLevel) {
      setSeedError('No level is available to host a new ceiling plan.');
      return;
    }
    const existingNames = planViewNames(elementsById);
    let seq = 1;
    let name = `${selectedLevel.name} RCP`;
    while (existingNames.has(name)) {
      seq += 1;
      name = `${selectedLevel.name} RCP ${seq}`;
    }
    const id = `pv-rcp-${slugToken(selectedLevel.name)}-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'upsertPlanView',
      id,
      name,
      levelId: selectedLevel.id,
      planViewSubtype: 'ceiling_plan',
      discipline: 'architecture',
    });
    openElementById(id);
  }, [activePlanViewId, elementsById, onSemanticCommand, openElementById, setSeedError]);

  const create3dSavedView = useCallback(async () => {
    const activeViewpoint =
      activeViewpointId && elementsById[activeViewpointId]?.kind === 'viewpoint'
        ? elementsById[activeViewpointId]
        : null;
    const pose =
      orbitCameraPoseMm ??
      (activeViewpoint?.mode === 'orbit_3d' && activeViewpoint.camera
        ? {
            position: activeViewpoint.camera.position,
            target: activeViewpoint.camera.target,
            up: activeViewpoint.camera.up,
          }
        : null);
    if (!pose) {
      setSeedError('Open a 3D view first so a camera can be saved.');
      return;
    }
    const index =
      (Object.values(elementsById) as Element[]).filter((element) => element.kind === 'saved_view')
        .length + 1;
    const id = `sv-3d-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'create_saved_view',
      id,
      baseViewId: activeViewpointId ?? 'orbit_3d',
      name: `Saved 3D View ${index}`,
      cameraState: {
        positionMm: pose.position,
        targetMm: pose.target,
        upMm: pose.up,
        fovDeg: 60,
      },
      visibilityOverrides: {
        viewerClipCapElevMm: viewerClipElevMm,
        viewerClipFloorElevMm,
        hiddenSemanticKinds3d: Object.entries(viewerCategoryHidden)
          .filter(([, hidden]) => hidden)
          .map(([kind]) => kind),
      },
      detailLevel: viewerProjection,
    });
    openElementById(id);
  }, [
    activeViewpointId,
    elementsById,
    onSemanticCommand,
    openElementById,
    orbitCameraPoseMm,
    setSeedError,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
    viewerProjection,
  ]);

  const createSectionView = useCallback(() => {
    setMode('plan');
    setViewerMode('plan_canvas');
    setFocusedPanePlanTool('section');
  }, [setFocusedPanePlanTool, setMode, setViewerMode]);

  const createSheetView = useCallback(async () => {
    const existingNumbers = new Set(
      (Object.values(elementsById) as Element[])
        .filter(
          (element): element is Extract<Element, { kind: 'sheet' }> => element.kind === 'sheet',
        )
        .map((element) => String((element as { number?: string }).number ?? '').trim())
        .filter(Boolean),
    );
    let seq = 101;
    let sheetNumber = `A-${seq}`;
    while (existingNumbers.has(sheetNumber)) {
      seq += 1;
      sheetNumber = `A-${seq}`;
    }
    const sheetId = `sheet-${slugToken(sheetNumber)}-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'CreateSheet',
      sheetId,
      name: `Documentation ${sheetNumber}`,
      number: sheetNumber,
      size: 'A1',
      orientation: 'landscape',
    });
    openElementById(sheetId);
  }, [elementsById, onSemanticCommand, openElementById]);

  const createScheduleView = useCallback(async () => {
    const index =
      (Object.values(elementsById) as Element[]).filter((element) => element.kind === 'schedule')
        .length + 1;
    const id = `sch-${Date.now().toString(36)}`;
    await onSemanticCommand({
      type: 'upsertSchedule',
      id,
      name: `Room schedule ${index}`,
      category: 'room',
      filters: { category: 'room' },
      grouping: {},
    });
    openElementById(id);
  }, [elementsById, onSemanticCommand, openElementById]);

  return {
    createFloorPlanView,
    createCeilingPlanView,
    create3dSavedView,
    createSectionView,
    createSheetView,
    createScheduleView,
  };
}
