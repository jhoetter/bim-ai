import { useBimStore, type PlanTool } from '../state/store';
import { VIEWER_CATEGORY_KEYS } from '../viewport/sceneUtils';
import { elevationFromWall, sectionCutFromWall } from '../lib/sectionElevationFromWall';
import i18n from '../i18n';
import { registerCommand, type PaletteContext } from './registry';

function is3dContext(ctx: PaletteContext): boolean {
  return ctx.activeMode === '3d' || ctx.activeMode === 'plan-3d';
}

function startPlanTool(ctx: PaletteContext, toolId: PlanTool): void {
  if (ctx.startPlanTool) {
    ctx.startPlanTool(toolId);
    return;
  }
  useBimStore.getState().setPlanTool(toolId);
}

function setAll3dCategoriesHidden(hidden: boolean): void {
  const state = useBimStore.getState();
  const viewerCategoryHidden = { ...state.viewerCategoryHidden };
  for (const key of VIEWER_CATEGORY_KEYS) viewerCategoryHidden[key] = hidden;
  useBimStore.setState({ viewerCategoryHidden });
}

function setLanguage(ctx: PaletteContext, language: 'en' | 'de'): void {
  if (ctx.setLanguage) {
    ctx.setLanguage(language);
    return;
  }
  void i18n.changeLanguage(language);
  localStorage.setItem('bim-ai:lang', language);
}

function toggleLanguage(ctx: PaletteContext): void {
  setLanguage(ctx, i18n.language === 'de' ? 'en' : 'de');
}

function updateActivePlanViewProperty(ctx: PaletteContext, key: string, value: unknown): void {
  if (!ctx.activePlanViewId) return;
  ctx.dispatchCommand?.({
    type: 'updateElementProperty',
    elementId: ctx.activePlanViewId,
    key,
    value,
  });
}

function hasActivePlanView(ctx: PaletteContext): boolean {
  return Boolean(ctx.activePlanViewId);
}

function hasActiveSchedule(ctx: PaletteContext): boolean {
  return Boolean(ctx.activeScheduleId);
}

function hasActiveSheet(ctx: PaletteContext): boolean {
  return Boolean(ctx.activeSheetId);
}

function hasActiveSection(ctx: PaletteContext): boolean {
  return Boolean(ctx.activeSectionId);
}

function hasActiveViewpoint(ctx: PaletteContext): boolean {
  return Boolean(ctx.activeViewpointId);
}

function hasSelection(ctx: PaletteContext): boolean {
  return ctx.selectedElementIds.length > 0;
}

function modelHasWall(): boolean {
  return Object.values(useBimStore.getState().elementsById).some((el) => el?.kind === 'wall');
}

function selectedWall(ctx: PaletteContext) {
  const id = ctx.selectedElementIds[0];
  if (!id) return null;
  const el = useBimStore.getState().elementsById[id];
  return el?.kind === 'wall' ? el : null;
}

function isSelectedWall3dContext(ctx: PaletteContext): boolean {
  return is3dContext(ctx) && Boolean(selectedWall(ctx));
}

function dispatchSelectedWallCommand(
  ctx: PaletteContext,
  build: (wall: NonNullable<ReturnType<typeof selectedWall>>) => Record<string, unknown>,
): void {
  const wall = selectedWall(ctx);
  if (!wall) return;
  ctx.dispatchCommand?.(build(wall));
}

// Tool commands
registerCommand({
  id: 'tool.wall',
  label: 'Place Wall',
  shortcut: 'W',
  keywords: ['wall', 'draw'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'wall'),
});

registerCommand({
  id: 'tool.door',
  label: 'Place Door',
  shortcut: 'D',
  keywords: ['door', 'opening'],
  category: 'command',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'door'),
});

registerCommand({
  id: 'tool.window',
  label: 'Place Window',
  keywords: ['window', 'opening'],
  category: 'command',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'window'),
});

registerCommand({
  id: 'tool.floor',
  label: 'Place Floor',
  keywords: ['floor', 'slab'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'floor'),
});

registerCommand({
  id: 'tool.floor-sketch',
  label: 'Sketch Floor Boundary',
  keywords: ['floor', 'slab', 'sketch', 'boundary'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'floor-sketch'),
});

