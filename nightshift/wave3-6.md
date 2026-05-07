# Wave-3 Agent 6 — Sketch-dependent areas + masking regions (KRN-08 + KRN-10)

You are **Agent 6** of eight wave-3 agents. Theme: **area element kind for legal/permit calculations + masking region for view-local 2D blocking**. Both newly unblocked once SKT-01 floor session shipped (and Agent 4 is expanding the sketch sessions to other kinds). Branch `wave3-6`.

---

## 0. Pre-flight

```bash
cd /Users/jhoetter/repos/bim-ai
git fetch origin --quiet
git worktree add /Users/jhoetter/repos/bim-ai-wave3-6 -b wave3-6 origin/main
cd /Users/jhoetter/repos/bim-ai-wave3-6
```

Read:
- `spec/workpackage-master-tracker.md` → KRN-08, KRN-10 detail blocks
- `nightshift/wave3-README.md`

### Quality gates / branch protocol / tracker / anti-laziness

Standard. Branch `wave3-6`, status `nightshift/wave3-6-status.md`. Push + merge each WP individually.

---

## 1. Your assigned workpackages

Order: KRN-10 (S, smaller) → KRN-08 (M).

### 1.1 — KRN-10: Masking region (2D filled region that blocks underlying linework)

**Tracker:** KRN-10 detail block.

**Concrete scope:**

1. **Element shape** in `packages/core/src/index.ts`:

   ```ts
   {
     kind: 'masking_region';
     id: string;
     hostViewId: string;             // view-local
     boundaryMm: { xMm: number; yMm: number }[];     // closed polygon
     fillColor?: string;             // default: opaque match for view background
   }
   ```

   Mirror in `app/bim_ai/elements.py`. Engine validation: `hostViewId` resolves to a view (plan / section / elevation); boundary has ≥3 vertices.

2. **Engine commands:** `CreateMaskingRegion`, `UpdateMaskingRegion`, `DeleteMaskingRegion`. Boundary edits: typical CRUD. Authoring entry uses SKT-01 (Agent 4 is propagating sessions to ceiling/roof — extend with `'masking_region'` element kind).

3. **Plan rendering** in `packages/web/src/plan/planProjection.ts`:
   - Renders as an opaque polygon at the boundary
   - Z-ordered above element linework (so it actually masks)
   - Below text/dimension annotations (so labels stay visible)

4. **Section + elevation rendering:** masking regions in those views render same as plan.

5. **Not visible in 3D** — view-local 2D element only.

6. **Authoring tool:** new "Masking Region" tool (Annotate ribbon). Activates a sketch session with `elementKind: 'masking_region'` (depends on Agent 4's propagation; if not yet, accept a click-polygon authoring as a load-bearing fallback).

7. **Tests:**
   - `packages/web/src/plan/planProjection.maskingRegion.test.ts` — masking region polygon rendered with z-order above element linework
   - `app/tests/test_create_masking_region.py` — engine validation + view scope

**Acceptance.** Adding a masking region in a plan view obscures any element linework underneath while leaving annotations on top visible. Not present in 3D views.

**Effort:** 3-4 hours.

---

### 1.2 — KRN-08: `area` element kind for legal/permit area calculations

**Tracker:** KRN-08 detail block.

**Concrete scope:**

1. **Element shape** in `packages/core/src/index.ts`:

   ```ts
   {
     kind: 'area';
     id: string;
     name: string;
     levelId: string;
     boundaryMm: { xMm: number; yMm: number }[];   // closed polygon
     ruleSet: 'gross' | 'net' | 'no_rules';
     computedAreaSqMm?: number;                     // engine recomputes after every commit
   }
   ```

   Mirror in `app/bim_ai/elements.py`. Distinct from `room`: areas may include exterior porches and exclude interior shafts based on `ruleSet`.

2. **Engine commands:** `CreateArea`, `UpdateArea`, `DeleteArea`.

3. **Area calculation** in `app/bim_ai/area_calculation.py` (new):
   - `gross`: simple polygon area via shoelace formula
   - `net`: polygon area minus the area of any contained shafts (find `slab_opening` elements whose boundary is inside the area; subtract)
   - `no_rules`: simple polygon area, no adjustments
   - Recomputed after every command apply (similar to room area)

4. **Plan rendering:** boundary as a thick coloured outline (different from room separation lines — say a dashed red line). Optional area tag at the centroid showing `name` + `<area> sq m`. Tag follows the existing tag pattern.

5. **Schedule integration:** new "Area Schedule" type in the schedule engine, similar to room schedule. Lists name + boundary perimeter + computed area + ruleSet.

6. **Authoring entry:** new "Area Boundary" tool (Architecture ribbon). Uses SKT-01 sketch session with `elementKind: 'area'` (depends on Agent 4's propagation; accept fallback as for KRN-10).

7. **Tests:**
   - `app/tests/test_area_calculation.py` — gross/net/no_rules ruleset variants produce correct sq mm
   - `app/tests/test_create_area.py` — engine validation
   - `packages/web/src/plan/planProjection.area.test.ts` — area boundary + tag render

**Acceptance.** Adding an area covering a 4m × 5m porch with `ruleSet: 'gross'` produces `computedAreaSqMm: 20_000_000` (20 sq m); the area tag shows "Porch · 20.00 m²" at the centroid.

**Effort:** 5-6 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- `area` and `masking_region` element kinds
- `app/bim_ai/area_calculation.py` (new)
- `viewport`-side rendering integration (these are 2D plan-only, but you need to wire them up in plan projection)
- New tool entries (Area Boundary, Masking Region)

**Shared territory:**
- `core/index.ts`, `elements.py`, `commands.py`, `engine.py` — append additions
- `planProjection.ts` — Agents 3, 4, 5 also touch; append your new rendering paths as separate functions
- `tools/toolRegistry.ts` — append your tools
- `spec/workpackage-master-tracker.md` — only KRN-08, KRN-10

**Avoid:**
- `Viewport.tsx`, `meshBuilders.ts` (Agents 2, 5, 7)
- `PlanCanvas.tsx` outside the rendering hook (Agents 2, 3, 4)
- `familyEditor/*` (Agent 7)

---

## 3. Go

Spawn worktree, ship KRN-10 first (smaller win), then KRN-08.
