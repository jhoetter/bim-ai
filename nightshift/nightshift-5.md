# Nightshift Agent 5 — View Discipline (detail levels, elevations, isolate, pin, auto plan-view)

You are **Agent 5** of seven parallel AI engineers. Your theme is **the view subsystem**: detail-level rendering, named elevation views, temporary isolate/hide, pin/unpin, auto plan-view generation. You own branch `nightshift-5`. The user is asleep. Do not stop until your assigned WPs are done — then keep going on Wave-0 work.

---

## 0. Pre-flight (identical across all agents)

### Repo

`/Users/jhoetter/repos/bim-ai`. Read `spec/workpackage-master-tracker.md` (~1370 lines) end-to-end before starting.

### Six other agents are working in parallel

Branches `nightshift-1`, `nightshift-2`, `nightshift-3`, `nightshift-4`, `nightshift-6`, `nightshift-7`. Expect merge conflicts on `spec/workpackage-master-tracker.md` and `packages/core/src/index.ts`. Resolve and continue.

### Quality gates

1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run` (in package(s) you touched)
3. `cd app && .venv/bin/pytest -q --no-cov tests/<files-you-touched>`
4. `make verify` before merging to main

Never `--no-verify`. Never delete failing tests. Fix root causes.

### Branch + merge protocol per WP

```bash
git add -A
git commit -m "feat(<scope>): <WP-ID> — <one-line summary>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin nightshift-5

git fetch origin
git rebase origin/main
git push origin nightshift-5 --force-with-lease

git checkout main
git pull origin main
git merge nightshift-5 --ff-only
git push origin main
# if push fails (race), pull + retry from "git checkout main"

git checkout nightshift-5
```

Never force-push to main. `--force-with-lease` only on your own branch. If `--ff-only` fails 5 times, document `merge-blocked` and continue.

### Tracker update protocol

After each WP lands on main: change row's `State` to `done`, add `done in <commit-hash>`. Commit separately as `chore(tracker): mark <WP-ID> done`. Push, rebase, ff-merge.

### Anti-laziness directive

**Done means:** code written, tests added, all four gates pass, branch merged to main, tracker updated, commit visible on `origin/main`.

- After each WP, immediately start the next. No celebration, no summary, no pause.
- Bigger-than-expected WPs: finish them.
- After all assigned WPs, **do not stop**. Pick a Wave-0 WP, claim with `partial — in flight nightshift-5`, keep going.

### End-of-shift summary

Append `nightshift/nightshift-5-status.md` with shipped WPs (commit hashes), blocked WPs, observations, total commits. Then stop.

---

## 1. Your assigned workpackages

You have **six** WPs — the most of any agent. They cluster naturally and several are small. Sequence smallest-first to build velocity, then tackle the meatier ones.

### 1.1 — VIE-05: Plan view auto-generation when a level is created

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 5" → VIE-05.

**Why it matters.** Today: create level → manually go to View → New Plan View → select level. New flow: create level → bim-ai also creates a "<Level Name> — Plan" plan view automatically.

**Concrete scope:**

1. `CreateLevel` command in `app/bim_ai/commands.py` gains an optional `alsoCreatePlanView?: boolean` field (default `true`).

2. Engine (`app/bim_ai/engine.py`): when applying a `CreateLevel` with `alsoCreatePlanView !== false`, append a follow-up `CreatePlanView` command in the same bundle. Use the new level's name + " — Plan" as the plan view name.

3. UI: the create-level form (find via grep for `CreateLevel` in `packages/web/src/`) gains a checkbox "Also create plan view" (default checked). When checked, the UI sends both fields.

4. Tests:
   - pytest for engine: `CreateLevel` with `alsoCreatePlanView: true` results in two new elements
   - vitest for the UI form behaviour

**Acceptance.** Creating a level "Roof Deck" results in both the level and a "Roof Deck — Plan" plan view in the project browser without further user action.

**Files:** `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, the create-level UI component (find via grep), plus tests.

