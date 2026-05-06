# Nightshift Agent 1 — Roof Renderer + IFC Roof Exchange

You are **Agent 1** of seven parallel AI engineers working bim-ai backlog overnight. Your theme is **roof geometry rendering and IFC roof export**. You own branch `nightshift-1`. The user will be asleep — you will not get clarification. Do not stop until every WP below is shipped or you have exhausted every reasonable attempt.

---

## 0. Pre-flight (read every word; identical across all agents)

### Repo

Working directory: `/Users/jhoetter/repos/bim-ai`. Mono-repo with TypeScript `packages/` (web + core + cli) and Python `app/`. Source of truth for outstanding work is `spec/workpackage-master-tracker.md` — every WP referenced below has a detailed entry there with data-model snippets, acceptance criteria, and effort estimates. **Read the tracker entry for each WP before you start it.**

### Other agents are working in parallel

Six other agents are working their own branches (`nightshift-2` through `nightshift-7`) at the same time as you. They are touching different thematic slices but **`spec/workpackage-master-tracker.md` and `packages/core/src/index.ts` will see write traffic from multiple agents**. You will encounter merge conflicts — resolve them and keep going. Never assume you are alone.

### Quality gates (every commit must pass these before push)

1. `pnpm exec tsc --noEmit` — TypeScript clean across the workspace
2. `pnpm --filter @bim-ai/web run test run` (or `pnpm vitest run` in the relevant package) — vitest passes
3. `cd app && .venv/bin/pytest -q --no-cov tests/<the-tests-you-touched>` — pytest passes for any Python you changed (run targeted, not the whole suite — the whole suite is too slow for nightshift cadence)
4. `make verify` — the project's overall gate (run before merging to main, even if slow)

If any of these fail, **fix the root cause**. Do not skip with `-x`, `--no-verify`, or by deleting failing tests. If a test is unrelated and pre-existing-broken, leave it alone but note it in your end-of-shift summary.

### Branch + merge protocol per WP

After implementing **each** WP locally:

```bash
# 1. Verify gates locally
pnpm exec tsc --noEmit
make verify

# 2. Commit on your branch with a descriptive message
git add -A   # or specific paths
git commit -m "feat(<scope>): <WP-ID> — <one-line summary>

<longer description if useful>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

# 3. Push branch
git push origin nightshift-1

# 4. Rebase onto latest main and try fast-forward merge
git fetch origin
git rebase origin/main
# resolve any conflicts; re-run gates after resolving
git push origin nightshift-1 --force-with-lease

# 5. Fast-forward merge to main
git checkout main
git pull origin main
git merge nightshift-1 --ff-only
git push origin main
# if push fails (race with another agent), pull and retry from "git checkout main"

# 6. Back to your branch
git checkout nightshift-1
```

**Rules:**
- Never `git push --force` to `main`. `--force-with-lease` is allowed only on your own branch.
- Never use `--no-verify`, `--no-gpg-sign`, or any flag that skips hooks.
- Never `git reset --hard` shared history.
- If `git merge nightshift-1 --ff-only` fails because main moved, pull main, rebase your branch onto main again, force-with-lease your branch, then retry the ff-merge. Loop up to 5 times — if you still cannot merge, log the WP as "merge-blocked" in your end-of-shift summary and continue with the next WP.

### Tracker update protocol

After each WP lands on main, update `spec/workpackage-master-tracker.md`:

1. Find the row for your WP ID.
2. Change its `State` column from `open` (or `partial`) to `done`.
3. Add a brief inline note in the Note column referencing the commit hash, like `done in 9337befc`.
4. Commit the tracker change as a separate commit on your branch with message `chore(tracker): mark <WP-ID> done`.
5. Push, rebase, ff-merge to main using the same protocol above.

**Tracker conflicts will happen.** Other agents will be marking their own rows. When you `git rebase origin/main` and hit a tracker conflict, the resolution is almost always trivial: keep both edits (yours and theirs). Use `git checkout --theirs` for everyone else's row, manually edit your row, `git add`, `git rebase --continue`.

### Anti-laziness directive

**This is the most important section.** AI engineers tend to declare victory prematurely. You will not.

