# Frontend Monolith Extraction Map

Last updated: 2026-05-20

Scope: CQ-2026-04. This map defines the ownership direction for the current
high-churn frontend files so extraction work can continue in small, testable
slices without creating circular dependencies back into the original files.

Related non-frontend god-file slices are tracked directly in
`spec/code-quality-tracker.md`.

## PlanCanvas.tsx

Current role: plan-view orchestration, camera math, pointer and keyboard input,
snapping, draft previews, command dispatch, selection, and rendering assembly.

Target modules:

- `plan/planCanvasHelpers.tsx`: token lookup, placement preview glyphs, draft
  shape typing, and small plan formatting helpers.
- `plan/PlanCanvasToolOverlays.tsx`: transient tool chips, guide SVGs, numeric
  input, snap override, and scale instruction overlays.
- `plan/PlanCanvasStatusOverlays.tsx`: pinned-element glyphs, loop-mode cursor
  chip, boundary validation banner, and component placement preview wrapper.
- `plan/PlanCanvasWorkflowOverlays.tsx`: measure readouts, multi-selection
  status chip, and selection filter controls.
- `plan/PlanCanvasAuthoringOverlays.tsx`: reveal-hidden chip, annotation text
  entry, cut-plane dialog, and subdivision palette wrapper.
- `plan/PlanCanvasRoomColorLegend.tsx`: room-scheme legend rows.
- `plan/PlanCanvasWallDraftOverlays.tsx`: wall coordinate HUD, pick-line
  preview, placement HUD, draft notice, and snap label.
- `plan/PlanCanvasContextOverlays.tsx`: plan wall/canvas/element context menus,
  reveal-hidden actions, imported-CAD query overlays, and wall-join menu.
- `plan/PlanCanvasViewControls.tsx`: thin-lines, constraints, underlay, and
  active work-plane view controls.
- `plan/PlanCanvasSketchOverlay.tsx`: sketch-authoring overlay wiring and
  pick-wall projection props.
- `plan/PlanCanvasEmptyStateOverlay.tsx`: empty level message.
- `plan/planCanvasViewState.ts`: derived plan-view control/readout state.
- `plan/planCanvasColorSchemeState.ts`: room list and color scheme legend state.
- `plan/planCanvasComponentPreview.ts`: component asset preview lookup.
- `plan/planCanvasSelectionState.ts`: selected element, grip, and temporary
  dimension derivation.
- `plan/usePlanProjectionWireSync.ts`: server plan-projection wire fetch/reset
  synchronization.
- `plan/usePlanCanvasToolCleanupEffects.ts`: tool-exit cleanup effects for
  readouts, query state, wall hints, component ghost, and context menus.
- `plan/usePlanCanvasCameraControls.ts`: camera resize, fit-to-view, UI scale,
  world-mm to screen-px projection, and external camera snapshot handle wiring.
- `plan/usePlanCanvasSceneLifecycle.ts`: Three renderer, scene, camera, sketch
  coordinate mapping, resize observer, and render loop lifecycle.
- `plan/planCanvasRenderPasses.ts`: self-contained render passes for
  neighborhood masses, drafting grid, DXF underlays, masking regions,
  plan-region outlines, area-plan overlays, detail components, and placed tags.
- `plan/interaction/planCameraMath.ts`: plan slice constants, scale bounds,
  orthographic grid/snap spacing, and pointer ray projection.
- `plan/selection/nearestWall.ts`: wall hit projection and level-scoped wall
  selection helpers.
- `plan/interaction/keyboardShortcuts.ts`: keyboard dispatch table for drawing,
  snapping, selection, and view navigation.
- `plan/interaction/pointerGestureState.ts`: drag, pan, marquee, grip, and
  edit-mode gesture state transitions.
- `plan/tools/planToolState.ts`: active tool lifecycle, nullable UI state, and
  tool reset policy.
- `plan/selection/planSelectionController.ts`: click, box, linked-model, and
  crop-region selection behavior.

First landed slices:

