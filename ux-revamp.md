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

Status: in progress.

Goal: make Project Browser hierarchy self-explanatory.

- Clarify `Levels` as model datums, not view entries.
- Clarify `Floor Plans` as saved views pinned to levels.
- Add secondary hints to browser rows: datum elevation, pinned level, saved view/cut view.
- Use distinct tab labels: `Level plan · Ground Floor` versus `Plan view · GF plan`.
- Next: add a compact browser legend or hover help for “Datum / View / Sheet / Schedule” without adding permanent instructional text.

### UX-02 Plan View Routing

Status: fixed.

Goal: opening a saved plan view must always show its pinned level and view settings.

- Resolve plan-view tab targets to their `levelId`.
- Activate `activePlanViewId` when a `plan_view` row/tab is opened.
- Clear `activePlanViewId` when opening a raw level datum plan.
- Add regression tests for plan tab target resolution.

### UX-03 Sheet Experience

Status: fixed for seed/rendering baseline; further authoring polish remains.

Goal: sheets should look like useful documentation, not blank containers.

- Normalize true paper millimeters to the existing drawing-space SVG units.
- Render a clear empty-sheet state when no viewports exist.
- Seed `GA-01` with ground plan, first-floor plan, section, and schedules.
- Inspector now reports actual sheet viewport count rather than only `viewPlacements`.
- Next: add a direct “Place recommended views” action for existing empty sheets.
- Next: make viewport authoring available from sheet mode even when review comments are enabled.

### UX-04 Sections And Elevations

Status: partially fixed.

Goal: section views should feel like architect-facing documentation, with evidence available on demand.

- Make section preview larger and centered by default.
- Move low-level evidence copy into a collapsible “Evidence” area.
- Improve section graphics hierarchy: cut elements bold, beyond elements light, datum lines restrained, labels legible.
- Add sheet-placement status: “not on sheet” / “placed on GA-01”.
- Add one-click “Place on sheet” for selected section.

### UX-05 3D View Clarity

Status: partially fixed.

Goal: 3D views should prioritize the model, with controls grouped and unobtrusive.

- Compact persisted saved-view HUD so it summarizes cap/floor/cutaway state and hides edit controls behind details.
- Hide unrelated authoring workbenches while inspecting saved 3D views.
- Next: move 3D layers/clip controls into a dedicated “View controls” section with object-category icons.
- Next: reduce visual competition between view cube, floating tool palette, bottom hints, and persisted-view HUD.
- Next: add “Reset to saved camera” and “Update saved view from current camera” as explicit actions.

### UX-06 Inspector Information Architecture

Status: partially fixed.

Goal: the right rail should show the right information for the current task.

- Hide global authoring workbenches for navigable documentation/view elements.
- Keep authoring workbenches visible for plan editing and model element editing.
- Next: separate inspector tabs by intent: Properties, Graphics, Constraints, Identity, Evidence.
- Next: show contextual primary actions at the top, e.g. open view, place on sheet, update view, duplicate view.

### UX-07 Authoring Flow

Status: tracked.

Goal: drawing/editing should feel predictable and professional.

- Continue validating wall baseline, offset, height, type, and location-line behavior.
- Add on-canvas wall option feedback during placement.
- Add explicit finish/cancel controls for sketch-like tools.
- Add consistent preview styling for walls, rooms, floors, roofs, openings, and room separations.
- Add keyboard affordance consistency for Tab cycling, Escape cancel, Enter commit.

### UX-08 Visual Hierarchy

Status: tracked.

Goal: the workspace should feel calm, dense, and readable.

- Audit all floating overlays and reduce competing panels.
- Keep canvas primary; controls should be compact, anchored, and dismissible.
- Standardize empty states across plan, sheet, section, schedule, and 3D.
- Standardize selected/active styling across browser rows, tabs, toolbars, and inspector tabs.
- Improve contrast of disabled/inactive tabs and dense labels.

### UX-09 Hi-Fi Icons

Status: tracked.

Goal: use hi-fi icons where they improve recognition, not inside every dense control.

Recommended hi-fi placements:

- Empty states: wall, plan view, section, sheet, schedule, 3D view.
- Project Browser section headers in expanded/comfortable density.
- Add-view popover and project creation/template flows.
- Family/type pickers where users distinguish doors, windows, stairs, railings, wall types, roof types.
- Tool onboarding and command palette result previews.

Keep stroke icons for:

- Dense tool palette buttons.
- Top tabs.
- Status bar toggles.
- Inspector inline buttons.
- Repeated table rows.

### UX-10 Evidence And Professional Modes

Status: tracked.

Goal: evidence/readout surfaces should not make the everyday UX feel like a debug cockpit.

- Keep evidence manifests available but collapsed by default in authoring views.
- Expose “Why am I seeing this?” provenance only where decisions need trust.
- Add a reviewer/evidence workspace for dense manifest details.
- Keep architect-facing labels first; ids and normalized refs second.

## Acceptance Bar

- Opening every Project Browser item yields an obvious, non-empty, relevant primary surface unless the model truly lacks data.
- Every blank state explains the missing artifact and offers a direct next action.
- A new user can distinguish datums, views, sheets, schedules, and model elements from the browser alone.
- 3D views keep at least 85% of the canvas visually dedicated to the model at common laptop sizes.
- Sheets seeded by default contain placed views and useful schedule/section references.
- Hi-fi icons are used for recognition moments; dense production UI remains compact.
- CI must include regression coverage for view routing, sheet paper normalization, and seeded sheet viewports.
