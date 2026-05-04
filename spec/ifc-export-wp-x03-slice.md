# WP‑X03 IFC export — kernel slice (exchange parity with visual export)

Companion to [revit-production-parity-workpackage-tracker.md](./revit-production-parity-workpackage-tracker.md) **WP‑X03** and PRD §12 (OpenBIM-first).

## Encoding stack choice

| Option | Pros | Cons |
|--------|------|------|
| **ifcopenshell** (recommended for X03‑2 onward) | Valid IFC graphs, IFC4 schema enums, incremental entity coverage | Native wheel / CI image size; server deploy story |
| Hand-authored STEP snippet | Zero new deps today | Extremely error-prone references; brittle for anything beyond EMPTY DATA |

**Decision:** Ship **manifest + canonical download URL** aligned with [`export_gltf.py`](../app/bim_ai/export_gltf.py) statistics (`exportedIfcKindsInArtifact`, parity counts, unsupported kinds). **`model.ifc`** serves an **IfcOpenShell-backed IFC4 subset** (`bim_ai/export_ifc.py`) when **`ifcopenshell`** (`pyproject.toml` `[ifc]`) is installed and the document is **kernel-eligible** (≥1 wall and ≥1 floor-with-boundary together); otherwise the validated empty DATA hull `bim_ai_ifc_empty_shell_v0`.

## Kernel ↔ IFC4 targets (geometry parity slice)

Semantics mirror [`export_manifest_extension_payload`](../app/bim_ai/export_gltf.py) / box kernel: **`wall`**, **`floor`**, **`roof`**, **`stair`**, **`door`**, **`window`**, **`room`**, **`slab_opening`**, with **`level`** as spatial context (**`IfcBuildingStorey`**).

| Kernel `kind` | IFC product (implemented) | Notes |
|---------------|---------------------------|-------|
| `level` | `IfcBuildingStorey` | Naming from `LevelElem`; default storey when no levels declared |
| `wall` | `IfcWall` + extrusion (`create_2pt_wall`) | Host for hosted openings |
| `floor` | `IfcSlab` | Boundary polyline extruded along vertical axis; slabs tracked for slab-hosted voids |
| `slab_opening` | `IfcOpeningElement` + `IfcRelVoidsElement` → host `IfcSlab` | Vertical prism through slab thickness (approx mass void) |
| `roof` | `IfcRoof` | Prism mass from footprint; height heuristic aligned with glTF roof box |
| `stair` | `IfcStair` | Run-oriented prism via `create_2pt_wall` API (mass proxy) |
| `door`, `window` | `IfcOpeningElement` + `IfcDoor` / `IfcWindow` fillings | Hosted to wall; rel void + rel fill |
| `room` | `IfcSpace` | Outline prism spanning level → upper limit heuristic |

Kinds **outside** [`EXPORT_GEOMETRY_KINDS`](../app/bim_ai/export_gltf.py) stay in `unsupportedDocumentKindsDetailed` on both IFC and glTF manifest slices (parity).

`ifc_manifest_v0` may also include **`ifcKernelGeometrySkippedCounts`** documenting instances that cannot be emitted (missing hosts, degenerate footprints); when IfcOpenShell is installed and the model is kernel-eligible, the advisor may emit an informational `exchange_ifc_kernel_geometry_skip_summary` tied to the same map.

## Deferred / omitted (explicit)

- IFC **import** and minimal merge read.
- **`IfcOpeningElement`** with full boolean tessellation regeneration for walls vs extruded proxy gaps only.

## Implemented in this slice (WP‑X03)

- **Property sets (kernel):** emitted products receive buildingSMART-aligned `Pset_*Common` instances with a deterministic `Reference` string (kernel element id) via `ifcopenshell.api.pset.{add_pset,edit_pset}` — see `try_build_kernel_ifc()` in [`export_ifc.py`](../app/bim_ai/export_ifc.py).
- **Quantities:** still minimal in this wave (no `IfcElementQuantity` roll-up yet).

## Still deferred

- Broader QTO roll-ups, materials, classifications, and layered composites.
- **Draco**/mesh-compression on glTF sibling export (tracked under WP‑X02).

When these land, bump `ifcEncoding` commentary / `kernelNote` in [`export_ifc.py`](../app/bim_ai/export_ifc.py) and extend this table.

## Previous explicit deferrals (history)

- ~~Property sets, quantities, materials, classifications.~~ → **Psets (Reference) shipped; QTO/materials remain.**

## Artifact contract

| Resource | Purpose |
|---------|---------|
| `GET …/exports/ifc-manifest` | **`ifc_manifest_v0`** JSON: parity fields + `ifcEncoding` + `artifactHasGeometryEntities` + `exportedIfcKindsInArtifact` hints |
| `GET …/exports/model.ifc` | Downloadable IFC STEP — **`bim_ai_ifc_kernel_v1`** kernel solids when **`ifcopenshell`** + eligible geometry exists; **`bim_ai_ifc_empty_shell_v0`** empty DATA otherwise |