registerCommand({
  id: 'tool.roof-sketch',
  label: 'Sketch Roof Footprint',
  keywords: ['roof', 'roofing', 'sketch', 'footprint'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'roof-sketch'),
});

registerCommand({
  id: 'tool.room',
  label: 'Place Room',
  shortcut: 'R',
  keywords: ['room', 'space'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'room'),
});

registerCommand({
  id: 'tool.area',
  label: 'Place Area',
  keywords: ['area', 'area plan', 'gross area'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'area'),
});

registerCommand({
  id: 'tool.room-separation-sketch',
  label: 'Sketch Room Separation',
  keywords: ['room separation', 'separator', 'sketch', 'room boundary'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'room-separation-sketch'),
});

registerCommand({
  id: 'tool.area-boundary',
  label: 'Sketch Area Boundary',
  keywords: ['area boundary', 'area plan', 'gross area', 'boundary'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'area-boundary'),
});

registerCommand({
  id: 'tool.select',
  label: 'Select',
  shortcut: 'Esc',
  keywords: ['select', 'pointer'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'select'),
});

registerCommand({
  id: 'tool.query',
  label: 'Query',
  shortcut: 'Q',
  keywords: ['query', 'inspect', 'cad', 'dxf', 'layer'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'query'),
});

// Phase / view commands
registerCommand({
  id: 'view.phase.demolition',
  label: 'Set view phase: Demolition',
  keywords: ['phase', 'demolition', 'demo'],
  category: 'command',
  invoke: () => useBimStore.getState().setPerspectiveId('coordination'),
});

registerCommand({
  id: 'view.phase.existing',
  label: 'Set view phase: Existing',
  keywords: ['phase', 'existing'],
  category: 'command',
  invoke: () => useBimStore.getState().setPerspectiveId('architecture'),
});

registerCommand({
  id: 'view.phase.new',
  label: 'Set view phase: New Construction',
  keywords: ['phase', 'new', 'construction'],
  category: 'command',
  invoke: () => useBimStore.getState().setPerspectiveId('construction'),
});

registerCommand({
  id: 'view.plan.detail.coarse',
  label: 'Plan Detail: Coarse',
  keywords: ['plan', 'detail level', 'coarse', 'style'],
  category: 'command',
  isAvailable: hasActivePlanView,
  invoke: (ctx) => updateActivePlanViewProperty(ctx, 'planDetailLevel', 'coarse'),
});

registerCommand({
  id: 'view.plan.detail.medium',
  label: 'Plan Detail: Medium',
  keywords: ['plan', 'detail level', 'medium', 'style'],
  category: 'command',
  isAvailable: hasActivePlanView,
  invoke: (ctx) => updateActivePlanViewProperty(ctx, 'planDetailLevel', 'medium'),
});

registerCommand({
  id: 'view.plan.detail.fine',
  label: 'Plan Detail: Fine',
  keywords: ['plan', 'detail level', 'fine', 'style'],
  category: 'command',
  isAvailable: hasActivePlanView,
  invoke: (ctx) => updateActivePlanViewProperty(ctx, 'planDetailLevel', 'fine'),
});

// Navigate commands
registerCommand({
  id: 'navigate.plan',
  label: 'Go to plan view',
  keywords: ['plan', '2d', 'floor plan'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.navigateMode) {
      ctx.navigateMode('plan');
      return;
    }
    useBimStore.getState().setViewerMode('plan_canvas');
  },
});

registerCommand({
  id: 'navigate.3d',
  label: 'Go to 3D view',
  keywords: ['3d', 'orbit', 'perspective'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.navigateMode) {
      ctx.navigateMode('3d');
      return;
    }
    useBimStore.getState().setViewerMode('orbit_3d');
  },
});

registerCommand({
  id: 'navigate.plan-3d',
  label: 'Go to Plan + 3D view',
  keywords: ['plan', '3d', 'split', 'side by side'],
  category: 'navigate',
  invoke: (ctx) => ctx.navigateMode?.('plan-3d'),
});

registerCommand({
  id: 'navigate.section',
  label: 'Go to Section view',
  keywords: ['section', 'cut'],
  category: 'navigate',
  invoke: (ctx) => ctx.navigateMode?.('section'),
});

registerCommand({
  id: 'section.place-on-sheet',
  label: 'Section: Place on Sheet',
  keywords: ['section', 'sheet', 'place viewport', 'documentation'],
  category: 'command',
  isAvailable: hasActiveSection,
  invoke: (ctx) => ctx.placeActiveSectionOnSheet?.(),
});

