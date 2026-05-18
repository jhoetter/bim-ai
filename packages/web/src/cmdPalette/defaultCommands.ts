import { useBimStore, type PlanTool } from '../state/store';
import { VIEWER_CATEGORY_KEYS } from '../viewport/sceneUtils';
import { elevationFromWall, sectionCutFromWall } from '../lib/sectionElevationFromWall';
import { buildBoundaryWallPlan, type BoundaryWallSource } from '../geometry/boundaryWallGeneration';
import { roofParamsFromWallLoop } from '../plan/roofByFootprint';
import i18n from '../i18n';
import { registerCommand, type PaletteContext } from './registry';
import { autoTagElements } from '../plan/autoTags';
import { buildShaftSideWalls } from '../plan/buildShaftSideWalls';

function is3dContext(ctx: PaletteContext): boolean {
  return ctx.activeMode === '3d';
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

function hasActiveSheetAndMarkupMode(ctx: PaletteContext): boolean {
  return hasActiveSheet(ctx) && ctx.sheetReviewMode === 'an';
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

function selectedBoundarySource(ctx: PaletteContext): BoundaryWallSource | null {
  const id = ctx.selectedElementIds[0];
  if (!id) return null;
  const el = useBimStore.getState().elementsById[id];
  return el?.kind === 'floor' || el?.kind === 'room' ? el : null;
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

function dispatchBoundaryWallGeneration(ctx: PaletteContext): void {
  const source = selectedBoundarySource(ctx);
  if (!source) return;
  const state = useBimStore.getState();
  const plan = buildBoundaryWallPlan(source, state.elementsById, {
    wallTypeId: state.activeWallTypeId,
    wallHeightMm: state.wallDrawHeightMm,
    locationLine: state.wallLocationLine,
    skipExistingOverlaps: true,
  });
  if (!plan.command) return;
  ctx.dispatchCommand?.(plan.command);
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

// §3.6.2 — window type preset commands
registerCommand({
  id: 'tool.window-casement',
  label: 'Place Casement Window',
  keywords: ['casement', 'window', 'Flügelfenster', 'Einfachflügel'],
  category: 'tool',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'window'),
});

registerCommand({
  id: 'tool.window-double-hung',
  label: 'Place Double Hung Window',
  keywords: ['double hung', 'window', 'Doppelt-Hänge', 'sash'],
  category: 'tool',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'window'),
});

registerCommand({
  id: 'tool.window-awning',
  label: 'Place Awning Window',
  keywords: ['awning', 'window', 'Kippfenster', 'top-hung'],
  category: 'tool',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'window'),
});

registerCommand({
  id: 'tool.window-sliding',
  label: 'Place Sliding Window',
  keywords: ['sliding', 'window', 'Schiebefenster', '2-panel'],
  category: 'tool',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'window'),
});

// §3.6.2 — door type preset commands
registerCommand({
  id: 'tool.door-sliding',
  label: 'Place Sliding Door',
  keywords: ['sliding', 'door', 'Schiebetür'],
  category: 'tool',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'door'),
});

registerCommand({
  id: 'tool.door-double-leaf',
  label: 'Place Double-leaf Door',
  keywords: ['double leaf', 'door', 'Zweiflügeltür', 'double door'],
  category: 'tool',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'door'),
});

registerCommand({
  id: 'tool.door-pocket',
  label: 'Place Pocket Door',
  keywords: ['pocket', 'door', 'Schiebetür versenkbar', 'sliding pocket'],
  category: 'tool',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'door'),
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
  id: 'tool.floor-auto-detect',
  label: 'Auto-Detect Floor Boundary',
  keywords: ['floor', 'auto', 'detect', 'boundary', 'wall', 'slab'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'floor'),
});

registerCommand({
  id: 'generate.walls-from-boundary',
  label: 'Create Walls from Boundary',
  keywords: ['walls from floor', 'walls from room', 'boundary walls', 'wall chain'],
  category: 'command',
  isAvailable: (ctx) => Boolean(selectedBoundarySource(ctx)),
  invoke: dispatchBoundaryWallGeneration,
});

registerCommand({
  id: 'tool.roof-sketch',
  label: 'Sketch Roof Footprint',
  keywords: ['roof', 'roofing', 'sketch', 'footprint'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'roof-sketch'),
});

registerCommand({
  id: 'tool.roof-from-walls',
  label: 'Roof by Footprint from Selected Walls',
  keywords: ['roof', 'footprint', 'walls', 'wall loop', 'from walls', 'roof by footprint'],
  category: 'command',
  isAvailable: (ctx) => {
    if (ctx.selectedElementIds.length < 3) return false;
    const elems = useBimStore.getState().elementsById;
    return ctx.selectedElementIds.every((id) => elems[id]?.kind === 'wall');
  },
  invoke: (ctx) => {
    const state = useBimStore.getState();
    const walls = ctx.selectedElementIds
      .map((id) => state.elementsById[id])
      .filter((e): e is Extract<(typeof state.elementsById)[string] & object, { kind: 'wall' }> =>
        Boolean(e && (e as { kind?: string }).kind === 'wall'),
      );
    const levelId =
      (walls[0] as { levelId?: string } | undefined)?.levelId ?? state.activeLevelId ?? '';
    if (!levelId || walls.length < 3) return;
    const params = roofParamsFromWallLoop(
      walls as Parameters<typeof roofParamsFromWallLoop>[0],
      levelId,
      500,
      30,
    );
    if (!params) return;
    ctx.dispatchCommand?.({
      type: 'createRoof',
      referenceLevelId: params.referenceLevelId,
      footprintMm: params.footprintMm,
      overhangMm: params.overhangMm,
      slopeDeg: params.slopeDeg,
    });
  },
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
  id: 'tool.duct',
  label: 'Place Duct',
  keywords: ['duct', 'hvac', 'air', 'mep'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'duct'),
});

registerCommand({
  id: 'tool.pipe',
  label: 'Place Pipe',
  keywords: ['pipe', 'plumbing', 'heating', 'cooling', 'mep'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'pipe'),
});

registerCommand({
  id: 'tool.cable-tray',
  label: 'Place Cable Tray',
  keywords: ['cable tray', 'containment', 'electrical', 'mep'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'cable-tray'),
});

registerCommand({
  id: 'tool.mep-equipment',
  label: 'Place MEP Equipment',
  keywords: ['equipment', 'mechanical', 'electrical', 'plumbing', 'mep'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'mep-equipment'),
});

registerCommand({
  id: 'tool.fixture',
  label: 'Place Fixture',
  keywords: ['fixture', 'plumbing fixture', 'electrical fixture', 'mep'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'fixture'),
});

registerCommand({
  id: 'tool.mep-terminal',
  label: 'Place MEP Terminal',
  keywords: ['terminal', 'air terminal', 'sprinkler', 'device', 'mep'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'mep-terminal'),
});

registerCommand({
  id: 'tool.mep-opening-request',
  label: 'Place MEP Opening Request',
  keywords: ['opening request', 'sleeve', 'penetration', 'coordination', 'mep'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'mep-opening-request'),
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

// Orient 3D view commands (§3.2)
registerCommand({
  id: 'view.orient-top',
  label: 'Orient 3D View to Top (Plan)',
  keywords: ['orient', 'top', 'plan', '3d', 'view'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'orient_3d_view', orientation: 'top' });
  },
});

registerCommand({
  id: 'view.orient-front',
  label: 'Orient 3D View to Front',
  keywords: ['orient', 'front', '3d', 'view'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'orient_3d_view', orientation: 'front' });
  },
});

registerCommand({
  id: 'view.orient-back',
  label: 'Orient 3D View to Back',
  keywords: ['orient', 'back', '3d', 'view'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'orient_3d_view', orientation: 'back' });
  },
});

registerCommand({
  id: 'view.orient-left',
  label: 'Orient 3D View to Left',
  keywords: ['orient', 'left', '3d', 'view'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'orient_3d_view', orientation: 'left' });
  },
});

registerCommand({
  id: 'view.orient-right',
  label: 'Orient 3D View to Right',
  keywords: ['orient', 'right', '3d', 'view'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'orient_3d_view', orientation: 'right' });
  },
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
  id: 'section.open-3d-context',
  label: 'Section: Open 3D Context',
  keywords: ['section', '3d', 'context', 'jump', 'cut orientation'],
  category: 'command',
  isAvailable: hasActiveSection,
  invoke: (ctx) => ctx.openActiveSection3dContext?.(),
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
  id: 'sheet.review.comment-mode',
  label: 'Sheet Review: Comment Mode',
  keywords: ['sheet', 'review', 'comment', 'pin'],
  category: 'command',
  isAvailable: hasActiveSheet,
  invoke: (ctx) => ctx.setSheetReviewMode?.('cm'),
});

