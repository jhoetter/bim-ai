# Nightshift Agent 3 — Materials Catalog & Curtain Wall Panels

You are **Agent 3** of seven parallel AI engineers. Your theme is **material rendering and curtain wall panel kinds**. You own branch `nightshift-3`. The user is asleep. Do not stop until your assigned WPs are done — then keep going on Wave-0 work.

---

## 0. Pre-flight (identical across all agents)

### Repo

`/Users/jhoetter/repos/bim-ai`. Read `spec/workpackage-master-tracker.md` (~1370 lines) end-to-end before starting — every WP below has a detailed entry there with data-model snippets, acceptance, and effort.

### Six other agents are working in parallel

Branches `nightshift-1`, `nightshift-2`, `nightshift-4` … `nightshift-7` are concurrent. They touch different thematic slices, but `spec/workpackage-master-tracker.md`, `packages/core/src/index.ts`, and `packages/web/src/viewport/meshBuilders.ts` will see write traffic from multiple agents. **Expect merge conflicts. Resolve them and continue.**

### Quality gates

1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run` (in package(s) you touched)
3. `cd app && .venv/bin/pytest -q --no-cov tests/<files-you-touched>`
4. `make verify` before merging to main

Never use `--no-verify`, never skip tests, never delete failing tests. Fix root causes.

### Branch + merge protocol per WP

```bash
git add -A
git commit -m "feat(<scope>): <WP-ID> — <one-line summary>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin nightshift-3

git fetch origin
git rebase origin/main
# resolve conflicts; re-run gates
git push origin nightshift-3 --force-with-lease

git checkout main
git pull origin main
git merge nightshift-3 --ff-only
git push origin main
# if push fails (race), pull and retry from "git checkout main"

