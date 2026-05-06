# Nightshift Agent 2 — Wall Openings, Door Variants, Window Outlines

You are **Agent 2** of seven parallel AI engineers. Your theme is **the wall-hosted opening family**: rectangular wall openings, non-swing doors, variable-shape windows. You own branch `nightshift-2`. The user is asleep. Do not stop until your assigned WPs are done — then keep going on Wave-0 work.

---

## 0. Pre-flight (identical across all agents)

### Repo

`/Users/jhoetter/repos/bim-ai`. Read `spec/workpackage-master-tracker.md` (~1370 lines) end-to-end before starting — every WP below has a detailed entry there with data-model snippets, acceptance, and effort.

### Six other agents are working in parallel

Branches `nightshift-1`, `nightshift-3` … `nightshift-7` are concurrent. They touch different thematic slices, but `spec/workpackage-master-tracker.md` and `packages/core/src/index.ts` will see write traffic from multiple agents. **Expect merge conflicts. Resolve them and continue.**

### Quality gates (must pass before each push)

1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run` (in the package(s) you touched)
3. `cd app && .venv/bin/pytest -q --no-cov tests/<files-you-touched>`
4. `make verify` before merging to main

Never use `--no-verify`, never skip tests, never delete failing tests to make CI pass. Fix root causes.

### Branch + merge protocol per WP

After implementing each WP locally, run gates, then:

```bash
git add -A
git commit -m "feat(<scope>): <WP-ID> — <one-line summary>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin nightshift-2

git fetch origin
git rebase origin/main
# resolve conflicts; re-run gates
git push origin nightshift-2 --force-with-lease

git checkout main
git pull origin main
git merge nightshift-2 --ff-only
git push origin main
# if push fails (race with another agent), pull and retry from "git checkout main"

