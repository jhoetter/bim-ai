# Nightshift Agent 7 — Family editor depth (sweep, mirror, conditional formulas, flex mode)

You are **Agent 7** of seven parallel AI engineers. Your theme is **family editor capabilities**: sweep tool, mirror tool, conditional formula evaluator, family flex test mode. You own branch `nightshift-7`. The user is asleep. Do not stop until your assigned WPs are done — then keep going on Wave-0 work.

---

## 0. Pre-flight (identical across all agents)

### Repo

`/Users/jhoetter/repos/bim-ai`. Read `spec/workpackage-master-tracker.md` (~1370 lines) end-to-end before starting.

### Six other agents are working in parallel

Branches `nightshift-1` … `nightshift-6`. Expect merge conflicts on `spec/workpackage-master-tracker.md` and `packages/core/src/index.ts`. Resolve and continue.

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
git push origin nightshift-7

git fetch origin
git rebase origin/main
git push origin nightshift-7 --force-with-lease

git checkout main
git pull origin main
git merge nightshift-7 --ff-only
git push origin main
# if push fails, pull + retry from "git checkout main"

git checkout nightshift-7
```

Never force-push to main. `--force-with-lease` only on your own branch. If `--ff-only` fails 5 times, document `merge-blocked` and continue.

### Tracker update protocol

After each WP lands on main: change row's `State` to `done`, add `done in <commit-hash>`. Commit separately as `chore(tracker): mark <WP-ID> done`. Push, rebase, ff-merge.

### Anti-laziness directive

**Done means:** code written, tests added, all four gates pass, branch merged to main, tracker updated, commit visible on `origin/main`.

- After each WP, immediately start the next. No celebration, no summary, no pause.
- Bigger-than-expected WPs: finish them.
- After all assigned WPs, **do not stop**. Pick a Wave-0 WP, claim with `partial — in flight nightshift-7`, keep going.

### End-of-shift summary

Append `nightshift/nightshift-7-status.md` with shipped WPs (commits), blocked WPs, observations, total commits. Then stop.

---

## 1. Your assigned workpackages

Four WPs in this order (smallest first to build velocity).

### 1.1 — FAM-09: Family flex test mode

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 4 — Family System Depth" → FAM-09.

**Why it matters.** Every parametric family in the Revit course is "flexed" before save — you author with default values, then in flex mode type test values and watch the family update without committing the test values to types. This is the standard authoring verification step.

**Concrete scope:**

1. In `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx` (already exists from V2-11), add a `flexMode: boolean` state and `flexValues: Record<paramName, value>` map.

2. UI:
   - Toolbar gets a "Flex" toggle button (matches Revit visual)
   - When `flexMode` is on, sidebar shows current flex parameters; user types values in test inputs
   - Editor canvas re-resolves family geometry using `flexValues` overrides instead of `defaultValues`
   - "Reset" button reverts flex inputs
   - Toggling flex mode off discards flex values; default values are unchanged

3. Resolution: refactor the family-geometry resolution path so it accepts an optional `paramOverrides` argument. When `flexMode` is on, pass `flexValues`; otherwise pass nothing (uses defaults).

4. Tests: vitest in `packages/web/src/familyEditor/FamilyEditorWorkbench.test.tsx`:
   - Enter flex mode, set Width = 1500, verify canvas resolves with 1500 even though default is 1200
   - Exit flex mode, verify default value is unchanged in the family definition

**Acceptance.** Open a parametric door family; toggle Flex; type Rough Width = 1500 in the flex sidebar; door visibly resizes; toggle Flex off; defaults unchanged in the saved family.

**Files:** `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`, possibly `packages/web/src/families/familyResolver.ts` (or wherever family resolution happens — grep for `defaultValues` or `defaultParams`), plus tests.

**Estimated time:** 3 hours.

---

### 1.2 — FAM-07: Mirror tool (axis reflection in family editor + projects)

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 4" → FAM-07.

**Why it matters.** Axis-based reflection of an element or geometry. Mirror a window family across its center reference plane in the family editor; mirror an entire wing of a house across the entry axis in a project. Used pervasively in real architecture.

**Concrete scope:**

1. New command `MirrorElements` in `app/bim_ai/commands.py`:

```py
class MirrorElementsCmd:
    elementIds: list[str]
    axis: { startMm: { xMm, yMm }, endMm: { xMm, yMm } }
    alsoCopy: bool   # when True, original elements are kept and mirrored copies are added; when False, originals are mirrored in place
