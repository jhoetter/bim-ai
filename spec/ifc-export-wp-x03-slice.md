# WP‑X03 IFC export — kernel slice (exchange parity with visual export)

Companion to [revit-production-parity-workpackage-tracker.md](./revit-production-parity-workpackage-tracker.md) **WP‑X03** and PRD §12 (OpenBIM-first).

## Encoding stack choice

| Option                                          | Pros                                                             | Cons                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **ifcopenshell** (recommended for X03‑2 onward) | Valid IFC graphs, IFC4 schema enums, incremental entity coverage | Native wheel / CI image size; server deploy story                        |
| Hand-authored STEP snippet                      | Zero new deps today                                              | Extremely error-prone references; brittle for anything beyond EMPTY DATA |

**Decision:** Ship **manifest + canonical download URL** aligned with [`export_gltf.py`](../app/bim_ai/export_gltf.py) statistics (`exportedIfcKindsInArtifact`, parity counts, unsupported kinds). **`model.ifc`** serves an **IfcOpenShell-backed IFC4 subset** (`bim_ai/export_ifc.py`) when **`ifcopenshell`** (`pyproject.toml` `[ifc]`) is installed and the document is **kernel-eligible** (≥1 wall **or** ≥1 `floor` with boundary ≥3 points — see `kernel_export_eligible()` in [`export_ifc.py`](../app/bim_ai/export_ifc.py)); otherwise the validated empty DATA hull `bim_ai_ifc_empty_shell_v0`.

## Kernel ↔ IFC4 targets (geometry parity slice)

Semantics mirror [`export_manifest_extension_payload`](../app/bim_ai/export_gltf.py) / box kernel: **`wall`**, **`floor`**, **`roof`**, **`stair`**, **`door`**, **`window`**, **`room`**, **`slab_opening`**, with **`level`** as spatial context (**`IfcBuildingStorey`**).

| Kernel `kind`    | IFC product (implemented)                                   | Notes                                                                               |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `level`          | `IfcBuildingStorey`                                         | Naming from `LevelElem`; default storey when no levels declared                     |
| `wall`           | `IfcWall` + extrusion (`create_2pt_wall`)                   | Host for hosted openings                                                            |
| `floor`          | `IfcSlab`                                                   | Boundary polyline extruded along vertical axis; slabs tracked for slab-hosted voids |
| `slab_opening`   | `IfcOpeningElement` + `IfcRelVoidsElement` → host `IfcSlab` | Vertical prism through slab thickness (approx mass void)                            |
| `roof`           | `IfcRoof`                                                   | Prism mass from footprint; height heuristic aligned with glTF roof box              |
| `stair`          | `IfcStair`                                                  | Run-oriented prism via `create_2pt_wall` API (mass proxy)                           |
| `door`, `window` | `IfcOpeningElement` + `IfcDoor` / `IfcWindow` fillings      | Hosted to wall; rel void + rel fill                                                 |
| `room`           | `IfcSpace`                                                  | Outline prism spanning level → upper limit heuristic                                |

Kinds **outside** [`EXPORT_GEOMETRY_KINDS`](../app/bim_ai/export_gltf.py) stay in `unsupportedDocumentKindsDetailed` on both IFC and glTF manifest slices (parity).

`ifc_manifest_v0` may also include **`ifcKernelGeometrySkippedCounts`** documenting instances that cannot be emitted (missing hosts, degenerate footprints); when IfcOpenShell is installed and the model is kernel-eligible, the advisor may emit an informational `exchange_ifc_kernel_geometry_skip_summary` tied to the same map.

## Deferred / omitted (explicit)

