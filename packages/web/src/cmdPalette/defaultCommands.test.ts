import { afterEach, describe, expect, it, vi } from 'vitest';

import { useBimStore } from '../state/store';
import { VIEWER_CATEGORY_KEYS } from '../viewport/sceneUtils';
import './defaultCommands';
import { getRegistry, queryPalette, type PaletteContext } from './registry';

const PLAN_CTX: PaletteContext = { selectedElementIds: [], activeViewId: null, activeMode: 'plan' };
const THREE_D_CTX: PaletteContext = {
  selectedElementIds: [],
  activeViewId: null,
  activeMode: '3d',
};
const SELECTED_WALL_CTX: PaletteContext = {
  selectedElementIds: ['wall-1'],
  activeViewId: null,
  activeMode: '3d',
};
const SCHEDULE_CTX: PaletteContext = {
  selectedElementIds: [],
  activeViewId: 'sch-1',
  activeScheduleId: 'sch-1',
  activeMode: 'schedule',
};
const SHEET_CTX: PaletteContext = {
  selectedElementIds: [],
  activeViewId: 'sheet-1',
  activeSheetId: 'sheet-1',
  activeMode: 'sheet',
};
const SECTION_CTX: PaletteContext = {
  selectedElementIds: [],
  activeViewId: 'sec-1',
  activeSectionId: 'sec-1',
  activeMode: 'section',
};

afterEach(() => {
  useBimStore.setState({
    elementsById: {},
    selectedId: undefined,
    viewerCameraAction: null,
    viewerProjection: 'perspective',
    viewerSectionBoxActive: false,
    viewerWalkModeActive: false,
    viewerCategoryHidden: { site_origin: true },
  });
});

