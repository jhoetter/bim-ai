# Chapter 4 — Wall Tools

Source segment: `01:02:00 – 01:13:55`

---

## F-034 · Wall Tool (Architecture tab → Wall)

**What it does:** Activates wall placement mode. Walls are drawn by clicking start/end points (or using chain mode for continuous segments). The type selector in the Properties palette sets the wall type before drawing. Shortcut: `WA`.

**Screenshot:**
![Wall Tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0307_01-03-21.png)

**bim-ai status:** 🟡 Partial — bim-ai supports wall placement via the engine and API, but the interactive draw-by-click workflow with real-time snapping and preview is limited.

---

## F-035 · Wall Types (Type Selector)

**What it does:** Revit ships with many wall type families (Generic - 6", Generic - 8", Exterior - CMU on Mtl. Stud, layered walls with multiple material layers, etc.). Before drawing, the user selects a wall type from the "Type Selector" dropdown in the Properties palette. Each type has its own layer assembly, total thickness, and material assignments.

**Screenshot:**
![Wall Type Selector](file:///Users/jhoetter/Desktop/Revit%20Specs/0308_01-03-28.png)

**bim-ai status:** 🟡 Partial — bim-ai has wall type data structures but no rich type-selector UI with a library of pre-built types.

---

## F-036 · Edit Wall Assembly (layers / thickness)

**What it does:** In the wall's Type Properties dialog, clicking "Edit" next to "Structure" opens the "Edit Assembly" dialog. This dialog shows all layers in the wall cross-section (core, exterior finish, interior finish, membrane, etc.) with their material, thickness, function (Structure / Finish 1 / Substrate / etc.), and wrapping behavior. Individual layer thicknesses can be changed, and layers can be added or removed.

**Screenshot:**
![Edit Wall Assembly](file:///Users/jhoetter/Desktop/Revit%20Specs/0326_01-06-13.png)

**bim-ai status:** 🟡 Partial — `MaterialLayerStackWorkbench.tsx` supports multi-layer editing for `wall_type`, `floor_type`, and `roof_type` elements (material, thickness, function per layer). Missing: rich Edit Assembly dialog UX with wrapping behavior and layer reordering equivalent to Revit's modal.

---

## F-037 · Wall Location Line

**What it does:** The Options Bar "Location Line" dropdown controls which face or centerline of the wall is aligned to the cursor when drawing:
- Wall Centerline
- Core Centerline
- Finish Face: Exterior
- Finish Face: Interior
- Core Face: Exterior
- Core Face: Interior

For layered walls this distinction matters significantly — the core can sit 50mm inward from the exterior finish.

**Screenshot:**
![Wall Location Line](file:///Users/jhoetter/Desktop/Revit%20Specs/0315_01-04-44.png)

**bim-ai status:** ✅ Available — `OptionsBar.tsx` renders a "Location line" dropdown with all six options (Wall Centerline, Core Centerline, Finish Face: Exterior, Finish Face: Interior, Core Face: Exterior, Core Face: Interior) whenever the wall tool is active.

---

## F-038 · Wall Height / Top Constraint

**What it does:** In the Options Bar, "Height" sets the top of the wall. Options: a specific named level (e.g., "FF Slab Top"), or "Unconnected" with a manual height value. The Properties palette simultaneously shows "Top Constraint" and "Unconnected Height". When a level is selected, the wall top follows that level if the level moves.

**Screenshot:**
![Wall Height Constraint](file:///Users/jhoetter/Desktop/Revit%20Specs/0314_01-04-37.png)

**bim-ai status:** ✅ Available — `workspace/OptionsBar.tsx` has a Height number input (step 100, min 100, testid `options-bar-wall-height`); `store.ts` holds `wallDrawHeightMm` (default 2800); `PlanCanvas.tsx` reads the value and passes `heightMm` to `createWall`. `AppShell.tsx` renders the OptionsBar alongside the ToolModifierBar.

---

## F-039 · Wall Top Offset / Bottom Offset

**What it does:** Instance parameters in the Properties palette that shift the top or bottom of a wall by a positive or negative value relative to the constraint level. Example: setting Top Offset to -6" drops the wall top 6 inches below the slab level so it sits below the floor deck.

**Screenshot:**
![Top Offset](file:///Users/jhoetter/Desktop/Revit%20Specs/0314_01-04-37.png)
*(Wall Properties palette showing height parameters — Top Offset-specific frame starts beyond 0841)*

**bim-ai status:** ❌ Not available.

---

## F-040 · Wall Join Status (Allow / Disallow Join)

**What it does:** The Options Bar "Join Status" during wall placement (or right-click → Allow/Disallow Join on a placed wall) controls whether Revit automatically cleans up the intersection geometry where walls meet. When Disallow is set, two walls that overlap at an end point do not merge — they stay as separate, overlapping solids.

**Screenshot:**
![Wall Join Status](file:///Users/jhoetter/Desktop/Revit%20Specs/0354_01-11-28.png)

**bim-ai status:** 🟡 Partial — bim-ai has `wall_join_evidence.py` suggesting join logic exists in the engine, but there is no user-facing Allow/Disallow control.

---

## F-041 · Wall drawing options: Chain mode

**What it does:** When "Chain" is checked in the Options Bar, each wall segment end point becomes the start point of the next segment automatically — you draw a continuous polyline of connected walls. When unchecked, each click pair draws one wall and returns to idle.

**Screenshot:**
![Chain mode](file:///Users/jhoetter/Desktop/Revit%20Specs/0362_01-13-28.png)

**bim-ai status:** ✅ Available — `toolGrammar.ts` declares `TOOL_CAPABILITIES.wall.chainable = true`; `OptionsBar.tsx` shows the Chain checkbox when the wall tool is active; `PlanCanvas.tsx` maintains a `chainAnchor` that automatically seeds the next segment's start point.

---

## F-042 · Wall drawing options: Offset

**What it does:** Setting a value in the Options Bar "Offset" field draws the wall offset from the cursor position by that distance. Useful for placing interior walls at a specific distance from a reference without needing to draw a reference line first.

**Screenshot:**
![Wall Offset option](file:///Users/jhoetter/Desktop/Revit%20Specs/0359_01-12-40.png)

**bim-ai status:** ✅ Available — `workspace/OptionsBar.tsx` has a wall offset input connected via `useBimStore`; `store.ts` holds `wallDrawOffsetMm` (default 0); `PlanCanvas.tsx` reads the value and computes a perpendicular shift of both start and end points before calling `createWall`.

---

## F-043 · Wall drawing options: Radius (curved corners)

**What it does:** Checking "Radius" in the Options Bar and entering a value causes the connection between two consecutive wall segments to be a curved arc instead of a sharp corner. The radius can be typed numerically.

**Screenshot:**
![Wall Radius option](file:///Users/jhoetter/Desktop/Revit%20Specs/0358_01-12-28.png)

**bim-ai status:** ❌ Not available.

---

## F-044 · Spacebar to flip wall orientation while drawing

**What it does:** Pressing Spacebar while placing a wall flips which side of the location line is "interior" versus "exterior". This affects the wall's opening direction symbols, door/window placement relative to the wall face, and which face wraps finish layers.

**Screenshot:**
![Spacebar flip](file:///Users/jhoetter/Desktop/Revit%20Specs/0360_01-13-01.png)

**bim-ai status:** ✅ Available — `PlanCanvas.tsx` handles Space key during wall drawing: when a start anchor is placed (`draftRef.current?.kind === 'wall'`), pressing Space toggles `wallFlipRef` (swapping start/end on commit) and skips the pan action. The flip resets after each wall commit and when the tool is deselected.

---

## F-045 · Measure Between Two References tool

**What it does:** Quick Access Toolbar → Measure Between Two References (or Review tab). Click two points or faces to get a temporary measurement readout. Does not place a permanent dimension. Used here to read existing DWG wall thicknesses before creating matching Revit wall types.

**Screenshot:**
![Measure tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0346_01-10-08.png)

**bim-ai status:** ❌ Not available.

---

## F-046 · Wall Type renaming

**What it does:** After editing a wall type, the instructor renames it (e.g., from "Generic - 8"" to "Generic - 200 mm or 7 7/8"") so future users can identify it by material and exact dimension. Done via Edit Type → Rename button at the top of the Type Properties dialog.

**Screenshot:**
![Wall Type Rename](file:///Users/jhoetter/Desktop/Revit%20Specs/0328_01-06-32.png)

**bim-ai status:** ✅ Available — `WorkspaceLeftRail.tsx` wires `onRowRename` on `<LeftRail>`: pressing F2 on a focused wall_type, floor_type, or roof_type row opens a centered overlay with an auto-focused input. Enter/blur commits via `updateElementProperty { key: 'name' }`; Escape cancels.

---

## F-047 · Temporary Hide / Isolate (sunglasses icon)

**What it does:** Bottom bar sunglasses icon opens a menu: Isolate Category, Isolate Element, Hide Category, Hide Element. This temporarily (only for the current view session) hides or shows only selected elements without creating permanent view overrides. "Reset Temporary Hide/Isolate" (double-click glasses) restores normal visibility.

**Screenshot:**
![Temporary Hide Isolate](file:///Users/jhoetter/Desktop/Revit%20Specs/0370_01-50-13.png)

**bim-ai status:** ✅ Available — `TemporaryVisibilityChip.tsx` implements the VIE-04 status-bar chip with isolate and hide modes; the store exposes `setTemporaryVisibility` / `clearTemporaryVisibility`. The chip renders "Isolate: <categories>" or "Hide: <categories>" and resets on click (equivalent to Revit's "Reset Temporary Hide/Isolate").
