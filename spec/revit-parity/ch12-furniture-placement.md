# Chapter 12 — Furniture Placement Workflow

Source segment: `08:35:57 – 09:57:57`

This chapter covers the practical workflow of furnishing a completed floor plan using the parametric 2D family library built in earlier chapters.

---

## F-114 · Placing component families in a project

**What it does:** Loaded families appear in the Component tool or can be accessed via the Type Selector. When the cursor enters a plan view, a preview of the family follows the cursor. Clicking places an instance. Pressing Spacebar rotates the family 90° each press before placement. Pressing Esc twice exits placement mode.

**Screenshot:**
![Placing families](file:///Users/jhoetter/Desktop/Revit%20Specs/0737_04-37-46.png)

**bim-ai status:** ❌ Not available — bim-ai has no interactive component placement tool with live preview and snap.

---

## F-115 · Spacebar rotation during placement

**What it does:** While hovering before clicking to place a component, pressing Spacebar rotates the element by 90°. Multiple presses cycle through 0°, 90°, 180°, 270°. For walls, Spacebar flips interior/exterior orientation. This is the fastest way to orient furniture to fit a room without a separate Rotate command.

**Screenshot:**
![Spacebar rotation](file:///Users/jhoetter/Desktop/Revit%20Specs/0575_03-45-10.png)

**bim-ai status:** ❌ Not available.

---

## F-116 · Copy (CO) tool

**What it does:** Modify → Copy (shortcut `CO`) copies selected elements to a new location specified by clicking a source point and destination point. When "Multiple" is checked in the Options Bar, you can place multiple copies in sequence without re-activating the tool.

**Screenshot:**
![Copy tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0685_03-55-42.png)

**bim-ai status:** 🟡 Partial — Ctrl+C copies selected elements to an in-session clipboard (`copyPaste.ts` + `clipboardStore`); Ctrl+V pastes them with a small offset. This provides the core copy-to-clipboard workflow but without a two-point interactive Copy command (click source → click destination). Missing: multi-copy (Revit's "Multiple" option), two-point placement, persistence of clipboard across page reload, and copy to a different level.

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

**bim-ai status:** ❌ Not available — bim-ai has no interactive two-click align + optional lock.

---

## F-122 · Rotate tool

**What it does:** Modify → Rotate lets users rotate a selected element around a user-defined center point. The rotation can be defined by clicking two rays (first ray = start angle, second ray = end angle) or by typing an angle numerically. The center of rotation defaults to the element's centroid but can be moved.

**Screenshot:**
![Rotate tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0575_03-45-10.png)
*(Spacebar rotation during component placement — rotate-tool-specific frames start beyond 0841)*

**bim-ai status:** ❌ Not available — bim-ai supports some rotation via drag handles but not a precise Rotate-about-point command.
