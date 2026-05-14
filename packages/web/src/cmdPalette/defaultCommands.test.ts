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
const THREE_D_VIEWPOINT_CTX: PaletteContext = {
  selectedElementIds: [],
  activeViewId: 'vp-1',
  activeViewpointId: 'vp-1',
  activeMode: '3d',
};
const SELECTED_WALL_CTX: PaletteContext = {
  selectedElementIds: ['wall-1'],
  activeViewId: null,
  activeMode: '3d',
};
const SELECTED_FLOOR_CTX: PaletteContext = {
  selectedElementIds: ['floor-1'],
  activeViewId: null,
  activeMode: 'plan',
};
const SELECTED_OPENING_CTX: PaletteContext = {
  selectedElementIds: ['door-1'],
  activeViewId: null,
  activeMode: 'plan',
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
const SHEET_MARKUP_CTX: PaletteContext = {
  ...SHEET_CTX,
  sheetReviewMode: 'an',
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

  it('routes active 3D saved-view commands through the palette host context', () => {
    const saveCurrentViewpoint = vi.fn();
    const resetActiveSavedViewpoint = vi.fn();
    const updateActiveSavedViewpoint = vi.fn();

    const unavailableSave = queryPalette('save current viewpoint', THREE_D_CTX, {}).find(
      (entry) => entry.id === 'view.3d.saved-view.save-current',
    );
    expect(unavailableSave?.disabledReason).toContain('Requires');

    command('view.3d.saved-view.save-current').invoke({
      ...THREE_D_CTX,
      canSaveCurrentViewpoint: true,
      saveCurrentViewpoint,
    });
    expect(saveCurrentViewpoint).toHaveBeenCalledOnce();

    const unavailable = queryPalette('update saved viewpoint', THREE_D_CTX, {}).find(
      (entry) => entry.id === 'view.3d.saved-view.update',
    );
    expect(unavailable?.disabledReason).toContain('Requires');

    command('view.3d.saved-view.reset').invoke({
      ...THREE_D_VIEWPOINT_CTX,
      resetActiveSavedViewpoint,
    });
    expect(resetActiveSavedViewpoint).toHaveBeenCalledOnce();

    command('view.3d.saved-view.update').invoke({
      ...THREE_D_VIEWPOINT_CTX,
      updateActiveSavedViewpoint,
    });
    expect(updateActiveSavedViewpoint).toHaveBeenCalledOnce();
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

  it('routes lens discipline commands through the palette host context', () => {
    const setLensMode = vi.fn();
    command('navigate.architecture').invoke({ ...PLAN_CTX, setLensMode });
    command('navigate.structure').invoke({ ...PLAN_CTX, setLensMode });
    command('navigate.mep').invoke({ ...PLAN_CTX, setLensMode });
    expect(setLensMode).toHaveBeenNthCalledWith(1, 'architecture');
    expect(setLensMode).toHaveBeenNthCalledWith(2, 'structure');
    expect(setLensMode).toHaveBeenNthCalledWith(3, 'mep');
  });

  it('dispatches Structure lens property authoring commands', () => {
    const dispatchCommand = vi.fn();
    useBimStore.setState({
      elementsById: {
        'wall-1': {
          kind: 'wall',
          id: 'wall-1',
          name: 'Wall 1',
          levelId: 'lvl-1',
          start: { xMm: 0, yMm: 0 },
          end: { xMm: 6000, yMm: 0 },
          loadBearing: false,
        },
        'floor-1': {
          kind: 'floor',
          id: 'floor-1',
          name: 'Floor 1',
          levelId: 'lvl-1',
          boundaryMm: [
            { xMm: 0, yMm: 0 },
            { xMm: 1000, yMm: 0 },
            { xMm: 1000, yMm: 1000 },
            { xMm: 0, yMm: 1000 },
          ],
        },
        'door-1': {
          kind: 'door',
          id: 'door-1',
          name: 'Door',
          wallId: 'wall-1',
          alongT: 0.5,
          widthMm: 900,
        },
      },
    });

    command('structure.wall.toggle-load-bearing').invoke({
      ...SELECTED_WALL_CTX,
      dispatchCommand,
    });
    expect(dispatchCommand).toHaveBeenCalledWith({
      type: 'updateElementProperty',
      elementId: 'wall-1',
      key: 'loadBearing',
      value: true,
    });
    expect(dispatchCommand).toHaveBeenCalledWith({
      type: 'updateElementProperty',
      elementId: 'wall-1',
      key: 'structuralRole',
      value: 'bearing_wall',
    });

    command('structure.foundation.mark-selected-floor').invoke({
      ...SELECTED_FLOOR_CTX,
      dispatchCommand,
    });
    expect(dispatchCommand).toHaveBeenCalledWith({
      type: 'updateElementProperty',
      elementId: 'floor-1',
      key: 'structuralRole',
      value: 'foundation',
    });

    command('structure.opening.mark-reviewed').invoke({
      ...SELECTED_OPENING_CTX,
      dispatchCommand,
    });
    expect(dispatchCommand).toHaveBeenCalledWith({
      type: 'set_element_prop',
      elementId: 'door-1',
      key: 'structuralReviewApproved',
      value: true,
    });
  });

  it('routes canonical sidebar toggles through the palette host context', () => {
    const togglePrimarySidebar = vi.fn();
    const toggleElementSidebar = vi.fn();

    command('shell.toggle-primary-sidebar').invoke({ ...PLAN_CTX, togglePrimarySidebar });
    expect(togglePrimarySidebar).toHaveBeenCalledOnce();

    const unavailableElementSidebar = queryPalette('element sidebar', PLAN_CTX, {}).find(
      (entry) => entry.id === 'shell.toggle-element-sidebar',
    );
    expect(unavailableElementSidebar?.disabledReason).toContain('Requires');

    command('shell.toggle-element-sidebar').invoke({
      ...PLAN_CTX,
      selectedElementIds: ['wall-1'],
      toggleElementSidebar,
    });
    expect(toggleElementSidebar).toHaveBeenCalledOnce();
  });

  it('routes tab split commands through the palette host context', () => {
    const splitActiveTabLeft = vi.fn();
    const splitActiveTabRight = vi.fn();
    const splitActiveTabTop = vi.fn();
    const splitActiveTabBottom = vi.fn();
    const ctx = {
      ...PLAN_CTX,
      activeViewId: 'pv-1',
      splitActiveTabLeft,
      splitActiveTabRight,
      splitActiveTabTop,
      splitActiveTabBottom,
    };
    command('tabs.split.left').invoke(ctx);
    command('tabs.split.right').invoke(ctx);
    command('tabs.split.top').invoke(ctx);
    command('tabs.split.bottom').invoke(ctx);
    expect(splitActiveTabLeft).toHaveBeenCalledOnce();
    expect(splitActiveTabRight).toHaveBeenCalledOnce();
    expect(splitActiveTabTop).toHaveBeenCalledOnce();
    expect(splitActiveTabBottom).toHaveBeenCalledOnce();
  });

  it('routes section context jump commands through the palette host context', () => {
    const openActiveSectionSourcePlan = vi.fn();
    const openActiveSection3dContext = vi.fn();
    command('section.open-source-plan').invoke({ ...SECTION_CTX, openActiveSectionSourcePlan });
    command('section.open-3d-context').invoke({ ...SECTION_CTX, openActiveSection3dContext });
    expect(openActiveSectionSourcePlan).toHaveBeenCalledOnce();
    expect(openActiveSection3dContext).toHaveBeenCalledOnce();
  });

  it('routes project snapshot, milestone, help, and presentation commands through the palette host context', () => {
    const saveSnapshot = vi.fn();
    const openRestoreSnapshot = vi.fn();
    const openMilestone = vi.fn();
    const openMaterialBrowser = vi.fn();
    const openAppearanceAssetBrowser = vi.fn();
    const replayOnboardingTour = vi.fn();
    const sharePresentation = vi.fn();
    const openProjectMenu = vi.fn();
    const openProjectSettings = vi.fn();
    const createFloorPlan = vi.fn();
    const create3dView = vi.fn();
    const createSectionView = vi.fn();
    const createSheet = vi.fn();
    const createSchedule = vi.fn();

    command('project.save-snapshot').invoke({ ...PLAN_CTX, saveSnapshot });
    expect(saveSnapshot).toHaveBeenCalledOnce();

    command('project.restore-snapshot').invoke({ ...PLAN_CTX, openRestoreSnapshot });
    expect(openRestoreSnapshot).toHaveBeenCalledOnce();

    command('milestone.open').invoke({ ...PLAN_CTX, openMilestone });
    expect(openMilestone).toHaveBeenCalledOnce();

    command('help.replay-onboarding-tour').invoke({ ...PLAN_CTX, replayOnboardingTour });
    expect(replayOnboardingTour).toHaveBeenCalledOnce();

    const openManageLinks = vi.fn();
    command('project.manage-links').invoke({ ...PLAN_CTX, openManageLinks });
    expect(openManageLinks).toHaveBeenCalledOnce();

    command('project.import.ifc').invoke({ ...PLAN_CTX, openProjectMenu });
    command('project.import.dxf').invoke({ ...PLAN_CTX, openProjectMenu });
    expect(openProjectMenu).toHaveBeenCalledTimes(2);
    command('project.open-settings').invoke({ ...PLAN_CTX, openProjectSettings });
    expect(openProjectSettings).toHaveBeenCalledOnce();

    command('view.create.floor-plan').invoke({ ...PLAN_CTX, createFloorPlan });
    command('view.create.3d-view').invoke({ ...PLAN_CTX, create3dView });
    command('view.create.section').invoke({ ...PLAN_CTX, createSectionView });
    command('view.create.sheet').invoke({ ...PLAN_CTX, createSheet });
    command('view.create.schedule').invoke({ ...PLAN_CTX, createSchedule });
    expect(createFloorPlan).toHaveBeenCalledOnce();
    expect(create3dView).toHaveBeenCalledOnce();
    expect(createSectionView).toHaveBeenCalledOnce();
    expect(createSheet).toHaveBeenCalledOnce();
    expect(createSchedule).toHaveBeenCalledOnce();

    command('library.open-material-browser').invoke({ ...PLAN_CTX, openMaterialBrowser });
    expect(openMaterialBrowser).toHaveBeenCalledOnce();

    command('library.open-appearance-asset-browser').invoke({
      ...PLAN_CTX,
      openAppearanceAssetBrowser,
    });
    expect(openAppearanceAssetBrowser).toHaveBeenCalledOnce();

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
    const setSheetReviewMode = vi.fn();
    const setSheetMarkupShape = vi.fn();

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

    command('sheet.review.comment-mode').invoke({ ...SHEET_CTX, setSheetReviewMode });
    command('sheet.review.markup-mode').invoke({ ...SHEET_CTX, setSheetReviewMode });
    command('sheet.review.resolve-mode').invoke({ ...SHEET_CTX, setSheetReviewMode });
    expect(setSheetReviewMode).toHaveBeenNthCalledWith(1, 'cm');
    expect(setSheetReviewMode).toHaveBeenNthCalledWith(2, 'an');
    expect(setSheetReviewMode).toHaveBeenNthCalledWith(3, 'mr');

    const noMarkupShape = queryPalette('markup shape cloud', SHEET_CTX, {}).find(
      (entry) => entry.id === 'sheet.review.markup-shape.cloud',
    );
    expect(noMarkupShape?.disabledReason).toContain('Requires');

    command('sheet.review.markup-shape.freehand').invoke({
      ...SHEET_MARKUP_CTX,
      setSheetMarkupShape,
    });
    command('sheet.review.markup-shape.arrow').invoke({
      ...SHEET_MARKUP_CTX,
      setSheetMarkupShape,
    });
    command('sheet.review.markup-shape.cloud').invoke({
      ...SHEET_MARKUP_CTX,
      setSheetMarkupShape,
    });
    command('sheet.review.markup-shape.text').invoke({
      ...SHEET_MARKUP_CTX,
      setSheetMarkupShape,
    });
    expect(setSheetMarkupShape).toHaveBeenNthCalledWith(1, 'freehand');
    expect(setSheetMarkupShape).toHaveBeenNthCalledWith(2, 'arrow');
    expect(setSheetMarkupShape).toHaveBeenNthCalledWith(3, 'cloud');
    expect(setSheetMarkupShape).toHaveBeenNthCalledWith(4, 'text');
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

    command('view.3d.sun-settings').invoke({ ...THREE_D_CTX, open3dViewControls });
    expect(open3dViewControls).toHaveBeenCalledTimes(2);
  });

  it('routes advisor entry and quick-fix bridge through the palette host context', () => {
    const openAdvisor = vi.fn();
    const openJobs = vi.fn();
    const applyFirstAdvisorFix = vi.fn();

    command('advisor.open').invoke({ ...PLAN_CTX, openAdvisor });
    expect(openAdvisor).toHaveBeenCalledOnce();
    command('jobs.open').invoke({ ...PLAN_CTX, openJobs });
    expect(openJobs).toHaveBeenCalledOnce();

    const unavailable = queryPalette('advisor fix', PLAN_CTX, {}).find(
      (entry) => entry.id === 'advisor.apply-first-fix',
    );
    expect(unavailable?.disabledReason).toContain('Requires');

    command('advisor.apply-first-fix').invoke({
      ...PLAN_CTX,
      hasAdvisorQuickFix: true,
      applyFirstAdvisorFix,
    });
    expect(applyFirstAdvisorFix).toHaveBeenCalledOnce();
  });
});