```

2. Engine in `app/bim_ai/engine.py`: per-kind mirror transforms:
   - **Wall:** swap start/end across axis (reflected); recompute hosted openings' alongT
   - **Door / Window:** alongT = 1 - alongT after host wall is mirrored
   - **Floor / Room / Ceiling:** reflect boundary polygon vertex order (also reverse winding)
   - **Family instance:** add a `mirrored: bool` flag to the instance, or compute geometry mirrored at render time
   - **Asymmetric families** that don't support mirror cleanly: emit a `mirror_asymmetric` warning advisory and place the unmirrored copy at the mirrored location (degraded but useful)

3. Plan canvas tool: in `packages/web/src/tools/toolRegistry.ts`, the existing "mirror" tool entry should be wired to a real implementation. Tool flow:
   - Activate Mirror tool
   - Click axis line (or pick reference plane in family editor)
   - Pre-selected elements are mirrored on commit; or click elements one by one and Enter to commit
   - With `alsoCopy: true` (default; matches Revit's "Mirror — Pick Axis" with Copy option), originals are kept

4. Family editor: same tool grammar; mirror axis is a reference plane (not an arbitrary line) for clean parametric behaviour.

5. Tests:
   - pytest for engine command on a wall: mirror across X-axis swaps endpoints correctly; hosted door alongT inverts
   - pytest for room polygon: vertex order reverses
   - vitest for the canvas tool flow

**Acceptance.**
- Mirror a wall across an axis: wall is reflected, doors/windows on it are repositioned correctly.
- Mirror an entire wing of the demo house: full geometry is mirrored as a single command bundle.
- Asymmetric door (e.g. with a handle on one side) emits a warning and places the unmirrored copy.

**Files:** `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, `packages/web/src/tools/toolRegistry.ts`, `packages/web/src/plan/PlanCanvas.tsx` (mirror tool wiring), plus tests.

**Estimated time:** 4 hours.

---

### 1.3 — FAM-04: Conditional formula support

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 4" → FAM-04.

**Why it matters.** Today's `evaluateExpression()` (in `Inspector.tsx` and Python equivalent) handles arithmetic. Revit's full formula grammar — `if(cond, a, b)`, `rounddown()`, `mod()`, comparison, boolean — is used heavily for parameter-driven arrays (the chair-array dining table in the 5-hour course relies on `if(Width < 1400, 1, rounddown(...))`).

**Concrete scope:**

1. Replace the current evaluator with a real parser. Use a safe library:
   - **TypeScript:** `mathjs` or write a small recursive-descent parser. **Do NOT use `eval()`** — security hole.
   - **Python:** `simpleeval` (already a small dep candidate) or a custom AST-based evaluator.

2. Supported grammar:
   - Arithmetic: `+ - * / mod ** ()`
   - Functions: `if(cond, a, b)`, `rounddown(x)`, `roundup(x)`, `round(x)`, `min(a,b,...)`, `max(a,b,...)`, `abs(x)`, `sqrt(x)`
   - Boolean: `<` `>` `<=` `>=` `=` `<>` `not(x)` `and(x,y)` `or(x,y)`
   - Type coercion: number ↔ boolean (Revit-compatible: `true == 1`, `false == 0`)

