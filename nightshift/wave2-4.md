# Wave-2 Agent 4 — Kernel small batch (KRN-01 + KRN-05) + VIE-01 finish

You are **Agent 4** of eight wave-2 agents, plus the seed-fidelity sprint running concurrently. Your theme is **kernel additions + view discipline polish** — three M-effort items that are largely independent of the keystones. You own branch `wave2-4`. Do not stop until your WPs are done.

---

## 0. Pre-flight

```bash
git worktree add /Users/jhoetter/repos/bim-ai-wave2-4 wave2-4
cd /Users/jhoetter/repos/bim-ai-wave2-4
```

Read `spec/workpackage-master-tracker.md` → KRN-01 + KRN-05 + VIE-01 entries; `nightshift/wave2-README.md`. VIE-01 is `partial` — kernel/helper half landed at commit `a0883092`; you finish the wire-up.

### Concurrent agents

Standard rebase conflicts on `core/index.ts`, `commands.py`, `engine.py`. Agents 5/6 also touch plan-projection files — coordinate by appending logic, not restructuring.

### Quality gates, branch protocol, tracker update, anti-laziness

Same as Agent 1. Branch `wave2-4`. End-of-shift `nightshift/wave2-4-status.md`.

---

## 1. Your assigned workpackages

Three WPs in this order — VIE-01 finish first (smallest, builds velocity), then KRN-05, then KRN-01.

### 1.1 — VIE-01: Detail levels render binding (finish the wire-up)

**Tracker entry:** P5 → VIE-01. Status: `partial`.

**What's already done** (commit `a0883092`):
- `wallPlanLinesForDetailLevel` helper (1/2/4 lines for coarse/medium/fine)
- Door / window / stair feature gates
- Curtain grid + mullion gating
- `PlanDetailLevelToolbar` component (presentational)

**What you need to add:**

1. Wire `wallPlanLinesForDetailLevel` into `packages/web/src/plan/planProjection.ts` — replace today's single-line wall projection with a call to the helper, passing `view.planDetailLevel`.

2. Wire feature gates in `packages/web/src/plan/planElementMeshBuilders.ts` for doors, windows, stairs, curtain walls — each gates its plan symbol detail level.

3. Wire `PlanDetailLevelToolbar` into `PlanCanvas.tsx` chrome (bottom of the canvas, matching Revit's "View Control Bar" position). Clicking Coarse/Medium/Fine commits `UpdateElementProperty` on the active `plan_view`'s `planDetailLevel` field; rendering updates reactively.

4. Update existing `planProjection.test.ts` to assert different element/line counts at each detail level.

**Acceptance.** Switching the demo plan view from Fine → Coarse via the toolbar visibly simplifies rendering (single-line walls, no curtain mullion grid, no door swing detail). Switching back restores layer detail.

**Effort:** 3-4 hours.

---

### 1.2 — KRN-05: Reference work planes in projects

**Tracker entry:** Kernel → KRN-05 + the **KRN-05 detail** block. Reference planes already exist in the family editor (V2-11) — port to projects.

**Concrete scope:**

1. New element kind `reference_plane` in `packages/core/src/index.ts` per the tracker detail block (`startMm`, `endMm`, `levelId`, `isWorkPlane?`, `pinned?`, optional `name`). Mirror in `app/bim_ai/elements.py`.

2. `CreateReferencePlaneCmd`, `UpdateReferencePlaneCmd`, `DeleteReferencePlaneCmd` in `commands.py` + `engine.py`. Validation: `levelId` resolves; `startMm !== endMm`; only one ref plane per level can have `isWorkPlane: true` (the engine enforces this — flipping one to true clears the flag on others on the same level).

3. **Plan projection:** ref planes render as thin dashed grey lines in plan view, with a small label at one end (the `name` if set, else `'RP-N'` autonumber). Render in `planProjection.ts` (find the section_cut or grid_line projection for the pattern).

4. **3D rendering:** ref planes render as semi-transparent green planes (RGBA `0, 200, 80, 0.15`) extending vertically from the level's elevation up by the level's height. Use the section_cut visualization as a reference pattern.

5. **Authoring tool:** add "Reference Plane" tool to Architecture ribbon — click two points on plan, commits `CreateReferencePlane`. Setting `isWorkPlane: true` (toggle in inspector) makes that plane the active anchor for the next sketch session (SKT-01 will eventually consume this).

6. **Tests:**
   - `app/tests/test_create_reference_plane.py` — engine + work-plane uniqueness
   - `packages/web/src/plan/referencePlanePlanRendering.test.ts` — dashed line + label

**Acceptance.** Adding a ref plane on the ground floor renders it as a dashed grey line in plan + a green semi-transparent plane in 3D. Toggling `isWorkPlane: true` clears the flag on any other ref plane on the same level.

**Effort:** 4-5 hours.

---

### 1.3 — KRN-01: `property_line` element kind

**Tracker entry:** Kernel → KRN-01. Used for site setbacks and zoning visualisation. `SiteElem.uniform_setback_mm` exists; this WP adds a real line element.

**Concrete scope:**

1. New element kind `property_line` in `core/index.ts`:

   ```ts
   {
     kind: 'property_line';
     id: string;
     name?: string;
     startMm: { xMm: number; yMm: number };
     endMm: { xMm: number; yMm: number };
     setbackMm?: number;        // optional offset distance for zoning
     classification?: 'street' | 'rear' | 'side' | 'other';
     pinned?: boolean;
   }
   ```

   Mirror in `app/bim_ai/elements.py`.

2. Engine: `CreatePropertyLineCmd`, `UpdatePropertyLineCmd`, `DeletePropertyLineCmd`. Validation: start ≠ end.

3. Plan rendering: solid line in dark slate colour (`#2a3f5a`), thicker than wall lines. Setback rendered as a parallel dashed line offset by `setbackMm` toward the property interior.

4. 3D rendering: optional — render as a tall thin vertical plane at the line position (height ~10000mm) with a translucent grey colour. Marker at each endpoint with the classification label. Defer if it gets complex; plan-only is acceptable for the load-bearing slice.

5. **Tool entry:** add "Property Line" tool to Architecture ribbon — click-click commits `CreatePropertyLine` with classification dropdown in options bar.

6. **Tests:**
   - `app/tests/test_create_property_line.py` — engine validation
   - `packages/web/src/plan/propertyLinePlanRendering.test.ts` — solid line + setback dashed line

**Acceptance.** Adding a property line via the new tool renders it as a thick dark-slate line in plan with a parallel dashed setback line if `setbackMm` is set. Property lines are pinable per VIE-07.

**Effort:** 4-5 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- `reference_plane` and `property_line` element kinds + commands
- Their plan/3D rendering code
- VIE-01 `planProjection.ts` wire-up + `planElementMeshBuilders.ts` detail-level gating
- The two new tool entries (Reference Plane, Property Line)

**Shared territory:**
- `core/index.ts`, `elements.py`, `commands.py`, `engine.py` — append your additions
- `planProjection.ts`, `planElementMeshBuilders.ts` — Agent 5 (PLN/ANN) also touches these. Append your detail-level gates as separate functions; don't restructure
- `PlanCanvas.tsx` — small detail-level toolbar addition only
- Tool registry — append entries
- `spec/workpackage-master-tracker.md` — only your three rows

**Avoid:**
- `packages/web/src/Viewport.tsx` (other agents)
- `packages/web/src/viewport/meshBuilders.ts` (seed-fidelity)
- Family editor (Agent 6)

---

## 3. Go

Spawn worktree. Ship VIE-01 first (smallest, finishes a partial), then KRN-05, then KRN-01.