registerCommand({
  id: 'section.open-source-plan',
  label: 'Section: Open Source Plan',
  keywords: ['section', 'source plan', 'open plan', 'cut line'],
  category: 'command',
  isAvailable: hasActiveSection,
  invoke: (ctx) => ctx.openActiveSectionSourcePlan?.(),
});

registerCommand({
  id: 'section.crop-depth.increase',
  label: 'Section: Increase Far Clip',
  keywords: ['section', 'crop', 'far clip', 'depth', 'increase'],
  category: 'command',
  isAvailable: hasActiveSection,
  invoke: (ctx) => ctx.adjustActiveSectionCropDepth?.(500),
});

registerCommand({
  id: 'section.crop-depth.decrease',
  label: 'Section: Decrease Far Clip',
  keywords: ['section', 'crop', 'far clip', 'depth', 'decrease'],
  category: 'command',
  isAvailable: hasActiveSection,
  invoke: (ctx) => ctx.adjustActiveSectionCropDepth?.(-500),
});

registerCommand({
  id: 'navigate.sheet',
  label: 'Go to Sheet view',
  keywords: ['sheet', 'paper', 'layout'],
  category: 'navigate',
  invoke: (ctx) => ctx.navigateMode?.('sheet'),
});

registerCommand({
  id: 'navigate.schedule',
  label: 'Go to Schedule view',
  keywords: ['schedule', 'table', 'rows'],
  category: 'navigate',
  invoke: (ctx) => ctx.navigateMode?.('schedule'),
});

registerCommand({
  id: 'schedule.open-selected-row',
  label: 'Schedule: Open Selected Row',
  keywords: ['schedule', 'row', 'open', 'selected element'],
  category: 'command',
  isAvailable: (ctx) => hasActiveSchedule(ctx) && ctx.selectedElementIds.length > 0,
  invoke: (ctx) => ctx.openSelectedScheduleRow?.(),
});

registerCommand({
  id: 'schedule.place-on-sheet',
  label: 'Schedule: Place on Sheet',
  keywords: ['schedule', 'sheet', 'place viewport'],
  category: 'command',
  isAvailable: hasActiveSchedule,
  invoke: (ctx) => ctx.placeActiveScheduleOnSheet?.(),
});

registerCommand({
  id: 'schedule.duplicate',
  label: 'Schedule: Duplicate',
  keywords: ['schedule', 'duplicate', 'copy definition'],
  category: 'command',
  isAvailable: hasActiveSchedule,
  invoke: (ctx) => ctx.duplicateActiveSchedule?.(),
});

registerCommand({
  id: 'schedule.open-controls',
  label: 'Schedule: Sort, Filter, Group, Columns',
  keywords: ['schedule', 'sort', 'filter', 'group', 'columns', 'fields'],
  category: 'command',
  isAvailable: hasActiveSchedule,
  invoke: (ctx) => ctx.openScheduleControls?.(),
});

registerCommand({
  id: 'sheet.place-recommended-views',
  label: 'Sheet: Place Recommended Views',
  keywords: ['sheet', 'recommended views', 'viewport', 'place views'],
  category: 'command',
  isAvailable: hasActiveSheet,
  invoke: (ctx) => ctx.placeRecommendedViewsOnActiveSheet?.(),
});

registerCommand({
  id: 'sheet.edit-titleblock',
  label: 'Sheet: Edit Titleblock',
  keywords: ['sheet', 'titleblock', 'title block', 'revision', 'issue'],
  category: 'command',
  isAvailable: hasActiveSheet,
  invoke: (ctx) => ctx.openSheetTitleblockEditor?.(),
});

registerCommand({
  id: 'sheet.edit-viewports',
  label: 'Sheet: Edit Viewports',
  keywords: ['sheet', 'viewports', 'crop', 'scale', 'viewport selection'],
  category: 'command',
  isAvailable: hasActiveSheet,
  invoke: (ctx) => ctx.openSheetViewportEditor?.(),
});

registerCommand({
  id: 'sheet.export-share',
  label: 'Sheet: Export / Share',
  keywords: ['sheet', 'export', 'share', 'presentation', 'pdf', 'svg'],
  category: 'command',
  isAvailable: (ctx) =>
    hasActiveSheet(ctx) && Boolean(ctx.hasPresentationPages && ctx.shareActiveSheet),
  invoke: (ctx) => ctx.shareActiveSheet?.(),
});

