# Chapter 6 — Window Families & Nested Families

Source segment: `02:45:00 – 02:54:00`

---

## F-063 · Nested Families

**What it does:** A family can contain other families as nested components. For example, a window family nests a "Glass Panel" sub-family and a "Frame" sub-family. Nested families allow modular reuse and independent versioning. Loading an updated nested family into a host family requires explicitly choosing "Overwrite existing version and its parameter values" to propagate changed parameter values.

**Screenshot:**
![Nested Family](file:///Users/jhoetter/Desktop/Revit%20Specs/0444_02-45-41.png)

**bim-ai status:** 🟡 Partial — the family editor supports nested family instances, parameter/formula bindings, drag/drop from loaded families, and resolver recursion with cycle detection. Missing: project persistence/reload UX and full overwrite semantics.

---

## F-064 · Overwrite options when reloading families

**What it does:** When loading a family into a project (or a nested family into a host family) where a version already exists, Revit shows a dialog with two choices:

1. **Overwrite the existing version** — updates geometry only; parameter values in the project stay as they were.
2. **Overwrite the existing version and its parameter values** — also resets all parameter values to the family's defaults.

Choice 2 is required when parametric values (e.g., glass thickness) were changed inside the family.

**Screenshot:**
![Overwrite options](file:///Users/jhoetter/Desktop/Revit%20Specs/0445_02-45-46.png)

**bim-ai status:** 🟡 Partial — sweep and nested-instance visibility can bind to boolean family parameters, covering the primary Visible-when use case. Missing: general associate-parameter buttons for every property.

---

## F-065 · Family Category and Parameters dialog

**What it does:** In the Family Editor, Manage → Family Category and Parameters lets you:

- Change the family's category (e.g., from "Generic Models" to "Windows").
- Set family parameters like "Always Vertical", "Room Calculation Point", "Work Plane-Based".

The category determines which visibility category controls the family in VG overrides and what tags can be applied to it in the project.

**Screenshot:**
![Family Category dialog](file:///Users/jhoetter/Desktop/Revit%20Specs/0451_02-47-03.png)

**bim-ai status:** 🟡 Partial — the family editor now exposes a Family Category and Parameters panel with category selection plus Always Vertical, Work Plane-Based, Room Calculation Point, and Shared flags. Missing: backend persistence, Revit category metadata completeness, project tag eligibility, and Visibility/Graphics category propagation for loaded families.

---

## F-066 · View Range in Family Editor

**What it does:** Each plan view in the Family Editor has a "View Range" (Properties palette → View Range → Edit). The "Cut Plane" offset determines the horizontal slice height. If the Cut Plane does not pass through a family's extrusions, those extrusions are invisible in plan. This must be tuned both in nested families and their host families.

**Screenshot:**
![View Range in Family Editor](file:///Users/jhoetter/Desktop/Revit%20Specs/0456_02-47-57.png)

**bim-ai status:** 🟡 Partial — the family editor now exposes plan-preview View Range offsets for Top, Cut Plane, Bottom, and View Depth, with a live cut/depth summary. Missing: actual plan cut filtering of family geometry, nested-host view-range propagation, and Revit's full View Range modal semantics.

---

## F-067 · Detail Component (2D annotation component)

**What it does:** Annotate → Detail Component places a 2D-only annotation family (`.rfa`) in a view at the correct scale. Detail components are used for opening symbols (door swing arcs, window casement lines), hatch patterns, breaklines, and other 2D details that are view-specific and not part of the 3D model. They are placed from the loaded family library.

**Screenshot:**
![Detail Component placement](file:///Users/jhoetter/Desktop/Revit%20Specs/0464_02-49-17.png)

**bim-ai status:** 🟡 Partial — the family editor now has a 2D symbolic/detail line authoring panel for view-only annotation geometry, and the Family Category panel includes a Detail Components category. Authored lines are carried in the load payload. Missing: loaded `.rfa` detail component placement, scale-aware project-view insertion, and library browsing for detail component families.

---

## F-068 · Align Tool (AL) in Family Editor

**What it does:** Modify → Align (shortcut `AL`). Click a reference line/plane, then click the element edge to align. When the lock icon appears, clicking it constrains the element permanently to that reference — the element will follow the reference plane when it moves. Used here to lock a 2D opening component to the window frame's outer reference planes.

**Screenshot:**
![Align Tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0465_02-49-25.png)

**bim-ai status:** ❌ Not available — bim-ai has no interactive align + lock operation in a family editor context.

---

## F-069 · Associate Family Parameter (Visible / geometry)

**What it does:** In the Properties palette of a family element, many fields show an "Associate Family Parameter" button (a small icon with two dots). Clicking it lets you tie that field (e.g., Visible, Width, Material) to an existing family parameter — or create a new parameter. This is how 2D elements can be made conditionally visible via a Yes/No parameter (e.g., "Show_2D_Elements").

**Screenshot:**
![Associate Family Parameter](file:///Users/jhoetter/Desktop/Revit%20Specs/0469_02-50-40.png)

**bim-ai status:** 🟡 Partial — the family editor can author 2D symbolic line segments by coordinates and keeps them separate from 3D sweep/model geometry. Missing: canvas drawing tools, line styles, detail-level/view-type visibility settings, and project rendering of symbolic linework.

---

## F-070 · Mirror – Draw Axis (DM)

**What it does:** Modify → Mirror – Draw Axis (shortcut `DM`) mirrors selected elements about a user-drawn axis line. When "Copy" is checked in the Options Bar, the original is preserved and a mirrored copy is created. Used here to mirror a 2D casement opening symbol to create the right-side counterpart from the left-side one.

**Screenshot:**
![Mirror - Draw Axis](file:///Users/jhoetter/Desktop/Revit%20Specs/0467_02-50-08.png)

**bim-ai status:** 🟡 Partial — The mirror tool (hotkey `MM`) is available in the plan canvas for regular project elements: first click sets the axis start point, second click completes the axis and fires `mirrorElements { elementIds: [selectedId], axis, alsoCopy: true }`. The backend (`engine.py`) handles wall and floor boundary reflection. Missing: mirror within the family editor context (the spec's primary use case); "Copy" checkbox in OptionsBar (defaults to alsoCopy=true); multi-element selection for bulk mirror; preview of the mirrored result before confirming.

---

## F-071 · Symbolic Lines (annotation geometry in families)

**What it does:** Annotate → Symbolic Line draws 2D lines that are visible only in plan, elevation, or section views (as configured via Visibility Settings). Unlike model lines, they have no 3D representation. They are assigned to subcategories (e.g., "Opening (Projection)", "Hidden Lines (Cut)", "Furniture (Projection)") which controls their line weight and style in projects.

**Screenshot:**
![Symbolic Lines](file:///Users/jhoetter/Desktop/Revit%20Specs/0472_02-51-29.png)

**bim-ai status:** 🟡 Partial — the family editor can author 2D symbolic line segments by coordinates and keeps them separate from 3D sweep/model geometry. Missing: canvas drawing tools, line styles, detail-level/view-type visibility settings, and project rendering of symbolic linework.

---

## F-072 · Opening (Projection) subcategory & Hidden Lines (Cut) subcategory

**What it does:** "Opening (Projection)" renders as solid lines in plan/elevation — used for door swing arcs and casement lines visible above the cut plane. "Hidden Lines (Cut)" renders as dashed lines — used for elements visible only as a cut (e.g., window sill or lintel above the cut plane shown as dashed). Assigning the correct subcategory ensures consistent line weights and styles across the project via Object Styles.

**Screenshot:**
![Opening Projection lines](file:///Users/jhoetter/Desktop/Revit%20Specs/0475_02-52-05.png)

**bim-ai status:** 🟡 Partial — symbolic line authoring records subcategory metadata for Symbolic Lines, Opening Projection, and Hidden Lines (Cut). Missing: Object Styles/lineweight propagation, dashed hidden-line rendering, and project Visibility/Graphics controls for these subcategories.

---

## F-073 · Preview Visibility toggle (Family Editor)

**What it does:** A toggle button at the bottom of the Family Editor canvas switches "Preview Visibility" on/off. When on, elements whose Visibility Settings exclude the current detail level or view type are hidden (same as they would be in the project). Allows the author to verify that 2D and 3D representations switch correctly at Coarse/Medium/Fine without leaving the editor.

**Screenshot:**
![Preview Visibility](file:///Users/jhoetter/Desktop/Revit%20Specs/0476_02-52-15.png)

**bim-ai status:** 🟡 Partial — the family editor now has a Preview Visibility toggle and coarse/medium/fine detail-level selector. When enabled, the family editor filters sweeps and nested instances using their visibility bindings and detail-level visibility settings, with a live visible-count summary. Missing: full canvas rendering parity, plan/RCP/elevation/view-type filtering, and project-context preview modes.

---

## F-074 · Instance parameters for per-placement overrides (Sill Offset example)

**What it does:** Instance parameters can differ between individual placements of the same family type. The video demonstrates three windows of the same type, each with a different "Sill Offset" (0 mm, 300 mm, 600 mm). This is how an architect can have a family type that allows flexible sill heights on a per-window basis without duplicating the type.

**Screenshot:**
![Instance parameter Sill Offset](file:///Users/jhoetter/Desktop/Revit%20Specs/0481_02-53-44.png)

**bim-ai status:** ❌ Not available.
