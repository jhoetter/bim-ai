import { useBimStore, type PlanTool } from '../state/store';
import { VIEWER_CATEGORY_KEYS } from '../viewport/sceneUtils';
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
  invoke: (ctx) => startPlanTool(ctx, 'door'),
});

registerCommand({
  id: 'tool.window',
  label: 'Place Window',
  keywords: ['window', 'opening'],
  category: 'command',
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
  id: 'tool.room',
  label: 'Place Room',
  shortcut: 'R',
  keywords: ['room', 'space'],
  category: 'command',
  invoke: (ctx) => startPlanTool(ctx, 'room'),
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
  id: 'navigate.agent',
  label: 'Go to Agent Review',
  keywords: ['agent', 'review', 'issues'],
  category: 'navigate',
  invoke: (ctx) => ctx.navigateMode?.('agent'),
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
  id: 'project.open-menu',
  label: 'Open Project Menu',
  keywords: ['project', 'files', 'snapshot', 'open'],
  category: 'command',
  invoke: (ctx) => ctx.openProjectMenu?.(),
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