- `plan/interaction/planCameraMath.ts`
- `plan/selection/nearestWall.ts`
- `plan/interaction/snapOverrideShortcuts.ts`
- `plan/planCanvasHelpers.tsx`
- `plan/componentGhost.ts`
- `plan/marqueeSelectionPreview.ts`
- `plan/planTextSprites.ts`
- `plan/PlanCanvasReadouts.tsx`
- `plan/PlanCanvasToolOverlays.tsx`
- `plan/PlanCanvasStatusOverlays.tsx`
- `plan/PlanCanvasWorkflowOverlays.tsx`
- `plan/PlanCanvasAuthoringOverlays.tsx`
- `plan/PlanCanvasRoomColorLegend.tsx`
- `plan/PlanCanvasWallDraftOverlays.tsx`
- `plan/PlanCanvasContextOverlays.tsx`
- `plan/PlanCanvasViewControls.tsx`
- `plan/PlanCanvasSketchOverlay.tsx`
- `plan/PlanCanvasEmptyStateOverlay.tsx`
- `plan/planCanvasViewState.ts`
- `plan/planCanvasColorSchemeState.ts`
- `plan/planCanvasComponentPreview.ts`
- `plan/planCanvasSelectionState.ts`
- `plan/usePlanProjectionWireSync.ts`
- `plan/usePlanCanvasToolCleanupEffects.ts`
- `plan/usePlanCanvasCameraControls.ts`
- `plan/usePlanCanvasSceneLifecycle.ts`
- `plan/planCanvasRenderPasses.ts`

## InspectorContent.tsx

Current role: element-kind switchboard, material assignment UI, type editors,
per-family property rows, graphics controls, constraints, identity, pinning, and
view-specific editors.

Target modules:

- `workspace/inspector/materialInspectorSections.tsx`: material labels,
  material slot rows, face overrides, and type-derived material helpers.
- `workspace/inspector/renderers/wallInspector.tsx`: wall identity, constraints,
  wall parts, profile, joins, and host material rows.
- `workspace/inspector/renderers/floorRoofCeilingInspector.tsx`: boundary edit,
  layer, slope, attachment, and type material rows.
- `workspace/inspector/renderers/familyInstanceInspector.tsx`: hosted family,
  nested family, custom family, and material-slot editing.
- `workspace/inspector/renderers/documentationInspector.tsx`: text, tags,
  dimensions, sheets, views, and view templates.
- `workspace/inspector/detailDocumentationInspectorSections.tsx`: detail line,
  filled region, and detail arc documentation rows.
- `workspace/inspector/decalInspectorSection.tsx`: decal preview and property
  rows.
- `workspace/inspector/projectBasePointInspectorSection.tsx`: project base point
  position and shared-coordinate rows.
- `workspace/inspector/siteTerrainInspectorSections.tsx`: toposolid, graded
  region, excavation, and terrain pad site rows.
- `workspace/inspector/annotationTagInspectorSections.tsx`: placed tag, room
  tag, and material tag rows.
- `workspace/inspector/spotAnnotationInspectorSections.tsx`: spot elevation,
  coordinate, slope, and slope annotation rows.
- `workspace/inspector/interiorElevationMarkerInspectorSection.tsx`: interior
  elevation marker level, radius, and quadrant rows.
- `workspace/inspector/modelingActionInspectorSections.tsx`: mass generation
  actions and detail group edit rows.
- `workspace/inspector/viewReferenceInspectorSections.tsx`: viewpoint,
  elevation view, and callout read-only rows.
- `workspace/inspector/projectSettingsInspectorSection.tsx`: project settings
  and plan region property editors.
- `workspace/inspector/mepInspectorSections.tsx`: duct, pipe, cable tray,
  equipment, fixture, terminal, and opening request rows.
- `workspace/inspector/inspectorRows.tsx`: shared inspector field rows and
  formatting helpers.
- `workspace/inspector/inspectorRendererRegistry.ts`: `Element.kind` to
  renderer mapping with a typed fallback.

First landed slice:

