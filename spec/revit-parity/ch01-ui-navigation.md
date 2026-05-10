# Chapter 1 — UI & Navigation

Source segment: `00:00:00 – 00:32:00`

> **Intentional paradigm difference — not tracked as parity gaps:**
> Revit's "Home Screen" (F-001) and "New Project Dialog" (F-002) are **intentionally excluded** from this tracker. bim-ai's file management will follow a **Google Drive-like model**: a dedicated file browser where users create/open `.bim` models the same way they create a new Google Doc — template selection happens in that browser context, not inside the editor. Likewise, Revit's File → Save is replaced by **continuous versioning with named milestones** (T3 COL-V3-01/02 time machine), consistent with the "activity stream is the time machine" stance in `spec/workpackage-tracker-v3.md`.

---

## F-003 · Project Browser

**What it does:** Tree-panel listing all views (floor plans, elevations, sections, 3D views), legends, schedules, sheets, families, groups, and Revit links. Double-clicking opens a view as a new tab. Views can be renamed, deleted, and duplicated directly from the browser. Supports sorting by discipline, subdiscipline, and phase (new in Revit 2025/2026).

**Screenshot:**
![Project Browser](file:///Users/jhoetter/Desktop/Revit%20Specs/0124_00-12-38.png)

**bim-ai status:** 🟡 Partial — `ProjectBrowser.tsx` lists plan views, 3D orbit viewpoints, plan viewpoints, section cuts, elevation views, schedules, sheets, view templates, sites, link_model rows, and a collapsible Families section (wall_type, floor_type, roof_type grouped by category). Floor plans group by discipline and subdiscipline when those fields are set. Per-view inline rename (double-click) and delete (confirm-guarded button) are implemented for plan views, section cuts, and elevation views. Family type rows have a right-click context menu for Select Type, Rename, and Duplicate, wired to the existing selection and `updateElementProperty`/`upsert*Type` commands. Missing: legends/groups subtree and phase grouping.

---

## F-004 · Properties Palette (context-sensitive)

**What it does:** Left-side panel showing parameters of the currently selected element. Updates dynamically: when nothing is selected it shows the active view's properties; when an element is selected it shows that element's instance parameters. "Edit Type" button opens type properties. "Apply" button commits changes.

**Screenshot:**
![Properties Palette](file:///Users/jhoetter/Desktop/Revit%20Specs/0133_00-14-50.png)

**bim-ai status:** 🟡 Partial — Right-rail inspector shows element properties with editable instance fields (name, offsets, type, phase, dimension inputs). When no element is selected, the active plan view's full `InspectorPlanViewEditor` is shown in the right rail (name, presentation, room labels, opening tags, underlay level, view range, crop bounds, view template). "Edit Type" buttons in wall/floor/roof inspectors open the MaterialLayerStackWorkbench type editor by selecting the type element. Missing: full Revit type/instance palette separation and automatic tab context switch when an element type is selected.

---

## F-005 · Ribbon Interface (tabbed toolbar)

**What it does:** Horizontal toolbar organized into contextual tabs. Each tab (Architecture, Structure, Steel, Precast, Systems, Insert, Annotate, Analyze, Massing & Site, Collaborate, View, Manage, Add-Ins, Modify) shows a different set of tools organized into named panels. Selecting an element adds a contextual "Modify | \<ElementType\>" tab automatically.

**Screenshot:**
![Ribbon - Architecture Tab](file:///Users/jhoetter/Desktop/Revit%20Specs/0141_00-16-44.png)

**bim-ai status:** 🟡 Partial — The workspace shell now includes a compact `RibbonBar` below the top bar (`data-testid="ribbon-bar"`). It exposes tabbed Architecture, Structure, Annotate, View, and Manage groups with existing commands wired to the current plan tools, workspace mode switches, command palette, VV/VG dialog, project menu, and family library. When an element is selected it adds a contextual `Modify | <ElementKind>` tab with Select, Move, Copy, Rotate, Mirror, Align, and Trim/Extend commands. Missing: full Revit tab catalogue, deep contextual panel rules, Add-Ins/Systems/Steel/Precast tabs, panel flyouts, and ribbon customization/minimize behavior.

---

## F-006 · Quick Access Toolbar (QAT)

**What it does:** Customizable mini-toolbar above the ribbon with one-click access to common tools: 3D View, Section, Thin Lines, Close Inactive Views, Undo, Redo, Measure, Aligned Dimension, Tag by Category. Users can add/remove tools via a dropdown.

**Screenshot:**
![Quick Access Toolbar](file:///Users/jhoetter/Desktop/Revit%20Specs/0138_00-16-09.png)

**bim-ai status:** ✅ Available — The TopBar includes Undo (`data-testid="topbar-undo"`), Redo (`data-testid="topbar-redo"`), Section (`data-testid="topbar-section-shortcut"`), Measure (`data-testid="topbar-measure-shortcut"`), Aligned Dimension (`data-testid="topbar-dimension-shortcut"`), Tag by Category (`data-testid="topbar-tag-by-category-shortcut"`, activates the `tag` plan tool and places view-local tags on room/door/window clicks), Close Inactive Views (`data-testid="topbar-close-inactive"`), and Thin Lines (`data-testid="topbar-thin-lines"`, wired to `thinLinesEnabled` store state + `toggleThinLines`; overrides all `lineWeights` to 1 px in PlanCanvas when active). The 3D View button (F-112) also serves as a QAT equivalent. `topbar-qat-customize` opens a localStorage-backed pin/unpin menu for the configurable QAT entries.

---

## F-007 · Multi-tab view workspace

**What it does:** Each opened view (floor plan, elevation, 3D view, sheet) appears as its own tab in the main canvas. Tabs can be closed individually. "Close Inactive Views" in the QAT closes all tabs except the current one to free memory.

**Screenshot:**
![Multi-tab workspace](file:///Users/jhoetter/Desktop/Revit%20Specs/0131_00-14-26.png)

**bim-ai status:** ✅ Available — `workspace/tabsModel.ts` (spec §11.3) implements a full multi-tab system with tab kinds: `plan`, `3d`, `plan-3d`, `section`, `sheet`, `schedule`, and `agent`. `TabBar.tsx` renders the tab strip; tabs are opened from `ProjectBrowser.tsx` (double-click a view), closed individually, and their viewport state (camera pose / orbit) is cached and restored on reactivation. Tab order is drag-reorderable and state persists via `tabsPersistence.ts`. A "Close Inactive Views" button (`data-testid="close-inactive-tabs"`) appears in the trailing area of the tab bar (visible when ≥ 2 tabs are open) and calls the `closeInactiveTabs` reducer to keep only the active tab. Note: tile/cascade window arrangement is not applicable in a SaaS single-canvas model.

---

## F-008 · Dark Mode

**What it does:** File → Options → Colors → "UI active theme": switch between Light and Dark. Takes effect immediately after clicking OK.

**Screenshot:**
![Dark Mode](file:///Users/jhoetter/Desktop/Revit%20Specs/0168_00-23-46.png)

**bim-ai status:** ✅ Available — `theme.ts` implements a full light/dark toggle with priority cascade: URL hash → localStorage → `prefers-color-scheme`. `TopBar.tsx` exposes the toggle button; theme persists across sessions.

---

## F-009 · Language settings (via shortcut target)

**What it does:** Right-clicking the Revit desktop icon → Properties → Target field contains a language code (`ENU`, `DEU`, etc.) that can be changed to switch the entire UI language. Autodesk lists all codes on a support page.

**Screenshot:**
![Language Settings](file:///Users/jhoetter/Desktop/Revit%20Specs/0175_00-24-47.png)

**bim-ai status:** ✅ Available — bim-ai has full i18n support with English and German translations (`packages/web/src/i18n.ts`). Language persists via `localStorage` (`bim-ai:lang`) and is togglable via: (a) the `EN`/`DE` toggle button in `TopBar.tsx` (`data-testid="topbar-language-toggle"`) — visible at all times in the top bar — and (b) the command palette (`settings.language.toggle`). Missing: additional language options beyond en/de.

---

## F-010 · View Scale selector

**What it does:** Bottom bar of any view shows a dropdown for the view's drawing scale (1:1, 1:10, 1:20, 1:50, 1:100, 1:200, custom). Changing scale affects annotation sizes, tag sizes, and dimension text. Can also be changed from the Properties palette ("Scale" parameter).

**Screenshot:**
![View Scale](file:///Users/jhoetter/Desktop/Revit%20Specs/0161_00-21-28.png)

**bim-ai status:** ✅ Available — `PlanCanvas.tsx` shows a live "1:N" indicator in the bottom-left scale bar button, computing `plotScaleN = Math.round(halfUi * 2)` from the camera half-width. Clicking the button opens a preset menu with architectural scales (1:25 detail → 1:1000 master plan), each snapping the camera to the correct half-width. Missing: annotation-driven plot scale locking that persists on the plan_view element itself.

---

## F-011 · Visual Style selector

**What it does:** Bottom-left canvas dropdown to switch between Wireframe, Hidden Line, Shaded, Consistent Colors, Realistic, and Ray Trace rendering modes within any view.

**Screenshot:**
![Visual Style](file:///Users/jhoetter/Desktop/Revit%20Specs/0332_01-07-40.png)

**bim-ai status:** 🟡 Partial — for plan views: `PlanDetailLevelToolbar` (coarse/medium/fine) is shown in the canvas footer, and a plan style selector (default/opening_focus/room_scheme) is available in the TopBar. For 3D views: bim-ai now supports **Shaded, Consistent Colors, Wireframe, and Hidden Line** visual styles via the GDO panel (`data-testid="gdo-panel"`) Visual Style dropdown and a cycle button (`data-testid="viewport-wireframe-toggle"`). Shaded uses `MeshStandardMaterial` (PBR). Consistent Colors replaces materials with `MeshBasicMaterial` (flat, no specular). Hidden Line renders white opaque surfaces (back-faces occluded) via `MeshBasicMaterial`. The `viewerRenderStyle` Zustand state now accepts `'shaded' | 'wireframe' | 'consistent-colors' | 'hidden-line'`. Missing: realistic, ray-trace, photographic exposure, ambient occlusion, and silhouettes.

---

## F-012 · Visibility / Graphic Overrides (VG/VV)

**What it does:** Per-view dialog (shortcut `VV` or `VG`) that controls which categories are visible and how they are displayed (line weight, color, halftone, transparency, projection/cut patterns). Can override appearance at model-category, annotation-category, and imported-category levels. Has a search bar (Revit 2025+).

**Screenshot:**
![VG Overrides](file:///Users/jhoetter/Desktop/Revit%20Specs/0163_00-22-39.png)

**bim-ai status:** 🟡 Partial — `VVDialog.tsx` has model/annotation/filters/links tabs with per-category visibility, separate projection/cut color, line weight, and pattern overrides, plus a halftone toggle (sets both projection and cut halftone together, matching Revit's per-row behaviour). Covers 15 model categories (Walls, Floors, Roofs, Ceilings, Columns, Structural Framing, Stairs, Railings, Doors, Windows, Rooms, Furniture/Generic Models, Property Lines, Site, Site/Origin) and 14 annotation categories (Grids, Levels, Dimensions, Room Tags, Door Tags, Window Tags, Section Marks, Elevation Marks, Room Separation Lines, Area Boundary Lines, Reference Planes, Masking Regions, Detail Lines, Text Notes). VV dialog visibility toggles wire through to `hiddenSemanticKinds` via `categoryOverrides` so unchecking a category hides those elements in the view. Missing: full Revit catalogue of ~120 categories and transparency controls.

---

## F-013 · Account & license management (top-right)

**What it does:** The top-right corner shows the signed-in Autodesk account. Clicking it reveals: Account Details, Manage License, Privacy Settings, Sign Out. The Help (?) button provides access to documentation.

**Screenshot:**
![Account Management](file:///Users/jhoetter/Desktop/Revit%20Specs/0117_00-11-30.png)

**bim-ai status:** 🟡 Partial — `TopBar.tsx` now uses a top-right account menu (`data-testid="topbar-avatar-menu-trigger"`) with a local bim-ai account/about/status surface. The panel shows the current display name or local user state, user id/session, local plan/license readout ("No Autodesk license required"), model id, revision, network and realtime status, pending offline edits, and environment. It links to existing Help / shortcuts and Command Palette actions rather than inventing backend auth. Missing: real hosted account management, privacy settings, billing/license administration, and sign-out.

---

## F-014 · Reveal Hidden Elements mode

**What it does:** Toggling this mode (lightbulb icon at the bottom of a view) shows all elements hidden in the current view in magenta, surrounded by a magenta border. Right-click → "Unhide in View" → "Category" or "Element" to make them visible again. Deactivate to return to normal view.

**Screenshot:**
![Reveal Hidden Elements](file:///Users/jhoetter/Desktop/Revit%20Specs/0219_00-55-06.png)

**bim-ai status:** ✅ Done — the Reveal Hidden Elements mode (💡 lightbulb button, `data-testid="plan-reveal-hidden"`) shows all VG-hidden elements in magenta (#ff00ff at 55% opacity). A magenta status chip is shown while active. Right-clicking a hidden element in reveal mode shows an "Unhide in View: <category>" button (`data-testid="unhide-context-menu"`) that calls `setCategoryOverride(viewId, kind, { visible: true })` to restore visibility. Missing: per-element unhide (vs. category-level); Revit's cascaded submenu (Unhide in View → Element / Category).
