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

- IFC **import**: document merge / command replay — **narrow authoritative replay v0** (`commandSketch.authoritativeReplay_v0`: kernel storey + **`createFloor`** (IfcSlab) + wall + wall-hosted **`insertDoorOnWall`** / **`insertWindowOnWall`** + slab-hosted **`createSlabOpening`** + **`createRoomOutline`** (IfcSpace) from STEP re-parse, plus **`slabRoofHostedVoidReplaySkipped_v0`** for roof / deferred void topology, plus **`idsAuthoritativeReplayMap_v0`**); full **semantic export→re-parse** summaries (`summarize_kernel_ifc_semantic_roundtrip`) and manifest **import-scope** hints (`ifcSemanticImportScope_v0` on `ifc_manifest_v0`) unchanged for broader scope.
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
| `identityPsets`                        | Instances with `Reference` on `Pset_WallCommon`, `Pset_SlabCommon`, `Pset_SpaceCommon`, `Pset_DoorCommon`, `Pset_WindowCommon`, `Pset_RoofCommon`, `Pset_StairCommon`.                                                                                       |
| `spaceProgrammeFields`                 | Counts of spaces carrying `ProgrammeCode` / `Department` / `FunctionLabel` / `FinishSet` on `Pset_SpaceCommon`.                                                                                                                                              |
| `qtoTemplates`                         | `Name` of each `IfcElementQuantity` (`Qto_*` templates when QTO helpers succeed).                                                                                                                                                                            |
| `qtoLinkedProducts`                    | Per IFC product class, count of instances with a defining `Qto_*` template (`Qto_WallBaseQuantities`, `Qto_SlabBaseQuantities`, `Qto_SpaceBaseQuantities`, door/window base quantities).                                                                     |
| `ifcKernelGeometrySkippedCounts`       | Document-level map from `ifc_kernel_geometry_skip_counts()` (missing hosts, degenerate outlines); aligned with manifest + `exchange_ifc_kernel_geometry_skip_summary`.                                                                                       |
| `importScopeUnsupportedIfcProducts_v0` | `schemaVersion` + `countsByClass`: `IfcProduct` instances not under kernel slice element roots and not spatial graph products (`IfcSite`, `IfcBuilding`, `IfcBuildingStorey`); signals foreign element types (e.g. `IfcBeam`); empty on pure kernel exports. |

**Offline / no IfcOpenShell:** same function returns `available: false` (`reason`: `ifcopenshell_not_installed` or `kernel_not_eligible`) and may still include `ifcKernelGeometrySkippedCounts` when a `Document` is supplied.

**Tests:** [`app/tests/test_export_ifc.py`](../app/tests/test_export_ifc.py) (ifc-backed), [`app/tests/test_ifc_exchange_manifest_offline.py`](../app/tests/test_ifc_exchange_manifest_offline.py) (manifest + stub paths).

## IFC semantic roundtrip summary (v1)

Secondary entry point: **`summarize_kernel_ifc_semantic_roundtrip(doc)`** in [`export_ifc.py`](../app/bim_ai/export_ifc.py). Runs **one** kernel STEP serialization when IfcOpenShell is installed and the document is kernel-eligible, nests **`inspect_kernel_ifc_semantics`** under `inspection`, and adds:

