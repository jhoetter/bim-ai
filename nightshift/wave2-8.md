# Wave-2 Agent 8 — IFC depth (IFC-03 + IFC-04) + VIE-02 per-detail visibility

You are **Agent 8** of eight wave-2 agents. Theme: **IFC roundtrip depth + per-element visibility per detail level**. Branch `wave2-8`. Three WPs.

---

## 0. Pre-flight

```bash
git worktree add /Users/jhoetter/repos/bim-ai-wave2-8 wave2-8
cd /Users/jhoetter/repos/bim-ai-wave2-8
```

Read `spec/workpackage-master-tracker.md` → Exchange formats → IFC-03, IFC-04; P5 → VIE-02 detail block; `nightshift/wave2-README.md`.

### Concurrent agents

You're mostly in your own files (`app/bim_ai/export_ifc.py` for IFC, family-geometry visibility flag for VIE-02). Standard rebase conflicts on `core/index.ts`, `commands.py`, etc.

### Quality gates / branch protocol / tracker / anti-laziness

Same as Agent 1. Branch `wave2-8`. End-of-shift `nightshift/wave2-8-status.md`.

---

## 1. Your assigned workpackages

Three WPs in this order: VIE-02 (smallest, depends on FAM-01 already done) → IFC-03 → IFC-04.

### 1.1 — VIE-02: Per-element / per-family-geometry visibility per detail level

**Tracker:** P5 → VIE-02. Depends on FAM-01 (load-bearing slice already shipped at `583e726c`).

**Scope:**

1. Family geometry nodes gain `visibilityByDetailLevel`:

   ```ts
   visibilityByDetailLevel?: {
     coarse?: boolean;   // default true
     medium?: boolean;   // default true
     fine?: boolean;     // default true
   };
   ```

