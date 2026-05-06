# Open tasks — BIM AI UI

Living to-do for the redesigned UI. Anything that's _still open_ lives here so it doesn't get buried in commit messages or a 1200-line spec. When a task closes, move it to spec/ui-ux-redesign-v1-spec.md §6 (Sprint Ledger) and delete its row here.

**Counterpart docs**:

- `spec/ui-ux-redesign-v1-spec.md` §32 — fuller-context visual-fidelity audit (V01–V15).
- `spec/ui-ux-redesign-v1-spec.md` §28 — WP-UI-* table (every row is `partial`; this file enumerates the *concrete next moves\*, not the WP roll-up).
- `spec/ui-ux-redesign-v1-spec.md` §6 — sprint ledger of what already closed.

Last updated: 2026-05-06.

---

## High-impact (user-visible, blocks daily use)

---

## Medium (deferred from earlier WPs, called out in commits but not in spec)

---

## §28 WP-UI rows — table-level audit

40 of 43 rows are now `done` (2026-05-06 sweep). Three rows remain `partial`:

- **WP-UI-B01** (2D Plan canvas — drafting visuals): `planCanvasState.draftingPaintFor` not directly used in PlanCanvas.tsx; canvas achieves token-driven paint via symbology.ts but scale-dependent line weights and hatch visibility are not yet wired.
- **WP-UI-B02** (2D Plan canvas — pointer + snap grammar): `planCanvasState.classifyPointerStart` not used; PlanCanvas has its own pointer classification.
- **WP-UI-B03** (2D Plan canvas — zoom/pan/level/empty state): `planCanvasState.PlanCamera` not used; PlanCanvas has its own zoom/pan/camera. Anchor-toward-cursor zoom and strict 1:5–1:5000 bounds not applied.

Next sweep: wire `PlanCamera`, `SnapEngine`, and `draftingPaintFor` into `PlanCanvas.tsx` to close B01–B03.

---

## Feature parity gaps — old Workspace vs. redesign

These features existed in `Workspace.tsx` (now at `/legacy`) and are not yet wired into `RedesignedWorkspace.tsx`. The §5 parity dashboard did not track these because the WP-UI work packages only measured whether the _new chrome components_ were built, not whether every old-workspace feature was ported.

---

## Rendering V2 — Phase R2 (geometry accuracy)

R1 pipeline is complete (shadows, SSAO, edge lines, EffectComposer — all merged).
R2 replaces the box-proxy meshes with architecturally correct geometry.
Full specs in `spec/rendering-v2-spec.md`.

---

### R2-01 · Wall opening cuts for doors and windows

**Source:** `spec/rendering-v2-spec.md` §R2-01 · **Status:** `open`

Walls are solid `BoxGeometry`. Door and window meshes float inside the wall with no actual hole. Uses `three-bvh-csg` (to be added as dep) to subtract door/window cutter volumes from the wall mesh. Gate behind `VITE_ENABLE_CSG=true` flag.

**Next moves:**

- `pnpm add three-bvh-csg` to web package
- Add `doorCutterGeometry()` / `windowCutterGeometry()` helpers in Viewport.tsx
- Refactor `makeWallMesh` to accept hosted elements array and run CSG subtraction
- Add `VITE_ENABLE_CSG` flag; default off until R2-02/03 land

---

### R2-02 · Door frame + panel geometry

**Source:** `spec/rendering-v2-spec.md` §R2-02 · **Status:** `open`

Replace `makeDoorMesh` single-box proxy with a `THREE.Group`: head/jamb-L/jamb-R frame members (70 mm section) + panel leaf (45 mm thick) + threshold. Dimensions from `door.widthMm`, `door.heightMm`, `wall.thicknessMm`.

**Next moves:**

- Replace `makeDoorMesh` body with Group construction per spec
- Frame material: `door` category; panel: same with roughness 0.75
- Call `addEdges()` on each sub-mesh
- Set `castShadow = receiveShadow = true` on all members

---

### R2-03 · Window frame + glazing geometry

**Source:** `spec/rendering-v2-spec.md` §R2-03 · **Status:** `open`

