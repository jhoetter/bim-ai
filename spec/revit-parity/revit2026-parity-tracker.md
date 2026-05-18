# Revit 2026 Feature-Parity Tracker

Last updated: 2026-05-18 (Wave 30 complete)
Source: Detlef Ridder — *Autodesk Revit 2026: Der umfassende Praxiseinstieg für Architekturkonstruktion*, mitp 2026 (ISBN 978-3-7475-1101-5)

Purpose: exhaustive chapter-by-chapter comparison between Revit 2026 (as taught in the book) and what bim-ai currently supports. Every leaf section of the table of contents becomes a row. The goal is to expose gaps at maximum granularity so engineering work can be scoped and prioritised.

---

## Status Legend

- `Done` — fully implemented, tested, and working at production quality
- `Partial` — some sub-capability exists but parity is incomplete
- `Not Started` — no implementation exists
- `N/A` — not applicable to a browser-based BIM SaaS (installation flows, desktop-only licensing, Windows hardware checks, etc.)

Priority:
- `P0` — core authoring workflow; blocks architects from meaningful use
- `P1` — important for professional parity; significantly limits daily use if absent
- `P2` — useful but architects can work around it today
- `P3` — niche, advanced, or rarely used in typical architectural projects

---

## Chapter 1 — Revit installieren, starten und loslegen (UI & startup)

### 1.1 Die Testversion (trial licensing)
**Status: N/A**
Revit requires download and 30-day activation. bim-ai is browser-based with its own subscription/trial model. No parity gap.

### 1.2 Die Studentenversion (student licensing)
**Status: N/A**
Autodesk-specific educational licensing. bim-ai has its own account system.

### 1.3 Hard- und Software-Voraussetzungen (system requirements)
**Status: N/A**
Revit 2026 requires 64-bit Windows 10/11, 16 GB RAM, DirectX 11 GPU, 30 GB disk. bim-ai runs in a browser. No parity gap.

### 1.4 Installierte Programme (installed components)
**Status: N/A**
Revit installs Revit main, Viewer, Add-Ins Manager, Worksharing Monitor. bim-ai is a web app.

### 1.5 Revit starten (startup & project templates)
**Status: Done — P2**
Wave 31 WP-A: `vereinfacht` template added to `PROJECT_TEMPLATES` (BIM Architektur vereinfacht — EG/OG levels at 0/3000 mm + Neubau phase). `recentProjectIds: string[]` added to store (LRU prepend, max 10, `addRecentProject()` action). `OpenRecentProjectCmd` exported from core. Workspace handler prepends+deduplicates+caps. `ProjectSetupDialog.tsx` reads `recentProjectIds` and renders "Recently Opened" list (up to 5 IDs with `data-testid="recent-project-{id}"`). `view.start-screen` capability. 6 tests in `startScreenRecentProjects.test.ts`.

### 1.6 Die Revit-Benutzeroberfläche (UI chrome)

#### 1.6.1 Programmleiste (title bar with project + view name)
**Status: Done — P2**
Wave 29 WP-A: `document.title` updated to `"ProjectName — ViewName"` via `useEffect` in `Workspace.tsx` whenever `activeSeedLabel` or `activePlanViewName` changes; falls back to `"bim-ai"` when no project. Breadcrumb subtitle `data-testid="workspace-view-breadcrumb"` shows `"ProjectName / ViewName"` in the workspace header. `view.dynamic-title` capability. 5 tests in `dynamicTitle.test.ts`.

#### 1.6.2 Dateimenü (file menu: New, Open, Save, Export, Print, Close)
**Status: Partial — P1**
bim-ai has:
- New project (Done)
- Open project (Done)
- Save / auto-save (Done)
- Export (Partial — see Ch. 12)
- Print / PDF export (Partial — see Ch. 12)
- Save As Template / New From Template: Done — `ProjectTemplate` type, localStorage persistence, `ProjectTemplatesDialog.tsx` with save/load/delete UI, `file.project-templates` palette command. 6 tests. (WP-A wave 21)
- Save As (Duplicate): Done — `DuplicateProjectCmd` + `RevertProjectCmd` in core, `handleDuplicateProject`/`handleRevertProject` in Workspace.tsx, "Save As…"/"Revert" buttons in ProjectMenu.tsx (`data-testid="project-menu-save-as"/"project-menu-revert"`), `file.save-as`/`file.revert` palette commands. 4 tests. (WP-D wave 25)
Missing: Save to library as Family, cloud model sync from file menu, Revit Options dialog.

#### 1.6.3 Schnellzugriff-Werkzeugkasten (quick access toolbar)
**Status: Done — P2**
Wave 30 WP-D: `quickAccessItems: string[]` in store; `AddToQuickAccessCmd`/`RemoveFromQuickAccessCmd` in core; Workspace handlers add/remove command IDs; `QuickAccessToolbar.tsx` renders pinned command buttons (`data-testid="qat-btn-{cmdId}"`) — right-click to unpin; wired above canvas in `Workspace.tsx`; `view.quick-access-toolbar` capability; 5 tests in `quickAccessToolbar.test.ts`.

#### 1.6.4 Die Info-Leiste (info bar: search help, Autodesk Account, App Store, Help)
**Status: Done — P2**
Wave 30 WP-C: `helpTopics.ts` with 25 indexed help topics (wall, door, window, floor, room, column, beam, stair, roof, dimension, tag, undo, select, move, copy, mirror, rotate, level, 3D, section, grid, material, export, PDF, family) + `searchHelpTopics(query)` filter; `HelpSearchPanel.tsx` floating modal (`data-testid="help-search-panel"`) with search input (`help-search-input`) + topic list with shortcut badges; `?` keyboard shortcut opens panel; `view.help-search` capability; 5 tests in `helpTopics.test.ts`.

#### 1.6.5 Multifunktionsleiste, Register, Gruppen und Flyouts (ribbon with tabs, groups, flyouts)
**Status: Partial — P1**
Revit has a full ribbon with tabs: Architektur, Ingenieurbau, Stahlbau, Betonfertigteile, Gebäudetechnik, Einfügen, Beschriften, Berechnung, Körper & Grundstück, Zusammenarbeit, Ansicht, Verwalten, Zusatzmodule, Ändern. bim-ai has a compact vertical tool palette and a minimal top menu — no full ribbon architecture.
- Architecture tools (Architektur tab equivalent): Done for core tools; many sub-groups missing
- Structural tab (Ingenieurbau): Partial — columns and beams exist, no full structural ribbon
- Steel (Stahlbau): Not Started
- Precast (Betonfertigteile): Not Started
- MEP (Gebäudetechnik): Partial — duct/pipe/cable-tray/equipment in tool registry, no MEP-detail ribbon
- Insert (Einfügen): Partial — see Ch. 12
- Annotate (Beschriften): Partial — see Ch. 4
- Calculate (Berechnung): Not Started
- Mass & Site (Körper & Grundstück): Partial — see Ch. 11 & 5
- Collaborate (Zusammenarbeit): Partial — see collab features
- View (Ansicht): Partial
- Manage (Verwalten): Partial
- Add-ins (Zusatzmodule): N/A
- Modify (Ändern) context ribbon: Partial

#### 1.6.6 Benutzung der Werkzeuge (how tools activate, options bar, modify ribbon)
**Status: Done — P1**
bim-ai has a ToolPalette with hotkeys, OptionsBar, and ToolModifierBar. Revit-style "tool stays active until escape/finish" grammar is implemented. The chained-placement model (wall chain, stair by component, etc.) is done.
Wave 31 WP-B: door options bar section (tag-on-place toggle, `data-testid="options-door-tag-on-place"`), window section (sill height input `options-window-sill-height` + tag-on-place `options-window-tag-on-place`), grid section (spacing `options-grid-spacing` + name prefix `options-grid-name-prefix`); module-level vars `doorTagOnPlace`/`windowSillHeightMm`/`windowTagOnPlace`/`gridSpacingMm`/`gridNamePrefix` + setters exported from `OptionsBar.tsx`. `view.options-bar-door-window` capability. 8 tests in `optionsBarDoorWindowGrid.test.ts`.

#### 1.6.7 Exemplar- und Typeigenschaften, neue Elementtypen (instance vs type properties, type duplication)
**Status: Done — P1**
bim-ai has the Inspector panel for element properties. Instance properties are shown and editable for walls, doors, windows, roofs, floors. Type properties: `WallTypeLayerEditor.tsx` dialog implemented — add/remove/reorder layer rows, set thicknessMm + function + materialKey, change basisLine. `update_wall_type` command patches the wall_type element in the store. Accessible from InspectorContent when a wall_type element is selected. 5 tests in `wallTypeLayerEditor.test.tsx`. Creating new floor/roof types: `create_floor_type` command adds `floor_type` elements; `create_wall_type` command handles wall types.

#### 1.6.8 Optionsleiste: wichtigste Exemplareigenschaften (options bar for active tool)
**Status: Done**
OptionsBar.tsx fully wired: wall (location line, chain mode, offset, radius), floor (type, level, offset), column (level, height, width, depth), stair (base level, top level, width, run width), room (name, number, upper level). Added by WP-E (wave 10).

#### 1.6.9 Statusleiste (status bar with command hints)
**Status: Done**
StatusBar component (24 px bottom bar) with status-bar-hint (per-tool-phase instruction strings for all major tools) and status-bar-selection (element count). getStatusHint() covers wall/floor/column/stair/room/door/window/measure/measure-angle/paint/dimension/split-wall. hoveredElementKind from store shown when no tool active. Added by WP-G (wave 11).

#### 1.6.10 Ansichtssteuerung (view controls: scale, detail level, visual style, shadows, crop)
**Status: Done — P1**
bim-ai has:
- Plan detail level toolbar (PlanDetailLevelToolbar.tsx — Done)
- Visual style selection (renderStyles.ts — Done)
- Sun/shadow toggle (SunOverlay.tsx — Done)
- Scale display: Partial (shown in plan header)
- Hide/isolate elements in view: Done — `hide_in_view`, `isolate_in_view`, `reset_hidden_in_view` commands + badge overlay (WP-A wave 13)
- Thin-lines toggle ("Feine Linien"): Done — `TL` button (`data-testid="plan-view-thin-lines-toggle"`) in PlanViewHeader; `thinLinesEnabled` store field drives `lineWeights` in plan meshes (wave 14 WP-J).
- Per-view category visibility/graphics overrides dialog: Done — `PerViewVGDialog.tsx` (WP-E wave 15): 11-category dialog with hidden/colorHex/lineWeightPx per-category controls, `data-testid="per-view-vg-dialog"`. "VG" button in PlanViewHeader. `mergeOverrides(global, view)` pure function in `categoryOverrideMerge.ts` merges global + per-view overrides; applied in `rebuildPlanMeshes`. Tests: `perViewVGMerge.test.ts` + `perViewVGDialog.test.tsx`.
- Crop region interactive editing: Done — `getCropRegionGrips`/`applyCropGripDrag` in `cropRegionGrips.ts` wired into PlanCanvas pointer events; `updateCropRegion` command + Workspace handler; `cropGripDragRef` state tracks active drag; 5 tests. (WP-C wave 24)

#### 1.6.11 Projektbrowser (project browser tree: views, sheets, families, groups, Revit links)
**Status: Done — P1 (D7)**
`ProjectBrowser.tsx` + `ProjectBrowserV3.tsx` implement the project browser. Done:
- Plan views grouped by discipline, sub-discipline, view type, and phase (F-032/F-099)
- Area Plans section with scheme buckets (F-098)
- Reflected Ceiling Plans (Deckenansichten) section (D7/D1)
- Right-click context menu on every view row: Rename (inline), Duplicate, Delete, Properties (D7)
- Active view highlighting (D7)
- Drag-to-reorder views in browser (D7)
- Inline double-click rename for plan views, section cuts, elevation views (D7)
- Families subtree: wall_type / floor_type / roof_type with context menu (F-003)
- Links subtree (`link_model` elements)
- Schedules, Sheets, View Templates, Sections, Elevations, 3D saved views groups
Wave 23 WP-D: Groups subtree now implemented — `PbCollapsibleSection` with `data-testid="browser-groups-section"`, group rows (`browser-group-row-{id}`), instance count spans (`pb-group-instance-count-{id}`), `selectGroupElements` semantic command; `SelectGroupElementsCmd` in core + Workspace handler selecting all group member element IDs.
Wave 25 WP-C: "By Level" view organization preset added — `viewOrgPreset` state (`'discipline' | 'level'`), `<select data-testid="browser-view-org-preset">` dropdown, `levelGroupedViews` useMemo, level-name resolution via `getLevelName()`, rendered when preset is 'level' with `data-testid="browser-level-group-{levelId}"` group divs; `view.browser-org-preset` capability + `registerCommand` in defaultCommands. 3 tests.
Wave 27 WP-E: Search/filter + sort added — `browserSearch` state + `data-testid="browser-search-input"` at top of ProjectBrowserV3; `filteredPlanViews` useMemo filters by name; `planViewSort` state + `data-testid="browser-plan-views-sort-btn"` A↑/Z↑ toggle in Floor Plans header; sheet filter; `view.browser-search` capability. 4 tests.
Wave 31 WP-C: View Templates subtree — collapsible `data-testid="browser-view-templates-section"` listing all `view_template` elements; each row has `browser-view-template-row-{id}`, use-count span `browser-vt-use-count-{id}`, Apply button `browser-vt-apply-{id}`; `ApplyViewTemplateCmd` in core patches `viewTemplateId` on `plan_view` via Workspace handler; `view.browser-view-templates` capability; 6 tests in `projectBrowserViewTemplates.test.ts`.
**Status: Done — P1 (D7)**

#### 1.6.12 Zeichenfläche (drawing canvas: multiple view windows, tile/cascade)
**Status: Done — P2**
Wave 29 WP-D: `splitViewEnabled: boolean` store field in `storeViewportRuntimeSlice.ts`; `ToggleSplitViewCmd` in core; Workspace handler flips the flag; `CanvasMount.tsx` renders `PlanCanvas` (left 50%) and 3D `Viewport` (right 50%) in a flex container when `splitViewEnabled=true`; `data-testid="viewport-split-view-btn"` toggle button in `Viewport.tsx`; `view.split-view` capability; 5 tests in `splitView.test.ts`.

### 1.7 Kontextmenüs (right-click context menus)

#### 1.7.1 Ohne aktive Befehle (right-click with nothing selected)
**Status: Done — P2**
bim-ai has a wall face radial menu (wallFaceRadialMenu.tsx). Wave 26 WP-B: `CanvasContextMenu.tsx` component added — right-click on empty canvas space opens a context menu with Zoom In, Zoom Out, Zoom to Fit, and View Properties buttons (`data-testid="canvas-context-menu"`, `canvas-ctx-zoom-in/out/fit/properties`). Wired in `PlanCanvas.tsx` via `canvasCtxMenu` state + `onContextMenu` handler. `view.canvas-context-menu` capability entry. 4 tests in `canvasContextMenu.test.tsx`.

#### 1.7.2 Kontextmenü mit aktivem Element (right-click on selected element)
**Status: Done**
ElementContextMenu component + contextMenuItemsForElement builder covers all element kinds: wall (Flip, Edit Profile, Split, Mirror), floor (Edit Boundary, Mirror), door/window (Flip Facing, Flip Handing, Select Host), column (Mirror, Rotate 90°, Select Similar), room (Edit Name, Select Similar), stair (Create Floor Opening), group (Edit Group, Ungroup). Universal Delete + Properties fallback. Added by WP-D (wave 10).

### 1.8 Objektwahl, Klick, Doppelklick und Objektfang (selection, double-click, snapping)

#### 1.8.1 Objektwahl (element selection: click, box, filter)
**Status: Done — P1**
bim-ai supports single-click selection and basic selection filter (select-linked visibility). Wave 14 WP-A completed:
- TAB-cycle selection for overlapping elements: `nextTabSelection()` in `tabCycleSelection.ts`, wired in `PlanCanvas.tsx`.
- Crossing window selection (right-to-left drag): `crossingSelection.ts` — selects elements intersecting the rectangle.
- "Select All Instances" context menu entry dispatches `selectSimilar` command (wired in `Workspace.tsx` + `contextMenuItems.ts`).
Selection filter dialog (Auswahlfilter by category) was added in an earlier wave.

#### 1.8.2 Griffe an markierten Objekten (grips on selected elements)
**Status: Done — P0**
bim-ai has a comprehensive grip system: grip3d.ts, grip3dProviders.ts, grip3dRenderer.ts for 3D; GripLayer.tsx for plan. Walls, doors, windows, roofs, stairs all have functional drag handles.

#### 1.8.3 Doppelklicken auf Objekte zum Bearbeiten (double-click to edit in context)
**Status: Done**
Double-click dispatch table in PlanCanvas.tsx: floor → floor-sketch, roof → roof-sketch, group → editGroup, room → select + inspector focus, wall → select + hint. Added by WP-C (wave 10).

### 1.9 Info-Center (search Revit help, Autodesk Online)
**Status: N/A / Partial — P3**
Autodesk-specific help search. bim-ai has its own help/onboarding. Not a meaningful parity target.

### 1.10 Revit zurücksetzen (reset Revit UI layout to factory defaults)
**Status: Done — P2**
Wave 30 WP-A: `ResetWorkspaceCmd` in core; Workspace handler resets `splitViewEnabled`, `skyBackground`, `skyBackgroundColor`, `thinLinesEnabled`, `renderQuality`, `quickAccessItems` to initial defaults; "Reset Workspace" in `ProjectMenu.tsx` (`data-testid="project-menu-reset-workspace"`); `view.reset-workspace` capability; 5 tests in `resetWorkspace.test.ts`.

### 1.11 Die Familien-Bibliotheken (Revit Family Libraries — system families, loadable families, BIM content)
**Status: Done — P1**
bim-ai has:
- `FamilyLibraryPanel.tsx` with internal catalogs (window/door presets, furniture, structural), external JSON catalogs (living room, kitchen furniture), and component placement runtime
- Wave 20 WP-D: search, category count badges, recently-used section
- Wave 29 WP-C: BIMobject online catalog section — 12 manufacturer items (Vitra, Wilkhahn, Grohe, Geberit, Schüco, Louis Poulsen, Zehnder, String, Bulthaup) + `searchBimobjectCatalog()` filter + `data-testid="bimobject-search-input"` + placement buttons
*.rfa binary format loading is not supported (Autodesk proprietary format); BIMobject catalog serves as the online library equivalent.

### 1.12 Übungsfragen (review questions)
**Status: N/A**

---

## Chapter 2 — Ein einfacher Grundriss (basic floor plan workflow)

### 2.1 Neues Projekt (new project setup)

#### 2.1.1 Projektinformationen (project info: name, number, address, author)
**Status: Done — P1**
Full Revit-style project information dialog implemented (WP-B wave 13): Projektnummer, Projektname, Projektadresse, Projektstatus, Auftraggeber, Erstellt von fields stored in `project_settings`. `ProjectInfoDialog.tsx` wired into ribbon. Data feeds title blocks on sheets.

#### 2.1.2 Geschoss-Ebenen (floor levels: add, rename, edit elevation)
**Status: Done — P0**
LevelStack.tsx, level datums in 3D view, level-based authoring all implemented. Levels can be created, renamed, and assigned elevations.