3. Parameter references: `<paramName>` (no quotes; matches Revit's bare identifier syntax). Whitelist: only family parameters can be referenced. Any unknown identifier raises a parse error.

4. Replace existing `evaluateExpression(raw)` in `packages/web/src/workspace/Inspector.tsx` (line ~328) with a call to the new evaluator. Same for the Python side.

5. Update the family editor formula UI to validate formulas live (debounced) and show parse errors inline.

6. Tests:
   - vitest covering each function (`if`, `rounddown`, `mod`, etc.)
   - vitest for boolean coercion (`if(Width < 1400, 1, 2)` returns 1 when Width < 1400)
   - vitest rejecting unsafe expressions (no global access)
   - pytest mirror tests for the Python side

**Acceptance.** A family parameter `Chair Count = if(Width < 1400, 1, rounddown((Width - 200) / (320 + 80)))` correctly produces 1, 2, 3, 4 chairs as Width grows from 1200 → 2800.

**Files:** `packages/web/src/workspace/Inspector.tsx`, `packages/web/src/lib/expressionEvaluator.ts` (new — extract the evaluator), Python equivalent in `app/bim_ai/`, family editor UI for formula validation, plus tests.

**Estimated time:** 4-5 hours.

---

### 1.4 — FAM-02: Sweep tool (path + profile → swept solid)

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 4" → FAM-02 + the **FAM-02** detail block.

**Why it matters.** New geometry primitive in family editor: define a 2D path on a work plane + a 2D profile (closed loop) and produce a swept solid. Used for window handles, trim, mullion bodies, gutters, railings — and for the target-house "thick white loggia frame outlining the asymmetrical gable shape".

**Concrete scope:**

1. New family geometry node `sweep` in the family-geometry data model:

```ts
{
  kind: 'sweep';
  pathLines: SketchLine[];                     // open or closed polyline
  profile: SketchLine[];                       // closed loop
  profilePlane: 'normal_to_path_start' | 'work_plane';
  profileFamilyId?: string;                    // optional: load from a profile family
  materialKey?: string;
}
```

Profile families (introduced in V2-11) optionally referenced via `profileFamilyId`.

2. Renderer: new `meshFromSweep(sweep)` that produces a Three.js BufferGeometry by extruding the profile along the path. Use `THREE.ExtrudeGeometry` with a custom path or implement the sweep manually (path = sequence of points + tangent frames at each; profile = closed polygon perpendicular to tangent).

3. Family editor:
   - New "Sweep" tool in the family editor toolbar
   - Click-through workflow: (1) draw path → (2) "Edit Profile" button enters a profile sketch session → (3) Finish ✓
   - Profile sketch session: small modal sketch state (limited to 2D closed loop, similar to existing void cut sketch)

4. Tests:
   - vitest for `meshFromSweep` verifying vertex count and bounding box for a known path + profile
   - vitest for the family editor sweep-tool flow

**Acceptance.**
- Build a cylindrical window-handle family using a path + circular profile; produces a cylinder.
- Build a curtain-wall mullion using a sweep along a grid line with an I-section profile family.

**Files:** `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`, `packages/web/src/families/sweepGeometry.ts` (new), `packages/web/src/families/types.ts` (extend with sweep node), plus tests.

**Estimated time:** 5 hours.

---

## 2. File ownership and conflict avoidance

You own:
- `packages/web/src/familyEditor/*` (entire directory — Family Editor Workbench)
- `packages/web/src/families/sweepGeometry.ts` (new)
- `packages/web/src/lib/expressionEvaluator.ts` (new — extracted formula evaluator)
- Mirror command + engine wiring in `app/bim_ai/`
- Inspector.tsx evaluateExpression replacement (you own this surface)
- New test files

Shared territory:
- `packages/core/src/index.ts` — minimal touches; sweep node lives in family geometry types, not the Element union
- `app/bim_ai/commands.py` — append `MirrorElements` command
- `app/bim_ai/engine.py` — append mirror engine logic
- `packages/web/src/workspace/Inspector.tsx` — replace evaluator only; don't restructure the file (Agent 5 may also touch for pin toggle)
- `packages/web/src/tools/toolRegistry.ts` — wire the existing mirror tool entry (likely already a stub)
- `packages/web/src/plan/PlanCanvas.tsx` — mirror tool wiring (Agent 5 may also touch — coordinate via separate handler)
- `spec/workpackage-master-tracker.md` — only your four rows

Avoid:
- `packages/web/src/viewport/meshBuilders.ts` (Agents 1-3 + 4)
- `packages/web/src/Viewport.tsx` (Agent 4 + 5)
- `app/bim_ai/elements.py` core element shapes (other agents)
- `app/bim_ai/export_ifc.py` (Agent 1)
- `app/bim_ai/constraints.py` (Agent 6)

If an Edit fails because surrounding code changed, `git pull --rebase origin main`, re-read, redo.

---

## 3. Go

Read `spec/workpackage-master-tracker.md` end-to-end. Then start WP 1.1 (FAM-09 flex mode — quickest), then FAM-07 (mirror), then FAM-04 (formulas), then FAM-02 (sweep — biggest, last). Don't pause until "End-of-shift summary".
