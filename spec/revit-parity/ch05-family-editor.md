# Chapter 5 — Family Editor (Doors)

Source segment: `01:50:00 – 02:00:32`

The Family Editor is a sub-environment within Revit for creating parametric component families (doors, windows, furniture, structural elements, etc.). A family is saved as an `.rfa` file and loaded into projects on demand.

---

## F-048 · Family Editor workspace

**What it does:** Opening a `.rfa` file (or New → Family) launches the Family Editor — a separate workspace with its own ribbon (Create, Insert, Annotate, View, Manage, Modify tabs). The canvas shows reference planes, dimensions, and geometry. The work plane is "Ref Level" by default (a plan view).

**Screenshot:**
![Family Editor workspace](file:///Users/jhoetter/Desktop/Revit%20Specs/0376_01-50-45.png)

**bim-ai status:** ✅ Available — bim-ai has an in-app `/family-editor` workspace with a template chooser, reference-plane and parameter panels, sweep/extrusion-style solids, arrays, nested instances, visibility bindings, flex preview, saved authored family documents, project catalog persistence, and Load Into Project / reload behavior.

---

## F-049 · Family templates

**What it does:** New Family → Select Template opens a browser of `.rft` template files. Templates pre-configure the family category (Door, Window, Furniture, Generic Model, etc.), host type (wall-hosted, floor-hosted, ceiling-hosted, face-based, standalone), and which reference planes are pre-drawn. The correct template determines where the family can be placed in a project.

**Screenshot:**
![Family Templates](file:///Users/jhoetter/Desktop/Revit%20Specs/0485_03-40-01.png)

**bim-ai status:** ✅ Available — the family editor template chooser is a Revit-style `.rft` browser with searchable/filterable entries for generic model, door, window, profile, and furniture templates. Template metadata carries category, host type, description, and saved/project-loaded provenance so authored family documents keep their Revit-style template origin.

---

## F-050 · Reference Planes in families

**What it does:** Reference planes (shortcut `RP`) are the parametric skeleton of a family. Geometry is locked (constrained) to reference planes. When the reference plane moves (because a parameter driving it changes), all locked geometry follows. Reference planes can be named (via Properties → Name) and marked as "Strong Reference" so they snap to in project views. Subcategory and line color can be set for visual clarity.

**Screenshot:**
![Reference Planes](file:///Users/jhoetter/Desktop/Revit%20Specs/0391_01-52-22.png)

**bim-ai status:** ✅ Available — the family editor can add horizontal and vertical reference planes, edit names, classify them as Strong Reference / Weak Reference / Not a Reference, lock them, and use them as constraint-driving authoring references.

---

## F-051 · Extrusion tool (Create tab)

**What it does:** Create → Extrusion draws a 2D profile in the current work plane (using lines, arcs, rectangles, circles, pick lines, etc.) and extrudes it into a 3D solid perpendicular to the plane. "Extrusion Start" and "Extrusion End" parameters control the depth. The resulting solid can be locked to reference planes in the elevation view to make it parametric in height.

**Screenshot:**
![Extrusion tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0384_01-51-46.png)

**bim-ai status:** ✅ Available — family sweep/extrusion authoring creates solid geometry from line, picked-line, and circle sketch profiles. Picked profile lines can be locked to reference planes or family edges and rederive as those references move. Selected sweeps expose Associate Family Parameter controls for extrusion depth, start, and end, plus a front-elevation grip sketch showing the locked bottom/top extents.

---

## F-052 · Pick Lines with Lock (sketch mode)

**What it does:** In any sketch-based tool (extrusion profile, floor boundary, roof footprint, etc.), "Pick Lines" allows clicking existing reference planes or model edges instead of drawing new lines. Enabling "Lock" (chain-link icon in the Options Bar) permanently locks each picked line to its reference — if the reference plane shifts, the sketch line follows automatically.

**Screenshot:**
![Pick Lines with Lock](file:///Users/jhoetter/Desktop/Revit%20Specs/0619_03-49-44.png)

**bim-ai status:** ✅ Available — family sweep profile sketches can pick reference planes and family geometry edges as profile sketch lines. Enabling Lock stores source metadata, and locked picked lines rederive automatically when source planes, source edges, or constraint-driven offsets change.

---

## F-053 · Trim / Extend to Corner (TR)

**What it does:** Modify → Trim/Extend to Corner (shortcut `TR`) trims or extends two lines to form a clean corner at their intersection. Widely used when building sketch profiles from picked lines to close any gaps or overlaps at corners.

**Screenshot:**
![Trim/Extend to Corner](file:///Users/jhoetter/Desktop/Revit%20Specs/0387_01-52-00.png)

**bim-ai status:** ✅ Available — family sweep profile sketches expose Trim/Extend to Corner from both the cleanup controls and the `TR` keyboard shortcut in sketch mode. The workflow selects two profile lines and trims/extends their nearest endpoints to the infinite-line intersection so picked-line profiles can be closed without redrawing.

---

## F-054 · Aligned Dimension (DI) + Create Parameter

**What it does:** Annotate → Aligned Dimension (shortcut `DI`) places a parametric dimension between two reference planes or edges. Selecting the dimension and clicking the "Label: \<None\>" dropdown → "Create Parameter" opens a dialog to assign a new family parameter to that dimension. Now the dimension drives the distance, and the parameter appears in the Family Types dialog.

**Screenshot:**
![Dimension + Create Parameter](file:///Users/jhoetter/Desktop/Revit%20Specs/0394_01-52-46.png)

**bim-ai status:** ✅ Available — the family editor can place aligned dimensions between reference planes, render them on canvas, label existing or new `length_mm` parameters from dropdown/create controls, and solve reference-plane offsets from bound parameter values while respecting locked planes.

---

## F-055 · Type vs. Instance Parameters

**What it does:** When creating a parameter, "Parameter Data" toggles between **Type** and **Instance**:

- **Type**: same value for all family instances of the same type. Changing it affects every placed instance of that type simultaneously.
- **Instance**: each placed instance can have a different value, edited individually in the Properties palette.

Example: door Width is a Type parameter; Sill Height is an Instance parameter.

**Screenshot:**
![Type vs Instance](file:///Users/jhoetter/Desktop/Revit%20Specs/0480_02-53-21.png)

**bim-ai status:** ✅ Available — family parameters expose Type vs Instance scope in the parameter table. Type-scoped values are authored per Family Types row and loaded as project `family_type` parameters; instance-scoped values appear on placed authored `family_instance` elements in the Properties palette and persist through per-instance `paramValues`, with resolver logic prioritizing instance overrides.

---

## F-056 · Family Types dialog

**What it does:** Create → Family Types (or the Family Types icon in the ribbon) opens a dialog listing all types defined in this family (e.g., "Type 1 – 1000×2100", "Type 1 – 1200×2400") and all parameters (both Type and Instance) with their current values. Users can create new types (New Type), delete types, and change parameter values and then click Apply to see the geometry update live in the canvas.

**Screenshot:**
![Family Types dialog](file:///Users/jhoetter/Desktop/Revit%20Specs/0399_01-53-36.png)

**bim-ai status:** ✅ Available — the Family Types dialog supports local type rows: users can create a new type from the active one, rename types, delete non-last types, select the active type, and edit per-type values for the current family parameters. Save/Load Into Project now persists every authored type row as a project `family_type` with embedded family definition metadata, reload keep/overwrite behavior, and project Type Selector placement support for authored component families.

---

## F-057 · Material Browser

**What it does:** Opened from the Material field in Properties (or Manage → Materials). Shows all materials in the project or family. Users can create new materials, rename them, switch between Appearance / Graphics / Physical / Thermal tabs, and assign render assets from the Asset Browser. The "Graphics" tab's "Use Render Appearance" checkbox makes the shaded viewport show the same color as the rendered material.

**Screenshot:**
![Material Browser](file:///Users/jhoetter/Desktop/Revit%20Specs/0407_01-54-39.png)

**bim-ai status:** ✅ Available — family editor material fields open a searchable Material Browser backed by the local material registry. Users can create and rename family materials, assign them to `material_key` parameters and sweep geometry, and edit Appearance, Graphics, Physical, and Thermal metadata tabs with live swatches.

---

## F-058 · Asset Browser

**What it does:** Accessed via the icon at the bottom of the Material Browser. Shows Autodesk's library of physical material appearances (thousands of pre-built render assets: wood, concrete, glass, metal, etc.). Searching by name and clicking the "Replace" arrow swaps the appearance asset into the current material definition. The asset includes bump maps, reflectance, and color.

**Screenshot:**
![Asset Browser](file:///Users/jhoetter/Desktop/Revit%20Specs/0410_01-54-56.png)

**bim-ai status:** ✅ Available — family editor material fields expose a distinct Appearance Asset Browser with curated local asset-library content, search, swatches, texture/bump replacement metadata, reflectance editing, and Replace actions wired back into family material fields.

---

## F-059 · Family Element Visibility Settings

**What it does:** Selecting a family element and clicking "Visibility Settings" in the Modify ribbon opens a dialog where you control:

- **Detail Levels**: which levels (Coarse, Medium, Fine) show this element.
- **View types**: Plan/RCP, Front/Back, Left/Right, 3D Views/Elevations/Sections.

This allows a family to show a simple 2D opening symbol at Coarse detail and a detailed 3D shutter at Fine detail.

**Screenshot:**
![Visibility Settings](file:///Users/jhoetter/Desktop/Revit%20Specs/0470_02-50-50.png)

**bim-ai status:** ✅ Available — family geometry nodes, symbolic lines, nested instances, and arrays support coarse/medium/fine visibility, Plan/RCP, Front/Back, Left/Right, 3D Views, Elevations, and Sections view-type visibility flags, plus Yes/No visibility bindings. The Family Editor properties panels expose the same detail-level and view-type checkbox semantics, and the resolver honors them for family and project preview contexts.

---

## F-060 · Load Family Into Project

**What it does:** In the Family Editor, clicking "Load Into Project" (or Load Into Projects if multiple projects are open) saves the family and loads it into the selected open project. If a family with the same name already exists, a dialog offers: "Overwrite existing version" or "Overwrite existing version and its parameter values". The second option is needed when a nested family's parameter values (not just geometry) have changed.

**Screenshot:**
![Load Into Project](file:///Users/jhoetter/Desktop/Revit%20Specs/0424_01-58-16.png)

**bim-ai status:** ✅ Available — external catalog families can be loaded or placed, and Family Editor authored families can be saved, reopened, and loaded into the project as project catalog family definitions plus `family_type` rows. Reloading matching authored families offers Keep values vs Overwrite values choices while preserving the existing external catalog Load/Place workflow.

---

## F-061 · Wall-hosted family placement

**What it does:** Door and window families are wall-hosted: they can only be placed by clicking on a wall in a project view. The family automatically cuts an opening in the wall. The host wall determines orientation. Pressing Spacebar before placing flips the door swing direction (which face the door opens toward).

**Screenshot:**
![Wall-hosted door placement](file:///Users/jhoetter/Desktop/Revit%20Specs/0427_01-58-34.png)

**bim-ai status:** ✅ Available — bim-ai door/window elements remain wall-hosted with wall cuts, and loaded wall-hosted family types now place through the component workflow onto the nearest wall. Placement persists a `family_instance` with host wall/view metadata, aligns runtime plan/3D symbols to the wall, and creates a paired `wall_opening` sized from family type/instance parameters for the existing wall cut renderer.

---

## F-062 · Type Properties dialog (Edit Type / Duplicate)

**What it does:** Selecting an element → Edit Type opens its type-level properties. "Duplicate" creates a new type by copying an existing one, then the new type's parameters can be customized without affecting the original. This is the primary way to create multiple sizes of the same element (e.g., different door dimensions).

**Screenshot:**
![Type Properties - Duplicate](file:///Users/jhoetter/Desktop/Revit%20Specs/0431_01-59-12.png)

**bim-ai status:** ✅ Available — selecting a door/window instance offers a Duplicate type action for its current family type, prompts for the new type name, assigns the instance to the copied custom `family_type`, and preserves parameters/catalog provenance. Selected `family_type` rows and layered `wall_type` / `floor_type` / `roof_type` assemblies also expose editable type properties and duplicate-name prompts backed by the existing upsert commands.