2. Family resolver (in `packages/web/src/families/familyResolver.ts` or wherever FAM-01's resolver lives) accepts an optional `detailLevel` parameter; when set, geometry nodes whose `visibilityByDetailLevel[detailLevel] === false` are skipped.

3. Plan projection passes `view.planDetailLevel` through to the family resolver when projecting family instances.

4. Family editor UI: properties panel on a selected geometry node gains a 3-checkbox row "Coarse / Medium / Fine" (defaults all true).

5. Tests:
   - `packages/web/src/families/familyResolver.detailLevel.test.ts` — geometry skipped at coarse when bound
   - `packages/web/src/familyEditor/FamilyEditorWorkbench.detailLevelVisibility.test.tsx` — UI toggles set the binding

**Acceptance.** A door family's 3D panel marked `visibilityByDetailLevel: { coarse: false, medium: true, fine: true }` hides in coarse-mode plan view but the swing arc still shows; in fine-mode plan view, the panel renders.

**Effort:** 3-4 hours.

---

### 1.2 — IFC-03: Roof-hosted void replay

**Tracker:** Exchange → IFC-03. Today rolled up as `slabRoofHostedVoidReplaySkipped_v0` only.

**Scope:**

1. In `app/bim_ai/export_ifc.py`'s authoritative-replay path:
   - Today: `IfcOpeningElement` instances hosted on `IfcRoof` are skipped with a `slabRoofHostedVoidReplaySkipped_v0` count
   - Add: parse roof-hosted opening geometry (extruded prism) → emit a `createSlabOpening`-equivalent command targeting the roof. Either reuse `createSlabOpening` (extending it to accept `hostKind: 'roof' | 'floor'`) or add a new `createRoofOpening` command kind.

2. Validation: opening footprint must fit within roof footprint; opening orientation must be perpendicular to roof normal (not perfectly accurate for sloped roofs but close enough for the load-bearing slice).

3. **Model-side new command** (if you go the new-command route): `CreateRoofOpeningCmd` with `roofId, alongMm, acrossMm, widthMm, depthMm, sillHeightMm, headHeightMm`. Roof renderer CSG-subtracts the opening from the roof mesh. Plan view shows the opening as dashed lines in the roof plan.

4. Update `summarize_kernel_ifc_semantic_roundtrip` to verify the round-tripped IFC body kind matches the kernel `roofGeometryMode` AND the roof-hosted opening count.

5. Update `inspect_kernel_ifc_semantics` to count roof-hosted openings.

6. Tests:
   - `app/tests/test_export_ifc.py` — author roof + roof-hosted opening → export IFC → re-parse → verify opening preserved
   - `app/tests/test_create_roof_opening.py` — engine validation if you added a new command

**Acceptance.** A roof with a circular skylight opening exports to IFC with the opening as a hosted IfcOpeningElement; re-parsing produces a `createRoofOpening` (or extended `createSlabOpening`) in the authoritative replay; round-trip count matches.

**Effort:** 4-5 hours.

---

### 1.3 — IFC-04: Broader QTO + materials + classifications + composites

**Tracker:** Exchange → IFC-04. Narrow QTO slice shipped; full takeoff pending.

**Scope:**

This is L-effort; ship the **load-bearing slice** that meaningfully extends today's narrow QTO.

**MUST ship (load-bearing — mark `partial`):**

1. **Material assignments** — for each emitted IfcWall / IfcSlab / IfcRoof / IfcDoor / IfcWindow with a `materialKey`, attach an `IfcMaterial` (or `IfcMaterialLayerSet` for FL-08 layered walls) via `IfcRelAssociatesMaterial`. Materials ship with their MAT-01 catalog metadata as Pset fields:
   - `Pset_MaterialCommon.Reference` = the materialKey string
   - `Pset_MaterialCommon.BaseColor` = the hex baseColor
   - `Pset_MaterialCommon.Roughness`, `Metalness` if present

2. **Layered wall composites** — for walls with `wallTypeId` resolving to a `wall_type` element (FL-08), emit an `IfcMaterialLayerSet` with one `IfcMaterialLayer` per layer:
   - `Material` reference to the layer's materialKey
   - `LayerThickness` from the layer
   - `Name` from the layer
   - Attach to the wall via `IfcRelAssociatesMaterial`

3. **Broader QTO** — extend today's narrow QTO with:
   - For walls: `Qto_WallBaseQuantities.GrossSideArea`, `NetSideArea` (gross minus openings)
   - For floors / roofs: `Qto_SlabBaseQuantities.GrossArea`, `Perimeter`
   - For doors / windows: `Qto_DoorBaseQuantities.Width`, `Height`, `Area`
   - For rooms: `Qto_SpaceBaseQuantities.GrossFloorArea`, `NetFloorArea`, `Perimeter`, `Volume`

4. **Classifications** — emit `IfcClassificationReference` for elements with optional `ifcClassificationCode` field (add this field to the wall/floor/roof/etc. shapes as optional). Used for OmniClass / Uniclass / NSCC mapping.

5. **MAY defer** (mark in tracker note as `partial`):
   - Full Pset_*Common coverage beyond what's already there
   - Element-occurrence classifications via `IfcRelAssociatesClassification` for non-architectural elements
   - Material category mapping to IFC-standard categories

6. Tests:
   - `app/tests/test_export_ifc.py` — material + layered wall round-trip; QTO field presence
   - `app/tests/test_ifc_classifications.py` — classification reference attached when set

After this WP ships, mark IFC-04 in tracker as: `partial in <hash> — material + layered composites + broader QTO + classification fields shipped; full Pset coverage for non-architectural categories deferred`.

**Acceptance.** Exporting the demo seed model produces IFC where:
- Each wall has a `MaterialLayerSet` reflecting its `wall_type` layers
- Floors, roofs, doors, windows have full `Qto_*BaseQuantities` populated
- Classification references are attached when the element has `ifcClassificationCode`
- Round-trip preserves all of the above

**Effort:** 6-8 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- `app/bim_ai/export_ifc.py` (entire IFC export path — yours alone, no other agent touches)
- `app/bim_ai/material_catalog.py` extensions for IFC mapping
- `visibilityByDetailLevel` field on family geometry nodes
- New `IfcClassificationCode` field on relevant element kinds

**Shared territory:**
- `core/index.ts`, `elements.py` — minimal additions
- `app/tests/test_export_ifc.py` — append your test cases
- `spec/workpackage-master-tracker.md` — only IFC-03, IFC-04, VIE-02

**Avoid:**
- All web / plan / family-editor files (other agents)
- `packages/web/src/viewport/meshBuilders.ts` (seed-fidelity)

---

## 3. Go

Spawn worktree. Ship VIE-02 first (smallest), then IFC-03, then IFC-04 load-bearing slice.
