# UX Masterclass: Editor Reachability, View Semantics, and Command Clarity

Last audited: 2026-05-11

This document audits the current editor UX from first principles: what the user sees, what each surface actually controls, where the active view matters, where commands are reachable but not executable, and how to track the whole product until every feature is reachable, explainable, and usable in the correct context.

The goal is not to make BIM AI simpler by removing power. The goal is to make the editor steep but clear: a user should very quickly learn "where am I, what can I do here, what will this button affect, and where do I go next?"

## Executive Summary

The editor is already feature-rich, but the UX model is currently inconsistent because it has multiple competing command surfaces with different sources of truth:

1. The top bar and ribbon expose tools globally, even when the active canvas cannot execute them.
2. The floating tool palette is view-aware, but it is also filtered by "perspective" in a way that hides or reveals tools differently from the ribbon.
3. The command palette is not tied to the active tab/view. Some "Go to" commands only update `viewerMode`, while the rendered canvas is controlled by active tabs and `mode`.
4. The 3D viewport has partial editing affordances, but pure 3D mode does not receive `onSemanticCommand`, so 3D grips and wall-face commands cannot commit changes from that mode.
5. Visibility controls are split between plan VG, 3D layer toggles, lens filters, hidden/reveal state, and saved-view hidden categories. The 3D layer panel only exposes a subset of renderable categories, so "hide all" does not hide all visible geometry.

Current usability score: **3/10**.

Target usability score: **9/10**.

The path to 9/10 is to define a canonical View Capability Graph and make every UI surface query it before showing, enabling, or invoking any command.

## Source Evidence

Primary files audited:

- `packages/web/src/workspace/Workspace.tsx`: editor composition root, hotkeys, active tabs, command palette context, tool/ribbon wiring.
- `packages/web/src/workspace/shell/AppShell.tsx`: global layout and global options/modifier bars.
- `packages/web/src/workspace/shell/TopBar.tsx`: tabs, quick access toolbar, account/theme controls.
- `packages/web/src/workspace/shell/RibbonBar.tsx`: ribbon tabs and global command buttons.
- `packages/web/src/tools/toolRegistry.ts`: canonical floating palette tool definitions and mode availability.
- `packages/web/src/workspace/planToolsByPerspective.ts`: perspective filtering for visible plan tools.
- `packages/web/src/workspace/viewport/CanvasMount.tsx`: mode-to-canvas mount rules.
- `packages/web/src/Viewport.tsx`: 3D renderer, selection, grips, wall context menus, category visibility application.
- `packages/web/src/workspace/viewport/Viewport3DLayersPanel.tsx`: 3D view controls and category toggles.
- `packages/web/src/viewport/sceneUtils.ts`: 3D element-to-category visibility mapping.
- `packages/web/src/cmdPalette/*`: mounted Cmd+K implementation.
- `packages/web/src/cmd/*`: richer but currently unmounted command palette implementation.
- `packages/web/src/workspace/WorkspaceRightRail.tsx`: inspector, authoring workbenches, 3D controls.
- `packages/web/src/workspace/WorkspaceLeftRail.tsx`: browser navigation and view activation.
- `packages/web/src/workspace/project/VVDialog.tsx`: plan Visibility/Graphics dialog.
- `packages/web/src/workspace/tabsModel.ts`: tab model and view-target mapping.

## First Principles Model

The editor must answer four questions at all times:

1. **Where am I?**
   - Active tab kind: plan, 3D, plan+3D, section, sheet, schedule, agent.
   - Active target: level, plan view, viewpoint, section cut, sheet, schedule.
   - Active discipline/perspective: architecture, structure, MEP, coordination, construction, agent.
   - Active selection: none, model element, type element, view element, sheet viewport, schedule row, review issue.

2. **What can I do here?**
   - Drawing tools in model-authoring views.
   - View/camera/display controls in 3D views.
   - Documentation placement/editing in sheet views.
   - Row navigation, sorting, filters, schedule definition in schedule views.
   - Review/fix commands in agent views.
   - Universal commands in every view: open/go to, search, switch theme, save snapshot, undo/redo where meaningful, help, open project/browser panels.

3. **What will this affect?**
   - Current plan view vs entire model.
   - Active 3D viewpoint vs runtime 3D viewport.
   - Selected instance vs selected type.
   - Current sheet viewport vs source view.
   - Temporary visibility vs persisted view graphics.

4. **How do I recover?**
   - Disabled commands must explain why and offer the nearest valid route.
   - Dead commands must be eliminated.
   - Context switches must be explicit when a command moves the user to another view.
   - Cmd+K must always provide a route to the feature.

## Current UX Surface Inventory

### App Shell

Implemented by `AppShell`.

Zones:

- Top bar.
- Ribbon bar.
- Tool modifier bar.
- Options bar.
- Left rail/project browser.
- Canvas.
- Right rail/inspector.
- Status bar.

Issue: `ToolModifierBar` and `OptionsBar` are rendered globally under the ribbon, independent of active mode. A ribbon or QAT command can set a plan tool while the canvas is 3D, sheet, schedule, or agent. The plan tool options then appear even though the active canvas cannot execute the tool.