| Field                    | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernelExpectedIfcKinds` | Same shape as manifest `kernelExpectedIfcKinds` — document-only expected emit counts (offline-safe when IFC absent).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `roundtripChecks`        | `productCounts`, `programmeFields`, `identityCoverage`, `qtoCoverage`, and booleans `allProductCountsMatch` / `allProgrammeFieldsMatch` / `allIdentityReferencesMatch` / `allQtoLinksMatch` / `allChecksPass`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `commandSketch`          | Traceability read-back: `levelsFromDocument`, `storeysFromIfc`, `qtoTemplatesFromIfc`, `spaceProgrammeSampleFromIfc`, `referenceIdsFromIfc`. **Plus** `authoritativeReplay_v0`: deterministic `createLevel` / `createFloor` / `createWall` / `createRoomOutline` + wall-hosted `insertDoorOnWall` / `insertWindowOnWall` + slab-hosted `createSlabOpening` payloads from kernel IFC re-parse (`build_kernel_ifc_authoritative_replay_sketch_v0`, `authoritativeSubset.openings` / `floors` / `slabVoids`, `slabRoofHostedVoidReplaySkipped_v0` when STEP contains void topology), `idsAuthoritativeReplayMap_v0` (IfcSpace Reference / programme / QTO linkage for IDS advisers), with `unsupportedIfcProducts` vs replay `comparisonNote`. |

**Offline:** returns `roundtripChecks: null`, `commandSketch: null`, with `inspection` from the usual unavailable stubs. **`build_kernel_ifc_authoritative_replay_sketch_v0`** alone returns `available: false` when IfcOpenShell is missing.

**Manifest:** [`ifc_stub.build_ifc_exchange_manifest_payload`](../app/bim_ai/ifc_stub.py) adds **`ifcSemanticImportScope_v0`** (read-back vs import-merge deferrals) and **`kernelExpectedIfcKinds`** without parsing STEP.

## Authoritative replay slice (v0)

Narrow import-adjacent path (WP‑X03 / WP‑D06 evidence): after kernel STEP export, **re-parse** with IfcOpenShell and emit JSON command sketches aligned with **`CreateLevelCmd`** / **`CreateFloorCmd`** / **`CreateWallCmd`** / **`InsertDoorOnWallCmd`** / **`InsertWindowOnWallCmd`** / **`CreateSlabOpeningCmd`** / **`CreateRoomOutlineCmd`** ([`commands.py`](../app/bim_ai/commands.py)):

- **IfcBuildingStorey** → `createLevel` with stable `id` derived from storey `GlobalId`, `elevationMm` from `Elevation`, `name` from `Name`.
- **IfcSlab** with **`Pset_SlabCommon.Reference`** → `createFloor` with slab footprint + thickness recovered from **`IfcExtrudedAreaSolid`** + profile (kernel exporter shape) and host storey → `levelId`.
- **IfcWall** with **`Pset_WallCommon.Reference`** → `createWall` with wall geometry recovered from **`IfcExtrudedAreaSolid`** + **`IfcArbitraryClosedProfileDef`** / **`IfcIndexedPolyCurve`** profile (kernel exporter shape) and host storey → `levelId`.
- **IfcSpace** with **`Pset_SpaceCommon.Reference`** → `createRoomOutline` with footprint from the slab-style extrusion + object placement (kernel exporter shape); optional programme strings from **`Pset_SpaceCommon`**; host storey from **`IfcRelContainedInSpatialStructure`** or kernel **`IfcRelAggregates`** → `levelId`.
- **`idsAuthoritativeReplayMap_v0`:** sorted per-space rows (`ifcGlobalId`, `identityReference`, `programmeFields`, `qtoSpaceBaseQuantitiesLinked`) mapping IDS read-back to replay rows (ties to **`exchange_ifc_ids_identity_pset_gap`** / **`exchange_ifc_ids_qto_gap`** at document level — not a new advisor rule).
- **`unsupportedIfcProducts`:** same rollup as `inspect_kernel_ifc_semantics.importScopeUnsupportedIfcProducts_v0` (foreign `IfcProduct` classes), distinct from replay targets.
- **Wall-hosted openings:** `IfcDoor` / `IfcWindow` with `FillsVoids` → `IfcOpeningElement` → `VoidsElements` → host `IfcWall`; filler / opening **`Pset_*Common.Reference`** → command `id`, wall **`Pset_WallCommon.Reference`** → `wallId`. **`kernelDoorSkippedNoReference`** / **`kernelWindowSkippedNoReference`** count fill products missing identity `Reference`.
- **Slab + slab voids:** `IfcSlab` with **`Pset_SlabCommon.Reference`** → `createFloor` (footprint + thickness from kernel-style extrusion); slab-hosted `IfcOpeningElement` voids (name `op:<kernelSlabOpeningId>`) → `createSlabOpening` with `hostFloorId` + `boundaryMm`. Other `IfcOpeningElement` instances (e.g. roof-hosted, or wall void topology already covered by the door/window path) are **skipped** with reasons rolled into **`slabRoofHostedVoidReplaySkipped_v0`** (sorted `countsByHostKindAndReason`, optional `detailRows`).
- **`extractionGaps`:** products that carry `Reference` but lack readable body / host storey (wall vs space rows); **`kernelWallSkippedNoReference`** / **`kernelSpaceSkippedNoReference`** count IFC instances outside kernel identity coverage for each product class.

**Still not in v0:** arbitrary IFC importers and unconstrained merge outside this authoritative bundle + preflight. **`summarize_kernel_ifc_semantic_roundtrip`** nests replay under **`commandSketch.authoritativeReplay_v0`**.

### Engine apply (additive merge)

[`try_apply_kernel_ifc_authoritative_replay_v0`](../app/bim_ai/engine.py) accepts the **`authoritativeReplay_v0`** object (or sketch-shaped dict) and applies its **`commands`** to the current **`Document`** via **`try_commit_bundle`** after **preflight**: explicit-id **`merge_id_collision`** vs existing elements / the bundle, and **`merge_reference_unresolved`** for `levelId` / `wallId` / `hostFloorId` that are neither already in the document nor created by earlier commands in the list.

**Outcomes:** `ok` on success; `merge_id_collision` / `merge_reference_unresolved` when preflight fails (returns the validated **`commands`** list); `sketch_unavailable` when `available` is not true; `invalid_sketch` for wrong `replayKind` or `schemaVersion`; `invalid_command` for a non-list `commands` or any entry whose `type` is not one of `createLevel` / `createFloor` / `createWall` / `createRoomOutline` / `insertDoorOnWall` / `insertWindowOnWall` / `createSlabOpening`; `constraint_error` when **`try_commit_bundle`** evaluation hits blocking violations. **`exchange_ifc_ids_identity_pset_gap`** / **`exchange_ifc_ids_qto_gap`** may append a deterministic pointer to **`commandSketch.authoritativeReplay_v0.idsAuthoritativeReplayMap_v0`** (row count) when the roundtrip gate runs — not a `quickFixCommand` bundle.

## Still deferred

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