git checkout nightshift-2
```

Never `git push --force` to main. `--force-with-lease` only on your own branch. Never `git reset --hard` shared history.

If `--ff-only` fails repeatedly (5 attempts), document the WP as `merge-blocked` in your end-of-shift summary and continue.

### Tracker update protocol

After each WP lands on main, update `spec/workpackage-master-tracker.md`: change the row's `State` to `done`, add a brief note like `done in <commit-hash>`. Commit the tracker change separately on your branch (`chore(tracker): mark <WP-ID> done`), push, rebase, ff-merge to main.

Tracker conflicts will happen — resolve by keeping both edits.

### Anti-laziness directive (THE most important section)

**Done means:** code written, tests added, all four gates pass, branch merged to main, tracker updated, commit visible on `origin/main`. Anything less is **not done**.

- After each WP, immediately start the next. No celebration, no summary, no pause.
- If a WP is bigger than expected, finish it. Don't punt.
- The bar for "I cannot finish this" is high. Almost all your WPs are designed to be shippable autonomously.
- After all your assigned WPs ship, **do not stop**. Pick a Wave-0 standalone WP from `spec/workpackage-master-tracker.md` Cross-Epic Dependency Map, claim it (mark row `partial — in flight nightshift-2`), and keep going.

### End-of-shift summary

When you genuinely have nothing left, append `nightshift/nightshift-2-status.md` with WPs shipped (commit hashes), WPs blocked (reasons), incidental observations, total commits attributable to nightshift-2. Then stop.

---

## 1. Your assigned workpackages

Three WPs in this order. Sequential — no context-switching.

### 1.1 — KRN-04: `wall_opening` element kind

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Kernel + element kinds" → KRN-04 + the **KRN-04 detail** block.

**Why it matters.** Today the only way to put a hole in a wall is via a door / window family. Real architecture has plenty of openings that aren't doors or windows: shafts, MEP penetrations, basement ducts, pass-throughs, archway openings to interior rooms. The `wall_opening` element kind cuts the wall via CSG with no frame geometry and no schedule entry.

**Concrete scope:**

1. Element shape in `packages/core/src/index.ts`:

```ts
{
  kind: 'wall_opening';
  id: string;
  name?: string;
  hostWallId: string;
  alongTStart: number;
  alongTEnd: number;
  sillHeightMm: number;
  headHeightMm: number;
}
```

2. Mirror in `app/bim_ai/elements.py`.

3. New command `CreateWallOpening` (and `UpdateWallOpening`, `DeleteWallOpening` if needed) in `app/bim_ai/commands.py`. Validation: hostWallId resolves to a wall; alongT bounds are in [0, 1] with start < end; head > sill; opening fits within wall length and height.

4. Renderer: extend `makeWallMesh` (or the CSG worker `csgWorker.ts`) to subtract `wall_opening` geometry from the host wall, exactly like door / window openings do today. No frame mesh.

5. Plan canvas: `wall_opening` shows as a rectangular outline in the wall thickness (matches Revit's plan symbol).

6. Section view: the opening shows as a clean rectangular cut.

7. Tests:
   - vitest for `makeWallMesh` (or the CSG path) verifying a wall with a single `wall_opening` produces a mesh with the correct vertex count delta vs. an undamaged wall
   - pytest for the engine command (validation + apply)

**Acceptance.**
- Authoring `kind: 'wall_opening'` against a wall produces a visible cut in 3D, plan, and section.
- The opening is **not** in the door / window schedule.

**Files:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, `packages/web/src/viewport/meshBuilders.ts` (or `csgWorker.ts`), `packages/web/src/plan/planProjection*.ts`.

**Estimated time:** 3 hours.

**Note:** EDT-04 (the plan-canvas wall-opening tool stub at `PlanCanvas.tsx:924`) is in another agent's queue or is being deferred — don't touch the canvas tool wiring; just expose the `CreateWallOpening` command at the API level. The canvas hookup is a follow-up.

---

### 1.2 — KRN-13: Non-swing door operation types

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Kernel + element kinds" → KRN-13 + the **KRN-13 detail** block.

**Why it matters.** Today every door swings. Real buildings need sliding (the target-house loggia uses a floor-to-ceiling sliding glass door), pocket, bi-fold, pivot, and automatic doors. Each has a different plan symbol and 3D representation.

**Concrete scope:**

1. Add to `door` shape in `packages/core/src/index.ts`:

```ts
{
  // existing fields preserved
  operationType?:
    | 'swing_single'        // default; matches today's behaviour
    | 'swing_double'
    | 'sliding_single'
    | 'sliding_double'
    | 'bi_fold'
    | 'pocket'
    | 'pivot'
    | 'automatic_double';
  slidingTrackSide?: 'wall_face' | 'in_pocket';   // sliding only
}
```

Mirror in `app/bim_ai/elements.py`.

2. Renderer: in `packages/web/src/families/geometryFns/doorGeometry.ts`, switch on `operationType` to vary 3D geometry:
   - `swing_single` / `swing_double`: existing logic
   - `sliding_single`: panel mounted on a track at the head, no swing arc; track line drawn at top of opening
   - `sliding_double`: two panels meeting at center
   - `bi_fold`: two hinged panel pairs folding back
   - `pocket`: panel slides into a wall pocket; renders as flat panel against wall face
   - `pivot`: pivot point offset from leaf edge
   - `automatic_double`: two panels with arrow markers indicating threshold

The 3D variants can be rough geometry — they don't have to be photorealistic. Use simple boxes / extrusions positioned correctly for each mode.

3. Plan symbol in `packages/web/src/plan/planProjection.ts` (or the door plan-symbol code path):
   - `swing_*`: existing arc
   - `sliding_*`: parallel arrows + track line
   - `bi_fold`: zigzag panel symbol
   - `pocket`: dashed pocket extent line
   - `pivot`: pivot dot + offset arc
   - `automatic_*`: arrows pointing away from threshold

4. Tests:
   - vitest for plan projection of each operation type asserting the correct symbol primitives are emitted
   - vitest for door geometry asserting the 3D mesh varies by `operationType`

**Acceptance.**
- Authoring a door with `operationType: 'sliding_double'` renders a sliding-glass-door symbol in plan and a track-mounted dual-panel mesh in 3D.
- All six non-swing types produce distinct plan symbols.
- Default behaviour (no `operationType`) renders identically to today.

**Files:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `packages/web/src/families/geometryFns/doorGeometry.ts`, `packages/web/src/plan/planProjection.ts` (or wherever door symbols are emitted — grep for door swing arc emission).

**Estimated time:** 3-4 hours.

---

### 1.3 — KRN-12: Variable-shape window outline

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Kernel + element kinds" → KRN-12 + the **KRN-12 detail** block.

**Why it matters.** Today every window is a `widthMm × heightMm` rectangle. The target-house upper floor (`spec/target-house-seed.md` §1.4) features a "trapezoidal window… top edge slopes to follow the long, low angle of the roof pitch" — un-authorable today.

**Concrete scope:**

1. Extend `window` shape in `packages/core/src/index.ts`:

```ts
{
  // existing widthMm / heightMm preserved as bounding-box defaults
  outlineKind?: 'rectangle' | 'arched_top' | 'gable_trapezoid' | 'circle' | 'octagon' | 'custom';
  outlineMm?: { xMm: number; yMm: number }[];   // required when outlineKind === 'custom'; relative to host wall face, origin at sill-center
  attachedRoofId?: string;                       // required when outlineKind === 'gable_trapezoid'; system computes outline from roof slope
}
```

Mirror in `app/bim_ai/elements.py`.

2. Outline resolution function `resolveWindowOutline(window, hostWall, attachedRoof?): XY[]`:
   - `rectangle`: returns the four corners of the bounding box (default behaviour today)
   - `arched_top`: bottom is straight, top is a half-circle of radius `widthMm/2`
   - `gable_trapezoid`: requires `attachedRoofId`; bottom is straight, top edge follows the roof slope at the host wall's location. Use existing `roofHeightAtPoint` from `meshBuilders.ts`.
   - `circle`: 32-segment circular polygon of radius `min(widthMm, heightMm)/2`
   - `octagon`: regular 8-gon inscribed in bounding box
   - `custom`: returns `outlineMm` directly

3. Renderer: `buildWindowGeometry` in `packages/web/src/families/geometryFns/windowGeometry.ts` uses the resolved outline for both:
   - The CSG cut on the host wall (today uses an axis-aligned rect)
   - The glass pane geometry

For non-rectangular outlines, **frame geometry can be omitted in this WP** (the frame requires sweep along the polygon perimeter, which depends on FAM-02 — Agent 7's queue). Add a comment noting this: `// frame omitted for non-rectangular outlines until FAM-02 lands`.

