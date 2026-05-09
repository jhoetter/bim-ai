# Chapter 9 — Rooms & Areas

Source segment: `05:30:00 – 05:39:46`

---

## F-091 · Room Tool

**What it does:** Architecture → Room places a "Room" object inside a bounded enclosure of walls and/or room separation lines. Revit automatically calculates the area, perimeter, and volume. The Room element is tagged with a label (name + area by default). Room names are typed directly in the Properties palette or on the placed tag.

**Screenshot:**
![Room tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0751_05-30-00.png)

**bim-ai status:** 🟡 Partial — the `room` tool is registered in `toolRegistry.ts` and `PlanCanvas.tsx` has click-to-place logic (vertex accumulation via `planTool === 'room'`). The backend derivation engine (`room_derivation.py`) calculates area and perimeter. Room label display in the plan view is now available via the plan view inspector's "Room Labels" checkbox (fires `planShowRoomLabels`; `symbology.ts` renders name + area sprites when enabled). Missing: automatic snap-to-enclosed-boundary like Revit (Revit places by single click inside a closed loop; bim-ai requires explicit vertex input).

---

## F-092 · Room Separation Lines

**What it does:** Architecture → Room Separation Line draws invisible boundary lines that define room boundaries where no wall exists (e.g., the imaginary line separating an open-plan living area from a dining area). They appear as thin annotation lines in plan views. They can be hidden via VG → Annotation Categories → Lines → Room Separation.

