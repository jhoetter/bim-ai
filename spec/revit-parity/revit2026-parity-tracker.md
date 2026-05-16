# Revit 2026 Feature-Parity Tracker

Last updated: 2026-05-16
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
**Status: Partial — P2**
Revit shows a start screen with recently-used projects, a choice of project template (None, BIM Architektur und Ingenieurbau, BIM Architektur und Ingenieurbau vereinfacht, BIM Gebäudetechnik) and a new-project dialog. bim-ai has a project creation flow and project list, and now:
- Project templates (projectTemplates.ts) implemented: minimal, residential (Wohnbau), commercial (Gewerbebau) with level + phase setup commands. Template picker added to project creation dialog (ProjectSetupDialog.tsx, "Templates" section).
- Template picker allows selecting a template and applying its createLevel/createPhase commands in one click.
Still missing:
- No multi-template selection at project creation time (only one applied at a time)
- No "Revit 2026 start page" visual freshness (recently-used thumbnails, cloud projects)
- BIM Architektur vereinfacht template equivalent is missing

### 1.6 Die Revit-Benutzeroberfläche (UI chrome)

#### 1.6.1 Programmleiste (title bar with project + view name)
**Status: Partial — P2**
bim-ai shows current project name in the header. Current active view name is shown in the view tab. Full "Projekt1 - Grundriss: Ebene 0" combined title is not surfaced in a persistent title bar.

#### 1.6.2 Dateimenü (file menu: New, Open, Save, Export, Print, Close)
**Status: Partial — P1**
bim-ai has:
- New project (Done)
- Open project (Done)
- Save / auto-save (Done)
- Export (Partial — see Ch. 12)
- Print / PDF export (Partial — see Ch. 12)
Missing: Save As template, Save to library as Family, cloud model sync from file menu, Revit Options dialog.

#### 1.6.3 Schnellzugriff-Werkzeugkasten (quick access toolbar)
**Status: Partial — P2**
bim-ai has a fixed top bar with key actions (undo, redo, save, 3D toggle). Revit's QAT is fully user-customisable — any ribbon command can be pinned. bim-ai does not yet have a user-configurable quick access bar.

#### 1.6.4 Die Info-Leiste (info bar: search help, Autodesk Account, App Store, Help)
**Status: Partial — P2**
bim-ai has a help/onboarding entry point but no in-product search over help documentation, no integrated App Store, no Autodesk Account management. The user profile/account menu exists.

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
**Status: Partial — P1**
bim-ai has a ToolPalette with hotkeys, OptionsBar, and ToolModifierBar. Revit-style "tool stays active until escape/finish" grammar is implemented. The chained-placement model (wall chain, stair by component, etc.) is done. Missing: the full floating options bar that changes per-tool is only partially implemented for some tools.

#### 1.6.7 Exemplar- und Typeigenschaften, neue Elementtypen (instance vs type properties, type duplication)
**Status: Partial — P1**
bim-ai has the Inspector panel for element properties. Instance properties are shown and editable for walls, doors, windows, roofs, floors. Type properties and type duplication (WorkspaceRightRailTypeCommands.ts exists) are partially implemented. Creating entirely new types from scratch (e.g. new wall type with custom layer stack) is partially available in the wall type catalog. Full Revit-style "Typ bearbeiten" dialog with all type parameters is not yet fully parity.

#### 1.6.8 Optionsleiste: wichtigste Exemplareigenschaften (options bar for active tool)
**Status: Partial — P1**
OptionsBar.tsx exists and is wired for wall placement (location line, chain mode, offset, radius). Not all tools have fully populated options bars as in Revit.

#### 1.6.9 Statusleiste (status bar with command hints)
**Status: Partial — P2**
bim-ai shows contextual hints during active tool operations. Full Revit-style status bar with structured "Select element" / "Click to place" strings per tool state is not fully implemented.

#### 1.6.10 Ansichtssteuerung (view controls: scale, detail level, visual style, shadows, crop)
**Status: Partial — P1**
bim-ai has:
- Plan detail level toolbar (PlanDetailLevelToolbar.tsx — Done)
- Visual style selection (renderStyles.ts — Done)
- Sun/shadow toggle (SunOverlay.tsx — Done)
- Scale display: Partial (shown in plan header)
Missing: per-view crop region editing, view-level visibility/graphics overrides dialog, thin-lines toggle ("Feine Linien"), hide/isolate element commands.

#### 1.6.11 Projektbrowser (project browser tree: views, sheets, families, groups, Revit links)
**Status: Partial — P1 (D7)**
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
Still missing: full hierarchical Revit-style browser organisation presets, Groups subtree (deferred to WP-B), Browser organisation presets (by level, by discipline)

#### 1.6.12 Zeichenfläche (drawing canvas: multiple view windows, tile/cascade)
**Status: Partial — P2**
bim-ai shows one active view at a time with tabbed switching between plan, 3D, section, and sheet views. Revit supports multiple simultaneously tiled/cascaded view windows. Simultaneous side-by-side views (e.g. plan + 3D) not yet available.

### 1.7 Kontextmenüs (right-click context menus)

#### 1.7.1 Ohne aktive Befehle (right-click with nothing selected)
**Status: Partial — P2**
bim-ai has a wall face radial menu (wallFaceRadialMenu.tsx). General canvas right-click context menus with Revit-style commands (Zoom, Pan, Steer, Last Command) are not present.

#### 1.7.2 Kontextmenü mit aktivem Element (right-click on selected element)
**Status: Partial — P1**
bim-ai shows inspector properties when elements are selected. Right-click context menu on selected elements (with commands like Edit Profile, Attach Top/Base, Split Element, Flip, Rotate, Mirror, etc.) is not fully implemented — actions are mostly in the inspector or via tool palette.

### 1.8 Objektwahl, Klick, Doppelklick und Objektfang (selection, double-click, snapping)

#### 1.8.1 Objektwahl (element selection: click, box, filter)
**Status: Partial — P1**
bim-ai supports single-click selection and basic selection filter (select-linked visibility). Missing: TAB-cycle selection for overlapping elements, selection filter dialog (Auswahlfilter) to narrow by category, window vs crossing box selection, "Select All Instances" from context menu.

#### 1.8.2 Griffe an markierten Objekten (grips on selected elements)
**Status: Done — P0**
bim-ai has a comprehensive grip system: grip3d.ts, grip3dProviders.ts, grip3dRenderer.ts for 3D; GripLayer.tsx for plan. Walls, doors, windows, roofs, stairs all have functional drag handles.

#### 1.8.3 Doppelklicken auf Objekte zum Bearbeiten (double-click to edit in context)
**Status: Partial — P1**
Double-clicking to enter element-specific edit mode (e.g. Edit Profile for walls/floors, Edit Sketch for roofs) is partially implemented. Not consistently available across all element types.

### 1.9 Info-Center (search Revit help, Autodesk Online)
**Status: N/A / Partial — P3**
Autodesk-specific help search. bim-ai has its own help/onboarding. Not a meaningful parity target.

### 1.10 Revit zurücksetzen (reset Revit UI layout to factory defaults)
**Status: Partial — P2**
bim-ai has persistent UI state. A "reset to defaults" for the workspace layout is not explicitly surfaced.

### 1.11 Die Familien-Bibliotheken (Revit Family Libraries — system families, loadable families, BIM content)
**Status: Partial — P1**
bim-ai has:
- FamilyLibraryPanel.tsx with internal and external catalogs
- External catalog loading (living room, kitchen furniture, etc.)
- Component placement runtime
Missing: browsing full Revit family library structure (Doors, Windows, Furniture, Structural, MEP categories with hundreds of types), no *.rfa import, BIMobject integration absent.

### 1.12 Übungsfragen (review questions)
**Status: N/A**

---

## Chapter 2 — Ein einfacher Grundriss (basic floor plan workflow)

### 2.1 Neues Projekt (new project setup)

#### 2.1.1 Projektinformationen (project info: name, number, address, author)
**Status: Partial — P1**
bim-ai allows setting a project name. Full Revit-style project information dialog (Projektnummer, Projektname, Projektadresse, Projektstatus, Auftraggeber, Erstellt von, Prüfdatum) is not implemented. This data feeds title blocks on sheets.