Replace `makeWindowMesh` single-box with a Group: 4-member frame (60 mm section) + glazing pane (6 mm, roughness 0.05, opacity 0.35) + mullion if width > 1.2 m.

**Next moves:**

- Replace `makeWindowMesh` body with Group per spec
- New `glazing` material: roughness 0.05, opacity 0.35, `envMapIntensity 1.0`
- Add mullion/transom logic for large openings
- Call `addEdges()` on frame members; skip on glazing pane

---

### R2-04 · Stair tread + stringer geometry

**Source:** `spec/rendering-v2-spec.md` §R2-04 · **Status:** `open`

Replace `makeStairVolumeMesh` bounding-box proxy with a Group of per-tread `BoxGeometry` slabs (40 mm thick) stepped from base to top level, plus two side stringers.

**Next moves:**

- Replace `makeStairVolumeMesh` body with tread loop per spec
- Use `stair.riserCount` (or derive from level delta / riserMm) for tread count
- Add left/right stringer plates
- `addEdges()` + `castShadow/receiveShadow` on all members

---

### R2-05 · Railing post + baluster geometry

**Source:** `spec/rendering-v2-spec.md` §R2-05 · **Status:** `open`

`makeRailingMesh` currently builds only the rail cap segments. Extend to add square posts (50 mm) at each path vertex and evenly spaced balusters (12 mm, 115 mm clear gap) between posts.

**Next moves:**

- Add post loop (one per `pathMm` vertex) at correct height
- Add baluster loop per segment (`Math.floor(segLen / 0.115)` count)
- Metal material override: roughness 0.35, metalness 0.65
- `addEdges()` + shadows on all members

---

### R2-06 · Roof from footprint polygon

**Source:** `spec/rendering-v2-spec.md` §R2-06 · **Status:** `open`

`makeRoofMassMesh` has a hand-coded single-axis gable that breaks on L-shapes and ignores `roof.ridgeAxis`. Three stages: (1) fix polygon offset for overhang, respect `ridgeAxis`; (2) hip roof from footprint; (3) L-shape valley join.

**Next moves:**

- Add `offsetPolygonMm(pts, dist)` helper for proper overhang
- Read `roof.ridgeAxis` to choose ridge direction
- Stage 2: implement hip-line intersection algorithm for rectangular hip roofs
- Stage 3: detect L-shaped footprints, split and merge two gable meshes

---

### R2-07 · Floor slab from boundary polygon

**Source:** `spec/rendering-v2-spec.md` §R2-07 · **Status:** `open`

`makeFloorSlabMesh` uses `xzBoundsMm()` AABB instead of the actual boundary polygon. Replace with `THREE.ExtrudeGeometry` from `floor.boundaryMm`. Add slab-opening holes from `slab_opening` elements that reference the floor.

**Next moves:**

- Replace AABB `BoxGeometry` with `THREE.Shape` + `ExtrudeGeometry` from `floor.boundaryMm`
- Rotate extruded geometry -π/2 so footprint lies in XZ plane
- Find `slab_opening` elements with `hostFloorId === floor.id`, add as `THREE.Path` holes
- `addEdges(mesh, 20)` (wider threshold to suppress triangulation lines)

---

### R2-08 · Site slab fixes

**Source:** `spec/rendering-v2-spec.md` §R2-08 · **Status:** `open`

Two small bugs + one material tweak: operator-precedence bug in `padThicknessMm ?? 150 / 1000`, confirm `receiveShadow = true`, add `aoMapIntensity: 0` to suppress SSAO banding on the large flat site plane.

**Next moves:**

- Fix: `(site.padThicknessMm ?? 150) / 1000`
- Confirm `receiveShadow = true`, `castShadow = false`
- Add `aoMapIntensity: 0` to site material

---

## How to add a new task

1. Append a new `### T-NN · Title` heading at the end of the relevant section.
2. Fill: WP target / Source / Status, then a 1-paragraph "what" + a "Next moves" sub-list.
3. If it's user-visible, also add a row in spec §32. Otherwise just here.
4. Once closed, **delete the heading from this file** and add a row in spec §6 (Sprint Ledger) with the closing commit.