**Estimated time:** 2 hours.

---

### 1.2 — VIE-07: Pin element / unpin

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 5" → VIE-07.

**Why it matters.** Pinned elements (grids, levels, project base point, link models) shouldn't be moved accidentally. The 7-hour Revit course Hour 1 demonstrates the UP shortcut to unpin a CAD link before moving and re-pin after.

**Concrete scope:**

1. Add `pinned?: boolean` to the **base** element shape in `packages/core/src/index.ts`. It already exists on `link_model`; generalise the field to all kinds.

   This is a sensitive change because it's at the union root. To avoid breaking everything, add it as an optional field on each element kind individually (don't try to refactor the union). Or add a TypeScript intersection like `Element & { pinned?: boolean }` if the codebase supports that pattern. Check existing code patterns first.

2. Mirror in `app/bim_ai/elements.py` — every element model gets the optional `pinned: bool` field.

3. New commands `PinElement(elementId)` and `UnpinElement(elementId)` in `app/bim_ai/commands.py`.

4. Engine: any command that targets a pinned element (e.g. `MoveWallEndpoints`, `UpdateElementProperty`, `DeleteElement`) returns a `pinned_element_blocked` warning advisory (severity `error` to actually block) unless the command carries an explicit `forcePinOverride: true` flag.

5. UI: Inspector gets a pin toggle button. Selected pinned element shows a pin glyph in the corner of the selection halo. UP shortcut toggles pin state on selection (matches Revit).

6. Tests:
   - pytest for engine: pinned wall rejects `MoveWallEndpoints` unless `forcePinOverride: true`
   - vitest for Inspector pin toggle

**Acceptance.** Place a grid → click pin in Inspector → drag the grid endpoint: drag is blocked with a "pinned" tooltip. Press UP to unpin → drag works.

**Files:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, `packages/web/src/workspace/InspectorContent.tsx`, `packages/web/src/plan/PlanCanvas.tsx` (UP shortcut + selection halo), plus tests.

**Estimated time:** 3-4 hours.

---

### 1.3 — VIE-04: Temporary isolate / hide category

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 5" → VIE-04.

**Why it matters.** Used pervasively in Revit for debugging alignment, cleanup, verification (the 6-hour course Hour 6 uses Isolate Category to align a slightly off-center wall). View-local override that temporarily hides everything except a chosen category (Isolate) or hides only that category (Hide). Cleared when leaving the view or via "Reset Temporary Visibility".

**Concrete scope:**

1. Transient view state, lives in client store (not persisted in snapshot, no server commands needed): in `packages/web/src/state/store.ts`, add:

```ts
temporaryVisibility: {
  viewId: string;
  mode: 'isolate' | 'hide';
  categories: string[];
} | null;
```

with actions `setTemporaryVisibility`, `clearTemporaryVisibility`.

2. Renderer: in plan canvas + 3D viewport, when rendering an element, check temporary-visibility state for the active view and gate visibility accordingly.

3. UI:
   - Status bar: a "temporary visibility" chip with category list (showing "Isolate: Walls" or "Hide: Doors" etc.); click to clear
   - Right-click context menu on an element: "Isolate Category" / "Hide Category" entries
   - Keyboard shortcuts: HI = hide-isolate-toggle, HC = hide-category, HR = reset

4. Cross-view behaviour: switching to a different view automatically clears the temporary visibility (matches Revit). Wire this in the active-view-change handler.

5. Tests:
   - vitest for store actions
   - vitest for plan/3D rendering respecting temporary visibility
   - vitest for cross-view clearing

**Acceptance.** Right-click a wall → "Isolate Category" → only walls visible in current view. Click chip to clear. Switch view → temp visibility cleared automatically.

**Files:** `packages/web/src/state/store.ts`, `packages/web/src/plan/PlanCanvas.tsx`, `packages/web/src/Viewport.tsx`, status bar component (find via grep), context-menu component (find via grep), plus tests.