registerCommand({
  id: 'navigate.agent',
  label: 'Go to Agent Review',
  keywords: ['agent', 'review', 'issues'],
  category: 'navigate',
  invoke: (ctx) => ctx.navigateMode?.('agent'),
});

registerCommand({
  id: 'navigate.concept',
  label: 'Go to Concept board',
  keywords: ['concept', 'moodboard', 'underlay', 'trace'],
  category: 'navigate',
  invoke: (ctx) => ctx.navigateMode?.('concept'),
});

registerCommand({
  id: 'navigate.architecture',
  label: 'Switch to Architecture perspective',
  keywords: ['architecture', 'archi'],
  category: 'navigate',
  invoke: () => useBimStore.getState().setPerspectiveId('architecture'),
});

registerCommand({
  id: 'navigate.structure',
  label: 'Switch to Structure perspective',
  keywords: ['structure', 'structural'],
  category: 'navigate',
  invoke: () => useBimStore.getState().setPerspectiveId('structure'),
});

registerCommand({
  id: 'navigate.mep',
  label: 'Switch to MEP perspective',
  keywords: ['mep', 'mechanical', 'electrical', 'plumbing'],
  category: 'navigate',
  invoke: () => useBimStore.getState().setPerspectiveId('mep'),
});

// Additional tools
registerCommand({
  id: 'tool.column',
  label: 'Place Column',
  keywords: ['column', 'post', 'structural'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'column'),
});

registerCommand({
  id: 'tool.beam',
  label: 'Place Beam',
  keywords: ['beam', 'joist', 'structural'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'beam'),
});

registerCommand({
  id: 'tool.ceiling',
  label: 'Place Ceiling',
  keywords: ['ceiling', 'soffit'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'ceiling'),
});

registerCommand({
  id: 'tool.roof',
  label: 'Sketch Roof',
  keywords: ['roof', 'roofing', 'sketch'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'roof-sketch'),
});

registerCommand({
  id: 'tool.grid',
  label: 'Place Grid Line',
  keywords: ['grid', 'gridline', 'structural grid'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'grid'),
});

registerCommand({
  id: 'tool.dimension',
  label: 'Place Dimension',
  keywords: ['dimension', 'measure', 'annotate'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'dimension'),
});

registerCommand({
  id: 'tool.tag',
  label: 'Tag by Category',
  keywords: ['tag', 'annotation', 'room tag', 'door tag', 'window tag'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'tag'),
});

registerCommand({
  id: 'tool.elevation',
  label: 'Place Elevation / Section Marker',
  keywords: ['elevation', 'section', 'cut', 'marker'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'elevation'),
});

registerCommand({
  id: 'tool.measure',
  label: 'Measure Distance',
  keywords: ['measure', 'tape', 'distance'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'measure'),
});

registerCommand({
  id: 'tool.mirror',
  label: 'Mirror Elements',
  keywords: ['mirror', 'flip', 'symmetry'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'mirror'),
});

registerCommand({
  id: 'theme.light',
  label: 'Switch Theme: Light',
  keywords: ['theme', 'light', 'appearance'],
  category: 'command',
  invoke: (ctx) => ctx.setTheme?.('light'),
});

registerCommand({
  id: 'theme.dark',
  label: 'Switch Theme: Dark',
  keywords: ['theme', 'dark', 'appearance'],
  category: 'command',
  invoke: (ctx) => ctx.setTheme?.('dark'),
});

registerCommand({
  id: 'theme.toggle',
  label: 'Toggle Theme',
  keywords: ['theme', 'appearance', 'switch theme'],
  category: 'command',
  invoke: (ctx) => ctx.toggleTheme?.(),
});

registerCommand({
  id: 'settings.language.toggle',
  label: 'Toggle Language',
  keywords: ['language', 'locale', 'sprache', 'deutsch', 'english'],
  category: 'command',
  invoke: toggleLanguage,
});

registerCommand({
  id: 'settings.language.en',
  label: 'Language: English',
  keywords: ['language', 'locale', 'english', 'en'],
  category: 'command',
  invoke: (ctx) => setLanguage(ctx, 'en'),
});

