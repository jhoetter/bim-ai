import { useBimStore, type PlanTool } from '../state/store';
import { VIEWER_CATEGORY_KEYS } from '../viewport/sceneUtils';
import { elevationFromWall, sectionCutFromWall } from '../lib/sectionElevationFromWall';
import { buildBoundaryWallPlan, type BoundaryWallSource } from '../geometry/boundaryWallGeneration';
import { roofParamsFromWallLoop } from '../plan/roofByFootprint';
import i18n from '../i18n';
import { registerCommand, type PaletteContext } from './registry';

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
  id: 'tool.ramp',
  label: 'Ramp',
  keywords: ['ramp', 'sloped ramp', 'accessibility ramp'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'ramp'),
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
  id: 'project.manage-links',
  label: 'Manage Project Links',
  keywords: ['project', 'links', 'ifc', 'dxf', 'external', 'resources'],
  category: 'command',
  invoke: (ctx) => ctx.openManageLinks?.(),
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
