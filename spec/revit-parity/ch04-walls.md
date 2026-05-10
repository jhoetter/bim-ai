# Chapter 4 — Wall Tools

Source segment: `01:02:00 – 01:13:55`

---

## F-034 · Wall Tool (Architecture tab → Wall)

**What it does:** Activates wall placement mode. Walls are drawn by clicking start/end points (or using chain mode for continuous segments). The type selector in the Properties palette sets the wall type before drawing. Shortcut: `WA`.

**Screenshot:**
![Wall Tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0307_01-03-21.png)

**bim-ai status:** ✅ Done — `PlanCanvas.tsx` has a full interactive wall draw mode: click start → click end commits the wall, real-time preview line, snap to wall endpoints / midpoints / intersections / grid, chain mode (Shift+click), Space to flip, Tab to cycle through location lines, height in OptionsBar, type selector in OptionsBar. Same single-segment workflow as Revit's WA shortcut.

---

## F-035 · Wall Types (Type Selector)

**What it does:** Revit ships with many wall type families (Generic - 6", Generic - 8", Exterior - CMU on Mtl. Stud, layered walls with multiple material layers, etc.). Before drawing, the user selects a wall type from the "Type Selector" dropdown in the Properties palette. Each type has its own layer assembly, total thickness, and material assignments.

**Screenshot:**
![Wall Type Selector](file:///Users/jhoetter/Desktop/Revit%20Specs/0308_01-03-28.png)

**bim-ai status:** ✅ Available — `workspace/OptionsBar.tsx` now renders a "Type:" `<select>` dropdown when the wall tool is active, listing all `wall_type` elements from `elementsById`. The selected wall type ID is stored in `useBimStore.activeWallTypeId` and passed as `wallTypeId` to `createWall` in `PlanCanvas.tsx`. Missing from Revit: a rich type dialog with visual preview and built-in types library.

---

## F-036 · Edit Wall Assembly (layers / thickness)

**What it does:** In the wall's Type Properties dialog, clicking "Edit" next to "Structure" opens the "Edit Assembly" dialog. This dialog shows all layers in the wall cross-section (core, exterior finish, interior finish, membrane, etc.) with their material, thickness, function (Structure / Finish 1 / Substrate / etc.), and wrapping behavior. Individual layer thicknesses can be changed, and layers can be added or removed.

**Screenshot:**
![Edit Wall Assembly](file:///Users/jhoetter/Desktop/Revit%20Specs/0326_01-06-13.png)

**bim-ai status:** 🟡 Partial — `MaterialLayerStackWorkbench.tsx` supports multi-layer editing for `wall_type`, `floor_type`, and `roof_type` elements (material, thickness, function per layer), including row add/remove and up/down layer reordering before the `upsert*Type` command is applied. Missing: rich Edit Assembly dialog UX with wrapping behavior equivalent to Revit's modal.

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
_(Wall Properties palette showing height parameters — Top Offset-specific frame starts beyond 0841)_

**bim-ai status:** ✅ Available — `InspectorContent.tsx` (wall `case`) now shows editable "Base Offset (mm)" and "Top Offset (mm)" number inputs (step 50, `defaultValue` keyed by element ID). On blur they fire `onPropertyChange?.('baseConstraintOffsetMm', val)` and `onPropertyChange?.('topConstraintOffsetMm', val)`, which triggers `updateElementProperty` in `WorkspaceRightRail`. The backend `CreateWallCmd` and element model already carry these fields.

---

## F-040 · Wall Join Status (Allow / Disallow Join)

**What it does:** The Options Bar "Join Status" during wall placement (or right-click → Allow/Disallow Join on a placed wall) controls whether Revit automatically cleans up the intersection geometry where walls meet. When Disallow is set, two walls that overlap at an end point do not merge — they stay as separate, overlapping solids.

**Screenshot:**
![Wall Join Status](file:///Users/jhoetter/Desktop/Revit%20Specs/0354_01-11-28.png)

**bim-ai status:** ✅ Available — the `wall-join` plan tool in `PlanCanvas.tsx` allows clicking on a wall corner then pressing Enter to cycle through join variants (miter / butt / square) via `setWallJoinVariant { wallIds, variant }`. Per-endpoint Allow/Disallow join is available from the wall inspector and the endpoint right-click context menu; both fire `setWallJoinDisallow { wallId, endpoint, disallow }` and persist the flag in `WallElem.join_disallow_start` / `join_disallow_end`. Wall join evidence respects endpoint flags, and rendered wall cleanup/section mesh generation now gates butt/miter cleanup when either matching endpoint disallows joining.

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

**bim-ai status:** 🟡 Partial — the live wall Options Bar exposes a Radius toggle/input backed by `wallDrawRadiusMm`; chained wall placement in `PlanCanvas.tsx` uses `wallRadiusFillet.ts` to shorten the previous wall to the tangent point and insert short wall segments along the rounded corner. Missing: a native curved-wall element/arc baseline and rendered curved wall solids.

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

**bim-ai status:** ✅ Done — a `measure` plan tool (hotkey `ME`) is available in the tool palette. Two-click workflow: first click sets an anchor point, second click computes the distance between the two snapped points and displays a readout chip at the bottom of the canvas (format: `X.XXX m (N mm)`). No permanent element is created. Click × to dismiss or start a new measurement.

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

**bim-ai status:** ✅ Implemented — `TemporaryVisibilityChip.tsx` is mounted in `Workspace.tsx` and shows the active isolate/hide targets with one-click reset. `PlanCanvas.tsx` exposes a sunglasses trigger (`data-testid="temp-visibility-toggle"`) that opens category and element actions (`temp-isolate-category-toggle`, `temp-isolate-element-toggle`, `temp-hide-toggle`, `temp-hide-element-toggle`) when an element is selected. The client-only override is scoped to the active view and is cleared on view changes or explicit reset.
