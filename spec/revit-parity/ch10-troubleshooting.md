# Chapter 10 — Troubleshooting & Modeling Fixes

Source segment: `05:30:54 – 05:33:32`

---

## F-100 · Filter tool (multi-select type filtering)

**What it does:** When multiple elements of different categories are selected (e.g., a wall and a CAD file via Ctrl+Click), the "Filter" button appears in the Modify tab. Clicking it opens a dialog listing all selected categories with checkboxes. Unchecking a category removes those elements from the selection. This lets you drill down to just the walls or just the floors within a large selection without restarting.

**Screenshot:**
![Filter tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0777_05-31-45.png)

**bim-ai status:** 🟡 Partial — Ctrl+Click multi-select now builds an additional selection set (`selectedIds` in the store). The count is shown as a chip at the bottom of the plan canvas. Clicking "Filter" opens a popover listing the categories in the selection with checkboxes; unchecking a category removes those element IDs from the selection. Delete and Ctrl+C now act on the full `selectedIds` set. Box-select (drag marquee) now works for walls, columns, placed_assets, floors, rooms, and areas — all collected IDs are pushed into `selectedIds` via `toggleSelectedId`. Missing: Tab to add connected elements to multi-select.

---

## F-101 · Isolate Category (Temporary Hide/Isolate)

**What it does:** With one or more elements selected, clicking the Temporary Hide/Isolate icon (sunglasses) → "Isolate Category" hides all elements NOT in the same category as the selected elements. The view canvas shows only that category. This is a per-session temporary state — it resets when "Reset Temporary Hide/Isolate" is clicked or the view is closed without applying.

**Screenshot:**
![Isolate Category](file:///Users/jhoetter/Desktop/Revit%20Specs/0778_05-31-49.png)

**bim-ai status:** 🟡 Partial — `TemporaryVisibilityChip.tsx` is mounted in `Workspace.tsx` and renders the active isolate/hide label with one-click reset. `PlanCanvas.tsx` provides both a "👓 Isolate" button (`data-testid="temp-visibility-toggle"`) and "👁 Hide" button (`data-testid="temp-hide-toggle"`) when an element is selected — matching Revit's "Isolate Category" and "Hide Category" modes. Missing: per-element isolate/hide (Revit's "Isolate Element" / "Hide Element" sub-menu); Revit's unified sunglasses pop-up menu (bim-ai uses two separate buttons).

---

## F-102 · Hide Category (permanent, view-specific)

**What it does:** With an element selected, the Modify ribbon shows a "Hide Category" button. This permanently hides the entire category in the current view (via a view-level visibility override). Unlike Temporary Hide/Isolate, this persists between sessions. "Reveal Hidden Elements" mode (lightbulb) shows it in magenta for unhiding.

**Screenshot:**
![Hide Category](file:///Users/jhoetter/Desktop/Revit%20Specs/0762_05-30-26.png)

**bim-ai status:** ✅ Done — `VVDialog.tsx` provides permanent per-view category visibility overrides (stored in `plan_view.categoriesHidden`). Element inspectors now have both a **Hide Element in View** button (`data-testid="inspector-hide-element"`) that hides the individual element via `hiddenElementIds` on the `plan_view` element, and a **Hide Category in View** button (`data-testid="inspector-hide-category"`) that hides all elements of the selected category via `setCategoryOverride`. `TemporaryVisibilityChip.tsx` additionally supports a temporary hide mode (`mode: 'hide'`) for in-session use. Reveal Hidden mode (lightbulb) shows per-element hidden elements in magenta; right-clicking them in reveal mode shows an **Unhide Element** menu item (`data-testid="unhide-context-element"`) that calls `unhideElementInView`, plus the existing **Unhide in View: [category]** option. Backend: `HideElementInViewCmd` / `UnhideElementInViewCmd` persist to `plan_view.hiddenElementIds[]`.

---

## F-103 · Move tool (MV) for alignment corrections

**What it does:** Modify → Move (shortcut `MV`) moves selected elements by specifying a start point and end point (or by typing a distance + direction). Used here to move a misaligned wall so its face exactly aligns with the corresponding CAD drawing line. Supports orthogonal constraints (hold Shift) and snap-to-point.

**Screenshot:**
![Move tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0792_05-32-45.png)

**bim-ai status:** 🟡 Partial (better) — walls can be moved via grip handles + inspector Δx/Δy section. `placed_asset` elements can be moved via a Δx/Δy section in the right-rail inspector (fires `moveAssetDelta`). `column` elements can now be moved via a Δx/Δy section in the right-rail inspector (fires `moveColumnDelta`). Two-point MV Move tool now available in the Modify palette (shortcut `MV`): first click sets the reference point, second click places the selection at the destination delta — supports walls, columns, placed_assets, floors, rooms, and areas via `moveElementsDelta` command. Missing: typed numeric distance entry, orthogonal Shift-constraint during move.

---

## F-104 · Tab key for chain-selection

**What it does:** Pressing Tab while hovering over an element highlights the next connected element in the chain (e.g., the next wall in a loop, or the next face). Pressing Tab repeatedly cycles through overlapping elements. Clicking selects the highlighted element. This is critical for selecting floors and slabs where multiple elements overlap.

**Screenshot:**
![Tab selection](file:///Users/jhoetter/Desktop/Revit%20Specs/0776_05-31-38.png)
*(Tab+Ctrl multi-select scenario — slab-specific Tab chain frames start beyond 0841)*

**bim-ai status:** 🟡 Partial — `snapTabCycle.ts` (EDT-05) implements Tab-key cycling through snap candidates (endpoint → intersection → perpendicular → extension → parallel → tangent → workplane → grid → raw). Tab now also cycles to the next endpoint-connected wall in select mode (single-element chain walk): when a wall is selected and Tab is pressed, the selection advances to the next wall sharing the same endpoint (≤10 mm tolerance), with round-robin cycling at junctions. Missing: bulk multi-select of an entire wall loop in one Tab sequence.

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
