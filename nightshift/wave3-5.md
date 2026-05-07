# Wave-3 Agent 5 — Sketch-dependent roofs + multi-run stairs (KRN-02 + KRN-03 + KRN-07)

You are **Agent 5** of eight wave-3 agents. Theme: **L-shape and hip roof 3D meshes + multi-run stairs**, all newly unblocked now that SKT-01 has its floor session shipped (and Agent 4 is propagating to roof). Branch `wave3-5`.

---

## 0. Pre-flight

```bash
cd /Users/jhoetter/repos/bim-ai
git fetch origin --quiet
git worktree add /Users/jhoetter/repos/bim-ai-wave3-5 -b wave3-5 origin/main
cd /Users/jhoetter/repos/bim-ai-wave3-5
```

Read:
- `spec/workpackage-master-tracker.md` → KRN-02, KRN-03, KRN-07 detail blocks
- The KRN-11 commit (asymmetric gable) for the existing roof renderer pattern in `meshBuilders.ts`
- `nightshift/wave3-README.md`

### Quality gates / branch protocol / tracker / anti-laziness

Standard. Branch `wave3-5`, status `nightshift/wave3-5-status.md`. Push + merge each WP individually.

---

## 1. Your assigned workpackages

Order: KRN-02 → KRN-03 → KRN-07 (largest, last).

### 1.1 — KRN-02: Concave / L-shaped roof footprint 3D mesh

**Tracker:** KRN-02 detail block.

**Today's state.** `roof_geometry.py:roof_geometry_support_token_v0` already detects concave / L-shaped footprints and emits `valley_candidate_deferred`. The section view renders correctly. Only the 3D mesh is missing.

**Concrete scope:**

1. **3D mesh generator** for concave L-shape footprints in `packages/web/src/viewport/meshBuilders.ts`:
   - Detect when `footprintMm` has 6 vertices forming an L
   - Generate a roof mesh as the union of two rectangular gables meeting at the L's inner corner — handles two ridge axes (one per leg)
   - Each leg uses the same gable-pitched-rectangle geometry as KRN-11; they meet at a valley line (where the two slopes intersect)

2. **Valley line geometry:** the inner corner of the L generates a valley where the two roof planes meet. Compute the valley as the intersection line of the two slope planes, drawn in 3D as a slight crease.

3. **roofGeometryMode acceptance:** `'gable_pitched_rectangle'` already accepted; extend to allow L-shape footprints when `roofGeometryMode === 'gable_pitched_rectangle'` and footprint is L-shaped (6 vertices). Or add a new mode `'gable_pitched_l_shape'` if cleaner.

4. **Tests:**
   - `packages/web/src/viewport/meshBuilders.lShapeRoof.test.ts` — author L-shape footprint → mesh has expected vertex count / bounding box
   - `app/tests/test_roof_pitch_evidence.py` — extend to verify the L-shape path no longer skip-codes

**Acceptance.** Authoring a roof with L-shape footprint and `gable_pitched_rectangle` mode produces a 3D mesh with two ridges meeting at a valley.

**Effort:** 4-5 hours.

---

### 1.2 — KRN-03: Hip roof (convex polygon >4 corners) 3D mesh

**Tracker:** KRN-03 detail block.

**Today's state.** Hip roofs (>4 corners convex) emit `hip_candidate_deferred`. Section view OK. 3D mesh missing.

**Concrete scope:**

1. **3D mesh generator** for hip-roof footprints:
   - For each edge of the polygon footprint, generate a sloped triangular face rising to a ridge or apex
   - For 5+ corner convex polygons, use the **straight-skeleton algorithm** — each edge generates a sloped face that rises until it meets the skeleton ridge above
   - Use `straight-skeleton-2d` npm package (or implement the skeleton directly — straightforward for convex polygons)

2. **`roofGeometryMode: 'hip'`** mode — extend the union; renderer dispatches to the hip mesh when set.

3. **For hip roofs without an explicit ridge axis**, use uniform pitch around the polygon — every edge slopes inward at the same angle.

4. **Tests:**
   - `packages/web/src/viewport/meshBuilders.hipRoof.test.ts` — author 6-corner polygon roof → mesh has expected face count
   - `app/tests/test_roof_pitch_evidence.py` — verify hip path no longer skip-codes