- IFC **import**: document merge / command replay — **narrow authoritative replay v0** (`commandSketch.authoritativeReplay_v0`: kernel storey + **`createFloor`** (IfcSlab) + wall + **`createRoof`** (IfcRoof prism via `Pset_RoofCommon.Reference`, inferred `slopeDeg` / `overhangMm`, replay `roofGeometryMode=mass_box`) + **`createStair`** (IfcStair via `Pset_StairCommon.Reference` + body extrusion, `topLevelId` from storey elevations + height when uniquely resolvable) + wall-hosted **`insertDoorOnWall`** / **`insertWindowOnWall`** + slab-hosted **`createSlabOpening`** + **`createRoomOutline`** (IfcSpace) from STEP re-parse, plus **`slabRoofHostedVoidReplaySkipped_v0`** for roof-hosted / deferred void topology, plus **`idsAuthoritativeReplayMap_v0`** with **`spaces`** and **`roofs`** rows); **typed-floor-only replay**, populated-document **broad merge**, and arbitrary IFC import remain **explicitly deferred**.
- **`IfcOpeningElement`** with full boolean tessellation regeneration for walls vs extruded proxy gaps only.

## Implemented in this slice (WP‑X03)

- **Property sets (kernel):** emitted products receive buildingSMART-aligned `Pset_*Common` instances with a deterministic `Reference` string (kernel element id) via `ifcopenshell.api.pset.{add_pset,edit_pset}` — see `try_build_kernel_ifc()` in [`export_ifc.py`](../app/bim_ai/export_ifc.py).
- **Quantities (narrow QTO slice):** `ifcopenshell.api.pset.{add_qto,edit_qto}` attaches template-backed `IfcElementQuantity` roll-ups (`Qto_WallBaseQuantities`, `Qto_SlabBaseQuantities`, `Qto_BaseQuantities` / door+window fillings, plus `Qto_SpaceBaseQuantities` on `IfcSpace`) when imports succeed — ignored silently on unsupported builds.
- **Spaces — programme metadata (kernel):** optional strings from `RoomElem` map onto `Pset_SpaceCommon` as `ProgrammeCode`, `Department`, `FunctionLabel`, and `FinishSet` when set (`_kernel_ifc_space_export_props()` in [`export_ifc.py`](../app/bim_ai/export_ifc.py)).

## IFC semantic inspection matrix (v1)

Single read-back entry point: **`inspect_kernel_ifc_semantics()`** in [`export_ifc.py`](../app/bim_ai/export_ifc.py). Returns JSON-serializable rows (and does **not** add keys to the IFC↔glTF parity slice in [`constraints.py`](../app/bim_ai/constraints.py)).

| Row                                    | What it covers                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `buildingStorey`                       | `IfcBuildingStorey` count; how many storeys carry a numeric `Elevation`.                                                                                                                                                                                     |
| `products`                             | Counts of `IfcWall`, `IfcSlab`, `IfcRoof`, `IfcStair`, `IfcOpeningElement`, `IfcDoor`, `IfcWindow`, `IfcSpace`.                                                                                                                                              |
| `identityPsets`                        | Instances with `Reference` on `Pset_WallCommon`, `Pset_SlabCommon`, `Pset_SpaceCommon`, `Pset_DoorCommon`, `Pset_WindowCommon`, `Pset_RoofCommon`, `Pset_StairCommon`, **`Pset_SiteCommon`** (`siteWithPsetSiteCommonReference`).                                                                                       |
| `spaceProgrammeFields`                 | Counts of spaces carrying `ProgrammeCode` / `Department` / `FunctionLabel` / `FinishSet` on `Pset_SpaceCommon`.                                                                                                                                              |
| `qtoTemplates`                         | `Name` of each `IfcElementQuantity` (`Qto_*` templates when QTO helpers succeed).                                                                                                                                                                            |
| `qtoLinkedProducts`                    | Per IFC product class, count of instances with a defining `Qto_*` template (`Qto_WallBaseQuantities`, `Qto_SlabBaseQuantities`, `Qto_SpaceBaseQuantities`, door/window base quantities).                                                                     |
| `ifcKernelGeometrySkippedCounts`       | Document-level map from `ifc_kernel_geometry_skip_counts()` (missing hosts, degenerate outlines); aligned with manifest + `exchange_ifc_kernel_geometry_skip_summary`.                                                                                       |
| `importScopeUnsupportedIfcProducts_v0` | `schemaVersion` + `countsByClass`: `IfcProduct` instances not under kernel slice element roots and not spatial graph products (`IfcSite`, `IfcBuilding`, `IfcBuildingStorey`); signals foreign element types (e.g. `IfcBeam`); empty on pure kernel exports. |
| **`siteExchangeEvidence_v0`**          | Kernel **`SiteElem`** count vs `IfcSite` instances; **`Pset_SiteCommon.Reference`** as comma-joined sorted kernel ids (multi-site); **`kernelIdsMatchJoinedReference`** when STEP read-back aligns (offline stubs carry document-only counts + `reason`).   |

