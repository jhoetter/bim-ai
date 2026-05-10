# Chapter 12 — Furniture Placement Workflow

Source segment: `08:35:57 – 09:57:57`

This chapter covers the practical workflow of furnishing a completed floor plan using the parametric 2D family library built in earlier chapters.

---

## F-114 · Placing component families in a project

**What it does:** Loaded families appear in the Component tool or can be accessed via the Type Selector. When the cursor enters a plan view, a preview of the family follows the cursor. Clicking places an instance. Pressing Spacebar rotates the family 90° each press before placement. Pressing Esc twice exits placement mode.

**Screenshot:**
![Placing families](file:///Users/jhoetter/Desktop/Revit%20Specs/0737_04-37-46.png)

**bim-ai status:** ✅ Done — A "Component" plan tool (hotkey `CC`) is available in the tool palette. When activated, the OptionsBar shows an asset selector listing all `asset_library_entry` elements. The `residential-eu` starter template seeds a built-in furniture/fixture library (sofa, chair, dining table, counters, appliances, toilet, shower, queen bed, single bed, wardrobe, floor lamp, area rug), so users can place common components without programmatic setup. Clicking on the plan canvas fires `PlaceAsset { assetId, levelId, positionMm }`. Placed assets render with symbol-specific schematic plan linework and lightweight 3D proxies sized from param schema / thumbnail dimensions, including bed, wardrobe, lamp, rug, kitchen, bath, seating, and table symbols. A live ghost preview tracks the cursor before placement and Spacebar rotates it through 0°→90°→180°→270°. After placement, the right rail shows instance parameters from the asset schema and persists edits through `updateElementProperty { key: "paramValues" }`.

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

**bim-ai status:** ✅ Done — Two-point CP tool available in the Modify palette: first click sets the reference point, second click places the copy at the exact delta offset. Multi-copy mode implemented: "Multiple" checkbox in the Options Bar (default: on) keeps the tool active after each copy so the user can place further copies without re-activating; Escape once clears the anchor, Escape again exits to select. When "Multiple" is unchecked, original single-copy behavior is used (exit to select after one copy). Ctrl+C / Ctrl+V clipboard workflow also remains, so the tracked Revit use case of copying elements to one or more new positions is covered.

---

## F-117 · Parametric living room sofa family

**What it does:** A 2D parametric sofa family with drag handles that adjust its overall width and depth. The handles are connected to reference planes and parameters — dragging them visually resizes the sofa without entering the family editor. This supports quick furniture layout iteration directly in the plan view.

**Screenshot:**
![Sofa parametric family](file:///Users/jhoetter/Desktop/Revit%20Specs/0686_03-55-52.png)
_(Parametric chair family placed in project — sofa-specific frames start beyond 0841)_

**bim-ai status:** ✅ Done — The residential starter template includes a built-in `3-Seat Sofa` asset with width/depth/height parameter schema, searchable furniture tags, `planSymbolKind: 'sofa'`, and a recognizable schematic plan + lightweight 3D seating proxy. The `PlaceAsset` command and `updateElementProperty { key: "paramValues" }` can carry alternate sofa widths/depths. The right rail exposes those instance parameters after placement, and selected placed assets now show on-canvas width/depth face grips that resize the sofa interactively by patching `paramValues`.

---

## F-118 · Parametric kitchen slab family

**What it does:** A 2D parametric kitchen counter/slab family. The sink and refrigerator positions are sub-parameters that can be independently moved within the main kitchen unit by dragging handles. Rotating the entire unit is done with the Rotate tool or Spacebar. Align (AL) is used to lock the unit against the wall.

**Screenshot:**
![Kitchen parametric family](file:///Users/jhoetter/Desktop/Revit%20Specs/0736_04-37-24.png)
_(Dining table family in furniture library project — kitchen-specific frames start beyond 0841)_

**bim-ai status:** ✅ Done — The residential starter template includes `Kitchen Slab Layout 3000x650`, a composite placed asset with width/depth/height parameters plus `sinkOffsetMm` and `fridgeOffsetMm`. It reuses the counter placement workflow, so it can be placed, Spacebar-rotated, copied, moved, aligned, and edited through right-rail instance parameters. The plan renderer draws cabinet bays plus embedded sink and refrigerator symbols, and the 3D proxy adds a countertop, sink basin, and refrigerator mass at the configured offsets. Selected instances now expose sink/fridge offset grips on canvas; dragging them patches `paramValues` through `updateElementProperty`.

---

## F-119 · Parametric bathroom layout family

**What it does:** A single family containing toilet, sink, and shower stall, all positioned relative to internal reference planes. The entire bathroom layout can be moved/rotated as one unit. Individual sub-elements (e.g., shower stall) can also have their position adjusted via instance parameters or drag handles.

**Screenshot:**
![Bathroom layout family](file:///Users/jhoetter/Desktop/Revit%20Specs/0574_03-45-08.png)
_(Chair placed in project floor plan — bathroom-layout-specific frames start beyond 0841)_

**bim-ai status:** ✅ Done — The residential starter template includes `Compact Bathroom Layout 2400x2200`, a composite placed asset with width/depth/height parameters plus `showerOffsetMm`, `toiletOffsetMm`, and `vanityOffsetMm`. It places and rotates as one family instance, exposes its offsets as instance parameters, and renders a coordinated toilet/vanity/shower layout in both plan and lightweight 3D proxy form. Selected instances now expose shower/toilet/vanity offset grips on canvas; dragging them patches `paramValues` through `updateElementProperty`.

---

## F-120 · Parametric bed family (2D)

**What it does:** A 2D bed family with width and length parameters (e.g., 1800×2000 mm). Can be placed, rotated, and resized via drag handles. Placing a bed and a wardrobe together and then grouping them (or copying both together) lets you furnish multiple bedrooms quickly.

**Screenshot:**
![Parametric bed family](file:///Users/jhoetter/Desktop/Revit%20Specs/0740_04-38-07.png)
_(Parametric table family in furniture library — bed-specific frames start beyond 0841)_

**bim-ai status:** ✅ Done — The residential starter template includes `Queen Bed 1800x2100` and `Single Bed 900x2000` assets with width/depth/height parameter schemas, searchable bedroom tags, explicit `planSymbolKind: 'bed'`, and recognizable pillows/mattress/headboard plan linework plus a lightweight 3D proxy. These can be placed, rotated by Spacebar / Rotate, edited through right-rail instance parameters, and resized in plan through on-canvas width/depth face grips backed by `paramValues`.

---

## F-121 · Align tool (AL) for furniture-to-wall alignment

**What it does:** Modify → Align (shortcut `AL`). Click the target alignment reference (e.g., a wall interior face), then click the element face to move it to align. Locks can be applied after alignment to maintain the relationship if the wall moves. Used here to snap kitchen counters and wardrobes flush against walls.

**Screenshot:**
![Align tool furniture](file:///Users/jhoetter/Desktop/Revit%20Specs/0465_02-49-25.png)
_(Align tool used in window family editor — furniture-align-specific frames start beyond 0841)_

**bim-ai status:** ✅ Done — The Align tool (hotkey `AL`) provides a two-click interactive workflow: first click sets the reference point, second click picks the nearest element and fires `alignElementToReference { targetElementId, referenceMm }`. It supports **walls** (translates along dominant axis so nearest endpoint coincides with reference), **columns** (snaps `position_mm` to reference along the closer axis), and **placed_assets**. Placed assets now align their nearest face, not just their center point, using the associated asset width/depth plus instance `paramValues` overrides. Backend accepts both `targetElementId` and legacy `targetWallId` via Pydantic `AliasChoices`. Dashed crosshair SVG overlay + status chip guide the workflow.

---

## F-122 · Rotate tool

**What it does:** Modify → Rotate lets users rotate a selected element around a user-defined center point. The rotation can be defined by clicking two rays (first ray = start angle, second ray = end angle) or by typing an angle numerically. The center of rotation defaults to the element's centroid but can be moved.

**Screenshot:**
![Rotate tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0575_03-45-10.png)
_(Spacebar rotation during component placement — rotate-tool-specific frames start beyond 0841)_

**bim-ai status:** ✅ Available — the general-purpose Rotate tool (`RO` hotkey) supports center pick, explicit start-angle reference ray, end-ray pick, typed numeric angle + Enter, snapped angle math, and rotation of wall, column, placed_asset, floor, room, and area selections. Column drag-handle grips and inspector rotation input remain available for direct edits.
