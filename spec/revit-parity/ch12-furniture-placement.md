# Chapter 12 — Furniture Placement Workflow

Source segment: `08:35:57 – 09:57:57`

This chapter covers the practical workflow of furnishing a completed floor plan using the parametric 2D family library built in earlier chapters.

---

## F-114 · Placing component families in a project

**What it does:** Loaded families appear in the Component tool or can be accessed via the Type Selector. When the cursor enters a plan view, a preview of the family follows the cursor. Clicking places an instance. Pressing Spacebar rotates the family 90° each press before placement. Pressing Esc twice exits placement mode.

**Screenshot:**
![Placing families](file:///Users/jhoetter/Desktop/Revit%20Specs/0737_04-37-46.png)

**bim-ai status:** 🟡 Partial — A "Component" plan tool (hotkey `CC`) is now available in the tool palette. When activated, the OptionsBar shows an asset selector listing all `asset_library_entry` elements. Clicking on the plan canvas fires `PlaceAsset { assetId, levelId, positionMm }`. Placed assets render as schematic rectangles (brown outline + cross-diagonal) sized from the asset's `thumbnailWidthMm` × `thumbnailHeightMm`. Missing: live cursor preview before placing (the cursor shows no ghost); Spacebar rotation during hover (F-115); interactive family parameter editing after placement; built-in furniture asset library (assets must be created programmatically).

---

## F-115 · Spacebar rotation during placement

**What it does:** While hovering before clicking to place a component, pressing Spacebar rotates the element by 90°. Multiple presses cycle through 0°, 90°, 180°, 270°. For walls, Spacebar flips interior/exterior orientation. This is the fastest way to orient furniture to fit a room without a separate Rotate command.

**Screenshot:**
![Spacebar rotation](file:///Users/jhoetter/Desktop/Revit%20Specs/0575_03-45-10.png)

**bim-ai status:** ✅ Done — Spacebar rotates the pending placement by 90° (cycling 0°→90°→180°→270°) while the Component tool is active. The `pendingComponentRotationDeg` module-level var is passed to the `PlaceAsset` command on each click. A live ghost preview rectangle (brown wireframe + diagonal cross, `THREE.LineSegments`) now tracks the cursor in real time, sized from the asset's `thumbnailWidthMm` × `thumbnailHeightMm` and rotated to match `pendingComponentRotationDeg`. The ghost is rebuilt on every `pointermove` event, cleared on placement click, and removed when switching away from the component tool.

---

## F-116 · Copy (CO) tool

**What it does:** Modify → Copy (shortcut `CO`) copies selected elements to a new location specified by clicking a source point and destination point. When "Multiple" is checked in the Options Bar, you can place multiple copies in sequence without re-activating the tool.

**Screenshot:**
![Copy tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0685_03-55-42.png)

**bim-ai status:** 🟡 Partial (better) — Two-point CP tool now available in the Modify palette: first click sets the reference point, second click places the copy at the exact delta offset. Multi-copy mode implemented: "Multiple" checkbox in the Options Bar (default: on) keeps the tool active after each copy so the user can place further copies without re-activating; Escape once clears the anchor, Escape again exits to select. When "Multiple" is unchecked, original single-copy behavior is used (exit to select after one copy). Ctrl+C / Ctrl+V clipboard workflow also remains. Missing: persistence of clipboard across page reload, and copy to a different level.

---

## F-117 · Parametric living room sofa family

**What it does:** A 2D parametric sofa family with drag handles that adjust its overall width and depth. The handles are connected to reference planes and parameters — dragging them visually resizes the sofa without entering the family editor. This supports quick furniture layout iteration directly in the plan view.

**Screenshot:**
![Sofa parametric family](file:///Users/jhoetter/Desktop/Revit%20Specs/0686_03-55-52.png)
*(Parametric chair family placed in project — sofa-specific frames start beyond 0841)*

**bim-ai status:** ❌ Not available.

---

## F-118 · Parametric kitchen slab family

**What it does:** A 2D parametric kitchen counter/slab family. The sink and refrigerator positions are sub-parameters that can be independently moved within the main kitchen unit by dragging handles. Rotating the entire unit is done with the Rotate tool or Spacebar. Align (AL) is used to lock the unit against the wall.

**Screenshot:**
![Kitchen parametric family](file:///Users/jhoetter/Desktop/Revit%20Specs/0736_04-37-24.png)
*(Dining table family in furniture library project — kitchen-specific frames start beyond 0841)*

**bim-ai status:** ❌ Not available.

---

## F-119 · Parametric bathroom layout family

**What it does:** A single family containing toilet, sink, and shower stall, all positioned relative to internal reference planes. The entire bathroom layout can be moved/rotated as one unit. Individual sub-elements (e.g., shower stall) can also have their position adjusted via instance parameters or drag handles.

**Screenshot:**
![Bathroom layout family](file:///Users/jhoetter/Desktop/Revit%20Specs/0574_03-45-08.png)
*(Chair placed in project floor plan — bathroom-layout-specific frames start beyond 0841)*

**bim-ai status:** ❌ Not available.

---

## F-120 · Parametric bed family (2D)

**What it does:** A 2D bed family with width and length parameters (e.g., 1800×2000 mm). Can be placed, rotated, and resized via drag handles. Placing a bed and a wardrobe together and then grouping them (or copying both together) lets you furnish multiple bedrooms quickly.

**Screenshot:**
![Parametric bed family](file:///Users/jhoetter/Desktop/Revit%20Specs/0740_04-38-07.png)
*(Parametric table family in furniture library — bed-specific frames start beyond 0841)*

**bim-ai status:** ❌ Not available.

---

## F-121 · Align tool (AL) for furniture-to-wall alignment

**What it does:** Modify → Align (shortcut `AL`). Click the target alignment reference (e.g., a wall interior face), then click the element face to move it to align. Locks can be applied after alignment to maintain the relationship if the wall moves. Used here to snap kitchen counters and wardrobes flush against walls.

**Screenshot:**
![Align tool furniture](file:///Users/jhoetter/Desktop/Revit%20Specs/0465_02-49-25.png)
*(Align tool used in window family editor — furniture-align-specific frames start beyond 0841)*

**bim-ai status:** 🟡 Partial — The Align tool (hotkey `AL`) provides a two-click interactive workflow: first click sets the reference point, second click picks the nearest wall (within 900 mm) and fires `alignElementToReference { targetWallId, referenceMm }`. The backend translates the wall along its dominant axis (X or Y) so its nearest endpoint coincides with the reference point. After the first click a dashed crosshair SVG overlay (horizontal + vertical lines) is drawn at the reference coordinate, with a coordinate label and a "Click near a wall to align it to the reference line" status chip — making the alignment target visible before picking the wall. Missing: alignment to arbitrary element faces (only wall nearest-endpoint alignment is supported); the optional "Lock" constraint after alignment; alignment of non-wall elements (floors, columns, etc.).

---

## F-122 · Rotate tool

**What it does:** Modify → Rotate lets users rotate a selected element around a user-defined center point. The rotation can be defined by clicking two rays (first ray = start angle, second ray = end angle) or by typing an angle numerically. The center of rotation defaults to the element's centroid but can be moved.

**Screenshot:**
![Rotate tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0575_03-45-10.png)
*(Spacebar rotation during component placement — rotate-tool-specific frames start beyond 0841)*

**bim-ai status:** 🟡 Partial (better) — General-purpose two-click Rotate tool (`RO` hotkey) now implemented: first click sets the center of rotation, second click picks the end angle direction (bearing from center). Supported element kinds: wall (rotates start+end endpoints), column (rotates position + rotation_deg), placed_asset (rotates position + rotation_deg), floor (rotates boundary_mm polygon), room (rotates outline_mm polygon), area (rotates boundary_mm polygon). Column drag-handle grip and inspector rotation input remain available. Missing: angular snap at standard angles (0°/45°/90°/etc.); no numeric "rotate by typed angle" dialog; no start-angle reference ray (angle is absolute bearing from center).
