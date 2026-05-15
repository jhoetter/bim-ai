# ViewCube Revit-Parity Tracker

Last updated: 2026-05-14

Purpose: define the work required for bim-ai's ViewCube to feel effectively identical to Revit's ViewCube: visually stable, smooth, directly manipulable, 26-view aware, synced with the 3D camera, and reliable enough to be a primary navigation control.

## References

- Autodesk Research paper: [ViewCube: A 3D Orientation Indicator and Controller](https://www.research.autodesk.com/app/uploads/2023/03/viewcube-a-3d-orientation.pdf_recsg8BsEjf1BeIbZ.pdf)
- Autodesk Revit help: [About the ViewCube](https://help.autodesk.com/cloudhelp/2022/ENU/Revit-DocumentPresent/files/GUID-787A15B5-773E-4385-A765-7889D1C64475.htm)
- Autodesk Revit help: [ViewCube Menu](https://help.autodesk.com/cloudhelp/2022/ENU/Revit-DocumentPresent/files/GUID-70CCCB83-EE47-4108-A6B1-E583377A4F59.htm)
- Autodesk Revit help: [Control ViewCube Appearance and Compass](https://help.autodesk.com/cloudhelp/2019/ENU/RevitLT-DocumentPresent/files/GUID-FB3DE1A8-91CE-4D22-927F-5EC4318CA47B.htm)
- AcadGraph Revit 2024 note: [Die "versteckten" Möglichkeiten des ViewCubes](https://support.acadgraph.de/help/de-de/65-revit/836-revit-2024-die-versteckten-moglichkeiten-des-viewcubes)

## Status Legend

- `Open`: no accepted implementation.
- `In Progress`: partial implementation exists, but acceptance is not complete.
- `Blocked`: needs product or technical decision.
- `Done`: implemented, tested, and visually verified against this tracker.

Priority:

- `P0`: required before ViewCube can be trusted as navigation.
- `P1`: required for Revit-like parity.
- `P2`: polish or extension after core parity.

## Research Conclusions

The current implementation path is wrong for full parity. Incremental SVG patches cannot get us to the Revit feel because the widget is trying to approximate a 3D object with ad hoc 2D geometry, separate transparent hit regions, and labels that are neither fully 2D UI nor true face labels.

The Autodesk paper and Revit docs imply these product mechanics:

1. The ViewCube is both an orientation indicator and an orientation controller. It must rotate continuously with the scene when the user orbits outside the cube, and it must drive the scene when dragged.
2. It exposes 26 standard views: 6 faces, 12 edges, 8 corners.
3. Face, edge, and corner pieces are effectively buttons. Hover feedback must highlight exactly the piece that will be selected.
4. Dragging is not secondary polish; Autodesk's study found drag/ArcBall-style interaction was the fastest and preferred method. Clicking exists for discoverability and novice use.
5. Dragging should include snap-and-go behavior near fixed viewpoints, with a visible cue when the camera is exactly at a fixed view.
6. Clicked view changes must animate, not teleport, because the transition preserves spatial orientation.
7. Boundary zones can be expanded beyond the cube to make nearby face views easier to acquire.
8. When the cube is face-on, Revit-style/Autodesk-style controls include roll and adjacent-face affordances.
9. The compass is optional and North-specific. It should not visually compete with the cube. When shown, it is interactive: cardinal letters/ring rotate the model around the pivot.
10. Revit's context menu is part of the ViewCube product surface: Home, save/set home, projection mode, set/reset front, show compass, orient to view/direction/plane, options.
11. The AcadGraph article highlights an important Revit-specific workflow: right-click ViewCube -> Orient to View can transfer plan/section/3D view extents into the active 3D view/section box.

## Non-Negotiable Target Behavior

The finished ViewCube must satisfy these invariants:

- The cube always looks like a solid cube, including near orthographic face views.
- The cube orientation is mathematically synced with the active 3D camera at all times.
- Clicking any visible face, edge, or corner reliably animates to the corresponding preset view.
- Dragging the cube feels like orbiting the model directly, with no lag, no opposite-direction mismatch, and no jump on pointer-up.
- Hover highlight equals click target. There cannot be a separate visual target and hit target.
- Labels are rendered as part of the cube face, not as floating DOM text.
- Labels never explode in scale, mirror unexpectedly, or detach from the face.
- The cube has active/inactive visual states like Revit: muted/transparent at rest, opaque and interactive on hover.
- The compass is optional, subtle when shown, and interactive if visible.
- All parity behavior is covered by deterministic tests and Playwright screenshots.

## Current Gap Inventory

| ID | Gap | Impact | Priority | Status |
| --- | --- | --- | --- | --- |
| VC-GAP-001 | ViewCube is currently a handcrafted SVG projection, not a real 3D widget. | Visuals and interaction drift from Revit quickly. | P0 | Open |
| VC-GAP-002 | Labels are unstable because they are simulated with transformed SVG text. | Label size/orientation can look wrong while rotating. | P0 | Open |
| VC-GAP-003 | Hit testing was historically separate from the visual highlight. | Blue hover areas can fail to click or click wrong targets. | P0 | In Progress |
| VC-GAP-004 | Dragging lacks true ArcBall/snap-and-go behavior. | It feels rough and not Revit-like. | P0 | Open |
| VC-GAP-005 | Click transitions are not a dedicated animated camera path. | View changes can feel like jumps or inconsistent state changes. | P0 | Open |
| VC-GAP-006 | 26-view mapping exists only as math, not as a first-class rendered control model. | Face/edge/corner semantics are fragile. | P0 | Open |
| VC-GAP-007 | The widget does not expose exact-view feedback. | User cannot tell when they are at a fixed viewpoint. | P1 | Open |
| VC-GAP-008 | Roll arrows / adjacent face affordances are absent or incomplete. | Revit-like face-view manipulation is missing. | P1 | Open |
| VC-GAP-009 | Compass is visually confusing and not functionally complete. | It competes with cube instead of acting like optional North control. | P1 | Open |
| VC-GAP-010 | Context menu parity is missing. | Revit workflows such as Orient to View are absent. | P1 | Open |
| VC-GAP-011 | No ViewCube options/preferences model. | Cannot control size, position, opacity, compass, projection behavior. | P2 | Open |
| VC-GAP-012 | Visual QA is ad hoc. | Regressions recur because screenshots do not encode pass/fail criteria. | P0 | Open |

## Architecture Decision

Do not keep evolving the current `ViewCube.tsx` as an SVG approximation.

Target architecture:

1. A dedicated `viewport/viewcube/` subsystem.
2. A real miniature 3D ViewCube model rendered with Three.js or a mathematically equivalent retained scene graph.
3. Single source of truth for:
   - camera orientation -> cube transform,
   - cube drag -> camera orbit,
   - fixed 26 view directions,
   - hover piece,
   - click piece,
   - snap target.
4. Labels implemented as face-local assets:
   - preferred: canvas-generated face textures or sprite/text atlas applied to cube face materials,
   - fallback: SVG/HTML overlay only if transformed through the same face-local basis and clipped by the face.
5. Raycast/hit-test against 3D control pieces, not separate hand-drawn screen rectangles.

Implementation options:

| Option | Description | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| A | Three.js mini renderer/canvas for ViewCube | Closest to real 3D, native raycasting, texture labels, lighting, smooth animation | Additional renderer lifecycle and pixel QA | Preferred |
| B | Use main Three.js renderer with viewport/scissor overlay | One renderer, true 3D, can share render loop | More integration with `Viewport.tsx` and layering | Acceptable |
| C | Retained SVG projection with robust math | Easier DOM testing | Still fights label perspective and hit parity | Reject for final parity |

## Workpackages

### WP-VC-01 — Reference Harness And Visual Baselines

- Priority: `P0`
- Status: `Open`
- Goal: create a repeatable QA harness before more visual work.
- Source ownership:
  - `packages/web/src/viewport/ViewCube.tsx`
  - `packages/web/src/viewport/viewCubeAlignment.ts`
  - new `packages/web/src/viewport/viewcube/*`
  - `packages/web/tmp/viewcube-*` screenshot outputs
- Implementation:
  - Define canonical test orientations: home/isometric, top, front, right, edge view, corner view, arbitrary orbit.
  - Capture screenshots at 1x and 2x DPR for default, hover face, hover edge, hover corner, drag, exact snap, inactive.
  - Add DOM/geometry summary JSON for each screenshot run:
    - active face/edge/corner,
    - current azimuth/elevation,
    - cube quaternion/matrix,
    - camera rig snapshot,
    - snap target or null.
  - Build pixel checks:
    - cube nonblank,
    - cube not planar at canonical side views,
    - labels within face bounds,
    - no oversized label bounding box,
    - hover highlight visible only on selected piece.
- Acceptance:
  - `pnpm --filter @bim-ai/web exec node scripts/viewcube-qa.mjs` writes screenshots and summary.
  - The QA harness fails if click target and hover target disagree.
  - The harness runs from a fresh dev server and from CI-like headless Chromium.

### WP-VC-02 — Camera/ViewCube State Contract

- Priority: `P0`
- Status: `Open`
- Goal: establish one mathematical contract between the ViewCube and `CameraRig`.
- Source ownership:
  - `packages/web/src/viewport/cameraRig.ts`
  - `packages/web/src/viewport/viewCubeAlignment.ts`
  - new `packages/web/src/viewport/viewcube/orientation.ts`
- Implementation:
  - Define canonical coordinate system:
    - world up,
    - model front,
    - cube front,
    - compass north,
    - camera look direction.
  - Replace duplicated sign/sensitivity assumptions with exported helpers.
  - Define `ViewCubePose`:
    - `cameraAzimuth`,
    - `cameraElevation`,
    - `cameraRoll`,
    - `projectionMode`,
    - `frontBasis`,
    - `homePose`.
  - Add conversion functions:
    - `cameraRigSnapshotToViewCubePose(snapshot)`
    - `viewCubePickToCameraTarget(pick, frontBasis)`
    - `viewCubeDragDeltaToOrbitDelta(dx, dy, pose)`
  - Add tests for roundtrip behavior and sign consistency.
- Acceptance:
  - Dragging the cube by `dx/dy` produces the same camera delta as `CameraRig.orbit(dx, dy)`.
  - External viewport orbit updates the ViewCube orientation in the next frame without drift.
  - Top/bottom views preserve expected up vector/roll.
  - `Set Front to View` can change the front basis without breaking old models.

### WP-VC-03 — True 3D ViewCube Renderer

- Priority: `P0`
- Status: `Open`
- Goal: replace the SVG projection with a real miniature cube renderer.
- Source ownership:
  - new `packages/web/src/viewport/viewcube/ViewCubeRenderer.ts`
  - new `packages/web/src/viewport/viewcube/ViewCubeCanvas.tsx`
  - `packages/web/src/viewport/ViewCube.tsx` becomes a thin shell
- Implementation:
  - Render a cube mesh with bevel-like edge definition and subtle lighting.
  - Use an orthographic or controlled perspective mini-camera matching Revit's stable 3/4 view feel.
  - Render 6 face panels as actual mesh planes or cube submeshes.
  - Add edge and corner sub-controls as selectable mesh strips/patches, not invisible DOM boxes.
  - Implement inactive/active opacity:
    - inactive: lower opacity, less saturated stroke, no highlights,
    - active: opaque cube, hover highlight.
  - Keep UI controls outside the cube:
    - Home above,
    - context/menu affordance,
    - optional compass below.
- Acceptance:
  - At all canonical orientations, screenshot shows a solid cube.
  - No label floats outside the cube.
  - No transparent DOM click layer exists over the cube except the canvas itself.
  - Render loop is demand-driven, not an always-running unbounded RAF.

### WP-VC-04 — Face-Local Label Assets

- Priority: `P0`
- Status: `Open`
- Goal: make labels behave like labels printed on cube faces.
- Source ownership:
  - new `packages/web/src/viewport/viewcube/labelAtlas.ts`
  - new tests for generated textures/label sizing
- Implementation:
  - Generate a small texture atlas using `<canvas>`:
    - `TOP`, `BOTTOM`, `FRONT`, `BACK`, `LEFT`, `RIGHT`,
    - optional localized labels later.
  - Apply label textures to face materials or overlay label planes that are children of the face mesh.
  - Use fixed face-space label size, not screen-pixel font size.
  - Let perspective foreshortening happen naturally, but clamp texture mip/filtering for readability.
  - Add text orientation rule:
    - top/bottom labels rotate with face but never mirror,
    - side labels remain face-local and readable from the current visible side.
- Acceptance:
  - Labels scale only because the face is foreshortened, not because UI code changes font size.
  - Label texture is clipped by the face geometry automatically.
  - No SVG text bounding box can exceed the face polygon.
  - Playwright screenshot comparison includes at least top/side/corner orientations.

### WP-VC-05 — 26-Piece Hit Model

- Priority: `P0`
- Status: `Open`
- Goal: make face/edge/corner target selection exact and Revit-like.
- Source ownership:
  - new `packages/web/src/viewport/viewcube/picks.ts`
  - `packages/web/src/viewport/viewCubeAlignment.ts`
- Implementation:
  - Build explicit control pieces:
    - 6 face regions,
    - 12 edge strips,
    - 8 corner patches.
  - Use raycasting against these pieces.
  - Pick priority:
    - visible corner patch,
    - visible edge strip,
    - face body.
  - Add boundary expansion per paper:
    - when cursor is close to a cube boundary, adjacent face/edge targets remain easy to acquire,
    - no hidden back-side target unless Revit-like behavior explicitly supports it.
  - Keep hover target and click target from the same raycast result.
- Acceptance:
  - Moving over a piece highlights exactly what click will trigger.
  - Clicking all 26 pieces in a deterministic test maps to the expected `ViewCubePick`.
  - Edge/corner click tests run in browser, not only jsdom.
  - A heatmap/debug overlay can be enabled to visualize target regions.

### WP-VC-06 — Click Transitions And View Animation

- Priority: `P0`
- Status: `Open`
- Goal: make view changes feel like Revit: smooth, causal, and synced between model and cube.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/cameraRig.ts`
  - new `packages/web/src/viewport/viewcube/transition.ts`
- Implementation:
  - Add `animateCameraToAlignment(target, durationMs = 500)` with easing.
  - Animate azimuth, elevation, roll/up vector, projection mode if needed, and target pivot.
  - During animation, ViewCube updates from camera state, not from a separate local animation.
  - Interrupt rules:
    - pointer drag cancels transition,
    - new click retargets transition,
    - Escape cancels if appropriate.
  - Respect reduced motion preference:
    - reduce duration, but do not desync cube/model.
- Acceptance:
  - Face/edge/corner click animates over about 0.5s.
  - Cube and model rotate together throughout the transition.
  - No jump at the end of animation.
  - Playwright captures start/mid/end frame with matching camera/cube state.

### WP-VC-07 — ArcBall Drag, Snap-And-Go, Exact-View Feedback

- Priority: `P0`
- Status: `Open`
- Goal: implement the interaction mode that Autodesk found fastest and users preferred.
- Source ownership:
  - `packages/web/src/viewport/viewcube/drag.ts`
  - `packages/web/src/viewport/cameraRig.ts`
  - `packages/web/src/Viewport.tsx`
- Implementation:
  - Replace simple delta orbit with an ArcBall-style drag model for the cube.
  - Preserve high control-display ratio so small drags rotate effectively.
  - Define all 26 fixed target orientations as unit vectors/quaternions.
  - During drag:
    - find nearest fixed viewpoint,
    - if within 10 degrees, snap camera/cube to that view,
    - otherwise free orbit.
  - Exact-view feedback:
    - dashed outline when not at fixed view,
    - solid outline when exactly at a fixed view,
    - subtle nearest-piece highlight while orbiting outside cube.
  - Avoid jarring model rotation by using smoothed camera updates without adding latency.
- Acceptance:
  - Dragging on cube rotates model and cube together at 60 fps target on seed model.
  - Near a fixed view, snap engages within 10 degrees.
  - Leaving the snap threshold releases smoothly.
  - Exact fixed view draws solid outline cue.
  - Drag never ends with cube and camera showing different orientation.

### WP-VC-08 — Roll Arrows And Adjacent Face Controls

- Priority: `P1`
- Status: `Open`
- Goal: match the auxiliary controls Revit users expect around face views.
- Source ownership:
  - new `packages/web/src/viewport/viewcube/auxControls.ts`
  - `packages/web/src/Viewport.tsx`
- Implementation:
  - When current view is near a face view, show roll arrows around the cube.
  - Roll arrows rotate the view around the current look direction.
  - Show adjacent face affordances/triangles around the cube boundary where appropriate.
  - Use expanded hit zones for these controls without interfering with cube piece picking.
- Acceptance:
  - In front/top/right views, roll arrows are visible and clickable.
  - Roll updates camera roll/up vector and ViewCube orientation.
  - Adjacent face control moves to neighboring face view with animation.
  - Controls fade out in free orbit/non-face orientations.

### WP-VC-09 — Compass Parity

- Priority: `P1`
- Status: `Open`
- Goal: make compass optional and useful, not decorative clutter.
- Source ownership:
  - new `packages/web/src/viewport/viewcube/compass.tsx`
  - view settings/persistence
- Implementation:
  - Add ViewCube option: `showCompass`.
  - Compass sits below cube and indicates model North.
  - Cardinal letters click to rotate to N/E/S/W-oriented view.
  - Compass ring/letter drag rotates model around pivot.
  - Keep visual weight below cube:
    - dashed/soft ring,
    - subtle cardinal labels,
    - active only on hover or when compass is being used.
- Acceptance:
  - Hidden by option when disabled.
  - When visible, cardinal click rotates around pivot.
  - Dragging compass rotates azimuth without changing elevation unexpectedly.
  - Compass never overlaps cube labels or face hit regions.

### WP-VC-10 — Revit-Like Context Menu

- Priority: `P1`
- Status: `Open`
- Goal: cover the ViewCube menu workflows that make Revit's cube more than a simple orbit widget.
- Source ownership:
  - new `packages/web/src/viewport/viewcube/ViewCubeMenu.tsx`
  - `packages/web/src/workspace/WorkspaceRightRail.tsx` if options need persistence UI
  - section box/view extents code
- Implementation:
  - Right-click ViewCube menu:
    - Go Home,
    - Save View,
    - Lock to Selection,
    - Perspective / Orthographic,
    - Set Current View as Home,
    - Set Front to View,
    - Reset Front,
    - Show Compass,
    - Orient to View,
    - Orient to Direction,
    - Orient to Plane,
    - Options.
  - Orient to View:
    - list floor plans, sections, elevations, 3D views,
    - orient active 3D camera to selected view,
    - apply/emulate view crop/section extents as active 3D section box where applicable.
  - Match AcadGraph workflow:
    - using a section/plan from project browser to cut the active 3D view should be supported.
- Acceptance:
  - Menu opens via right-click and keyboard context key.
  - Orient to View from a section creates/updates a 3D section box matching section extents.
  - Show Compass toggles persisted option.
  - Set Current View as Home changes Home button behavior.

### WP-VC-11 — Appearance And Options

- Priority: `P2`
- Status: `Open`
- Goal: expose Revit-like appearance/behavior options once core parity is stable.
- Source ownership:
  - new settings model for ViewCube preferences
  - `packages/web/src/workspace/WorkspaceRightRail.tsx` or settings dialog
- Options:
  - Size: small / normal / large.
  - Position: top-right / top-left / bottom-right / bottom-left.
  - Inactive opacity.
  - Active opacity.
  - Show compass.
  - Snap while dragging.
  - Animate transitions.
  - Default projection behavior.
- Acceptance:
  - Options persist per project/user.
  - Position and size do not overlap ribbon/status panels at supported viewports.
  - Reduced-motion users get shorter transitions by default.

### WP-VC-12 — Performance, Robustness, And Cleanup

- Priority: `P0`
- Status: `Open`
- Goal: make the final ViewCube reliable in the app, not just a pretty demo.
- Source ownership:
  - new `packages/web/src/viewport/viewcube/*`
  - `packages/web/src/Viewport.tsx`
  - tests
- Implementation:
  - Demand-render only when:
    - camera changes,
    - hover changes,
    - animation/drag active,
    - options change.
  - Dispose textures/materials/geometries on unmount.
  - Avoid multiple WebGL contexts if using separate renderer; prefer shared renderer if context budget becomes an issue.
  - Add fallback path for WebGL failure:
    - static icon plus keyboard/menu navigation,
    - no broken blank overlay.
  - Remove legacy SVG ViewCube implementation once parity renderer lands.
- Acceptance:
  - No leaked RAF loop after switching tabs/views.
  - No WebGL context leak after repeated mount/unmount.
  - ViewCube frame time budget stays below 2 ms on seed model when idle and below 4 ms during drag on development hardware.
  - All legacy screenshot temp artifacts are not committed except intentional tracker evidence.

## Implementation Sequence

1. `WP-VC-01` and `WP-VC-02` first. Do not write another visual implementation before the harness and camera contract exist.
2. `WP-VC-03`, `WP-VC-04`, and `WP-VC-05` as the core rebuild. These should land together behind a feature flag:
   - `VITE_VIEWCUBE_RENDERER=v2`
3. `WP-VC-06` click transition animation.
4. `WP-VC-07` drag snap-and-go and exact-view feedback.
5. `WP-VC-08` roll/adjacent controls.
6. `WP-VC-09` compass.
7. `WP-VC-10` context menu, including Orient to View.
8. `WP-VC-11` options.
9. `WP-VC-12` cleanup and legacy removal.

## Definition Of Done For "Identical Enough"

The ViewCube cannot be marked parity-complete until all of these pass:

1. Visual parity:
   - screenshots at canonical orientations look like a cube, not a flat plane,
   - labels are face-local and stable,
   - hover highlights match Revit-style selectable pieces,
   - inactive/active opacity states are visible.
2. Interaction parity:
   - all 26 pieces click to correct views,
   - drag is smooth and in sync with the model,
   - snap-and-go engages near fixed views,
   - exact fixed views show solid outline cue,
   - roll arrows work at face views,
   - Home works and can be redefined.
3. Revit workflow parity:
   - context menu supports Orient to View,
   - Orient to View can transfer a plan/section crop into active 3D via section box,
   - compass can be shown/hidden and used interactively.
4. Engineering proof:
   - unit tests for math,
   - browser tests for 26 click targets,
   - Playwright screenshot QA,
   - no TypeScript/lint failures,
   - no active render loop or resource leak at idle.

## Immediate Next Task

Start with `WP-VC-01` and `WP-VC-02`.

Concrete first PR:

1. Add `packages/web/src/viewport/viewcube/orientation.ts`.
2. Move 26-view definitions and camera/viewcube conversion math out of `ViewCube.tsx`.
3. Add tests proving `CameraRig.orbit` and ViewCube drag use the same sign/sensitivity.
4. Add `scripts/viewcube-qa.mjs` to capture canonical screenshots and JSON state.
5. Leave the existing visual implementation in place until the QA harness is green.