**Screenshot:**
![Room Separation Lines](file:///Users/jhoetter/Desktop/Revit%20Specs/0761_05-30-22.png)

**bim-ai status:** 🟡 Partial — `PlanCanvas.tsx` (line 3599) renders `<SketchCanvas elementKind="room_separation">` when `planTool === 'room-separation-sketch'`, providing the interactive sketch-mode draw equivalent. The backend sketch-session finish emitter handles `room_separation` kind. `room_separation` was added to the VVDialog annotation tab — the category now appears under Annotations in VV and can be toggled per-view. Missing: form-based workflow and pick-walls shortcut equivalent to Revit's single-click inside a closed loop placement.

---

## F-093 · Room Interior Fill visibility (VG override)

**What it does:** In Visibility/Graphic Overrides → Model Categories → Rooms, unchecking "Interior Fill" removes the color fill from rooms in the current view without deleting the rooms themselves. This keeps the floor plan clean while retaining room area calculations and tags.

**Screenshot:**
![Room Interior Fill](file:///Users/jhoetter/Desktop/Revit%20Specs/0759_05-30-16.png)

**bim-ai status:** 🟡 Partial — the `room` model category in Visibility/Graphics Overrides (VV → Model tab) controls per-view room element visibility including interior fill. Users can toggle rooms on/off per view. Additionally, `InspectorPlanViewEditor` exposes a "Room Fill Opacity" slider (0–100%) that fires `updateElementProperty { key: 'planRoomFillOpacityScale', value }`, allowing opacity to be set to 0% to hide fills without deleting rooms. Missing: separate fill color/pattern override column distinct from wall cut patterns (Revit exposes surface foreground/background pattern per category); no per-room-instance color override equivalent to Revit's "Override Graphics in View → By Element"; no magenta "Reveal Hidden" mode.

---

## F-094 · Area Boundary Lines

**What it does:** Architecture → Area Boundary (in the Room & Area panel) draws area boundary lines in a dedicated "Area Plan" view. Area boundary lines define gross building areas, net areas, rentable areas, etc. They are different from room separation lines and exist only in Area Plan views, not regular floor plan views.

**Screenshot:**
![Area Boundary Lines](file:///Users/jhoetter/Desktop/Revit%20Specs/0808_05-34-41.png)

**bim-ai status:** 🟡 Partial — the `area-boundary` sketch tool (hotkey AR, toolRegistry.ts) draws area boundary polylines on the plan canvas stored as `area` elements. The `area_boundary` annotation category appears in Visibility/Graphics Overrides (VV) and now correctly controls rendering: toggling it off hides both the boundary polylines and the centroid label sprites in the plan canvas (`PlanCanvas.tsx` gates the KRN-08 area rendering block on `!display.hiddenSemanticKinds.has('area_boundary')`; `planProjection.ts` maps the VV label via `canonHiddenCategory`). Missing: auto-snap to wall faces for area boundary placement (Revit snaps to wall layers), and separate Area Plan view type (F-098).

---

## F-095 · Area Tool

**What it does:** Architecture → Area (in the Room & Area panel) places an "Area" object inside a closed loop of area boundary lines. Revit calculates the enclosed area automatically. The Area has a "Name" instance parameter that appears on the area tag (e.g., "GF Built-Up Area").

**Screenshot:**
![Area tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0831_05-37-44.png)

**bim-ai status:** 🟡 Partial — the `area-boundary` sketch tool (hotkey AR) draws area boundary polylines stored as `area` elements. The right-rail inspector shows computed area (m²), rule set (gross/net/no_rules), level, and boundary vertex count. Missing: auto-snap to closed boundary loop like Revit, VG per-view area visibility toggle, and Area and Volume Computations dialog (F-096).

---

## F-096 · Area and Volume Computations dialog

**What it does:** Architecture → Room & Area → Area and Volume Computations opens a project-level dialog with two controls:
1. **Volumes are computed at**: Finish Faces or Core Faces.
2. **Room Area Computation**: At wall finish, At wall centerline, At wall core layer, At wall core center.

This determines where area boundary lines snap relative to wall layers, affecting the calculated area values.

**Screenshot:**
![Area and Volume Computations](file:///Users/jhoetter/Desktop/Revit%20Specs/0829_05-37-09.png)

**bim-ai status:** 🟡 Partial — Area and Volume Computations settings are exposed as project-level fields on the `project_settings` element: "Volume Computed At" (Finish Faces / Core Faces) and "Room Area Computation Basis" (At Wall Finish / At Wall Centerline / At Wall Core Layer / At Wall Core Center) are editable in the right-rail inspector when the project settings element is selected. Missing: a dedicated modal dialog (Revit uses a standalone dialog opened from Architecture → Room & Area); the backend derivation engine does not yet consume these settings to adjust area/volume calculations.

---

## F-097 · Apply Area Rules toggle

**What it does:** When drawing area boundary lines, the "Apply Area Rules" checkbox in the Options Bar controls whether Revit snaps the boundary line to the wall face based on the Area and Volume Computations settings. Unchecking it lets you draw the line exactly where clicked, regardless of wall layers. Checking it causes lines to jump to the wall finish face automatically.

**Screenshot:**
![Apply Area Rules](file:///Users/jhoetter/Desktop/Revit%20Specs/0818_05-35-51.png)

**bim-ai status:** 🟡 Partial — An "Apply Area Rules" checkbox (`data-testid="options-bar-apply-area-rules"`) appears in the OptionsBar when the `area-boundary` tool is active, storing the value in `useBimStore.applyAreaRules` (default `true`). Missing: the backend area derivation engine does not yet consume this flag to snap boundary lines to wall faces; the toggle is UI-only at this point.

---

## F-098 · Area Plan (Gross Building) view type

**What it does:** Area plans are a special floor plan view type created specifically for area analysis. Each area scheme (Gross Building, Net, Rentable) has its own plan views. They are listed in the Project Browser separately from regular floor plans. Area boundary lines and area tags are only visible and editable in these dedicated views.

**Screenshot:**
![Area Plan view type](file:///Users/jhoetter/Desktop/Revit%20Specs/0837_05-38-35.png)

**bim-ai status:** 🟡 Partial — Area Plan views are now a distinct `planViewSubtype: 'area_plan'` on `plan_view` elements. They appear in a dedicated "Area Plans" section in the Project Browser (separate from "Floor Plans"), and the discipline inspector dropdown includes "Area Plan" as a type option. Missing: automatic Area Plan creation from Architecture → Room & Area → Area Plan workflow; the area-boundary tool is not auto-restricted to area plan views; no separate area-scheme (Gross Building / Net / Rentable) grouping within the Area Plans section.

---

## F-099 · Discipline property for views

**What it does:** In a view's Properties palette, the "Discipline" parameter can be changed (e.g., "Coordination" → "Architectural"). This moves the view to the corresponding folder in the Project Browser (organized by Discipline). Useful for keeping Area Plans under the Architectural discipline instead of Coordination.

**Screenshot:**
![View Discipline](file:///Users/jhoetter/Desktop/Revit%20Specs/0838_05-38-47.png)

**bim-ai status:** 🟡 Partial — plan views have a `discipline` field (arch | struct | mep) editable via the right-rail inspector's "Discipline" dropdown in `InspectorPlanViewEditor`. Changing discipline affects the discipline-lens ghost pass in the plan canvas. Missing: automatic view grouping in the Project Browser by discipline subdiscipline tree (F-032), and Revit's Architectural/Structural/Coordination sub-discipline names (bim-ai uses arch/struct/mep tags).