Decision:

- Options and modifiers must belong to the active canvas capability, not just to `planTool`.
- In non-plan contexts, plan tool options should either not render or render as "Open in Plan to use Wall" with a single action.

### Top Bar

Implemented by `TopBar`.

Current contents:

- Hamburger.
- Logo.
- Project menu.
- Undo.
- Redo.
- Quick access toolbar: Section, Measure, Aligned Dimension, Tag by Category, Thin Lines, Close Inactive Views, customize.
- View tabs.
- Share.
- Cmd+K trigger.
- Collaborators/comments.
- Avatar/account menu with theme and language.

Findings:

- Undo is disabled by `undoDepth`, but Redo is never disabled because there is no redo depth.
- QAT Section, Measure, Dimension, and Tag set `planTool` directly when callbacks are not passed. Workspace does not pass explicit callbacks for these tools. They do not switch to a valid plan canvas, do not explain unavailable contexts, and can create "active tool but no usable canvas."
- Thin Lines falls back to `useBimStore.getState().toggleThinLines()`, but `Workspace` does not pass `thinLinesEnabled` into `TopBar`. The button state can therefore display as unpressed even after toggling.
- Close Inactive Views works when tabs exist, but there is also a duplicated close-inactive action inside the tab strip.
- Theme switching exists only in the avatar menu, not in the mounted command palette.

Classification:

- Universal and valid: project menu, Cmd+K trigger, avatar menu, language, theme via avatar.
- Contextual but currently global: Section, Measure, Dimension, Tag, Thin Lines.
- Partially dead/confusing: Redo, QAT plan tools in 3D/sheet/schedule/agent, Thin Lines state reflection.

### View Tabs

Implemented by `TopBarTabs` and `tabsModel`.

Tab kinds:

- `plan`
- `3d`
- `plan-3d`
- `section`
- `sheet`
- `schedule`
- `agent`

Strengths:

- Tabs are the best current model for "where am I?"
- Target-bound tabs use stable ids like `3d:<viewpointId>` and `plan:<planViewId>`.
- Opening an element from the project browser generally activates the correct tab and mode.

Issues:

- Some navigation paths only open a tab and do not run the same side effects as the project browser. For example Cmd+K dynamic view entries call `openElementById`, which only calls `openTabFromElement`. It does not activate plan views, set active viewpoint id, apply viewpoint camera/preset, or select the navigated item.
- Direct Cmd+K commands like "Go to 3D view" set `viewerMode` only. The canvas is primarily controlled by `effectiveMode` from active tab/mode, so these commands can appear to do nothing.

Decision:

- All navigation must go through one `navigateToTarget(target)` function that updates tab, mode, active plan/viewpoint ids, camera/preset, selection, and any active view state in a single transaction.

### Ribbon

Implemented by `RibbonBar`.

Ribbon tabs:

- Architecture.
- Structure.
- Steel.
- Precast.
- Systems.
- Insert.
- Annotate.
- Analyze.
- Massing & Site.
- Collaborate.
- View.
- Manage.
- Add-Ins.
- Contextual Modify when an element is selected.

Current behavior:

- Tool commands call `onToolSelect`, which maps to `setPlanTool`.
- Mode commands call `onModeChange`.
- Action commands open Cmd+K, VV/VG, family library, project menu, or settings/cheatsheet.

Major issue:

- The ribbon is not context-aware. It exposes Wall, Door, Window, Floor, Roof, Stair, Grid, Dimension, Tag, Modify commands even in pure 3D, sheet, schedule, and agent contexts. Those commands set plan tool state, but the active canvas often cannot handle the tool.

Dead-button examples:

- Architecture > Wall in pure 3D: sets `planTool='wall'`; 3D viewport does not use wall drawing state.
- Annotate > Dimension in pure 3D: sets dimension tool; no 3D dimension workflow exists.
- View > VV/VG in 3D: opens plan-focused `VVDialog`, usually tied to `activePlanViewId`, while the 3D controls live in the right rail.
- Modify > Move/Copy/Rotate in 3D: exposed when selected but implemented as plan tools.
- Steel/Precast/System commands like Connections, Steel Settings, Assemblies, Systems Cmd are command-palette/settings aliases, not complete domain tools.

Decision:

- Ribbon commands must use the same capability graph as Cmd+K and the floating palette.
- Commands that are not valid in the current view must be either hidden, disabled with a reason, or converted into "Switch to Plan and start Wall."
- Ribbon labels should not imply complete domain modules where the underlying implementation is only a placeholder to Cmd+K/settings.

### Floating Tool Palette

Implemented by `FloatingPalette` and `ToolPalette`.

Current behavior:

- Hidden in sheet, schedule, and agent.
- Rendered in plan, 3D, plan+3D, and section.
- Tool availability comes from `toolRegistry.paletteForMode(mode)`.
- Then filtered by `allowedToolIds` from `planToolsForPerspective(perspectiveId)`.

Strengths:

- It is closer to a view-aware tool surface than the ribbon.
- It has disabled reasons for some tools, such as floor/roof requiring walls.

Issues:

- Tool registry says `railing` is available in 3D, but perspective filtering removes it because `planToolsForPerspective` does not include `railing`. In pure 3D the floating palette effectively shows only Select.
- `planToolsForPerspective` is a legacy plan-tool list, not a general command capability map.
- Perspective filtering and mode filtering are separate, creating surprising combinations.
- The floating palette and ribbon disagree about what exists.

Decision:

- Replace `planToolsForPerspective` as a visibility source with a capability query: `(activeView, perspective, selection, modelState) -> command availability`.
- The floating palette should show primary authoring tools for the active canvas only.
- Secondary tools should be reachable through Cmd+K and the ribbon, but with the same availability rules.

### Tool Registry

Implemented by `toolRegistry`.

Current modes:

- Most creation tools are plan/plan+3D only.
- Select is all modes.
- Dimension is plan/plan+3D/section.
- Railing is plan/plan+3D/3D.
- Section is plan/plan+3D/section.
- Modify tools like move/copy/rotate are plan only.

Tool registry is currently the nearest thing to a capability list, but it is incomplete because:

- It only covers tools, not actions or navigation.
- It does not describe execution surface, preconditions, side effects, or fallback routes.
- It is not used by the ribbon or command palette as the single source of truth.
- It does not distinguish "show", "enable", "invoke", and "switch then invoke."

Decision:

- Evolve this into or generate from a `CommandCapabilityRegistry`.

### Options Bar and Modifier Bar

Implemented by `OptionsBar` and `ToolModifierBar`.

Options currently shown for:

- Wall: type, location line, offset, height, radius.
- Floor: type, boundary offset.
- Area boundary.
- Mirror.
- Copy.
- Move.
- Component.
- More through modifier descriptors.

Issues:

- They are global under the ribbon, so they can appear over non-plan canvases.
- They do not make clear whether the active options apply to the current view.
- They can make the user think a 3D wall tool is active because Wall options appear over the 3D canvas.

Decision:

- Options belong to the active tool execution surface.
- If active mode cannot execute the tool, show a compact context bridge: "Wall is a Plan tool. Switch to Plan" or "Use 3D wall-face Insert Door instead."

### Left Rail / Project Browser

Implemented by `WorkspaceLeftRail`, `LeftRail`, and `workspaceUtils`.

Current contents:

- Discipline selector.
- Plan style selector.
- Families button.
- Level stack.
- Project browser tree.
- Views, viewpoints, sections, sheets, schedules, families, types, evidence depending on model.

Strengths:

- Best current place for deterministic navigation.
- Activating rows often performs the correct view-specific side effects.
- Level creation and plan-view creation are direct and useful.

Issues:

- It mixes navigation, view organization, type libraries, family choosing, level editing, and evidence.
- It has better navigation behavior than Cmd+K, which means multiple routes to the same destination behave differently.
- Built-in family type rows can silently do nothing when no compatible element is selected.
- Plan style and discipline selectors live in left rail, while view display controls live in right rail or VV/VG. The mental model is split.

Decision:

- Project browser should remain the canonical browser, but navigation behavior must be extracted and reused by Cmd+K, inspector actions, schedule row "Open row", and sheet/source navigation.
- Family/type picking should visibly state whether it is setting an active placement type or changing a selected instance/type.

### Canvas Mounts

Implemented by `CanvasMount`.

Mode mapping:

- `plan`: `PlanCanvas`.
- `3d`: `Viewport`.
- `plan-3d`: split `PlanCanvas` and `Viewport`.
- `section`: `SectionModeShell`.
- `sheet`: `SheetModeShell`.
- `schedule`: `ScheduleModeShell`.
- `agent`: `AgentReviewModeShell`.

Critical finding:

- In `plan-3d`, `Viewport` receives `onSemanticCommand`.
- In pure `3d`, `Viewport` does **not** receive `onSemanticCommand`.

Impact:

- Pure 3D selection can work because it uses store selection.
- 3D grips can render, but grip commands early-return when `onSemanticCommand` is missing.
- 3D wall context menu/radial commands can appear but cannot commit commands in pure 3D.
- In plan+3D, those commands have a dispatch path.

This is the strongest code-level explanation for "3D renderer should allow working on walls, doors, etc., but it seemingly currently is not the case."

Decision:

- Always pass `onSemanticCommand` into `Viewport` in pure 3D.
- Then explicitly decide which 3D commands are supported:
  - Select model geometry.
  - Edit dimensions/properties through 3D grips.
  - Right-click wall face to insert door/window/opening.
  - Generate section/elevation from wall.
  - Move/rotate/copy via 3D gizmo only if implemented.
  - Wall creation in 3D only if there is a deliberate work-plane workflow.

### 2D Plan Canvas

Implemented by `PlanCanvas`.

The plan canvas has the richest active tool handling. It handles:

- Select.
- Query.
- Tag.
- Door.
- Window.
- Wall.
- Room rectangle.
- Grid.
- Measure.
- Dimension.
- Elevation.
- Reference plane.
- Property line.
- Area.
- Area boundary.
- Masking region.
- Plan region.
- Align.
- Mirror.
- Copy.
- Move.
- Rotate.
- Component.
- Split.
- Trim.
- Trim/extend.
- Wall join.
- Wall opening.
- Shaft.
- Column.
- Beam.
- Ceiling.
- Room.
- Toposolid subdivision.
- Sketch overlays for floor, roof, room separation, masking region.

