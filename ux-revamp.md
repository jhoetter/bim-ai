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
- Follow-up audit found the 3D right rail could collapse whenever no element was selected, leaving view controls either unavailable or visually disconnected from the canvas. 3D needs persistent view context even with empty selection.

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

## Continuation Audit - Product-Quality UX

Verdict: the revamp is directionally right, but not yet at the "best possible" bar. The product now has the right large surfaces - project browser, tabs, canvas, inspector, sheets, schedules, and 3D saved views - but several interactions still feel like exposed implementation controls rather than a calm BIM authoring workflow. This section is the backlog for the next UX pass and should stay open until the app feels obvious without explanation.

### UX-11 3D Editing And View Controls

Status: in progress.

Goal: 3D should feel like a professional model review and editing workspace, not a debug viewer.

- Keep the ViewCube purely about orientation: front/back/left/right/top/base and drag-to-orbit. It must not carry visual-style or display-state controls.
- Put visual style where users naturally look: right rail `View controls > Graphics`.
- Replace text-only visual-style controls with preview icons for Shaded, Consistent Colors, Wireframe, and Hidden Line.
- Make Section Box, Walk, Orthographic/Perspective, Fit, Reset Camera, and Saved View state available from a coherent view-control surface. Today some of these still live on-canvas because their state is local to the viewport.
- Use icon+tooltip controls for canvas commands, but keep mode names visible in the right rail.
- Add a small active-view summary near the right rail header: visual style, projection, section box, hidden categories.
- Make 3D edit affordances explicit: select element, edit grips, right-click actions, and escape/cancel should be discoverable without reading shortcuts.
- Avoid bottom-left clusters that look like temporary developer controls.
- Add e2e coverage for switching visual style, toggling section box, and selecting a saved 3D view without blanking the canvas.

Implementation notes:

- Added visual previews for 3D graphics modes in the right rail.
- Added background swatches and an explicit edge on/off control so graphics settings no longer look like raw form fields.
- Moved projection and section-box state into shared viewport UI state so the right rail can own those controls cleanly.
- Kept the right rail open for 3D and split plan/3D tabs even without a selected element, so graphics, projection, section-box, and camera controls stay discoverable where users expect them.
- Derived visible shell mode from the active tab so persisted/open views cannot leave the top bar, palette, canvas, and right rail describing different modes.
- Added a focused regression for no-selection 3D tabs to guard against view controls becoming hidden behind inspector-only collapse logic.
- Moved walk mode, fit, reset, projection, and section-box activation into the right-rail View controls panel; the canvas no longer carries the bottom-left developer-looking control stack.
- Added an active 3D view summary for graphics style, projection, section-box state, and hidden category count.
- Walk mode now uses shared viewport UI state, with pointer-lock activation handled by the 3D viewport and Esc/pointer-lock loss writing back to the same state.

### UX-12 Icon System Completion

Status: open.

Goal: icons should explain concepts faster than text, without turning dense production UI into illustration.

Icons still worth adding or promoting:

- Visual style icons: shaded cube, colored category blocks, wireframe cube, hidden-line drawing.
- Projection icons: perspective frustum, orthographic cube.
- Camera actions: fit to model, reset camera, orbit, pan, walk mode.
- View-state icons: section box, cut plane cap, floor clip, hidden category, isolated selection.
- Documentation icons: placed-on-sheet, not-on-sheet, schedule row/table, viewport crop.
- Editing icons: align to wall face, host opening, move endpoint, split wall, trim/extend, rotate around point.
- Review icons: comment pin, unresolved issue, evidence link, changed since saved view.

Placement rules:

- Use hi-fi icons for recognition moments: empty states, browser collapsed rail, creation palettes, and mode landing states.
- Use stroke icons for dense repeated controls: rows, tabs, compact inspector buttons, table cells.
- Use preview thumbnails rather than abstract icons when the user is choosing a visual result, such as graphics style or background.
- Do not put display-mode icons into the 3D axis/ViewCube.

### UX-13 Project Browser And Left Sidebar

Status: open.

Goal: the browser should be the user's mental model of the BIM file.

- Keep expanded browser as the default on desktop; collapsed rail is useful but should not be the first-run state.
- Make collapsed rail icons visually distinctive and BIM-native.
- Add active-section indication in the collapsed rail so users can tell where they are without expanding.
- Add counts and health hints where helpful: schedules with row count, sheets with viewport count, views with pinned level, sections with placed/not placed status.
- Search should preserve context: matches should show parent section and not look like unrelated flat rows.
- Context menus should expose natural actions per item: open, rename, duplicate view, place on sheet, create schedule, reveal in canvas.
- Avoid mixing datums and saved views without secondary labels.

### UX-14 Inspector And Right Rail

Status: open.

Goal: the right rail should answer "what is selected, what can I do, what matters now?"

