# Chapter 11 — Floors, Slabs & Parapet Walls

Source segment: `05:34:19 – 06:41:32` (+ `08:35:57 – 09:57:57` for final 3D model checks)

---

## F-107 · Floor Tool & Edit Boundary

**What it does:** Architecture → Floor → Floor Architectural opens a sketch mode where you draw (or pick) the boundary of the floor slab as a closed loop. Clicking "Finish Edit Mode" (green checkmark) generates the 3D floor solid. Later, selecting the floor and clicking "Edit Boundary" in the Modify ribbon re-enters sketch mode to change the slab outline (add, delete, or move edges).

**Screenshot:**
![Floor Edit Boundary](file:///Users/jhoetter/Desktop/Revit%20Specs/0580_03-45-40.png)
_(Nearest available screenshot — floor/masking sketch mode context; floor-specific export frames start beyond 0841)_

**bim-ai status:** ✅ Done — the `floor-sketch` tool (hotkey `Shift+F`) renders a full `SketchCanvas` overlay with vertex accumulation, wall-snap picking, auto-close detection, and Finish ✓ / Cancel ✗ controls equivalent to Revit's Edit Boundary modal. Backend creates the floor element on Finish. Wall-snap picking and vertex editing cover the tracked slab outline authoring and edit-boundary workflow.

---

## F-108 · Floor type selection

**What it does:** Like walls, floors have types with defined layer assemblies (e.g., "Concrete 6"", "Floor Tile - 2'×2'"). The type is chosen in the Properties palette before drawing or changed via "Edit Type" after selection.

**Screenshot:**
![Floor type](file:///Users/jhoetter/Desktop/Revit%20Specs/0780_05-31-55.png)

**bim-ai status:** ✅ Available — Two surfaces: (1) `workspace/OptionsBar.tsx` renders a "Type:" `<select>` when the floor tool is active, listing all `floor_type` elements; the selection is stored in `useBimStore.activeFloorTypeId` and passed via `SketchCanvas.floorTypeId` → `finishSketchSession opts.options.floorTypeId` → the Python emitter (which already handles `floorTypeId` in opts at line 267 of `sketch_session.py`). (2) The wall inspector already had a floor type selector when a floor element is selected (in `InspectorContent.tsx` `case 'floor':`).

---

## F-109 · Parapet walls (Unconnected Height mode)

**What it does:** Parapet walls are modeled as standard basic walls with "Top Constraint" set to "Unconnected" and a specific "Unconnected Height" (e.g., 3 feet / ~900 mm). The "Location Line" is set to "Finish Face: Interior" so the wall aligns to the interior edge of the roof slab. Chain mode allows drawing the full parapet perimeter in one continuous stroke.

**Screenshot:**
![Parapet walls](file:///Users/jhoetter/Desktop/Revit%20Specs/0310_01-03-58.png)
_(Wall-type and height configuration context; parapet-specific frames start beyond 0841)_

**bim-ai status:** ✅ Done — parapet walls are modeled with the standard wall tool using the OptionsBar controls: set "Location Line" to "Finish Face: Interior" and set "Height" to the desired unconnected height (e.g., 900 mm). Chain mode allows drawing the full parapet perimeter in one continuous stroke. This matches the Revit workflow exactly — Revit also uses standard walls for parapets, not a dedicated parapet tool.

---

## F-110 · Wall Top Offset (negative value for sub-slab placement)

**What it does:** Selecting all perimeter walls and setting "Top Offset" to -6" (or -150 mm) in the Properties palette drops the wall tops 6 inches below the level they are constrained to. This ensures walls sit below the floor slab rather than poking through it, which is correct structural behavior.

**Screenshot:**
![Wall Top Offset](file:///Users/jhoetter/Desktop/Revit%20Specs/0314_01-04-37.png)
_(Wall Properties palette showing height constraints; Top Offset-specific frame is beyond 0841)_

**bim-ai status:** ✅ Available — `InspectorContent.tsx` (wall `case`) now has editable "Base Offset (mm)" and "Top Offset (mm)" fields supporting negative values (step 50). Negative base offset (e.g. −200) moves the wall base below the level datum, enabling the sub-slab placement pattern shown in Revit.

---

## F-111 · 3D View rotation (Shift + Middle Click)

**What it does:** In any 3D view, holding Shift and clicking + dragging with the middle mouse button orbits the camera around the model's centroid. Wheel scrolls zoom in/out. Middle mouse button alone pans the 3D view. This is the primary 3D navigation in Revit.

**Screenshot:**
![3D View rotation](file:///Users/jhoetter/Desktop/Revit%20Specs/0029_00-00-51.png)
_(3D house model — rotation-specific frame is beyond 0841)_

**bim-ai status:** ✅ Available — `viewport/cameraRig.ts` `classifyPointer` now returns `'orbit'` when Shift+MMB is pressed (before the default MMB→pan fallthrough). This matches Revit's Shift+middle-click orbit convention. LMB drag and RMB drag also orbit; MMB alone pans; scroll wheel zooms.

---

## F-112 · Default 3D View (isometric)

**What it does:** The Quick Access Toolbar "3D View" button opens (or switches to) the default {3D} perspective/isometric view. This view auto-generates when a project is created and shows the full building from a 3/4 isometric angle. It resets to fit all when double-clicked on the ViewCube home icon.

**Screenshot:**
![Default 3D View](file:///Users/jhoetter/Desktop/Revit%20Specs/0064_00-04-27.png)

**bim-ai status:** ✅ Available — The 3D canvas supports orbit, pan, zoom, face-snap ViewCube, and H/Home reset. `Viewport.tsx` auto-loads the `vp-main-iso` preset when the 3D view opens. `ProjectBrowser.tsx` lists all `viewpoint` elements. A "3D" button (`data-testid="topbar-3d-view"`) is now present in the TopBar right section — clicking it opens a new 3D view tab directly, matching the QAT "3D View" shortcut.

---

## F-113 · Graphic Display Options (bottom bar)

**What it does:** The bottom bar of any view has a "Graphic Display Options" button that opens an expanded dialog beyond the simple Visual Style dropdown. Controls include: Silhouette edges (width), depth cue (near/far), photographic exposure, shadows, ambient occlusion, background (sky, gradient, solid color). Changing visual style is also accessible here.

**Screenshot:**
![Graphic Display Options](file:///Users/jhoetter/Desktop/Revit%20Specs/0342_01-09-37.png)

**bim-ai status:** ✅ Available — A "Graphic Display Options" toggle button (`data-testid="viewport-gdo-toggle"`) in the 3D viewport bottom bar opens a panel with Visual Style (Shaded / Consistent Colors / Wireframe / Hidden Line / Realistic / Ray Trace), Background, model edges, shadows, ambient occlusion, depth cue, silhouette/model edge width, and photographic exposure EV. The renderer honors these settings with material switching, ray-trace-style shadow maps, SSAO, fog-based depth cue, edge/outline thickness, and tone-mapping exposure. Saved orbit viewpoints expose and read back the GDO fields.