git checkout nightshift-3
```

Never `git push --force` to main. `--force-with-lease` only on your own branch. If `--ff-only` fails 5 times, document as `merge-blocked` and continue.

### Tracker update protocol

After each WP lands on main: change row's `State` to `done`, add inline note `done in <commit-hash>`. Commit separately as `chore(tracker): mark <WP-ID> done`. Push, rebase, ff-merge.

Tracker conflicts will happen — resolve by keeping both edits.

### Anti-laziness directive

**Done means:** code written, tests added, all four gates pass, branch merged to main, tracker updated, commit visible on `origin/main`. Anything less is **not done**.

- After each WP, immediately start the next. No celebration, no summary, no pause.
- If a WP is bigger than expected, finish it. Don't punt.
- The bar for "I cannot finish this" is high.
- After all assigned WPs ship, **do not stop**. Pick a Wave-0 standalone WP from the tracker, claim it (mark row `partial — in flight nightshift-3`), and keep going.

### End-of-shift summary

Append `nightshift/nightshift-3-status.md` with shipped WPs (commit hashes), blocked WPs, observations, total commits attributable to nightshift-3. Then stop.

---

## 1. Your assigned workpackages

Two big WPs (MAT-01 has two parts; treat them as one shipping unit). Sequential.

### 1.1 — MAT-01: Material catalog enrichment + standing-seam metal roof rendering

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Materials & visual rendering" → MAT-01 + the **MAT-01 detail** block.

**Why it matters.** Today's catalog covers a handful of `materialKey`s (`timber_cladding`, `white_cladding`, `white_render`). The target-house demo (`spec/target-house-seed.md` §1.7) needs more breadth (light beige siding, warm wood, dark grey aluminium frames) and one real visual gap: standing-seam metal roof rendering. Today's roof is a flat colour — no visible seams.

**Concrete scope:**

#### Part A — catalog breadth

1. In `packages/web/src/viewport/materials.ts`, extend the material registry. Each material key gets PBR parameters: `baseColor` (hex), `roughness`, `metalness`, optional `normalMapUrl`, optional `hatchPattern` (for plan/section), `category` (for filtering).

2. Add the following `materialKey` entries (with sensible PBR values; Three.js docs and target-house §1.7 are your guide for colour values):
   - **Cladding variants:** `cladding_beige_grey` (#c4b59a), `cladding_warm_wood` (#a87a44), `cladding_dark_grey` (#3a3d3f)
   - **Render variants:** `render_light_grey` (#cfd0cd), `render_beige` (#d8c8a8), `render_terracotta` (#a85432)
   - **Aluminium:** `aluminium_dark_grey` (#3d4042, metalness 0.6, roughness 0.3), `aluminium_natural` (#a8acaf, metalness 0.85, roughness 0.2), `aluminium_black` (#1c1d1e, metalness 0.55, roughness 0.4)
   - **Brick:** `brick_red` (#8a3a26), `brick_yellow` (#c5a857), `brick_grey` (#7a7873)
   - **Stone:** `stone_limestone` (#d8d0bc), `stone_slate` (#3e3a35), `stone_sandstone` (#b89968)
   - **Concrete:** `concrete_smooth` (#9c9a94, roughness 0.7), `concrete_board_formed` (#a8a59c, roughness 0.85, normal-map of board pattern if you can author one)
   - **Glass variants:** `glass_clear` (existing default), `glass_low_iron` (slightly less green tint), `glass_fritted` (semi-translucent ceramic-fritted), `glass_obscured` (heavily diffused)
   - **Metal roof variants:** `metal_standing_seam_dark_grey` (#3a3d3f, metalness 0.7, roughness 0.35), `metal_standing_seam_zinc` (#7a7d80), `metal_standing_seam_copper` (#b86b3c)

3. Mirror in `app/bim_ai/material_catalog.py` (or wherever the kernel-side material registry lives — grep for `material_key` to find).

4. Existing element rendering paths (wall, roof, floor, etc.) should pick up the new keys automatically via the existing `materialKey` field plumbing. If any rendering path hardcodes a switch on `materialKey === 'timber_cladding'`, generalise it to look up the catalog entry.

5. Tests: vitest in `packages/web/src/viewport/materials.test.ts` extending the existing test to assert new keys are present and resolve to MeshStandardMaterial with the expected PBR values.

#### Part B — standing-seam metal roof rendering

1. New helper in `packages/web/src/viewport/meshBuilders.ts`: `addStandingSeamPattern(roofMesh, seamSpacingMm, seamHeightMm)` analogous to today's `addCladdingBoards(wallMesh, …)`. It adds raised vertical seams (small extruded ridges) along the slope of a roof every `seamSpacingMm` (default 600mm), each `seamHeightMm` tall (default 25mm).

2. Trigger in `makeRoofMassMesh`: when `roof.materialKey?.startsWith('metal_standing_seam_')`, call `addStandingSeamPattern` after generating the base roof mesh. Seams run perpendicular to the eave (i.e. up the slope).

3. For **flat roofs** (`roofGeometryMode: 'flat'`), seams run parallel to one edge — pick the longer rectangle dimension as the seam direction.

4. For **gable / asymmetric_gable roofs**, seams run perpendicular to the ridge.

5. Edge cases:
   - Standing-seam pattern is visible at any sensible camera distance — keep seam height in the 20-30mm range so it's visible at building-scale but not overwhelming
   - Don't apply standing-seam to non-metal materials

6. Tests: vitest verifying the seam-decorated mesh has substantially more vertices than the un-decorated one for the same roof.

**Acceptance.**
- Authoring a roof with `materialKey: 'metal_standing_seam_dark_grey'` shows visible vertical seams in 3D at a rate of ~600mm spacing.
- Every material key listed in target-house-seed.md §1.7 (Material + Colour Summary) resolves to a registered catalog entry.
- The seeded demo house **could** be updated to use the new keys (don't change the seed in this WP — separate concern).

**Files:** `packages/web/src/viewport/materials.ts`, `packages/web/src/viewport/meshBuilders.ts`, `app/bim_ai/material_catalog.py` (or equivalent), plus tests.

**Estimated time:** 5-6 hours total (Part A: 2-3h, Part B: 3h).

---

### 1.2 — KRN-09: Curtain wall panel kinds

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Kernel + element kinds" → KRN-09 + the **KRN-09 detail** block.

**Why it matters.** Today curtain walls are a uniform grid of glass. Real curtain walls let the user replace individual panels: empty (no glass), system (custom material — Hour 6 of the Revit course uses an "Empty System Panel" for a slatted wooden facade screen), or family-instance (a door, a vent, a custom slat assembly). The target-house seed doesn't currently rely on this but it's foundational for facade modelling.

**Concrete scope:**

1. Extend the `wall` shape (curtain-wall path) in `packages/core/src/index.ts`:

```ts
{
  // ... existing curtain wall fields preserved (isCurtainWall, curtainWallVCount, curtainWallHCount, materialKey)
  curtainPanelOverrides?: {
    [gridCellId: string]: {
      kind: 'empty' | 'system' | 'family_instance';
      familyTypeId?: string;     // for family_instance
      materialKey?: string;       // for system
    };
  };
}
```

`gridCellId` is a deterministic string like `"v3h1"` for column 3, row 1 of the curtain grid (zero-indexed; `v` = vertical column index, `h` = horizontal row index).

Mirror in `app/bim_ai/elements.py`.

2. Renderer: in `makeCurtainWallMesh` (`packages/web/src/viewport/meshBuilders.ts:1163`), iterate the grid cells and for each cell:
   - If no override or `kind: 'system'` with default `materialKey`: existing glass behaviour
   - If `kind: 'empty'`: skip the glass pane (leave the grid open); mullions still render
   - If `kind: 'system'` with custom `materialKey`: render a solid panel using that material
   - If `kind: 'family_instance'`: depends on FAM-01 (nested families), which is in another epic and not shipping tonight — render a placeholder solid panel with a warning material (`materialKey: 'placeholder_unloaded'`) and add a `// TODO(FAM-01): instantiate family ${familyTypeId}` comment