**Acceptance.** Authoring a roof with `roofGeometryMode: 'hip'` and a 6-corner convex polygon footprint produces a 3D mesh with all 6 edges sloping inward to a central ridge.

**Effort:** 5-6 hours.

---

### 1.3 — KRN-07: Multi-run stairs

**Tracker:** KRN-07 detail block.

**Today's state.** `stair` element is single-run. Real stairs are runs + landings; complex stairs are sketch-based.

**Concrete scope:**

1. **Replace `stair` shape** in `packages/core/src/index.ts` per the tracker detail:

   ```ts
   {
     kind: 'stair';
     // existing fields preserved
     shape: 'straight' | 'l_shape' | 'u_shape' | 'spiral' | 'sketch';
     runs: StairRun[];        // new — array of runs
     landings: StairLanding[]; // new — array of landings
     baseLevelId: string;
     topLevelId: string;
     desiredRiserCount: number;
     widthMm: number;
     monolithic: boolean;
     hasNosing: boolean;
   }
   
   type StairRun = {
     id: string;
     startMm: { xMm: number; yMm: number };
     endMm: { xMm: number; yMm: number };
     widthMm: number;
     riserCount: number;
   };
   
   type StairLanding = {
     id: string;
     boundaryMm: { xMm: number; yMm: number }[];   // closed polygon
   };
   ```

   Mirror in `app/bim_ai/elements.py`. **Migration:** for existing single-run `stair` elements (legacy), generate a single run from the existing `runStartMm` / `runEndMm` and an empty landings array. Or accept that legacy stairs need migration.

2. **Geometry for shape `'l_shape'`:** two runs perpendicular, joined by a single landing (rectangular). Auto-derive landing geometry from the two run endpoints + width.

3. **Geometry for shape `'u_shape'`:** two parallel runs going opposite directions, joined by a landing.

4. **Geometry for shape `'spiral'`:** circular run with constant inner/outer radii; computes treads as wedges. Mostly a geometry exercise.

5. **Geometry for shape `'sketch'`:** runs and landings are produced by a sketch session (SKT-01 — Agent 4's propagation will eventually cover this; for now, accept that runs/landings are authored directly via API).

6. **Renderer:** extend `meshBuilders.ts` `makeStairVolumeMesh` (or add `makeMultiRunStairMesh`) to render runs as inclined extruded boxes and landings as flat polygon extrusions. Connect them visually so the staircase reads as continuous.

7. **Tests:**
   - `packages/web/src/viewport/meshBuilders.multiRunStair.test.ts` — L-shape and U-shape produce expected mesh count
   - `app/tests/test_create_stair_multi_run.py` — engine accepts new shape; legacy single-run still works

**MAY defer (mark `partial` if running long):**
- Plan symbology for spiral / winder stairs (the curved arrow) — flat L/U is fine for the load-bearing slice
- Sketch-based stairs in this WP (depends on Agent 4 propagating sketch sessions to stairs first)

**Acceptance.** Authoring a stair with `shape: 'l_shape'`, two perpendicular runs of 8 risers each, joined at a landing, renders correctly in 3D as a continuous L-shaped staircase.

**Effort:** 7-8 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- `viewport/meshBuilders.ts` roof generators (L-shape, hip) + multi-run stair generators
- `viewport/roofGeometry/` directory (new — split out the asymmetric/L-shape/hip geometry into separate modules for maintainability)
- `viewport/stairGeometry/multiRun.ts` (new)
- `app/bim_ai/roof_geometry.py` extensions (skip-code clearance for L-shape / hip)
- `stair` shape extensions

**Shared territory:**
- `meshBuilders.ts` — Agent 2 (3D handles), Agent 7 (other element kind grips) and seed-fidelity (still finishing up KRN-14 dormer polish maybe) all touch. Append your generators as new functions; don't restructure existing
- `core/index.ts`, `elements.py` — append additions
- `spec/workpackage-master-tracker.md` — only KRN-02, KRN-03, KRN-07

**Avoid:**
- `PlanCanvas.tsx` (Agents 3, 4)
- `Viewport.tsx` (Agent 2)
- `familyEditor/*` (Agent 7)

---

## 3. Go

Spawn worktree, ship KRN-02 → KRN-03 → KRN-07 in order.