**Estimated time:** 3 hours.

---

### 1.4 — VIE-03: Named elevation views (N/S/E/W) + auto-generation

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 5" → VIE-03.

**Why it matters.** A first-class `elevation_view` element kind, separate from `section_cut` (although they share the projection engine). Each elevation has a `direction: 'north' | 'south' | 'east' | 'west' | 'custom'` and a name. Auto-generated when creating a project from template (one elevation per cardinal direction).

**Concrete scope:**

1. New element kind in `packages/core/src/index.ts`:

```ts
{
  kind: 'elevation_view';
  id: string;
  name: string;
  direction: 'north' | 'south' | 'east' | 'west' | 'custom';
  customAngleDeg?: number;
  cropMinMm?: { xMm: number; yMm: number };
  cropMaxMm?: { xMm: number; yMm: number };
  scale: number;
  planDetailLevel?: 'coarse' | 'medium' | 'fine';
  visibilityOverrides?: ViewFilter[];
}
```

Mirror in `app/bim_ai/elements.py`.

2. Engine: reuse the `section_cut` projection pipeline as much as possible. Add a thin wrapper that converts elevation params to section-cut equivalents (north → section line oriented east-west on the north edge of the bounding box, looking north).

3. New command `CreateElevationView(direction, name)`. Auto-orient by default; `customAngleDeg` only used when `direction: 'custom'`.

4. Renderer:
   - Plan canvas: triangular marker pointing in the cardinal direction (similar to section bubble but distinct)
   - Double-click marker enters the elevation view
   - Elevation view itself reuses the existing section view rendering pipeline

5. Project Browser: new "Elevations" group in the tree.

6. Tests:
   - vitest for marker rendering
   - pytest for engine command + projection
   - vitest for the project browser's elevations group

**Acceptance.** Right-clicking on a plan canvas → "Add Elevation: North" creates an elevation_view oriented north; double-clicking the marker opens the elevation view in the central canvas.

**Files:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, `app/bim_ai/section_projection_primitives.py` (or wherever section projection lives), `packages/web/src/plan/planProjection.ts`, `packages/web/src/workspace/ProjectBrowser.tsx`, plus tests.

**Estimated time:** 4 hours.

---

### 1.5 — ANN-02: Section / elevation generation from a wall face

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Annotation / 2D linework" → ANN-02.

**Why it matters.** A right-click shortcut that creates a section_cut (or elevation_view from VIE-03) perpendicular to a selected wall face — a common Revit workflow.

**Concrete scope:**

1. Right-click context menu on a wall (in 3D viewport or plan canvas) gains:
   - "Generate Section Cut" — creates `section_cut` perpendicular to the wall midpoint, with crop sized to fit the wall + 2m
   - "Generate Elevation" — creates `elevation_view` (from VIE-03) oriented to face the wall, with sensible crop

2. Both commands compute the section/elevation parameters from the wall geometry (start, end, normal direction).

3. New plan_view created automatically with the new section/elevation as its scope.

4. Tests:
   - vitest for the commands producing valid section/elevation elements
   - vitest for the right-click menu integration

**Acceptance.** Right-click a wall in 3D → "Generate Elevation" → an elevation_view is created perpendicular to the wall, the elevation marker appears in plan, and a new plan view opens displaying the elevation.

**Files:** `packages/web/src/Viewport.tsx` (right-click menu hookup), `packages/web/src/plan/PlanCanvas.tsx` (same), helper file like `packages/web/src/lib/sectionElevationFromWall.ts`, plus tests.

**Sequencing:** depends on VIE-03 (1.4 above) for the elevation case. Do VIE-03 first; ANN-02 follows.

**Estimated time:** 2 hours (after VIE-03).

---

### 1.6 — VIE-01: Detail levels render binding

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 5" → VIE-01. **Status is `partial`** — data model + tests + Inspector field exist; rendering doesn't yet differentiate.

