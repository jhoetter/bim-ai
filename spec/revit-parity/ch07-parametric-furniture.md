# Chapter 7 — Parametric Furniture Families (2D + 3D)

Source segment: `03:40:00 – 03:56:34`

This chapter walks through creating a fully parametric chair family from scratch — first as 2D symbolic geometry (for Coarse views / large-scale plans) then adding 3D extrusions (for Medium and Fine views / 3D perspectives).

---

## F-075 · Creating families from furniture templates

**What it does:** New → Family → Metric Furniture.rft creates a standalone (non-hosted) furniture family category. The template pre-draws two perpendicular reference planes at the origin and sets the family category to "Furniture". No host object is needed — furniture families are placed directly on a level in plan or 3D views.

**Screenshot:**
![Furniture template](file:///Users/jhoetter/Desktop/Revit%20Specs/0487_03-40-03.png)

**bim-ai status:** 🟡 Partial — the family editor now exposes a Furniture template preset. Selecting it seeds origin reference planes, a Furniture category, chair parameters (Width, Depth, Seat Height, Seat Thickness, Backrest Depth, Leg Radius, Leg Offset, Show 2D Elements), two starter types, coarse-only symbolic plan lines, and a medium/fine sweep placeholder. Missing: Revit `.rft` file browsing, full project-load family catalog persistence, and host-free placement directly from this authored template.

---

## F-076 · EQ (Equal) constraint on dimensions

**What it does:** Placing a dimension string across multiple reference planes and then double-clicking the "EQ" toggle above the dimension locks all gaps to be equal. This ensures the chair's reference planes stay symmetrically spaced around the origin. Moving the outer planes automatically shifts the inner planes equidistantly.

**Screenshot:**
![EQ constraint](file:///Users/jhoetter/Desktop/Revit%20Specs/0494_03-40-28.png)

**bim-ai status:** 🟡 Partial — the family editor can create an EQ constraint across three or more matching horizontal/vertical reference planes. The constraint equalizes intermediate plane offsets and reapplies equal spacing when an outer constrained plane moves. Missing: canvas dimension-string EQ glyphs, arbitrary mixed reference picking, and a full constraint solver tied to named dimensions/type values.

---

## F-077 · Masking Region

**What it does:** Annotate → Masking Region draws a 2D filled polygon that hides everything behind it (in the current view). It acts like a "white-out" layer: floor tiles, dimensions, and other elements under the chair footprint are hidden, making the plan drawing cleaner. The region boundary is drawn with the same sketch tools (Pick Lines, Rectangle, etc.) and finished with the green checkmark.

**Screenshot:**
![Masking Region](file:///Users/jhoetter/Desktop/Revit%20Specs/0580_03-45-40.png)

**bim-ai status:** ✅ Implemented — `maskingRegionRender.ts` (KRN-10) renders masking regions as opaque filled polygons hosted by plan/section/elevation views. The plan canvas `masking-region` tool (hotkey MR) uses `SketchCanvas` overlay for polygon authoring with click-to-add vertices, auto-close detection, rectangle, and Pick Walls support. The VV dialog includes "Masking Regions" as a toggleable annotation category. Fill color is editable via the inspector color picker (`inspector-masking-fillcolor`) and persists through `updateMaskingRegion`. Placed masking regions expose boundary vertex grips, so selecting a region re-enters boundary editing without delete/recreate. `voidBoundariesMm` supports Revit-style negative cutout loops that render as holes in the opaque region.

---

## F-078 · Yes/No parameter for conditional visibility

**What it does:** A "Yes/No" family parameter (e.g., "Show_2D_Elements") can be associated with the "Visible" property of any element. When the parameter is checked, the element is visible; when unchecked, it is hidden. This lets a single family switch between 2D and 3D representations based on a user-controlled toggle — or based on detail level via Visibility Settings.

**Screenshot:**
![Yes/No Visibility parameter](file:///Users/jhoetter/Desktop/Revit%20Specs/0601_03-48-28.png)

**bim-ai status:** 🟡 Partial — family editor parameters support boolean defaults and sweeps/nested instances can bind their Visible state to a boolean family parameter. The Furniture template seeds `Show_2D_Elements` and binds coarse symbolic plan lines to it while the 3D sweep placeholder uses the inverse binding. Missing: a general Associate Family Parameter button on every eligible property and project-placement UI for toggling authored-family visibility params.

---

## F-079 · Symbolic Lines for 2D furniture representation

**What it does:** Annotate → Symbolic Line → Furniture (Projection) subcategory. Used to draw the plan-view outline, backrest line, and seat/backrest diagonal of a chair in 2D. These are view-level annotations — they don't exist in 3D. Their Visibility Settings are set to show at Coarse detail level only, where 3D extrusions are suppressed for performance.

**Screenshot:**
![Symbolic Lines chair](file:///Users/jhoetter/Desktop/Revit%20Specs/0513_03-41-37.png)

**bim-ai status:** 🟡 Partial — the Furniture template seeds symbolic plan-view linework for a chair outline/backrest, tagged as coarse-only and bound to `Show_2D_Elements`. The general family editor can also author symbolic/detail lines with subcategory metadata. Missing: canvas drawing for furniture symbols, line style/object-style propagation, and project plan rendering of authored symbolic family linework.

---

## F-080 · Snap Intersection (SI) shortcut

**What it does:** Typing `SI` while placing elements activates the "Snap to Intersection" override for the next click. The cursor snaps precisely to the crossing point of two reference planes or edges, even if they are non-orthogonal. Used extensively in families to pin geometry corners to reference plane intersections.

**Screenshot:**
![Snap Intersection](file:///Users/jhoetter/Desktop/Revit%20Specs/0516_03-41-46.png)

**bim-ai status:** ✅ Done — One-shot snap override shortcuts available during drawing: SI (Intersection), SE (Endpoint), SM (Midpoint), SP (Perpendicular), SX (Extension), SW (Work Plane). Two-letter key sequence (e.g., press S then I within 500 ms) activates the override for the next pick only, then resets. The override is shown as an amber status chip displaying the kind name and shortcode (e.g. "Snap: Intersection [SI] (next pick only)") with a × cancel button. The `SnapSettingsToolbar` also provides permanent per-type toggles. Note: SN (nearest) and SC (center/arc-center) are not implemented — the snap engine has no corresponding SnapKind for those Revit overrides; SR (reference) and right-click context-menu override are also absent but are lower-priority for plan drawing.

---

## F-081 · Multiple Types per family (New Type button)

**What it does:** In the Family Types dialog, "New Type" creates a new row in the type list. Each type can have different parameter values (e.g., Type 1 = 600×600 mm, Type 2 = 750×750 mm, Type 3 = 800×800 mm). All types share the same geometry logic (driven by the same parameters) — only the values differ. The user selects the type via the Type Selector when placing in a project.

**Screenshot:**
![Multiple Types](file:///Users/jhoetter/Desktop/Revit%20Specs/0521_03-42-07.png)

**bim-ai status:** 🟡 Partial — the Family Types dialog already supports New Type, rename, select, delete, and per-type parameter values. The Furniture template now seeds two starter chair types (`600 x 600 Chair` and `750 x 750 Lounge`) with different furniture parameter values. Missing: persistence as loadable Revit-style family type catalogs and a project Type Selector for this authored furniture template.

---

## F-082 · Extrusion from front elevation (height parameters)

**What it does:** 3D chair parts (seat, backrest, legs) are created as extrusions. The profile is drawn in the plan "Ref Level" view (defining footprint), then in the "Front" elevation view the top/bottom grips of the extrusion are locked to named reference planes (Seat Height, Seat Thickness, Backrest Height). This links the 3D solid height to parametric dimensions.

**Screenshot:**
![Extrusion height from elevation](file:///Users/jhoetter/Desktop/Revit%20Specs/0623_03-50-05.png)

**bim-ai status:** 🟡 Partial — family sweeps can now carry a `pathLengthParam`, so the resolver drives straight extrusion depth/height from a family parameter. The Furniture template uses this for seat thickness and leg height placeholders. Missing: true front-elevation sketch views, grip locking to named elevation reference planes, and separate extrusion start/end controls.

---

## F-083 · Leg geometry: Circle extrusion + Leg_Radius parameter

**What it does:** Legs are created as circular extrusions in the plan view. A circle is drawn at the intersection of inner offset reference planes. Its radius is labeled with a parameter "Leg_Radius". Using Copy inside the edit sketch, four circles are created at the four inner intersections. The extrusion depth is locked to the Seat Height reference plane in the elevation view.

**Screenshot:**
![Leg circle extrusion](file:///Users/jhoetter/Desktop/Revit%20Specs/0651_03-52-02.png)

**bim-ai status:** 🟡 Partial — the Furniture template now seeds four circular leg extrusion placeholders using polygonal circle profiles, plus `Leg_Radius` and `Seat_Height` parameters. The resolver uses `Seat_Height` to drive the leg extrusion height. Missing: editable circle sketch primitive, radius-driven profile regeneration when `Leg_Radius` changes, copy-in-sketch workflow, and elevation locking.

---

## F-084 · Leg_Offset parameter (inner reference plane offset)

**What it does:** Two pairs of inner reference planes are offset from the outer chair boundary. The offset distance is parameterized as "Leg_Offset". This ensures the legs are always inset from the chair edge by a consistent amount regardless of the chair size type. The EQ constraint is NOT used here — legs have a fixed inset, not proportional.

**Screenshot:**
![Leg Offset parameter](file:///Users/jhoetter/Desktop/Revit%20Specs/0653_03-52-15.png)

**bim-ai status:** 🟡 Partial — the Furniture template seeds `Leg_Offset` and inner leg-offset reference planes, giving the authored chair a named inset parameter and editable offset planes. Missing: actual param-bound offset constraints, four generated leg placements, and automatic updates when Width/Depth types change.

---

## F-085 · Detail Level control for 3D vs 2D elements

**What it does:** Family Element Visibility Settings allows assigning each element to Coarse/Medium/Fine detail levels. Convention: 2D symbolic elements (masking region + symbolic lines) are shown at Coarse; 3D extrusions are shown at Medium and Fine. The result: in plan views set to Coarse (1:100 or smaller scale), the 2D symbol appears; in close-up or 3D views at Fine, the full solid geometry is used.

**Screenshot:**
![Detail level 2D vs 3D](file:///Users/jhoetter/Desktop/Revit%20Specs/0679_03-55-13.png)

**bim-ai status:** 🟡 Partial — the Furniture template seeds coarse-only symbolic lines and a medium/fine-only sweep placeholder, and the family editor Preview Visibility control can switch detail levels to show the 2D/3D split. Missing: full project-context preview behavior and complete rendering of authored symbolic family linework in placed instances.

---

## F-086 · Backrest Depth parameter

**What it does:** A dedicated reference plane is drawn at the top of the seat area, offset from the main horizontal reference plane. A dimension from the main plane to this new plane is parameterized as "Backrest Depth". This is a Type parameter — each chair size type can have a different backrest depth value.

**Screenshot:**
![Backrest Depth parameter](file:///Users/jhoetter/Desktop/Revit%20Specs/0534_03-42-59.png)

**bim-ai status:** 🟡 Partial — the Furniture template seeds a `Backrest_Depth` type parameter, a matching reference plane, and an aligned dimension row between the center plane and the backrest plane. Missing: constraint solving that drives the plane from type values and a true elevation/profile workflow for the backrest solid.
