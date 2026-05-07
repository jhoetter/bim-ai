# Seed-fidelity sprint — KRN-14 + KRN-15 + KRN-16 + iterate the seed until it matches the colour study

You are the single agent responsible for closing the visual-fidelity gap between the demo seed house and `spec/target-house-seed.md`. The previous seed-rebuild agent shipped code that compiled and tests passed but **never visually verified**, and the result looks nothing like `spec/target-house-vis-colored.png`. Your job is to fix it end-to-end.

## Repo

`/Users/jhoetter/repos/bim-ai`. Branch off latest `main`. Branch name: `seed-fidelity`. Read these in full before starting:

- `spec/target-house-seed.md` — architectural ground truth (148 lines)
- `spec/target-house-vis-colored.png` — visual target (open it; this is what success looks like)
- `nightshift/seed-rebuild-status.md` — what the previous agent shipped, what they punted
- `spec/workpackage-master-tracker.md` — KRN-14, KRN-15, KRN-16 detail blocks (you'll be implementing these)
- `packages/cli/lib/one-family-home-commands.mjs` — the canonical seed builder you'll be re-authoring
- `packages/web/src/viewport/meshBuilders.ts` — the renderer you'll be extending

## Why we're here (don't skip — diagnoses the gap)

The seed-rebuild agent verified:
- ✅ Roof has `roofGeometryMode: 'asymmetric_gable'`, `materialKey: 'metal_standing_seam_dark_grey'`, ridge offset and per-side eaves persisted correctly
- ✅ Walls have correct MAT-01 materialKeys persisted
- ✅ All 62 elements commit through `try_commit_bundle` with 0 blocking violations

But the rendered output (vp-ssw viewpoint) shows:
- ❌ A roughly cubic upper box with a slight roof tilt, **no visible asymmetric ridge**
- ❌ A flat south facade with two windows — **no recessed loggia** (the agent's two-walls-with-cut hack didn't produce the architectural recess)
- ❌ No picture-frame outline around the gable
- ❌ A small "dormer" on the right that's just a wall + sliding doors, **no dormer cut-out in the roof**
- ❌ The roof reads dark brown rather than the dark grey standing-seam metal

**Three structural reasons** the agent's approach fails, and you're going to fix all three:

1. **The "loggia frame" needs a real geometric recess.** Today's wall is a 200 mm thin extrusion; a thicker frame around a hole reads as a wall-with-a-hole, not a deep architectural picture-frame. We need a proper *wall recess* primitive (KRN-16) that makes the wall plane step back over a defined alongT range — not two parallel walls and a CSG cut.
2. **The picture-frame outline needs to be a real swept solid.** FAM-02 sweep is family-internal only. We need a project-level `createSweep` command (KRN-15) so the seed bundle can author a thick white profile sweep along the gable polygon — the actual outlined-frame visual.
3. **The dormer needs to cut the roof, not sit beside it.** KRN-14 must ship — no workaround produces the right geometry.

After all three primitives ship, you re-author the seed using them with **bumped dimensions** (the agent's 1500 mm ridge offset on a 5000 mm volume was too modest), and verify visually via Playwright screenshot diff.

## Branch + merge protocol per WP

```bash
git add -A
git commit -m "feat(<scope>): <WP-ID> — <one-line summary>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin seed-fidelity
git fetch origin
git rebase origin/main
git push origin seed-fidelity --force-with-lease
git push origin seed-fidelity:main   # direct push works around locked-main-worktree issue
```

**Use a per-agent worktree from the start** — `git worktree add /Users/jhoetter/repos/bim-ai-seed-fidelity seed-fidelity` and `cd` into it. The previous overnight run flagged worktree contention as the dominant friction; pre-empt it.

If `git checkout main` fails because a worktree has it locked, the direct `git push origin <branch>:main` is the working pattern (proven last night).

## Quality gates

1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run` (in `@bim-ai/web` for any TS you touch)
3. `cd app && .venv/bin/pytest -q --no-cov tests/<files-you-touched>`
4. `make verify` before merging to main
5. **Visual verification via Playwright** — see WP 4 below

Never `--no-verify`. Never delete failing tests; if the new seed legitimately changes element counts in `app/tests/test_one_family_bundle_roundtrip.py` etc., update the assertions to match the new ground truth. Never weaken assertions.

## Tracker update protocol

After each WP lands on main: change row's `State` → `done` (or `partial` for KRN-14 if you ship the load-bearing slice but defer dormer polish), add `done in <commit-hash>`. Commit separately as `chore(tracker): mark <WP-ID> done`. Push, rebase, push to main.

## Anti-laziness directive

Done means: code written, tests added, all five quality gates pass (including visual), branch merged to main, tracker updated, commit visible on `origin/main`. Anything less is **not done**.

- After each WP, immediately start the next. No celebration paragraphs. No mid-shift summaries.
- If a WP turns out larger than expected, finish the load-bearing slice and document deferred polish in the tracker note.
- The bar for "I cannot finish this" is high. The previous agent declared victory because tests passed; you do **not** declare victory until the rendered output matches `target-house-vis-colored.png`.

---

## Your four WPs in order

### WP 1 — KRN-15: `createSweep` engine command (load-bearing for everything else)

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Kernel + element kinds" → KRN-15 + the **KRN-15 detail** block.

**Why first:** KRN-16 wall recess uses sweep geometry to render the recess walls. The seed re-author uses sweep for the picture-frame outline. Without this, the rest is blocked.

**Concrete scope:**

1. New element kind in `packages/core/src/index.ts`:
   ```ts
   {
     kind: 'sweep';
     id: string;
     name?: string;
     levelId: string;
     pathMm: { xMm: number; yMm: number; zMm?: number }[];   // open or closed polyline
     profileMm: { uMm: number; vMm: number }[];               // closed loop in profile-local 2D
     profilePlane: 'normal_to_path_start' | 'work_plane';
     materialKey?: string | null;
     worksetId?: string | null;
     pinned?: boolean;
   }
   ```

2. Mirror in `app/bim_ai/elements.py` with a new `SweepElem` class.

3. New `CreateSweepCmd` in `app/bim_ai/commands.py`. Validation in `app/bim_ai/engine.py`:
   - `levelId` resolves to a level
   - `pathMm` has ≥2 points
   - `profileMm` has ≥3 points (closed loop)
   - `profilePlane` is one of the two enum values
   - If `materialKey` is set, it must resolve in the catalog (use existing helper)

4. Renderer in `packages/web/src/viewport/meshBuilders.ts` — new `makeSweepMesh(sweep, paint)` that calls into `packages/web/src/families/sweepGeometry.ts:meshFromSweep` (already shipped via FAM-02). Wire it into the incremental scene manager in `Viewport.tsx` so sweeps add/remove/update like other element kinds.

5. Tests:
   - `packages/web/src/viewport/sweepMesh.test.ts` — vertex count + bounding box for a known path + profile
   - `app/tests/test_engine_create_sweep.py` — engine command validation (bad path / profile / level / material)

**Acceptance.** Authoring a `createSweep` with a 4-segment path along the gable polygon and a 200×100 mm rectangular profile produces a visible picture-frame outline in 3D. Total mesh thickness ≈ 100 mm. Material key respected.

**Effort:** ~4-5 hours.

---

### WP 2 — KRN-16: Wall recess / setback geometry

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Kernel + element kinds" → KRN-16 + the **KRN-16 detail** block.

**Concrete scope:**

1. Extend `wall` shape in `packages/core/src/index.ts`:
   ```ts
   {
     // existing fields preserved
     recessZones?: {
       alongTStart: number;
       alongTEnd: number;
       setbackMm: number;
       sillHeightMm?: number;
       headHeightMm?: number;
       floorContinues?: boolean;
     }[];
   }
   ```

2. Mirror in `app/bim_ai/elements.py`.

3. Engine validation in `app/bim_ai/engine.py`:
   - `alongTStart < alongTEnd`, both in [0, 1]
   - Recess zones don't overlap
   - `setbackMm > 0` and `setbackMm < wall.thicknessMm * 8` (sanity)
   - Hosted openings whose alongT falls within a recess zone get logged with a `recess_hosted_opening` advisory (informational, not blocking — the renderer will reposition them)

4. Renderer in `packages/web/src/viewport/meshBuilders.ts` — extend `makeWallMesh`:
   - When `wall.recessZones` is empty/undefined: existing single-rectangle extrusion (no change)
   - When `wall.recessZones` is non-empty: build a polygon footprint that follows the wall centerline along non-recessed segments and steps back by `setbackMm` along recessed segments. The setback direction is the wall's interior normal. Each recess zone's `sillHeightMm` / `headHeightMm` define a vertical window in the recess (default: full-height); outside that vertical window the wall extrudes at its full thickness. Use Three.js `ExtrudeGeometry` or build vertices manually.
   - For recess zones with `floorContinues: true`: extend the floor slab into the recess (find the floor that contains this wall's level via existing `elementsById` lookup; extend the floor's boundary polygon to cover the recess footprint). This may be deferred to a separate floor-side change — just emit a TODO comment if floor extension is too invasive.

5. Hosted-opening repositioning: in `makeDoorMesh` / `makeWindowMesh` / `makeWallOpening` cuts, when the host wall has recess zones and the opening's `alongT` falls within a recess zone, position the opening on the recessed surface (offset by `setbackMm` along the wall's interior normal).

6. Tests:
   - `packages/web/src/viewport/meshBuilders.wallRecess.test.ts` — verify a wall with one recess zone produces an extruded mesh whose footprint has the expected step-back geometry; verify hosted opening is repositioned
   - `app/tests/test_engine_wall_recess.py` — validation (overlapping zones rejected, setback bounds, alongT bounds)

**Acceptance.** Authoring a wall with `recessZones: [{ alongTStart: 0.1, alongTEnd: 0.9, setbackMm: 1500 }]` produces a wall whose middle portion is set back 1500 mm interior, while the end caps maintain the original wall plane. Hosted windows in the recessed zone appear on the recessed surface, not on the original wall plane.

**Effort:** ~5-6 hours.

---

### WP 3 — KRN-14: Dormer element kind (load-bearing slice)

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Kernel + element kinds" → KRN-14 + the **KRN-14 detail** block.

**Reality check:** Full KRN-14 spec is L (2-3 weeks). You will not finish all of it. Ship the **load-bearing slice** that makes the target-house's east-slope dormer-cut-out visually correct. The rest can be deferred.

**MUST ship:**

1. Element shape in `packages/core/src/index.ts` per the tracker's KRN-14 detail block (`hostRoofId`, `positionOnRoof`, `widthMm`, `wallHeightMm`, `depthMm`, `dormerRoofKind: 'flat' | 'shed'`, `wallMaterialKey`, `roofMaterialKey`, `hasFloorOpening`).
2. Mirror in `app/bim_ai/elements.py`.
3. `CreateDormerCmd` in `app/bim_ai/commands.py` + engine handler in `app/bim_ai/engine.py`:
   - Validation: hostRoofId resolves to a roof, dormer footprint fits within host roof footprint
   - On apply: marks the host roof for re-rendering
4. Renderer in `packages/web/src/viewport/meshBuilders.ts`:
   - In `makeRoofMassMesh` (or a wrapper that calls it), after building the host roof mesh, find all dormers whose `hostRoofId === roof.id` and CSG-subtract their footprint extruded through the roof from the host mesh
   - For each dormer, build separate dormer geometry: 4 walls (front + 2 cheeks + back) at the dormer's position-on-roof, with `wallHeightMm` height; a flat or shed roof on top; materialKey on each piece
   - Hosted doors / windows on the dormer's front wall (the new `front-wall-dormer-id`-or-similar reference)

**MAY defer (mark in tracker note):**
- `gable` and `hipped` dormer roof kinds — only `flat` and `shed` for now
- `hasFloorOpening: true` floor cutting — emit TODO
- Plan / section view symbols for the dormer — hold for follow-up
- Dormer overflow validation advisory beyond simple "fits inside host"

5. Tests:
   - `packages/web/src/viewport/dormerMesh.test.ts` — mesh count + CSG cut produces a hole in host roof
   - `app/tests/test_engine_create_dormer.py` — validation

**Acceptance.** A dormer authored on the asymmetric gable roof's east slope produces:
- A clean rectangular cut in the host roof mesh at the dormer position
- 3 dormer walls + a flat dormer roof at the cut
- Sliding doors hosted on the dormer's south face render correctly through the cut

After this WP, mark KRN-14 in the tracker as `partial` with note: `partial in <hash> — flat + shed kinds shipped; gable / hipped + hasFloorOpening + plan symbols deferred`.

**Effort:** ~6-7 hours for the load-bearing slice.

---

### WP 4 — Re-author the seed using KRN-14 + KRN-15 + KRN-16, and visually verify

This is the WP that closes the loop. Without it the previous WPs are unused.

**Concrete scope:**

1. **Re-author** `packages/cli/lib/one-family-home-commands.mjs` to use the new primitives:

   - **Asymmetric gable roof** with bumped dimensions:
     - Upper-volume footprint stays at `5000 × 8000 mm`
     - `ridgeOffsetTransverseMm: 1800` (was 1500) — more dramatic
     - `eaveHeightLeftMm: 1200` (was 1500) — lower west wall
     - `eaveHeightRightMm: 4500` (was 4000) — higher east wall
     - Verify in 3D that the ridge is visibly off-center and the east slope is short + steep, west slope long + shallow

   - **Loggia recess via KRN-16** instead of the two-walls-and-cut hack:
     - Replace `hf-w-uf-loggia-front` and `hf-w-uf-loggia-back` with a **single** upper-volume south wall `hf-w-uf-south` with `recessZones: [{ alongTStart: 0.1, alongTEnd: 0.9, setbackMm: 1500, floorContinues: true }]`
     - The wall's `materialKey` becomes `cladding_warm_wood` (the recess back wall material — that's what's visible inside the recess); the surrounding non-recessed end caps inherit the wall's primary material
     - Drop the wall_opening element (no longer needed)

   - **Picture-frame outline via KRN-15:** add a `createSweep` after the roof:
     - `pathMm`: the gable outline polygon — south face vertices following (x=0, y=0, z=3000mm) → (x=5000, y=0, z=3000mm) → (x=5000, y=0, z=eave_east) → ridge_top → (x=0, y=0, z=eave_west) → close
     - `profileMm`: rectangular `200 × 100 mm` profile
     - `materialKey: 'render_white'` (or `cladding_dark_grey` — try render_white first; iterate if it doesn't read as a "frame")
     - Position the sweep just outboard of the upper-volume south face

   - **Dormer via KRN-14** instead of the wall-and-doors hack:
     - Replace the dormer-area approximation walls with a single `createDormer`:
       - `hostRoofId: 'hf-roof-main'`
       - `positionOnRoof`: place on the east slope, near the south end (`alongRidgeMm: 6500, acrossRidgeMm: 1000` from ridge — tune visually)
       - `widthMm: 2400`, `wallHeightMm: 2400`, `depthMm: 2000`
       - `dormerRoofKind: 'flat'`
       - `wallMaterialKey: 'render_white'`
       - `hasFloorOpening: false` (the roof deck below is already a separate floor)
     - Add the sliding-glass doors (`operationType: 'sliding_double'`) on the dormer's south face

2. **Verify quality gates:**
   - `pnpm exec tsc --noEmit` clean
   - `pnpm vitest run` clean
   - `cd app && .venv/bin/pytest -q --no-cov tests/test_one_family_bundle_roundtrip.py tests/test_engine_*.py` clean (update assertions for the new element counts as needed)
   - `make verify` clean

3. **Visual verification via Playwright** — this is the gate that the previous agent skipped:
   - Start API + web: `make dev` (or equivalent — check `Makefile`)
   - Apply the new seed: `node scripts/apply-one-family-home.mjs`
   - Run Playwright screenshot capture against viewpoint `vp-ssw`. Use the existing `packages/web/e2e/` harness — find a baseline test like `cockpit-smoke.spec.ts` or `evidence-baselines.spec.ts` for the pattern. Add a new spec at `packages/web/e2e/seed-house-fidelity.spec.ts` that:
     - Loads the seed model
     - Switches to viewpoint `vp-ssw`
     - Takes a screenshot
     - Saves it as `seed-house-ssw-actual.png` next to `spec/target-house-vis-colored.png`
   - **Open both images side by side and visually compare.** Things to confirm match (or document the gap honestly):
     - Asymmetric off-center ridge with short steep east + long shallow west slope ✓
     - Picture-frame outline visible on the south upper facade ✓
     - Loggia recess clearly readable as a deep covered balcony ✓
     - Frameless glass balustrade on the balcony ✓
     - Standing-seam metal roof rendering as dark grey with visible vertical seams ✓
     - Light beige/grey vertical siding on ground floor ✓
     - Warm wood cladding on the recessed back wall ✓
     - Dormer cut-out clearly visible on the east roof slope ✓
   - **Iterate dimensions until the screenshot reads as the colour study.** If the ridge offset still looks weak, bump `ridgeOffsetTransverseMm` higher. If the loggia recess is hard to see, bump `setbackMm` to 1800 mm. If the frame doesn't read, thicken the sweep profile.

4. **Update tests:** `app/tests/test_one_family_bundle_roundtrip.py` and any seed-asserting tests will likely need element count + ID updates. Update assertions to match the new ground truth, do not weaken them.

**Acceptance.** The Playwright screenshot of the seed at viewpoint `vp-ssw` is a credible match for `spec/target-house-vis-colored.png` — the asymmetric massing, recessed loggia, picture-frame outline, dormer cut-out, and material colours all read correctly.

**Effort:** ~4-5 hours, but most of it is iteration on dimensions.

---

## When done

Append a status to `nightshift/seed-fidelity-status.md`:
- Commits shipped (with hashes)
- KRN-15 / KRN-16 / KRN-14 final state (KRN-14 likely `partial`; the others should be `done`)
- Visual fidelity assessment vs `target-house-vis-colored.png` — what matches well, what's still off, what would need follow-up
- Element counts of the final seed
- Pre-existing test regressions you discovered

Then stop.

## Important non-goals

- Do **not** redesign the architectural primitives. Implement what the tracker entries specify; don't invent new ones.
- Do **not** declare victory if tests pass but the screenshot doesn't match. Visual verification is a non-negotiable gate.
- Do **not** preserve the previous agent's two-walls-and-cut loggia hack. Replace it with KRN-16.
- Do **not** change the demo-main model UUID `75cd3d5c-f28c-5dd2-b8bf-8cbba71fd10f`.
- Do **not** revert any landed work from the overnight + dayshift runs. Treat the existing main as your starting point.

## Sequencing

WP 1 (KRN-15) → WP 2 (KRN-16) → WP 3 (KRN-14) → WP 4 (re-author + verify). Each WP commits to main individually; do not bundle them. Total estimated runtime: 18-22 hours of focused work. This is a long shift; pace accordingly.
