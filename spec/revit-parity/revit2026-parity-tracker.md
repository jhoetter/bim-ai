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
**Status: Partial — P1**
bim-ai has a workspace/project browser concept. Plan views, 3D views, section views, sheet views are accessible via tabs/navigation. Missing:
- Full hierarchical tree mirroring Revit's browser organisation (views by discipline, sheets by number, families tree, groups)
- Drag-and-drop re-organisation of views in browser
- View duplicate / dependent view commands from browser context menu
- Revit Links subtree
- Browser organisation presets (by type, by level, by discipline)

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
**Status: Partial — P1**
bim-ai supports metric and imperial input in dimensions and property panels. A dedicated project-level units dialog (like Revit's FORMAT|EINHEITEN dialog with all unit categories) is not explicitly surfaced.

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
bim-ai supports element pinning via inspector. "Join Geometry" between floors and walls (which trims overlapping geometry) is partial — some auto-join happens but explicit user-controlled Join/Unjoin geometry is not a standalone tool.

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
**Status: Partial — P1**
Elements can be copied (copy tool) and moved between levels. Revit's "Copy to Clipboard" + "Paste Aligned to Selected Levels" batch workflow for duplicating a full floor to multiple levels is not implemented as a single command.

#### 2.6.2 Geschossabhängige Änderungen (level-dependent modifications: top constraint, base offset)
**Status: Partial — P1**
Walls have top constraint (connects to level above) and base offset in properties. Not all elements expose full level-relative constraint properties. Floor, ceiling, and roof level constraints are partially implemented.

### 2.7 Dächer (basic roof — by footprint)
**Status: Done — P0**
Roof by footprint (roof tool), roof by sketch (roof-sketch tool). Hip/valley slopes per edge, slope angle in properties. Covered in full in Ch. 10.

### 2.8 Projektphasen (project phases: Existing, Demolition, New Construction)
**Status: Partial — P1**
Phase filter is implemented (phaseFilter.ts, PhaseDropdown in plan view). Elements can be assigned a phaseId. Phase filter visibility (show New/Demo/Existing in different graphic states) works at a basic level. Missing:
- Phase creation/deletion/rename dialog
- Per-phase graphic overrides (demolished elements shown dashed, existing shown grey)
- Phase filter presets (As Built, Construction, Demolition Plan, etc.)
- Elements automatically acquiring correct phase based on creation context

### 2.9 Weitere Grundrisse und Ansichten (additional floor plans and views)

#### 2.9.1 Terrasse (terrace: modeling balcony/terrace with floor + railing)
**Status: Partial — P1**
Floors, railings exist. Modeling a terrace with cantilevered floor, stepped edges, and railing is possible but lacks "terrace-specific" templates or workflow shortcuts.

#### 2.9.2 Eingangstreppe (entrance stair: straight stair with landing)
**Status: Done — P0**
Single-run stair with landing works via the stair tool.

#### 2.9.3 Komplexe Treppe (complex stair: L-shape, U-shape, multi-landing)
**Status: Partial — P1**
Multi-run stair mesh builder exists. Complex L- and U-shape stairs with intermediate landings via component-by-component authoring is partially supported. Full sketch-defined boundary/run method for arbitrary shapes is in StairBySketchCanvas but not all configurations work.

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
Select tool exists. Selection filter by category (Auswahlfilter dialog) is Not Started. Link selection toggle is Not Started (no linked model workflow yet).

#### 3.3.2 Gruppe »Eigenschaften« (Properties panel access from Modify)
**Status: Done — P1**
Inspector panel always shows properties of selected element.

#### 3.3.3 Gruppe »Zwischenablage« (clipboard: cut, copy, paste, paste aligned)
**Status: Partial — P1**
Copy tool exists. Cut/Paste/Paste Aligned to Selected Levels as a clipboard workflow is Not Started. Revit's clipboard allows multi-element copy + paste aligned to levels.
- **B3 (copyToLevels):** copyToLevels.ts command shape + helpers implemented; copyToLevels / pasteAlignedToLevels functions added to copyPaste.ts; 6 unit tests passing. UI dialog pending.

#### 3.3.4 Gruppe »Geometrie« (geometry group: Join, Unjoin, Cut, Uncut geometry, Paint)
**Status: Partial — P1**
- Join Geometry: Partial — joinGeometry.ts command shapes + selection validation; toolbar UI pending
- Cut Geometry: Partial (shaft openings, wall voids via CSG)
- Unjoin: Partial — joinGeometry.ts command shapes + selection validation; toolbar UI pending
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
- Array (linear and radial): Partial — arrayTool.ts math helpers + tests; PlanCanvas wiring pending
- Scale: Not Started as explicit modify tool
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
createSimilar.ts helper + CS shortcut in cheatsheet; PlanCanvas keyboard handler pending. Create Group (grouping multiple selected elements) is Not Started as an explicit workflow.

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
- Pin: Partial — pinUnpin.ts command helpers (buildPinCommand, buildUnpinCommand, buildPinToggleCommands, filterPinnable) + PN shortcut in cheatsheet; toolbar wiring pending (WP-B8)
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
**Status: Not Started — P1**
Revit global parameters (e.g. "Raumhöhe = 2700mm" used throughout the model to constrain walls, windows, etc.) are not implemented. This is a significant parametric modelling capability. No evidence of globalParameter infrastructure in the codebase.

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
**Status: Not Started — P1**
EQ (equal spacing) button on aligned dimension chains — drives all witness-line spacings to equal value — is not implemented.

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
**Status: Not Started — P2**
Dimension text prefix/suffix/override is Not Started.

### 4.4 Winkelbemaßung (angular dimension)
**Status: Not Started — P1**
Angular dimension tool is not implemented.

### 4.5 Radius- und Durchmesserbemaßungen (radial and diameter dimensions)
**Status: Not Started — P1**
Radial and diameter dimension tools are not implemented.

### 4.6 Bogenlängenbemaßung (arc length dimension)
**Status: Not Started — P2**
Arc length dimension is not implemented.

### 4.7 Höhenkoten (spot elevation annotation)
**Status: Not Started — P1**
Spot elevation markers (showing the elevation of a point on a floor, slab, or terrain in plan/section view) are not implemented.

### 4.8 Punktkoordinate (spot coordinate annotation)
**Status: Not Started — P2**
Spot coordinate annotation (showing X/Y/Z coordinate of a point) is not implemented.

### 4.9 Neigungskote (slope annotation / grade arrow)
**Status: Not Started — P2**
Slope indicator annotation (arrow showing rise/run or % grade) is not implemented.

### 4.10 Text und Hinweistext (text and leader text annotations)
**Status: Not Started — P1**
Free text annotation tool is not in the tool registry. Leaders (Hinweistexte) with arrowhead and text block are not implemented. This is a significant gap for producing annotated drawings.

### 4.11 Bauteile beschriften (element tags / labels)

#### 4.11.1 Automatische Element-Beschriftungen (auto-tag by category)
**Status: Partial — P1**
autoTags.ts and manualTags.ts exist. Tag tool is in the registry. Auto-tagging by category (tag all walls, all rooms, etc.) is Partial.

#### 4.11.2 Element-Bauelement (element tag: door/window/room tag)
**Status: Partial — P1**
Room tags, window/door tags exist. Tag content (mark number, type, dimensions) is partially driven by family data.

#### 4.11.3 Material-Bauelement (material tag)
**Status: Not Started — P2**
Material tags (showing the material name of a layer in a section) are not implemented.

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
Sun/shadow uses compass bearing. A north arrow symbol placeable on a sheet is Not Started as an explicit annotation element.

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
**Status: Partial — P1**
Reflected ceiling plans (RCP) — a view looking upward showing ceiling structure — are not explicitly implemented as a separate view type. The ceiling tool exists but a dedicated RCP view mode is Not Started.

#### 6.1.3 3D-Ansichten (3D views: orthographic, perspective, section box, locked views)
**Status: Partial — P1**
- Standard 3D orthographic/perspective: Done
- ViewCube navigation: Done (Partial parity — see Ch. 3)
- Section box: Done (sectionBox.ts)
- Locked 3D view (saved camera position that can be placed on a sheet): Partial — orbit viewpoint persistence exists (OrbitViewpointPersistedHud.tsx) but named locked 3D views in the project browser are Partial

#### 6.1.4 Außenansichten (elevation views: North, South, East, West)
**Status: Partial — P1**
Elevation tool and elevation marker exist. Four cardinal elevation views are auto-created with a new project in Revit. In bim-ai, elevation views must be placed manually. Elevation view rendering from the model (showing actual geometry in 2D elevation projection) is in sectionViewportSvg.tsx/sectionViewportDoc.ts — Partial.

#### 6.1.5 Innenansichten (interior elevation views)
**Status: Partial — P2**
Interior elevation placement workflow (Revit: place 4-sided elevation marker inside a room, get 4 elevation views automatically) is Not Started. Elevation tool places single elevation views.

#### 6.1.6 Schnittansicht (section view: cross section, building section)
**Status: Partial — P1**
Section tool exists, section views are generated (sectionViewportSvg.tsx). A fully rendered and annotated building section view matching Revit quality (with automatic material hatch patterns, cut line weights, section head bubbles) is Partial.

### 6.2 Planerstellung (sheet setup: sheet with title block)
**Status: Partial — P1**
NewSheetDialog.tsx, SheetCanvas.tsx, SheetReviewSurface.tsx exist. Sheets can be created and views placed on them. Missing: user-customisable title blocks (Schriftkopf) with project information fields, dynamic title block families, viewport scale labels on sheets.

### 6.3 Plan mit Änderungsliste (sheet with revision table / delta list)
**Status: Not Started — P2**
Revision tracking per sheet (Revit's Revision cloud + Revision schedule in title block) is not implemented.

### 6.4 Detailansichten und Detaillierung (detail views and 2D detailing)

#### 6.4.1 Detailausschnitt (detail callout / enlarged plan area)
**Status: Partial — P2**
CalloutMarker.tsx and DetailRegionTool.tsx / DetailRegionRenderer.tsx exist. Placed detail callout regions appear in plan. The corresponding enlarged detail view viewport is Partial.

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
**Status: Partial — P1**
Wall-to-roof join is handled via CSG (csgWallBaseGeometry.ts) and wall mesh cutters. The explicit "Attach Top/Base" command (select wall, then pick roof to trim to) is Not Started as a user-facing command. The geometric result (wall trimmed to roof) is partially achieved automatically.

#### 8.1.2 Schichtaufbau (wall layer composition: thermal, structural, finish layers)
**Status: Done — P1**
Wall type catalog with layered materials (meshBuilders.layeredWall.ts, wallTypeCatalog.ts, csgWallMaterial.ts). Multi-layer wall types with independent material per layer are supported.

#### 8.1.3 Teileelemente erstellen (wall parts: segment a wall into independently controllable parts)
**Status: Not Started — P1**
Revit's "Create Parts" command (segmenting a wall into independently swappable horizontal or vertical parts — common for cladding documentation) is not implemented.

#### 8.1.4 Fassadenwände (curtain walls: grid, panels, mullions)
**Status: Partial — P1**
meshBuilders.curtainPanels.test.ts and curtain panel geometry exist. The visual rendering of curtain panels/mullions in 3D is partially implemented. A full curtain wall authoring workflow (place curtain wall, adjust grid spacing, assign panel types, add/remove mullions) is Not Started as a user-facing tool.

#### 8.1.5 Abziehbilder (decals / surface images on wall faces)
**Status: Not Started — P2**
Decal placement (placing a bitmap image on a model surface) is not implemented.

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
**Status: Not Started — P1**
Creating N levels at equal spacing with one command (Array of levels) is Not Started.

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
**Status: Partial — P1**
Creating a stair that spans multiple levels as a connected multi-storey assembly (Revit: define height = top level, get all runs automatically stacked) is Not Started. Stairs are currently placed per-floor.

### 8.7 Geländer (railings)
**Status: Done — P0**
Railing tool is in the tool registry. Railing along stair, railing on edge, railing materials — implemented.

### 8.8 Rampen (ramps)
**Status: Not Started — P1**
No ramp tool in the tool registry. Ramps (sloped floor surfaces with automatic railing) are not implemented.

### 8.9 Gruppen verwenden (model groups)

#### 8.9.1 Gruppen erstellen (group selected elements)
**Status: Not Started — P1**
Creating a named group from selected elements is not implemented. Revit groups act like local reusable blocks.

#### 8.9.2 Gruppen einfügen (place a group instance)
**Status: Not Started — P1**
Placing additional instances of a group is not implemented.

#### 8.9.3 Gruppen bearbeiten (edit group contents)
**Status: Not Started — P1**
Entering group edit mode to modify all instances simultaneously is not implemented.

### 8.10 Übungsfragen
**Status: N/A**

---

## Chapter 9 — Tragwerke (structural elements)

### 9.1 Stützen (columns)

#### 9.1.1 Stützenarten (architectural vs structural columns)
**Status: Partial — P1**
Column tool is in the registry. Architectural (non-load-bearing) columns and structural columns are both supported by Revit. In bim-ai, a generic column element exists. Separate architectural vs structural column types with different parameter sets are Not Explicitly Distinguished.

#### 9.1.2 Raster für Stützen (column at grid intersections)
**Status: Partial — P1**
Grid exists. Placing columns at grid intersections (Revit: "At Grids" batch placement) is Not Started — columns must be placed individually.

#### 9.1.3 Nichttragende Stützen (non-structural columns: pilasters, casing)
**Status: Partial — P2**
Non-structural decorative columns can be placed. No separate family type distinction.

#### 9.1.4 Geneigte Stützen (sloped columns)
**Status: Not Started — P2**
Tilted/inclined columns (non-vertical) are not supported.

### 9.2 Träger (beams)
**Status: Partial — P1**
Beam tool is in the registry. Beam placement between columns/walls works. No full section profile catalog (I-beam, H-beam, HSS, etc.) as richly populated as Revit's structural content.

### 9.3 Trägersysteme (beam systems: auto-fill framing between beams)
**Status: Not Started — P1**
Beam systems (automatically filling a bay with framing members at set spacing) are not implemented.

### 9.4 Streben (braces / diagonal structural members)
**Status: Not Started — P1**
No brace/strut tool in the registry.

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
**Status: Partial — P1**
Roof by extrusion (sweepMesh.ts, sweepGeometry.ts exist) is partially implemented. A user-facing "Roof by Extrusion" tool where the architect draws a 2D profile and picks a path is Not Started as a dedicated roof workflow.

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
**Status: Not Started — P1**
"Roof by Face" — selecting a mass face to generate a roof — is not implemented.

### 11.3 Fassaden und Wände erzeugen (generate walls/facades from mass face)
**Status: Not Started — P1**
"Wall by Face" from massing is not implemented.

### 11.4 Körpergeschosse und Geschossdecken erstellen (floor slabs from mass levels)
**Status: Not Started — P1**
"Floor by Face" / body levels (Körpergeschosse) from mass volumes are not implemented.

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
- Link another Revit (*.rvt) file: Not Started (no linked model workflow in bim-ai; linked model ghosting exists in code as linkedGhosting.ts but there is no UI to attach an external bim-ai project)
- Link IFC: Not Started
- Link CAD (DWG/DXF/DGN): DXF underlay exists (dxfUnderlay.ts — Partial)
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
DXF underlay (dxfUnderlay.ts) + ImageTraceDropZone.tsx — importing a CAD/image underlay to trace over is implemented.

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
**Status: Partial — P1**
Schedule views exist. CSV export of schedule data is Not Started (no export button on schedule views).

#### 12.4.2 Export mit deutschsprachigen Layern (DWG export with custom layer mapping)
**Status: Not Started — P2**
DWG export is not implemented.

#### 12.4.3 Exportieren nach CAD (DWG/DXF/DGN export) + IFC Export
**Status: Partial — P1**
No DWG, DXF, or DGN export. This is a significant gap for handing off to consultants who require CAD format.

IFC 2x3 export (E1): Implemented as a pure-TypeScript ISO 10303-21 STEP writer at `packages/web/src/export/ifcExporter.ts`. Exports `IFCPROJECT`, `IFCSITE`, `IFCBUILDING`, `IFCBUILDINGSTOREY` hierarchy plus `IFCWALLSTANDARDCASE`, `IFCDOOR`, `IFCWINDOW`, `IFCOPENINGELEMENT`, `IFCRELVOIDSELEMENT`, `IFCSLAB` (FLOOR/ROOF), and `IFCSPACE`. No WASM dependency. Tested via `ifcExporter.test.ts` (3 passing tests).

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
roomSchemeColor.ts, roomColorSchemeLegendReadout.ts, roomFinishScheduleEvidenceReadout.ts exist. Color schemes are partially implemented. A user-facing color fill dialog (pick scheme category, set colors per value) is Partial.

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
**Status: Not Started — P1**
Animated sun study (time-lapse shadow animation across a day or year) is not implemented.

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
**Status: Not Started — P1**
Walk mode (walkMode.ts) allows interactive first-person navigation. Revit-style walkthrough path (define a camera path with keyframes, export as animation) is Not Started.

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

### By Chapter — Implementation State

| Chapter | Topic | Overall State | Priority Gap |
|---------|-------|---------------|-------------|
| 1 | UI & Startup | Partial | Ribbon architecture, project browser tree, view controls |
| 2 | Basic Floor Plan | Partial | Global params, phases, level array, copy to levels |
| 3 | Modify Tools | Partial | EQ dims, text, tags, scale, group, paint |
| 4 | Annotations | Partial | Free text, spot elev, angular/radial dims, material tags |
| 5 | Terrain & Geo | Partial | Contours, excavation, north arrow |
| 6 | Views & Sheets | Partial | RCP, interior elevs, plot, detail views, revisions |
| 7 | Drafting Aids | Done/Partial | Work plane orientation |
| 8 | Adv. Walls/Stairs | Partial | Curtain wall authoring, rampes, groups, multi-storey stair |
| 9 | Structure | Partial | Beam systems, braces, steel, column at grid |
| 10 | Roofs | Done/Partial | Roof by extrusion UX, special forms |
| 11 | Massing | Not Started | Full top-down massing workflow |
| 12 | Import/Export | Partial | IFC, DWG export, linked models, CSV export |
| 13 | Schedules | Partial | Route analysis, full quantity takeoffs |
| 14 | Rendering | Partial | Photorealistic render, walkthroughs, sun animation |
| 15 | Family Editor | Partial | Full parametric family forms, void cuts |

### Top P0 Gaps (core authoring blocked)

- Ramp tool (Ch. 8.8)
- Model groups (Ch. 8.9)
- Multi-storey stair as single element (Ch. 8.6.5)
- Copy to multiple levels at once (Ch. 2.6.1)

### Top P1 Gaps (professional parity limited)

- Free text annotation tool (Ch. 4.10)
- Angular / radial dimensions (Ch. 4.4–4.5)
- Spot elevation annotation (Ch. 4.7)
- IFC export (Ch. 12.4.3) — IFC 2x3 STEP writer implemented (E1, `export/ifcExporter.ts`); UI trigger not yet wired
- DWG/DXF export (Ch. 12.4.3)
- Curtain wall authoring UI (Ch. 8.1.4)
- Global parameters (Ch. 3.8)
- Beam systems and braces (Ch. 9.3–9.4)
- Full massing → BIM workflow (Ch. 11)
- Walkthrough path animation (Ch. 14.6)
- Reflected ceiling plan view type (Ch. 6.1.2)
- Interior elevation placement (Ch. 6.1.5)
- Visibility/Graphics per-view dialog (Ch. 1.6.10)
- View Range dialog (Ch. 2.1.5)
- Phase creation/deletion/graphic overrides (Ch. 2.8)
- Room color fill scheme dialog (Ch. 13.1.3)
- Schedule CSV export (Ch. 12.4.1)
- Animated sun study (Ch. 14.2.2)

### Top P2 Gaps (useful but workaroundable)

- EQ condition on aligned dimensions (Ch. 4.2.2)
- Wall parts (Ch. 8.1.3)
- North arrow annotation (Ch. 5.4.1)
- Sheet revision management (Ch. 6.3)
- Array of levels (Ch. 8.5.2)
- Roof by extrusion user workflow (Ch. 10.2)
- Decals on surfaces (Ch. 8.1.5)
- User-customisable QAT (Ch. 1.6.3)
- Multiple simultaneous view windows (Ch. 1.6.12)