registerCommand({
  id: 'settings.language.de',
  label: 'Language: Deutsch',
  keywords: ['language', 'locale', 'german', 'deutsch', 'de'],
  category: 'command',
  invoke: (ctx) => setLanguage(ctx, 'de'),
});

registerCommand({
  id: 'project.open-menu',
  label: 'Open Project Menu',
  keywords: ['project', 'files', 'snapshot', 'open'],
  category: 'command',
  invoke: (ctx) => ctx.openProjectMenu?.(),
});

registerCommand({
  id: 'project.save-snapshot',
  label: 'Save Snapshot',
  keywords: ['project', 'snapshot', 'save', 'download', 'backup'],
  category: 'command',
  invoke: (ctx) => ctx.saveSnapshot?.(),
});

registerCommand({
  id: 'project.restore-snapshot',
  label: 'Restore Snapshot',
  keywords: ['project', 'snapshot', 'restore', 'open', 'upload', 'backup'],
  category: 'command',
  invoke: (ctx) => {
    if (ctx.openRestoreSnapshot) {
      ctx.openRestoreSnapshot();
      return;
    }
    ctx.openProjectMenu?.();
  },
});

registerCommand({
  id: 'project.manage-links',
  label: 'Manage Project Links',
  keywords: ['project', 'links', 'ifc', 'dxf', 'external', 'resources'],
  category: 'command',
  invoke: (ctx) => ctx.openManageLinks?.(),
});

registerCommand({
  id: 'project.share-presentation',
  label: 'Share Project',
  keywords: ['share', 'presentation', 'project', 'pages', 'live'],
  category: 'command',
  isAvailable: (ctx) => Boolean(ctx.hasPresentationPages && ctx.sharePresentation),
  invoke: (ctx) => ctx.sharePresentation?.(),
});

registerCommand({
  id: 'library.open-family',
  label: 'Open Family Library',
  keywords: ['family', 'library', 'load', 'component'],
  category: 'command',
  invoke: (ctx) => ctx.openFamilyLibrary?.(),
});

registerCommand({
  id: 'help.keyboard-shortcuts',
  label: 'Open Keyboard Shortcuts',
  keywords: ['help', 'shortcuts', 'keyboard', 'cheatsheet'],
  category: 'command',
  invoke: (ctx) => ctx.openKeyboardShortcuts?.(),
});

registerCommand({
  id: 'tabs.close-inactive',
  label: 'Close Inactive Views',
  keywords: ['tabs', 'views', 'close inactive'],
  category: 'command',
  invoke: (ctx) => ctx.closeInactiveViews?.(),
});

registerCommand({
  id: 'advisor.open',
  label: 'Open Advisor',
  keywords: ['advisor', 'issues', 'warnings', 'errors', 'review', 'health'],
  category: 'command',
  sourceKind: 'agent',
  invoke: (ctx) => ctx.openAdvisor?.(),
});

registerCommand({
  id: 'advisor.apply-first-fix',
  label: 'Apply First Advisor Fix',
  keywords: ['advisor', 'fix', 'quick fix', 'apply fix', 'review'],
  category: 'command',
  sourceKind: 'agent',
  isAvailable: (ctx) => Boolean(ctx.hasAdvisorQuickFix && ctx.applyFirstAdvisorFix),
  invoke: (ctx) => ctx.applyFirstAdvisorFix?.(),
});

registerCommand({
  id: 'visibility.active-controls',
  label: 'Open Active View Visibility Controls',
  keywords: ['visibility', 'graphics', 'vg', 'layers', 'active view'],
  category: 'command',
  invoke: (ctx) => ctx.openActiveVisibilityControls?.(),
});

registerCommand({
  id: 'visibility.plan.graphics',
  label: 'Open Plan Visibility/Graphics',
  keywords: ['visibility', 'graphics', 'vv', 'vg', 'plan'],
  category: 'command',
  invoke: (ctx) => ctx.openPlanVisibilityGraphics?.(),
});

registerCommand({
  id: 'visibility.3d.layers',
  label: 'Open 3D View Controls',
  keywords: ['3d', 'visibility', 'layers', 'view controls', 'graphics'],
  category: 'command',
  invoke: (ctx) => ctx.open3dViewControls?.(),
});

