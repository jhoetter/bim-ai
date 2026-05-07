# Wave-3 Agent 4 — Sketch downstream + ceiling/roof propagation (SKT-02 + SKT-03 + SKT-01 propagation)

You are **Agent 4** of eight wave-3 agents. Theme: **finish the sketch primitive** — ship Pick Walls (SKT-02), validation feedback (SKT-03), and propagate the SKT-01 floor-only session to ceiling + roof element kinds. Branch `wave3-4`.

---

## 0. Pre-flight

```bash
cd /Users/jhoetter/repos/bim-ai
git fetch origin --quiet
git worktree add /Users/jhoetter/repos/bim-ai-wave3-4 -b wave3-4 origin/main
cd /Users/jhoetter/repos/bim-ai-wave3-4
```

Read:
- `spec/workpackage-master-tracker.md` → P3 → SKT-02, SKT-03 + SKT-01 detail block
- The SKT-01 commit `c0f27e12` to understand the session state machine you're extending
- `nightshift/wave3-README.md`

### Quality gates / branch protocol / tracker / anti-laziness

Standard. Branch `wave3-4`, status `nightshift/wave3-4-status.md`. Push + merge each WP individually.

---

## 1. Your assigned workpackages

Order: SKT-02 (S, builds on SKT-01) → SKT-03 (S) → SKT-01 propagation (M).

### 1.1 — SKT-02: Pick Walls sub-tool inside sketch sessions

**Tracker:** P3 → SKT-02 detail block.

**Concrete scope:**

1. **Sub-tool inside sketch session.** When `sketchSession.status === 'open'`, the sketch toolbar gets a "Pick Walls" button. Activating it:
   - Cursor over a wall highlights it green
   - Click adds the wall's centerline (or interior face, configurable) as a sketch line
   - Clicking the same wall toggles it off
   - Each Pick Walls click emits `AddSketchLineCmd` (existing from SKT-01)

2. **Auto-offset.** Configurable per session (default: interior face). Offset = wall's interior normal × half thickness. The agent matches Revit's "offset = -100mm for slab over walls" for floor sketches.

3. **Auto-trim corners.** When two picked walls share a corner (within tolerance), the auto-generated lines trim to the corner instead of extending beyond. Implement via segment-segment intersection at corners.

4. **Tests:**
   - `app/tests/test_sketch_session_pick_walls.py` — picking 4 walls of a rectangular room produces a closed-loop sketch
   - `packages/web/src/plan/SketchCanvas.pickWalls.test.tsx` — UI flow (click wall → sketch line appears)

**Acceptance.** Enter floor sketch → click Pick Walls → click 4 walls of a room → walls auto-trim at corners → Finish commits a closed-loop floor exactly inside the wall faces.

**Effort:** 3-4 hours.

---

### 1.2 — SKT-03: Sketch validation feedback (Revit-style messages)

**Tracker:** P3 → SKT-03 detail block.

**Concrete scope:**

1. **Validation issues with element-level highlighting** (extending the SKT-01 validation that already runs):
   - "Line must be in closed loop" — open vertices marked red on canvas
   - "Lines must not intersect" — crossing pairs highlighted (red)
   - "Lines must be on the same plane" — outliers highlighted
   - "Selected walls do not form a contiguous chain" — broken segments dimmed (Pick Walls only)

2. **Status panel** at the top of the sketch session UI: title row + list of issues, each with element-locator references that highlight when hovered.

3. **Tab cycle** through issues: pressing Tab focuses the next issue, zooms the canvas to it.

4. **One-click fixes** where obvious:
   - "Auto-close" button when there's a single missing segment between two endpoints (within tolerance)

5. **Finish gating:** Finish ✓ button is disabled when there are any errors; tooltip lists count.

6. **Tests:**
   - `packages/web/src/plan/SketchCanvas.validation.test.tsx` — drawing 3 sides of a rectangle → Finish disabled with "closed loop" issue + offending vertex highlighted

**Acceptance.** Drawing 3 sides of a rectangle and trying to Finish → button disabled, status panel shows "Line must be in closed loop", offending vertex highlighted red.

**Effort:** 3-4 hours.

---

### 1.3 — SKT-01 propagation: ceiling + roof + room-separation

**Tracker:** P3 → SKT-01 detail block. Status: `partial` (floor-only slice landed in `c0f27e12`). Propagate to other element kinds.

**Concrete scope:**

1. **Extend SketchSession.elementKind** to accept `'ceiling' | 'roof' | 'room_separation'` in addition to `'floor'`:

   ```python
   element_kind: Literal['floor', 'ceiling', 'roof', 'room_separation']
   ```

2. **`FinishSketchSession` translation** in the engine:
   - `floor` (existing): commits `CreateFloor` with `boundaryMm`
   - `ceiling`: commits `CreateCeiling` with `boundaryMm`
   - `roof`: commits `CreateRoof` with `footprintMm`. Default `roofGeometryMode: 'mass_box'` — agent picks asymmetric_gable etc. via inspector after.
   - `room_separation`: doesn't need a closed loop; commits `CreateRoomSeparation` for each line

3. **Tool entries:** "Ceiling (Sketch)", "Roof (Sketch)", "Room Separation (Sketch)" — same toolbar pattern as the existing "Floor (Sketch)".

4. **Tests:**
   - `app/tests/test_sketch_session_other_kinds.py` — open + draw + finish for each kind produces the right element

**MAY defer (mark in tracker note as `partial` if needed):**
- In-place mass / generic model
- Void cut sketch (would integrate with FAM-02 sweep)
- Detail region (works with ANN-01 detail components)

After this WP ships, mark SKT-01 in tracker as: `partial in <hash> — floor + ceiling + roof + room separation slices shipped; in-place mass + void cut + detail region deferred`. (Or upgrade to `done` if you cover all 6 element kinds.)

**Acceptance.** Click "Roof (Sketch)" tool → draw an L-shaped polygon → Finish commits a `CreateRoof` with the L-footprint; the roof renders correctly in 3D. Same for ceiling.

**Effort:** 3-4 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- `app/bim_ai/sketch_session.py` extensions (additional element kinds)
- `app/bim_ai/sketch_validation.py` extensions
- `packages/web/src/plan/SketchCanvas.tsx` extensions (Pick Walls + validation feedback)
- `packages/web/src/plan/SketchCanvasPickWalls.tsx` (new sub-component)
- New tool entries (Ceiling Sketch, Roof Sketch, Room Separation Sketch)

**Shared territory:**
- `PlanCanvas.tsx` — small delegation hook only (when sketch active, render SketchCanvas; you already have this from SKT-01)
- `commands.py`, `engine.py` — extend `FinishSketchSession` apply path
- `tools/toolRegistry.ts` — append tool entries
- `spec/workpackage-master-tracker.md` — only SKT-01, SKT-02, SKT-03

**Avoid:**
- `Viewport.tsx` and `viewport/grip3d.ts` (Agent 2)
- `meshBuilders.ts` (Agent 5)
- `familyEditor/*` (Agent 7)

---

## 3. Go

Spawn worktree, ship SKT-02 → SKT-03 → SKT-01 propagation. Visually verify the new sketch flows in the dev server.