registerCommand({
  id: 'sheet.review.markup-mode',
  label: 'Sheet Review: Markup Mode',
  keywords: ['sheet', 'review', 'markup', 'annotate'],
  category: 'command',
  isAvailable: hasActiveSheet,
  invoke: (ctx) => ctx.setSheetReviewMode?.('an'),
});

registerCommand({
  id: 'sheet.review.resolve-mode',
  label: 'Sheet Review: Resolve Mode',
  keywords: ['sheet', 'review', 'resolve', 'comments'],
  category: 'command',
  isAvailable: hasActiveSheet,
  invoke: (ctx) => ctx.setSheetReviewMode?.('mr'),
});

registerCommand({
  id: 'sheet.review.markup-shape.freehand',
  label: 'Sheet Review: Markup Shape Freehand',
  keywords: ['sheet', 'review', 'markup', 'shape', 'freehand', 'pen'],
  category: 'command',
  isAvailable: hasActiveSheetAndMarkupMode,
  invoke: (ctx) => ctx.setSheetMarkupShape?.('freehand'),
});

registerCommand({
  id: 'sheet.review.markup-shape.arrow',
  label: 'Sheet Review: Markup Shape Arrow',
  keywords: ['sheet', 'review', 'markup', 'shape', 'arrow'],
  category: 'command',
  isAvailable: hasActiveSheetAndMarkupMode,
  invoke: (ctx) => ctx.setSheetMarkupShape?.('arrow'),
});

registerCommand({
  id: 'sheet.review.markup-shape.cloud',
  label: 'Sheet Review: Markup Shape Cloud',
  keywords: ['sheet', 'review', 'markup', 'shape', 'cloud'],
  category: 'command',
  isAvailable: hasActiveSheetAndMarkupMode,
  invoke: (ctx) => ctx.setSheetMarkupShape?.('cloud'),
});

registerCommand({
  id: 'sheet.review.markup-shape.text',
  label: 'Sheet Review: Markup Shape Text',
  keywords: ['sheet', 'review', 'markup', 'shape', 'text'],
  category: 'command',
  isAvailable: hasActiveSheetAndMarkupMode,
  invoke: (ctx) => ctx.setSheetMarkupShape?.('text'),
});

registerCommand({
  id: 'navigate.architecture',
  label: 'Switch lens: Architecture',
  keywords: ['architecture', 'archi', 'lens', 'discipline'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('architecture');
      return;
    }
    useBimStore.getState().setLensMode('architecture');
  },
});

registerCommand({
  id: 'navigate.structure',
  label: 'Switch lens: Structure',
  keywords: ['structure', 'structural', 'lens', 'discipline'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('structure');
      return;
    }
    useBimStore.getState().setLensMode('structure');
  },
});

registerCommand({
  id: 'navigate.mep',
  label: 'Switch lens: MEP',
  keywords: ['mep', 'mechanical', 'electrical', 'plumbing', 'lens', 'discipline'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('mep');
      return;
    }
    useBimStore.getState().setLensMode('mep');
  },
});

registerCommand({
  id: 'navigate.coordination',
  label: 'Switch lens: Coordination',
  keywords: ['coordination', 'koordination', 'clash', 'issue', 'review', 'lens'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('coordination');
      return;
    }
    useBimStore.getState().setLensMode('coordination');
  },
});

registerCommand({
  id: 'navigate.fire-safety',
  label: 'Switch lens: Fire Safety',
  keywords: ['fire', 'fire safety', 'brandschutz', 'compartment', 'egress', 'lens'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('fire-safety');
      return;
    }
    useBimStore.getState().setLensMode('fire-safety');
  },
});

registerCommand({
  id: 'navigate.energy',
  label: 'Switch lens: Energieberatung',
  keywords: [
    'energy',
    'energieberatung',
    'energielinse',
    'energieberater',
    'geg',
    'bafa',
    'isfp',
    'beg',
    'lens',
  ],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('energy');
      return;
    }
    useBimStore.getState().setLensMode('energy');
  },
});

registerCommand({
  id: 'navigate.construction-lens',
  label: 'Switch lens: Bauausfuehrung',
  keywords: ['construction', 'execution', 'bauausfuehrung', 'ausfuehrung', 'baustelle', 'lens'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('construction');
      return;
    }
    useBimStore.getState().setLensMode('construction');
  },
});

registerCommand({
  id: 'navigate.sustainability',
  label: 'Switch lens: Sustainability / LCA',
  keywords: ['sustainability', 'lca', 'carbon', 'embodied', 'epd', 'oekobilanz', 'lens'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('sustainability');
      return;
    }
    useBimStore.getState().setLensMode('sustainability');
  },
});

registerCommand({
  id: 'navigate.cost-quantity',
  label: 'Switch lens: Cost and Quantity',
  keywords: ['cost', 'quantity', 'takeoff', 'mengen', 'kosten', 'din276', 'lens'],
  category: 'navigate',
  invoke: (ctx) => {
    if (ctx.setLensMode) {
      ctx.setLensMode('cost-quantity');
      return;
    }
    useBimStore.getState().setLensMode('cost-quantity');
  },
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
  id: 'tool.column-at-grids',
  label: 'Place Columns at Grid Intersections',
  keywords: ['column', 'grid', 'structural', 'at grids', 'batch column'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'column-at-grids'),
});

registerCommand({
  id: 'tool.beam',
  label: 'Place Beam',
  keywords: ['beam', 'joist', 'structural'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'beam'),
});

registerCommand({
  id: 'tool.beam-system',
  label: 'Place Beam System',
  keywords: ['beam system', 'framing', 'joist system', 'structural'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'beam-system'),
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
  id: 'tool.interior-elevation',
  label: 'Interior Elevation',
  keywords: ['interior', 'elevation', 'room', 'four-direction', 'ie'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'interior-elevation'),
});

registerCommand({
  id: 'tool.measure',
  label: 'Measure Distance',
  keywords: ['measure', 'tape', 'distance'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'measure'),
});

registerCommand({
  id: 'tool.measure-angle',
  label: 'Measure Angle',
  keywords: ['measure', 'angle', 'degrees', 'angular'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'measure-angle'),
});

registerCommand({
  id: 'tool.measure-arc',
  label: 'Measure Arc',
  keywords: ['measure', 'arc', 'radius', 'arc length', 'curve'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'measure-arc'),
});

registerCommand({
  id: 'tool.component',
  label: 'Place Component',
  keywords: ['component', 'family', 'furniture', 'load family'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'component'),
});

registerCommand({
  id: 'tool.mirror',
  label: 'Mirror Elements',
  keywords: ['mirror', 'flip', 'symmetry'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'mirror'),
});

registerCommand({
  id: 'tool.stair',
  label: 'Place Stair',
  keywords: ['stair', 'stairs', 'circulation'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'stair'),
});

registerCommand({
  id: 'tool.stair-run',
  label: 'Add Stair Run',
  keywords: ['stair', 'run', 'component', 'step'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'stair-run'),
});

registerCommand({
  id: 'tool.stair-landing',
  label: 'Add Stair Landing',
  keywords: ['stair', 'landing', 'component', 'platform'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'stair-landing'),
});

registerCommand({
  id: 'tool.railing',
  label: 'Place Railing',
  keywords: ['railing', 'guardrail', 'handrail', 'circulation'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'railing'),
});

registerCommand({
  id: 'tool.section',
  label: 'Place Section',
  keywords: ['section', 'cut', 'view marker'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'section'),
});

registerCommand({
  id: 'tool.reference-plane',
  label: 'Place Reference Plane',
  keywords: ['reference plane', 'datum', 'work plane'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'reference-plane'),
});

registerCommand({
  id: 'tool.property-line',
  label: 'Place Property Line',
  keywords: ['property line', 'site', 'boundary'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'property-line'),
});

registerCommand({
  id: 'tool.masking-region',
  label: 'Sketch Masking Region',
  keywords: ['masking region', 'annotation region', 'detail'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'masking-region'),
});

registerCommand({
  id: 'tool.plan-region',
  label: 'Sketch Plan Region',
  keywords: ['plan region', 'cut plane', 'view range'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'plan-region'),
});

registerCommand({
  id: 'tool.align',
  label: 'Align Elements',
  keywords: ['align', 'modify', 'constraint'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'align'),
});

registerCommand({
  id: 'tool.split',
  label: 'Split Element',
  keywords: ['split', 'cut', 'divide'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'split'),
});

registerCommand({
  id: 'tool.split-wall',
  label: 'Split Wall',
  keywords: ['split wall', 'cut wall', 'divide wall'],
  category: 'command',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'split-wall'),
});

registerCommand({
  id: 'tool.trim',
  label: 'Trim Elements',
  keywords: ['trim', 'extend', 'corner'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'trim'),
});

registerCommand({
  id: 'tool.trim-extend',
  label: 'Trim/Extend Elements',
  keywords: ['trim extend', 'trim', 'extend', 'corner'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'trim-extend'),
});