- Make contextual primary actions visually stronger than metadata.
- Keep raw ids, provenance, constraints, and evidence secondary or collapsed.
- For views and sheets, show view/document actions before generic properties.
- For model elements, show geometry/type/host/level before raw identity.
- Add compact empty-selection guidance that changes by mode: plan editing, 3D review, sheet review, schedules.
- Make global authoring workbenches feel separate from selected-element properties.
- Reduce uppercase micro-headings where they create noise; use compact but readable labels.

### UX-15 Plan Editing

Status: open.

Goal: plan editing should feel precise and reversible.

- Tool palette should separate Draw, Modify, Annotate, and Review.
- Active tool needs a persistent, obvious state in the toolbar and status bar.
- On-canvas previews should show start point, current point, length, angle, offset, level, and type where relevant.
- Snaps should be visible only when useful; avoid constant glyph noise.
- Finish/cancel affordances should be consistent across wall, room, floor, roof, opening, separation, and annotation flows.
- Provide local undo feedback for staged edits before server persistence.
- Add natural right-click actions for selected plan elements.

### UX-16 Schedules

Status: in progress.

Goal: schedules should feel like live BIM data, not generic tables.

- Schedule tabs should open the exact schedule selected in the Project Browser or tab strip.
- Derived rows should hydrate from the backend and show loading/error/empty states.
- Columns should have human labels, stable widths, sticky headers, and readable numeric formatting.
- Row count, grouping count, category, and filters should be visible without overwhelming the table.
- Add sorting/filtering affordances once backend table derivation exposes stable sort contracts.
- Add direct actions: open selected element in canvas, place schedule on sheet, duplicate schedule.
- Empty schedules should explain whether there are no matching elements or whether the model is unavailable.

Implementation notes:

- Schedule hydration is now implemented for saved models.
- Remaining work: row selection, sort/filter UI, and sheet-placement actions from the schedule surface.

### UX-17 Sheets And Documentation

Status: open.

Goal: sheets should feel like printable deliverables.

- Sheet surface should prioritize paper, title block, placed views, schedules, and review pins.
- Placement controls should be direct: place recommended views, place selected view, replace viewport, align viewport, resize crop.
- Sheet empty state should never be a dead end.
- Viewport labels/detail numbers should be readable at normal zoom.
- Review/comment mode should feel layered on top of documentation, not mixed into authoring tools.
- Add visual status for unsheeted sections/elevations/schedules.

### UX-18 Sections And Elevations

Status: open.

Goal: sections/elevations should be useful drawings first, evidence views second.

- Improve line hierarchy further: cut, beyond, hidden, datum, annotation.
- Add scale/crop controls in terms architects expect.
- Show whether the section is placed on a sheet and where.
- Add quick actions: place on sheet, duplicate, rename, update crop, open source marker.
- Keep evidence available but collapsed.

### UX-19 Top Bar, Tabs, And Global Navigation

Status: open.

Goal: global chrome should orient users without stealing space.

- Tabs should clearly distinguish plan, 3D, sheet, schedule, section, and raw level datum.
- Long tab labels should truncate gracefully but preserve type and target name.
- Top bar should not become a parking lot for mode-specific controls.
- Share/search/collaboration controls should stay consistent and visually quiet.
- Command palette should mirror visible actions and use the same labels/icons.

### UX-20 Empty, Loading, Error, And Offline States

Status: open.

Goal: every non-happy state should tell the user what happened and what to do next.

- Empty plan: distinguish no elements on level vs no saved plan view vs filtered-out categories.
- Empty sheet: offer direct placement actions.
- Empty schedule: identify category/filter reason.
- Offline state: explain what still works locally and what is queued.
- Loading states should use stable skeletons or compact status rows, not layout-shifting text.
- Errors should include recovery actions where possible.

### UX-21 Accessibility And Keyboard Flow

Status: open.

Goal: expert workflows should be fast and accessible.

- Every icon-only button must have a useful accessible name and hover title.
- Focus order should follow left rail -> top tabs -> canvas -> right rail -> status.
- Keyboard shortcuts should appear in contextual hints, not as permanent instructional clutter.
- Escape should consistently cancel transient modes and close overlays.
- Tree navigation in the browser should remain robust after filtering.
- Color should not be the only signal for active/hidden/error states.

### UX-22 Visual QA Gates

Status: open.

Goal: CI should protect the UX from regressions, not only type correctness.

- Add Playwright screenshots for plan, 3D, sheet, schedule, section, collapsed browser, expanded browser, inspector selection, and empty states.
- Add canvas pixel checks for nonblank 3D and sheet rendering.
- Add viewport-size checks for laptop, wide desktop, and mobile/tablet breakpoints.
- Add assertions that text does not overlap key controls in common viewports.
- Track golden screenshots only for stable shell surfaces; dynamic model canvas should use semantic and pixel-health checks.