- "Done" means: code written, tests added, all four quality gates pass, branch merged to main, tracker updated, your commit visible on `origin/main`. Anything less is **not done**.
- After each WP you ship, immediately start the next WP. Do not pause to summarise. Do not write congratulations. Do not write a status report mid-shift. Just continue.
- If a WP turns out larger than expected, **finish it**. Do not punt to a follow-up WP. The whole point of overnight work is uninterrupted execution.
- If you genuinely cannot finish a WP (e.g. requires a design decision you can't make autonomously, or requires a dependency that another agent owns and hasn't shipped yet), document the blocker and move on — but the bar for "cannot finish" is high. Almost all your WPs are designed to be shippable autonomously.
- After all your assigned WPs are done, **do not stop**. Open `spec/workpackage-master-tracker.md`, find the "Wave 0 — start today, all parallel" list in the Cross-Epic Dependency Map section, pick a WP that is still `open` and not currently being worked by another agent (you cannot tell directly, but smaller standalone Kernel / View / Annotation WPs are safe bets), claim it by marking the row `partial — in flight nightshift-1`, and start it.

### End-of-shift summary

When you genuinely have nothing left to do (every assigned WP done plus you've exhausted Wave-0 standalone work), append a status to `nightshift/nightshift-1-status.md`:

- WPs shipped (with commit hashes)
- WPs attempted but blocked (with reasons)
- Anything you noticed in passing that the user should know about
- Total commits on main attributable to nightshift-1

Then stop.

---

## 1. Your assigned workpackages

You own three WPs in this order. Work them sequentially — don't context-switch.

### 1.1 — KRN-11: Asymmetric gable roof

**Tracker entry:** `spec/workpackage-master-tracker.md` § "Standalone Backlog" → "Kernel + element kinds" + the **KRN-11 detail** block. Read it.

**Why it matters.** The target demo seed house (`spec/target-house-seed.md` §1.2) has the ridge significantly off-center east, with very different east/west wall heights. Today's `gable_pitched_rectangle` mode is symmetric — there is no way to author this house's core architectural feature.

**Concrete scope:**

1. Extend `roof` shape in `packages/core/src/index.ts`:
   - Add `'asymmetric_gable'` to the `roofGeometryMode` union
   - Add `ridgeOffsetTransverseMm?: number` (signed offset of ridge from rectangle center, perpendicular to ridge axis)
   - Optionally add `eaveHeightLeftMm?: number` and `eaveHeightRightMm?: number` as an alternative parametrisation

2. Mirror in `app/bim_ai/elements.py` (`RoofElem`).

3. Extend `makeRoofMassMesh` in `packages/web/src/viewport/meshBuilders.ts`:
   - When `roofGeometryMode === 'asymmetric_gable'`, generate a roof mesh whose ridge is offset transversely from center. Left and right pitch slopes meet at the off-center ridge with different angles.
   - Section view (`app/bim_ai/section_projection_primitives.py`) uses the same offset-ridge logic.

4. Add `roofHeightAtPoint` support for asymmetric gables (used by curtain wall gable triangle glazing in `meshBuilders.ts:1234`).

5. Tests:
   - Add `packages/web/src/viewport/meshBuilders.asymmetricRoof.test.ts` asserting vertex positions for a `ridgeOffsetTransverseMm` of 1500mm on a 6000mm-wide rectangle yield correct left/right pitch.
   - Update or add Python test in `app/tests/test_export_gltf.py` (or sibling) verifying the manifest correctly tags asymmetric roofs.

**Acceptance.**
- Authoring `roofGeometryMode: 'asymmetric_gable'` with `ridgeOffsetTransverseMm: 2000` produces a 3D mesh with visibly different left and right slopes.
- The seeded demo house can be updated to use this mode (do not commit a seed change unless verified visually correct).

**Files you will touch:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `packages/web/src/viewport/meshBuilders.ts`, possibly `app/bim_ai/roof_geometry.py`, plus tests.

**Estimated time:** 5-6 hours.

---

### 1.2 — IFC-01: `roofTypeId` round-trip through IFC

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Exchange formats" table → IFC-01.

**Why it matters.** Kernel has the `roofTypeId` field; `app/bim_ai/export_ifc.py` doesn't write it. When IFC is re-parsed for `authoritativeReplay_v0`, the `roofTypeId` is omitted, so the replay loses type information.

**Concrete scope:**

1. In `app/bim_ai/export_ifc.py`, find the roof export path (`try_build_kernel_ifc` or its descendants). When emitting `Pset_RoofCommon`, attach `roofTypeId` as a new property (Revit uses `Pset_RoofCommon.Reference` for the kernel id today; pick a different property name, e.g. `BimAiRoofTypeId` under a new `Pset_BimAiKernel` if `Pset_RoofCommon` is reserved).
2. In the import-replay path (`build_kernel_ifc_authoritative_replay_sketch_v0` in the same file), parse the new property and write it into the `createRoof` command.
3. Update `inspect_kernel_ifc_semantics()` to count IfcRoof instances carrying the new property.
4. Add a test in `app/tests/test_export_ifc.py` for round-trip: author roof with `roofTypeId: 'wall_type:gable'` → export IFC → re-parse → verify `roofTypeId` preserved.

**Acceptance.**
- Round-trip preserves `roofTypeId`.
- `inspect_kernel_ifc_semantics()` includes a new counter for typed roofs.

**Files:** `app/bim_ai/export_ifc.py`, `app/tests/test_export_ifc.py`.

**Estimated time:** 2 hours.

---

### 1.3 — IFC-02: Distinguish `gable_pitched_rectangle` (and `asymmetric_gable`) in IFC body

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Exchange formats" table → IFC-02.

**Why it matters.** Today the kernel always emits an extruded prism mass for roofs regardless of `roofGeometryMode`. A receiving IFC tool (e.g. Solibri, Navisworks) can't tell a flat roof from a gable from an asymmetric gable. After IFC-02, the IFC body geometry distinguishes the geometry mode.

**Concrete scope:**

1. In `app/bim_ai/export_ifc.py`, the roof body generation path:
   - For `gable_pitched_rectangle`: build an extruded triangular prism (gable shape) instead of a flat-top prism. Use IfcExtrudedAreaSolid with an L-section or polygon profile that captures the gable cross-section.
   - For `asymmetric_gable` (after KRN-11 ships — sequence this WP after 1.1 lands on main): same approach with the ridge offset.
   - For `flat`: keep the existing flat prism (already correct).
   - For `mass_box`: keep the existing flat prism but with a comment noting it's a proxy.
   - For `hip` / `l_shape`: skip into the existing skip-counter; these need full polyhedral solids and are out of scope for this WP.

2. Update `summarize_kernel_ifc_semantic_roundtrip` to verify the round-tripped IFC body kind matches the kernel `roofGeometryMode`.

3. Tests in `app/tests/test_export_ifc.py`: assert that a `gable_pitched_rectangle` roof exports a triangular extrusion, not a flat one.

**Acceptance.**
- IFC export of a gable roof produces visibly-pitched IFC geometry (verified by re-parsing the IFC and checking the body type / cross-section shape).
- Round-trip test passes.

**Files:** `app/bim_ai/export_ifc.py`, `app/tests/test_export_ifc.py`.

**Estimated time:** 3 hours.

---

## 2. File ownership and conflict avoidance

You own:
- `packages/web/src/viewport/meshBuilders.ts` — roof mesh code (other agents may touch wall / floor / curtain mesh code; coordinate by appending or editing different functions)
- `app/bim_ai/export_ifc.py` — IFC export
- `app/bim_ai/roof_geometry.py` — roof helpers
- New test files you create

You will edit (shared territory — be careful):
- `packages/core/src/index.ts` — append your `RoofGeometryMode` union extension at the existing union; don't reorder
- `app/bim_ai/elements.py` — same, append
- `spec/workpackage-master-tracker.md` — only your three rows

Avoid:
- `packages/web/src/Viewport.tsx` (other agents are modifying it)
- `packages/web/src/viewport/meshBuilders.ts` *outside* of `makeRoofMassMesh` and `roofHeightAtPoint` — Agent 2 (windows) and Agent 3 (materials) may also touch this file
- `packages/web/src/plan/PlanCanvas.tsx` (multiple agents)

If an Edit fails because the surrounding code changed, `git pull --rebase origin main`, re-read the file, redo the edit.

---

## 3. Go

Start now. Read `spec/workpackage-master-tracker.md` end-to-end first (it's only ~1370 lines), then begin WP 1.1 (KRN-11). Do not stop until you reach the "End-of-shift summary" step.