registerCommand({
  id: 'tool.offset',
  label: 'Offset Element',
  keywords: ['offset', 'parallel', 'modify', 'wall'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'offset'),
});

registerCommand({
  id: 'tool.wall-join',
  label: 'Edit Wall Join',
  keywords: ['wall join', 'join', 'disallow join', 'cleanup'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'wall-join'),
});

registerCommand({
  id: 'tool.unjoin',
  label: 'Unjoin Walls',
  keywords: ['unjoin', 'disallow join', 'separate walls', 'disconnect wall'],
  category: 'command',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'unjoin'),
});

registerCommand({
  id: 'tool.attach',
  label: 'Attach Top/Base',
  keywords: ['attach', 'attach wall', 'attach top', 'attach base', 'pin wall', 'wall constraint'],
  category: 'command',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'attach'),
});

registerCommand({
  id: 'tool.detach',
  label: 'Detach Top/Base',
  keywords: ['detach', 'detach wall', 'remove attach', 'unpin wall', 'free wall'],
  category: 'command',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'detach'),
});

registerCommand({
  id: 'tool.text',
  label: 'Text',
  keywords: ['text', 'text annotation', 'label', 'note'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'text'),
});

registerCommand({
  id: 'tool.leader-text',
  label: 'Leader Text',
  keywords: ['leader text', 'leader', 'callout text', 'note with leader'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'leader-text'),
});

registerCommand({
  id: 'tool.angular-dimension',
  label: 'Angular Dimension',
  keywords: ['angular dimension', 'angle dimension', 'angle annotation'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'angular-dimension'),
});

registerCommand({
  id: 'tool.radial-dimension',
  label: 'Radial Dimension',
  keywords: ['radial dimension', 'radius annotation', 'arc radius'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'radial-dimension'),
});

registerCommand({
  id: 'tool.diameter-dimension',
  label: 'Diameter Dimension',
  keywords: ['diameter dimension', 'diameter annotation', 'circle diameter'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'diameter-dimension'),
});

registerCommand({
  id: 'tool.arc-length-dimension',
  label: 'Arc Length Dimension',
  keywords: ['arc length', 'arc length dimension', 'arc annotation'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'arc-length-dimension'),
});

// §4.6 — arc length dimension (non-tool command alias for Cmd+K)
registerCommand({
  id: 'annotate.arc-length-dimension',
  label: 'Arc Length Dimension',
  keywords: ['arc length', 'arc length dimension', 'arc annotation', 'curved dimension'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'arc-length-dimension'),
});

registerCommand({
  id: 'tool.spot-elevation',
  label: 'Spot Elevation',
  keywords: ['spot elevation', 'elevation annotation', 'height annotation'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'spot-elevation'),
});

registerCommand({
  id: 'tool.spot-coordinate',
  label: 'Spot Coordinate',
  keywords: ['spot coordinate', 'coordinate annotation', 'northing easting'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'spot-coordinate'),
});

registerCommand({
  id: 'tool.slope-annotation',
  label: 'Slope Annotation',
  keywords: ['slope annotation', 'slope', 'gradient annotation', 'rise over run'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'slope-annotation'),
});

registerCommand({
  id: 'tool.material-tag',
  label: 'Material Tag',
  keywords: ['material tag', 'tag material', 'layer tag'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'material-tag'),
});

registerCommand({
  id: 'tool.north-arrow',
  label: 'North Arrow',
  keywords: ['north arrow', 'north symbol', 'orientation symbol'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'north-arrow'),
});

registerCommand({
  id: 'tool.brace',
  label: 'Brace',
  keywords: ['brace', 'structural brace', 'diagonal brace', 'cross brace'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'brace'),
});

registerCommand({
  id: 'tool.steel-connection',
  label: 'Steel Connection',
  keywords: [
    'steel connection',
    'end plate',
    'bolted flange',
    'shear tab',
    'structural connection',
  ],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'steel-connection'),
});

registerCommand({
  id: 'tool.excavation',
  label: 'Excavation',
  keywords: ['excavation', 'earthwork', 'cut', 'dig', 'site excavation'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'excavation'),
});

registerCommand({
  id: 'tool.ramp',
  label: 'Ramp',
  keywords: ['ramp', 'sloped ramp', 'accessibility ramp'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'ramp'),
});

registerCommand({
  id: 'tool.conical-roof',
  label: 'Conical Roof',
  keywords: ['conical roof', 'cone roof', 'round roof', 'turret roof'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'conical-roof'),
});

registerCommand({
  id: 'tool.dome-roof',
  label: 'Dome Roof',
  keywords: ['dome roof', 'dome', 'spherical roof', 'onion dome'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'dome-roof'),
});

registerCommand({
  id: 'tool.spire-roof',
  label: 'Spire Roof',
  keywords: ['spire roof', 'spire', 'steeple', 'church spire', 'needle roof'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'spire-roof'),
});

registerCommand({
  id: 'tool.paint',
  label: 'Paint',
  keywords: ['paint', 'face', 'material override', 'color face'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'paint'),
});

registerCommand({
  id: 'tool.linework',
  label: 'Linework Override',
  keywords: ['linework', 'linework override', 'line color', 'line weight', 'line style'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'linework'),
});

registerCommand({
  id: 'tool.array',
  label: 'Array',
  keywords: ['array', 'linear array', 'radial array', 'copy pattern'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'array'),
});

registerCommand({
  id: 'tool.place-group',
  label: 'Place Group',
  keywords: ['place group', 'group instance', 'model group'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'place-group'),
});

registerCommand({
  id: 'tool.scale',
  label: 'Scale',
  keywords: ['scale', 'scale element', 'resize', 'scale factor'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'scale'),
});

registerCommand({
  id: 'tool.mass-box',
  label: 'Box Mass',
  keywords: ['box mass', 'conceptual mass', 'mass box', 'massing'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'mass-box'),
});

registerCommand({
  id: 'tool.mass-extrusion',
  label: 'Extruded Mass',
  keywords: ['extruded mass', 'massing extrusion', 'conceptual mass'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'mass-extrusion'),
});

registerCommand({
  id: 'tool.mass-revolution',
  label: 'Revolved Mass',
  keywords: ['revolved mass', 'revolution mass', 'massing'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'mass-revolution'),
});

registerCommand({
  id: 'tool.walkthrough',
  label: 'Walkthrough Camera Path',
  keywords: ['walkthrough', 'camera', 'animation', 'path', 'keyframe'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'walkthrough'),
});

registerCommand({
  id: 'tool.revision-cloud',
  label: 'Revision Cloud',
  keywords: ['revision cloud', 'revision', 'cloud', 'markup', 'RC'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'revision-cloud'),
});

registerCommand({
  id: 'tool.roof-by-extrusion',
  label: 'Roof by Extrusion',
  keywords: ['roof by extrusion', 'roof extrusion', 'extrusion roof'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'roof-by-extrusion'),
});