This is the actual main authoring surface today.

Issue:

- Other chrome surfaces imply these workflows are available outside plan/plan+3D.

Decision:

- Present plan as the primary authoring surface until 3D authoring reaches parity.
- Make 3D authoring explicit and narrow: selection, hosted insertions, grips, camera/display.

### 3D Viewport

Implemented by `Viewport`.

Current 3D capabilities:

- Orbit/pan/zoom/walk navigation.
- View cube.
- Selection by raycast.
- Outline selection.
- Remote selection halos.
- Right-click wall context menu for section/elevation generation.
- Wall-face radial menu for Insert Door, Insert Window, Insert Opening.
- 3D grips via providers for selected elements.
- Section box and clipping.
- Camera projection.
- Render styles.
- Background, shadows, ambient occlusion, depth cue, exposure, edge display.
- Saved viewpoint persistence HUD.
- 3D category hiding.

Issues:

- Pure 3D mode misses `onSemanticCommand`.
- The floating palette does not advertise 3D editing affordances like "Insert hosted opening on wall face" or "Edit selected with grips."
- Plan tools set from the ribbon do not influence 3D pointer behavior.
- There is no "3D tool mode" distinct from plan tool mode.
- Right-click menus may look functional but silently fail if dispatch is missing.
- The 3D layers panel controls runtime viewer categories, not the plan VV/VG model.

Decision:

- Treat 3D as a real editing view, but define its supported operations separately from plan:
  - 3D Select.
  - 3D Insert Hosted Opening.
  - 3D Edit Grips.
  - 3D Move/Rotate with gizmo, only after implementation.
  - 3D Section/Elevation from face.
  - 3D View Controls.
- Add a 3D-specific action row when a wall is selected: Insert Door, Insert Window, Opening, Generate Section, Generate Elevation, Isolate, Hide Category.

### Right Rail / Inspector

Implemented by `WorkspaceRightRail`.

Current sections:

- Scene when no selection.
- Sun inspector.
- Active plan view editor when a plan view is active.
- Inspector tabs: properties, constraints, identity, graphics, evidence.
- Selection actions.
- Element-specific editors.
- Hide element/category in active plan view.
- 3D View Controls when in 3D or plan+3D.
- Authoring workbenches in plan/plan+3D or when selected element is non-navigable.
- Advisor panel.
- Activity readout.

Strengths:

- Rich and often useful.
- 3D controls are placed in the right rail when active.
- Type vs instance context banner is a good pattern.

Issues:

- Right rail auto-collapses when there is no selection and no 3D context. That hides plan view controls and authoring workbenches unless selected/contextual.
- It contains too many roles: properties, view controls, authoring workbenches, advisor, activity.
- In 3D, the inspector can show element properties while 3D controls are below. This is powerful but visually deep; the user may not discover the lower view controls.
- Plan "Hide Element in View" appears for selected elements whenever `activePlanViewId` exists, even if current canvas is not that plan.

Decision:

- Split right rail into contextual tabs/sections with stable labels:
  - Properties.
  - View.
  - Workbench.
  - Review.
- View controls should be first-class in 3D and reachable by Cmd+K.
- Plan-view-specific hide actions must include the target view name and require the active view to match, or be presented as "Hide in plan: <name>".

### Status Bar

Implemented by `StatusBar`.

Current contents:

- Active level selector.
- Current tool.
- Snap modes.
- Grid.
- Coordinates.
- Undo.
- Websocket state.
- Save state.
- Lens dropdown.
- Drift badge.
- Activity entry.

Issues:

- Level selector is always visible, even in 3D, sheet, schedule, and agent contexts.
- Current tool can show a plan tool in non-plan contexts.
- Coordinates are 2D plan cursor coordinates; they are not meaningful in 3D/sheet/schedule unless adapted.
- Grid toggle is shown but no `onGridToggle` is passed from `Workspace`.
- Snap cluster receives no snap modes by default, so it is mostly empty.

Decision:

- Status bar must be view-aware:
  - Plan: level, tool, snap, grid, coordinates, lens.
  - 3D: viewpoint/camera mode, projection, selected element, clipping, lens.
  - Sheet: sheet number, scale/viewport selection, paper size.
  - Schedule: schedule name, row count, selected row, filter/sort state.
  - Agent: review state and pending action count.

### Visibility / Graphics

There are several overlapping visibility systems:

1. Plan `VVDialog`: plan-view category overrides and filters.
2. Inspector hide element/category in active plan view.
3. 3D `Viewport3DLayersPanel`: runtime viewer category hidden map.
4. Saved viewpoint `hiddenSemanticKinds3d`.
5. Temporary visibility chip.
6. Reveal hidden mode.
7. Lens discipline filter.
8. Phase filter.

This is powerful, but the UX does not clearly separate:

- Current plan view visibility.
- Current 3D runtime visibility.
- Saved 3D viewpoint visibility.
- Temporary isolate/hide.
- Discipline lens ghosting.
- Phase filtering.

3D category hiding issue:

- `Viewport3DLayersPanel.VIEWER_HIDDEN_KIND_KEYS` exposes:
  - wall
  - floor
  - roof
  - stair
  - door
  - window
  - room
  - site_origin
- `elemViewerCategory` can also classify:
  - railing
  - site
  - balcony as floor
- Many rendered 3D elements are not classifiable by current 3D toggles:
  - column
  - beam
  - ceiling
  - placed_asset
  - family_instance
  - text_3d
  - sweep
  - dormer
  - mass
  - reference_plane
  - wall_opening has no mesh, but can affect wall CSG
  - internal generated geometry or linked ghosting may remain

Impact:

- If a user unchecks every visible 3D layer toggle, they can still see geometry. This is expected from the current code but violates the UI promise.

Decision:

- Rename current 3D layer section to "Common categories" until complete, or expand it to all rendered categories.
- Add "Hide all model geometry" and "Show all" commands.
- Add category counters: "Walls 12", "Loaded families 8", "Structural framing 6."
- The 3D visibility list must be generated from actual `elemViewerCategory` coverage and current model content.
- The plan VV/VG dialog must not be the default 3D visibility control.

## Command Palette Audit

Mounted implementation: `packages/web/src/cmdPalette`.

Retired implementation: the unused `packages/web/src/cmd/CommandPalette.tsx` path and its
private source/ranker were removed; `packages/web/src/cmd` now only hosts the keyboard shortcuts
modal and command-line parser utilities that have their own tests.

### What Works

- Cmd+K opens from global hotkey and top bar.
- Static commands exist for tools, render styles, reveal hidden, neighborhood masses, perspective changes.
- Dynamic view entries are injected from `paletteViews`.
- Recency ranking exists.
- Mounted prefix grammar exists: `>` filters tool commands, `@` filters view/navigation entries,
  and `:` filters settings/shell controls.

### Resolved Cmd+K Gaps

- Context now includes `activeViewId` from the active tab/view state.
- Tool commands use capability evaluation and bridge labels instead of blindly setting plan tools
  on invalid canvases.
- Navigation commands route through the workspace tab/mode controller.
- Theme, language, project menu, family library, keyboard shortcuts, active visibility controls,
  3D view controls, rail toggles, and inactive-tab close commands are mounted.
- Results are grouped by current capability context badges.
- Legacy prefix grammar has been merged into the mounted `cmdPalette` registry, and the unused
  `cmd/CommandPalette` implementation has been deleted.

### Required Cmd+K Behavior

Cmd+K must always include universal commands:

- Go to Plan.
- Go to 3D.
- Go to Plan + 3D.
- Go to Section.
- Go to Sheet.
- Go to Schedule.
- Go to Agent Review.
- Open any named plan, 3D view, section, sheet, or schedule.
- Switch theme: Light/Dark/System if supported.
- Toggle language.
- Open Project Menu.
- Open Family Library.
- Open Visibility/Graphics for the active view.
- Open 3D View Controls when in 3D.
- Open Keyboard Shortcuts.
- Save Snapshot.
- Restore Snapshot.
- Share Presentation if pages exist.
- Toggle left rail.
- Toggle right rail.
- Close inactive views.

Cmd+K must include view-specific commands:

Plan:

- Wall, Door, Window, Room, Area, Grid, Dimension, Tag, Measure.
- Floor sketch, Roof sketch, Room separation.
- Hide selected in active plan view.
- Reveal hidden.
- Apply plan template.
- Change plan style.
- Change discipline/perspective.

3D:

- Fit model.
- Reset camera.
- Toggle perspective/orthographic.
- Toggle walk mode.
- Set render style.
- Toggle section box.
- Hide/show category.
- Show all model categories.
- Save current viewpoint.
- Update saved viewpoint.
- Insert door/window/opening on selected or picked wall, if a wall is selected or pickable.
- Generate section/elevation from selected wall.

Plan + 3D:

- All plan commands plus 3D camera/display commands, with clear target badges: `Plan`, `3D`, or `Both`.

Section:

- Dimension.
- Place section on sheet.
- Open source plan.
- Adjust crop/far clip when implemented.

Sheet:

- Place view on sheet.
- Recommended viewports.
- Edit titleblock.
- Select viewport.
- Open source view.
- Export/share.

Schedule:

- Open selected row.
- Place schedule on sheet.
- Duplicate schedule.
- Sort/filter/group.
- Choose columns.

Agent:

- Run review.
- Apply quick fix.
- Open evidence artifact.
- Go to related element/view.

### Cmd+K Acceptance Criteria

- Every result has a context badge: `Universal`, `Plan`, `3D`, `Sheet`, `Schedule`, `Agent`, or `Unavailable`.
- Every unavailable result has a reason and optional route.
- "Go to X" always changes the active tab and canvas.
- "Open <specific view>" runs the same activation code as clicking it in the project browser.
- Tool commands never set a tool that the active canvas cannot execute without either switching context or asking through a clear route.
- Theme switching works from Cmd+K.
- Recent commands are scoped by view but universal commands remain global.

