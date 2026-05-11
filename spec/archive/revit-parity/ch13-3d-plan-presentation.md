# Chapter 13 — 3D Plan Presentation Overlays

Source segment: external YouTube short reference supplied 2026-05-11.

---

## F-123 · 3D floor-plan overlay / exploded plan reference

**What it does:** A floor plan view can be presented as a flat 2D drawing plane hovering above the matching 3D storey/model, with the plan footprint aligned to the model's X/Y axes and elevation. The key purpose is bidirectional comprehension: users can see how the 2D floor plan translates into the 3D model below, and how the 3D rooms, walls, openings, furniture, stairs, and circulation relate back to the plan drawing above. As the user orbits the 3D camera, both the 3D model and the suspended plan plane rotate together in the same world coordinate system, making the plan-to-model relationship spatially legible. Dashed vertical witness lines connect plan corners or key extents down to the model for orientation.

This is best treated as a presentation/coordination view rather than a primary modeling tool. Revit has related native concepts such as level datums, plan views, 3D orbiting, underlays in plan views, and displaced/exploded presentation views, but the exact screenshot pattern appears to be a composed presentation effect: a 2D plan graphic or plan-derived plane placed above a 3D cutaway/isometric model. It should not be assumed to be a single default Revit command that automatically shows any floor plan inside every 3D view.

**Screenshot:**
User-supplied screenshots in chat, 2026-05-11: YouTube short showing an Autodesk Revit model with a 2D floor plan hovering above a 3D floor-plan model and rotating in sync with the 3D camera.

**bim-ai status:** ✅ Available — orbit 3D viewpoints now persist `planOverlay*` metadata, the saved 3D view HUD exposes Plan Overlay controls, and `Viewport.tsx` renders the selected `plan_view` as a non-pickable world-space overlay above the registered 3D model. The overlay includes plan sheet/fill opacity, wall/room/opening/stair/asset linework, room labels where canvas text is available, and dashed witness lines down to the source level.

**Specification:**

- Add a 3D view display option named `Plan Overlay` or `Exploded Plan Reference`.
- The option is available in 3D and plan+3D contexts when the model has at least one `plan_view` tied to a level.
- The user can choose the source plan view from a dropdown, defaulting to the active or nearest level plan.
- Render the selected plan as a horizontal world-space plane above the model, using the plan view's crop, scale, visibility/graphics, line weights, room labels, furniture symbols, dimensions, and annotation categories where supported.
- Position the overlay at `sourceLevelElevation + overlayOffsetMm`, with a default offset high enough to clear the visible storey. The offset is editable in millimeters/meters.
- Keep the overlay locked to model coordinates: orbiting, panning, zooming, switching projection mode, or using the ViewCube must transform the overlay with the same camera as the model.
- Preserve plan-to-model registration precisely enough that a room, wall, door/window opening, stair run, or furniture symbol in the overlay visually lines up with the corresponding 3D element below.
- Add optional dashed vertical witness lines from overlay extents/key corners to the corresponding model extents below. Witness lines are view-only helpers and do not create model elements.
- Provide toggles for overlay opacity, line opacity, fill/room color opacity, annotation visibility, and witness-line visibility.
- Overlay hit-testing is disabled by default so it does not block selecting 3D walls, floors, furniture, or openings. A separate "Select overlay annotations" mode can be added later if annotation editing in 3D becomes a goal.
- Persist the overlay settings on the saved 3D viewpoint, not globally on the source plan view, so different 3D presentation views can show different levels, offsets, opacity, and witness-line settings.
- Export/capture workflows should include the overlay in screenshots, evidence captures, and presentation images, but model serialization must keep it as view metadata rather than building geometry.

**Acceptance criteria:**

- Opening a 3D viewpoint and enabling Plan Overlay shows a plan-derived plane above the 3D model with the same building orientation.
- Orbiting with Shift+middle mouse, dragging, ViewCube face clicks, zooming, and panning keeps the overlay visually registered with the 3D model.
- A user can visually trace at least rooms, walls, openings, stairs, and furniture from the overlay to their matching 3D geometry without a manual offset/alignment step.
- Changing the source plan view swaps the overlay without changing the active model level or deleting the previous plan view.
- Changing overlay offset moves only the overlay/witness-line endpoints, not model geometry.
- Selecting 3D model elements through or below the overlay still works when overlay hit-testing is disabled.
- Saved viewpoints restore the selected source plan, offset, opacity, and witness-line settings after reload.