**Offline / no IfcOpenShell:** same function returns `available: false` (`reason`: `ifcopenshell_not_installed` or `kernel_not_eligible`) and may still include `ifcKernelGeometrySkippedCounts` and **`siteExchangeEvidence_v0`** (document-only kernel site counts) when a `Document` is supplied.

**Tests:** [`app/tests/test_export_ifc.py`](../app/tests/test_export_ifc.py) (ifc-backed), [`app/tests/test_ifc_exchange_manifest_offline.py`](../app/tests/test_ifc_exchange_manifest_offline.py) (manifest + stub paths).

## IFC semantic roundtrip summary (v1)

Secondary entry point: **`summarize_kernel_ifc_semantic_roundtrip(doc)`** in [`export_ifc.py`](../app/bim_ai/export_ifc.py). Runs **one** kernel STEP serialization when IfcOpenShell is installed and the document is kernel-eligible, nests **`inspect_kernel_ifc_semantics`** under `inspection`, and adds:

| Field                    | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernelExpectedIfcKinds` | Same shape as manifest `kernelExpectedIfcKinds` — document-only expected emit counts (offline-safe when IFC absent).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `roundtripChecks`        | `productCounts`, `programmeFields`, `identityCoverage`, `qtoCoverage`, and booleans `allProductCountsMatch` / `allProgrammeFieldsMatch` / `allIdentityReferencesMatch` / `allQtoLinksMatch` / `allChecksPass`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `commandSketch`          | Traceability read-back: `levelsFromDocument`, `storeysFromIfc`, `qtoTemplatesFromIfc`, `spaceProgrammeSampleFromIfc`, `referenceIdsFromIfc`. **Plus** `authoritativeReplay_v0`: deterministic `createLevel` / `createFloor` / `createWall` / `createRoof` / `createStair` / `createRoomOutline` + wall-hosted `insertDoorOnWall` / `insertWindowOnWall` + slab-hosted `createSlabOpening` payloads from kernel IFC re-parse (`build_kernel_ifc_authoritative_replay_sketch_v0`, `authoritativeSubset.openings` / `floors` / `slabVoids` / `roofs` / `stairs`, `slabRoofHostedVoidReplaySkipped_v0` when STEP contains void topology), `idsAuthoritativeReplayMap_v0` (`spaces` + `roofs` rows for IDS advisers), with `unsupportedIfcProducts` vs replay `comparisonNote`. |

**Offline:** returns `roundtripChecks: null`, `commandSketch: null`, with `inspection` from the usual unavailable stubs. **`build_kernel_ifc_authoritative_replay_sketch_v0`** alone returns `available: false` when IfcOpenShell is missing.

**Manifest:** [`ifc_stub.build_ifc_exchange_manifest_payload`](../app/bim_ai/ifc_stub.py) adds **`ifcSemanticImportScope_v0`** (read-back vs import-merge deferrals), **`kernelExpectedIfcKinds`** without parsing STEP, and **`siteExchangeEvidence_v0`** (document-only kernel site participation when geometry export is not yet eligible).

## Authoritative replay slice (v0)

Narrow import-adjacent path (WP‑X03 / WP‑D06 evidence): after kernel STEP export, **re-parse** with IfcOpenShell and emit JSON command sketches aligned with **`CreateLevelCmd`** / **`CreateFloorCmd`** / **`CreateWallCmd`** / **`CreateRoofCmd`** / **`CreateStairCmd`** / **`InsertDoorOnWallCmd`** / **`InsertWindowOnWallCmd`** / **`CreateSlabOpeningCmd`** / **`CreateRoomOutlineCmd`** ([`commands.py`](../app/bim_ai/commands.py)):

- **IfcBuildingStorey** → `createLevel` with stable `id` derived from storey `GlobalId`, `elevationMm` from `Elevation`, `name` from `Name`.
- **IfcSlab** with **`Pset_SlabCommon.Reference`** → `createFloor` with slab footprint + thickness recovered from **`IfcExtrudedAreaSolid`** + profile (kernel exporter shape) and host storey → `levelId`.
- **IfcWall** with **`Pset_WallCommon.Reference`** → `createWall` with wall geometry recovered from **`IfcExtrudedAreaSolid`** + **`IfcArbitraryClosedProfileDef`** / **`IfcIndexedPolyCurve`** profile (kernel exporter shape) and host storey → `levelId`.
- **IfcRoof** with **`Pset_RoofCommon.Reference`** → `createRoof` with footprint + extrusion depth from the same slab-style extrusion reader as kernel export, host storey → `referenceLevelId`, **`roofGeometryMode`** always **`mass_box`**. **`slopeDeg`** is inferred from prism depth via the inverse of `rise_m = clamp(slope_deg/70, 0.25, 2.8)` (m), using **17.5** / **196** at clamp floors. **`overhangMm`** is inferred from object-placement centre Z vs storey elevation and prism rise (placement Z disambiguated vs **`IfcBuildingStorey.Elevation`**), clamped **0–5000** mm. Kernel **`roofTypeId`** is not written to IFC in this slice → omitted in replay.
- **IfcStair** with **`Pset_StairCommon.Reference`** → `createStair` with **`baseLevelId`** from host storey, **`runStartMm`/`runEndMm`/`widthMm`** recovered from the same prism extrusion + placement as **`createWall`**, **`topLevelId`** from storey elevations plus extrusion height when exactly one storey matches (otherwise skip with deterministic `extractionGaps.reason` rows). `riserMm`/`treadMm` are omitted from the replay JSON when defaulted (IFC lacks authored tread/riser metadata).
- **IfcSpace** with **`Pset_SpaceCommon.Reference`** → `createRoomOutline` with footprint from the slab-style extrusion + object placement (kernel exporter shape); optional programme strings from **`Pset_SpaceCommon`**; host storey from **`IfcRelContainedInSpatialStructure`** or kernel **`IfcRelAggregates`** → `levelId`.
- **`idsAuthoritativeReplayMap_v0`:** sorted **`spaces`** rows (`ifcGlobalId`, `identityReference`, `programmeFields`, `qtoSpaceBaseQuantitiesLinked`) and sorted **`roofs`** rows (`ifcGlobalId`, `identityReference` — no roof QTO in this slice).
- **`unsupportedIfcProducts`:** same rollup as `inspect_kernel_ifc_semantics.importScopeUnsupportedIfcProducts_v0` (foreign `IfcProduct` classes), distinct from replay targets.
- **Wall-hosted openings:** `IfcDoor` / `IfcWindow` with `FillsVoids` → `IfcOpeningElement` → `VoidsElements` → host `IfcWall`; filler / opening **`Pset_*Common.Reference`** → command `id`, wall **`Pset_WallCommon.Reference`** → `wallId`. **`kernelDoorSkippedNoReference`** / **`kernelWindowSkippedNoReference`** count fill products missing identity `Reference`.
- **Slab + slab voids:** `IfcSlab` with **`Pset_SlabCommon.Reference`** → `createFloor` (footprint + thickness from kernel-style extrusion); slab-hosted `IfcOpeningElement` voids (name `op:<kernelSlabOpeningId>`) → `createSlabOpening` with `hostFloorId` + `boundaryMm`. Other `IfcOpeningElement` instances (e.g. roof-hosted, or wall void topology already covered by the door/window path) are **skipped** with reasons rolled into **`slabRoofHostedVoidReplaySkipped_v0`** (sorted `countsByHostKindAndReason`, optional `detailRows`).
- **`extractionGaps`:** sorted list; **`kernelWallSkippedNoReference`** / **`kernelSlabSkippedNoReference`** / **`kernelSpaceSkippedNoReference`** / **`kernelStairSkippedNoReference`** / **`kernelRoofSkippedNoReference`** count IFC instances missing identity `Reference` where applicable; roofs also emit **`roof_*`** gap reasons (e.g. **`roof_body_extrusion_unreadable`**, **`roof_placement_unreadable`**).
- **Command merge order:** `createLevel` → `createFloor` → `createWall` → **`createRoof`** → **`createStair`** → wall-hosted inserts → `createSlabOpening` → `createRoomOutline`.

**Validation (focused):** `cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_export_ifc.py tests/test_ifc_exchange_manifest_offline.py`.

### Engine apply (additive merge)

[`try_apply_kernel_ifc_authoritative_replay_v0`](../app/bim_ai/engine.py) accepts the **`authoritativeReplay_v0`** object (or sketch-shaped dict) and applies its **`commands`** to the current **`Document`** via **`try_commit_bundle`** after **preflight**: explicit-id **`merge_id_collision`** vs existing elements / the bundle, and **`merge_reference_unresolved`** for `levelId` / `baseLevelId` / `topLevelId` / `referenceLevelId` / `roofTypeId` / `wallId` / `hostFloorId` that are neither already in the document nor created by earlier commands in the list.

**Outcomes:** `ok` on success; `merge_id_collision` / `merge_reference_unresolved` when preflight fails (returns the validated **`commands`** list); `sketch_unavailable` when `available` is not true; `invalid_sketch` for wrong `replayKind` or `schemaVersion`; `invalid_command` for a non-list `commands` or any entry whose `type` is not one of `createLevel` / `createFloor` / `createWall` / `createRoof` / `createStair` / `createRoomOutline` / `insertDoorOnWall` / `insertWindowOnWall` / `createSlabOpening`; `constraint_error` when **`try_commit_bundle`** evaluation hits blocking violations. **`exchange_ifc_ids_identity_pset_gap`** / **`exchange_ifc_ids_qto_gap`** may append a deterministic pointer to **`commandSketch.authoritativeReplay_v0.idsAuthoritativeReplayMap_v0`** (space + roof row counts) when the roundtrip gate runs — not a `quickFixCommand` bundle.

**Still not in v0:** arbitrary IFC importers and unconstrained merge outside this authoritative bundle + preflight. **`summarize_kernel_ifc_semantic_roundtrip`** nests replay under **`commandSketch.authoritativeReplay_v0`**.

## Still deferred

- **IfcRoof** beyond prism replay: **`roofTypeId`** not round-tripped; **`gable_pitched_rectangle`** not distinguished in IFC body; roof-hosted voids remain **`slabRoofHostedVoidReplaySkipped_v0`** only.
- Broader QTO roll-ups (full composite takeoffs), materials, classifications, and layered composites.
- **Draco**/mesh-compression on glTF sibling export (tracked under WP‑X02).

When these land, bump `ifcEncoding` commentary / `kernelNote` in [`export_ifc.py`](../app/bim_ai/export_ifc.py) and extend this table.

## Previous explicit deferrals (history)

- ~~Property sets, quantities, materials, classifications.~~ → **Psets (Reference) shipped; narrow QTO + materials remain.**

## Artifact contract

| Resource                     | Purpose                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET …/exports/ifc-manifest` | **`ifc_manifest_v0`** JSON: parity fields + `ifcEncoding` + `artifactHasGeometryEntities` + `exportedIfcKindsInArtifact` + `ifcSemanticImportScope_v0` + `kernelExpectedIfcKinds` hints |
| `GET …/exports/model.ifc`    | Downloadable IFC STEP — **`bim_ai_ifc_kernel_v1`** kernel solids when **`ifcopenshell`** + eligible geometry exists; **`bim_ai_ifc_empty_shell_v0`** empty DATA otherwise               |