#### 2.1.3 Projekt-Basispunkt (project base point)
**Status: Done — P2**
Wave 15 WP-K: `project_base_point` element type in `@bim-ai/core` with `positionMm`, `elevationMm`, `isShared`, `name` fields. Plan symbol: circle (r=150mm) + crosshair in blue (#2563eb). Tool `project-base-point` (hotkey `BP`, plan mode) with single-click grammar — if base point already exists, moves it via `updateElementProperty`. Inspector: `inspector-pbp-x`, `inspector-pbp-y`, `inspector-pbp-elevation`, `inspector-pbp-name`, `inspector-pbp-shared`. Palette command `tool.project-base-point`. Tests: `projectBasePoint.test.ts` (5 tests).

#### 2.1.4 Sichtbarkeit mittels Filter steuern (visibility/graphics by filter)
**Status: Done**
VisibilityGraphicsDialog: per-category table (wall/floor/roof/ceiling/door/window/column/stair/railing/room/permanent_dimension/text_note) with visible checkbox, color input, line-weight input, per-row reset. Live preview via update_category_override command. CategoryVisualOverride type in core/index.ts; applied in symbology.ts rendering. Wired in Workspace.tsx with ribbon-vg button and view.visibility-graphics palette command. Added by WP-A (wave 11, bundled in WP-B commit).

#### 2.1.5 Arbeitsbereich in 2D festlegen (crop region / view range for plan)
**Status: Done**
ViewRangeDialog with vr-top-mm, vr-cut-mm, vr-bottom-mm numeric inputs, live SVG cross-section diagram, cut-plane validation (vr-error), Save/Cancel. Wired into Workspace.tsx; palette command view.view-range. Crop region drag also implemented. Added by WP-B (wave 10).

#### 2.1.6 Objektfang (object snaps configuration)
**Status: Done — P0**
Snap engine (snapEngine.ts), SnapGlyphLayer.tsx, SnapSettingsToolbar.tsx, snap tab cycle — full snap suite implemented including endpoint, midpoint, intersection, perpendicular, tangent, nearest, centre, grid.

#### 2.1.7 Einheiten (project units: mm/m/ft/in, decimal places)
**Status: Done — P1**
Project Units dialog (ProjectUnitsDialog.tsx) implemented. formatUnit.ts provides formatLength/formatArea pure functions covering mm, cm, m, ft, in, ft-in (with 1/16" fraction display), m², ft², and configurable decimal symbol. project_settings extended with lengthUnitFull, areaUnit, decimalSymbol, numberGrouping, volumeUnit. Dialog is accessible via Project menu "Project Units..." item and dispatches updateElementProperty commands. Live preview shows formatted sample values in the selected units. 16 unit tests pass (formatUnit.test.ts + ProjectUnitsDialog.test.tsx).

#### 2.1.8 Geschosshöhen (floor-to-floor heights via level editor)
**Status: Done — P0**
Levels can be positioned at any elevation. The 3D view shows level datum lines. Interactively dragging level heights works via grips.

#### 2.1.9 Die 3D-Ansicht (default 3D view, orbit, home view)
**Status: Done — P0**
Three.js 3D viewport, orbit/pan/zoom, ViewCube, home view restore — all implemented.

### 2.2 Die ersten Wände (first walls)

#### 2.2.1 Wände zeichnen (drawing walls: chain, pick lines, rectangles)
**Status: Done — P0**
Wall tool with chain mode, snap, options bar (location line, offset, radius for curved walls). Curved walls are supported.

#### 2.2.2 Wandlängen korrigieren (fixing wall lengths via grips and temporary dimensions)
**Status: Done — P0**
Grip handles for wall endpoint repositioning, temporary dimensions (tempDimensions.ts) showing live lengths that can be overridden by typing.

#### 2.2.3 Innenwände konstruieren (interior walls with Trim/Extend and wall joins)
**Status: Done — P0**
Trim/Extend tools, wall-join tool, wall-join display (wallJoinDisplay.ts). Interior wall authoring workflow works.

### 2.3 Fenster und Türen (windows and doors)

#### 2.3.1 Fenster einfügen (placing windows: family selection, flip, sill height)
**Status: Done — P0**
Window tool, hosted window placement, flip (mirror) via inspector or grip, sill height via instance property.

#### 2.3.2 Türen positionieren (placing and positioning doors)
**Status: Done — P0**
Door tool, hosted door placement, swing direction flip, door width/height per instance type.

### 2.4 Geschossdecken (floors/slabs)

#### 2.4.1 Geschossdecke bearbeiten (floor sketch editing)
**Status: Done — P0**
Floor tool with sketch mode (floor-sketch), boundary line editing, slope arrow. Editing existing floor boundaries works.

#### 2.4.2 Alternative Deckenkonstruktion (alternative slab structures / slab by boundary)
**Status: Done — P1**
Basic floor placement is done. Revit's alternative slab boundary methods (e.g. picking wall faces automatically to create the boundary) are partially implemented. `floorTypeId` field + inspector selector implemented (WP-G wave 7): inspector shows dropdown of all `floor_type` elements, computed total thickness, and "New Floor Type…" button with inline name input.
Floor edge profile (Deckenrand): Done — `buildFloorEdgeProfileMesh()` in `buildFloorEdgeProfile.ts` extrudes the cross-section `edgeProfileMm` profile along each perimeter edge of the floor boundary using `ExtrudeGeometry`; returns `THREE.Group`, wired at end of `makeFloorSlabMesh` after `addEdges`. Returns null when profile < 2 pts or boundary < 3 pts. `modify.floor-edge-profile` capability + `registerCommand`. 4 tests. (WP-A wave 25)

#### 2.4.3 Unterschied: Fixieren – Verbinden (Pin vs Join geometry)
**Status: Partial — P1**
bim-ai supports element pinning via inspector + PN chord + `modify.pin-selected`/`modify.unpin-all` palette commands (WP-B8). "Join Geometry" palette commands (`modify.join-geometry` / `modify.unjoin-geometry`) available when exactly 2 solid elements are selected (WP-B7). Full solid-geometry CSG trimming at intersections is still partial.

#### 2.4.4 Prioritäten (material layer priority for wall/floor/ceiling joins)
**Status: Done**
Priority column (1–Structure … 5–Finish 2) added to WallTypeLayerEditor.tsx. FloorTypeLayer priority field added in core/index.ts. effectiveHostMaterials.ts join resolution uses priority (lower number wins). Inspector wall_type priority summary readout. Added by WP-E (wave 11).

### 2.5 Treppen (stairs)

#### 2.5.1 Vorbereitung der Treppenseitenwand (preparing stair side wall with shaft opening)
**Status: Done — P1**
Shaft openings exist as a tool (shaft in tool registry). Wave 22 WP-D: `buildShaftSideWalls(shaft, levelId, wallThicknessMm)` in `buildShaftSideWalls.ts` generates 2 wall elements flanking the shaft along its longest bounding-box axis. Inspector "Add Side Walls" button on shaft elements dispatches createElement commands for each wall. `modify.add-shaft-side-walls` palette command with `isAvailable: ctx.selectedElements?.some(e => e.kind === 'shaft')`. Tests: `buildShaftSideWalls.test.ts` (6 tests).

#### 2.5.2 Treppe erstellen (creating a stair: by component)
**Status: Done — P0**
Stair tool, StairBySketchCanvas, stair plan symbol, meshBuilders.multiRunStair.ts — stair creation works.

#### 2.5.3 Das Treppenloch (stair opening / floor void)
**Status: Done — P1**
Shaft tool cuts floor openings. Auto-creation of a coordinated shaft void when placing a stair is now implemented (WP-F wave 13): `stairShaft.ts` computes shaft boundary from stair footprint; shaft is auto-created on stair placement. Inspector "Create Shaft" button added. Tests in `stairShaft.test.ts`.

### 2.6 Mehrere Stockwerke (multi-storey)

#### 2.6.1 Stockwerke kopieren (copy a floor to upper levels)
**Status: Done — G1**
Ctrl+C copies selection to clipboard; "Paste Aligned to Selected Levels" available via Cmd+K → PasteToLevelsDialog level-picker → dispatches copyElementsToLevels per target level. Full multi-floor copy workflow is now a single Cmd+K command.

#### 2.6.2 Geschossabhängige Änderungen (level-dependent modifications: top constraint, base offset)
**Status: Done — P1**
Walls and columns now expose `topConstraintLevelId` (dropdown of all levels sorted by elevation) and `topConstraintOffsetMm` (number input, mm) in the inspector (WP-B wave 7). `meshBuilders.ts` resolves top height from the constraint level + offset when set; falls back to element `heightMm`. Tests: `topConstraintInspector.test.tsx` (4 tests), `topConstraintMesh.test.ts` (3 tests).

### 2.7 Dächer (basic roof — by footprint)
**Status: Done — P0**
Roof by footprint (roof tool), roof by sketch (roof-sketch tool). Hip/valley slopes per edge, slope angle in properties. Covered in full in Ch. 10.

### 2.8 Projektphasen (project phases: Existing, Demolition, New Construction)
**Status: Done — P1**
Phase filter is implemented (phaseFilter.ts, PhaseDropdown in plan view). Elements can be assigned a phaseId. Phase filter visibility (show New/Demo/Existing in different graphic states) works at a basic level.

F1 (Phase Management): PhaseManagerDialog.tsx implemented — table shows sequence/name/description/element count, inline rename, up/down reorder, delete with confirmation, add new phase. Accessible via Project menu "Manage Phases...". 8 tests pass.

F3 (Project Information): ProjectInfoDialog.tsx implemented — standalone dialog with projectNumber, projectName, projectAddress, projectStatus, clientName, authorName, issueDate, checkDate, description, trueNorthAngleDeg. Accessible via Project menu "Project Information...". SheetCanvas.tsx updated to resolve token values from project_settings when sheet.metadata is empty, with greyed placeholder text for empty slots. 5 tests pass.

F6 (True North): projectNorthAngleDeg added to project_settings type. True North toggle button in PlanViewHeader.tsx (props: projectNorthAngleDeg, trueNorthActive, onTrueNorthToggle). Toggle button wired in Workspace.tsx pane trailing controls when north angle ≠ 0; applies CSS `rotate(-Ndeg)` to plan canvas wrapper. sunStore.ts extended with projectNorthOffsetDeg + displayAzimuthDeg() for adjusted sun azimuth. Note: mouse interaction is not coordinate-corrected in true-north mode (view-only rotation).

F2 (Phase Graphic Overrides): `phaseFilterMode` added to plan_view element type in core/index.ts. `resolvePhaseGraphicStyle()` pure function added to planProjection.ts — given a view's phaseId, phaseFilterMode, and an element's phaseCreated/phaseDemolished, returns `{hidden, opacity, dashed, grey}`. rebuildPlanMeshes() in symbology.ts extended with `viewPhaseId` + `phaseFilterMode` opts; `applyPhaseStyle()` helper traverses Three.js object children and applies grey colouring + opacity + LineDashedMaterial for demolished elements. Phase overlay applied to walls, curtain walls, doors, windows, floors. PlanCanvas.tsx derives viewPhaseId/phaseFilterMode from active plan_view element and passes to rebuildPlanMeshes. Phase filter mode selector (dropdown) added to Workspace.tsx paneTrailingControls (visible when active plan view has a phaseId set); dispatches updateElementProperty to persist the mode. Modes: `new_construction` (existing=grey, demolished=hidden, new=normal), `demolition` (existing=grey, demolished=dashed, new=hidden), `existing` (only existing shown), `as_built` (all normal). 11 tests added to planProjection.test.ts (all pass).

`phase` element type added to core/index.ts with create/update/delete commands (`create_phase`, `update_phase`, `delete_phase`).
`ManagePhasesDialog.tsx` (pattern: ManageRevisionsDialog) at `workspace/phases/`: table of phases, add/delete/rename via inline input, wired in Workspace.tsx via ribbon "Phases" button (data-testid: `ribbon-manage-phases`) in the Review tab. Per-element Phase Created / Phase Demolished dropdowns in InspectorContent.tsx for wall, floor, roof, column, and beam elements (data-testid: `inspector-phase-created`, `inspector-phase-demolished`). 7 tests.

### 2.9 Weitere Grundrisse und Ansichten (additional floor plans and views)

#### 2.9.1 Terrasse (terrace: modeling balcony/terrace with floor + railing)
**Status: Done — P1**
Floors, railings exist. Modeling a terrace with cantilevered floor, stepped edges, and railing is possible. Terrace preset workflow: Done — `buildTerraceRailing()` closes the floor boundary as a railing path + `TerracePresetDialog.tsx` (railing height input 800–2000mm) + `modify.create-terrace-from-floor` palette command (available when floor selected) + Workspace handler + 8 tests. (WP-D wave 21)

#### 2.9.2 Eingangstreppe (entrance stair: straight stair with landing)
**Status: Done — P0**
Single-run stair with landing works via the stair tool.

#### 2.9.3 Komplexe Treppe (complex stair: L-shape, U-shape, multi-landing)
**Status: Done — G1**
L-shape (2 runs + 90° landing), U-shape (3 runs + 2 landings), winder stairs (winderAtCorner: wedge treads), and spiral stairs (centerMm, innerRadiusMm, outerRadiusMm, totalRotationDeg) all implemented in meshBuilders.multiRunStair.ts with 19 tests. stairPlanSymbol.ts handles all shapes with 7 tests.

#### 2.9.4 Obergeschoss (upper floor plan derived from lower floor)
**Status: Done — P2**
Upper floor plans are created as separate level plan views. Wave 28 WP-A: `underlayLevelId?: string | null` + `showUnderlay?: boolean` on `plan_view`; `SetPlanUnderlayCmd`; PlanViewHeader UL toggle button (`data-testid="plan-view-underlay-btn"`) + level selector dropdown (`data-testid="plan-view-underlay-level-select"`); symbology.ts underlay pass renders walls from `underlayLevelId` as dashed `LineDashedMaterial` lines (color `0x8b5cf6`, 40% opacity) at `PLAN_Y+0.001`; `view.plan-underlay` capability; 5 tests in `planUnderlay.test.ts`.

#### 2.9.5 Keller (basement: below-grade levels)
**Status: Done — P0**
Levels below elevation 0 work fine. Basement walls with base constraint to lower levels are possible.

### 2.10 Übungsfragen
**Status: N/A**

---

## Chapter 3 — Bearbeitungsfunktionen der Basiselemente (modify tools)

### 3.1 3D-Ansicht für einzelne Geschosse erstellen (section box to isolate a floor in 3D)
**Status: Done — P1**
Section box (sectionBox.ts) exists. Applying a section box clipped to a specific level's extents is not a one-click "show floor X in 3D" command as Revit offers. Section box drag handles: 6 orange disc meshes (userData.sectionBoxHandle face IDs) centred on box faces; pointer drag resizes via secondary raycast plane. `SectionBoxExtent` persisted to store (`viewerSectionBoxExtent`). 4 sectionBox tests.

### 3.2 3D-Ansicht für ein Geschoss über View Cube (orienting 3D view via ViewCube)
**Status: Done — P1**
ViewCube exists and provides 26 standard orientations. Wave 14 WP-H: right-click context menu on ViewCube → "Orient to View" implemented. Clicking any face orients the camera; saved 3D views are listed and selectable from the context menu. `viewCubeOrient.test.tsx` covers the behaviour. `handleContextMenu` + `orientToFace` / `orientToSaved` callbacks wired through `Viewport.tsx`.

### 3.3 Das Register »Ändern« (Modify ribbon and tools)

#### 3.3.1 Gruppe »Auswählen« (selection filter, link selection toggle)
**Status: Done — P1**
Select tool exists. Selection filter by category (Auswahlfilter dialog) implemented — SelectionFilterDialog.tsx groups selected elements by kind with checkboxes, dispatches deselectByCategory on apply; wired in Workspace.tsx + Cmd+K palette (selection.filter). "Select All Instances in Project" palette command also added (selection.select-all-instances). Link selection toggle: Done — `selectLinkedEnabled` store field (default false) + LK toggle button in PlanViewHeader + PlanCanvas click/box-select filter skipping `link_model` when disabled + `selection.toggle-select-linked` palette command + 4 tests. (WP-C wave 21)

#### 3.3.2 Gruppe »Eigenschaften« (Properties panel access from Modify)
**Status: Done — P1**
Inspector panel always shows properties of selected element.

#### 3.3.3 Gruppe »Zwischenablage« (clipboard: cut, copy, paste, paste aligned)
**Status: Done — G1**
Ctrl+C copies selection to clipboard (copyElementsToClipboard); Ctrl+V pastes at cursor (pasteFromOSClipboard) — both wired in PlanCanvas.tsx. copyToLevels / pasteAlignedToLevels helpers implemented with 6 unit tests. "Paste Aligned to Selected Levels" available via Cmd+K (clipboard.paste-to-levels) and implemented as PasteToLevelsDialog with 8 tests.
- **C6:** Ctrl+C/V wired. copyToLevels.ts + pasteAlignedToLevels fully implemented. PasteToLevelsDialog (Cmd+K → level-picker modal → dispatches copyElementsToLevels per target) complete with 8 passing tests. Dialog now wired in Workspace.tsx (openPasteToLevels palette context) — WP-B3 done.

#### 3.3.4 Gruppe »Geometrie« (geometry group: Join, Unjoin, Cut, Uncut geometry, Paint)
**Status: Done — P1**
- Join Geometry: Implemented — joinGeometry.ts command shapes + selection validation + `modify.join-geometry` / `modify.unjoin-geometry` in Cmd+K palette (WP-B7)
- Cut Geometry: Done — Wave 22 WP-B: `cutBy?: string[]` field on wall/floor/column elements; `ApplyCutGeometryCmd`/`RemoveCutGeometryCmd` command types; `CutGeometryState`/`reduceCutGeometry` 2-phase grammar (idle → picking-host → commitCutGeometry effect); `applyCutGeometry`/`removeCutGeometry` Workspace handlers; inspector "Cut By" collapsible section with Remove buttons; `modify.cut-geometry` / `modify.uncut-geometry` palette commands (hotkey CG). Tests: `cutGeometry.test.ts` (4) + `cutGeometryCommands.test.ts` (4).
- Unjoin: Implemented via palette command (WP-B7)
- Paint (apply material to individual face): Implemented — `paint` tool (hotkey PT), `faceMaterialOverrides` on wall/floor/roof/ceiling elements, PaintFaceCmd, OptionsBar material select, inspector face-override list with per-face remove. Added by WP-F (wave 10).

#### 3.3.5 Gruppe »Steuerelemente« (controls: show/hide constraints, lock/unlock)
**Status: Done — P2**
Pin element is available. Show/hide constraints: `showConstraints` field on `plan_view` + `ToggleShowConstraintsCmd` + Workspace handler + PlanViewHeader EQ button + `isEqualityDimension`/`isLocked` on `permanent_dimension` + EQ marker and 🔒 lock symbol rendering in `planElementMeshBuilders.ts` + `symbology.ts`. 5 tests (WP-D wave 27).

#### 3.3.6 Gruppe »Ändern« (modify group: move, copy, rotate, mirror, array, scale, align, split, trim, offset, delete)
**Status: Done — P0**
- Move: Done (moveTool.ts)
- Copy: Done (copy in tool registry)
- Rotate: Done (rotateTool.ts)
- Mirror (axis / pick axis): Done (mirror in tool registry)
- Array (linear and radial): **Implemented (WP-B wave 2)** — `arrayTool.ts` math helpers + `ArrayState`/`reduceArray` grammar (14 unit tests) complete. PlanCanvas.tsx now fully wired: click handler routes through `reduceArray` phases (idle → pick-start → pick-end → confirm-linear / pick-center → confirm-radial), Enter key fires confirm, Escape cancels, instruction banner + Linear/Radial toggle + Count input shown. Fires `createLinearArray`/`createRadialArray` semantic commands on confirm.
- Scale: **Done (WP-D wave 16)** — `'scale'` ToolId (hotkey `SZ`), `ScaleState`/`reduceScale` 3-phase grammar (idle→picking-base→picking-reference→scaling), numeric factor input, `scaleElements` semantic command, Workspace handler scales `positionMm` + dimension fields. Tests in `scaleTool.test.ts` and `scaleElements.test.ts`.
- Align: Done (align in tool registry)
- Split (wall/line): Done (split tool)
- Trim / Extend: Done (trim, trim-extend tools)
- Offset: Done (offset tool, wallOffsetTool.ts)
- Delete: Done

#### 3.3.7 Gruppe »Ansicht« (view group in Modify: linework override, paint surface)
**Status: Done — P2**
Wave 15 WP-I: Linework override tool implemented. `lineworkOverrides` field added to `plan_view` in `@bim-ai/core`. `'linework'` ToolId (hotkey `LW`, plan mode) registered with `LineworkState`/`reduceLinework` grammar — click picks element by `bimPickId`, emits `applyLineworkOverride` effect. `Workspace.tsx` handler deduplicates overrides by `elementId`. OptionsBar: color picker (`options-linework-color`), line weight select (`options-linework-weight`), style select (`options-linework-style`). `symbology.ts` traverses scene graph and applies overrides. Inspector section on plan_view lists overrides with remove buttons and Clear All. Tests: `lineworkOverride.test.ts` (4 tests) + `lineworkOverrideMerge.test.ts` (3 tests).
Wave 26 WP-A: Paint surface tool added — `faceOverrides?: Record<string, string>` on wall/floor elements; `PaintFaceCmd`/`UnpaintFaceCmd` in core; `paintFace`/`unpaintFace` Workspace handlers; `'paint'` ToolId (hotkey `PA`, plan mode); OptionsBar material selector (`options-paint-material`). `modify.paint-face` capability. 5 tests in `paintSurface.test.ts`.

#### 3.3.8 Gruppe »Messen« (measure group: measure distance, measure arc, measure angle)
**Status: Done**
Measure distance (existing). Measure Angle (MA): 3-click vertex+ray+ray, MeasureAngleState grammar, measure-angle-readout chip showing ∠ degrees. Measure Arc (MR): 3-click start+end+through, MeasureArcState grammar, measure-arc-readout chip showing arc length + radius. measureGeometry.ts pure functions (angleBetweenVectors, fitCircleThrough3, arcLengthThrough3). 19 tests. Added by WP-C (wave 11).

#### 3.3.9 Gruppe »Erstellen« (create group in Modify: create similar, create group)
**Status: Done — P2**
Wave 14 WP-K: `createSimilar.ts` helper + CS chord fully wired in `PlanCanvas.tsx` (C then S within 500 ms activates placement tool for the same element kind). "Create Similar" entry in right-click context menu (`contextMenuItems.ts`). `createSimilarShortcut.test.ts` covers the keyboard flow. Create Group: implemented as `model.create-group` Cmd+K command — opens `CreateGroupDialog.tsx` (WP-B2).

### 3.4 Geschossdecken bearbeiten (edit floor/slab shapes)

#### 3.4.1 Geschossdecke am Dach begrenzen (attaching floor to roof: Edit Boundary or Slope Arrow)
**Status: Done**
Floor boundary editing works. Slope arrow for sloped floors partially implemented. Attach Top/Base: `applyAttachFloorToRoof()` in `attachFloorToRoof.ts` sets `attachedToRoofId` + `topFaceElevationMm` from roof `baseElevationMm`. Inspector buttons (`inspector-floor-attach` / `inspector-floor-detach`) dispatch `attach_floor_to_roof` command. Tests: `attachFloorToRoof.test.ts` (3 tests), `floorAttachRoof.test.tsx` (4 tests). Added by WP-C (wave 12).

#### 3.4.2 Bodenplatte im Keller bearbeiten (basement slab editing)
**Status: Done — P1**
Drainage slope via sub-element editing: Done — `FloorSlopePoint` type in core (`id`, `xMm`, `yMm`, `elevationOffsetMm`) + `slopePoints?` on `FloorElem` + `addFloorSlopePoint`/`removeFloorSlopePoint`/`updateFloorSlopePoint` commands + Workspace handlers + inspector "Drainage Slope Points" collapsible section + `floorSlopePointsPlanThree()` orange circle plan symbols + 5 tests. (WP-B wave 21)
Sub-floor thickening: Done — `subFloorThicknessMm?: number | null` on `FloorElem` in core + `SetSubFloorThicknessCmd` command type + `setSubFloorThickness` Workspace handler + inspector "Sub-floor Pad" number input (`inspector-floor-sub-thickness`) + `modify.set-sub-floor-thickness` palette command + 3D mesh pad below slab in `makeFloorSlabMesh` + 4 tests. (WP-A wave 23)

### 3.5 Wände bearbeiten (wall editing)

#### 3.5.1 Die Schnitthöhe für Geschossansichten (view cut height for plan views)
**Status: Done**
ViewRangeDialog exposes explicit cut plane height (vr-cut-mm) per plan_view element, alongside top/bottom of range. Live SVG diagram shows cut position proportionally. Added by WP-B (wave 10).

#### 3.5.2 Wandtyp ändern (change wall type on selected wall)
**Status: Done — P1**
Wall type can be changed via the inspector type selector (WorkspaceRightRailTypeCommands.ts).

#### 3.5.3 Wände löschen, ergänzen und verschieben (delete, extend, move walls)
**Status: Done — P0**
Delete, move (moveTool), extend (trim-extend), grip-based repositioning all work.

#### 3.5.4 Verschieben mit und ohne Befehl (move with/without the Move command vs drag)
**Status: Done — P0**
Both drag-to-move (grips) and explicit Move tool work.

#### 3.5.5 Wände fixieren, Profil anpassen und Verbinden-Werkzeug (pin, edit profile, join tool)
**Status: Done — P1**
- Pin: Done — pinUnpin.ts helpers + PN chord shortcut + `modify.pin-selected` / `modify.unpin-selected` / `modify.unpin-all` + padlock 📌 glyph overlay (WP-B8)
- Edit Profile: Done — `profilePoints?: {xMm,yMm}[]` on wall; Wave 26 WP-E: `makeWallMesh` uses `THREE.Shape`+`ExtrudeGeometry` when >=3 points set; Wave 30 WP-E: `UpdateWallProfileCmd` + Workspace handler + inspector "Profile Points" collapsible section with SVG mini-preview + numbered x/y input grid + "+ Point"/"- Last"/"Reset" buttons (`data-testid="wall-profile-add-point/remove-last/reset"`, `wall-profile-pt-x-{i}/pt-y-{i}`) + `modify.edit-wall-profile-inspector` capability + 6 tests in `wallProfileInspectorEdit.test.ts`
- Join / Unjoin: Done — `joinOverrides` on wall + `SetWallJoinCmd` + `findWallsAtCorner()` + 9 tests (WP-E wave 23)

#### 3.5.6 Wände in Laufrichtung verbinden (connect walls end-to-end along run)
**Status: Done — P0**
Wall chain placement and wall join auto-resolution handle this.

#### 3.5.7 Geneigte und verjüngte Wände (sloped and tapered walls)
**Status: Done**
slopeAngleDeg + topThicknessMm on wall element. Inspector "Profile & Slope" collapsible section (inspector-wall-slope-angle, inspector-wall-top-thickness, inspector-wall-reset-slope). 3D mesh builder applies slope shear and trapezoidal taper. Plan symbol slope-direction arrow. Tests in slopedWallInspector.test.tsx and slopedWall.test.ts. Implemented in wave 8/wave 11 WP-D.

### 3.6 Fenster bearbeiten (editing windows)

#### 3.6.1 Eigenschaften bearbeiten (editing window instance properties: sill height, width, height)
**Status: Done — P0**
Window properties editable in inspector.

#### 3.6.2 Fenster aus Bibliotheken (loading window families from library)
**Status: Done — P1**
Window family types available through the family catalog. Wave 24 WP-E: expanded type catalog significantly — `WINDOW_PRESETS` (5 types: casement 900×1200, double-hung 900×1500, awning 1200×600, fixed glazing 1800×2100, sliding 1600×2100) + `DOOR_PRESETS` (4 types: single, sliding, double-leaf, pocket) in `windowDoorPresets.ts`. `windowStyle` / `doorStyle` optional fields on window/door elements. Family catalog extended with 5 new entries. Palette commands `tool.window-casement`, `tool.window-sliding`, `tool.door-sliding`, `tool.door-double-leaf`, `tool.door-pocket` + 4 others. 8 tests. Loading arbitrary *.rfa format is still not supported.

### 3.7 Türen bearbeiten (editing doors: type change, swing flip, frame properties)
**Status: Done — P0**
Door type change, flip swing direction, width/height properties all work via inspector.

### 3.8 Verwendung globaler Parameter (global parameters: named model-wide numeric values)
**Status: Implemented — global params table + dialog + commands**
`globalParams` array added to `project_settings` in `@bim-ai/core`. Commands `addGlobalParam`, `updateGlobalParam`, `deleteGlobalParam` dispatched via `onSemanticCommand`. `GlobalParamsDialog.tsx` renders an inline-editable table (Name / Formula / Value mm) with formula evaluator, Add Parameter button, and per-row delete. Wired into `Workspace.tsx` via `globalParamsOpen` state and `ProjectMenu.tsx` → "Global Parameters..." menu item. 9 tests passing (formula evaluator, command reducer, dialog rendering).

### 3.9 Übungsfragen
**Status: N/A**

---

## Chapter 4 — Bemaßungen, Höhenkoten, Texte und Beschriftungen (annotations & dims)

### 4.1 Die Bemaßungsbefehle (dimension commands overview)
**Status: Done — P1**
All dimension types implemented. Aligned: permanent_dimension grammar + PlanCanvas + inspector (waves 5/8/10). Angular: `angular_dimension` type + grammar in `toolGrammar.ts` + plan renderer in `detailComponentsRender.ts` + Workspace handler (`createAngularDimension`) + inspector case. Radial: `radial_dimension` type + grammar + renderer + Workspace handler. Diameter: `diameter_dimension` type + Workspace handler. Wave 22 WP-A: `DimWitnessPoint` type + `resolveDimReferences()` for element-referenced witness points. Wave 24 WP-A: added missing Workspace handlers for angular/radial/diameter dimension creation + inspector cases + `annotate.angular-dimension`/`annotate.radial-dimension` palette commands + 4 tests.

### 4.2 Die ausgerichtete Bemaßung (aligned dimension)

#### 4.2.1 Beispiel für ausgerichtete Bemaßung (basic aligned dim chain)
**Status: Done — P1**
Multi-click permanent dimension chain placement implemented (wave 8 WP-A). `PermanentDimState` / `reducePermanentDim` grammar in `toolGrammar.ts`: activate → picking → click appends witness points → Enter/double-click commits → Escape cancels. `CreatePermanentDimensionCmd` type added to `core/index.ts`. Client-side handler in `Workspace.tsx` adds `permanent_dimension` element to `elementsById`. Dashed preview polyline + snap circles at picked points rendered in PlanCanvas. `userData.dimOffsetDrag = true` tagged on dimension line mesh for future drag grip. Tests in `permanentDimGrammar.test.ts` (6 tests).

#### 4.2.2 EQ-Bedingung (equal constraint on dimension chain)
**Status: Done — P2**
`permanent_dimension` element type in `@bim-ai/core` with `witnessPointsMm[]`, `offsetMm`, and `eqEnabled` flag (wave 5 WP-E). Plan rendering in `permanentDimensionThree()`: when `eqEnabled` false renders per-segment length labels; when true renders "EQ" labels at each segment midpoint and a blue EQ toggle circle button (`userData.eqToggle = true`, color `#2563eb`). `toggle_dim_eq` command handled in `Workspace.tsx` to flip `eqEnabled` AND now calls `equalizeWitnessSpacing()` to actually drive the witness points to equal spacing (wave 14 WP-K). Inspector EQ toggle button (`data-testid="inspector-permanent-dimension-eq"`). Tests in `eqDimension.test.ts` + `equalizeWitnessSpacing.test.ts`.

#### 4.2.3 Fensterbreiten und Wandlängen gleichsetzen (equalise window widths/wall lengths via EQ)
**Status: Done — P1**
`equalizeWitnessSpacing(witnessPointsMm)` in `equalizeWitnessSpacing.ts` redistributes dimension witness points to equal intervals when EQ is activated. Called from `toggle_dim_eq` handler in `Workspace.tsx` (wave 14 WP-K). Tests in `equalizeWitnessSpacing.test.ts`.

#### 4.2.4 Bemaßungsstil (dimension style: text size, witness line gap, arrow type)
**Status: Done — P2**
`DimensionStyleDialog.tsx` implemented (WP-E wave 7): textHeightMm, witnessLineExtensionMm, witnessLineGapMm, arrowStyle (arrow/dot/tick/none), showUnit toggle. Stored in `project_settings.dimensionStyle`. `permanentDimensionThree()` in `planElementMeshBuilders.ts` reads style values. Palette command `annotate.dimension-style` registered. Ribbon button `data-testid="ribbon-dimension-style"`. Tests: `DimensionStyleDialog.test.tsx` (6 tests), `dimensionStyleRender.test.ts` (3 tests).

#### 4.2.5 Maßkette bearbeiten (editing a dimension string: move text, flip witness line)
**Status: Done**
permanentDimGripProvider: text-offset grip (drag repositions label via offsetMm), one witness-point grip per witnessPointsMm entry. `flipped` field on permanent_dimension element (negates offsetMm.y for opposite-side placement). Inspector flip button + offset readout. Added by WP-A (wave 10).

#### 4.2.6 Weitere Maßketten (additional dimension strings: stacked dims)
**Status: Done — P2**
Multiple parallel dimension chains can be placed. Auto-stacking: `stackDimensions()` utility + `StackDimensionsCmd` + Workspace handler redistributes parallel `permanent_dimension` offsetMm at even 7mm spacing (vertical and horizontal groups independently). `modify.stack-dimensions` palette command. 6 tests (WP-C wave 27).

#### 4.2.7 Bemaßung mit Referenzlinie (dimensioning to reference plane)
**Status: Done — P2**
Reference planes exist (reference-plane tool). `referencedElementId?` on `DimWitnessPoint` allows snapping dimensions to reference planes as reference targets. (WP-C wave 27).

### 4.3 Die lineare Bemaßung (linear / horizontal-vertical dimension)

#### 4.3.1 Maßtexte ergänzen (adding suffix/prefix text to dimension value)
**Status: Done — P2**
`textPrefix?`, `textSuffix?`, `textOverride?` added to dimension element type. planElementMeshBuilders.ts uses textOverride when set, else composes prefix+measured+suffix. Inspector shows editable inputs when onPropertyChange is wired. 4 tests in InspectorContent.test.tsx.

### 4.4 Winkelbemaßung (angular dimension)
**Status: Done**
`angular-dimension` ToolId (hotkey `AD`), grammar, and plan renderer implemented. Inspector polish (wave 12 WP-D): angle read-only display (`inspector-angular-dim-angle`), textPrefix/textSuffix/textOverride inputs, offset read-only, Flip button (`inspector-angular-dim-flip`). Angular dim grip provider: arc-offset grip + vertex grip. Tests: `angularDimInspector.test.tsx` (4 tests). Added by WP-D (wave 12).

### 4.5 Radius- und Durchmesserbemaßungen (radial and diameter dimensions)
**Status: Done**
`radial-dimension` (hotkey `RD`) and `diameter-dimension` (hotkey `DD`) ToolIds added. Grammar, plan renderer, grip providers done. Inspector polish (wave 12 WP-D): radius/diameter read-only display (`inspector-radial-dim-value` / `inspector-diameter-dim-value`), textPrefix/textOverride inputs, Flip button (`inspector-radial-dim-flip`); `flipped` field added to `radial_dimension` type. Tests: `radialDimInspector.test.tsx` (4 tests). Added by WP-D (wave 12).

### 4.6 Bogenlängenbemaßung (arc length dimension)
**Status: Done — P2**
`arc-length-dimension` ToolId (hotkey `ALD`) added. Single-click grammar. Plan renderer draws arc-length label at midpoint. Grip provider (center drag) and inspector panel (arc length, angle, radius) added.
Wave 26 WP-E: Curved dimension arc rendering added — `offsetMm?` field on `arc_length_dimension` (default 200mm); dimension arc rendered as N=32-point polyline at `radiusMm + offsetMm` from center, from `startAngleDeg` to `endAngleDeg`; extension lines at start/end angles; `annotate.arc-length-dimension` capability. 4 tests in `arcLengthDim.test.ts`.

### 4.7 Höhenkoten (spot elevation annotation)
**Status: Done**
`spot-elevation` ToolId (hotkey `SE`) added. Single-click grammar. Plan renderer draws elevation label (prefix+mm/1000+suffix). Grip provider (position drag) done. Inspector (wave 12 WP-F): elevationMm input (`inspector-spot-elevation-mm`), elevationMode select (`inspector-spot-elevation-mode`), showIn3D checkbox (`inspector-spot-elevation-show3d`), textPrefix/textSuffix inputs. 3D viewport: `spotElevationThree()` in `meshBuilders.ts` builds Group with diamond marker + CSS2DObject label; `showIn3D` field + `elevationMode` field added to `spot_elevation` type. Tests: `spotElevation3D.test.ts` (5 tests), `spotElevationInspector.test.tsx` (4 tests). Added by WP-F (wave 12).

### 4.8 Punktkoordinate (spot coordinate annotation)
**Status: Done — P2**
`spot-coordinate` ToolId (hotkey `SP`) added. Single-click grammar. Plan renderer draws N/E coordinate label. Grip provider (position drag) and inspector panel (N/E read-only) added. Wave 17 WP-C: fully wired into PlanCanvas, inspector inputs `inspector-spot-coord-n`/`inspector-spot-coord-e`/`inspector-spot-coord-elevation`, grip provider, tests in `spotCoordAnnotation.test.ts`.

### 4.9 Neigungskote (slope annotation / grade arrow)
**Status: Done — P2**
`slope-annotation` ToolId (hotkey `SL`) added. Two-click grammar (idle→end-point→commitSlope). Plan renderer draws slope percentage label. Grip provider (position drag) and inspector panel (slopePct editable) added. Wave 17 WP-C: fully wired into PlanCanvas, inspector inputs `inspector-slope-annotation-pct` + ratio readout, start/end grips, tests in `slopeAnnotation.test.ts`.

### 4.10 Text und Hinweistext (text and leader text annotations)
**Status: Done**
text_note and leader_text elements with bold/italic/underline/fontFamily/colorHex/horizontalAlign fields. Inspector formatting toolbar (B/I/U buttons, align left/center/right, color picker). Renderer applies CSS2DObject styles. Rotation + resize grips in textNoteGripProvider. Tests in textNoteInspector.test.tsx and textNoteFormatting.test.ts. Added by WP-F (wave 11).

### 4.11 Bauteile beschriften (element tags / labels)

#### 4.11.1 Automatische Element-Beschriftungen (auto-tag by category)
**Status: Done**
autoTagElements() generates stable 'auto-tag-{id}' tags for door/window/room/wall with mark, typeName, widthMm, heightMm, roomName, roomNumber fields. annotation.tag-all-by-category palette command. 8 tests in autoTagElements.test.ts. Added by WP-B (wave 11).

#### 4.11.2 Element-Bauelement (element tag: door/window/room tag)
**Status: Done**
placed_tag element with categoryKind, leaderEndMm, fields (mark/typeName/widthMm/heightMm/roomName/roomNumber). Leader line rendered via tagLeaderLineThree(). Tag inspector (inspector-tag-mark editable, inspector-tag-type read-only, inspector-tag-target). 6 tests in tagInspector.test.tsx. Added by WP-B (wave 11).

#### 4.11.3 Material-Bauelement (material tag)
**Status: Done — P2**
`material-tag` ToolId (hotkey `MT`) added. Single-click grammar. Plan renderer draws material name label. Live layer lookup implemented: resolves wallTypeId → layer[layerIndex].materialKey when textOverride is absent.
Wave 26 WP-D: Material tag completion — `leaderEndMm?` and `layerIndex?` fields on `material_tag`; leader line rendered from tag position to `leaderEndMm`; rectangular tag box around material name; inspector with `textOverride` input (`inspector-material-tag-override`), `layerIndex` input (`inspector-material-tag-layer`), resolved material readout (`inspector-material-tag-resolved`). 5 tests in `materialTag.test.ts`.

### 4.12 Übungsfragen
**Status: N/A**

---

## Chapter 5 — Gelände, Höhenausrichtung, Nord-Richtung (terrain, geo, orientation)

### 5.1 Gelände (terrain / toposolid)

#### 5.1.1 Gelände aus Skizze (terrain from sketch: place points at elevation)
**Status: Done — P1**
`terrain-point` tool (hotkey TP, plan mode) implemented (WP-C wave 7): `TerrainPointState`/`reduceTerrainPoint` grammar, PlanCanvas click/Enter/Escape wiring. Click accumulates `HeightSample { xMm, yMm, zMm }` points; Enter commits via `update_toposolid` command. `terrainPointSymbol.ts` renders filled circles (radius 150 mm) with zMm sprite labels in plan view. Inspector "Control Points" section: count readout, clear button, per-point zMm inputs. Tests: `terrainPointTool.test.ts` (5 tests), `terrainPointSymbol.test.ts` (3 tests).

#### 5.1.2 Gelände bearbeiten (edit existing terrain: move points, change elevation)
**Status: Done — P1**
Inspector per-point zMm number inputs (WP-C wave 7) allow editing elevation of existing height samples. `update_toposolid` command patches `heightSamples` array. Clear-all button resets to empty. Existing 3D mesh rebuilds from updated samples via `toposolidHeightMmAtPoint` nearest-neighbour interpolation.

#### 5.1.3 Höhenlinien (contour lines display on terrain)
**Status: Done — P2**
`terrainContourLines.ts` marching-squares algorithm (WP-F wave 7): builds regular sampling grid from heightSamples, interpolates contour crossings per elevation level, returns polylines. `terrainContourPlanThree.ts` renders each polyline as `THREE.Line`; major contours (every 5th) use darker/thicker material. Wired into `symbology.ts` toposolid loop. `contourIntervalMm` field on toposolid element with inspector number input (step 250 mm). Tests: `terrainContourLines.test.ts` (5 tests), `terrainContourPlanThree.test.ts` (3 tests).

#### 5.1.4 Gelände-Ausschnitte (pad / subregion: flatten an area of terrain for building)
**Status: Done — P1**
Wave 15 WP-C: Terrain pad tool grammar fully implemented. `TerrainPadState`/`reduceTerrainPad` polygon-sketch grammar in `toolGrammar.ts` (min 3 points before commit). PlanCanvas wired with click/Enter/double-click/Escape. `buildTerrainPadMesh` in `meshBuilders.terrainPad.ts` uses `THREE.ShapeGeometry` at `elevationMm`. Inspector: `inspector-terrain-pad-elevation`, `inspector-terrain-pad-point-count`, `inspector-terrain-pad-toposolid`. Tests: `terrainPad.test.ts` (5 grammar tests) + `meshBuilders.terrainPad.test.ts` (3 mesh tests).

#### 5.1.5 Baugrube (building pad / excavation cut)
**Status: Done — P1**
Excavation cut in terrain (Baugrube = cut showing the pit for a basement) is implemented. `buildExcavationMesh()` renders the pit walls (ExtrudeGeometry) and floor (ShapeGeometry) in brown earth material (#8B6914). `excavationPlanThree()` draws a dashed boundary + 45° cross-hatch in the plan view. The `'excavation'` tool (hotkey EX) uses a polygon-sketch grammar (`reduceExcavation`) wired in PlanCanvas with click / Enter / double-click / Escape handlers. Inspector panel shows depth input (100–50000 mm, clamped) and computed area in m².

#### 5.1.6 Weitere Geländewerkzeuge (additional terrain tools: merge, split surface, graded region)
**Status: Done — P2**
Wave 17 WP-G: `terrainSplit.ts` — `splitToposolid()` partitions `heightSamples` by cross-product side of a user-drawn polyline, returns two new `toposolid` elements; `terrain-split` tool (hotkey TS) grammar + PlanCanvas wiring. `graded_region` element kind (perimeterMm, lowerElevationMm, upperElevationMm, hostToposolidId) + `graded-region` tool (hotkey GR) polygon-sketch grammar + `gradedRegionPlanThree.ts` plan symbol (45° hatched polygon) + `meshBuilders.gradedRegion.ts` 3D mesh. Palette commands `tool.graded-region` + `tool.terrain-split`. Tests: `terrainSplit.test.ts` (4) + `gradedRegion.test.ts` (4).

### 5.2 Geografische Position (geographic location / georeferencing)
**Status: Done — P1**
Georeference implemented: OSM address autocomplete, map picker (Leaflet), lat/lon stored in project. Georeferencing is wired into the Project Setup (Location/Sun step). OSM site context with bbox rectangle is done.

### 5.3 Projekt auf echte Höhe verschieben (move project to real-world elevation)
**Status: Done — P2**
Wave 17 WP-B: `projectElevationMm` field added to `project_settings`. Palette command `project.set-elevation` prompts for real-world elevation in mm and stores it. Tests in `trueNorth.test.ts`.

### 5.4 Ausrichten nach der Himmelsrichtung (true north orientation)

#### 5.4.1 Nordpfeil (north arrow annotation on sheets)
**Status: Done — P2**
`north-arrow` ToolId (hotkey `NA`) added. Single-click grammar. Core annotation_symbol element type with symbolType north_arrow exists. Sheet canvas renders north_arrow symbols as SVG circle+arrow+N glyph; rotation = element.rotationDeg + project_settings.projectNorthAngleDeg. Wave 15 WP-K polish: `NorthArrowGrammarState`/`reduceNorthArrow` grammar added to `toolGrammar.ts`; Three.js line-based plan symbol for `annotation_symbol` with `symbolType === 'north_arrow'` (shaft + V arrowhead, respects `rotationDeg`). Tests: `northArrow.test.ts` (7 tests including shaft, arrowhead, rotation).

#### 5.4.2 Ansicht auf Nordrichtung drehen (rotate plan view to true north)
**Status: Done — P2**
Wave 17 WP-B: `angleToTrueNorthDeg` on `project_settings`, `planViewAngleDeg` on `plan_view`. Palette command `view.rotate-to-true-north` sets `planViewAngleDeg = -angleToTrueNorthDeg` on the active view; `project.set-true-north` prompts for angle. PlanCanvas applies `grp.rotation.y` from `planViewAngleDeg`. PlanViewHeader shows `↑{angle}°` indicator (`data-testid="plan-view-north-angle"`). Tests in `trueNorth.test.ts` (10) + `PlanViewHeader.trueNorth.test.tsx` (4).

### 5.5 Übungsfragen
**Status: N/A**

---

## Chapter 6 — Ansichten, Pläne und Plot (views, sheets, printing)

### 6.1 Ansichten (views)

#### 6.1.1 Die Grundrisse (floor plan views: create, duplicate, crop)
**Status: Done — P0**
Plan views per level, crop region, plan detail level — all implemented.

#### 6.1.2 Die Deckenpläne (reflected ceiling plan views)
**Status: Done — D1**
Reflected ceiling plans (RCP) are implemented as `planViewSubtype: 'ceiling_plan'`. `resolvePlanViewDisplay` in `planProjection.ts` sets `isRcp: true`, mirrors the X-axis, and adjusts `hiddenSemanticKinds` (floors/roofs hidden, ceilings/beams visible). `PlanViewHeader.tsx` shows the RCP badge. ProjectBrowser groups RCP views under "Deckenansichten". Tests: `ceilingPlanViewHeader.test.tsx` (3 tests) + `planProjection.ceilingPlan.test.ts` (7 tests) all pass.

#### 6.1.3 3D-Ansichten (3D views: orthographic, perspective, section box, locked views)
**Status: Done**
- Standard 3D orthographic/perspective: Done
- ViewCube navigation: Done
- Section box: Done (sectionBox.ts)
- Named locked 3D view (wave 12 WP-G): `Saved3dViewElement` type (`kind: 'saved_3d_view'`) with cameraMm, targetMm, upVector, locked, sectionBox fields. `save_3d_view` / `delete_3d_view` / `restore_3d_view` command types. ProjectBrowser 3D Views group: sorted list, lock icon, double-click to restore, right-click context menu (Restore/Rename/Delete/Lock-Unlock), "Save current view" button (`browser-save-3d-view`). `viewLocked` store state disables orbit controls; "View Locked" badge overlay (`view-locked-badge`) with Unlock button. Section Box from Plan: `view.section-box-from-plan` palette command + `sectionBoxFromPlan` PaletteContext hook. Tests: `saved3dViews.test.ts` (4 tests), `projectBrowserSaved3dViews.test.tsx` (3 tests). Added by WP-G (wave 12).

#### 6.1.4 Außenansichten (elevation views: North, South, East, West)
**Status: Done — P1**
Elevation tool and elevation marker exist. Wave 15 WP-G: `buildElevationLines(view, elementsById)` in `elevationProjection.ts` projects walls and floors into N/S/E/W screen space. `ElevationViewport.tsx` SVG component renders projected lines with `data-testid="elevation-viewport-svg"` / `elevation-viewport-empty`. Wired into Workspace.tsx via tab system: `tabsModel.ts` extended with `'elevation'` TabKind, `CanvasMount.tsx` renders `ElevationModeShell` with `ResizeObserver`. Tests: `elevationProjection.test.ts` (6 tests) + `ElevationViewport.test.tsx` (3 tests).

#### 6.1.5 Innenansichten (interior elevation views)
**Status: Done — P2**
Interior elevation placement: `interior-elevation` tool (hotkey `IE`) added to plan palette. Single-click dispatches `create_interior_elevation_marker` command; server auto-creates four `elevation_view` children (N/S/E/W). `interior_elevation_marker` element type in `@bim-ai/core` with `positionMm`, `levelId`, `radiusMm`, `activeQuadrants?: ('N'|'S'|'E'|'W')[]`, and `elevationViewIds` (N/S/E/W). Plan symbol: 4-quadrant circle with inward arrows rendered in `symbology.ts`. Inspector panel (wave 5 WP-C): radius input (`data-testid="inspector-iel-radius"`), level select (`data-testid="inspector-iel-level"`), quadrant checkboxes (`data-testid="inspector-iel-quadrants"`), drag-grip. Tests in `interiorElevationInspector.test.tsx`. Wave 16 WP-H: `buildElevationLines()` in `interiorElevationProjection.ts` projects walls/floors/openings from the 3D model into 2D screen space for a given N/S/E/W direction; `InteriorElevationViewport.tsx` renders as an SVG with view title. Tests in `interiorElevation.test.ts`. Wave 28 WP-D: material hatch patterns applied to wall fills in SVG — `hatchPatternForMaterial`/`svgHatchDef` imported into `InteriorElevationViewport.tsx`; `<defs>` block with unique material patterns; wall regions filled with `url(#hatch-iel-{materialKey})`; storey height ruler annotation (`<g data-testid="iel-height-ruler">`) at right edge; `view.interior-elevation-hatch` capability; 5 tests in `interiorElevationHatch.test.ts`.

#### 6.1.6 Schnittansicht (section view: cross section, building section)
**Status: Done — P1**
Section tool exists, section views are generated (sectionViewportSvg.tsx). Wave 15 WP-H: `materialHatchPatterns.ts` added with `hatchPatternForMaterial(materialKey)` (8 hatch types: concrete cross-hatch, brick running-bond, wood vertical lines, glass dots, insulation zigzag, earth horizontal+dots, metal diagonal, solid fallback; German key support). `svgHatchDef(pattern, id, scale)` returns SVG `<pattern>` defs. `sectionViewportSvg.tsx` extended: `<defs>` block with 8 SVG patterns, cut-element walls filled with material-based hatch, cut outlines use 2× strokeScale for thicker lines vs beyond-cut. Tests: `materialHatchPatterns.test.ts` (17 tests). Wave 16 WP-C: `sectionBubble.ts` adds filled circle head bubbles at section endpoints (`THREE.CircleGeometry` r=200mm, `userData.sectionBubble=true`, `userData.sectionViewId`); view title + scale label below `sectionViewportSvg`. Tests: `sectionBubble.test.ts`. Wave 23 WP-B: `showLevelLines?: boolean` on `section_cut` + `sectionLevelLines.ts` (`extractLevelData()`, `buildLevelLineSvg()`) + SVG level datum lines injected in `sectionViewportSvg.tsx` when enabled + inspector checkbox (`inspector-section-cut-show-level-lines`) + 6 tests.

### 6.2 Planerstellung (sheet setup: sheet with title block)
**Status: Done — P1**
NewSheetDialog.tsx, SheetCanvas.tsx, SheetReviewSurface.tsx exist (WP-D wave 7). Sheets can be created and views placed on them. Viewport scale labels: `data-testid="sheet-viewport-scale-{id}"` rendered below each viewport rect (shows `vp.scale` or "—"), viewport label text above. SheetViewportEditor scale input field added. Title block `checkedBy` / `issuedBy` fields: `MANAGED_TB_KEYS` extended, resolved from `project_settings.authorName` / `clientName` fallback, rendered as `data-testid="sheet-tb-checked-by"` / `data-testid="sheet-tb-issued-by"`. Tests: `sheetViewportScale.test.tsx` (4 tests), `sheetTitleblockFields.test.tsx` (3 tests).

### 6.3 Plan mit Änderungsliste (sheet with revision table / delta list)
**Status: Done — revision table rendered in title block**
`revision` and `sheet_revision` element types added to `@bim-ai/core`. `ManageRevisionsDialog.tsx` implements CRUD for project revisions and per-sheet assignment via checkboxes (`sheet_revision` join records). Commands: `create_revision`, `update_revision`, `delete_revision`, `add_sheet_revision`, `remove_sheet_revision`. Revision clouds (`revision_cloud` annotation — ANN-03) already existed. `SheetRevisionTableSvg` renders in the bottom-right corner of the title block (via `sheetTitleblockAuthoring.tsx`); `resolveSheetRevisions` joins `sheet_revision` → `revision` records, sorts by number ascending, shows a placeholder "—" row when none are assigned. Tests: `sheetRevisionTable.test.ts` (5 tests). Revision-cloud draw tool (E3): `'revision-cloud'` ToolId (hotkey RC, plan mode), `RevisionCloudState`/`reduceRevisionCloud` grammar, PlanCanvas click/dblclick/Enter/Escape wiring, and `revisionCloudPlanThree` plan renderer (dashed closed polygon, orange default, view-scoped). Tests in `toolGrammar.revisionCloud.test.ts` (5) and `revisionCloudRendering.test.ts` (7).

### 6.4 Detailansichten und Detaillierung (detail views and 2D detailing)

#### 6.4.1 Detailausschnitt (detail callout / enlarged plan area)
**Status: Done — D4**
CalloutMarker.tsx + DetailRegionTool.tsx + callout plan_view with `planViewSubtype: 'callout'` + camera zoom fit to `calloutBoundaryMm` + `elementOverlapsBoundary` filter (wave 19 WP-B). Wave 14 WP-L: callout-view-badge + 1:N scale display. Wave 30 WP-B: `calloutSymbolThree()` in `planElementMeshBuilders.ts` — dashed `LineDashedMaterial` rectangle outline + filled `CircleGeometry` tag at bottom-right corner rendered in parent plan view for all `planViewSubtype: 'callout'` elements; wired in `symbology.ts` rendering pass; `view.callout-reference-symbol` capability; 5 tests in `calloutSymbol.test.ts`.

#### 6.4.2 Detailansicht (detail view: 2D drawing in isolation)
**Status: Done — P2**
Wave 29 WP-B: `'drafting'` added to `planViewSubtype` union; `CreateDraftingViewCmd` in core; Workspace handler creates `plan_view` with `planViewSubtype: 'drafting'` and `levelId: null`; `symbology.ts` skips wall/floor/room/column/stair/beam/roof meshes when `isDraftingView=true` (only `detail_line`/`detail_region`/`detail_component` elements render); ProjectBrowser "Drafting Views" collapsible section with "+ Draft" button (`data-testid="browser-new-drafting-view-btn"`); `annotate.create-drafting-view` capability; 6 tests in `draftingView.test.ts`.

### 6.5 Plot (printing to plotter/printer)
**Status: Done — P1**
Wave 15 WP-J: "Print (Browser)…" button (`data-testid="print-browser-btn"`) added to `PrintPlotDialog.tsx`. `handleBrowserPrint` clones the sheet HTML into a `window.open` popup with all CSS styles copied, calls `win.print()`. "Print All Views (Browser)" button (`data-testid="print-all-views-browser-btn"`) concatenates all sheets with `break-after: page` and `@page { size: A4 landscape; }`. `@media print` rules in `index.css` hide workspace chrome (sidebar, toolbar, inspector, etc.) and show only `[data-testid="sheet-canvas"]`. `file.print-current-view` palette command wired to `ctx.openPrintDialog?.()`. Tests: `PrintPlotDialog.browser.test.tsx` (7 tests).

### 6.6 Übungsfragen
**Status: N/A**

---

## Chapter 7 — Konstruktionshilfen (drafting aids)

### 7.1 Modelllinien (model lines as 3D construction geometry)

#### 7.1.1 Beispiel für Hilfskonstruktion (construction line example)
**Status: Done — P1**
Model lines implemented in the project environment (WP-G wave 13): `model_line` element kind in `@bim-ai/core`, `'model-line'` tool in toolRegistry (hotkey ML, plan+3D), polyline grammar in toolGrammar.ts, plan renderer in `planElementMeshBuilders.ts`, 3D mesh in `meshBuilders.ts`. Tests in `modelLine.test.ts` and `modelLinePlan.test.ts`.

### 7.2 Raster (structural grid lines)
**Status: Done — P0**
Grid tool is in the tool registry. Grid lines with bubble labels, structural grid as reference for column placement — implemented.

### 7.3 Arbeitsebenen (work planes)

#### 7.3.1 Arbeitsebenen erstellen (create work plane by name, pick plane, pick line)
**Status: Done — P1**
Reference planes (reference-plane tool) serve as work planes. Wave 14 WP-J: `SetWorkPlaneDialog.tsx` implemented — lists reference planes, allows selection, dispatches `updateElementProperty` to set `activeWorkPlaneId` on the active plan view. Palette command `view.set-work-plane` registered. Active work plane badge (`data-testid="plan-view-work-plane-badge"`) with clear button shown in `PlanViewHeader.tsx`.

#### 7.3.2 Arbeitsebene ausrichten (orient work plane to face of element)
**Status: Done — P2**
`work_plane` element type + `SetWorkPlaneFaceCmd` + Workspace handler creates `work_plane` from host wall/floor face (computes `normalDeg = (wall.angleDeg + 90) % 360`). `SetWorkPlaneDialog.tsx` with host element selector. `view.set-work-plane-face` capability. 4 tests (WP-B wave 27).

#### 7.3.3 Arbeitsebenenraster für Wandkonstruktion nutzen (work plane grid for wall construction)
**Status: Done — P2**
`SetWorkPlaneDialog.tsx` provides host element selector for walls/floors, creating `work_plane` elements that define the construction plane. Work plane grid overlay tied to `activeWorkPlaneId` on `plan_view`. (WP-B wave 27).

### 7.4 Referenzebenen (reference planes: named, persistent)
**Status: Done — P1**
Reference plane tool, referencePlanePlanRendering.ts — named reference planes are placed and visible in plan.

### 7.5 Übungsfragen
**Status: N/A**

---

## Chapter 8 — Weiteres zu Wänden, Decken, Fußböden und Treppen (advanced wall/floor/stair)

### 8.1 Wände

#### 8.1.1 Wände am Dach beschneiden (attach wall top to roof)
**Status: Implemented — P1**
Implemented — attach/detach grammar + command handlers done. `reduceAttach`/`reduceDetach` state machines in `toolGrammar.ts`; `AttachWallTopCmd`/`DetachWallTopCmd` Python commands added; `top_constraint_host_id`/`top_constraint_host_face` fields on `WallElem` (Python + TS); handler in `engine_dispatch_building_envelope.py` sets/clears host constraint; PlanCanvas wired (`case 'attach'` + `case 'detach'` click handlers + Escape); 13 grammar tests pass (`toolGrammar.attach.test.ts`); existing 4 `meshBuilders.attachWallTop.test.ts` tests continue to pass.

#### 8.1.2 Schichtaufbau (wall layer composition: thermal, structural, finish layers)
**Status: Done — P1**
Wall type catalog with layered materials (meshBuilders.layeredWall.ts, wallTypeCatalog.ts, csgWallMaterial.ts). Multi-layer wall types with independent material per layer are supported.

#### 8.1.3 Teileelemente erstellen (wall parts: segment a wall into independently controllable parts)
**Status: Done**
`parts?: Array<{ id, startT, endT, materialId?, label? }>` data model on `wall` element. "Create Parts" ribbon action. `buildEqualParts(n)` helper. 3D + plan rendering. Inspector (wave 12 WP-B): per-part label input (`inspector-part-label-N`), material select (`inspector-part-material-N`), length read-only (`inspector-part-length-N`), remove button (`inspector-part-remove-N`), "Create Parts" button (`inspector-parts-create`) splits into 3 equal parts. Tests: `wallPartsInspector.test.tsx` (6 tests). Added by WP-B (wave 12).

#### 8.1.4 Fassadenwände (curtain walls: grid, panels, mullions)
**Status: Implemented — P1**
Implemented — inspector + custom grid editing done. Panel grid rendering: done (`meshBuilders.curtainPanels.test.ts`). Plan symbol: done (`curtainWallPlanSymbol.ts`, 4 tests). Inspector extended with H/V count inputs, Panel type dropdown (Glass/Spandrel/Solid), Mullion type dropdown (Rectangular/Circular/None), and "Edit Grid…" button; `customVDivisions` field added to `curtainWallData` type; `curtainWallPlanSymbol.ts` renders custom ticks in priority over uniform grid; `curtainWallPanelType`/`curtainWallMullionType` fields added to Python `WallElem` with `updateElementProperty` handlers; 5 new `curtainWallPlanSymbol.customDivisions.test.ts` tests pass.

#### 8.1.5 Abziehbilder (decals / surface images on wall faces)
**Status: Done — P2**
`'decal'` ToolId (hotkey `DC`, 3D mode only), `DecalState`/`reduceDecal` grammar, `DecalElem` type with placement fields all exist. Wave 15 WP-F: `buildDecalMesh` updated — `decal.imageSrc` checked before `imageAssetsById[decal.imageAssetId]`; magenta `MeshBasicMaterial` (#ff00ff) fallback when no URL; `bimPickId` set on mesh. Plan symbol: rectangle + X diagonals in `symbology.ts`. Inspector `case 'decal'`: file picker (`data-testid="inspector-decal-file-input"`, accept=image/*, FileReader→dataURL→`onPropertyChange`), preview (`inspector-decal-preview`) / no-image placeholder (`inspector-decal-no-image`), width/height inputs (`inspector-decal-width`, `inspector-decal-height`), opacity slider (`inspector-decal-opacity`). Tests: `decalInspector.test.tsx` (6 tests) + `decalMesh.test.ts` (3 tests).

### 8.2 Decken und Lampen (ceilings and light fixtures)
**Status: Done**
Ceiling tool in registry. Light fixture placement works. Wave 12 WP-E: `detectCeilingBoundary()` in `ceilingAutoDetect.ts` — single-click auto-detects enclosing walls on active level (shift-click for manual sketch fallback). Ceiling `gridPatternMm`, `gridOffsetMm`, `gridAngleDeg` fields added to core type. Plan renderer: grid hatch overlay (`THREE.LineSegments`, 0.5px grey, `userData.ceilingGrid`) drawn at `gridPatternMm` spacing. Inspector: grid size input (`inspector-ceiling-grid-size`), grid angle input (`inspector-ceiling-grid-angle`), height input (`inspector-ceiling-height`). Tests: `ceilingAutoDetect.test.ts` (3 tests), `ceilingInspector.test.tsx` (3 tests). Added by WP-E (wave 12).

### 8.3 Fertig-Fußböden (finish floor over structural slab)
**Status: Done — P1**
`floor_type` element type with layer stack (`WallTypeLayer[]`) implemented (WP-G wave 7). `floorTypeId` field on `floor` element. Inspector: dropdown (`data-testid="inspector-floor-type-select"`) listing all `floor_type` elements sorted by name, computed thickness display (`data-testid="inspector-floor-type-thickness"` = sum of layer thicknessMm), "New Floor Type…" button with inline name input (`create_floor_type` command). `computeFloorTypeThicknessMm()` helper in `floorTypeThickness.ts`. Floor mesh builder uses floor type thickness when set. Tests: `floorTypeThickness.test.ts` (4 tests), `floorTypeInspector.test.tsx` (6 tests).

### 8.4 Anpassen von Türen und Treppen (adjusting door/stair clearances)
**Status: Done — P1**
Door clearance (hostedOpeningDimensions.ts, openingClearance.ts) is implemented for detection/advisory. Stair auto-balance (stairAutobalance.ts) adjusts run widths. Wave 17 WP-D: `checkHeadHeightClearances()` scans all doors/windows/stairs on active level, returns `ClearanceViolation[]` (with required vs actual clearance, message). `buildClearanceViolationMarkers()` renders red circles at violations in the plan. `ClearanceViolationPanel.tsx` shows count + per-violation list with close button. Palette command `analysis.check-clearances`. Tests: `openingClearance.test.ts` (10) + `ClearanceViolationPanel.test.tsx` (6).

### 8.5 Geschossebenen vervielfältigen (multiplying levels)

#### 8.5.1 Geschossebene einzeln hinzufügen (add a single new level)
**Status: Done — P0**
Levels can be added via LevelStack.

#### 8.5.2 Mehrere Geschossebenen mit Reihe-Funktion (add multiple levels with array)
**Status: Done — G1**
"Add Multiple…" button in LevelStack sidebar opens dialog with Count (default 3), Spacing mm (default 3000), Name prefix (default "Ebene"). Dispatches N createLevel commands sequentially. 6 tests.

### 8.6 Treppen (detailed stair authoring)

#### 8.6.1 Erstellen einer kompletten Treppe (stair by component: run + landing assembly)
**Status: Done — P0**
Full stair assembly via component (run + landing + railing) works.

#### 8.6.2 Treppe nach Bauteil (stair by component: individual components)
**Status: Done — P1**
Component-by-component stair authoring is supported. Wave 19 WP-A: `stair_run`/`stair_landing` element types with `parentStairId`. Wave 22 WP-C: `getStairComponents(stairId, elementsById)` in `stairComponentList.ts` collects linked runs/landings; `StairAssemblySection` component in `InspectorContent.tsx` — collapsible `<details>` showing all runs (riserCount, runWidthMm) and landings (depthMm) with Remove buttons; `inspector-stair-add-run-btn` and `inspector-stair-add-landing-btn` dispatch addStairRun/addStairLanding commands. Tests: `stairComponentList.test.ts` (5 tests).

#### 8.6.3 Treppe nach Skizze (stair by sketch: boundary line + run line)
**Status: Done — P1**
StairBySketchCanvas.tsx exists. Wave 17 WP-H: `classifyStairShape()` in `stairMultiRunDetector.ts` classifies 3-point input as straight / l_shape / u_shape via cross-product angle. `buildMultiRunStairConfig()` distributes riser count across runs and sets landing at corner. Stair sketch grammar updated for straight (2-click), L-shape and U-shape (3-click) configurations. `stair.runs[]` field carries per-run geometry. Tests: `stairMultiRunDetector.test.ts` + `stairBySketch.test.ts`.

#### 8.6.4 Standard-Treppe umbauen (edit an existing stair)
**Status: Done — P1**
Grips on existing stairs for editing rise/run count, width: Done. Wave 16 WP-F: `stairGripProvider.ts` adds riser-count grip (top-centre, drag ±1 per 175mm) and run-width grip (right side, drag to adjust width, floor 600mm); `stairMultiRunDetector.ts` detects L-shape/U-shape from 3-point sketch. Inspector inputs for `riserCount`, `runWidthMm`, `landingDepthMm`, `totalHeightMm`, `riserHeightMm`, `multiStorey` added. Tests: `stairGrips.test.ts` (9) and `stairInspector.test.tsx` (14). Wave 19 WP-J: `enterStairEditMode`/`exitStairEditMode`/`updateStairRun` commands + Workspace handlers + inspector "Edit Stair" toggle + per-run riser/width editors. Wave 24 WP-B: `FlipStairCmd` type + `flipStair` Workspace handler (mirrors run geometry about bounding box center) + inspector "⇔ Flip H" / "⇕ Flip V" buttons (`inspector-stair-flip-h/v`) + `modify.flip-stair` palette command + 5 geometry tests.

#### 8.6.5 Treppen für mehrere Geschosse vervielfachen (multi-storey stair)
**Status: Done — G1**
multiStorey: true field on stair element; collectFloorElevations() finds all intermediate levels; makeMultiRunStairMesh stacks geometry segment-per-floor; multiStoreyStairTotalHeightMm in schedule readout. 2 tests verify mesh height reaches top elevation.

### 8.7 Geländer (railings)
**Status: Done — P0**
Railing tool is in the tool registry. Railing along stair, railing on edge, railing materials — implemented.

### 8.8 Rampen (ramps)
**Status: Done — G1**
Ramp tool in toolRegistry (hotkey RA, plan mode). 'ramp' ElemKind in core with widthMm, runMm, slopePercent, runAngleDeg, hasRailingLeft/Right, topLevelId, material. meshBuilders.ramp.ts builds sloped 3D surface + railing lines. rampPlanSymbol.ts draws plan outline + uphill arrows. ADA slope warning at >8.33%. 6 mesh tests, all passing.

### 8.9 Gruppen verwenden (model groups)

#### 8.9.1 Gruppen erstellen (group selected elements)
**Status: Implemented (WP-B wave 2)**
`GroupRegistry` (definitions + instances) now in Zustand store (`StoreState.groupRegistry` + `setGroupRegistry`). `CreateGroupDialog.tsx` — modal dialog prompted by `model.create-group` Cmd+K palette command when ≥2 elements selected; computes centroid origin, validates name, calls `applyCreateGroup`, persists via `setGroupRegistry`. `model.ungroup` palette command removes a group instance from the registry. `groupCommands.test.ts` has 21 passing unit tests. **B2**: `plan/groupInstanceRender.ts` (`buildGroupInstancePlanMesh`) renders a dashed bounding-rectangle per group instance in plan view — wired into `symbology.ts` `rebuildPlanMeshes` with `groupRegistry` opt; 4 unit tests pass. **B5**: `ProjectBrowserGroupsGroup` component added to `ProjectBrowser.tsx` — collapsible "Groups" subtree with instance-count badges, inline rename (via `applyRenameGroup`), and right-click context menu (Rename / Select All Instances).

#### 8.9.2 Gruppen einfügen (place a group instance)
**Status: Implemented (WP-B wave 2)**
`placeGroup` command shape + `applyPlaceGroup` logic exist in `groupCommands.ts`. `'place-group'` ToolId is registered in `toolRegistry.ts` and `tool.place-group` palette command activates the tool. **B4**: `PlaceGroupState`/`reducePlaceGroup` grammar added to `toolGrammar.ts` — handles activate/deactivate/select-definition/click/cancel events, emits `commitPlaceGroup` effect; wired into `PlanCanvas.tsx` click and Escape handlers dispatching `placeGroup` semantic command. **B3**: `viewport/groupInstance3d.ts` (`buildGroupInstance3d`) applies per-instance offset transform (insertionXMm − originXMm) and delegates to existing 3D mesh builders (wall/door/window/column/beam); wired into `Viewport.tsx` via a dedicated `useEffect` over `groupRegistry`.

#### 8.9.3 Gruppen bearbeiten (edit group contents)
**Status: Done**
`editGroup`/`finishEditGroup` command shapes in `groupCommands.ts`. Wave 12 WP-A: edit-mode UI added — non-group elements ghosted (50% opacity) in plan canvas, selection restricted to members of the active group, "Finish Editing Group" overlay button (`data-testid="finish-edit-group"`) dispatches `finishEditGroup`. `activeEditGroupId` store state drives all three behaviors. Tests: `groupEditMode.test.tsx` (3 tests). Added by WP-A (wave 12).

### 8.10 Übungsfragen
**Status: N/A**

---

## Chapter 9 — Tragwerke (structural elements)

### 9.1 Stützen (columns)

#### 9.1.1 Stützenarten (architectural vs structural columns)
**Status: Done — P1**
Architectural vs structural column distinction implemented (WP-D wave 13): `columnUsage` field (`'architectural' | 'structural'`) on column element in `@bim-ai/core`. Options bar toggle, inspector panel, and different 3D material per usage type. Tests in `columnUsageInspector.test.tsx`.

#### 9.1.2 Raster für Stützen (column at grid intersections)
**Status: Done — G3**
`column-at-grids` tool (hotkey CAG, plan-only) fully implemented. Grammar: `ColumnAtGridsState` state machine in toolGrammar.ts; PlanCanvas.tsx wires click→toggleGrid and Enter→confirm→`columnPositionsAtGridIntersections`→N `createColumn` commands. `columnAtGrids.ts` helper with intersection math. Options bar section (column type select, level select, intersection count badge) added (WP-C wave 13). Visual highlight of selected grids (thicker blue overlay + filled bubble) and intersection preview dots implemented. Tests in `columnAtGrids.test.ts`, `columnAtGridsHighlight.test.ts`, `optionsBarColumnAtGrids.test.tsx`.

#### 9.1.3 Nichttragende Stützen (non-structural columns: pilasters, casing)
**Status: Done — P2**
Non-structural decorative columns can be placed. Wave 28 WP-B: `isNonStructural?: boolean` field on `column` element; `ToggleColumnStructuralCmd` type; Workspace `toggleColumnStructural` handler flips the flag; `columnPlanThree` in `symbology.ts` renders non-structural columns with dashed `LineDashedMaterial` outline (color `0x6b7280`, dashSize=0.04) instead of solid fill; inspector "Non-structural (architectural)" checkbox (`data-testid="inspector-column-non-structural"`); `modify.toggle-column-structural` palette command; `modify.toggle-column-structural` capability; 5 tests in `nonStructuralColumn.test.ts`.

#### 9.1.4 Geneigte Stützen (sloped columns)
**Status: Implemented — sloped column data model + mesh + plan symbol + inspector**
`topOffsetXMm` and `topOffsetYMm` optional fields added to column element in `@bim-ai/core`. `makeColumnMesh()` in `meshBuilders.ts` now shears top vertices of the BoxGeometry by the offset when non-zero. Plan symbol added in `symbology.ts` (`columnPlanThree`): solid base footprint with cross diagonal, plus dashed top footprint and centre-to-centre diagonal line for sloped columns. 5 tests passing (straight regression, top vertex shift, bottom vertex unaffected, zero-offset no-op, Mesh instance check).

### 9.2 Träger (beams)
**Status: Done — P1**
Beam tool is in the registry. Beam placement between columns/walls works. Wave 14 WP-B: full section profile support added — `beamProfileType` field (I-beam, H-beam, HSS-round, HSS-square, rectangular) in inspector (`InspectorContent.tsx` §9.2 section). `beamProfileMesh.ts` builds correct THREE.js geometry per profile type (`ExtrudeGeometry` for I/H, `TubeGeometry` for HSS-round, `BoxGeometry` for rectangular/HSS-square). Wired into `makeBeamMesh` in `meshBuilders.ts`. Tests in `beamProfileMesh.test.ts` (8 tests) + `beamProfileInspector.test.tsx`.

### 9.3 Trägersysteme (beam systems: auto-fill framing between beams)
**Status: Done**
`beam_system` element with spacingMm, directionDeg, beamCount, beamTypeId, justification fields. OptionsBar section (spacing, direction, justification). Inspector panel (spacing, direction, beam count, justification, level). UpdateBeamSystemCmd handler. Full tool registration in all 4 places. Added by WP-G (wave 10).

### 9.4 Streben (braces / diagonal structural members)
**Status: Implemented — G1**
Brace element added: `kind: 'brace'` in core Element union, `'brace'` tool in toolRegistry (hotkey BR, plan+3D modes), 3D mesh builder, plan symbol, and Vitest tests.

### 9.5 Stahlbau-Funktionen (steel fabrication tools)

#### 9.5.1 Verbindungen erstellen und ändern (steel connections: end plates, bolted flanges)
**Status: Done — P1**
`steel_connection` element type in core, `'steel-connection'` tool (hotkey SC, plan mode), `CreateSteelConnectionCmd`, `buildSteelConnectionMesh()` renderer, and plan symbol implemented (wave 6 WP-B). Wave 15 WP-B: Inspector panel with `data-testid="inspector-steel-connection"` — connection type select, plate width/height/thickness inputs, bolt rows/cols/diameter inputs, host element read-only display.

#### 9.5.2 Listen für Verbindungselemente (connection element schedules)
**Status: Done — P2**
Wave 15 WP-B: `'steel_connection'` added to `SchedulePresetCategory`. `steel_connections` preset in `scheduleDefinitionPresets.ts` with 7 fields: `connectionType` (required), `hostElementId`, `targetElementId`, `boltRows`, `boltCols`, `boltDiameterMm`, `count` (aggregation: 'count'). Tests: `steelConnectionSchedule.test.ts` (5 tests).

#### 9.5.3 Fertigungselemente und Modifikationen (fabrication parts, cope/notch)
**Status: Not Started — P2**
No steel fabrication elements.

#### 9.5.4 Parametrische Schnitte (parametric section cuts for steel profiles)
**Status: Not Started — P2**
No parametric steel section families.

### 9.6 Übungsfragen
**Status: N/A**

---

## Chapter 10 — Dachformen (roof forms)

### 10.1 Verschiedene Dachformen (standard roof types by footprint)

#### 10.1.1 Walmdachformen (hip roof)
**Status: Done — P0**
meshBuilders.hipRoof.test.ts — hip roof geometry implemented.

#### 10.1.2 Satteldachformen (gable / saddle roof)
**Status: Done — P0**
Gable roof via roof by footprint with two edges set to "no slope" — works.

#### 10.1.3 Dächer mit Neigungspfeil (roof with slope arrow instead of slope-per-edge)
**Status: Done — P1**
Wave 14 WP-C: `roof_slope_arrow` element type in `@bim-ai/core`. Plan symbol (`roofSlopeArrow.test.ts`, 4 tests), inspector panel (`roofSlopeArrowInspector.test.tsx`, 3 tests), and 3D mesh (`meshBuilders.ts` via `buildRoofSlopeArrowMesh`) all implemented. Placed via `roof-slope-arrow` tool on an active roof sketch. Arrow renders in plan with tail-to-head direction and slope label.

### 10.2 Dächer über Extrusion (roof by extrusion / profile sweep)
**Status: Implemented — P1**
`'roof-by-extrusion'` ToolId (hotkey `RE`, plan mode) added to `toolRegistry.ts` and `PALETTE_ORDER`. `RoofByExtrusionState` / `reduceRoofByExtrusion` grammar state machine added to `toolGrammar.ts`: idle → recording (click to collect profile points) → confirm-depth (Enter/double-click with ≥2 pts) → createRoofByExtrusion effect → dispatches `createRoof` command with `extrusionDepthMm`. PlanCanvas wired: activation, click handler, Enter (recording→confirm-depth; confirm-depth→createRoof), Escape, numeric depth input. `extrusionDepthMm?` field added to roof element in `packages/core/src/index.ts`. 5 grammar tests in `toolGrammar.roofByExtrusion.test.ts`.

### 10.3 Sonderformen (special roof shapes)

#### 10.3.1 Kegeldach (conical roof)
**Status: Done — P2**
Wave 15 WP-A: `conical_roof` element kind in `@bim-ai/core` (`centerMm`, `baseRadiusMm`, `heightMm`, `baseElevationMm`). `buildConicalRoofMesh` in `meshBuilders.coneRoof.ts` uses `THREE.LatheGeometry` (open bottom). Plan symbol: circle outline + crosshair. Tool `'conical-roof'` (hotkey `CR`, plan mode) with 2-click center→radius grammar. Inspector: base radius, height, base elevation. Palette command `tool.conical-roof`. Tests: `meshBuilders.coneRoof.test.ts`.

#### 10.3.2 Weitere Rotationssymmetrische Dächer (dome, onion dome)
**Status: Done — P2**
Wave 15 WP-A: `dome_roof` element kind (`centerMm`, `baseRadiusMm`, `riseRatio`, `baseElevationMm`). `buildDomeRoofMesh` uses `THREE.LatheGeometry` with arc profile (riseRatio 0.1–1.0). Tool `'dome-roof'` (hotkey `DM`). Inspector: base radius, rise ratio, base elevation. Plan symbol: circle + crosshair.

#### 10.3.3 Turmhelme (spire / tower cap roofs)
**Status: Done — P3**
Wave 15 WP-A: `spire_roof` element kind (`centerMm`, `baseRadiusMm`, `heightMm`, `baseElevationMm`). `buildSpireRoofMesh` uses `THREE.LatheGeometry` with narrow taper profile (tapering to 0 at top). Tool `'spire-roof'` (hotkey `SI`). Inspector: base radius, height, base elevation. Plan symbol: circle + crosshair.

### 10.4 Dachgauben (dormers)
**Status: Done — P1**
dormerMesh.ts, dormerRoofCut.ts, dormerPlanSymbol.ts — dormer modeling is implemented and was actively maintained (modified in current branch).

### 10.5 Übungsfragen
**Status: N/A**

---

## Chapter 11 — Konzeptionelles Design (conceptual design / massing)

### 11.1 Volumenkörper erstellen (project bodies / mass volumes)
**Status: Implemented — P1**
meshBuilders.mass.ts and meshBuilders.mass.test.ts exist. Three new in-place mass primitive element types are now implemented: `mass_box` (G5a, box mass primitive), `mass_extrusion` (G5b, polygon footprint extruded to height), and `mass_revolution` (G5c, profile revolved around an axis). Mesh builders in meshBuilders.massBox.ts, meshBuilders.massExtrusion.ts, and meshBuilders.massRevolution.ts; plan symbols in massVolumePlanSymbol.ts; tool IDs `mass-box`, `mass-extrusion`, `mass-revolution` registered in toolRegistry.ts. Full Revit conceptual massing environment workflow (Körper & Grundstück tab) is Not Started as a dedicated workflow.

### 11.2 Dächer erzeugen (generate roof from mass face)
**Status: Implemented (G6) — P1**
"Roof by Face" — core type `MassFaceRef` added; `massFaceRef` field on the roof element; `getMassFaceCorners`, `getMassFaceCount`, `getMassFloorBoundaryAtElevation`, `isMassFaceVertical`, `isMassFaceHorizontal` utilities in `massByFace.ts` with full test coverage.

### 11.3 Fassaden und Wände erzeugen (generate walls/facades from mass face)
**Status: Implemented (G7) — P1**
"Wall by Face" — `massFaceRef` field added to wall element; side-face geometry utilities in `massByFace.ts` support identifying and extracting vertical mass faces for wall placement.

### 11.4 Körpergeschosse und Geschossdecken erstellen (floor slabs from mass levels)
**Status: Implemented (G8) — P1**
"Floor by Face" / body levels (Körpergeschosse) — `computeFloorsByLevel` in `massFloorsByLevel.ts` computes floor boundaries at each project level that intersects the mass volume, with full test coverage.

### 11.5 Konzeptionelles Design am Beispiel eines einfachen Hauses (full massing → BIM workflow)
**Status: Done — P1**
Wave 14 WP-D: full massing → BIM workflow implemented. `massGenerateBim.ts` provides `generateWallsFromMass`, `generateFloorsFromMass`, `generateRoofFromMass`. Palette commands `mass.generate-walls`, `mass.generate-floors`, `mass.generate-roof`, `mass.generate-all` registered in `defaultCommands.ts`. Handlers in `Workspace.tsx` dispatch semantic commands from selected mass element. Tests in `massGenerateBim.test.ts` (covers all three generators). Wave 16 WP-E: `generateCurtainWallsFromMass()` added — iterates mass footprint edges, generates wall elements with `curtainWallData: { gridH: 2, gridV: 3, panelType: 'glass', mullionType: 'rectangular' }`. Palette command `mass.generate-curtain-walls`. Tests in `massGenerateCurtainWalls.test.ts` (5 tests).

### 11.6 Übungsfragen
**Status: N/A**

---

## Chapter 12 — Import – Export

### 12.1 Import-Funktionen

#### 12.1.1 Verknüpfungen (link Revit files, IFC files, CAD files, point clouds)
**Status: Done — P1**
- Link another bim-ai model file: Done — `link_model` element type in `@bim-ai/core`; `ManageLinksDialog.tsx` provides full UI to add/delete/align/pin linked models; `linkedGhosting.ts` ghosts linked meshes with blue tint at 0.6 opacity; linked elements are non-selectable/non-editable (`isLinkedElementId` guards in Viewport.tsx); `hidden?` toggle wired via ProjectBrowser; ghosting tests in `src/viewport/linkedGhosting.test.ts` and `src/export/linkedModelGhosting.test.ts` (E5)
- Link IFC: Done (wave 19 WP-C) — `link_ifc` element type + `addIfcLink`/`removeIfcLink`/`toggleIfcLinkVisibility` commands + ManageLinksDialog IFC section + ghost rendering via `applyLinkedGhosting` + ProjectBrowser Linked IFC subtree
- Link CAD (DWG/DXF/DGN): DXF underlay exists (dxfUnderlay.ts — Partial); circle, text, and hatch entities now rendered (E6)
- Link PDF: Done — `link_pdf` element type + `AddPdfLinkCmd`/`RemovePdfLinkCmd`/`TogglePdfLinkCmd` + Workspace handlers + ManageLinksDialog PDF section (file picker, opacity slider, toggle/remove buttons) + `file.link-pdf` palette command. 5 tests (WP-A wave 27).
- Point cloud: Done (wave 31 WP-E) — `link_pointcloud` element type in core (`name`, `color?`, `visible?`, `pointCount?`); `AddPointCloudCmd`/`RemovePointCloudCmd`/`TogglePointCloudCmd` in core + Workspace handlers; ManageLinksDialog "Point Clouds" collapsible section (`data-testid="manage-links-pointcloud-section"`) with visibility checkbox (`pc-link-visible-{id}`), Remove button (`pc-link-remove-{id}`), Add button (`pc-link-add`); `file.link-pointcloud` capability; 7 tests in `pointCloudLink.test.ts`.

#### 12.1.2 Importieren (import CAD / IFC into project)
**Status: Done — P1**
- Import DXF as underlay: Done (dxfUnderlay.ts)
- Import DWG: Partial (uses same DXF path)
- Import IFC: **Done (WP-A wave 16)** — pure-TS ISO 10303-21 STEP parser (`ifcParser.ts`) + converter (`ifcImportConverter.ts`) mapping IFCWALL→wall, IFCSLAB→floor, IFCSPACE→room, IFCDOOR→door, IFCWINDOW→window, IFCBUILDINGSTOREY→level with `levelId` assignment via `IFCRELCONTAINEDINSPATIALSTRUCTURE`. `IfcImportDialog.tsx` with file picker + preview count. Palette command `file.import-ifc`. Tests in `ifcParser.test.ts` (5) and `ifcImportConverter.test.ts` (7).
- Import SKP (SketchUp): Not Started
- Import gbXML: Not Started

#### 12.1.3 Aus Bibliothek laden (load family from Revit library / online)
**Status: Done — P1**
Family library panel with internal and external catalogs. Loading Revit *.rfa binary format is not supported (platform limitation). Wave 29 WP-C: BIMobject online library integration — `bimobjectCatalog.ts` with 12 manufacturer items (Vitra, Wilkhahn, Grohe, Geberit, Schüco, Louis Poulsen, etc.) + `searchBimobjectCatalog()` + FamilyLibraryPanel "BIMobject" section with search/place — serves as the online library equivalent.

### 12.2 Nützliche CAD-Importe

#### 12.2.1 Grundrisse aus CAD (using a CAD floor plan as underlay for tracing)
**Status: Done — P1**
DXF underlay (dxfUnderlay.ts) + ImageTraceDropZone.tsx — importing a CAD/image underlay to trace over is implemented. Entity support: line, polyline, arc (tessellated), circle, text, and hatch boundary loops (E6).

#### 12.2.2 Geländevolumenkörper aus CAD (terrain mesh from CAD contours)
**Status: Done — P2**
Wave 16 WP-I: `dxfContourImport.ts` — minimal DXF tokeniser targeting LWPOLYLINE, POLYLINE+VERTEX, LINE entities; auto-detects metres vs mm (×1000 when max coord < 1000). `dxfContoursToHeightSamples()` flattens polylines to `{ xMm, yMm, zMm }[]`. `createToposolidFromDxf()` builds a `toposolid` element with bounding-box `perimeterMm` and `heightSamples`. `DxfImportDialog.tsx`: file picker + live contour count preview + Import/Cancel. Palette command `file.import-dxf-terrain`. Tests in `dxfContourImport.test.ts` (15 tests).

#### 12.2.3 BIM-Import aus Inventor (ADSK exchange format for Inventor interop)
**Status: Not Started — P3**
Autodesk Inventor *.adsk / *.iam interop is not relevant to bim-ai's web context.

### 12.3 Internet-Bibliotheken nutzen: BIMobject (loading families from BIMobject.com)
**Status: Done — P2**
Wave 29 WP-C: `bimobjectCatalog.ts` with `BimobjectItem` interface + `BIMOBJECT_CATALOG` (12 manufacturer items: Vitra chair, Wilkhahn table, USM sofa, Steelcase desk, Grohe sink, Geberit toilet, Jeld-Wen door, Schüco window, Louis Poulsen pendant, Zehnder radiator, String shelf, Bulthaup kitchen) + `searchBimobjectCatalog(query)` filter. `FamilyLibraryPanel.tsx` extended with "BIMobject" collapsible section — `data-testid="bimobject-search-input"`, emoji thumbnail cards, `data-testid="bimobject-item-{id}"` Use buttons. `file.bimobject-catalog` capability. 6 tests in `bimobjectCatalog.test.ts`.

### 12.4 Export-Funktionen

#### 12.4.1 CSV-Export von Bauteillisten (schedule/quantity CSV export)
**Status: Done — P1**
Client-side CSV export implemented in `export/csvExporter.ts`. Copy to Clipboard also supported. Server-side CSV was already in place; client-side `generateCsv`, `downloadCsv`, and `copyCsvToClipboard` functions added. A "Copy" button added to `SchedulePanel.tsx` next to the existing CSV button.

#### 12.4.2 Export mit deutschsprachigen Layern (DWG export with custom layer mapping)
**Status: Done — P2**
Wave 28 WP-C: `dxfLayerMapping?: Record<string, string>` on `project_settings`; `SetDxfLayerMappingCmd` (type `setDxfLayerMapping`, `mapping` partial update) + Workspace handler; `resolveLayerName(defaultName, mapping?)` helper in `dxfExporter.ts` + `layerMapping?` param on `DxfExportOptions`; all 9 layer names (A-WALL, A-DOOR, A-GLAZ, A-AREA, S-GRID, A-ANNO-DIMS, A-REFP, S-COLS, S-BEAM) resolved through override map at emit time; collapsible "Layer Names" `<details>` editor in ProjectMenu.tsx with `data-testid="dxf-layer-name-{LAYER}"` inputs; `file.dxf-layer-mapping` capability; 5 tests in `dxfLayerMapping.test.ts`.

#### 12.4.3 Exportieren nach CAD (DWG/DXF/DGN export) + IFC Export
**Status: Done — P1**
Wave 31 WP-D: DGN export — `packages/web/src/export/dgnExporter.ts` exports `exportSceneToDgn(elementsById, levels, options?)` which wraps `exportToDxf()` per level in a DGN seed header (`; DGN SEED FILE` + ISO timestamp + level names + units); `DGN_MIME_TYPE = 'application/dgn'`; `dgnFileName()` sanitises project name to `*.dgn`; `handleExportDgn` callback in `Workspace.tsx`; "Export DGN (MicroStation)…" `<MenuItem data-testid="export-dgn-button">` in `ProjectMenu.tsx`; `file.export-dgn` capability; 6 tests in `dgnExporter.test.ts`. DWG export (wave 5 WP-F): `exportSceneToDwg()` in `dwgExport.ts` produces a DXF string with `AC1015` (R2000) HEADER section and `.dwg` extension + `application/acad` MIME type — functionally a text DXF, not true binary DWG, but sufficient for most CAD import flows. "Export DWG" button added (`data-testid="export-dwg-button"`). 2 tests in `dwgExport.test.ts`. True binary DWG (OpenDesign/ODA format) is still not implemented.

IFC 2x3 export (E1): Implemented as a pure-TypeScript ISO 10303-21 STEP writer at `packages/web/src/export/ifcExporter.ts`. Exports `IFCPROJECT`, `IFCSITE`, `IFCBUILDING`, `IFCBUILDINGSTOREY` hierarchy plus `IFCWALLSTANDARDCASE`, `IFCDOOR`, `IFCWINDOW`, `IFCOPENINGELEMENT`, `IFCRELVOIDSELEMENT`, `IFCSLAB` (FLOOR/ROOF), `IFCSPACE`, `IFCBEAM`, `IFCCOLUMN`, `IFCSTAIR`, `IFCRAILING` (`.BALUSTRADE.`). Includes `IFCMATERIALLAYERSETUSAGE` per wall, and standard Psets: `Pset_WallCommon`, `Pset_DoorCommon`, `Pset_WindowCommon`, `Pset_SlabCommon`, `Pset_SpaceCommon` (with `NetFloorArea` / `GrossFloorArea` from polygon area). No WASM dependency. 11 passing tests in `ifcExporter.test.ts` including round-trip header validation. Menu trigger wired in `ProjectMenu.tsx` ("Export → IFC 2x3…" item, testId `project-menu-export-ifc`) with blob download from `Workspace.tsx` `handleExportIfc` callback. Wave 23 WP-C: added IFCBEAM, IFCCOLUMN, IFCSTAIR, IFCRAILING entity types + 4 new tests.

DXF export (E2): Implemented at `packages/web/src/export/dxfExporter.ts`. Exports per-level plan views with walls (A-WALL), doors (A-DOOR + arc swing), windows (A-GLAZ), rooms (A-AREA), grid lines (S-GRID with bubble circle), reference planes (A-REFP), linear dimensions (A-ANNO-DIMS with extension lines + label), and text notes (A-ANNO). Multi-level export supported (one DxfPlanView per level). 8 passing tests in `dxfExporter.test.ts`. Menu trigger wired in `ProjectMenu.tsx` ("Export → DXF/DWG…" item with collapsible options panel: level selector + mm/m units dropdown, testId `project-menu-export-dxf`) with per-level blob downloads from `handleExportDxf` in `Workspace.tsx`.
Wave 25 WP-E: ACI layer color assignments added — `LAYER_ACI_COLORS` map: A-WALL=7, A-DOOR=1, A-GLAZ=3, A-AREA=4, S-GRID=8, A-ANNO-DIMS=2, A-REFP=6, S-COLS=5, S-BEAM=5. DXF LAYER TABLE entries now include group code 62 with ACI color number. 5 tests in `dxfLayerColors.test.ts`.

#### 12.4.4 Revit-Modell in Inventor verwenden (Revit → Inventor workflow)
**Status: N/A**
Desktop-to-desktop Autodesk workflow. Not applicable.

#### 12.4.5 PDF-Export (PDF from sheets)
**Status: Done — P1**
Print to PDF from sheets: `PrintPlotDialog.tsx` + `exportSheetsToPdf` exist. Wave 14 WP-L added "Print All Sheets" button (`data-testid="print-all-sheets-btn"`) that batches all valid sheet elements through `exportSheetsToPdf`. Paper size and orientation selectors already present. Single-sheet export is Done; multi-sheet batching now Done; plotter/physical printer output remains Not Started.
Wave 25 WP-E: Per-sheet orientation override added — `sheetOrientations` state (`Record<string, 'portrait' | 'landscape'>`) in PrintPlotDialog, per-sheet `<select data-testid="sheet-orientation-{sheet.id}">` dropdowns, effective orientation = per-sheet override ?? global. Page number injection: `addPageToPdf` extended with `pageIndex`/`totalPages` params; page number text element rendered in bottom margin. `file.export-pdf` capability + `registerCommand`. 8 tests (3 in `pdfSheetOrientation.test.ts` + 5 in `dxfLayerColors.test.ts`).

### 12.5 Autodesk Construction Cloud (ACC / BIM 360 cloud sync)
**Status: N/A**
Autodesk cloud product integration. bim-ai is its own cloud platform.

### 12.6 Übungsfragen
**Status: N/A**

---

## Chapter 13 — Auswertungen (schedules & analysis)

### 13.1 Räume und Raumstempel (rooms and room tags)

#### 13.1.1 Raumtrennung (room separation lines)
**Status: Done — P0**
Room separation sketch (room-separation-sketch tool) is in the registry.

#### 13.1.2 Raumstempel (room tags with area, name, number)
**Status: Done — P1**
Room tags fully implemented (WP-E wave 13): `roomTagRenderer.ts` displays name, number, and area in plan view. Inspector show/hide toggles for each field. `autoTags.ts` auto-places tags on room creation. Tests in `roomTagRenderer.test.ts` and `roomTagInspector.test.tsx`.

#### 13.1.3 Farbenlegenden (color fill legend: rooms colored by department, area, etc.)
**Status: Done — P1**
roomSchemeColor.ts, roomColorSchemeLegendReadout.ts exist. `ColorSchemeDialog.tsx` (pick scheme category: name/department/area/occupancy) wired into `PlanViewHeader.tsx`. Tests in `colorScheme.test.ts` pass. Wave 14 WP-E: `ColorSchemeLegend.tsx` overlay panel rendered on the plan canvas when a color scheme is active. Legend toggle button (`data-testid="plan-view-legend-toggle"`) in `PlanViewHeader.tsx`. `buildRoomColorSchemeLegend()` derives legend rows from `roomColorSchemeLegendReadout.ts`. Tests in `colorSchemeLegend.test.tsx`.

#### 13.1.4 Nettoflächen (net areas: floor finish area, wall area, etc.)
**Status: Done — P1**
Wave 14 WP-F: `roomNetAreaM2()` in `roomArea.ts` computes net area (gross outline minus column footprints via point-in-polygon). Displayed in room inspector (`InspectorContent.tsx` §13.1.4 row). Tests in `roomNetAreaInspector.test.tsx`. Room finish schedule (`roomFinishScheduleEvidenceReadout.ts`) remains Partial.

### 13.2 Geschossflächen (floor area: gross building area by level)
**Status: Implemented — P1**
`buildLevelAreaReport(elementsById)` in `scheduleLevelDatumEvidenceReadout.ts` computes `LevelAreaRow[]` with `levelId`, `levelName`, `grossAreaM2` (shoelace formula on floor boundary), `netAreaM2` (gross minus column footprints via point-in-polygon). `FloorAreaReportPanel.tsx` (wave 5 WP-F) renders a table with Level / Gross Area (m²) / Net Area (m²) columns, `data-testid="floor-area-report-panel"`, per-row `data-testid="floor-area-row-{levelId}"`, "No levels with floor areas" empty state, "Export CSV" button (`data-testid="floor-area-export-csv"`). Wired into schedule mode shell as "Floor Areas" tab. 5 tests in `FloorAreaReportPanel.test.tsx`.

### 13.3 Elementlisten (element schedules / quantity takeoffs)

#### 13.3.1 Neu möblieren und Möbelliste erstellen (furniture placement + furniture schedule)
**Status: Done — P1**
Component tool (component in registry) allows placing furniture. Wave 14 WP-F: `'furniture'` preset added to `scheduleDefinitionPresets.ts` with fields: name, typeName, levelId, widthMm, depthMm, heightMm, count (aggregate). `SchedulePanel` renders the furniture schedule using the same grid as other schedule presets. Tests in `furnitureSchedulePreset.test.ts`.
Wave 15 WP-D polish: filter text input (`data-testid="schedule-filter-input"`, placeholder "Filter…") added to SchedulePanel header, applies `filterRows` live. `groupByKey<T>` pure helper added to `scheduleSortFilter.ts`. Group-by dropdown (`data-testid="schedule-group-by-select"`) renders subheading rows `data-testid="schedule-group-header-{value}"`. Clear Sort button (`data-testid="schedule-clear-sort"`) visible when sort is active. Tests: `scheduleFilterGroup.test.ts` (7 tests) + `SchedulePanel.filterInput.test.tsx` (3 tests).

### 13.4 Routen-Analyse (path analysis / accessibility routing)
**Status: Done — P2**
Wave 17 WP-E: `roomGraph.ts` — `buildRoomGraph()` builds adjacency graph from rooms + doors (edges = pairs of rooms nearest each door); `computeEgressPath()` implements Dijkstra shortest path from a start room to any exit room (rooms named "Exit"/"Ausgang"). `EgressAnalysisPanel.tsx`: start-room dropdown, run button, result (N rooms, Xm path) or "no path" message. `buildEgressPathOverlay()` in `symbology.ts` renders green line + node circles on plan. Palette command `analysis.egress`. Tests: `roomGraph.test.ts` (8 tests).

### 13.5 Übungsfragen
**Status: N/A**

---

## Chapter 14 — Rendern (rendering)

### 14.1 Standort (rendering location / geographic for sky/sun)
**Status: Done — P1**
Georeferencing + sun position (sunPositionNoaa.ts) provide accurate geographic sun position for shadows.

### 14.2 Sonnenstand und Schattenwurf (sun position and shadows)

#### 14.2.1 Statische Anzeige (static shadow display in 3D view)
**Status: Done — P1**
SunOverlay.tsx, sunStore.ts, sunPositionNoaa.ts — static shadow display in 3D view with date/time/location is implemented.

#### 14.2.2 Animierte Sonnenstudien (animated sun study: single day / multi-day)
**Status: Implemented — P1**
`SunAnimationPanel` component (`packages/web/src/viewport/SunAnimationPanel.tsx`) added to `SunOverlay`. Controls: start time (HH:MM), end time (HH:MM), step dropdown (15/30/60 min), speed multiplier (0.5×/1×/2×/4×), Play/Pause button, Reset button, current time readout. Uses a `requestAnimationFrame` loop updating `useSunStore` (`setValues` + `setComputedPosition`) at 60 fps via `computeSunPositionNoaa`. Loops back to start time when the end time is exceeded. 3 unit tests in `SunAnimationPanel.test.ts`.

### 14.3 Rendern, fotorealistische Bilder (photorealistic rendering: cloud / local render)
**Status: Not Started — P1**
bim-ai uses Three.js real-time rendering only. Photorealistic ray-traced rendering (equivalent to Revit's local or cloud render via Autodesk Rendering) is not implemented. The ray tracing preview feature was explicitly removed (commit: "Remove ray tracing preview feature").

### 14.4 Hintergrund (rendering background: sky, gradient, image)
**Status: Done — P2**
Wave 15 WP-L: `skyBackground` (`'default'|'gradient-sky'|'overcast'|'solid'`) and `skyBackgroundColor` (hex) added to Zustand store (`storeTypes.ts` + `storeViewportRuntimeSlice.ts`). `Viewport.tsx` `useEffect` applies: gradient-sky → `scene.background=#87ceeb` + `Fog('#e8f4ff',50,500)`; overcast → `#c8c8c8` + fog; solid → user color; default → `#aaaaaa`. `SkyBackgroundPanel.tsx` component: radio buttons for 4 modes (`data-testid="sky-mode-{mode}"`), color picker when solid (`sky-solid-color`), close button. ☁ toggle button `data-testid="viewport-sky-btn"` in viewport overlay. Tests: `SkyBackgroundPanel.test.tsx` (5 tests) + `skyBackgroundStore.test.ts` (3 tests).

### 14.5 Kameras (perspective camera placement and management)
**Status: Done — P1**
Wave 14 WP-G: named perspective camera views fully implemented. `saved_3d_view` elements with `perspective: true` flag are separated into a "Camera Views" group in `ProjectBrowser.tsx`. "Save Current Camera" button (`view.save-camera-view` palette command) captures the current orbit position. Double-click restores the viewpoint. Rename and delete wired with context menu. ViewCube right-click also lists camera views for quick orient (WP-H). Tests in `projectBrowserCameraViews.test.tsx` (125 lines) + `savedCameraViews.test.ts` (179 lines).

### 14.6 Walkthroughs (animated camera path / flythrough)
**Status: Implemented — P1**
Walk mode (walkMode.ts) allows interactive first-person navigation. Revit-style walkthrough path fully implemented (wave 5 WP-D): `CameraPathElem` + `WalkthroughKeyframe` types in core; `reduceWalkthrough` grammar wired into Viewport.tsx; paths stored in Zustand. `WalkthroughPlaybackPanel.tsx` now has: RAF-interpolated smooth playback loop with `interpolateKeyframes(keyframes, timeSec)` pure function (lerps position/target/up via THREE.Vector3.lerpVectors), Play/Pause button (`data-testid="walkthrough-play-pause"`), loop checkbox (`data-testid="walkthrough-loop"`), `<input type="range">` scrubber (`data-testid="walkthrough-scrubber"`), and "Export Path" button (`data-testid="walkthrough-export-path"`) that downloads the path as JSON. `selectedCameraPathId`, `setSelectedCameraPathId`, `renameCameraPath`, `removeCameraPath` wired in store. 5 tests in `walkthroughPlayback.test.ts`.

### 14.7 Übungsfragen
**Status: N/A**

---

## Chapter 15 — Familieneditor (family editor for custom parametric components)

### 15.1 Beispiel: Eigenes Fenster (custom window family from scratch)

#### 15.1.1 Familieneditor starten (open family editor / family workbench)
**Status: Done — P1**
FamilyEditorWorkbench.tsx exists. The family editor can be opened for existing families. familyTemplateCatalog.ts provides templates. familyEditorPersistence.ts handles saving.

#### 15.1.2 Die Multifunktionsleiste »Erstellen« (create ribbon in family editor)
**Status: Done — P1**
The family editor has a create workflow. Wave 5 WP-G added void form support: `FamilyVoid` type in `@bim-ai/core` (`kind: 'family_void'`, `profilePoints`, `depthMm`). `buildFamilyVoidMesh(form)` in `meshBuilders.ts` renders the void as a wireframe mesh (`wireframe: true`, color `#ff4444`) to indicate a cut/void operation. Also added: `FamilyExtrusion` and `FamilyRevolve` types + `buildFamilyExtrusionMesh` (THREE.Shape + ExtrudeGeometry) and `buildFamilyRevolveMesh` (THREE.LatheGeometry). Tests in `familyVoidMesh.test.ts`. Wave 16 WP-B: `family_blend` (bottomProfileMm, topProfileMm, heightMm) and `family_sweep` (profileMm, pathMm) element types added. Mesh builders: `meshBuilders.familyBlend.ts` (lofted N-quad strip + fan caps) and `meshBuilders.familySweep.ts` (ExtrudeGeometry along CatmullRomCurve3). Tools `family-blend` (FB) and `family-sweep` (FS) with polygon sketch grammars. Inspector panels with height/base-elevation/point-count readouts. Tests: `meshBuilders.familyBlend.test.ts` (5), `meshBuilders.familySweep.test.ts` (4), `familyBlendGrammar.test.ts` (6). Wave 22 WP-E: `family_swept_blend` element type (startProfileMm, endProfileMm, pathMm, baseElevationMm, materialKey); `buildFamilySweptBlendMesh` in `meshBuilders.familySweptBlend.ts` — lofted quad-strip mesh interpolating between profiles at each path segment; `FamilySweptBlendState`/`reduceFamilySweptBlend` recording-path grammar; `family-swept-blend` tool (FSB); inspector `case 'family_swept_blend':` with path count + start/end profile vertex counts; FamilyEditorWorkbench "Add Swept Blend" button. Tests: `meshBuilders.familySweptBlend.test.ts` (5) + `familySweptBlendGrammar.test.ts` (5). Wave 24 WP-D: nested component placement now done — `family_component` element type (familyId, componentTypeId, label, originMm, rotationDeg) + `AddFamilyComponentCmd` + Workspace handler + FamilyEditorWorkbench "+ Component" button (`family-editor-add-component-btn`) + inspector `case 'family_component':` + `family.add-component` palette command + 4 tests. Wave 26 WP-C: Category assignment added — `categoryKey?: string` on `family_definition` in core; `SetFamilyCategoryCmd` + Workspace handler; `FAMILY_CATEGORIES` list (11 categories: doors, windows, furniture, structural_columns, structural_framing, casework, generic_models, lighting_fixtures, mechanical_equipment, plumbing_fixtures, specialty_equipment) in `familyCategories.ts`; inspector `case 'family_definition':` with category `<select data-testid="inspector-family-category">`; FamilyEditorWorkbench category selector at top (`family-editor-category-select`); `family.set-category` capability. 4 tests. Wave 28 WP-E: formula evaluation — `formula?: string` field on `family_parameter`; `evaluateFamilyParameterFormula(formula, params)` in `familyParameterEval.ts` — replaces param name identifiers with numeric values then validates/evaluates via `Function()`; `applyFamilyParameters` second-pass formula evaluation; `FamilyParameterPanel.tsx` formula input field (`data-testid="family-param-formula-{name}"`); `family.parameter-formula` capability; 6 tests in `familyParameterFormula.test.ts`.

#### 15.1.3 Fensterbearbeitung (window family geometry authoring)
**Status: Done — P1**
Custom window families can be created (familySketchGeometry.ts). Wave 17 WP-J: `family_parameter` element kind (name, paramType, defaultValue, isInstance, linkedDimensionId, linkedProperty); `FamilyParameterPanel.tsx` with add/delete/value-change UI; `familyParameterEval.ts` with `applyFamilyParameters()` + `validateFamilyParameters()`; FamilyEditorWorkbench integrated; inspector `case 'family_parameter':`. Tests: `familyParameterEval.test.ts` (6) + `FamilyParameterPanel.test.tsx` (5). Parametric constraint propagation: Done — `FamilyConstraintElem` (id, familyId, paramName, refPlaneId1, refPlaneId2, axis) in core + `applyFamilyConstraints()` moves refPlane2 position to match param value + Workspace add/remove handlers + inspector `case 'family_constraint':` + FamilyEditorWorkbench local-state constraint panel with "Add Constraint" button + 5 tests. (WP-E wave 21). Wave 25 WP-B: Parametric opening cut — `family_opening_cut` elem + `SetFamilyOpeningCutCmd` + Workspace handler + inspector + "✂ Opening Cut" button + `family.set-opening-cut` capability + 4 tests. Wave 29 WP-E: Reference planes — `family_reference_plane` element kind (familyId, name, axis: 'x'|'z', offsetMm, isReference?) in core; `AddFamilyReferencePlaneCmd`; Workspace handler creates ref plane in store; FamilyEditorWorkbench "+ Ref Plane" button (`data-testid="family-editor-add-ref-plane-btn"`); inspector `case 'family_reference_plane':` with Name/Axis/Offset inputs (`inspector-ref-plane-name/axis/offset`); `family.add-reference-plane` capability; 6 tests in `familyReferencePlane.test.ts`.

#### 15.1.4 Fensterrahmen (window frame geometry in family)
**Status: Done — P1**
Wave 18 WP-A: `buildWindowFrameMesh()` in `meshBuilders.windowFrame.ts` — outer rect minus inner hole as `THREE.Shape` + `ExtrudeGeometry`, producing a full rectangular frame profile. `frameInnerWidthMm`, `frameSillDepthMm` optional fields on `family_extrusion` in `@bim-ai/core`. Inspector `case 'family_extrusion':` with Frame Inner Width + Sill Depth inputs (`inspector-family-frame-inner-width`, `inspector-family-frame-sill-depth`). "Add Window Frame" button in FamilyEditorWorkbench (`family-editor-add-frame-btn`). Tests: `meshBuilders.windowFrame.test.ts` (3 tests).

#### 15.1.5 Fensterglas (window glazing panel in family)
**Status: Done — P1**
Wave 18 WP-A: `buildGlazingMesh()` in `meshBuilders.windowFrame.ts` — `THREE.BoxGeometry` (6mm thickness) with `MeshPhysicalMaterial` (transparent, opacity 0.35, transmission 0.8, color #a8d8ea). `isGlazing` + `glazingMaterialKey` optional fields on `family_extrusion`. `meshBuilders.ts` dispatches to `buildGlazingMesh` when `isGlazing: true`. Inspector `inspector-family-is-glazing` checkbox. "Add Glazing Panel" button in FamilyEditorWorkbench (`family-editor-add-glazing-btn`). Tests: `meshBuilders.windowFrame.test.ts` (3 glazing tests).

### 15.2 Übungsfragen
**Status: N/A**

---

## Appendix A — Befehlskürzel (keyboard shortcuts)
**Status: Done — P1**
Wave 14 WP-I: `cheatsheetData.ts` expanded with a comprehensive shortcut set matching the Revit schema — WA=Wall, DR=Door, WN=Window, CM=Copy, MM=Mirror, MV=Move, RO=Rotate, TR=Trim, SL=Split Line, AL=Align, OF=Offset, AR=Array, SC=Scale, GP=Group, UN=Ungroup, VV=Visibility Graphics, VP=View Properties, RP=Reference Plane, LL=Level, GR=Grid, DI=Aligned Dimension, DL=Linear Dimension, EL=Spot Elevation, TX=Text, TG=Tag, CS=Create Similar. `CheatsheetModal.tsx` renders the full reference. Tests in `cheatsheetData.test.ts` verify the shortcut set is non-empty and contains expected entries.

---

## Appendix B — Antworten zu den Übungsfragen
**Status: N/A**

---

## Summary Dashboard

Last updated: 2026-05-18 (Wave 31 complete). Waves 1–31 complete. **662 test files, 5440 tests pass.**

Wave 31 completions: §1.5 start screen — `vereinfacht` template (BIM Architektur vereinfacht, EG/OG levels, Neubau phase) + `recentProjectIds` store (LRU max 10) + `OpenRecentProjectCmd` + "Recently Opened" list in ProjectSetupDialog + `view.start-screen` capability + 6 tests (WP-A), §1.6.6 options bar door/window/grid — door tag-on-place, window sill height + tag-on-place, grid spacing + name prefix module vars + setters + JSX sections + `view.options-bar-door-window` capability + 8 tests (WP-B), §1.6.11 project browser view templates subtree — `ApplyViewTemplateCmd` + collapsible `browser-view-templates-section` with use-count + Apply per-template + `view.browser-view-templates` capability + 6 tests (WP-C), §12.4.3 DGN export — `dgnExporter.ts` wraps `exportToDxf()` with DGN seed header + `export-dgn-button` in ProjectMenu + `file.export-dgn` capability + 6 tests (WP-D), §12.1.1 point cloud link — `link_pointcloud` type + `AddPointCloudCmd`/`RemovePointCloudCmd`/`TogglePointCloudCmd` + ManageLinksDialog Point Clouds section + `file.link-pointcloud` capability + 7 tests (WP-E). Also committed wave30/C (§1.6.4) help search: `helpTopics.ts` (25 topics) + `HelpSearchPanel.tsx` + `view.help-search` capability.

Wave 30 completions: §1.10 reset workspace — `ResetWorkspaceCmd` + Workspace handler resets splitViewEnabled/skyBackground/thinLinesEnabled/quickAccessItems to defaults + ProjectMenu "Reset Workspace" button + `view.reset-workspace` capability + 5 tests (WP-A), §6.4.1 callout reference symbol — `calloutSymbolThree()` dashed-rect outline + circle tag at boundary corner in parent plan view + `view.callout-reference-symbol` capability + 5 tests (WP-B), §1.6.4 in-product help search — `helpTopics.ts` (25 topics) + `HelpSearchPanel.tsx` + `?` shortcut + `view.help-search` capability + 5 tests (WP-C), §1.6.3 quick access toolbar — `quickAccessItems` store + `AddToQuickAccessCmd`/`RemoveFromQuickAccessCmd` + `QuickAccessToolbar.tsx` + `view.quick-access-toolbar` capability + 5 tests (WP-D), §3.5.5 wall profile inspector editor — `UpdateWallProfileCmd` + Workspace handler + inspector point list + SVG preview + add/remove/reset buttons + `modify.edit-wall-profile-inspector` capability + 6 tests (WP-E).

Wave 29 completions: §1.6.1 dynamic browser tab title — `document.title` = "ProjectName — ViewName" via `useEffect` + `data-testid="workspace-view-breadcrumb"` subtitle + `view.dynamic-title` capability + 5 tests (WP-A), §6.4.2 2D drafting view — `planViewSubtype: 'drafting'` + `CreateDraftingViewCmd` + Workspace handler + symbology 3D-element skip + ProjectBrowser "Drafting Views" section + "+ Draft" button + `annotate.create-drafting-view` capability + 6 tests (WP-B), §12.3 BIMobject catalog — `bimobjectCatalog.ts` (12 manufacturer items) + `searchBimobjectCatalog()` + FamilyLibraryPanel BIMobject section + search input + item cards + `file.bimobject-catalog` capability + 6 tests (WP-C), §1.6.12 split plan/3D view — `ToggleSplitViewCmd` + `splitViewEnabled` store field + CanvasMount side-by-side flex rendering + `viewport-split-view-btn` toggle + `view.split-view` capability + 5 tests (WP-D), §15.1.3 family reference planes — `family_reference_plane` element kind + `AddFamilyReferencePlaneCmd` + Workspace handler + FamilyEditorWorkbench "+ Ref Plane" button + inspector Name/Axis/Offset inputs + `family.add-reference-plane` capability + 6 tests (WP-E).

Wave 28 completions: §2.9.4 plan underlay — `underlayLevelId`/`showUnderlay` on `plan_view` + `SetPlanUnderlayCmd` + Workspace handler + PlanViewHeader UL toggle + level dropdown + symbology ghost wall pass (LineDashedMaterial) + `view.plan-underlay` capability + 5 tests (WP-A), §9.1.3 non-structural column — `isNonStructural` on column + `ToggleColumnStructuralCmd` + Workspace handler + dashed plan symbol + inspector checkbox + `modify.toggle-column-structural` capability + 5 tests (WP-B), §12.4.2 custom DXF layer mapping — `dxfLayerMapping` on `project_settings` + `SetDxfLayerMappingCmd` + Workspace handler + `resolveLayerName()` in dxfExporter + ProjectMenu layer-name editor + `file.dxf-layer-mapping` capability + 5 tests (WP-C), §6.1.5 interior elevation material hatches — `hatchPatternForMaterial`/`svgHatchDef` in InteriorElevationViewport SVG + storey height ruler + `view.interior-elevation-hatch` capability + 5 tests (WP-D), §15.1.2 family parameter formula — `formula?` on `family_parameter` + `evaluateFamilyParameterFormula()` + FamilyParameterPanel formula input + `family.parameter-formula` capability + 6 tests (WP-E).

Wave 27 completions: §12.1.1 PDF underlay link — `link_pdf` element type + `AddPdfLinkCmd`/`RemovePdfLinkCmd`/`TogglePdfLinkCmd` + Workspace handlers + ManageLinksDialog PDF section (opacity slider, toggle/remove, file picker) + `file.link-pdf` palette command + 5 tests (WP-A), §7.3.2/§7.3.3 work plane face orientation — `work_plane` element type + `SetWorkPlaneFaceCmd` + Workspace handler (normalDeg = wall.angleDeg+90) + `SetWorkPlaneDialog.tsx` host selector + `view.set-work-plane-face` capability + 4 tests (WP-B), §4.2.6/§4.2.7 stacked dimension strings — `stackDimensions()` utility groups parallel dims (vertical vs horizontal) + `StackDimensionsCmd` + Workspace handler + `modify.stack-dimensions` palette command + 6 tests (WP-C), §3.3.5 show constraints toggle — `showConstraints` on `plan_view` + `ToggleShowConstraintsCmd` + `isEqualityDimension`/`isLocked` on `permanent_dimension` + EQ marker/🔒 rendering in planElementMeshBuilders + symbology + PlanViewHeader EQ button + 5 tests (WP-D), §1.6.11 project browser search/filter — `browserSearch` input + `filteredPlanViews` memo + `planViewSort` A↑/Z↑ toggle + sheet filter + `view.browser-search` capability + 4 tests (WP-E).

Wave 26 completions: §3.3.7 paint surface — `PaintFaceCmd`/`UnpaintFaceCmd` + `faceOverrides` on wall/floor + `'paint'` tool (PA hotkey) + Workspace handlers + options bar material selector + `modify.paint-face` capability + 5 tests (WP-A), §1.7.1 canvas context menu — `CanvasContextMenu.tsx` with Zoom In/Out/Fit + View Properties + PlanCanvas `onContextMenu` wiring + `view.canvas-context-menu` capability + 4 tests (WP-B), §15.1.2 family category assignment — `categoryKey?` on `family_definition` + `SetFamilyCategoryCmd` + `FAMILY_CATEGORIES` (11 types) + inspector selector + FamilyEditorWorkbench header selector + `family.set-category` capability + 4 tests (WP-C), §4.11.3 material tag completion — `leaderEndMm?`/`layerIndex?` on `material_tag` + leader line renderer + rectangular tag box + inspector override/layer inputs + 5 tests (WP-D), §4.6 arc length dimension curved line — `offsetMm?` field + N=32 curved dim arc renderer + extension lines at start/end angles + `annotate.arc-length-dimension` capability + §3.5.5 wall profile 3D mesh wiring — `profilePoints` now applied to `makeWallMesh` + 6 tests (WP-E).

Wave 25 completions: §2.4.2 floor edge profile 3D mesh — `buildFloorEdgeProfileMesh()` extrudes `edgeProfileMm` cross-section along perimeter boundary edges using `ExtrudeGeometry`, wired into `makeFloorSlabMesh`; `modify.floor-edge-profile` capability + 4 tests (WP-A), §15.1.3 family opening cut — `family_opening_cut` elem + `SetFamilyOpeningCutCmd` + Workspace handler + inspector case + "✂ Opening Cut" button in FamilyEditorWorkbench + 4 tests (WP-B), §1.6.11 project browser "By Level" preset — `viewOrgPreset` state + `<select data-testid="browser-view-org-preset">` + `levelGroupedViews` memo + level-name resolution + `view.browser-org-preset` capability + 3 tests (WP-C), §1.6.2 file menu save-as/revert — `DuplicateProjectCmd`/`RevertProjectCmd` in core + `handleDuplicateProject`/`handleRevertProject` Workspace handlers + ProjectMenu "Save As…"/"Revert" buttons + `file.save-as`/`file.revert` palette commands + 4 tests (WP-D), §12.4.5 PDF per-sheet orientation + page numbers — `sheetOrientations` state in PrintPlotDialog + per-sheet `<select>` dropdowns + page number injection in pdfExporter + `file.export-pdf` capability + 3 tests; §12.4.3 DXF ACI layer colors — `LAYER_ACI_COLORS` map in dxfExporter (A-WALL=7, A-DOOR=1, A-GLAZ=3, A-AREA=4, S-GRID=8, A-ANNO-DIMS=2, A-REFP=6, S-COLS=5, S-BEAM=5) + 5 tests (WP-E).

Wave 24 completions: §4.1 angular/radial/diameter dimension Workspace handlers — `createAngularDimension`/`createRadialDimension`/`createDiameterDimension` handlers in Workspace.tsx + inspector cases + `annotate.angular-dimension`/`annotate.radial-dimension` palette commands + 4 tests (WP-A), §8.6.4 stair flip command — `FlipStairCmd` type + `flipStair` handler mirroring run geometry + inspector Flip H/V buttons + `modify.flip-stair` palette command + 5 tests (WP-B), §1.6.10 crop region interactive editing — `getCropRegionGrips`/`applyCropGripDrag` wired into PlanCanvas + `updateCropRegion` command + Workspace handler + 5 tests (WP-C), §15.1.2 family nested component placement — `family_component` type + `AddFamilyComponentCmd` + Workspace handler + FamilyEditorWorkbench button + inspector case + 4 tests (WP-D), §3.6.2 window/door type catalog expansion — 5 window presets + 4 door presets + `windowStyle`/`doorStyle` fields + 7 palette commands + 8 tests (WP-E).

Wave 23 completions: §3.4.2 sub-floor thickening — `subFloorThicknessMm?` on `FloorElem` + `SetSubFloorThicknessCmd` + Workspace handler + inspector "Sub-floor Pad" input + `modify.set-sub-floor-thickness` palette command + 3D mesh pad in `makeFloorSlabMesh` + 4 tests (WP-A), §6.1.6 section view level lines — `showLevelLines?` on `section_cut` + `sectionLevelLines.ts` (`extractLevelData`/`buildLevelLineSvg`) + SVG injection in `sectionViewportSvg.tsx` + inspector checkbox + 6 tests (WP-B), §12.4.3 IFC export expansion — IFCBEAM, IFCCOLUMN, IFCSTAIR, IFCRAILING entities in `ifcExporter.ts` + 4 new tests (WP-C), §1.6.11 project browser Groups subtree — `PbCollapsibleSection` with group rows + instance counts + `SelectGroupElementsCmd` in core + Workspace handler + 8 tests (WP-D), §3.5.5 wall join tool wiring — `joinOverrides?` on wall + `SetWallJoinCmd` + `findWallsAtCorner()` utility + `setWallJoin` Workspace handler + `modify.wall-join` palette command + 9 tests (WP-E).

Wave 22 completions: §4.1 `DimWitnessPoint` type + `referencedElementId?` on witness points + `resolveDimReferences()` utility for snapping dims to element references (WP-A), §3.3.4 cut geometry command — `cutBy` field on wall/floor/column + `applyCutGeometry`/`removeCutGeometry` Workspace handlers + `reduceCutGeometry` 2-phase grammar + inspector cut-by readout + palette commands (WP-B), §8.6.2 stair assembly inspector — `getStairComponents()` + `StairAssemblySection` collapsible panel with run/landing rows + add/remove buttons (WP-C), §2.5.1 shaft side wall auto-generator — `buildShaftSideWalls()` bounding-box wall generator + inspector button + palette command (WP-D), §15.1.2 family swept blend — `family_swept_blend` type + lofted quad-strip mesh builder + `reduceFamilySweptBlend` path-recording grammar + inspector panel (WP-E).

Wave 21 completions: §1.6.2 project templates — `ProjectTemplate` type + localStorage save/load/delete + `ProjectTemplatesDialog.tsx` + `file.project-templates` palette command + 6 tests (WP-A), §3.4.2 floor sub-element slope points — `FloorSlopePoint` type in core + `slopePoints[]` on floor + Workspace add/remove/update handlers + inspector collapsible "Drainage Slope Points" section + `floorSlopePointsPlanThree()` orange circle symbols + 5 tests (WP-B), §3.3.1 select linked elements toggle — `selectLinkedEnabled` store field + LK button in PlanViewHeader + PlanCanvas link_model filter + `selection.toggle-select-linked` palette command + 4 tests (WP-C), §2.9.1 terrace preset workflow — `buildTerraceRailing()` perimeter railing builder + `TerracePresetDialog.tsx` + `modify.create-terrace-from-floor` palette command with `isAvailable` floor check + 8 tests (WP-D), §15.1.3 family parametric constraints — `FamilyConstraintElem` in core + `applyFamilyConstraints()` + Workspace add/remove handlers + inspector `family_constraint` case + FamilyEditorWorkbench constraint panel with local state + 5 tests (WP-E).

Wave 20 completions: §12.4.3 DXF export additions — column (S-COLS rectangle), beam (S-BEAM line), floor (A-FLOR polyline), stair footprint (A-FLOR-STRS rectangle) in `buildPlanView()` + 4 tests (WP-A), §12.4.5 PDF export — PaperSize extended to A0/A1/A2/A3/A4/Letter/Tabloid + PAPER_CSS mapping + `marginMm` option threaded through pdfExporter + PrintPlotDialog margin input + 12 new tests (WP-B), §1.6.6 options bar — roof base-offset/slope + ramp width/slope + railing height/follow-slope module-level vars + OptionsBar.tsx sections + 8 tests (WP-C), §1.11 family library panel — search input + category count badges + recently used section (5-item cap) + 8 tests (WP-D), §14.3 render quality panel — `RenderQualitySettings` Zustand slice + `RenderQualityPanel.tsx` (shadows/exposure/pixel-ratio) + Viewport.tsx useEffect wiring THREE.js renderer + ⚙ toggle button + 6 tests (WP-E).

Wave 19 completions: §8.6.2 stair_run/stair_landing element types + PlanCanvas wiring + inspector panels + addStairRun/addStairLanding/removeStairComponent commands (WP-A), §6.4.1 callout camera zoom useEffect fitting OrthographicCamera to calloutBoundaryMm + elementOverlapsBoundary geometry filter in rebuildPlanMeshes + 1:N scale label in PlanViewHeader (WP-B), §12.1.1 link_ifc element type + addIfcLink/removeIfcLink/toggleIfcLinkVisibility commands + ManageLinksDialog IFC section (file picker, list, visibility checkbox) + ghost rendering via applyLinkedGhosting + ProjectBrowser Linked IFC subtree (WP-C), §2.4.2 shift-click in floor tool triggers detectFloorBoundaryFromWalls + auto-creates floor + edgeProfileMm + autoDetectedBoundary fields + inspector collapsible edge profile section (WP-D), §3.5.5 commitWallProfile command + Workspace handler storing profilePoints on wall + modify.edit-wall-profile palette command + wallProfileInspector.test.tsx 8 tests (WP-E+fix-up), §1.6.10 THREE.js crop region PlanViewHeader toggle button + view.toggle-crop-region palette command + cropRegionMm/cropRegionEnabled fields on plan_view (WP-F+fix-up), §6.4.2 detail_line/detail_filled_region element types + addDetailLine/addDetailFilledRegion/removeDetailElement commands + THREE.js plan rendering (Line + ShapeGeometry) + inspector style/color panels + PlanCanvas tool wiring (WP-G), §2.5.1 shaft inspector base/top level selectors + cut floor count readout + Apply Shaft Cut button + applyShaftCut command handler calling computeShaftCutFloors (WP-H), §4.1 autoDimensionWalls command type + Workspace handler filtering walls by levelId + annotate.auto-dimension-walls palette command updated to dispatch command (WP-I), §8.6.4 enterStairEditMode/exitStairEditMode/updateStairRun command types + Workspace handlers + inspector Edit Stair toggle + per-run riser/width editors + Finish Editing button + modify.edit-stair palette command (WP-J).

Wave 18 completions: §15.1.4 window frame geometry in family editor — `buildWindowFrameMesh` + frame profile ExtrudeGeometry + inspector inputs (WP-A), §15.1.5 window glazing panel — `buildGlazingMesh` MeshPhysicalMaterial transparent glass + inspector (WP-A), §8.6.2 stair by component grammars — `StairRunState`/`StairLandingState`/`reduceStairRun`/`reduceStairLanding` + 8 tests (WP-B), §6.4.1 detail callout geometry filter — `elementOverlapsBoundary` + `computeCalloutScale` + 6 tests (WP-C), §12.1.1 link IFC importer utility — `createIfcLink`/`applyIfcLinkOffset` using wave-16 STEP parser + 6 tests (WP-D), §2.4.2 auto-detect floor boundary — `detectFloorBoundaryFromWalls` convex hull from wall endpoints + 7 tests (WP-E), §1.6.10 crop region grips — `getCropRegionGrips`/`applyCropGripDrag` 4-edge handles + 8 tests (WP-F), §3.5.5 edit wall profile — `buildProfiledWallMesh` ExtrudeGeometry + `reduceWallProfile` grammar + 6 tests (WP-G), §4.1 auto-dimension standalone utility — `autoDimensionWalls.ts` grouping by axis + offset calculation (WP-H), §6.4.2 2D detail drafting grammars — `reduceDetailLine`/`reduceDetailFilledRegion` + 11 tests (WP-I), §2.5.1 shaft cut floors — `computeShaftCutFloors` vertical-extent + point-in-polygon filter + 7 tests (WP-J).

Wave 17 completions: §3.3.4 paint surface tool — face material override + grammar (WP-A), §5.3 project elevation offset command (WP-B), §5.4.2 true north rotation + planViewAngleDeg + PlanViewHeader indicator (WP-B), §4.8 spot coordinate annotation full wiring (WP-C), §4.9 slope annotation full wiring (WP-C), §8.4 head-height clearance check — violations panel + plan overlay (WP-D), §13.4 egress analysis — room graph + Dijkstra + EgressAnalysisPanel (WP-E), §1.6.11 project browser families + groups tree + view context menu (WP-F), §5.1.6 terrain split + graded region tool (WP-G), §8.6.3 stair by sketch — straight/L/U shape detection + multi-run config (WP-H), §12.4.3 DXF export — named German layers + LWPOLYLINE + TEXT entities (WP-I), §15.1.3 family parametric parameters — family_parameter type + panel + eval (WP-J).

Wave 16 completions: §12.1.2 IFC import — STEP parser + element converter + dialog (WP-A), §15.1.2 family blend + sweep forms — element types + mesh builders + grammars (WP-B), §6.1.6 section view head bubbles + view title label (WP-C), §3.3.6 scale tool — pick-base + pick-ref + numeric input, hotkey SZ (WP-D), §11.5 curtain wall from mass face — generate-curtain-walls command (WP-E), §8.6.2-8.6.4 stair editing grips — riserCount/runWidth drag grips + inspector inputs (WP-F), §4.1 auto-dimension walls + tag all rooms palette commands (WP-G), §6.1.5 interior elevation rendering — buildElevationLines + SVG viewport (WP-H), §12.2.2 terrain from DXF contour lines — LWPOLYLINE parser + toposolid creator (WP-I), §8.7 ramp tool — element type + grammar + 3D mesh + inspector (WP-J).

Wave 15 completions: §10.3.1-3 conical/dome/spire roof shapes — elements + tools + 3D mesh + inspector (WP-A), §9.5.1-2 steel connection inspector + schedule preset (WP-B), §5.1.4 terrain pad grammar + 3D mesh + inspector (WP-C), §13.3 schedule filter input + group-by + clear sort (WP-D), §1.6.10 per-view category visibility override dialog (WP-E), §8.1.5 decal image file picker + texture rendering (WP-F), §6.1.4 elevation view geometry projection + viewport wiring (WP-G), §6.1.6 section view material hatch patterns + cut line weights (WP-H), §3.3.7 linework override tool (WP-I), §6.5 browser print dialog + CSS media print + palette command (WP-J), §2.1.3 project base point + §5.4.1 north arrow polish (WP-K), §14.4 sky/environment background for 3D viewport (WP-L).

Wave 14 completions: §1.8.1 TAB cycle + crossing selection + Select All Instances (WP-A), §9.2 beam section profiles wired into 3D renderer (WP-B), §10.1.3 roof slope arrow plan symbol + inspector + 3D mesh (WP-C), §11.5 massing → BIM workflow — generate walls/floors/roof from mass (WP-D), §13.1.3 color fill legend panel on plan canvas (WP-E), §13.1.4 room net area in inspector + §13.3.1 furniture schedule preset (WP-F), §14.5 named perspective camera views in project browser (WP-G), §3.2 ViewCube right-click orient to view (WP-H), Appendix A keyboard shortcut cheatsheet expanded (WP-I), §7.3.1 Set Work Plane dialog + §1.6.10 thin lines toggle button (WP-J), §3.3.9 Create Similar CS-chord + §4.2.3 EQ dimension enforcement (WP-K), §6.4.1 callout view badge + scale + §12.4.5 Print All Sheets (WP-L).

Wave 13 completions: §1.6.10 hide/isolate elements in view (WP-A), §2.1.1 project information dialog (WP-B), §2.4.3 wall join priority matrix (WP-C), §9.1.1 architectural vs structural column distinction (WP-D), §13.1.2 room tags with name/number/area (WP-E), §2.5.3 auto-create shaft void on stair placement (WP-F), §7.1.1 model lines tool in project environment (WP-G).

Wave 12 completions: §8.9.3 group edit mode UI (WP-A), §8.1.3 wall parts inspector (WP-B), §3.4.1 floor attach to roof (WP-C), §4.4 angular dim inspector polish (WP-D), §4.5 radial/diameter dim inspector polish (WP-D), §8.2 ceiling auto-boundary + grid hatch (WP-E), §4.7 spot elevation 3D label + inspector (WP-F), §6.1.3 named/locked 3D views + section box from plan (WP-G).

Wave 7 completions: §1.6.7 WallTypeLayerEditor, §2.6.2 top constraint inspector, §5.1.1+§5.1.2 terrain point placement/editing, §5.1.3 contour lines, §4.2.4 dimension style dialog, §6.2 sheet viewport scale + title block fields, §8.3 finish floor type selector.

Wave 8 completions: §4.2.1 permanent dimension chain placement grammar (WP-A).

### By Chapter — Implementation State

| Chapter | Topic | Overall State | Priority Gap |
|---------|-------|---------------|-------------|
| 1 | UI & Startup | Partial | Ribbon architecture, customisable QAT, multi-window remain; thin lines Done (w14); per-view VG Done (w15) |
| 2 | Basic Floor Plan | Partial | §2.6.2 top constraint Done; view range dialog Done; project base point Done (w15) |
| 3 | Modify Tools | Partial | ViewCube orient Done (w14); Create Similar Done (w14); linework override Done (w15) |
| 4 | Annotations | Partial | EQ enforcement Done (w14); dimension style dialog Done (wave 7) |
| 5 | Terrain & Geo | Partial | Terrain pad Done (w15); excavation Done; contours Done; north arrow Done (w15); merge/split Not Started |
| 6 | Views & Sheets | Partial | Elevation view projection Done (w15); section hatch patterns Done (w15); browser print Done (w15) |
| 7 | Drafting Aids | Done/Partial | Grids + reference planes Done; Set Work Plane Done (w14) |
| 8 | Adv. Walls/Stairs | Partial | Attach-top Done; curtain wall grid Done; group edit mode Done; decal file picker Done (w15) |
| 9 | Structure | Done/Partial | Beam section profiles Done (w14); steel connection inspector + schedule Done (w15) |
| 10 | Roofs | Done/Partial | Hip/gable/dormer/extrusion Done; slope arrow Done (w14); conical/dome/spire Done (w15) |
| 11 | Massing | Done/Partial | Mass primitives Done; mass→BIM generate walls/floors/roof Done (w14); curtain from face Partial |
| 12 | Import/Export | Partial | IFC Done; DXF Done; DWG Done; Print All Sheets Done (w14) |
| 13 | Schedules | Done/Partial | Furniture + room schedules Done; steel connection schedule Done (w15); filter/group-by Done (w15) |
| 14 | Rendering | Done/Partial | Sun animation Done; walkthrough Done; camera views Done (w14); sky background Done (w15) |
| 15 | Family Editor | Partial | FamilyExtrusion + FamilyRevolve + FamilyVoid Done; blend/sweep Done (w16); parametric params Done (w17); window frame + glazing Done (w18) |

### Top P0 Gaps (core authoring blocked)

None confirmed as blocking.

### Top P1 Gaps (professional parity limited)

Remaining after wave 20:

- **§3.5.5 Edit wall profile** — commitWallProfile + inspector buttons done (w19); full sketch-mode UI for drawing the profile shape Partial
- **§6.4.2 2D detail view** — element types + rendering done (w19); standalone detail view tab (independent of model) Not Started
- **§3.4.2 Basement slab sub-element** — drainage slope + split surface sub-element editing Not Started
- **§12.1.3 Family library** — search + count badges done (w20); loading from external/online library Not Started
- **§1.6.10 Crop region clipping** — toggle button + fields done (w19); THREE.js clipping plane visual enforcement Partial
- **§14.3 Photorealistic rendering** — quality panel + Three.js knobs done (w20); true ray-traced render Not Started
- **§1.6.10 Crop region drag** — grip utilities done (w18); Three.js clip planes wiring Partial

### Top P2 Gaps (useful but workaroundable)

- User-customisable QAT (Ch. 1.6.3) — not started
- Multiple simultaneous view windows (Ch. 1.6.12) — not started
- Link IFC full UI wiring (Ch. 12.1.1) — importer utility done (w18); dialog + ghost rendering Partial