#### 2.1.2 Geschoss-Ebenen (floor levels: add, rename, edit elevation)
**Status: Done — P0**
LevelStack.tsx, level datums in 3D view, level-based authoring all implemented. Levels can be created, renamed, and assigned elevations.

#### 2.1.3 Projekt-Basispunkt (project base point)
**Status: Partial — P2**
bim-ai has origin markers (originMarkers.ts). A user-repositionable project base point / survey point with coordinates display (like Revit's pinned or movable base point) is not explicitly implemented.

#### 2.1.4 Sichtbarkeit mittels Filter steuern (visibility/graphics by filter)
**Status: Partial — P1**
bim-ai has a lens system (useLensFilter.ts, lensGhosting.ts) for category-level visibility toggles. Revit's full Visibility/Graphics dialog (V/G) with per-category line weight, colour, pattern overrides, and user-defined rule-based filters is not implemented.

#### 2.1.5 Arbeitsbereich in 2D festlegen (crop region / view range for plan)
**Status: Partial — P1**
bim-ai has cropRegionDrag and cropRegionDragHandles.ts. Plan crop region can be set. Revit's View Range dialog (Primary Range top/cut/bottom, View Depth) with numeric input is not yet fully exposed.

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
**Status: Partial — P1**
Basic floor placement is done. Revit's alternative slab boundary methods (e.g. picking wall faces automatically to create the boundary) are partially implemented. Floor edge profile (Deckenrand) not yet supported.

#### 2.4.3 Unterschied: Fixieren – Verbinden (Pin vs Join geometry)
**Status: Partial — P1**
bim-ai supports element pinning via inspector + PN chord + `modify.pin-selected`/`modify.unpin-all` palette commands (WP-B8). "Join Geometry" palette commands (`modify.join-geometry` / `modify.unjoin-geometry`) available when exactly 2 solid elements are selected (WP-B7). Full solid-geometry CSG trimming at intersections is still partial.

#### 2.4.4 Prioritäten (material layer priority for wall/floor/ceiling joins)
**Status: Partial — P1**
Material layer priority (1–5 Revit style) controls which layer dominates at junctions. bim-ai has layer material system (hostMaterialLayerTargets.ts) and effectiveHostMaterials.ts. Explicit numeric priority field per layer is partial — the join resolution logic exists in code but is not user-editable via property dialog.

### 2.5 Treppen (stairs)

#### 2.5.1 Vorbereitung der Treppenseitenwand (preparing stair side wall with shaft opening)
**Status: Partial — P1**
Shaft openings exist as a tool (shaft in tool registry). Stair side wall preparation workflow (drawing a shaft/void through floors and ceilings) is partially supported.

#### 2.5.2 Treppe erstellen (creating a stair: by component)
**Status: Done — P0**
Stair tool, StairBySketchCanvas, stair plan symbol, meshBuilders.multiRunStair.ts — stair creation works.

#### 2.5.3 Das Treppenloch (stair opening / floor void)
**Status: Partial — P1**
Shaft tool can cut floor openings. The auto-creation of a coordinated shaft when placing a stair is not done — the opening must be drawn separately.

### 2.6 Mehrere Stockwerke (multi-storey)

#### 2.6.1 Stockwerke kopieren (copy a floor to upper levels)
**Status: Done — G1**
Ctrl+C copies selection to clipboard; "Paste Aligned to Selected Levels" available via Cmd+K → PasteToLevelsDialog level-picker → dispatches copyElementsToLevels per target level. Full multi-floor copy workflow is now a single Cmd+K command.

#### 2.6.2 Geschossabhängige Änderungen (level-dependent modifications: top constraint, base offset)
**Status: Partial — P1**
Walls have top constraint (connects to level above) and base offset in properties. Not all elements expose full level-relative constraint properties. Floor, ceiling, and roof level constraints are partially implemented.

### 2.7 Dächer (basic roof — by footprint)
**Status: Done — P0**
Roof by footprint (roof tool), roof by sketch (roof-sketch tool). Hip/valley slopes per edge, slope angle in properties. Covered in full in Ch. 10.

### 2.8 Projektphasen (project phases: Existing, Demolition, New Construction)
**Status: Partial — P1**
Phase filter is implemented (phaseFilter.ts, PhaseDropdown in plan view). Elements can be assigned a phaseId. Phase filter visibility (show New/Demo/Existing in different graphic states) works at a basic level.

F1 (Phase Management): PhaseManagerDialog.tsx implemented — table shows sequence/name/description/element count, inline rename, up/down reorder, delete with confirmation, add new phase. Accessible via Project menu "Manage Phases...". 8 tests pass.

F3 (Project Information): ProjectInfoDialog.tsx implemented — standalone dialog with projectNumber, projectName, projectAddress, projectStatus, clientName, authorName, issueDate, checkDate, description, trueNorthAngleDeg. Accessible via Project menu "Project Information...". SheetCanvas.tsx updated to resolve token values from project_settings when sheet.metadata is empty, with greyed placeholder text for empty slots. 5 tests pass.

F6 (True North): projectNorthAngleDeg added to project_settings type. True North toggle button in PlanViewHeader.tsx (props: projectNorthAngleDeg, trueNorthActive, onTrueNorthToggle). Toggle button wired in Workspace.tsx pane trailing controls when north angle ≠ 0; applies CSS `rotate(-Ndeg)` to plan canvas wrapper. sunStore.ts extended with projectNorthOffsetDeg + displayAzimuthDeg() for adjusted sun azimuth. Note: mouse interaction is not coordinate-corrected in true-north mode (view-only rotation).

F2 (Phase Graphic Overrides): `phaseFilterMode` added to plan_view element type in core/index.ts. `resolvePhaseGraphicStyle()` pure function added to planProjection.ts — given a view's phaseId, phaseFilterMode, and an element's phaseCreated/phaseDemolished, returns `{hidden, opacity, dashed, grey}`. rebuildPlanMeshes() in symbology.ts extended with `viewPhaseId` + `phaseFilterMode` opts; `applyPhaseStyle()` helper traverses Three.js object children and applies grey colouring + opacity + LineDashedMaterial for demolished elements. Phase overlay applied to walls, curtain walls, doors, windows, floors. PlanCanvas.tsx derives viewPhaseId/phaseFilterMode from active plan_view element and passes to rebuildPlanMeshes. Phase filter mode selector (dropdown) added to Workspace.tsx paneTrailingControls (visible when active plan view has a phaseId set); dispatches updateElementProperty to persist the mode. Modes: `new_construction` (existing=grey, demolished=hidden, new=normal), `demolition` (existing=grey, demolished=dashed, new=hidden), `existing` (only existing shown), `as_built` (all normal). 11 tests added to planProjection.test.ts (all pass).

Still missing:
- Elements automatically acquiring correct phase based on creation context
- Phase graphic overrides do not yet apply to roof, ceiling, railing, beam, stair elements

### 2.9 Weitere Grundrisse und Ansichten (additional floor plans and views)

#### 2.9.1 Terrasse (terrace: modeling balcony/terrace with floor + railing)
**Status: Partial — P1**
Floors, railings exist. Modeling a terrace with cantilevered floor, stepped edges, and railing is possible but lacks "terrace-specific" templates or workflow shortcuts.

#### 2.9.2 Eingangstreppe (entrance stair: straight stair with landing)
**Status: Done — P0**
Single-run stair with landing works via the stair tool.

#### 2.9.3 Komplexe Treppe (complex stair: L-shape, U-shape, multi-landing)
**Status: Done — G1**
L-shape (2 runs + 90° landing), U-shape (3 runs + 2 landings), winder stairs (winderAtCorner: wedge treads), and spiral stairs (centerMm, innerRadiusMm, outerRadiusMm, totalRotationDeg) all implemented in meshBuilders.multiRunStair.ts with 19 tests. stairPlanSymbol.ts handles all shapes with 7 tests.

#### 2.9.4 Obergeschoss (upper floor plan derived from lower floor)
**Status: Partial — P2**
Upper floor plans are created as separate level plan views. The workflow of using the lower floor as a reference underlay while drawing the upper floor is supported via plan underlays (not fully explicit in UI).

#### 2.9.5 Keller (basement: below-grade levels)
**Status: Done — P0**
Levels below elevation 0 work fine. Basement walls with base constraint to lower levels are possible.

### 2.10 Übungsfragen
**Status: N/A**

---

## Chapter 3 — Bearbeitungsfunktionen der Basiselemente (modify tools)

### 3.1 3D-Ansicht für einzelne Geschosse erstellen (section box to isolate a floor in 3D)
**Status: Partial — P1**
Section box (sectionBox.ts) exists. Applying a section box clipped to a specific level's extents is not a one-click "show floor X in 3D" command as Revit offers.

### 3.2 3D-Ansicht für ein Geschoss über View Cube (orienting 3D view via ViewCube)
**Status: Partial — P1**
ViewCube exists and provides 26 standard orientations. The Revit workflow of right-clicking ViewCube → Orient to View (section, elevation, plan) to bring a 2D view's crop/orientation into the 3D section box is Not Started.

### 3.3 Das Register »Ändern« (Modify ribbon and tools)

#### 3.3.1 Gruppe »Auswählen« (selection filter, link selection toggle)
**Status: Partial — P1**
Select tool exists. Selection filter by category (Auswahlfilter dialog) implemented — SelectionFilterDialog.tsx groups selected elements by kind with checkboxes, dispatches deselectByCategory on apply; wired in Workspace.tsx + Cmd+K palette (selection.filter). "Select All Instances in Project" palette command also added (selection.select-all-instances). Link selection toggle is Not Started (no linked model workflow yet). (WP-B6)

#### 3.3.2 Gruppe »Eigenschaften« (Properties panel access from Modify)
**Status: Done — P1**
Inspector panel always shows properties of selected element.

#### 3.3.3 Gruppe »Zwischenablage« (clipboard: cut, copy, paste, paste aligned)
**Status: Done — G1**
Ctrl+C copies selection to clipboard (copyElementsToClipboard); Ctrl+V pastes at cursor (pasteFromOSClipboard) — both wired in PlanCanvas.tsx. copyToLevels / pasteAlignedToLevels helpers implemented with 6 unit tests. "Paste Aligned to Selected Levels" available via Cmd+K (clipboard.paste-to-levels) and implemented as PasteToLevelsDialog with 8 tests.
- **C6:** Ctrl+C/V wired. copyToLevels.ts + pasteAlignedToLevels fully implemented. PasteToLevelsDialog (Cmd+K → level-picker modal → dispatches copyElementsToLevels per target) complete with 8 passing tests. Dialog now wired in Workspace.tsx (openPasteToLevels palette context) — WP-B3 done.

#### 3.3.4 Gruppe »Geometrie« (geometry group: Join, Unjoin, Cut, Uncut geometry, Paint)
**Status: Partial — P1**
- Join Geometry: Implemented — joinGeometry.ts command shapes + selection validation + `modify.join-geometry` / `modify.unjoin-geometry` in Cmd+K palette (WP-B7)
- Cut Geometry: Partial (shaft openings, wall voids via CSG)
- Unjoin: Implemented via palette command (WP-B7)
- Paint (apply material to individual face): Not Started — no paint bucket tool

#### 3.3.5 Gruppe »Steuerelemente« (controls: show/hide constraints, lock/unlock)
**Status: Partial — P2**
Pin element is available. Show/hide dimension constraints on canvas is Partial.

#### 3.3.6 Gruppe »Ändern« (modify group: move, copy, rotate, mirror, array, scale, align, split, trim, offset, delete)
**Status: Partial — P0**
- Move: Done (moveTool.ts)
- Copy: Done (copy in tool registry)
- Rotate: Done (rotateTool.ts)
- Mirror (axis / pick axis): Done (mirror in tool registry)
- Array (linear and radial): **Implemented (WP-B wave 2)** — `arrayTool.ts` math helpers + `ArrayState`/`reduceArray` grammar (14 unit tests) complete. PlanCanvas.tsx now fully wired: click handler routes through `reduceArray` phases (idle → pick-start → pick-end → confirm-linear / pick-center → confirm-radial), Enter key fires confirm, Escape cancels, instruction banner + Linear/Radial toggle + Count input shown. Fires `createLinearArray`/`createRadialArray` semantic commands on confirm.
- Scale: **Implemented (WP-B1)** — grammar (ScaleState/reduceScale, 12 tests) + full PlanCanvas.tsx wiring: click handler dispatches ScaleEvent phases (pick-origin → enter-factor → confirm/graphical), numeric input overlay with `×` suffix, phase instruction banner, Escape/cancel handling. Fires `scaleElement` semantic command on commit.
- Align: Done (align in tool registry)
- Split (wall/line): Done (split tool)
- Trim / Extend: Done (trim, trim-extend tools)
- Offset: Done (offset tool, wallOffsetTool.ts)
- Delete: Done

#### 3.3.7 Gruppe »Ansicht« (view group in Modify: linework override, paint surface)
**Status: Not Started — P2**
Linework (override line style of individual edges in a view) and paint (assign material to face) are not implemented.

#### 3.3.8 Gruppe »Messen« (measure group: measure distance, measure arc, measure angle)
**Status: Partial — P1**
Measure tool is in the tool registry. Distance measurement is implemented. Angle and arc measurements are Not Started.

#### 3.3.9 Gruppe »Erstellen« (create group in Modify: create similar, create group)
**Status: Partial — P2**
createSimilar.ts helper + CS shortcut in cheatsheet; PlanCanvas keyboard handler pending. Create Group: implemented as `model.create-group` Cmd+K command — opens `CreateGroupDialog.tsx` (name prompt + centroid origin) when ≥2 elements selected (WP-B2).

### 3.4 Geschossdecken bearbeiten (edit floor/slab shapes)

#### 3.4.1 Geschossdecke am Dach begrenzen (attaching floor to roof: Edit Boundary or Slope Arrow)
**Status: Partial — P1**
Floor boundary editing works. Slope arrow for sloped floors is partially implemented. Aligning the floor top to a roof underside (Attach Top/Base) is Not Started.

#### 3.4.2 Bodenplatte im Keller bearbeiten (basement slab editing)
**Status: Partial — P1**
Same as floor editing above. Sub-floor thickening, drainage slope via sub-element editing (split surface) are Not Started.

### 3.5 Wände bearbeiten (wall editing)

#### 3.5.1 Die Schnitthöhe für Geschossansichten (view cut height for plan views)
**Status: Partial — P1**
Plan view cut height defaults to a sensible value. Revit's View Range dialog with explicit cut plane height input per plan view is Not Started as a dedicated dialog.

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
**Status: Partial — P1**
- Pin: Implemented — pinUnpin.ts helpers + PN chord shortcut in PlanCanvas + `modify.pin-selected` / `modify.unpin-selected` / `modify.unpin-all` in Cmd+K palette + padlock 📌 glyph overlay in plan view (WP-B8)
- Edit Profile (non-rectangular wall cross-section profile): Partial — wall profile shape editing via sketch is partially implemented
- Join / Unjoin tool (explicitly controlling how two walls join): Partial (wall-join tool in registry)

#### 3.5.6 Wände in Laufrichtung verbinden (connect walls end-to-end along run)
**Status: Done — P0**
Wall chain placement and wall join auto-resolution handle this.

#### 3.5.7 Geneigte und verjüngte Wände (sloped and tapered walls)
**Status: Partial — P1**
Sloped walls (angle property) and tapered walls (different thickness top vs bottom) exist as Revit parameters. bim-ai's wall mesh builder has partial support for tapered/sloped walls (meshBuilders.layeredWall.ts, csgWallBaseGeometry.ts). Inspector exposure of slope/taper parameters is incomplete.

### 3.6 Fenster bearbeiten (editing windows)

#### 3.6.1 Eigenschaften bearbeiten (editing window instance properties: sill height, width, height)
**Status: Done — P0**
Window properties editable in inspector.

#### 3.6.2 Fenster aus Bibliotheken (loading window families from library)
**Status: Partial — P1**
Window family types are available through the family catalog. Loading arbitrary *.rfa window families is not supported. The selection of available window types is smaller than Revit's full library.

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
**Status: Partial — P1**
Dimension tool is in the tool registry. autoDimension.ts, tempDimensions.ts, helperDimensions.ts all exist. Permanent annotation dimensions are Partial.

### 4.2 Die ausgerichtete Bemaßung (aligned dimension)

#### 4.2.1 Beispiel für ausgerichtete Bemaßung (basic aligned dim chain)
**Status: Partial — P1**
Aligned dimension placement is partially implemented. Creating a full Revit-style permanent dimension chain clicking multiple reference lines is partial.

#### 4.2.2 EQ-Bedingung (equal constraint on dimension chain)
**Status: Partial — P2 (EQ toggle and visual display implemented)**
`permanent_dimension` element type added to `@bim-ai/core` with `witnessPointsMm[]`, `offsetMm`, and `eqEnabled` flag. Plan rendering in `permanentDimensionThree()` draws witness lines between each adjacent pair of witness points and: when `eqEnabled` is false renders per-segment length labels; when `eqEnabled` is true renders a single "EQ" label at the span midpoint. Inspector shows segment count and an EQ toggle button (`data-testid="inspector-permanent-dimension-eq"`). Parametric enforcement (driving actual spacings equal) is Not Started.

#### 4.2.3 Fensterbreiten und Wandlängen gleichsetzen (equalise window widths/wall lengths via EQ)
**Status: Not Started — P1**
Parametric constraint derived from EQ condition.

#### 4.2.4 Bemaßungsstil (dimension style: text size, witness line gap, arrow type)
**Status: Partial — P2**
draftingStandards.ts and symbology.ts exist. A user-facing dimension style editor is Not Started.

#### 4.2.5 Maßkette bearbeiten (editing a dimension string: move text, flip witness line)
**Status: Partial — P1**
Temporary dimension editing works. Permanent dimension string editing (drag text label, flip, modify witness lines) is Partial.

#### 4.2.6 Weitere Maßketten (additional dimension strings: stacked dims)
**Status: Partial — P2**
Multiple parallel dimension chains can be placed. Auto-stacking is Not Started.

#### 4.2.7 Bemaßung mit Referenzlinie (dimensioning to reference plane)
**Status: Partial — P2**
Reference planes exist (reference-plane tool). Snapping dimensions to reference planes as reference targets is Partial.

### 4.3 Die lineare Bemaßung (linear / horizontal-vertical dimension)

#### 4.3.1 Maßtexte ergänzen (adding suffix/prefix text to dimension value)
**Status: Done — P2**
`textPrefix?`, `textSuffix?`, `textOverride?` added to dimension element type. planElementMeshBuilders.ts uses textOverride when set, else composes prefix+measured+suffix. Inspector shows editable inputs when onPropertyChange is wired. 4 tests in InspectorContent.test.tsx.

### 4.4 Winkelbemaßung (angular dimension)
**Status: Partial — P1**
`angular-dimension` ToolId (hotkey `AD`), grammar (idle→first-ray→second-ray→commitAngular), and plan renderer (two radial lines + angle label) implemented. Core element type `angular_dimension` exists. Grip provider (vertex drag) and inspector panel added.

### 4.5 Radius- und Durchmesserbemaßungen (radial and diameter dimensions)
**Status: Partial — P1**
`radial-dimension` (hotkey `RD`) and `diameter-dimension` (hotkey `DD`) ToolIds added. Grammar: 2-click idle→arc-point→commitRadial. Plan renderer: line + R/ø label sprite. Grip provider (arcPointMm drag) and inspector panel (computed radius/diameter) added.

### 4.6 Bogenlängenbemaßung (arc length dimension)
**Status: Partial — P2**
`arc-length-dimension` ToolId (hotkey `ALD`) added. Single-click grammar. Plan renderer draws arc-length label at midpoint. Grip provider (center drag) and inspector panel (arc length, angle, radius) added.

### 4.7 Höhenkoten (spot elevation annotation)
**Status: Partial — P1**
`spot-elevation` ToolId (hotkey `SE`) added. Single-click grammar. Plan renderer draws elevation label (prefix+mm/1000+suffix). Grip provider (position drag) and inspector panel (elevationMm editable) added. 3D viewport text label Not Started.

### 4.8 Punktkoordinate (spot coordinate annotation)
**Status: Partial — P2**
`spot-coordinate` ToolId (hotkey `SP`) added. Single-click grammar. Plan renderer draws N/E coordinate label. Grip provider (position drag) and inspector panel (N/E read-only) added.

### 4.9 Neigungskote (slope annotation / grade arrow)
**Status: Partial — P2**
`slope-annotation` ToolId (hotkey `SL`) added. Two-click grammar (idle→end-point→commitSlope). Plan renderer draws slope percentage label. Grip provider (position drag) and inspector panel (slopePct editable) added.

### 4.10 Text und Hinweistext (text and leader text annotations)
**Status: Partial — P1**
`text` ToolId (hotkey `TX`) and `leader-text` ToolId (hotkey `LT`) added. Grammar machines: reduceTextAnnotation and reduceLeaderText implemented. Inspector panels: text_note (content textarea, fontSizeMm, rotationDeg); leader_text (content textarea, arrowStyle dropdown). Grip providers: textNoteGripProvider (position), leaderTextGripProvider (anchor + text-block). Rich-text formatting Not Started.

### 4.11 Bauteile beschriften (element tags / labels)

#### 4.11.1 Automatische Element-Beschriftungen (auto-tag by category)
**Status: Partial — P1**
autoTags.ts and manualTags.ts exist. Tag tool is in the registry. Auto-tagging by category (tag all walls, all rooms, etc.) is Partial.

#### 4.11.2 Element-Bauelement (element tag: door/window/room tag)
**Status: Partial — P1**
Room tags, window/door tags exist. Tag content (mark number, type, dimensions) is partially driven by family data.

#### 4.11.3 Material-Bauelement (material tag)
**Status: Partial — P2**
`material-tag` ToolId (hotkey `MT`) added. Single-click grammar. Plan renderer draws material name label. Live layer lookup implemented: resolves wallTypeId → layer[layerIndex].materialKey when textOverride is absent.

### 4.12 Übungsfragen
**Status: N/A**

---

## Chapter 5 — Gelände, Höhenausrichtung, Nord-Richtung (terrain, geo, orientation)

### 5.1 Gelände (terrain / toposolid)

#### 5.1.1 Gelände aus Skizze (terrain from sketch: place points at elevation)
**Status: Partial — P1**
Toposolid subdivision tool is in the registry. Terrain mesh from OSM data is in meshBuilders.osmContext.ts. Manual terrain point-placement (sketch from scratch with elevation per point) is Partial.

#### 5.1.2 Gelände bearbeiten (edit existing terrain: move points, change elevation)
**Status: Partial — P1**
Toposolid terrain editing via grips is partially supported.

#### 5.1.3 Höhenlinien (contour lines display on terrain)
**Status: Partial — P2**
Terrain mesh is rendered as 3D surface. Contour line annotation overlay on plan view is Not Started.

#### 5.1.4 Gelände-Ausschnitte (pad / subregion: flatten an area of terrain for building)
**Status: Partial — P1**
Toposolid pad (flattened subregion for building footprint) is referenced in the revit-site-toposolid-parity-tracker. Partially implemented.

#### 5.1.5 Baugrube (building pad / excavation cut)
**Status: Not Started — P1**
Excavation cut in terrain (Baugrube = cut showing the pit for a basement) is not implemented.

#### 5.1.6 Weitere Geländewerkzeuge (additional terrain tools: merge, split surface, graded region)
**Status: Not Started — P2**
Merging terrain surfaces, splitting, graded regions between different pad heights are not implemented.

### 5.2 Geografische Position (geographic location / georeferencing)
**Status: Done — P1**
Georeference implemented: OSM address autocomplete, map picker (Leaflet), lat/lon stored in project. Georeferencing is wired into the Project Setup (Location/Sun step). OSM site context with bbox rectangle is done.

### 5.3 Projekt auf echte Höhe verschieben (move project to real-world elevation)
**Status: Partial — P2**
Project base point exists. Moving the entire project to a real-world elevation offset is Partial — no explicit UI command.

### 5.4 Ausrichten nach der Himmelsrichtung (true north orientation)

#### 5.4.1 Nordpfeil (north arrow annotation on sheets)
**Status: Partial — P2**
`north-arrow` ToolId (hotkey `NA`) added. Single-click grammar. Core annotation_symbol element type with symbolType north_arrow exists. Sheet canvas now renders north_arrow symbols as SVG circle+arrow+N glyph; rotation = element.rotationDeg + project_settings.projectNorthAngleDeg. 3 tests in SheetCanvas.test.tsx.

#### 5.4.2 Ansicht auf Nordrichtung drehen (rotate plan view to true north)
**Status: Partial — P2**
Project base rotation for true north is partially supported via the georeference/OSM setup. An explicit "rotate project north" command in the plan view is Not Started.

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
**Status: Partial — P1**
- Standard 3D orthographic/perspective: Done
- ViewCube navigation: Done (Partial parity — see Ch. 3)
- Section box: Done (sectionBox.ts)
- Named locked 3D view: Partial — "Save 3D View As…" dialog (`Save3dViewAsDialog.tsx`) prompts for a name before persisting a `saved_view` element with camera + clip state (D5). `saved_view` rows appear in ProjectBrowser. Lock toggle implemented: right-click → Lock/Unlock Camera in WorkspaceLeftRail + ProjectBrowserV3 context menus; `isLocked` field on `SavedViewElem` blocks pan/orbit in Viewport.tsx. Sheet placement not yet implemented.

#### 6.1.4 Außenansichten (elevation views: North, South, East, West)
**Status: Partial — P1**
Elevation tool and elevation marker exist. Four cardinal elevation views are auto-created with a new project in Revit. In bim-ai, elevation views must be placed manually. Elevation view rendering from the model (showing actual geometry in 2D elevation projection) is in sectionViewportSvg.tsx/sectionViewportDoc.ts — Partial.

#### 6.1.5 Innenansichten (interior elevation views)
**Status: Partial — D2 (inspector+grip done; full elevation-view rendering is separate)**
Interior elevation placement: `interior-elevation` tool (hotkey `IE`) added to plan palette. Single-click dispatches `create_interior_elevation_marker` command; server auto-creates four `elevation_view` children (N/S/E/W). `interior_elevation_marker` element type in `@bim-ai/core` with `positionMm`, `levelId`, `radiusMm`, and `elevationViewIds` (N/S/E/W). Plan symbol: 4-quadrant circle with inward arrows rendered in `symbology.ts`. Inspector panel (radius, levelId) and drag-grip implemented in wave 2 WP-A.

#### 6.1.6 Schnittansicht (section view: cross section, building section)
**Status: Partial — P1**
Section tool exists, section views are generated (sectionViewportSvg.tsx). A fully rendered and annotated building section view matching Revit quality (with automatic material hatch patterns, cut line weights, section head bubbles) is Partial.

### 6.2 Planerstellung (sheet setup: sheet with title block)
**Status: Partial — P1**
NewSheetDialog.tsx, SheetCanvas.tsx, SheetReviewSurface.tsx exist. Sheets can be created and views placed on them. Missing: user-customisable title blocks (Schriftkopf) with project information fields, dynamic title block families, viewport scale labels on sheets.

### 6.3 Plan mit Änderungsliste (sheet with revision table / delta list)
**Status: Done — revision table rendered in title block**
`revision` and `sheet_revision` element types added to `@bim-ai/core`. `ManageRevisionsDialog.tsx` implements CRUD for project revisions and per-sheet assignment via checkboxes (`sheet_revision` join records). Commands: `create_revision`, `update_revision`, `delete_revision`, `add_sheet_revision`, `remove_sheet_revision`. Revision clouds (`revision_cloud` annotation — ANN-03) already existed. `SheetRevisionTableSvg` renders in the bottom-right corner of the title block (via `sheetTitleblockAuthoring.tsx`); `resolveSheetRevisions` joins `sheet_revision` → `revision` records, sorts by number ascending, shows a placeholder "—" row when none are assigned. Tests: `sheetRevisionTable.test.ts` (5 tests). Revision-cloud draw tool (E3): `'revision-cloud'` ToolId (hotkey RC, plan mode), `RevisionCloudState`/`reduceRevisionCloud` grammar, PlanCanvas click/dblclick/Enter/Escape wiring, and `revisionCloudPlanThree` plan renderer (dashed closed polygon, orange default, view-scoped). Tests in `toolGrammar.revisionCloud.test.ts` (5) and `revisionCloudRendering.test.ts` (7).

### 6.4 Detailansichten und Detaillierung (detail views and 2D detailing)

#### 6.4.1 Detailausschnitt (detail callout / enlarged plan area)
**Status: Partial — D4**
CalloutMarker.tsx and DetailRegionTool.tsx / DetailRegionRenderer.tsx exist. Placed detail callout regions appear in plan. `buildCalloutViewCommand` creates `plan_view` with `planViewSubtype: 'callout'`. `tabFromElement` maps callout views to workspace tabs with the label `"Detail callout · <name>"`. Tests in `detailCallout.test.ts` pass (4 tests). The full enlarged detail view rendering (showing zoomed geometry) is Partial.

#### 6.4.2 Detailansicht (detail view: 2D drawing in isolation)
**Status: Partial — P2**
detailComponentsRender.ts exists. 2D detail components (insulation, section hatching, fill patterns) are Partial. A full Revit-style 2D detail view where the architect draws independently of the 3D model is Not Started.

### 6.5 Plot (printing to plotter/printer)
**Status: Not Started — P1**
Print to physical printer or export as raster image directly from bim-ai is Not Started. PDF export (see 12.4.5) is the workaround.

### 6.6 Übungsfragen
**Status: N/A**

---

## Chapter 7 — Konstruktionshilfen (drafting aids)

### 7.1 Modelllinien (model lines as 3D construction geometry)

#### 7.1.1 Beispiel für Hilfskonstruktion (construction line example)
**Status: Partial — P1**
Model lines as persistent 3D sketch geometry (not just reference planes) are used in the family editor. In the project environment, model line as a general-purpose authoring aid is Partial.

### 7.2 Raster (structural grid lines)
**Status: Done — P0**
Grid tool is in the tool registry. Grid lines with bubble labels, structural grid as reference for column placement — implemented.

### 7.3 Arbeitsebenen (work planes)

#### 7.3.1 Arbeitsebenen erstellen (create work plane by name, pick plane, pick line)
**Status: Partial — P1**
Reference planes (reference-plane tool) serve as work planes. The explicit "Set Work Plane" dialog (by name/pick/pick line) as Revit's work plane workflow is Partial.

#### 7.3.2 Arbeitsebene ausrichten (orient work plane to face of element)
**Status: Partial — P2**
Orienting the current work plane to an arbitrary element face (for placing elements on sloped surfaces) is Not Started.

#### 7.3.3 Arbeitsebenenraster für Wandkonstruktion nutzen (work plane grid for wall construction)
**Status: Partial — P2**
Grid display on the active work plane for snap reference is Not Started.

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
**Status: Partial — P1**
`parts?: Array<{ id, startT, endT, materialId? }>` data model added to `wall` element in `packages/core/src/index.ts`. "Create Parts" ribbon action (`'wall-create-parts'` RibbonActionId) added to the Modify | Wall contextual tab (Parts panel). `buildEqualParts(n)` helper splits the wall into n equal segments (4 tests in `wallParts.test.ts`). Full rendering of individual parts in plan and 3D inspector is not yet implemented.

#### 8.1.4 Fassadenwände (curtain walls: grid, panels, mullions)
**Status: Implemented — P1**
Implemented — inspector + custom grid editing done. Panel grid rendering: done (`meshBuilders.curtainPanels.test.ts`). Plan symbol: done (`curtainWallPlanSymbol.ts`, 4 tests). Inspector extended with H/V count inputs, Panel type dropdown (Glass/Spandrel/Solid), Mullion type dropdown (Rectangular/Circular/None), and "Edit Grid…" button; `customVDivisions` field added to `curtainWallData` type; `curtainWallPlanSymbol.ts` renders custom ticks in priority over uniform grid; `curtainWallPanelType`/`curtainWallMullionType` fields added to Python `WallElem` with `updateElementProperty` handlers; 5 new `curtainWallPlanSymbol.customDivisions.test.ts` tests pass.

#### 8.1.5 Abziehbilder (decals / surface images on wall faces)
**Status: Implemented — 'decal' ToolId + grammar + inspector**
`'decal'` added to `ToolId` union (hotkey `DC`, 3D mode only) in `toolRegistry.ts`. `DecalState` / `reduceDecal` added to `toolGrammar.ts`: idle → face-click → picking-image → image-chosen → createDecal effect (positionMm, normalVec, imageSrc, widthMm 1000, heightMm 1000). `DecalElem` extended with optional placement fields (`positionMm`, `normalVec`, `imageSrc`, `widthMm`, `heightMm`). `buildDecalMesh()` already exists in `meshBuilders.ts`. 6 grammar tests passing.

### 8.2 Decken und Lampen (ceilings and light fixtures)
**Status: Partial — P1**
Ceiling tool is in the tool registry. Ceiling with automatic boundary from enclosing walls is Partial. Placing light fixtures (MEP-terminal/fixture) on ceilings works. Ceiling with grid pattern overlay in plan view is Not Started.

### 8.3 Fertig-Fußböden (finish floor over structural slab)
**Status: Partial — P1**
Multiple floor layers can be modelled stacked (structural floor + finish floor). No dedicated "finish floor" workflow or automatic thin-layer floor type set.

### 8.4 Anpassen von Türen und Treppen (adjusting door/stair clearances)
**Status: Partial — P1**
Door clearance (hostedOpeningDimensions.ts, openingClearance.ts) is implemented for detection/advisory. Stair auto-balance (stairAutobalance.ts) adjusts run widths. Interactive head-height clearance checking is Not Started.

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
**Status: Partial — P1**
Component-by-component stair authoring is partially supported. Independent run/landing/railing assembly with granular control is Partial.

#### 8.6.3 Treppe nach Skizze (stair by sketch: boundary line + run line)
**Status: Partial — P1**
StairBySketchCanvas.tsx exists. Sketch-based stair (define boundary + run + landing by drawing lines) is Partial — not all configurations produce valid geometry.

#### 8.6.4 Standard-Treppe umbauen (edit an existing stair)
**Status: Partial — P1**
Grips on existing stairs for editing rise/run count, width, and direction exist partially. Full "Edit Stair" mode with component editing is Partial.

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
**Status: Partial — P1**
`editGroup`/`finishEditGroup` command shapes exist in `groupCommands.ts`. **Missing**: edit-mode UI — ghosting non-group elements, restricting selection to group members, and "Finish Editing" button.

### 8.10 Übungsfragen
**Status: N/A**

---

## Chapter 9 — Tragwerke (structural elements)

### 9.1 Stützen (columns)

#### 9.1.1 Stützenarten (architectural vs structural columns)
**Status: Partial — P1**
Column tool is in the registry. Architectural (non-load-bearing) columns and structural columns are both supported by Revit. In bim-ai, a generic column element exists. Separate architectural vs structural column types with different parameter sets are Not Explicitly Distinguished.

#### 9.1.2 Raster für Stützen (column at grid intersections)
**Status: Partial — G3**
`column-at-grids` tool added to toolRegistry (hotkey CAG, plan-only). Grammar: `ColumnAtGridsState` state machine in toolGrammar.ts; PlanCanvas.tsx wires click→toggleGrid (via raycaster pick) and Enter→confirm→`columnPositionsAtGridIntersections`→N `createColumn` commands. `columnAtGrids.ts` helper (gridLineIntersection + columnPositionsAtGridIntersections) with 5 tests. Missing: options bar UI button, visual highlight of selected grids.

#### 9.1.3 Nichttragende Stützen (non-structural columns: pilasters, casing)
**Status: Partial — P2**
Non-structural decorative columns can be placed. No separate family type distinction.

#### 9.1.4 Geneigte Stützen (sloped columns)
**Status: Implemented — sloped column data model + mesh + plan symbol + inspector**
`topOffsetXMm` and `topOffsetYMm` optional fields added to column element in `@bim-ai/core`. `makeColumnMesh()` in `meshBuilders.ts` now shears top vertices of the BoxGeometry by the offset when non-zero. Plan symbol added in `symbology.ts` (`columnPlanThree`): solid base footprint with cross diagonal, plus dashed top footprint and centre-to-centre diagonal line for sloped columns. 5 tests passing (straight regression, top vertex shift, bottom vertex unaffected, zero-offset no-op, Mesh instance check).

### 9.2 Träger (beams)
**Status: Partial — P1**
Beam tool is in the registry. Beam placement between columns/walls works. No full section profile catalog (I-beam, H-beam, HSS, etc.) as richly populated as Revit's structural content.

### 9.3 Trägersysteme (beam systems: auto-fill framing between beams)
**Status: Partial — G2**
`beam_system` ElemKind in core, `'beam-system'` tool in toolRegistry (hotkey BS, plan+3D), 3D mesh builder (`meshBuilders.beamSystem.ts`), plan boundary + direction-arrow symbol (`beamSystemPlanSymbol.ts`), click-to-sketch grammar (`toolGrammar.ts` reduceBeamSystem), PlanCanvas.tsx click dispatch → `createBeamSystem` command with default spacing 1200 mm / direction 0°. Inspector and spacing/direction options bar are not yet implemented.

### 9.4 Streben (braces / diagonal structural members)
**Status: Implemented — G1**
Brace element added: `kind: 'brace'` in core Element union, `'brace'` tool in toolRegistry (hotkey BR, plan+3D modes), 3D mesh builder, plan symbol, and Vitest tests.

### 9.5 Stahlbau-Funktionen (steel fabrication tools)

#### 9.5.1 Verbindungen erstellen und ändern (steel connections: end plates, bolted flanges)
**Status: Not Started — P1**
No steel connection modeling.

#### 9.5.2 Listen für Verbindungselemente (connection element schedules)
**Status: Not Started — P2**
No steel connection schedules.

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
**Status: Partial — P1**
Slope arrow for roof (instead of per-edge slope) is Partial — the concept exists in floor sketches but for roofs it is Not Fully Exposed.

### 10.2 Dächer über Extrusion (roof by extrusion / profile sweep)
**Status: Implemented — P1**
`'roof-by-extrusion'` ToolId (hotkey `RE`, plan mode) added to `toolRegistry.ts` and `PALETTE_ORDER`. `RoofByExtrusionState` / `reduceRoofByExtrusion` grammar state machine added to `toolGrammar.ts`: idle → recording (click to collect profile points) → confirm-depth (Enter/double-click with ≥2 pts) → createRoofByExtrusion effect → dispatches `createRoof` command with `extrusionDepthMm`. PlanCanvas wired: activation, click handler, Enter (recording→confirm-depth; confirm-depth→createRoof), Escape, numeric depth input. `extrusionDepthMm?` field added to roof element in `packages/core/src/index.ts`. 5 grammar tests in `toolGrammar.roofByExtrusion.test.ts`.

### 10.3 Sonderformen (special roof shapes)

#### 10.3.1 Kegeldach (conical roof)
**Status: Partial — P2**
Rotational symmetric roof shapes are partially supported via mass modeling (meshBuilders.mass.ts). A dedicated conical roof family is Not Started.

#### 10.3.2 Weitere Rotationssymmetrische Dächer (dome, onion dome)
**Status: Not Started — P2**
No dedicated special dome/rotational roof families.

#### 10.3.3 Turmhelme (spire / tower cap roofs)
**Status: Not Started — P3**
No spire/tower cap specific shapes.

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
**Status: Not Started — P1**
Full top-down massing → BIM workflow (mass → generate walls/roof/floors from faces, apply curtain system to face) is Not Started end-to-end.

### 11.6 Übungsfragen
**Status: N/A**

---

## Chapter 12 — Import – Export

### 12.1 Import-Funktionen

#### 12.1.1 Verknüpfungen (link Revit files, IFC files, CAD files, point clouds)
**Status: Partial — P1**
- Link another bim-ai model file: Done — `link_model` element type in `@bim-ai/core`; `ManageLinksDialog.tsx` provides full UI to add/delete/align/pin linked models; `linkedGhosting.ts` ghosts linked meshes with blue tint at 0.6 opacity; linked elements are non-selectable/non-editable (`isLinkedElementId` guards in Viewport.tsx); `hidden?` toggle wired via ProjectBrowser; ghosting tests in `src/viewport/linkedGhosting.test.ts` and `src/export/linkedModelGhosting.test.ts` (E5)
- Link IFC: Not Started
- Link CAD (DWG/DXF/DGN): DXF underlay exists (dxfUnderlay.ts — Partial); circle, text, and hatch entities now rendered (E6)
- Link PDF: Not Started
- Point cloud: Not Started

#### 12.1.2 Importieren (import CAD / IFC into project)
**Status: Partial — P1**
- Import DXF as underlay: Done (dxfUnderlay.ts)
- Import DWG: Partial (uses same DXF path)
- Import IFC: Not Started
- Import SKP (SketchUp): Not Started
- Import gbXML: Not Started

#### 12.1.3 Aus Bibliothek laden (load family from Revit library / online)
**Status: Partial — P1**
Family library panel with internal and external catalogs. Loading Revit *.rfa format is not supported. Loading from BIMobject or similar online library is Not Started.

### 12.2 Nützliche CAD-Importe

#### 12.2.1 Grundrisse aus CAD (using a CAD floor plan as underlay for tracing)
**Status: Done — P1**
DXF underlay (dxfUnderlay.ts) + ImageTraceDropZone.tsx — importing a CAD/image underlay to trace over is implemented. Entity support: line, polyline, arc (tessellated), circle, text, and hatch boundary loops (E6).

#### 12.2.2 Geländevolumenkörper aus CAD (terrain mesh from CAD contours)
**Status: Not Started — P2**
Converting CAD contour lines to a terrain mesh is not implemented.

#### 12.2.3 BIM-Import aus Inventor (ADSK exchange format for Inventor interop)
**Status: Not Started — P3**
Autodesk Inventor *.adsk / *.iam interop is not relevant to bim-ai's web context.

### 12.3 Internet-Bibliotheken nutzen: BIMobject (loading families from BIMobject.com)
**Status: Not Started — P2**
BIMobject catalog integration is not implemented. bim-ai has external catalogs but not BIMobject-specific.

### 12.4 Export-Funktionen

#### 12.4.1 CSV-Export von Bauteillisten (schedule/quantity CSV export)
**Status: Done — P1**
Client-side CSV export implemented in `export/csvExporter.ts`. Copy to Clipboard also supported. Server-side CSV was already in place; client-side `generateCsv`, `downloadCsv`, and `copyCsvToClipboard` functions added. A "Copy" button added to `SchedulePanel.tsx` next to the existing CSV button.

#### 12.4.2 Export mit deutschsprachigen Layern (DWG export with custom layer mapping)
**Status: Not Started — P2**
DWG export is not implemented.

#### 12.4.3 Exportieren nach CAD (DWG/DXF/DGN export) + IFC Export
**Status: Partial — P1**
No DWG or DGN export. DXF export is implemented (see below).

IFC 2x3 export (E1): Implemented as a pure-TypeScript ISO 10303-21 STEP writer at `packages/web/src/export/ifcExporter.ts`. Exports `IFCPROJECT`, `IFCSITE`, `IFCBUILDING`, `IFCBUILDINGSTOREY` hierarchy plus `IFCWALLSTANDARDCASE`, `IFCDOOR`, `IFCWINDOW`, `IFCOPENINGELEMENT`, `IFCRELVOIDSELEMENT`, `IFCSLAB` (FLOOR/ROOF), and `IFCSPACE`. Includes `IFCMATERIALLAYERSETUSAGE` per wall, and standard Psets: `Pset_WallCommon`, `Pset_DoorCommon`, `Pset_WindowCommon`, `Pset_SlabCommon`, `Pset_SpaceCommon` (with `NetFloorArea` / `GrossFloorArea` from polygon area). No WASM dependency. 7 passing tests in `ifcExporter.test.ts` including round-trip header validation. Menu trigger wired in `ProjectMenu.tsx` ("Export → IFC 2x3…" item, testId `project-menu-export-ifc`) with blob download from `Workspace.tsx` `handleExportIfc` callback.

DXF export (E2): Implemented at `packages/web/src/export/dxfExporter.ts`. Exports per-level plan views with walls (A-WALL), doors (A-DOOR + arc swing), windows (A-GLAZ), rooms (A-AREA), grid lines (S-GRID with bubble circle), reference planes (A-REFP), linear dimensions (A-ANNO-DIMS with extension lines + label), and text notes (A-ANNO). Multi-level export supported (one DxfPlanView per level). 8 passing tests in `dxfExporter.test.ts`. Menu trigger wired in `ProjectMenu.tsx` ("Export → DXF/DWG…" item with collapsible options panel: level selector + mm/m units dropdown, testId `project-menu-export-dxf`) with per-level blob downloads from `handleExportDxf` in `Workspace.tsx`.

#### 12.4.4 Revit-Modell in Inventor verwenden (Revit → Inventor workflow)
**Status: N/A**
Desktop-to-desktop Autodesk workflow. Not applicable.

#### 12.4.5 PDF-Export (PDF from sheets)
**Status: Partial — P1**
Print to PDF from sheets is partially referenced but not yet a polished production-ready workflow.

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
**Status: Partial — P1**
Room tool is in registry. planRoomLabelLayout.ts exists. Room tags with name/number/area display are partially implemented. Fully configurable room tag families (like Revit's customisable tag) are Partial.

#### 13.1.3 Farbenlegenden (color fill legend: rooms colored by department, area, etc.)
**Status: Partial — P1**
roomSchemeColor.ts, roomColorSchemeLegendReadout.ts, roomFinishScheduleEvidenceReadout.ts exist. Color schemes are partially implemented. `ColorSchemeDialog.tsx` — the user-facing dialog (pick scheme category: name/department/area/occupancy, set colors per value) — is implemented and wired into `PlanViewHeader.tsx` via `onColorSchemeApply`. Tests in `colorScheme.test.ts` pass (D8).

#### 13.1.4 Nettoflächen (net areas: floor finish area, wall area, etc.)
**Status: Partial — P1**
Room area is calculated. Net floor area minus columns/walls (Revit's detailed area computation) is Partial. Room finish schedule (roomFinishScheduleEvidenceReadout.ts) exists — Partial.

### 13.2 Geschossflächen (floor area: gross building area by level)
**Status: Partial — P1**
Level-based area totals. scheduleLevelDatumEvidenceReadout.ts exists. Formal Geschossfläche (GF/NF breakdown per level) as a report is Partial.

### 13.3 Elementlisten (element schedules / quantity takeoffs)

#### 13.3.1 Neu möblieren und Möbelliste erstellen (furniture placement + furniture schedule)
**Status: Partial — P1**
Component tool (component in registry) allows placing furniture. SchedulePanel with schedule presets (scheduleDefinitionPresets.ts) exists. A furniture/room schedule is Partial — data flows from placed components but the schedule UI is not fully polished.

### 13.4 Routen-Analyse (path analysis / accessibility routing)
**Status: Not Started — P2**
Route analysis (checking emergency exit paths, accessibility, egress distances) is not implemented.

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
**Status: Not Started — P2**
Custom render backgrounds (sky texture, gradient, image) are not implemented.

### 14.5 Kameras (perspective camera placement and management)
**Status: Partial — P1**
Camera rig (cameraRig.ts) and orbit viewpoint persistence exist. Named perspective camera views placeable in the project browser (like Revit's camera views) are Partial — orbit viewpoints are saved but not fully surfaced as named project views.

### 14.6 Walkthroughs (animated camera path / flythrough)
**Status: Partial — P1**
Walk mode (walkMode.ts) allows interactive first-person navigation. Revit-style walkthrough path: `CameraPathElem` + `WalkthroughKeyframe` types added to core; `reduceWalkthrough` grammar (keyframe capture → commit) wired into Viewport.tsx — left-click captures camera pose as keyframe, Enter commits path; paths stored as client-side `cameraPaths[]` in Zustand; listed under "Walkthroughs" in WorkspaceLeftRail with 2-second-step playback on click. Missing: smooth RAF interpolation, path export.

### 14.7 Übungsfragen
**Status: N/A**

---

## Chapter 15 — Familieneditor (family editor for custom parametric components)

### 15.1 Beispiel: Eigenes Fenster (custom window family from scratch)

#### 15.1.1 Familieneditor starten (open family editor / family workbench)
**Status: Done — P1**
FamilyEditorWorkbench.tsx exists. The family editor can be opened for existing families. familyTemplateCatalog.ts provides templates. familyEditorPersistence.ts handles saving.

#### 15.1.2 Die Multifunktionsleiste »Erstellen« (create ribbon in family editor)
**Status: Partial — P1**
The family editor has a create workflow. Not all Revit family editor tools (extrusion, blend, revolve, sweep, swept blend, void forms) are fully available. ArrayTool.test.tsx exists.

#### 15.1.3 Fensterbearbeitung (window family geometry authoring)
**Status: Partial — P1**
Custom window families can be created (familySketchGeometry.ts). Parametric opening cut, frame profile, nested components are Partial.

#### 15.1.4 Fensterrahmen (window frame geometry in family)
**Status: Partial — P1**
Frame geometry as part of a family is partially supported. Parametric frame width, sill depth, head profile driven by reference planes are Partial.

#### 15.1.5 Fensterglas (window glazing panel in family)
**Status: Partial — P1**
Glass material assignment in family (glassMaterial.test.ts in viewport context). Glazing panel as a parametric nested component in the family editor is Partial.

### 15.2 Übungsfragen
**Status: N/A**

---

## Appendix A — Befehlskürzel (keyboard shortcuts)
**Status: Partial — P1**
cheatsheetData.ts and CheatsheetModal.tsx provide a keyboard shortcut reference panel. bim-ai has hotkeys for most tools. The shortcut set does not yet match Revit's full keyboard shortcut schema (e.g. WA=Wall, DR=Door, WN=Window, CM=Copy, MM=Mirror, MV=Move, RO=Rotate, TR=Trim, SL=Split Line, AL=Align, OF=Offset, AR=Array, SC=Scale, GP=Group, UN=Ungroup, VV=Visibility Graphics, VP=View Properties, RP=Reference Plane, LL=Level, GR=Grid, DI=Aligned Dimension, DL=Linear Dimension, EL=Spot Elevation, TX=Text, TG=Tag).

---

## Appendix B — Antworten zu den Übungsfragen
**Status: N/A**

---

## Summary Dashboard

Last verified: 2026-05-16. All wave-1 agents (WP-A through WP-G) have committed to main. 3739/3740 tests pass (1 pre-existing `ProjectSetupDialog` failure unrelated to wave-1 work).

### By Chapter — Implementation State

| Chapter | Topic | Overall State | Priority Gap |
|---------|-------|---------------|-------------|
| 1 | UI & Startup | Partial | Ribbon architecture, customisable QAT, multi-window |
| 2 | Basic Floor Plan | Partial | Global parameters |
| 3 | Modify Tools | Partial | EQ dims |
| 4 | Annotations | Partial | A1–A12 grammars done; deeper persistence/grips still Partial |
| 5 | Terrain & Geo | Partial | Contours, excavation, terrain merge/split |
| 6 | Views & Sheets | Partial | Interior elevation inspector/grip, sheet revision title block, locked 3D view |
| 7 | Drafting Aids | Done/Partial | Work plane orientation |
| 8 | Adv. Walls/Stairs | Partial | Curtain wall interactive grid, attach-top grammar |
| 9 | Structure | Partial | Steel connections, sloped columns, attach-top grammar |
| 10 | Roofs | Done/Partial | Roof by extrusion UX, special forms |
| 11 | Massing | Partial | Top-down end-to-end workflow (G5–G8 done; UI integration pending) |
| 12 | Import/Export | Partial | IFC file-menu export trigger, DWG/DGN export |
| 13 | Schedules | Partial | Route analysis, full quantity takeoffs |
| 14 | Rendering | Partial | Walkthroughs, sun animation (ray-tracing removed by design) |
| 15 | Family Editor | Partial | Full parametric family forms, void cuts |

### Top P0 Gaps (core authoring blocked)

None confirmed as blocking.

### Top P1 Gaps (professional parity limited)

- **Attach Top/Base grammar** (Ch. 8.1.1) — `'attach'`/`'detach'` ToolIds in toolRegistry; `meshBuilders.attachWallTop.test.ts` exists; **missing**: `reduceAttach` state machine in `toolGrammar.ts` + `attachWallTop` / `detachWallTop` command handlers in command queue
- **Curtain wall interactive grid editing** (Ch. 8.1.4) — data model (`curtainWallData`) + plan symbol (tick marks) done; **missing**: "Edit Grid" mode, inspector H/V grid controls, panel/mullion dropdowns
- **Interior elevation inspector + grip** (Ch. 6.1.5) — `interior-elevation` tool + `interior_elevation_marker` element type + 4-quadrant plan symbol all done (D2); **missing**: inspector panel (radius, level) and drag-grip for placed markers
- **Global parameters** (Ch. 3.8) — not started; new concept requiring a project-level parameter table; extend `project_settings` with a `globalParams` map + dialog + formula binding
- **DWG/DGN export** (Ch. 12.4.3) — DXF export done (E2); DWG/DGN format not started
- **Sheet revision title block rendering** (Ch. 6.3) — `ManageRevisionsDialog.tsx` + `revision`/`sheet_revision` element types done (D6); **missing**: revision table rendering in `SheetCanvas.tsx` / `sheetTitleblockAuthoring.tsx` title block area
- **Named locked 3D view sheet placement** (Ch. 6.1.3) — lock toggle done (right-click Lock/Unlock Camera, `isLocked` on `SavedViewElem`, blocks pan/orbit); **still missing**: placing a locked view as a viewport on a sheet
- **Walkthrough smooth RAF playback** (Ch. 14.6) — keyframe capture + commit + `CameraPathElem` storage + sequential step playback done; **still missing**: smooth RAF-interpolated animation loop + path export

### Top P2 Gaps (useful but workaroundable)

- EQ condition on aligned dimensions (Ch. 4.2.2) — not started; extend existing `permanent_dimension` element type with `eqEnabled: boolean` + render the "EQ" button at segment midpoints
- Wall parts / Create Parts (Ch. 8.1.3) — partial: data model + ribbon action done; per-part rendering not yet implemented
- Decal placement tool (Ch. 8.1.5) — `DecalElem` type + `buildDecalMesh()` exist; need `'decal'` ToolId in toolRegistry + click-to-place grammar + inspector (image picker, scale, rotation)
- Sloped/inclined columns (Ch. 9.1.4) — not started; extend column element with `topOffsetXMm`/`topOffsetYMm` fields + update mesh builder extrusion axis + plan symbol (dashed top footprint)
- Roof by extrusion user workflow (Ch. 10.2) — implemented (ToolId + grammar + PlanCanvas wiring + extrusionDepthMm field)
- Animated sun study (Ch. 14.2.2) — implemented (SunAnimationPanel with RAF loop + playback controls)
- User-customisable QAT (Ch. 1.6.3) — not started
- Multiple simultaneous view windows (Ch. 1.6.12) — not started
