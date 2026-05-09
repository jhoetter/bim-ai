# Chapter 10 — Troubleshooting & Modeling Fixes

Source segment: `05:30:54 – 05:33:32`

---

## F-100 · Filter tool (multi-select type filtering)

**What it does:** When multiple elements of different categories are selected (e.g., a wall and a CAD file via Ctrl+Click), the "Filter" button appears in the Modify tab. Clicking it opens a dialog listing all selected categories with checkboxes. Unchecking a category removes those elements from the selection. This lets you drill down to just the walls or just the floors within a large selection without restarting.

**Screenshot:**
![Filter tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0777_05-31-45.png)

**bim-ai status:** ❌ Not available.

---

## F-101 · Isolate Category (Temporary Hide/Isolate)

**What it does:** With one or more elements selected, clicking the Temporary Hide/Isolate icon (sunglasses) → "Isolate Category" hides all elements NOT in the same category as the selected elements. The view canvas shows only that category. This is a per-session temporary state — it resets when "Reset Temporary Hide/Isolate" is clicked or the view is closed without applying.

**Screenshot:**
![Isolate Category](file:///Users/jhoetter/Desktop/Revit%20Specs/0778_05-31-49.png)

**bim-ai status:** 🟡 Partial — `TemporaryVisibilityChip.tsx` is mounted in `Workspace.tsx` and renders the active isolate/hide label with one-click reset. `PlanCanvas.tsx` provides a "👓 Isolate" button (`data-testid="temp-visibility-toggle"`) that fires `setTemporaryVisibility({ mode: 'isolate', categories: [selectedElement.kind] })` when an element is selected — matching the "Isolate Category" intent. Missing: Revit's per-element isolate (only the whole category is isolated), and no "Hide Category" mode from the button.

---

## F-102 · Hide Category (permanent, view-specific)

**What it does:** With an element selected, the Modify ribbon shows a "Hide Category" button. This permanently hides the entire category in the current view (via a view-level visibility override). Unlike Temporary Hide/Isolate, this persists between sessions. "Reveal Hidden Elements" mode (lightbulb) shows it in magenta for unhiding.

**Screenshot:**
![Hide Category](file:///Users/jhoetter/Desktop/Revit%20Specs/0762_05-30-26.png)

**bim-ai status:** 🟡 Partial — `VVDialog.tsx` provides permanent per-view category visibility overrides stored in `plan_view.categoriesHidden`, which persist between sessions — covering the core of Revit's "Hide in View → Category" behavior. `TemporaryVisibilityChip.tsx` additionally supports a temporary hide mode (`mode: 'hide'`) for in-session use. The "Reveal Hidden Elements" lightbulb mode (F-014) now shows all VG-hidden categories in magenta (#ff00ff at 55% opacity) in the plan canvas. Remaining gap vs Revit: no dedicated "Hide in View" right-click shortcut on selected elements; no per-element "Unhide in View" contextual action while in reveal mode.

---

## F-103 · Move tool (MV) for alignment corrections

**What it does:** Modify → Move (shortcut `MV`) moves selected elements by specifying a start point and end point (or by typing a distance + direction). Used here to move a misaligned wall so its face exactly aligns with the corresponding CAD drawing line. Supports orthogonal constraints (hold Shift) and snap-to-point.

**Screenshot:**
![Move tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0792_05-32-45.png)

**bim-ai status:** 🟡 Partial — walls can be moved via: (1) grip drag handles in the plan canvas (endpoint and midpoint grips fire `moveWallEndpoints` / `moveWallDelta`); (2) a "Move (mm)" Δx/Δy input section in the wall inspector (right rail) — enter a delta in mm and click Apply to fire `moveWallDelta { dxMm, dyMm }`. Missing: two-point on-canvas Move command with typed distance, and move support for non-wall elements (floors, rooms, etc.).

---

## F-104 · Tab key for chain-selection

**What it does:** Pressing Tab while hovering over an element highlights the next connected element in the chain (e.g., the next wall in a loop, or the next face). Pressing Tab repeatedly cycles through overlapping elements. Clicking selects the highlighted element. This is critical for selecting floors and slabs where multiple elements overlap.

**Screenshot:**
![Tab selection](file:///Users/jhoetter/Desktop/Revit%20Specs/0776_05-31-38.png)
*(Tab+Ctrl multi-select scenario — slab-specific Tab chain frames start beyond 0841)*

**bim-ai status:** 🟡 Partial — `snapTabCycle.ts` (EDT-05) implements Tab-key cycling through snap candidates (endpoint → intersection → perpendicular → extension → parallel → tangent → workplane → grid → raw). Missing: the Revit chain-selection behavior where Tab highlights the next connected element in a wall loop for bulk selection.

---

## F-105 · Split Element (SL)

**What it does:** Modify → Split Element (shortcut `SL`) splits a wall, line, or floor edge at a clicked point into two separate segments. Used here to split a floor boundary line so part of it can be extended to a new edge while the other part stays in place. Can split at a point (with or without gap).

**Screenshot:**
![Split Element](file:///Users/jhoetter/Desktop/Revit%20Specs/0821_05-36-11.png)
*(Line trimming in area boundary sketch — Split Element-specific frame starts beyond 0841)*

**bim-ai status:** ✅ Available — `PlanCanvas.tsx` handles `planTool === 'split'`: on click, `reduceSplit` state machine fires `splitWallAt { wallId, alongT }` against the nearest wall within 900 mm (if `alongT` is between 0.001 and 0.999, ensuring a non-endpoint split). Backend `SplitWallAtCmd` (line 1596 of `commands.py`) persists the operation.

---

## F-106 · Aligned Dimension for cross-checking model accuracy

**What it does:** The Aligned Dimension tool (shortcut `DI`) is used temporarily to verify that a wall face or floor edge is exactly coincident with a CAD reference line. The measured value should read 0 (or the expected tolerance). The dimension is then deleted — it was only used for verification.

**Screenshot:**
![Dimension for verification](file:///Users/jhoetter/Desktop/Revit%20Specs/0782_05-32-05.png)

**bim-ai status:** ✅ Available — `PlanCanvas.tsx` handles `planTool === 'dimension'` with two-click placement: first click sets the start anchor, second click fires `createDimension { levelId, aMm, bMm, offsetMm }` which persists permanently. `planElementMeshBuilders.ts` renders stored dimensions as line-segment geometry; `symbology.ts` draws the text label and extension lines. Missing from Revit parity: picking dimension references from wall faces/edges (bim-ai uses raw world-point pairs).