**Why it matters.** `planDetailLevel: 'coarse' | 'medium' | 'fine'` already exists on `plan_view` and is referenced in `planProjection.test.ts`. This WP completes the binding so rendering visibly differs across the three levels.

**Concrete scope:**

1. In plan projection (`packages/web/src/plan/planProjection.ts` and `planProjectionWire.ts`):
   - **Coarse**: outer wall outline only (single line per wall)
   - **Medium**: outer + core boundaries (two lines per wall — the outer face and the inner-core face)
   - **Fine**: full layer stack — all layer boundaries from FL-08 (`wallTypeCatalog`)

2. Other element kinds get analogous gating:
   - Doors: Coarse = single line + swing arc; Medium = swing arc + frame; Fine = full plan symbol with frame thickness
   - Windows: Coarse = single line; Medium = frame + glass line; Fine = full plan symbol
   - Stairs: Coarse = path arrow only; Medium = path + simplified treads; Fine = full tread/riser detail
   - Curtain walls: Coarse = single line; Medium = grid lines; Fine = grid + mullions

3. Active detail level read from `plan_view.planDetailLevel`. The currently-selected view drives rendering.

4. Add a quick-toggle to the canvas toolbar: Coarse/Medium/Fine selector (visible at the bottom of the plan canvas, matches Revit's "View Control Bar" position).

5. Tests:
   - Update existing `planProjection.test.ts` to assert different element counts at each detail level
   - vitest for the toolbar selector

**Acceptance.** Switching the demo plan view from Fine → Coarse visibly simplifies the rendering (single wall lines instead of layer stack, no mullion grid in curtain walls). The toolbar selector cycles all three states.

**Files:** `packages/web/src/plan/planProjection.ts`, `packages/web/src/plan/planProjectionWire.ts`, `packages/web/src/plan/PlanCanvas.tsx` (toolbar), plus tests.

**Estimated time:** 4 hours.

---

## 2. File ownership and conflict avoidance

You own:
- View state in `packages/web/src/state/store.ts` (only the `temporaryVisibility` slice)
- Plan projection (`planProjection.ts`, `planProjectionWire.ts`)
- `PlanCanvas.tsx` toolbar additions
- Project browser elevations group
- Status bar / context menu visibility chips
- Section/elevation projection wiring in `app/bim_ai/section_projection_primitives.py`
- New helper files

Shared territory:
- `packages/core/src/index.ts` — append your additions (elevation_view kind, pin field on base shape); other agents are also extending. Append at end.
- `app/bim_ai/elements.py` — same
- `app/bim_ai/commands.py` — append your commands
- `app/bim_ai/engine.py` — engine wiring
- `packages/web/src/Viewport.tsx` — Agent 4 is touching this for origin markers; you only add right-click menu wiring (ANN-02) — use a separate handler if possible
- `packages/web/src/plan/PlanCanvas.tsx` — Agent 2 may touch for door/window plan symbols; you only add the toolbar selector + temporary-visibility hookup
- `packages/web/src/workspace/InspectorContent.tsx` — for the pin toggle (WP 1.2); other agents are not heavy here, should be safe
- `spec/workpackage-master-tracker.md` — only your six rows

Avoid:
- `packages/web/src/viewport/meshBuilders.ts` (Agents 1-3)
- `packages/web/src/families/*` (Agents 2 + 7)
- `packages/web/src/familyEditor/*` (Agent 7)
- `app/bim_ai/export_ifc.py` (Agent 1)

If an Edit fails because surrounding code changed, `git pull --rebase origin main`, re-read the file, redo the edit.

---

## 3. Go

Read `spec/workpackage-master-tracker.md` end-to-end. Then start WP 1.1 (VIE-05 plan-view auto-gen, simplest) and proceed in order through 1.6 (VIE-01 detail-level rendering). Don't pause. Don't celebrate. Don't summarise mid-shift. The "End-of-shift summary" comes only when every WP is done and you've worked Wave-0 leftovers.
