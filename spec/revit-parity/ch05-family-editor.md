# Chapter 5 — Family Editor (Doors)

Source segment: `01:50:00 – 02:00:32`

The Family Editor is a sub-environment within Revit for creating parametric component families (doors, windows, furniture, structural elements, etc.). A family is saved as an `.rfa` file and loaded into projects on demand.

---

## F-048 · Family Editor workspace

**What it does:** Opening a `.rfa` file (or New → Family) launches the Family Editor — a separate workspace with its own ribbon (Create, Insert, Annotate, View, Manage, Modify tabs). The canvas shows reference planes, dimensions, and geometry. The work plane is "Ref Level" by default (a plan view).

**Screenshot:**
![Family Editor workspace](file:///Users/jhoetter/Desktop/Revit%20Specs/0376_01-50-45.png)

**bim-ai status:** 🟡 Partial — bim-ai has an in-app `/family-editor` workspace with a template chooser, reference-plane and parameter panels, sweep/extrusion-style solids, arrays, nested instances, visibility bindings, and flex preview. Missing: full persistence/load-to-project workflow and Revit-style dedicated family ribbon/work-plane management.

---

## F-049 · Family templates

**What it does:** New Family → Select Template opens a browser of `.rft` template files. Templates pre-configure the family category (Door, Window, Furniture, Generic Model, etc.), host type (wall-hosted, floor-hosted, ceiling-hosted, face-based, standalone), and which reference planes are pre-drawn. The correct template determines where the family can be placed in a project.

**Screenshot:**
![Family Templates](file:///Users/jhoetter/Desktop/Revit%20Specs/0485_03-40-01.png)

**bim-ai status:** 🟡 Partial — the family editor has built-in generic model, door, window, and profile templates. Missing: Revit-style `.rft` file browser and complete host/category template metadata.

---

## F-050 · Reference Planes in families

**What it does:** Reference planes (shortcut `RP`) are the parametric skeleton of a family. Geometry is locked (constrained) to reference planes. When the reference plane moves (because a parameter driving it changes), all locked geometry follows. Reference planes can be named (via Properties → Name) and marked as "Strong Reference" so they snap to in project views. Subcategory and line color can be set for visual clarity.

**Screenshot:**
![Reference Planes](file:///Users/jhoetter/Desktop/Revit%20Specs/0391_01-52-22.png)

**bim-ai status:** 🟡 Partial — the family editor can add horizontal and vertical reference planes and use them as authoring context. Missing: strong/weak reference semantics, polished naming/subcategory controls, and constraint locks.

---

## F-051 · Extrusion tool (Create tab)

**What it does:** Create → Extrusion draws a 2D profile in the current work plane (using lines, arcs, rectangles, circles, pick lines, etc.) and extrudes it into a 3D solid perpendicular to the plane. "Extrusion Start" and "Extrusion End" parameters control the depth. The resulting solid can be locked to reference planes in the elevation view to make it parametric in height.

**Screenshot:**
![Extrusion tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0384_01-51-46.png)

**bim-ai status:** 🟡 Partial — family sweep/extrusion authoring creates solid geometry from profiles and resolves it through the family sweep geometry pipeline. Missing: Revit-grade sketch locks, profile cleanup tools, and elevation-driven extrusion start/end parameters.

---

## F-052 · Pick Lines with Lock (sketch mode)

**What it does:** In any sketch-based tool (extrusion profile, floor boundary, roof footprint, etc.), "Pick Lines" allows clicking existing reference planes or model edges instead of drawing new lines. Enabling "Lock" (chain-link icon in the Options Bar) permanently locks each picked line to its reference — if the reference plane shifts, the sketch line follows automatically.

**Screenshot:**
![Pick Lines with Lock](file:///Users/jhoetter/Desktop/Revit%20Specs/0619_03-49-44.png)

**bim-ai status:** 🟡 Partial — family sweep profile sketches can pick reference planes as profile sketch lines and optionally lock those picked lines to the source reference plane. Locked picked lines store `reference_plane` source metadata and rederive automatically when the reference-plane offset is edited. Missing: model-edge picking, lock constraint visualization, and Pick Lines support across every sketch-based family/project tool.

---

## F-053 · Trim / Extend to Corner (TR)

**What it does:** Modify → Trim/Extend to Corner (shortcut `TR`) trims or extends two lines to form a clean corner at their intersection. Widely used when building sketch profiles from picked lines to close any gaps or overlaps at corners.

**Screenshot:**
![Trim/Extend to Corner](file:///Users/jhoetter/Desktop/Revit%20Specs/0387_01-52-00.png)

**bim-ai status:** 🟡 Partial — family sweep profile sketches expose a TR cleanup action: users choose two profile lines and trim/extend their nearest endpoints to the infinite-line intersection. Missing: keyboard-driven `TR`, canvas click selection, gap/overlap feedback, and reuse across every sketch mode.

---

## F-054 · Aligned Dimension (DI) + Create Parameter

**What it does:** Annotate → Aligned Dimension (shortcut `DI`) places a parametric dimension between two reference planes or edges. Selecting the dimension and clicking the "Label: \<None\>" dropdown → "Create Parameter" opens a dialog to assign a new family parameter to that dimension. Now the dimension drives the distance, and the parameter appears in the Family Types dialog.

**Screenshot:**
![Dimension + Create Parameter](file:///Users/jhoetter/Desktop/Revit%20Specs/0394_01-52-46.png)

**bim-ai status:** ❌ Not available.

---

## F-055 · Type vs. Instance Parameters

**What it does:** When creating a parameter, "Parameter Data" toggles between **Type** and **Instance**:

- **Type**: same value for all family instances of the same type. Changing it affects every placed instance of that type simultaneously.
- **Instance**: each placed instance can have a different value, edited individually in the Properties palette.

Example: door Width is a Type parameter; Sill Height is an Instance parameter.

**Screenshot:**
![Type vs Instance](file:///Users/jhoetter/Desktop/Revit%20Specs/0480_02-53-21.png)

**bim-ai status:** 🟡 Partial — family parameters carry an `instanceOverridable` flag, resolver logic prioritizes instance overrides, and door/window/family placement data can carry override params. Missing: complete Revit parameter creation dialog and Family Types integration.

---

## F-056 · Family Types dialog

**What it does:** Create → Family Types (or the Family Types icon in the ribbon) opens a dialog listing all types defined in this family (e.g., "Type 1 – 1000×2100", "Type 1 – 1200×2400") and all parameters (both Type and Instance) with their current values. Users can create new types (New Type), delete types, and change parameter values and then click Apply to see the geometry update live in the canvas.

**Screenshot:**
![Family Types dialog](file:///Users/jhoetter/Desktop/Revit%20Specs/0399_01-53-36.png)

**bim-ai status:** ❌ Not available.

---

## F-057 · Material Browser

**What it does:** Opened from the Material field in Properties (or Manage → Materials). Shows all materials in the project or family. Users can create new materials, rename them, switch between Appearance / Graphics / Physical / Thermal tabs, and assign render assets from the Asset Browser. The "Graphics" tab's "Use Render Appearance" checkbox makes the shaded viewport show the same color as the rendered material.

**Screenshot:**
![Material Browser](file:///Users/jhoetter/Desktop/Revit%20Specs/0407_01-54-39.png)

**bim-ai status:** 🟡 Partial — family editor material fields now open a searchable Material Browser backed by the existing MAT-01 PBR catalog. It shows material swatches, names, categories, Appearance/Graphics tabs, and assigns selected keys to `material_key` parameters and sweep geometry `materialKey` values. Missing: project/family material creation and rename, full Appearance/Graphics/Physical/Thermal editing, and integration with all material-bearing elements.

---

## F-058 · Asset Browser

**What it does:** Accessed via the icon at the bottom of the Material Browser. Shows Autodesk's library of physical material appearances (thousands of pre-built render assets: wood, concrete, glass, metal, etc.). Searching by name and clicking the "Replace" arrow swaps the appearance asset into the current material definition. The asset includes bump maps, reflectance, and color.

**Screenshot:**
![Asset Browser](file:///Users/jhoetter/Desktop/Revit%20Specs/0410_01-54-56.png)

**bim-ai status:** 🟡 Partial — family editor material fields also expose a distinct Appearance Asset Browser with search, swatches, and a Replace action that swaps the selected appearance key into the active family parameter or sweep. Missing: Autodesk-scale library content, texture/bump/reflectance asset editing, downloaded asset management, and material/appearance split semantics beyond the local MAT-01 catalog.

---

## F-059 · Family Element Visibility Settings

**What it does:** Selecting a family element and clicking "Visibility Settings" in the Modify ribbon opens a dialog where you control:

- **Detail Levels**: which levels (Coarse, Medium, Fine) show this element.
- **View types**: Plan/RCP, Front/Back, Left/Right, 3D Views/Elevations/Sections.

This allows a family to show a simple 2D opening symbol at Coarse detail and a detailed 3D shutter at Fine detail.

**Screenshot:**
![Visibility Settings](file:///Users/jhoetter/Desktop/Revit%20Specs/0470_02-50-50.png)

**bim-ai status:** 🟡 Partial — family geometry nodes support coarse/medium/fine visibility and boolean visibility bindings in the editor/resolver. Missing: full Revit view-type visibility dialog.

---

## F-060 · Load Family Into Project

**What it does:** In the Family Editor, clicking "Load Into Project" (or Load Into Projects if multiple projects are open) saves the family and loads it into the selected open project. If a family with the same name already exists, a dialog offers: "Overwrite existing version" or "Overwrite existing version and its parameter values". The second option is needed when a nested family's parameter values (not just geometry) have changed.

**Screenshot:**
![Load Into Project](file:///Users/jhoetter/Desktop/Revit%20Specs/0424_01-58-16.png)

**bim-ai status:** 🟡 Partial — external catalog families can now be loaded into the current project from `FamilyLibraryPanel.tsx` via a dedicated Load action. `Workspace.tsx` persists them as project `family_type` elements with `catalogSource` provenance using the existing `upsertFamilyType` command, while the separate Place action still loads and immediately enters placement. Missing: true Family Editor `.rfa` save/load, multi-open-project target selection, and overwrite/parameter-values dialogs.

---

## F-061 · Wall-hosted family placement

**What it does:** Door and window families are wall-hosted: they can only be placed by clicking on a wall in a project view. The family automatically cuts an opening in the wall. The host wall determines orientation. Pressing Spacebar before placing flips the door swing direction (which face the door opens toward).

**Screenshot:**
![Wall-hosted door placement](file:///Users/jhoetter/Desktop/Revit%20Specs/0427_01-58-34.png)

**bim-ai status:** 🟡 Partial — bim-ai door/window elements are wall-hosted, carry `familyTypeId`/override parameters, and wall opening/cutter paths exist. Missing: generic loaded-family placement workflow with automatic opening cuts for arbitrary hosted families.

---

## F-062 · Type Properties dialog (Edit Type / Duplicate)

**What it does:** Selecting an element → Edit Type opens its type-level properties. "Duplicate" creates a new type by copying an existing one, then the new type's parameters can be customized without affecting the original. This is the primary way to create multiple sizes of the same element (e.g., different door dimensions).

**Screenshot:**
![Type Properties - Duplicate](file:///Users/jhoetter/Desktop/Revit%20Specs/0431_01-59-12.png)

**bim-ai status:** 🟡 Partial — selecting a door/window instance now offers a Duplicate type action for its current family type, then assigns the instance to the copied custom `family_type`. Selecting a custom `family_type` or layered `wall_type` / `floor_type` / `roof_type` in the right rail also exposes a Duplicate type action. The action copies family parameters, catalog provenance, wall assembly layers, and type metadata through the existing `upsertFamilyType` / `upsert*Type` commands. Missing: a full Revit-style modal Type Properties dialog with side-by-side parameter groups, formula/type catalog controls, and duplicate-name conflict prompts.
