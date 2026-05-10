# Chapter 9 — Rooms & Areas

Source segment: `05:30:00 – 05:39:46`

---

## F-091 · Room Tool

**What it does:** Architecture → Room places a "Room" object inside a bounded enclosure of walls and/or room separation lines. Revit automatically calculates the area, perimeter, and volume. The Room element is tagged with a label (name + area by default). Room names are typed directly in the Properties palette or on the placed tag.

**Screenshot:**
![Room tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0751_05-30-00.png)

**bim-ai status:** ✅ — Single-click room placement is implemented via the `placeRoomAtPoint` command. A single click inside a closed wall enclosure fires `PlaceRoomAtPointCmd` to the backend, which calls `compute_room_boundary_derivation` to find all candidate bounding boxes and picks the smallest enclosing rectangle that contains the click point, then creates a `RoomElem` with that outline. Room label display is available via the plan view inspector's "Room Labels" checkbox (`symbology.ts` renders name + area sprites). **Limitation:** only axis-aligned rectangular enclosures are auto-detected (non-orthogonal rooms still require `createRoomOutline` with explicit vertex input).

---

## F-092 · Room Separation Lines

**What it does:** Architecture → Room Separation Line draws invisible boundary lines that define room boundaries where no wall exists (e.g., the imaginary line separating an open-plan living area from a dining area). They appear as thin annotation lines in plan views. They can be hidden via VG → Annotation Categories → Lines → Room Separation.