## Dead Button Definition

A button is dead if any of these is true:

1. It is visible and enabled, but invoking it produces no observable state change.
2. It changes internal state but the active canvas cannot consume that state.
3. It opens a panel that is not relevant to the current view without explaining the target.
4. It appears to be a complete domain command but only opens Cmd+K/settings with no specific workflow.
5. It acts on a hidden or stale target, such as `activePlanViewId` while the user is in a different active tab.
6. It requires preconditions but does not show the reason or path to satisfy them.

Current likely dead/confusing buttons:

| Surface | Button/command | Current behavior | Problem | Desired behavior |
| --- | --- | --- | --- | --- |
| Ribbon | Wall in 3D | Sets `planTool='wall'` | 3D canvas does not draw walls | Disable with "Use in Plan" or switch to Plan and start Wall |
| Ribbon | Door/Window in 3D | Sets plan tool | 3D insertion exists via wall-face menu, not plan tool | Offer "Insert on wall face" in 3D |
| Ribbon | Move/Copy/Rotate in 3D | Sets plan tool | Plan-only interactions | Hide/disable until 3D gizmo exists |
| Ribbon | VV/VG in 3D | Opens plan `VVDialog` | Wrong visibility model | Open 3D View Controls or unified Visibility dialog scoped to 3D |
| Topbar QAT | Section/Measure/Dimension/Tag outside plan | Sets plan tool | No valid canvas | Switch to Plan or disable with explanation |
| Topbar QAT | Thin Lines | Toggles store fallback | Pressed state not passed from Workspace | Pass state and make context clear |
| Topbar QAT | Redo | Always enabled | No redo availability state | Track redo depth and disable when unavailable |
| Cmd+K | Go to 3D view | Sets `viewerMode` | Active tab still controls canvas | Use tab/mode navigation transaction |
| Cmd+K | Go to plan view | Sets `viewerMode` | Can appear no-op | Use tab/mode navigation transaction |
| Cmd+K | Place Wall from sheet/schedule/3D | Sets plan tool | No execution surface | Show unavailable or switch to Plan |
| Cmd+K | Switch theme | Not mounted | Expected basic command absent | Add universal theme command |
| Status bar | Grid toggle | Visible, no handler | Appears actionable but may do nothing | Wire or hide |
| Status bar | Active level in sheet/schedule | Changes global active level | Canvas may not reflect | Use per-view status content |
| 3D layers | Hide all visible listed categories | Some geometry remains | Category list incomplete | Generate from renderable categories |

## Reachability Matrix

Legend:

- `Yes`: usable in the active view.
- `Partial`: visible or partly implemented, but has gaps.
- `No`: should not be offered as executable there.
- `Bridge`: can be offered if it switches to a valid view or invokes a view-specific equivalent.

| Capability | Plan | 3D | Plan+3D | Section | Sheet | Schedule | Agent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Select model element | Yes | Yes | Yes | Partial | Partial | Row-based | Evidence/action |
| Draw wall | Yes | No/Bridge | Plan side only | No | No | No | No |
| Insert door/window | Yes | Partial via wall face | Yes/Partial | No | No | No | No |
| Wall opening | Yes | Partial via wall face | Yes/Partial | No | No | No | No |
| Move/copy/rotate | Yes | No until 3D gizmo | Plan side only | No | Sheet viewport only | No | No |
| 3D grips | No | Partial, dispatch bug | Partial | No | No | No | No |
| Measure | Yes | No until 3D measure | Plan side only | Maybe | Sheet measure maybe | No | No |
| Dimension/tag | Yes | No | Plan side only | Partial dimension | Sheet annotations maybe | No | No |
| Visibility/Graphics | Plan VG | 3D controls | Both, scoped | Section VG needed | Sheet viewport VG needed | Schedule columns | Review filters |
| Fit/reset camera | No | Yes | 3D side | No | No | No | No |
| Walk mode | No | Yes | 3D side | No | No | No | No |
| Place view on sheet | Bridge | Bridge | Bridge | Yes via action | Yes | Yes | Maybe |
| Open source element/view | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Switch theme | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Go to view | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

## Capability Graph Proposal

Create a canonical `CommandCapabilityRegistry` that every surface uses.

Each command should be a node:

```ts
type CommandCapability = {
  id: string;
  label: string;
  group: 'author' | 'modify' | 'view' | 'navigate' | 'visibility' | 'document' | 'review' | 'system';
  scope: 'universal' | 'view' | 'selection' | 'model';
  targetViews: Array<'plan' | '3d' | 'plan-3d' | 'section' | 'sheet' | 'schedule' | 'agent'>;
  executionSurface: 'plan-canvas' | 'viewport-3d' | 'sheet-canvas' | 'schedule-grid' | 'right-rail' | 'modal' | 'global';
  preconditions: Array<'has-model' | 'has-wall' | 'has-selection' | 'selected-wall' | 'has-sheet' | 'active-plan-view' | 'active-viewpoint'>;
  invokes: (context: CommandContext) => void | Promise<void>;
  availability: (context: CommandContext) => {
    state: 'available' | 'disabled' | 'bridge' | 'hidden';
    reason?: string;
    bridge?: {
      label: string;
      targetView: string;
      invoke: (context: CommandContext) => void | Promise<void>;
    };
  };
};
```