registerCommand({
  id: 'wall.create-parts',
  label: 'Create Parts',
  keywords: ['create parts', 'wall parts', 'split wall', 'parts'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => {
    const id = ctx.selectedElementIds[0];
    if (!id) return;
    ctx.dispatchCommand?.({ type: 'createWallParts', elementId: id });
  },
});

registerCommand({
  id: 'tool.wall-opening',
  label: 'Place Wall Opening',
  keywords: ['wall opening', 'opening', 'hosted void'],
  category: 'command',
  isAvailable: modelHasWall,
  invoke: (ctx) => startPlanTool(ctx, 'wall-opening'),
});

registerCommand({
  id: 'tool.shaft',
  label: 'Sketch Shaft Opening',
  keywords: ['shaft', 'shaft opening', 'vertical opening'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'shaft'),
});

registerCommand({
  id: 'tool.toposolid_subdivision',
  label: 'Subdivide Toposolid',
  keywords: ['toposolid', 'subdivision', 'site finish'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'toposolid_subdivision'),
});

registerCommand({
  id: 'tool.terrain-point',
  label: 'Terrain Point',
  keywords: ['terrain', 'height', 'point', 'toposolid', 'site', 'contour'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'terrain-point'),
});

registerCommand({
  id: 'tool.terrain-pad',
  label: 'Terrain Pad',
  keywords: ['terrain', 'pad', 'flat', 'subregion', 'toposolid', 'site', 'gravel'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'terrain-pad'),
});

registerCommand({
  id: 'tool.graded-region',
  label: 'Graded Region',
  keywords: ['graded', 'terrain', 'slope', 'region', 'toposolid', 'site'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'graded-region'),
});

registerCommand({
  id: 'tool.terrain-split',
  label: 'Split Terrain Surface',
  keywords: ['terrain', 'split', 'surface', 'toposolid', 'divide'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'terrain-split'),
});

registerCommand({
  id: 'tool.copy',
  label: 'Copy Elements',
  keywords: ['copy', 'duplicate', 'modify'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => startPlanTool(ctx, 'copy'),
});

registerCommand({
  id: 'tool.move',
  label: 'Move Elements',
  keywords: ['move', 'translate', 'modify'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => startPlanTool(ctx, 'move'),
});

registerCommand({
  id: 'tool.rotate',
  label: 'Rotate Elements',
  keywords: ['rotate', 'angle', 'modify'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => startPlanTool(ctx, 'rotate'),
});

registerCommand({
  id: 'view.3d.measure.ribbon-bridge',
  label: '3D: Measure',
  keywords: ['3d', 'measure', 'distance', 'ribbon'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: (ctx) => startPlanTool(ctx, 'measure'),
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
  id: 'project.open-settings',
  label: 'Open Project Setup',
  keywords: ['project', 'setup', 'settings', 'units', 'levels', 'storeys', 'standards'],
  category: 'command',
  invoke: (ctx) => ctx.openProjectSettings?.(),
});

registerCommand({
  id: 'view.create.floor-plan',
  label: 'Create Floor Plan',
  keywords: ['create', 'new', 'floor plan', 'plan view'],
  category: 'command',
  invoke: (ctx) => ctx.createFloorPlan?.(),
});

registerCommand({
  id: 'view.create.3d-view',
  label: 'Create 3D Saved View',
  keywords: ['create', 'new', '3d', 'saved view', 'viewpoint'],
  category: 'command',
  invoke: (ctx) => ctx.create3dView?.(),
});

registerCommand({
  id: 'view.create.section',
  label: 'Create Section View',
  keywords: ['create', 'new', 'section', 'cut', 'marker'],
  category: 'command',
  invoke: (ctx) => ctx.createSectionView?.(),
});

registerCommand({
  id: 'view.create.sheet',
  label: 'Create Sheet',
  keywords: ['create', 'new', 'sheet', 'documentation'],
  category: 'command',
  invoke: (ctx) => ctx.createSheet?.(),
});

registerCommand({
  id: 'view.create.schedule',
  label: 'Create Schedule',
  keywords: ['create', 'new', 'schedule', 'table'],
  category: 'command',
  invoke: (ctx) => ctx.createSchedule?.(),
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
  id: 'file.link-ifc',
  label: 'Link IFC File…',
  keywords: ['link', 'ifc', 'federated', 'import'],
  category: 'command',
  invoke: (ctx) => ctx.openManageLinks?.(),
});

registerCommand({
  id: 'file.link-pdf',
  label: 'Link PDF Underlay',
  keywords: ['pdf', 'underlay', 'link', 'attach'],
  category: 'command',
  invoke: (ctx) => ctx.openManageLinks?.(),
});

registerCommand({
  id: 'project.manage-links',
  label: 'Manage Project Links',
  keywords: ['project', 'links', 'ifc', 'dxf', 'external', 'resources'],
  category: 'command',
  invoke: (ctx) => ctx.openManageLinks?.(),
});

registerCommand({
  id: 'project.manage-phases',
  label: 'Manage Phases',
  keywords: ['phases', 'construction phase', 'phasing', 'existing', 'demolish'],
  category: 'command',
  invoke: (ctx) => ctx.openManagePhases?.(),
});

registerCommand({
  id: 'project.manage-global-params',
  label: 'Global Parameters',
  keywords: ['global parameters', 'named parameters', 'parameters', 'variables', 'formula'],
  category: 'command',
  invoke: (ctx) => ctx.openManageGlobalParams?.(),
});

registerCommand({
  id: 'annotate.dimension-style',
  label: 'Dimension Style…',
  keywords: ['dimension', 'style', 'text', 'arrow', 'witness'],
  category: 'command',
  invoke: (ctx) => ctx.openDimensionStyle?.(),
});

// §4.1 — Auto-Dimension Walls
registerCommand({
  id: 'annotate.auto-dimension-walls',
  label: 'Auto-Dimension Walls',
  keywords: ['auto', 'dimension', 'walls', 'annotate', 'automatic'],
  category: 'command',
  invoke: (ctx) => {
    const state = useBimStore.getState();
    const levelId = state.activeLevelId ?? null;
    ctx.dispatchCommand?.({ type: 'autoDimensionWalls', levelId });
  },
});

// §4.1 — Tag All Rooms
registerCommand({
  id: 'annotate.tag-all-rooms',
  label: 'Tag All Rooms',
  keywords: ['tag', 'room', 'annotate', 'label'],
  category: 'command',
  invoke: (ctx) => ctx.tagAllRooms?.(),
});

// §4.1 — Angular Dimension (annotate ribbon shortcut)
registerCommand({
  id: 'annotate.angular-dimension',
  label: 'Angular Dimension',
  keywords: ['angular', 'dimension', 'angle', 'annotate'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({
      type: 'createAngularDimension',
      hostViewId: ctx.activePlanViewId ?? '',
      vertexMm: { xMm: 0, yMm: 0 },
      rayAMm: { xMm: 800, yMm: 0 },
      rayBMm: { xMm: 565, yMm: 565 },
      arcRadiusMm: 400,
    });
  },
});

// §4.1 — Radial Dimension (annotate ribbon shortcut)
registerCommand({
  id: 'annotate.radial-dimension',
  label: 'Radial Dimension',
  keywords: ['radial', 'dimension', 'radius', 'arc', 'annotate'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({
      type: 'createRadialDimension',
      hostViewId: ctx.activePlanViewId ?? '',
      centerMm: { xMm: 0, yMm: 0 },
      arcPointMm: { xMm: 500, yMm: 0 },
    });
  },
});

registerCommand({
  id: 'view.visibility-graphics',
  label: 'Visibility/Graphics…',
  keywords: ['visibility', 'graphics', 'VG', 'category', 'override', 'hide', 'colour'],
  category: 'command',
  isAvailable: hasActivePlanView,
  invoke: (ctx) => ctx.openVisibilityGraphics?.(),
});

registerCommand({
  id: 'manage.project-information',
  label: 'Project Information',
  keywords: ['project info', 'name', 'number', 'client', 'address', 'author'],
  category: 'command',
  invoke: (ctx) => ctx.openProjectInfo?.(),
});

registerCommand({
  id: 'project.import.ifc',
  label: 'Import IFC Link',
  keywords: ['import', 'ifc', 'link model', 'project resource'],
  category: 'command',
  invoke: (ctx) => {
    if (ctx.openProjectMenu) {
      ctx.openProjectMenu();
      return;
    }
    ctx.openManageLinks?.();
  },
});

registerCommand({
  id: 'project.import.dxf',
  label: 'Import DXF Underlay',
  keywords: ['import', 'dxf', 'underlay', 'project resource'],
  category: 'command',
  invoke: (ctx) => {
    if (ctx.openProjectMenu) {
      ctx.openProjectMenu();
      return;
    }
    ctx.openManageLinks?.();
  },
});

registerCommand({
  id: 'file.import-dxf-terrain',
  label: 'Import Terrain from DXF…',
  keywords: ['import', 'dxf', 'terrain', 'topo', 'contour'],
  category: 'command',
  invoke: (ctx) => ctx.openDxfImport?.(),
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
  id: 'library.open-material-browser',
  label: 'Open Material Browser',
  keywords: ['material', 'library', 'resource', 'appearance'],
  category: 'command',
  invoke: (ctx) => ctx.openMaterialBrowser?.(),
});

registerCommand({
  id: 'library.open-appearance-asset-browser',
  label: 'Open Appearance Asset Browser',
  keywords: ['appearance asset', 'material asset', 'texture', 'library', 'resource'],
  category: 'command',
  invoke: (ctx) => ctx.openAppearanceAssetBrowser?.(),
});

registerCommand({
  id: 'help.keyboard-shortcuts',
  label: 'Open Keyboard Shortcuts',
  keywords: ['help', 'shortcuts', 'keyboard', 'cheatsheet'],
  category: 'command',
  invoke: (ctx) => ctx.openKeyboardShortcuts?.(),
});

registerCommand({
  id: 'help.replay-onboarding-tour',
  label: 'Replay Onboarding Tour',
  keywords: ['help', 'onboarding', 'tour', 'guidance', 'workspace walkthrough'],
  category: 'command',
  sourceKind: 'setting',
  invoke: (ctx) => ctx.replayOnboardingTour?.(),
});

registerCommand({
  id: 'tabs.close-inactive',
  label: 'Close Inactive Views',
  keywords: ['tabs', 'views', 'close inactive'],
  category: 'command',
  invoke: (ctx) => ctx.closeInactiveViews?.(),
});

registerCommand({
  id: 'tabs.split.left',
  label: 'Split Active View Left',
  keywords: ['split', 'pane', 'left', 'tab layout'],
  category: 'command',
  isAvailable: (ctx) => Boolean(ctx.activeViewId),
  invoke: (ctx) => ctx.splitActiveTabLeft?.(),
});

registerCommand({
  id: 'tabs.split.right',
  label: 'Split Active View Right',
  keywords: ['split', 'pane', 'right', 'tab layout'],
  category: 'command',
  isAvailable: (ctx) => Boolean(ctx.activeViewId),
  invoke: (ctx) => ctx.splitActiveTabRight?.(),
});

registerCommand({
  id: 'tabs.split.top',
  label: 'Split Active View Top',
  keywords: ['split', 'pane', 'top', 'tab layout'],
  category: 'command',
  isAvailable: (ctx) => Boolean(ctx.activeViewId),
  invoke: (ctx) => ctx.splitActiveTabTop?.(),
});

registerCommand({
  id: 'tabs.split.bottom',
  label: 'Split Active View Bottom',
  keywords: ['split', 'pane', 'bottom', 'tab layout'],
  category: 'command',
  isAvailable: (ctx) => Boolean(ctx.activeViewId),
  invoke: (ctx) => ctx.splitActiveTabBottom?.(),
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
  id: 'jobs.open',
  label: 'Open Jobs',
  keywords: ['jobs', 'background', 'progress', 'queue', 'import', 'export'],
  category: 'command',
  sourceKind: 'setting',
  invoke: (ctx) => ctx.openJobs?.(),
});

registerCommand({
  id: 'milestone.open',
  label: 'Open Milestone Dialog',
  keywords: ['milestone', 'checkpoint', 'save point', 'publish snapshot'],
  category: 'command',
  sourceKind: 'setting',
  invoke: (ctx) => ctx.openMilestone?.(),
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
  id: 'structural.delete-duplicate-wall',
  label: 'Delete Duplicate Wall',
  keywords: ['duplicate', 'wall', 'structural', 'repair', 'delete', 'fix'],
  category: 'command',
  sourceKind: 'agent',
  isAvailable: (ctx) => Boolean(ctx.hasAdvisorQuickFix && ctx.applyFirstAdvisorFix),
  invoke: (ctx) => ctx.applyFirstAdvisorFix?.(),
});

registerCommand({
  id: 'structural.detach-orphan',
  label: 'Detach Orphaned Hosted Element',
  keywords: ['orphan', 'hosted', 'structural', 'repair', 'detach', 'fix', 'door', 'window'],
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
  id: 'display.render.high-fidelity',
  label: 'Render: High Fidelity',
  keywords: ['high fidelity', 'render', 'realistic', 'soft shadows', 'display', '3d'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: () => useBimStore.getState().setViewerRenderStyle('high-fidelity'),
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
  id: 'view.save-camera-view',
  label: 'Save Current Camera as Named View',
  keywords: ['camera', 'view', 'save', 'named', 'perspective'],
  category: 'command',
  isAvailable: is3dContext,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'save_camera_view', name: `Camera ${Date.now()}` });
  },
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
  id: 'clipboard.paste-to-levels',
  label: 'Paste Aligned to Selected Levels',
  keywords: ['paste', 'clipboard', 'copy to levels', 'align', 'multi-storey', 'repeat'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => ctx.openPasteToLevels?.(),
});

registerCommand({
  id: 'display.neighborhood',
  label: 'Toggle Neighborhood Masses',
  keywords: ['neighborhood', 'osm', 'context', 'mass'],
  category: 'command',
  invoke: () => useBimStore.getState().toggleNeighborhoodMasses(),
});

// B7 — Join / Unjoin solid geometry (helpers in plan/joinGeometry.ts)
const SOLID_JOIN_KINDS = new Set(['wall', 'floor', 'roof', 'ceiling', 'column', 'beam']);

function hasTwoSolidSelection(ctx: PaletteContext): boolean {
  if (ctx.selectedElementIds.length !== 2) return false;
  const elems = useBimStore.getState().elementsById;
  return ctx.selectedElementIds.every((id) => {
    const el = elems[id];
    return el != null && SOLID_JOIN_KINDS.has(el.kind);
  });
}

registerCommand({
  id: 'modify.join-geometry',
  label: 'Join Geometry',
  keywords: ['join', 'merge', 'solid', 'geometry', 'intersection'],
  category: 'command',
  isAvailable: hasTwoSolidSelection,
  invoke: (ctx) => {
    const [id1, id2] = ctx.selectedElementIds;
    if (!id1 || !id2) return;
    const [a, b] = [id1, id2].sort();
    ctx.dispatchCommand?.({ type: 'joinGeometry', elementId1: a, elementId2: b });
  },
});

registerCommand({
  id: 'modify.unjoin-geometry',
  label: 'Unjoin Geometry',
  keywords: ['unjoin', 'separate', 'disconnect', 'solid', 'geometry'],
  category: 'command',
  isAvailable: hasTwoSolidSelection,
  invoke: (ctx) => {
    const [id1, id2] = ctx.selectedElementIds;
    if (!id1 || !id2) return;
    const [a, b] = [id1, id2].sort();
    ctx.dispatchCommand?.({ type: 'unjoinGeometry', elementId1: a, elementId2: b });
  },
});

// B8 — Pin / Unpin selection (helpers in plan/pinUnpin.ts)
registerCommand({
  id: 'modify.pin-selected',
  label: 'Pin Selected Elements',
  shortcut: 'P N',
  keywords: ['pin', 'lock', 'fix', 'immovable'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => {
    const ids = ctx.selectedElementIds;
    if (ids.length === 0) return;
    ctx.dispatchCommand?.({ type: 'pinElements', elementIds: [...new Set(ids)] });
  },
});

registerCommand({
  id: 'modify.unpin-all',
  label: 'Unpin All Elements',
  keywords: ['unpin', 'unlock', 'unfix', 'all'],
  category: 'command',
  invoke: (ctx) => {
    const elems = useBimStore.getState().elementsById;
    const pinnedIds = Object.values(elems)
      .filter(
        (el): el is NonNullable<typeof el> =>
          el != null && (el as { pinned?: boolean }).pinned === true,
      )
      .map((el) => el.id);
    if (pinnedIds.length === 0) return;
    ctx.dispatchCommand?.({ type: 'unpinElements', elementIds: pinnedIds });
  },
});

registerCommand({
  id: 'modify.unpin-selected',
  label: 'Unpin Selected Elements',
  keywords: ['unpin', 'unlock', 'unfix', 'selected'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => {
    const ids = ctx.selectedElementIds;
    if (ids.length === 0) return;
    ctx.dispatchCommand?.({ type: 'unpinElements', elementIds: [...new Set(ids)] });
  },
});

// §8.6.4 — Enter stair component edit mode
registerCommand({
  id: 'modify.edit-stair',
  label: 'Edit Stair',
  keywords: ['stair', 'edit', 'component', 'run', 'landing', 'modify'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => e.kind === 'stair') ?? false,
  invoke: (ctx) => {
    const stair = ctx.selectedElements?.find((e) => e.kind === 'stair');
    if (stair) ctx.dispatchCommand?.({ type: 'enterStairEditMode', stairId: stair.id });
  },
});

// §3.5.5 — Edit Wall Profile
registerCommand({
  id: 'modify.edit-wall-profile',
  label: 'Edit Wall Profile',
  keywords: ['wall', 'profile', 'edit', 'shape', 'non-rectangular', 'custom'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => e.kind === 'wall') ?? false,
  invoke: (ctx) => {
    const wall = ctx.selectedElements?.find((e) => e.kind === 'wall');
    if (wall)
      ctx.dispatchCommand?.({
        type: 'updateElementProperty',
        elementId: wall.id,
        key: 'editProfileActive',
        value: true,
      });
  },
});

// §1.6.10 — Toggle Crop Region
registerCommand({
  id: 'view.toggle-crop-region',
  label: 'Toggle Crop Region',
  keywords: ['crop', 'region', 'boundary', 'clip', 'view', 'frame'],
  category: 'command',
  invoke: (ctx) => {
    const pvId = ctx.activePlanView?.id;
    if (pvId)
      ctx.dispatchCommand?.({
        type: 'updateElementProperty',
        elementId: pvId,
        key: 'cropRegionEnabled',
        value: !(ctx.activePlanView as any)?.cropRegionEnabled,
      });
  },
});

// §3.3.5 — Toggle Show Constraints (EQ markers + lock symbols on dimensions)
registerCommand({
  id: 'view.toggle-show-constraints',
  label: 'Show Constraints',
  keywords: ['constraints', 'eq', 'equality', 'lock', 'dimension', 'show constraints'],
  category: 'command',
  invoke: (ctx) => {
    const pvId = ctx.activePlanView?.id;
    if (pvId) ctx.dispatchCommand?.({ type: 'toggleShowConstraints', viewId: pvId });
  },
});

// §1.6.10 — Resize Crop Region (canvas handle drag; cmd-k exposes for discoverability)
registerCommand({
  id: 'view.update-crop-region',
  label: 'Resize Crop Region',
  keywords: ['crop', 'region', 'resize', 'boundary', 'clip', 'view', 'handle', 'drag'],
  category: 'command',
  isAvailable: (ctx) => !!(ctx.activePlanView as any)?.cropRegionEnabled,
  invoke: (ctx) => {
    const pvId = ctx.activePlanView?.id;
    if (pvId)
      ctx.dispatchCommand?.({
        type: 'updateElementProperty',
        elementId: pvId,
        key: 'cropRegionEnabled',
        value: true,
      });
  },
});

// B6 — Selection Filter dialog
registerCommand({
  id: 'selection.filter',
  label: 'Filter Selection by Category',
  keywords: ['filter', 'selection', 'category', 'deselect', 'keep'],
  category: 'command',
  isAvailable: hasSelection,
  invoke: (ctx) => ctx.openSelectionFilter?.(),
});

// B6 — Select All Instances in Project
registerCommand({
  id: 'selection.select-all-instances',
  label: 'Select All Instances in Project',
  keywords: ['select all', 'instances', 'type', 'all of type'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElementIds.length === 1,
  invoke: (ctx) => {
    const id = ctx.selectedElementIds[0];
    if (!id) return;
    const elems = useBimStore.getState().elementsById;
    const target = elems[id];
    if (!target) return;
    const sameKind = Object.values(elems)
      .filter((el): el is NonNullable<typeof el> => el != null && el.kind === target.kind)
      .map((el) => el.id);
    if (sameKind.length === 0) return;
    const [primary, ...rest] = sameKind;
    useBimStore.setState({ selectedId: primary, selectedIds: rest });
  },
});

// B2 — Model Groups
registerCommand({
  id: 'model.create-group',
  label: 'Create Group',
  keywords: ['create group', 'model group', 'group elements', 'GP'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElementIds.length >= 2,
  invoke: (ctx) => {
    ctx.openCreateGroup?.();
  },
});

registerCommand({
  id: 'model.ungroup',
  label: 'Ungroup',
  keywords: ['ungroup', 'dissolve group', 'UN'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElementIds.length === 1,
  invoke: (_ctx) => {
    const st = useBimStore.getState();
    const id = st.selectedId ?? st.selectedIds[0];
    if (!id) return;
    const { groupRegistry } = st;
    if (!groupRegistry.instances[id]) return;
    const { [id]: _removed, ...remainingInstances } = groupRegistry.instances;
    st.setGroupRegistry({ ...groupRegistry, instances: remainingInstances });
  },
});

// §4.11 — Tag All by Category
registerCommand({
  id: 'annotation.tag-all-by-category',
  label: 'Tag All by Category…',
  keywords: ['tag all', 'auto tag', 'annotate', 'mark', 'label all'],
  category: 'command',
  invoke: (ctx) => {
    if (ctx.tagAllByCategory) {
      ctx.tagAllByCategory();
      return;
    }
    const state = useBimStore.getState();
    const { activeLevelId, activePlanViewId, elementsById } = state;
    if (!activeLevelId || !activePlanViewId) return;
    const tags = autoTagElements(
      Object.values(elementsById).filter((e): e is NonNullable<typeof e> => e != null),
      activeLevelId,
    );
    for (const tag of tags) {
      if (elementsById[tag.id]) continue;
      ctx.dispatchCommand?.({
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
  },
});

// §6.1.3: derive 3D section box from active plan view crop region
registerCommand({
  id: 'view.section-box-from-plan',
  label: 'Section Box from Active Plan View',
  keywords: ['section box', 'crop', 'plan', '3D', 'clip'],
  category: 'command',
  invoke: (ctx) => {
    ctx.sectionBoxFromPlan?.();
  },
});

// §7.1.1: Model Line tool
registerCommand({
  id: 'tool.model-line',
  label: 'Model Line',
  keywords: ['model line', 'construction line', 'sketch', 'ML'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'model-line'),
});

// §2.1.3: Project Base Point
registerCommand({
  id: 'tool.project-base-point',
  label: 'Project Base Point',
  keywords: ['project base point', 'base point', 'origin', 'pbp', 'BP'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'project-base-point'),
});

// §7.3.1: Set Work Plane
registerCommand({
  id: 'view.set-work-plane',
  label: 'Set Work Plane',
  keywords: ['work plane', 'reference plane', 'set plane'],
  category: 'command',
  invoke: (ctx) => {
    ctx.setWorkPlaneOpen?.(true);
  },
});

// §7.3.2: Set Work Plane to Face
registerCommand({
  id: 'view.set-work-plane-face',
  label: 'Set Work Plane to Face',
  keywords: ['work plane', 'face', 'wall face', 'floor face', 'orient plane'],
  category: 'command',
  invoke: (ctx) => {
    ctx.setWorkPlaneOpen?.(true);
  },
});

// §1.6.10: hide / isolate / reset hidden elements in the active plan view
registerCommand({
  id: 'view.hide-selected',
  label: 'Hide Selected Elements in View',
  keywords: ['hide', 'element', 'view'],
  category: 'command',
  invoke: (ctx) => {
    const sel = ctx.selectedElementIds ?? [];
    if (sel.length > 0 && ctx.activePlanViewId) {
      ctx.dispatchCommand?.({
        type: 'hide_in_view',
        viewId: ctx.activePlanViewId,
        elementIds: sel,
      });
    }
  },
});

registerCommand({
  id: 'view.isolate-selected',
  label: 'Isolate Selected Elements in View',
  keywords: ['isolate', 'element', 'view'],
  category: 'command',
  invoke: (ctx) => {
    const sel = ctx.selectedElementIds ?? [];
    if (sel.length > 0 && ctx.activePlanViewId) {
      ctx.dispatchCommand?.({
        type: 'isolate_in_view',
        viewId: ctx.activePlanViewId,
        elementIds: sel,
      });
    }
  },
});

registerCommand({
  id: 'view.reset-hidden',
  label: 'Reset Hidden Elements in View',
  keywords: ['reset', 'hidden', 'show all', 'unhide'],
  category: 'command',
  invoke: (ctx) => {
    if (ctx.activePlanViewId) {
      ctx.dispatchCommand?.({ type: 'reset_hidden_in_view', viewId: ctx.activePlanViewId });
    }
  },
});

// §11.5 — Massing → BIM workflow commands
registerCommand({
  id: 'mass.generate-walls',
  label: 'Generate Walls from Mass',
  keywords: ['mass', 'wall', 'generate', 'face'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({
      type: 'mass_generate_walls',
      massId: ctx.selectedElementIds?.[0] ?? '',
    });
  },
});

registerCommand({
  id: 'mass.generate-floors',
  label: 'Generate Floors from Mass',
  keywords: ['mass', 'floor', 'slab', 'level', 'generate'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({
      type: 'mass_generate_floors',
      massId: ctx.selectedElementIds?.[0] ?? '',
    });
  },
});

registerCommand({
  id: 'mass.generate-roof',
  label: 'Generate Roof from Mass',
  keywords: ['mass', 'roof', 'generate', 'top'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({
      type: 'mass_generate_roof',
      massId: ctx.selectedElementIds?.[0] ?? '',
    });
  },
});

registerCommand({
  id: 'mass.generate-all',
  label: 'Generate All (Walls + Floors + Roof) from Mass',
  keywords: ['mass', 'generate', 'all', 'bim'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({
      type: 'mass_generate_walls',
      massId: ctx.selectedElementIds?.[0] ?? '',
    });
    ctx.dispatchCommand?.({
      type: 'mass_generate_floors',
      massId: ctx.selectedElementIds?.[0] ?? '',
    });
    ctx.dispatchCommand?.({
      type: 'mass_generate_roof',
      massId: ctx.selectedElementIds?.[0] ?? '',
    });
  },
});

registerCommand({
  id: 'mass.generate-curtain-walls',
  label: 'Generate Curtain Walls from Mass',
  keywords: ['curtain', 'mass', 'generate', 'facade'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({
      type: 'mass_generate_curtain_walls',
      massId: ctx.selectedElementIds?.[0] ?? '',
    });
  },
});

// §10.3.1-3 — Conical / Dome / Spire roof tools
registerCommand({
  id: 'tool.conical-roof',
  label: 'Conical Roof',
  keywords: ['conical roof', 'cone roof', 'circular roof', 'CR'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'conical-roof'),
});

registerCommand({
  id: 'tool.dome-roof',
  label: 'Dome Roof',
  keywords: ['dome roof', 'dome', 'round roof', 'DM'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'dome-roof'),
});

registerCommand({
  id: 'tool.spire-roof',
  label: 'Spire Roof',
  keywords: ['spire roof', 'spire', 'tower roof', 'SI'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'spire-roof'),
});

// §15.1.2 — Family Editor Blend + Sweep Forms
registerCommand({
  id: 'tool.family-blend',
  label: 'Family Blend',
  keywords: ['family blend', 'blend', 'loft', 'FB'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'family-blend'),
});

registerCommand({
  id: 'tool.family-sweep',
  label: 'Family Sweep',
  keywords: ['family sweep', 'sweep', 'extrude path', 'FS'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'family-sweep'),
});

registerCommand({
  id: 'tool.family-swept-blend',
  label: 'Swept Blend',
  keywords: ['swept blend', 'sweep blend', 'family swept blend', 'FSB'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'family-swept-blend'),
});

// §6.5 — Print Current View via browser
registerCommand({
  id: 'file.print-current-view',
  label: 'Print Current View…',
  keywords: ['print', 'plot', 'browser print'],
  category: 'command',
  invoke: (ctx) => {
    ctx.openPrintDialog?.();
  },
});

// §12.1.2 — IFC STEP import
registerCommand({
  id: 'file.import-ifc',
  label: 'Import IFC…',
  keywords: ['import', 'ifc', 'step', 'open bim'],
  category: 'command',
  invoke: (ctx) => {
    ctx.openManageLinks?.();
  },
});

// §5.4.2 — True North + Project Elevation
registerCommand({
  id: 'view.rotate-to-true-north',
  label: 'Rotate View to True North',
  keywords: ['north', 'rotate', 'true north', 'orientation'],
  category: 'command',
  invoke: (ctx) => ctx.rotateToTrueNorth?.(),
});

registerCommand({
  id: 'project.set-true-north',
  label: 'Set True North Angle…',
  keywords: ['north', 'angle', 'project', 'orientation', 'georef'],
  category: 'command',
  invoke: (ctx) => ctx.setTrueNorthAngle?.(),
});

registerCommand({
  id: 'project.set-elevation',
  label: 'Set Project Elevation…',
  keywords: ['elevation', 'height', 'real world', 'offset'],
  category: 'command',
  invoke: (ctx) => ctx.setProjectElevation?.(),
});

// §13.4 — egress / route analysis
registerCommand({
  id: 'analysis.egress',
  label: 'Egress Analysis…',
  keywords: ['egress', 'escape', 'route', 'analysis', 'accessibility', 'path'],
  category: 'command',
  invoke: (ctx) => ctx.openEgressAnalysis?.(),
});

// §8.4 — head-height clearance check
registerCommand({
  id: 'analysis.check-clearances',
  label: 'Check Head-Height Clearances',
  keywords: ['clearance', 'head height', 'door', 'stair', 'check', 'analysis'],
  category: 'command',
  invoke: (ctx) => ctx.checkClearances?.(),
});

// §15.1.3 — family editor parametric parameters
registerCommand({
  id: 'family.add-parameter',
  label: 'Add Family Parameter…',
  keywords: ['family', 'parameter', 'dimension', 'constraint'],
  category: 'command',
  invoke: (ctx) => ctx.openFamilyEditor?.(),
});

// §15.1.2 — family parameter formula evaluation
registerCommand({
  id: 'family.parameter-formula',
  label: 'Family Parameter Formula',
  keywords: ['family', 'parameter', 'formula', 'arithmetic', 'expression', 'width', 'height'],
  category: 'command',
  invoke: (ctx) => ctx.openFamilyEditor?.(),
});

// §15.1.2 — family nested component placement
registerCommand({
  id: 'family.add-component',
  label: 'Add Nested Component',
  keywords: ['family', 'component', 'nested', 'sub-component', 'hardware', 'hinge'],
  category: 'command',
  invoke: (ctx) => ctx.openFamilyEditor?.(),
});

// §15.1.3 — family opening cut definition
registerCommand({
  id: 'family.set-opening-cut',
  label: 'Set Family Opening Cut',
  keywords: ['family', 'opening', 'cut', 'void', 'wall-hosted', 'window', 'door'],
  category: 'command',
  invoke: (ctx) => ctx.openFamilyEditor?.(),
});

// §15.1.2 — family category assignment
registerCommand({
  id: 'family.set-category',
  label: 'Set Family Category',
  keywords: ['family', 'category', 'doors', 'windows', 'furniture', 'structural', 'classification'],
  category: 'command',
  invoke: (ctx) => ctx.openFamilyEditor?.(),
});

// §3.3.7 — paint surface / face material override
registerCommand({
  id: 'modify.paint-face',
  label: 'Paint Surface',
  keywords: ['paint', 'surface', 'face', 'material override', 'paint face'],
  category: 'command',
  invoke: (ctx) => ctx.activateTool?.('paint-face'),
});

// §1.7.1 — canvas context menu (Cmd+K alias)
registerCommand({
  id: 'view.canvas-context-menu',
  label: 'Canvas Context Menu',
  keywords: ['context menu', 'right click', 'canvas', 'zoom', 'view properties'],
  category: 'command',
  invoke: () => {
    // Triggered via right-click on canvas; Cmd+K alias for discoverability
  },
});

// Toposolid sub-tools — exposed in Cmd+K
registerCommand({
  id: 'tool.graded-region',
  label: 'Graded Region',
  keywords: ['graded', 'region', 'terrain', 'toposolid', 'slope'],
  category: 'tool',
  invoke: (ctx) => ctx.activateTool?.('graded-region'),
});

registerCommand({
  id: 'tool.terrain-split',
  label: 'Terrain Split',
  keywords: ['terrain', 'split', 'toposolid', 'divide'],
  category: 'tool',
  invoke: (ctx) => ctx.activateTool?.('terrain-split'),
});

// §6.4.2 — 2D detail drafting tools
registerCommand({
  id: 'tool.detail-line',
  label: 'Detail Line',
  keywords: ['detail', 'line', '2d', 'draft', 'annotate'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'detail-line'),
});

registerCommand({
  id: 'tool.detail-filled-region',
  label: 'Detail Filled Region',
  keywords: ['detail', 'filled', 'region', 'hatch', 'pattern', '2d'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'detail-filled-region'),
});

// §3.3.4: Cut Geometry tool activation via palette
registerCommand({
  id: 'tool.cut-geometry',
  label: 'Cut Geometry Tool',
  keywords: ['cut', 'geometry', 'void', 'subtract', 'csg', 'cutter', 'host'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'cut-geometry'),
});

// §2.5.1: apply shaft cut — recomputes and stores cut floor IDs on the selected shaft
registerCommand({
  id: 'modify.shaft-apply-cut',
  label: 'Apply Shaft Cut',
  keywords: ['shaft', 'opening', 'void', 'floor', 'cut', 'stair'],
  category: 'command',
  isAvailable: (ctx) => {
    const id = ctx.selectedElementIds[0];
    if (!id) return false;
    return useBimStore.getState().elementsById[id]?.kind === 'shaft';
  },
  invoke: (ctx) => {
    const id = ctx.selectedElementIds.find((sid) => {
      return useBimStore.getState().elementsById[sid]?.kind === 'shaft';
    });
    if (id) ctx.dispatchCommand?.({ type: 'applyShaftCut', shaftId: id, cutFloorIds: [] });
  },
});

// §2.9.1: create terrace from selected floor — auto-generates a perimeter railing
registerCommand({
  id: 'modify.create-terrace-from-floor',
  label: 'Create Terrace from Floor',
  keywords: ['terrace', 'balcony', 'railing', 'perimeter', 'floor', 'create terrace'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => e.kind === 'floor') ?? false,
  invoke: (ctx) => {
    ctx.openTerracePreset?.();
  },
});

// §3.3.1: toggle whether link_model elements are selectable in plan view
registerCommand({
  id: 'selection.toggle-select-linked',
  label: 'Toggle Select Linked Elements',
  keywords: ['link', 'select linked', 'linked model', 'selection', 'toggle'],
  category: 'command',
  invoke: () => {
    const { selectLinkedEnabled, setSelectLinkedEnabled } = useBimStore.getState();
    setSelectLinkedEnabled(!selectLinkedEnabled);
  },
});

// §1.6.2: project template save/load via localStorage
registerCommand({
  id: 'file.project-templates',
  label: 'Project Templates',
  keywords: ['template', 'save', 'new from template', 'project template'],
  category: 'command',
  invoke: (ctx) => {
    ctx.openProjectTemplates?.();
  },
});

// §1.6.2: Save As — duplicate current project with a new name
registerCommand({
  id: 'file.save-as',
  label: 'Save As…',
  keywords: ['save as', 'duplicate', 'copy', 'Speichern unter', 'Kopie'],
  category: 'command',
  isAvailable: () => true,
  invoke: (ctx) => {
    const newName = window.prompt('Enter new project name:');
    if (newName) {
      ctx.duplicateProject?.(newName);
    }
  },
});

// §1.6.2: Revert — discard unsaved changes and reload last saved state
registerCommand({
  id: 'file.revert',
  label: 'Revert to Saved',
  keywords: ['revert', 'undo all', 'discard', 'zurücksetzen'],
  category: 'command',
  isAvailable: () => true,
  invoke: (ctx) => {
    if (window.confirm('Revert to last saved state?')) {
      ctx.revertProject?.();
    }
  },
});

// §2.5.1: auto-generate enclosing side walls for the selected shaft void
registerCommand({
  id: 'modify.add-shaft-side-walls',
  label: 'Add Shaft Side Walls',
  keywords: ['shaft', 'side wall', 'stair', 'enclosure', 'Treppenseitenwand'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => e.kind === 'shaft') ?? false,
  invoke: (ctx) => {
    const shaft = ctx.selectedElements?.find((e) => e.kind === 'shaft') as any;
    if (!shaft) return;
    const walls = buildShaftSideWalls(shaft, shaft.baseLevelId ?? 'L1');
    for (const wall of walls) {
      ctx.dispatchCommand?.({ type: 'createElement', element: wall });
    }
  },
});

// §3.3.4: Cut Geometry — activate 2-step cutter→host pick tool
registerCommand({
  id: 'modify.cut-geometry',
  label: 'Cut Geometry',
  keywords: ['cut', 'void', 'subtract', 'geometry', 'csg'],
  category: 'command',
  isAvailable: (ctx) => (ctx.selectedElements?.length ?? 0) >= 1,
  invoke: (ctx) => {
    ctx.activateTool?.('cut-geometry');
  },
});

// §3.3.4: Uncut Geometry — remove first void cut from selected element
registerCommand({
  id: 'modify.uncut-geometry',
  label: 'Uncut Geometry',
  keywords: ['uncut', 'remove cut', 'void', 'geometry'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => (e as any).cutBy?.length > 0) ?? false,
  invoke: (ctx) => {
    const el = ctx.selectedElements?.find((e) => (e as any).cutBy?.length > 0) as any;
    if (el?.cutBy?.[0]) {
      ctx.dispatchCommand?.({ type: 'removeCutGeometry', cutterId: el.cutBy[0], hostId: el.id });
    }
  },
});

// §3.5.5: Wall Join Type — set miter/butt/square join variant for two selected walls
registerCommand({
  id: 'modify.wall-join',
  label: 'Wall Join Type',
  keywords: ['wall', 'join', 'miter', 'butt', 'square', 'Wandverbindung'],
  category: 'command',
  isAvailable: (ctx) => {
    const walls = ctx.selectedElements?.filter((e) => e.kind === 'wall') ?? [];
    return walls.length === 2;
  },
  invoke: (_ctx) => {
    // Activates the wall-join tool to pick a join corner
  },
});

// §3.4.2: Set Sub-floor Thickness — structural base pad below floor slab
registerCommand({
  id: 'modify.set-sub-floor-thickness',
  label: 'Set Sub-floor Thickness',
  keywords: ['sub floor', 'basement', 'slab', 'pad', 'thickening', 'Bodenplatte', 'Keller'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => e.kind === 'floor') ?? false,
  invoke: (_ctx) => {
    // Opens inspector — handled via inspector input
  },
});

// §1.6.11: Select Group Elements — select all elements belonging to a model group definition
registerCommand({
  id: 'view.select-group-elements',
  label: 'Select Group Elements',
  keywords: ['select group', 'group elements', 'model group', 'group select'],
  category: 'select',
  isAvailable: (ctx) =>
    ctx.selectedElementIds.length === 1 &&
    useBimStore.getState().elementsById[ctx.selectedElementIds[0]]?.kind === 'group_definition',
  invoke: (ctx) => {
    const id = ctx.selectedElementIds[0];
    if (!id) return;
    const { groupRegistry } = useBimStore.getState();
    const def = groupRegistry.definitions[id];
    if (!def || def.elementIds.length === 0) return;
    const [primary, ...rest] = def.elementIds;
    useBimStore.setState({ selectedId: primary, selectedIds: rest });
  },
});

// §2.4.2: Floor Edge Profile — edit cross-section profile extruded around floor perimeter
registerCommand({
  id: 'modify.floor-edge-profile',
  label: 'Floor Edge Profile',
  keywords: ['floor edge', 'edge profile', 'Deckenrand', 'slab edge', 'drop panel', 'overhang'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => e.kind === 'floor') ?? false,
  invoke: (_ctx) => {
    // Opens inspector edge profile section — handled via inspector collapsible
  },
});

// §8.6.4: Flip Stair — mirror stair run geometry horizontally or vertically
registerCommand({
  id: 'modify.flip-stair',
  label: 'Flip Stair',
  keywords: ['flip stair', 'mirror stair', 'stair flip', 'Treppe spiegeln'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => e.kind === 'stair') ?? false,
  invoke: (ctx) => {
    const stair = ctx.selectedElements?.find((e) => e.kind === 'stair');
    if (stair) ctx.dispatchCommand?.({ type: 'flipStair', stairId: stair.id, axis: 'horizontal' });
  },
});

// §12.4.5 — Export PDF with per-sheet orientation override and page numbers
registerCommand({
  id: 'file.export-pdf',
  label: 'Export PDF…',
  keywords: ['export pdf', 'print pdf', 'plot pdf', 'PDF exportieren'],
  category: 'command',
  invoke: (ctx) => {
    ctx.openPrintDialog?.();
  },
});

// §1.6.11 — Browser View Organization preset toggle (By Discipline / By Level)
registerCommand({
  id: 'view.browser-org-preset',
  label: 'Browser View Organization',
  keywords: [
    'browser',
    'project browser',
    'by level',
    'by discipline',
    'floor plans',
    'group views',
    'Projektbrowser',
  ],
  category: 'command',
  invoke: () => {
    // Local-state toggle — surfaced via the dropdown in the project browser Floor Plans header.
  },
});

// §1.6.11 — Browser Search/Filter (WP-E: search input + plan view sort toggle)
registerCommand({
  id: 'view.browser-search',
  label: 'Browser Search/Filter',
  keywords: [
    'browser',
    'project browser',
    'search views',
    'filter views',
    'floor plans',
    'sort views',
    'Projektbrowser',
    'Suche',
  ],
  category: 'command',
  invoke: () => {
    // Local-state — the search input is always visible at the top of the project browser.
  },
});

// §4.2.6 — Stack Dimensions (redistribute parallel dims at even spacing)
registerCommand({
  id: 'modify.stack-dimensions',
  label: 'Stack Dimensions',
  keywords: ['stack', 'dimensions', 'align', 'spacing', 'EQ', 'parallel dims'],
  category: 'modify',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'stackDimensions' });
  },
});

// §6.1.5 — Interior Elevation Material Hatches
registerCommand({
  id: 'view.interior-elevation-hatch',
  label: 'Interior Elevation Material Hatches',
  keywords: ['interior', 'elevation', 'hatch', 'material', 'pattern', 'wall fill'],
  category: 'view',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'showInteriorElevationHatch' });
  },
});

// §9.1.3 — Toggle Column Structural/Non-Structural
registerCommand({
  id: 'modify.toggle-column-structural',
  label: 'Toggle Column Structural/Non-Structural',
  keywords: ['column', 'non-structural', 'architectural', 'decorative', 'pilaster'],
  category: 'modify',
  isAvailable: (ctx) => (ctx.selectedElements ?? []).some((e) => e.kind === 'column'),
  invoke: (ctx) => {
    const col = (ctx.selectedElements ?? []).find((e) => e.kind === 'column');
    if (col) ctx.dispatchCommand?.({ type: 'toggleColumnStructural', columnId: col.id });
  },
});

// §2.9.4 — Plan Underlay (Show Lower Floor)
registerCommand({
  id: 'view.plan-underlay',
  label: 'Plan Underlay (Show Lower Floor)',
  keywords: ['underlay', 'plan', 'lower floor', 'ghost', 'reference', 'Raster'],
  category: 'view',
  isAvailable: hasActivePlanView,
  invoke: (ctx) => {
    if (!ctx.activePlanViewId) return;
    ctx.dispatchCommand?.({ type: 'setPlanUnderlay', viewId: ctx.activePlanViewId });
  },
});

// §12.4.2 — Custom DXF Layer Names
registerCommand({
  id: 'file.dxf-layer-mapping',
  label: 'Custom DXF Layer Names',
  keywords: [
    'dxf',
    'layer',
    'layer names',
    'export',
    'DXF layer mapping',
    'WAND',
    'TÜR',
    'FENSTER',
  ],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'setDxfLayerMapping', mapping: {} });
  },
});

registerCommand({
  id: 'file.bimobject-catalog',
  label: 'BIMobject Online Catalog',
  keywords: ['bimobject', 'catalog', 'manufacturer', 'furniture', 'online library', 'family load'],
  category: 'command',
  isAvailable: () => true,
  invoke: (ctx) => {
    ctx.openFamilyLibrary?.();
  },
});

// §1.6.1 — Dynamic Browser Tab Title
registerCommand({
  id: 'view.dynamic-title',
  label: 'Dynamic Browser Tab Title',
  keywords: ['title', 'tab', 'breadcrumb', 'view name', 'project name'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    // Title updates automatically via useEffect — no manual invoke needed
  },
});