3. Plan canvas: panel overrides show as different fills in the plan symbol (empty = white, system = material colour, family_instance = placeholder hatch).

4. **Engine command:** new `SetCurtainPanelOverride(wallId, gridCellId, override)` in `app/bim_ai/commands.py` and `engine.py`.

5. Tests:
   - vitest for `makeCurtainWallMesh` verifying empty panels are missing geometry
   - vitest for system-panel material assignment
   - pytest for the engine command

**Acceptance.**
- Authoring a curtain wall and overriding cell `v0h0` with `{ kind: 'empty' }` produces a curtain wall where that one cell has no glass (mullions still present).
- Overriding with `{ kind: 'system', materialKey: 'cladding_warm_wood' }` produces a wood panel in that cell.
- Family-instance overrides render a placeholder with a TODO comment until FAM-01 lands.

**Files:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, `packages/web/src/viewport/meshBuilders.ts`, plus tests.

**Estimated time:** 4 hours.

---

## 2. File ownership and conflict avoidance

You own:
- `packages/web/src/viewport/materials.ts` — materials registry
- `addStandingSeamPattern` and `addCladdingBoards` helpers in `meshBuilders.ts`
- Curtain wall mesh building (`makeCurtainWallMesh` and its helpers)
- `app/bim_ai/material_catalog.py` (or equivalent)
- New test files

Shared territory:
- `packages/core/src/index.ts` — append your additions; Agent 1 (roof) and Agent 2 (door/window) are also adding fields to wall/roof. Append at the end of each shape definition.
- `app/bim_ai/elements.py` — same
- `packages/web/src/viewport/meshBuilders.ts` — Agent 1 owns `makeRoofMassMesh` (so the standing-seam hookup goes inside it but coordinate carefully with Agent 1's KRN-11 changes); Agent 2 owns door/window CSG path; you own curtain wall + materials
- `app/bim_ai/commands.py` — append your commands
- `spec/workpackage-master-tracker.md` — only your two rows

Sequencing note: Agent 1 is shipping KRN-11 (asymmetric gable roof) which also touches `makeRoofMassMesh`. Standing-seam pattern integration likely needs a rebase after KRN-11 lands. Watch `origin/main` and rebase when KRN-11 is in.

Avoid:
- `packages/web/src/Viewport.tsx`
- `packages/web/src/plan/PlanCanvas.tsx` (Agent 5 area)
- `packages/web/src/familyEditor/*` (Agent 7)
- `app/bim_ai/export_ifc.py` (Agent 1)

If an Edit fails because surrounding code changed, `git pull --rebase origin main`, re-read the file, redo the edit.

---

## 3. Go

Read `spec/workpackage-master-tracker.md` end-to-end. Then start WP 1.1 (MAT-01 Part A first, then Part B). Do not pause until you reach the "End-of-shift summary" step.
