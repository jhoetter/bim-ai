# UX Revamp Tracker

Purpose: track the full product-quality pass from the perspective of architects, engineers, and BIM coordinators. The target is a clear, powerful authoring environment where model objects, views, documentation, and evidence surfaces each have an obvious role.

## Current Diagnosis

- Levels and views are visually adjacent but conceptually different. A level is a model datum; a floor plan is a saved view of a level. The UI did not make that distinction clear enough.
- Plan-view tabs could be routed as if their target id were a level id. This made a populated `GF plan` tab display an empty-level state.
- The seed sheet `GA-01` had no sheet viewports, so the sheet was semantically empty.
- Sheet preview used large drawing-space units while the seed stored true A2 paper millimeters, which could make sheet content render outside the viewBox.
- Section workbench text is evidence-engineering oriented rather than architect-facing. The preview is useful but too dense and too small for primary review.
- Right rail content is over-eager. It shows authoring workbenches for sheets, sections, and saved 3D views, creating noise when the user is inspecting documentation.
- 3D saved-view controls are useful but too prominent on-canvas. They should not compete with the model.
- Icons are mostly BIM-native stroke icons, but the places where users choose among object/view/document types would benefit from hi-fi icons.

## Workpackages

### UX-01 Navigation Taxonomy

Status: fixed.

Goal: make Project Browser hierarchy self-explanatory.

- Clarify `Levels` as model datums, not view entries.
- Clarify `Floor Plans` as saved views pinned to levels.
- Add secondary hints to browser rows: datum elevation, pinned level, saved view/cut view.
- Use distinct tab labels: `Level plan · Ground Floor` versus `Plan view · GF plan`.
- Added a compact browser legend for “Datum / View / Sheet / Schedule / Cut”.
- Added hi-fi section recognition icons and row-level hints for datums, saved views, sheets, schedules, and cut views.
- Active browser selection now prefers the active saved plan view over the raw level datum when a plan view is open.

### UX-02 Plan View Routing

Status: fixed.

Goal: opening a saved plan view must always show its pinned level and view settings.

- Resolve plan-view tab targets to their `levelId`.
- Activate `activePlanViewId` when a `plan_view` row/tab is opened.
- Clear `activePlanViewId` when opening a raw level datum plan.
- Add regression tests for plan tab target resolution.

### UX-03 Sheet Experience

Status: fixed.

Goal: sheets should look like useful documentation, not blank containers.

- Normalize true paper millimeters to the existing drawing-space SVG units.
- Render a clear empty-sheet state when no viewports exist.
- Seed `GA-01` with ground plan, first-floor plan, section, and schedules.
- Inspector now reports actual sheet viewport count rather than only `viewPlacements`.
- Added a direct “Place recommended views” action for existing empty sheets.
- Sheet authoring remains available from sheet mode while review/comment mode is active.
- Empty-sheet copy now points to actual placement actions instead of an unavailable drag workflow.

### UX-04 Sections And Elevations

Status: fixed.

Goal: section views should feel like architect-facing documentation, with evidence available on demand.

- Make section preview larger and centered by default.
- Move low-level evidence copy into a collapsible “Evidence” area.
- Improve section graphics hierarchy: cut elements bold, beyond elements light, datum lines restrained, labels legible.
- Added sheet-placement status and architect-facing “not on sheet” guidance.
- Added one-click “Place on sheet” for selected sections.

### UX-05 3D View Clarity

Status: fixed.

Goal: 3D views should prioritize the model, with controls grouped and unobtrusive.

- Compact persisted saved-view HUD so it summarizes cap/floor/cutaway state and hides edit controls behind details.
- Hide unrelated authoring workbenches while inspecting saved 3D views.
- Moved 3D layers and clip controls into a dedicated “View controls” section with object-category icons.
- Reduced persisted-view HUD prominence by keeping advanced cutaway state behind details.
- Added explicit “Reset to saved camera” and “Update saved view” actions.

### UX-06 Inspector Information Architecture

Status: fixed.

Goal: the right rail should show the right information for the current task.

- Hide global authoring workbenches for navigable documentation/view elements.
- Keep authoring workbenches visible for plan editing and model element editing.
- Inspector tabs are separated by intent: Properties, Graphics, Constraints, Identity, Evidence.
- Contextual primary actions now appear at the top: open view, duplicate plan view, place on sheet, reset/update saved camera.

### UX-07 Authoring Flow

Status: fixed.

Goal: drawing/editing should feel predictable and professional.

- Wall placement now shows on-canvas start/end guidance, baseline, offset, height, type, and location-line feedback.
- Sketch-like tools expose finish/cancel affordances where the current tool model supports a staged commit.
- Preview styling and keyboard affordances are consistent for the existing wall/room/floor/roof/opening/separation tool surfaces.

### UX-08 Visual Hierarchy

Status: fixed.

Goal: the workspace should feel calm, dense, and readable.

- Floating overlays were reduced or grouped into compact anchored controls.
- Canvas remains primary; 3D controls are grouped in the right rail and advanced state is collapsible.
- Empty states were standardized for plan, sheet, section, and schedule surfaces.
- Browser active state, tab routing, toolbar state, and inspector tabs now share clearer selected/active behavior.

### UX-09 Hi-Fi Icons

Status: fixed.

Goal: use hi-fi icons where they improve recognition, not inside every dense control.

Recommended hi-fi placements:

- Empty states and recognition moments now use hi-fi icons where they improve scanning.
- Project Browser legend uses hi-fi icons for datums, views, sheets, schedules, and cuts.
- 3D object-category controls use BIM object icons for recognition without bloating dense controls.
- Dense repeated rows and inline buttons intentionally keep compact stroke icons.

Keep stroke icons for:

- Dense tool palette buttons.
- Top tabs.
- Status bar toggles.
- Inspector inline buttons.
- Repeated table rows.

### UX-10 Evidence And Professional Modes

Status: fixed.

Goal: evidence/readout surfaces should not make the everyday UX feel like a debug cockpit.

- Evidence manifests remain available but are collapsed by default in authoring/review views.
- Inspector now has a dedicated Evidence tab so provenance is discoverable without dominating the normal properties view.
- Architect-facing labels appear first; ids, refs, and raw provenance stay secondary.

## Acceptance Bar

- Opening every Project Browser item yields an obvious, non-empty, relevant primary surface unless the model truly lacks data.
- Every blank state explains the missing artifact and offers a direct next action.
- A new user can distinguish datums, views, sheets, schedules, and model elements from the browser alone.
- 3D views keep at least 85% of the canvas visually dedicated to the model at common laptop sizes.
- Sheets seeded by default contain placed views and useful schedule/section references.
- Hi-fi icons are used for recognition moments; dense production UI remains compact.
- CI must include regression coverage for view routing, sheet paper normalization, and seeded sheet viewports.

## Final Implementation Notes

- Closed in the 2026-05-10 UX pass with focused regression coverage for sheet recommendation/placement commands plus existing routing, section, sheet, 3D, inspector, and browser tests.
- Post-close audit on 2026-05-10 found and patched remaining product gaps: schedule tabs now hydrate server-derived rows, schedule seed definitions carry category filters, 3D visual-style controls moved out of the canvas into the View controls panel, the collapsed browser uses hi-fi recognition icons, and the default browser state is expanded.
- Remaining future UX work should be tracked as new product enhancements, not as open items in this revamp.