**Screenshot:**
![Room Separation Lines](file:///Users/jhoetter/Desktop/Revit%20Specs/0761_05-30-22.png)

**bim-ai status:** ✅ Implemented — `PlanCanvas.tsx` renders `<SketchCanvas elementKind="room_separation">` when `planTool === 'room-separation-sketch'`, providing the interactive sketch-mode draw equivalent. Room Separation sketches support Line, Rectangle, and Pick Walls modes using the shared `wallsForPicking` flow; the pick mode highlights walls, toggles picked walls through the sketch API, and exposes interior-face/centerline offset controls. Sketch validation, Tab issue cycling, and Auto-close are available before Finish. The backend sketch-session finish emitter handles `room_separation`, and `room_separation` appears under Annotations in VV for per-view visibility.

---

## F-093 · Room Interior Fill visibility (VG override)

**What it does:** In Visibility/Graphic Overrides → Model Categories → Rooms, unchecking "Interior Fill" removes the color fill from rooms in the current view without deleting the rooms themselves. This keeps the floor plan clean while retaining room area calculations and tags.

**Screenshot:**
![Room Interior Fill](file:///Users/jhoetter/Desktop/Revit%20Specs/0759_05-30-16.png)

**bim-ai status:** ✅ Available — the `room` model category in Visibility/Graphics Overrides (VV → Model tab) controls per-view room element visibility including interior fill. `InspectorPlanViewEditor` exposes a "Room Fill Opacity" slider (0–100%) that fires `updateElementProperty { key: 'planRoomFillOpacityScale', value }`, allowing opacity to be set to 0% to hide fills without deleting rooms. Room instances support by-element fill color and fill pattern overrides (`roomFillOverrideHex`, `roomFillPatternOverride`) through the inspector, backend validation, plan projection wire primitives, and both plan render paths. Reveal Hidden shows hidden room fills in magenta.

---

## F-094 · Area Boundary Lines

**What it does:** Architecture → Area Boundary (in the Room & Area panel) draws area boundary lines in a dedicated "Area Plan" view. Area boundary lines define gross building areas, net areas, rentable areas, etc. They are different from room separation lines and exist only in Area Plan views, not regular floor plan views.

**Screenshot:**
![Area Boundary Lines](file:///Users/jhoetter/Desktop/Revit%20Specs/0808_05-34-41.png)

**bim-ai status:** 🟡 Partial — the `area-boundary` sketch tool (hotkey AR, toolRegistry.ts) draws area boundary polylines on the plan canvas stored as `area` elements. The `area_boundary` annotation category appears in Visibility/Graphics Overrides (VV) and correctly controls rendering: toggling it off hides both the boundary polylines and the centroid label sprites in the plan canvas. Area boundaries are now restricted to dedicated Area Plan views and filtered by the active Area Plan scheme (F-098). Missing: auto-snap to wall faces for area boundary placement (Revit snaps to wall layers).

---

## F-095 · Area Tool

**What it does:** Architecture → Area (in the Room & Area panel) places an "Area" object inside a closed loop of area boundary lines. Revit calculates the enclosed area automatically. The Area has a "Name" instance parameter that appears on the area tag (e.g., "GF Built-Up Area").

**Screenshot:**
![Area tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0831_05-37-44.png)

**bim-ai status:** 🟡 Partial — the `area-boundary` sketch tool (hotkey AR) draws Area Plan polygons stored as `area` elements. Users can add arbitrary vertices and close the loop by clicking near the first point, pressing Enter, or double-clicking; Shift-click keeps the rectangular diagonal-corner shortcut. Vertices retain wall-face snap, active Area Plan scheme/rules are persisted, and the right-rail inspector shows computed area (m²), rule set (gross/net/no_rules), level, and boundary vertex count. Missing: Revit-style click-inside-existing-boundary placement.

---

## F-096 · Area and Volume Computations dialog

**What it does:** Architecture → Room & Area → Area and Volume Computations opens a project-level dialog with two controls:

1. **Volumes are computed at**: Finish Faces or Core Faces.
2. **Room Area Computation**: At wall finish, At wall centerline, At wall core layer, At wall core center.

This determines where area boundary lines snap relative to wall layers, affecting the calculated area values.

**Screenshot:**
![Area and Volume Computations](file:///Users/jhoetter/Desktop/Revit%20Specs/0829_05-37-09.png)

**bim-ai status:** ✅ Implemented — Area and Volume Computations settings are exposed as project-level fields on the `project_settings` element: "Volume Computed At" (Finish Faces / Core Faces) and "Room Area Computation Basis" (At Wall Finish / At Wall Centerline / At Wall Core Layer / At Wall Core Center) are editable in the right-rail inspector when the project settings element is selected. Both settings are also accessible from the area-boundary OptionsBar via the "⚙ Computations…" button, which opens an inline panel (`data-testid="area-computations-dialog"`) with both dropdowns. The backend derivation engine (`room_derivation.py`) reads `roomAreaComputationBasis` from `ProjectSettingsElem` and applies a wall-thickness inset offset to the derived room area bbox: `wall_finish` = 0 mm inset; `wall_centerline` / `wall_core_layer` / `wall_core_center` = half the average wall thickness on the level. The backend also consumes `volumeComputedAt`: `finish_faces` uses the derived finish-face footprint for `approxVolumeM3`, while `core_faces` applies the same half-average-thickness inset before multiplying by the level-to-next-level room height. The evidence fields `roomAreaComputationBasis`, `roomAreaInsetMm`, `volumeComputedAt`, `volumeAreaInsetMm`, and `approxVolumeM3` are surfaced on derived candidates.

---

## F-097 · Apply Area Rules toggle

**What it does:** When drawing area boundary lines, the "Apply Area Rules" checkbox in the Options Bar controls whether Revit snaps the boundary line to the wall face based on the Area and Volume Computations settings. Unchecking it lets you draw the line exactly where clicked, regardless of wall layers. Checking it causes lines to jump to the wall finish face automatically.

**Screenshot:**
![Apply Area Rules](file:///Users/jhoetter/Desktop/Revit%20Specs/0818_05-35-51.png)

**bim-ai status:** ✅ Done — The "Apply Area Rules" checkbox (`data-testid="options-bar-apply-area-rules"`) is now fully wired end-to-end. The flag is persisted on each `area` element as `applyAreaRules` (field `apply_area_rules: bool = Field(default=True, alias="applyAreaRules")` on `AreaElem`). The frontend passes the current store value in the `createArea` command payload. The backend `area_calculation.py` respects the flag: when `applyAreaRules=true`, the area polygon is inset according to the project-level `roomAreaComputationBasis` setting before computing `computedAreaSqMm`; when `applyAreaRules=false`, the boundary is used exactly as drawn (inset = 0 mm). Missing: full Minkowski polygon shrink (currently uses bbox approximation matching the existing room-derivation engine).

---

## F-098 · Area Plan (Gross Building) view type

**What it does:** Area plans are a special floor plan view type created specifically for area analysis. Each area scheme (Gross Building, Net, Rentable) has its own plan views. They are listed in the Project Browser separately from regular floor plans. Area boundary lines and area tags are only visible and editable in these dedicated views.

**Screenshot:**
![Area Plan view type](file:///Users/jhoetter/Desktop/Revit%20Specs/0837_05-38-35.png)

**bim-ai status:** ✅ Implemented — Area Plan views persist both `planViewSubtype: 'area_plan'` and `areaScheme` (`gross_building | net | rentable`) on backend `plan_view` elements, `upsertPlanView`, store coercion, schedules, and deterministic `planViewBrowserHierarchy_v0` evidence. The Project Browser has a dedicated Area Plans section grouped by Gross Building / Net / Rentable, and its creation workflow selects both the target level and area scheme before issuing `upsertPlanView`. The Inspector exposes the Area Plan scheme for plan views, and area elements carry/edit their own `areaScheme`. The `area-boundary` tool is now restricted to active Area Plan views, stamps created areas with the active view's scheme, and the plan canvas renders area boundaries/tags only inside matching Area Plan views.

---

## F-099 · Discipline property for views

**What it does:** In a view's Properties palette, the "Discipline" parameter can be changed (e.g., "Coordination" → "Architectural"). This moves the view to the corresponding folder in the Project Browser (organized by Discipline). Useful for keeping Area Plans under the Architectural discipline instead of Coordination.

**Screenshot:**
![View Discipline](file:///Users/jhoetter/Desktop/Revit%20Specs/0838_05-38-47.png)

**bim-ai status:** ✅ Implemented — plan views persist both `discipline` and `viewSubdiscipline`, editable via the right-rail `InspectorPlanViewEditor` dropdowns. The Project Browser groups floor plan views by discipline and nested sub-discipline (Architecture, Structural, MEP, Coordination), while existing discipline-lens behavior continues to read the discipline tag. Backend `upsertPlanView`, `updateElementProperty`, schedules, store coercion, and deterministic `planViewBrowserHierarchy_v0` evidence all round-trip the sub-discipline metadata.
