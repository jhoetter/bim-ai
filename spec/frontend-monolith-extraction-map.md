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
- `viewport/overlays/*`: HUD, view cube, labels, sun/shadow controls, and
  transient authoring overlays.