registerCommand({
  id: 'shell.toggle-primary-sidebar',
  label: 'Toggle Primary Sidebar',
  keywords: ['primary sidebar', 'left sidebar', 'project browser', 'browser', 'collapse', 'expand'],
  category: 'command',
  invoke: (ctx) => ctx.togglePrimarySidebar?.(),
});

registerCommand({
  id: 'shell.toggle-element-sidebar',
  label: 'Toggle Element Sidebar',
  keywords: ['element sidebar', 'properties', 'inspector', 'selection', 'collapse', 'expand'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => ctx.toggleElementSidebar?.(),
});

// Display settings
registerCommand({
  id: 'display.render.shaded',
  label: 'Render: Shaded',
  keywords: ['render', 'shaded', 'display', '3d'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => useBimStore.getState().setViewerRenderStyle('shaded'),
});

registerCommand({
  id: 'display.render.wireframe',
  label: 'Render: Wireframe',
  keywords: ['wireframe', 'render', 'display', '3d'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => useBimStore.getState().setViewerRenderStyle('wireframe'),
});

registerCommand({
  id: 'display.render.consistent-colors',
  label: 'Render: Consistent Colors',
  keywords: ['consistent colors', 'render', 'display'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => useBimStore.getState().setViewerRenderStyle('consistent-colors'),
});

registerCommand({
  id: 'view.3d.fit',
  label: '3D: Fit Model',
  keywords: ['3d', 'fit', 'zoom extents', 'camera'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => useBimStore.getState().requestViewerCameraAction('fit'),
});

registerCommand({
  id: 'view.3d.reset-camera',
  label: '3D: Reset Camera',
  keywords: ['3d', 'reset', 'home', 'camera'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => useBimStore.getState().requestViewerCameraAction('reset'),
});

registerCommand({
  id: 'view.3d.projection.perspective',
  label: '3D: Perspective Projection',
  keywords: ['3d', 'perspective', 'projection', 'camera'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => useBimStore.getState().setViewerProjection('perspective'),
});

registerCommand({
  id: 'view.3d.projection.orthographic',
  label: '3D: Orthographic Projection',
  keywords: ['3d', 'orthographic', 'ortho', 'projection'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => useBimStore.getState().setViewerProjection('orthographic'),
});

registerCommand({
  id: 'view.3d.walk.toggle',
  label: '3D: Toggle Walk Mode',
  keywords: ['3d', 'walk', 'camera', 'navigate'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => {
    const state = useBimStore.getState();
    state.setViewerWalkModeActive(!state.viewerWalkModeActive);
  },
});

registerCommand({
  id: 'view.3d.section-box.toggle',
  label: '3D: Toggle Section Box',
  keywords: ['3d', 'section box', 'clip', 'cut'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => {
    const state = useBimStore.getState();
    state.setViewerSectionBoxActive(!state.viewerSectionBoxActive);
  },
});

registerCommand({
  id: 'view.3d.saved-view.save-current',
  label: '3D: Save Current Viewpoint',
  keywords: ['3d', 'saved view', 'viewpoint', 'save camera', 'save current view'],
  category: 'command',
  isAvailable: (ctx) => is3dContext(ctx) && Boolean(ctx.canSaveCurrentViewpoint),
  invoke: (ctx) => ctx.saveCurrentViewpoint?.(),
});

registerCommand({
  id: 'view.3d.saved-view.reset',
  label: '3D: Reset to Saved Viewpoint',
  keywords: ['3d', 'saved view', 'viewpoint', 'reset camera'],
  category: 'command',
  isAvailable: (ctx) => is3dContext(ctx) && hasActiveViewpoint(ctx),
  invoke: (ctx) => ctx.resetActiveSavedViewpoint?.(),
});

registerCommand({
  id: 'view.3d.saved-view.update',
  label: '3D: Update Saved Viewpoint',
  keywords: ['3d', 'saved view', 'viewpoint', 'update camera', 'save viewpoint'],
  category: 'command',
  isAvailable: (ctx) => is3dContext(ctx) && hasActiveViewpoint(ctx),
  invoke: (ctx) => ctx.updateActiveSavedViewpoint?.(),
});

registerCommand({
  id: 'view.3d.sun-settings',
  label: '3D: Sun Settings',
  keywords: ['3d', 'sun', 'shadows', 'solar', 'time of day'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: (ctx) => ctx.open3dViewControls?.(),
});

registerCommand({
  id: 'visibility.3d.show-all-categories',
  label: '3D: Show All Categories',
  keywords: ['3d', 'show all', 'visibility', 'layers', 'categories'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => setAll3dCategoriesHidden(false),
});

registerCommand({
  id: 'visibility.3d.hide-all-categories',
  label: '3D: Hide All Categories',
  keywords: ['3d', 'hide all', 'visibility', 'layers', 'categories'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => setAll3dCategoriesHidden(true),
});

registerCommand({
  id: 'view.3d.wall.insert-door',
  label: '3D: Insert Door on Selected Wall',
  keywords: ['3d', 'door', 'wall face', 'selected wall'],
  category: 'command',
  isAvailable: isSelectedWall3dContext,
  invoke: (ctx) =>
    dispatchSelectedWallCommand(ctx, (wall) => ({
      type: 'insertDoorOnWall',
      wallId: wall.id,
      alongT: 0.5,
      widthMm: 900,
    })),
});

registerCommand({
  id: 'view.3d.wall.insert-window',
  label: '3D: Insert Window on Selected Wall',
  keywords: ['3d', 'window', 'wall face', 'selected wall'],
  category: 'command',
  isAvailable: isSelectedWall3dContext,
  invoke: (ctx) =>
    dispatchSelectedWallCommand(ctx, (wall) => ({
      type: 'insertWindowOnWall',
      wallId: wall.id,
      alongT: 0.5,
      widthMm: 1200,
      sillHeightMm: 900,
      heightMm: 1500,
    })),
});

registerCommand({
  id: 'view.3d.wall.insert-opening',
  label: '3D: Insert Opening on Selected Wall',
  keywords: ['3d', 'opening', 'wall face', 'selected wall'],
  category: 'command',
  isAvailable: isSelectedWall3dContext,
  invoke: (ctx) =>
    dispatchSelectedWallCommand(ctx, (wall) => ({
      type: 'createWallOpening',
      hostWallId: wall.id,
      alongTStart: 0.45,
      alongTEnd: 0.55,
      sillHeightMm: 200,
      headHeightMm: 2400,
    })),
});

registerCommand({
  id: 'view.3d.wall.generate-section',
  label: '3D: Generate Section from Selected Wall',
  keywords: ['3d', 'section', 'wall', 'selected wall'],
  category: 'command',
  isAvailable: isSelectedWall3dContext,
  invoke: (ctx) =>
    dispatchSelectedWallCommand(ctx, (wall) => {
      const params = sectionCutFromWall(wall);
      const id = `sc-${crypto.randomUUID().slice(0, 10)}`;
      return {
        type: 'createSectionCut',
        id,
        name: params.name,
        lineStartMm: params.lineStartMm,
        lineEndMm: params.lineEndMm,
        cropDepthMm: params.cropDepthMm,
      };
    }),
});

registerCommand({
  id: 'view.3d.wall.generate-elevation',
  label: '3D: Generate Elevation from Selected Wall',
  keywords: ['3d', 'elevation', 'wall', 'selected wall'],
  category: 'command',
  isAvailable: isSelectedWall3dContext,
  invoke: (ctx) =>
    dispatchSelectedWallCommand(ctx, (wall) => {
      const params = elevationFromWall(wall);
      const id = `ev-${crypto.randomUUID().slice(0, 10)}`;
      const cmd: Record<string, unknown> = {
        type: 'createElevationView',
        id,
        name: params.name,
        direction: params.direction,
        cropMinMm: params.cropMinMm,
        cropMaxMm: params.cropMaxMm,
      };
      if (params.direction === 'custom' && params.customAngleDeg !== null) {
        cmd.customAngleDeg = params.customAngleDeg;
      }
      return cmd;
    }),
});

registerCommand({
  id: 'display.reveal-hidden',
  label: 'Reveal Hidden Elements',
  keywords: ['reveal', 'hidden', 'invisible', 'show all'],
  category: 'command',
  invoke: () => useBimStore.getState().setRevealHiddenMode(true),
});

registerCommand({
  id: 'display.neighborhood',
  label: 'Toggle Neighborhood Masses',
  keywords: ['neighborhood', 'osm', 'context', 'mass'],
  category: 'command',
  invoke: () => useBimStore.getState().toggleNeighborhoodMasses(),
});