function command(id: string) {
  const entry = getRegistry().find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Missing command ${id}`);
  return entry;
}

describe('default Cmd+K commands', () => {
  it('registers required plan authoring sketch commands with host tool routing', () => {
    const startPlanTool = vi.fn();
    for (const [commandId, toolId] of [
      ['tool.area', 'area'],
      ['tool.floor-sketch', 'floor-sketch'],
      ['tool.roof-sketch', 'roof-sketch'],
      ['tool.room-separation-sketch', 'room-separation-sketch'],
      ['tool.area-boundary', 'area-boundary'],
    ] as const) {
      const entry = command(commandId);
      expect(entry.badge).toBeUndefined();
      entry.invoke({ ...PLAN_CTX, startPlanTool });
      expect(startPlanTool).toHaveBeenLastCalledWith(toolId);
    }
  });

  it('scopes 3D view commands to active 3D contexts', () => {
    const planEntry = queryPalette('fit model', PLAN_CTX, {}).find(
      (entry) => entry.id === 'view.3d.fit',
    );
    expect(planEntry?.disabledReason).toContain('unavailable');
    expect(
      queryPalette('fit model', THREE_D_CTX, {}).some((entry) => entry.id === 'view.3d.fit'),
    ).toBe(true);
  });

  it('dispatches 3D camera and projection commands through the viewer runtime store', () => {
    command('view.3d.fit').invoke(THREE_D_CTX);
    expect(useBimStore.getState().viewerCameraAction?.kind).toBe('fit');

    command('view.3d.reset-camera').invoke(THREE_D_CTX);
    expect(useBimStore.getState().viewerCameraAction?.kind).toBe('reset');

    command('view.3d.projection.orthographic').invoke(THREE_D_CTX);
    expect(useBimStore.getState().viewerProjection).toBe('orthographic');
  });

  it('can hide and show every registered 3D visibility category', () => {
    command('visibility.3d.hide-all-categories').invoke(THREE_D_CTX);
    for (const key of VIEWER_CATEGORY_KEYS) {
      expect(useBimStore.getState().viewerCategoryHidden[key]).toBe(true);
    }

    command('visibility.3d.show-all-categories').invoke(THREE_D_CTX);
    for (const key of VIEWER_CATEGORY_KEYS) {
      expect(useBimStore.getState().viewerCategoryHidden[key]).toBe(false);
    }
  });

  it('toggles 3D walk mode and section box from Cmd+K commands', () => {
    command('view.3d.walk.toggle').invoke(THREE_D_CTX);
    command('view.3d.section-box.toggle').invoke(THREE_D_CTX);
    expect(useBimStore.getState().viewerWalkModeActive).toBe(true);
    expect(useBimStore.getState().viewerSectionBoxActive).toBe(true);
  });

  it('surfaces selected-wall 3D edit commands and dispatches through palette context', () => {
    const dispatchCommand = vi.fn();
    useBimStore.setState({
      elementsById: {
        'wall-1': {
          kind: 'wall',
          id: 'wall-1',
          name: 'Wall 1',
          wallTypeId: 'wt-1',
          levelId: 'lvl-1',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 6000, yMm: 0 },
          thicknessMm: 200,
          heightMm: 3000,
        },
      },
    });

    const withoutWall = queryPalette('selected wall door', THREE_D_CTX, {}).find(
      (entry) => entry.id === 'view.3d.wall.insert-door',
    );
    expect(withoutWall?.disabledReason).toContain('Requires');

    const withWall = queryPalette('selected wall door', SELECTED_WALL_CTX, {}).find(
      (entry) => entry.id === 'view.3d.wall.insert-door',
    );
    expect(withWall?.disabledReason).toBeUndefined();
    withWall?.invoke({ ...SELECTED_WALL_CTX, dispatchCommand });
    expect(dispatchCommand).toHaveBeenCalledWith({
      type: 'insertDoorOnWall',
      wallId: 'wall-1',
      alongT: 0.5,
      widthMm: 900,
    });
  });

  it('routes language commands through the palette host context', () => {
    const setLanguage = vi.fn();
    command('settings.language.de').invoke({ ...PLAN_CTX, setLanguage });
    expect(setLanguage).toHaveBeenCalledWith('de');

    command('settings.language.en').invoke({ ...PLAN_CTX, setLanguage });
    expect(setLanguage).toHaveBeenCalledWith('en');
  });

  it('routes shell rail toggles through the palette host context', () => {
    const toggleLeftRail = vi.fn();
    const toggleRightRail = vi.fn();

    command('shell.toggle-left-rail').invoke({ ...PLAN_CTX, toggleLeftRail });
    expect(toggleLeftRail).toHaveBeenCalledOnce();

    command('shell.toggle-right-rail').invoke({ ...PLAN_CTX, toggleRightRail });
    expect(toggleRightRail).toHaveBeenCalledOnce();
  });

  it('routes project snapshot and presentation commands through the palette host context', () => {
    const saveSnapshot = vi.fn();
    const openRestoreSnapshot = vi.fn();
    const sharePresentation = vi.fn();

    command('project.save-snapshot').invoke({ ...PLAN_CTX, saveSnapshot });
    expect(saveSnapshot).toHaveBeenCalledOnce();

    command('project.restore-snapshot').invoke({ ...PLAN_CTX, openRestoreSnapshot });
    expect(openRestoreSnapshot).toHaveBeenCalledOnce();

    const unavailableShare = queryPalette('share presentation', PLAN_CTX, {}).find(
      (entry) => entry.id === 'project.share-presentation',
    );
    expect(unavailableShare?.disabledReason).toContain('Requires');

    const share = queryPalette(
      'share presentation',
      { ...PLAN_CTX, hasPresentationPages: true, sharePresentation },
      {},
    ).find((entry) => entry.id === 'project.share-presentation');
    expect(share?.disabledReason).toBeUndefined();
    share?.invoke({ ...PLAN_CTX, hasPresentationPages: true, sharePresentation });
    expect(sharePresentation).toHaveBeenCalledOnce();
  });

  it('routes plan detail commands to the active plan view', () => {
    const dispatchCommand = vi.fn();
    const unavailable = queryPalette('plan detail fine', PLAN_CTX, {}).find(
      (entry) => entry.id === 'view.plan.detail.fine',
    );
    expect(unavailable?.disabledReason).toContain('Requires');

    const entry = queryPalette(
      'plan detail fine',
      { ...PLAN_CTX, activePlanViewId: 'pv-1', dispatchCommand },
      {},
    ).find((candidate) => candidate.id === 'view.plan.detail.fine');
    expect(entry?.disabledReason).toBeUndefined();
    entry?.invoke({ ...PLAN_CTX, activePlanViewId: 'pv-1', dispatchCommand });
    expect(dispatchCommand).toHaveBeenCalledWith({
      type: 'updateElementProperty',
      elementId: 'pv-1',
      key: 'planDetailLevel',
      value: 'fine',
    });
  });

  it('routes schedule workflow commands through the palette host context', () => {
    const openSelectedScheduleRow = vi.fn();
    const placeActiveScheduleOnSheet = vi.fn();
    const duplicateActiveSchedule = vi.fn();
    const openScheduleControls = vi.fn();

    const noSelection = queryPalette('open selected schedule row', SCHEDULE_CTX, {}).find(
      (entry) => entry.id === 'schedule.open-selected-row',
    );
    expect(noSelection?.disabledReason).toContain('Requires');

    command('schedule.open-selected-row').invoke({
      ...SCHEDULE_CTX,
      selectedElementIds: ['door-1'],
      openSelectedScheduleRow,
    });
    expect(openSelectedScheduleRow).toHaveBeenCalledOnce();

    command('schedule.place-on-sheet').invoke({ ...SCHEDULE_CTX, placeActiveScheduleOnSheet });
    expect(placeActiveScheduleOnSheet).toHaveBeenCalledOnce();

    command('schedule.duplicate').invoke({ ...SCHEDULE_CTX, duplicateActiveSchedule });
    expect(duplicateActiveSchedule).toHaveBeenCalledOnce();

    command('schedule.open-controls').invoke({ ...SCHEDULE_CTX, openScheduleControls });
    expect(openScheduleControls).toHaveBeenCalledOnce();
  });

  it('routes sheet workflow commands through the palette host context', () => {
    const placeRecommendedViewsOnActiveSheet = vi.fn();
    const openSheetTitleblockEditor = vi.fn();
    const openSheetViewportEditor = vi.fn();
    const shareActiveSheet = vi.fn();

    const unavailable = queryPalette('sheet titleblock', PLAN_CTX, {}).find(
      (entry) => entry.id === 'sheet.edit-titleblock',
    );
    expect(unavailable?.disabledReason).toContain('unavailable');

    command('sheet.place-recommended-views').invoke({
      ...SHEET_CTX,
      placeRecommendedViewsOnActiveSheet,
    });
    expect(placeRecommendedViewsOnActiveSheet).toHaveBeenCalledOnce();

    command('sheet.edit-titleblock').invoke({ ...SHEET_CTX, openSheetTitleblockEditor });
    expect(openSheetTitleblockEditor).toHaveBeenCalledOnce();

    command('sheet.edit-viewports').invoke({ ...SHEET_CTX, openSheetViewportEditor });
    expect(openSheetViewportEditor).toHaveBeenCalledOnce();

    const unavailableShare = queryPalette('sheet export share', SHEET_CTX, {}).find(
      (entry) => entry.id === 'sheet.export-share',
    );
    expect(unavailableShare?.disabledReason).toContain('Requires');

    command('sheet.export-share').invoke({
      ...SHEET_CTX,
      hasPresentationPages: true,
      shareActiveSheet,
      sharePresentation: vi.fn(),
    });
    expect(shareActiveSheet).toHaveBeenCalledOnce();
  });

  it('routes section workflow commands through the palette host context', () => {
    const placeActiveSectionOnSheet = vi.fn();
    const openActiveSectionSourcePlan = vi.fn();
    const adjustActiveSectionCropDepth = vi.fn();

    const unavailable = queryPalette('section source plan', PLAN_CTX, {}).find(
      (entry) => entry.id === 'section.open-source-plan',
    );
    expect(unavailable?.disabledReason).toContain('unavailable');

    command('section.place-on-sheet').invoke({ ...SECTION_CTX, placeActiveSectionOnSheet });
    expect(placeActiveSectionOnSheet).toHaveBeenCalledOnce();

    command('section.open-source-plan').invoke({ ...SECTION_CTX, openActiveSectionSourcePlan });
    expect(openActiveSectionSourcePlan).toHaveBeenCalledOnce();

    command('section.crop-depth.increase').invoke({
      ...SECTION_CTX,
      adjustActiveSectionCropDepth,
    });
    expect(adjustActiveSectionCropDepth).toHaveBeenCalledWith(500);

    command('section.crop-depth.decrease').invoke({
      ...SECTION_CTX,
      adjustActiveSectionCropDepth,
    });
    expect(adjustActiveSectionCropDepth).toHaveBeenCalledWith(-500);
  });

  it('routes active visibility commands through the palette host context', () => {
    const openActiveVisibilityControls = vi.fn();
    const openPlanVisibilityGraphics = vi.fn();
    const open3dViewControls = vi.fn();

    command('visibility.active-controls').invoke({ ...PLAN_CTX, openActiveVisibilityControls });
    expect(openActiveVisibilityControls).toHaveBeenCalledOnce();

    command('visibility.plan.graphics').invoke({ ...PLAN_CTX, openPlanVisibilityGraphics });
    expect(openPlanVisibilityGraphics).toHaveBeenCalledOnce();

    command('visibility.3d.layers').invoke({ ...THREE_D_CTX, open3dViewControls });
    expect(open3dViewControls).toHaveBeenCalledOnce();
  });
});
