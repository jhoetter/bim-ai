# Chapter 3 — Levels & Plan View Management

Source segment: `00:55:00 – 01:02:00`

---

## F-025 · Levels

**What it does:** Horizontal datum planes that define storey heights. Each level has a name, an elevation, and a head/tail symbol visible in elevation/section views. Levels are the parent objects for floor plans — when a level is created with "Make Plan View" checked, a corresponding floor plan is automatically generated. Level colors in elevation views change from black to blue once a floor plan view exists for that level.

**Screenshot:**
![Levels in elevation](file:///Users/jhoetter/Desktop/Revit%20Specs/0246_00-57-24.png)

**bim-ai status:** ✅ Available — `LevelStack.tsx` shows a "+" button in the header that fires `createLevel { id, name, elevationMm: maxElev + 3000, alsoCreatePlanView: true }`, automatically creating both the level and a companion plan view. Elevation is editable inline for all levels. Level name can be renamed via double-click. `SectionViewportSvg` renders blue dashed datum lines at each level elevation with a circle head symbol on the right edge and a `"Name | ±X.XXX m"` label above each line (Revit-style level heads in section/elevation views). `PlanCanvas.tsx` now shows both the active level datum line (`data-testid="plan-level-datum-line"`) and the level elevation badge (`data-testid="plan-level-elevation-badge"`) in the top-left corner of the plan canvas, displaying the current level name and elevation as `"Name | ±X.XXX m"`.

---

## F-026 · Rename Levels

**What it does:** Levels can be renamed by right-clicking the level in the Project Browser and choosing "Rename", or by single-clicking on an already-selected level name. When a level is renamed, Revit prompts whether to also rename the associated plan view.

**Screenshot:**
![Rename Level](file:///Users/jhoetter/Desktop/Revit%20Specs/0250_00-57-48.png)

**bim-ai status:** ✅ Available — `LevelStack.tsx` supports inline rename via double-click: an input field appears, blur/Enter commits via `updateElementProperty { key: 'name' }`, and Escape cancels. `WorkspaceLeftRail.tsx` wires the `onNameCommitted` callback.

---

## F-027 · Create Floor Plan Views (View tab → Plan Views → Floor Plan)

**What it does:** View → Create → Plan Views → Floor Plan opens a dialog listing all levels. Levels that already have a floor plan appear in blue; others are black. Multiple levels can be selected (Ctrl+click). A "Do not duplicate existing views" checkbox prevents creating duplicate views. Newly created views appear in the Project Browser under "Floor Plans".

**Screenshot:**
![Create Floor Plan dialog](file:///Users/jhoetter/Desktop/Revit%20Specs/0263_00-58-27.png)

**bim-ai status:** ✅ Available — `LevelStack.tsx` renders a "+" button per level that fires `upsertPlanView { name, levelId, discipline }` via `onCreatePlanView`. `WorkspaceLeftRail.tsx` wires the callback; newly created views appear in the Project Browser under "Floor Plans".

---

## F-028 · Floor Plan View Types

**What it does:** When creating a floor plan, a "Type" dropdown offers predefined plan types: Architectural Plan, Lighting Plan, Power Plan, Coordination Plan, etc. Each type can have a default view template attached (via Edit Type → "View template applied to new views"). Custom types can be duplicated and renamed.

**Screenshot:**
![Floor Plan View Types](file:///Users/jhoetter/Desktop/Revit%20Specs/0275_00-59-52.png)

**bim-ai status:** ✅ Available — `plan_view` elements carry `planViewSubtype` (`floor_plan | lighting_plan | power_plan | coordination_plan`), exposed as a "View Type" dropdown in `InspectorPlanViewEditor` (`data-testid="inspector-plan-view-subtype"`). Project Browser groups plan rows by view type, and creating/duplicating browser-authored plan rows applies the matching default view template association for that subtype.

---

## F-029 · View Templates

**What it does:** View Templates are saved sets of view properties (visibility/graphics overrides, scale, detail level, visual style, etc.) that can be applied to one or more views at once. They ensure consistent look and feel across all floor plans of the same type. Accessible via View tab → View Templates, or from the Properties palette "View Template" field.

**Screenshot:**
![View Template dropdown](file:///Users/jhoetter/Desktop/Revit%20Specs/0279_01-00-19.png)

**bim-ai status:** ✅ Implemented — View Templates are stored as `view_template` elements and listed in `ProjectBrowser.tsx`. Users can create templates (+ New button → `CreateViewTemplate`), duplicate, delete, edit properties via the right-rail inspector (`InspectorViewTemplateEditor`), save the current plan view as a template, and apply a template to any plan view via the "Apply ▾" dropdown. Template-controlled fields include a persisted Revit-style include/lock matrix; applying or updating a template propagates only included fields, and excluded fields remain editable on bound plan views.

---

## F-030 · Rename Views

**What it does:** Views in the Project Browser can be renamed by right-click → Rename, or by single-clicking the name after the view is already selected (slow double-click). Renaming a view does not rename the associated level or sheet.

**Screenshot:**
![Rename View](file:///Users/jhoetter/Desktop/Revit%20Specs/0249_00-57-46.png)

**bim-ai status:** ✅ Available — `ProjectBrowser.tsx` implements inline rename for plan views: double-click enters an input field, blur/Enter commits via `updateElementProperty { key: 'name' }`. Renaming a view does not rename the associated level.

---

## F-031 · Delete Views

**What it does:** Multiple views can be selected in the Project Browser via Shift+click and then deleted with right-click → Delete. Deleting the only view that contains a linked CAD file also removes that link from the model (a common gotcha). Revit shows a confirmation dialog.

**Screenshot:**
![Delete Views](file:///Users/jhoetter/Desktop/Revit%20Specs/0259_00-58-17.png)

**bim-ai status:** ✅ Available — `ProjectBrowser.tsx` has "Delete…" buttons for plan views, section cuts (`data-testid="section-cut-delete-{id}"`), and elevation views (`data-testid="elevation-view-delete-{id}"`). All fire `deleteElement { elementId }` guarded by `confirm()` and use `e.stopPropagation()` to avoid accidental selection.

---

## F-032 · Project Browser view organization (by Discipline / Subdiscipline / Phase)

**What it does:** Views in the Project Browser can be organized using a browser organization scheme. The default groups by "Discipline" (Architectural, Structural, Coordination, etc.) and then by sub-discipline. Revit 2025/2026 introduced additional grouping options. Each view's discipline property can be changed in the Properties palette.

**Screenshot:**
![Browser Organization](file:///Users/jhoetter/Desktop/Revit%20Specs/0069_00-05-07.png)

**bim-ai status:** ✅ Available — Project Browser organizes plan views by discipline, subdiscipline, view type, and phase when those metadata fields are present. Default architectural-only projects keep the compact floor-plan grouping, while mixed-discipline projects expand into Architecture, Structural, MEP, subtype, and phase buckets so the browser follows Revit-style organization rules without losing the simpler default view.

---

## F-033 · Elevation markers & four-way elevation views

**What it does:** A new Revit project auto-generates four elevation markers (North, East, South, West). Each marker is a host with four individual elevation views. Double-clicking an elevation tag in a plan view opens the corresponding elevation view as a tab. Level lines appear in all elevation views.

**Screenshot:**
![Elevation Markers](file:///Users/jhoetter/Desktop/Revit%20Specs/0122_00-12-17.png)

**bim-ai status:** ✅ Implemented — new model creation calls `ensure_cardinal_elevation_views`, seeding North/South/East/West `elevation_view` elements without user action. Generated views share `markerGroupId="elevation-marker-cardinal"` and per-direction `markerSlot` values, and manual N/S/E/W creation in `ProjectBrowser.tsx` uses the same grouped marker metadata. Snapshot hydration now preserves `elevation_view` elements and marker-group fields in web state. Elevation markers are rendered as triangular symbols in the plan canvas (`symbology.ts` / `elevationViewPlanThree`); double-clicking an elevation marker fires `activateElevationView(id)` and opens the corresponding elevation tab (`PlanCanvas.tsx` `onDblClick` handler).