Each visible UI surface becomes a projection of this graph:

- Ribbon: grouped command projection.
- Floating palette: primary authoring projection for active canvas.
- Cmd+K: full searchable projection.
- Topbar QAT: pinned universal/primary projection.
- Right rail actions: selection and view projection.
- Status bar: active view state projection.

This graph should be tested by static and behavioral tests.

## Tracking Artifacts

Add these tracking artifacts after this spec:

1. `spec/ux-feature-ledger.json`
   - One row per command/feature.
   - Fields: id, label, owner, source file, intended views, actual surfaces, preconditions, execution handler, status, usability score, tests.

2. `spec/ux-reachability-matrix.md`
   - Human-readable matrix generated from the ledger.
   - Shows which features are reachable from topbar, ribbon, Cmd+K, palette, left rail, right rail, canvas context menu.

3. `packages/web/src/workspace/commandCapabilities.ts`
   - Runtime registry used by all UI surfaces.

4. `packages/web/src/workspace/commandCapabilities.test.ts`
   - Tests all commands have at least one valid route.
   - Tests no command is visible+enabled in an invalid view.
   - Tests every "bridge" command switches to the correct view.

5. `packages/web/src/workspace/uxAudit.test.ts`
   - Snapshot of capability graph by view.
   - Detects new dead buttons when command surfaces diverge.

## Usability Scorecard

Score every feature from 0 to 10:

- 0: Not reachable.
- 1: Reachable only by hidden/internal state or developer knowledge.
- 2: Visible but dead.
- 3: Visible and changes state, but active view cannot use it.
- 4: Works only in one path; other visible paths fail.
- 5: Works, but target/scope is unclear.
- 6: Works and is scoped correctly, but discoverability is weak.
- 7: Works, scoped, discoverable, with basic disabled states.
- 8: Works across all expected routes, with clear context and recovery.
- 9: Fast, predictable, keyboard-accessible, view-aware, and tested.
- 10: Expert-grade: command can be discovered, previewed, executed, undone, repeated, and learned from the UI.

Current estimated scores:

| Area | Score | Reason |
| --- | ---: | --- |
| Plan authoring core | 7 | Rich and mostly implemented in PlanCanvas |
| 3D navigation/display | 7 | Strong controls and rendering, right rail present |
| 3D editing | 3 | Affordances exist, pure 3D dispatch missing, incomplete tool model |
| Ribbon clarity | 3 | Powerful but too many context-invalid commands |
| Topbar/QAT | 4 | Useful but context-blind and some state mismatch |
| Cmd+K | 3 | Opens and searches, but navigation/context/basic commands are incomplete |
| Project browser navigation | 7 | Best navigation path, but behavior not reused |
| Visibility UX | 4 | Powerful but split and incomplete in 3D |
| Right rail | 6 | Rich, but overloaded and sometimes buried |
| Status bar | 4 | Useful in plan, generic elsewhere |
| Overall | 3 | Feature power exists, but consistency is low |

Target:

| Area | Target | Required change |
| --- | ---: | --- |
| Plan authoring core | 9 | Keep, align all command surfaces to it |
| 3D navigation/display | 9 | Promote controls, Cmd+K support, saved view clarity |
| 3D editing | 8 | Pass dispatch, define 3D-specific edit commands |
| Ribbon clarity | 9 | Capability-driven availability |
| Topbar/QAT | 8 | Context-aware pinned commands and correct state |
| Cmd+K | 9 | Unified command registry and view-aware navigation |
| Project browser navigation | 9 | Shared navigation transaction |
| Visibility UX | 9 | Unified scoped visibility model |
| Right rail | 8 | Stable tabs and view-specific ordering |
| Status bar | 8 | Per-view status model |
| Overall | 9 | No dead enabled commands, all features reachable |

## Redesign Principles

### 1. A Button Must Declare Its Target

Every command should answer:

- Does this affect the model?
- The active view?
- The selected element?
- A type definition?
- The camera/display state?
- A sheet viewport?

Use badges or section grouping when ambiguity is likely:

- `Plan`
- `3D`
- `Selected`
- `Type`
- `View`
- `Temporary`
- `Saved View`

### 2. View-Specific Tools Must Not Masquerade As Global Tools

Wall, Door, Window, Room, Dimension, and Tag are plan tools today.

In 3D, they should either:

- Not appear.
- Appear disabled with "Available in Plan".
- Appear as a bridge: "Switch to Plan and place Door".
- Be replaced by true 3D equivalents, such as "Insert Door on Wall Face."

### 3. Navigation Must Be One Function

Create a single navigation function:

```ts
navigateTo({
  kind: 'plan' | '3d' | 'section' | 'sheet' | 'schedule' | 'agent',
  targetId?: string,
  source: 'browser' | 'cmdk' | 'tab' | 'inspector' | 'schedule' | 'sheet',
});
```

It must update:

- Active tab.
- Workspace mode.
- Viewer mode.
- Active plan view / level.
- Active viewpoint id.
- Camera and saved viewpoint preset.
- Selection where appropriate.
- Temporary visibility scoping.

### 4. Visibility Must Be Scoped

The UI must clearly distinguish:

- Plan Visibility/Graphics.
- 3D runtime layers.
- Saved 3D viewpoint layers.
- Temporary hide/isolate.
- Lens filter.
- Phase filter.

Do not show a generic "Visibility/Graphics" command without target context.

### 5. 3D Editing Is Not Plan Editing

3D should become a strong editing surface, but it needs its own tools:

- Select.
- Edit with grips.
- Insert hosted opening.
- Move/rotate via gizmo.
- Section/elevation from face.
- View/camera/display.

Plan tools should not simply be reused unless the 3D viewport implements their pointer grammar.

## Immediate Fix Plan

### Phase 1: Stop the Worst Confusion

1. Pass `onSemanticCommand` into `Viewport` in pure 3D mode.
2. Make ribbon commands query tool availability by active mode before enabling.
3. Make Topbar QAT plan tools switch to Plan or show disabled reasons outside plan/plan+3D.
4. Fix Cmd+K Go to Plan/3D to use tab/mode navigation instead of only `viewerMode`.
5. Add Cmd+K theme commands.
6. Rename 3D layer controls or expand them so "hide all" means hide all rendered model categories.
7. Hide or adapt OptionsBar outside valid tool execution surfaces.

Expected score after Phase 1: 5.5/10.

### Phase 2: Unify Command Capability

1. Create `commandCapabilities.ts`.
2. Convert ribbon, floating palette, and Cmd+K to consume it.
3. Add capability tests.
4. Replace `planToolsForPerspective` with graph-driven discipline filtering.
5. Delete or merge the unused command palette implementation.

Expected score after Phase 2: 7/10.

### Phase 3: Make 3D Editing Real

1. Define 3D edit commands separately from plan tools.
2. Add 3D action toolbar or right-rail actions for selected walls, doors, windows, roofs, floors.
   - Implemented in `WorkspaceRightRail`: selected walls expose hosted opening and section/elevation
     commands; selected doors/windows/floors/roofs expose 3D category isolate/hide, host-wall
     navigation where applicable, and type navigation where applicable.
3. Add 3D gizmo support only where behavior is complete.
4. Add 3D measure if surfaced.
5. Make wall-face insertions discoverable without relying only on right-click.

Expected score after Phase 3: 8/10.

### Phase 4: Polish and Learning Curve

1. View-aware status bar.
2. Command palette context sections.
3. View badges and target labels throughout.
4. First-run hints based on inactive-but-relevant commands.
5. Undo/redo availability parity.
6. Accessibility review of tab, tree, menu, and toolbar behavior.

Expected score after Phase 4: 9/10.

## Acceptance Tests

### No Dead Buttons

For each active view:

- Render the workspace.
- Enumerate enabled buttons in topbar, ribbon, floating palette, right rail, and status bar.
- Invoke each safe command in a test harness.
- Assert one of:
  - State changed in a way the active canvas consumes.
  - A modal/panel opened.
  - Navigation changed active tab/canvas.
  - A command was dispatched.

### Command Palette Navigation

Tests:

- Cmd+K "Go to 3D" opens or activates a 3D tab and renders `Viewport`.
- Cmd+K "Go to plan" opens or activates a plan tab and renders `PlanCanvas`.
- Cmd+K opening a specific viewpoint applies saved camera and active viewpoint id.
- Cmd+K opening a specific plan view activates `activePlanViewId`.
- Cmd+K theme command toggles theme.

### 3D Editing Dispatch

Tests:

- In pure 3D mode, right-click wall face and choose Insert Door dispatches `insertDoorOnWall`.
- In pure 3D mode, wall context menu Generate Section dispatches `createSectionCut`.
- In pure 3D mode, grip drag dispatches update command.
- Unsupported plan tools are not enabled in pure 3D.

### Visibility Completeness

Tests:

- Every 3D-rendered element kind is either mapped to a 3D visibility category or explicitly documented as always visible.
- "Hide all model categories" hides all model geometry while keeping camera UI and overlays.
- Plan VV/VG changes affect plan canvas only.
- 3D layer toggles affect 3D viewport only.

### Ribbon and QAT Context

Tests:

- In sheet mode, Wall is not enabled as a direct tool.
- In 3D mode, Wall either disabled with a reason or bridge-switches to Plan.
- Thin Lines reflects store state.
- Redo is disabled when redo is unavailable.

## Product-Level UX North Star

The editor should feel like this:

- The active tab tells me where I am.
- The canvas shows only direct tools that work here.
- The ribbon shows breadth, but every disabled command tells me why.
- Cmd+K is the reliable way to get anywhere or do anything.
- The right rail explains the selected thing and the active view.
- The status bar tells me what mode/tool/scope I am in.
- Visibility controls are scoped and reversible.
- 3D is not a decorative viewer. It is an editing view with clearly named 3D operations.

When that is true, the app can remain extremely powerful without feeling messy.