4. Plan symbol: same outline projected to plan view; CSG cut shape uses the polygon.

5. Tests:
   - vitest for `resolveWindowOutline` covering all five outlineKinds
   - vitest for CSG cut producing the correct polygon shape

**Acceptance.**
- A window with `outlineKind: 'gable_trapezoid'` and `attachedRoofId` set produces a window whose top edge slopes to follow the roof.
- Default (rectangular) windows render identically to today.
- Visual smoke test: the target-house seed (`app/scripts/seed.py`) can be updated to use a `gable_trapezoid` window on the upper-floor recessed wall, but **don't change the seed in this WP** — that's a separate concern.

**Files:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `packages/web/src/families/geometryFns/windowGeometry.ts`, possibly `packages/web/src/viewport/meshBuilders.ts` (for the CSG path), plus tests.

**Estimated time:** 5 hours.

---

## 2. File ownership and conflict avoidance

You own:
- `packages/web/src/families/geometryFns/doorGeometry.ts` — door 3D
- `packages/web/src/families/geometryFns/windowGeometry.ts` — window 3D
- New test files you create
- The `wall_opening`, `door`, `window` element shapes (your additions, not the existing fields)

Shared territory (be careful, expect rebase conflicts):
- `packages/core/src/index.ts` — append your union extensions; don't reorder existing entries
- `app/bim_ai/elements.py` — same, append
- `packages/web/src/viewport/meshBuilders.ts` — Agent 1 owns roof functions; Agent 3 (materials) may touch wall surface code; you only edit the door/window/wall-opening CSG path
- `packages/web/src/plan/planProjection.ts` — multiple agents may touch this for symbol emission
- `app/bim_ai/commands.py` — append new commands; don't restructure
- `spec/workpackage-master-tracker.md` — only your three rows

Avoid:
- `packages/web/src/plan/PlanCanvas.tsx` (Agent 5 area)
- `packages/web/src/Viewport.tsx`
- `packages/web/src/familyEditor/*` (Agent 7)

If an Edit call fails because surrounding code changed, `git pull --rebase origin main`, re-read the file, redo the edit.

---

## 3. Go

Read `spec/workpackage-master-tracker.md` end-to-end. Then start WP 1.1 (KRN-04). Do not pause until you reach the "End-of-shift summary" step.