- `workspace/inspector/materialInspectorSections.tsx`
- `workspace/inspector/stairAssemblyInspector.tsx`
- `workspace/inspector/shaftInspectorSections.tsx`
- `workspace/inspector/familyInspectorSections.tsx`
- `workspace/inspector/inspectorRows.tsx`
- `workspace/inspector/mepInspectorSections.tsx`
- `workspace/inspector/linkInspectorSections.tsx`
- `workspace/inspector/detailDocumentationInspectorSections.tsx`
- `workspace/inspector/decalInspectorSection.tsx`
- `workspace/inspector/projectBasePointInspectorSection.tsx`
- `workspace/inspector/siteTerrainInspectorSections.tsx`
- `workspace/inspector/annotationTagInspectorSections.tsx`
- `workspace/inspector/spotAnnotationInspectorSections.tsx`
- `workspace/inspector/interiorElevationMarkerInspectorSection.tsx`
- `workspace/inspector/modelingActionInspectorSections.tsx`
- `workspace/inspector/viewReferenceInspectorSections.tsx`
- `workspace/inspector/projectSettingsInspectorSection.tsx`

## Workspace.tsx

Current role: app shell composition, project/resource dialogs, command routing,
workspace hydration, pane layouts, tab persistence, inspector/browser
coordination, and modal ownership.

Target modules:

- `workspace/controllers/workspaceCommandRouter.ts`: command palette, ribbon,
  semantic commands, and global shortcut routing.
- `workspace/controllers/workspaceDialogController.ts`: modal ownership and
  open/close state for project/resource/workflow dialogs.
- `workspace/controllers/splitPaneController.ts`: split composition
  normalization, pane focus, drop targets, and tab placement.
- `workspace/compositions.tsx`: persisted composition state, tab instance
  helpers, lens updates, and the composition tab bar.
- `workspace/controllers/workspaceHydration.ts`: bootstrap, project switching,
  persisted layout restoration, and store hydration.
- `workspace/controllers/selectionBridge.ts`: selected element, inspector, and
  pane-browser synchronization.

First landed slice:

- `workspace/compositions.tsx`
- `workspace/WorkspaceOverlays.tsx`
- `workspace/WorkspaceAppShellSlots.tsx`

## Viewport.tsx

Current role: Three.js scene lifecycle, mesh orchestration, camera controls,
selection and picking, overlays, render policy, HUDs, and authoring handoff.

Target modules:

- `viewport/scene/useViewportScene.ts`: renderer, scene, camera, lights,
  lifecycle, and disposal.
- `viewport/scene/useViewportMeshes.ts`: element-to-mesh orchestration, material
  invalidation, and pick IDs.
- `viewport/interaction/useViewportPicking.ts`: raycasting, selection, context
  menus, and grip hit testing.
- `viewport/interaction/useViewportControls.ts`: orbit, walk, saved camera, and
  clipping interactions.
- `viewport/renderPolicy.ts`: detail level, visibility, temporary overrides,
  section box, and render-quality decisions.
- `viewport/ViewportRuntimeHelpers.ts`: storage-backed viewer defaults,
  render-role tagging, section-box handles, disposal, and CSG wall helpers.
- `viewport/overlays/*`: HUD, view cube, labels, sun/shadow controls, and
  transient authoring overlays.

First landed slice:

- `viewport/ViewportOverlays.tsx`
- `viewport/ViewportRuntimeHelpers.ts`

## FamilyEditorWorkbench.tsx

Current role: family editor shell, template/category state, reference planes,
parameter/type state, symbolic-line authoring, sweep/array authoring, preview
visibility, material assignment, nested family loading, and persistence handoff.

Target modules:

- `familyEditor/FamilyEditorWorkbenchPanels.tsx`: self-contained dialogs and
  authoring panels that are driven entirely by props.
- `familyEditor/familyEditorTypes.ts`: shared workbench-specific type aliases
  once a second extraction needs to share more state shapes.
- `familyEditor/familyEditorSymbolicLines.ts`: symbolic-line canvas helpers,
  alignment, mirroring, and object-style mapping.
- `familyEditor/familyEditorSweepState.ts`: sweep draft lifecycle and profile
  editing callbacks.
- `familyEditor/familyEditorPersistenceState.ts`: template loading, catalog
  document hydration, family type reset, and load-into-project handoff.

First landed slice:

- `familyEditor/FamilyEditorWorkbenchPanels.tsx`
