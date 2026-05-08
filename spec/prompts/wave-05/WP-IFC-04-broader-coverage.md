# WP-IFC-04 — Broader IFC coverage (closeout)

## Branch

`feat/wave-05-ifc-04-broader-coverage`

## Goal

Finish the IFC export coverage. Today (commit `93e1e46e`) layered material `Pset_MaterialCommon`, broader QTO on walls/roofs/doors/windows, and optional `IfcClassificationReference` on architectural categories ship. Deferred per the row: full `Pset_*Common` coverage for non-architectural categories; element-occurrence classifications via `IfcRelAssociatesClassification` on stairs / columns / beams; material category mapping to IFC-standard categories.

## Done rule

(a) Stairs, columns, beams, ceilings, and railings each gain their `Pset_*Common` (`Pset_StairCommon`, `Pset_ColumnCommon`, `Pset_BeamCommon`, `Pset_CoveringCommon` for ceilings, `Pset_RailingCommon`).
(b) `IfcRelAssociatesClassification` is emitted on stairs / columns / beams when the element carries `ifcClassificationCode` (today only architectural categories support this).
(c) Material → IFC category mapping: `MAT-01` material's `category` field (e.g. `"wood"`, `"concrete"`, `"steel"`, `"glass"`) maps to the IFC-standard material category strings (`"Wood"`, `"Concrete"`, `"Steel"`, `"Glass"` per the IFC4 schema).
(d) Round-trip pytest coverage: export → re-parse → assert each new pset / classification / category mapping is present.
(e) Tracker row for IFC-04 flips from `partial` → `done`.

---

## File 1 — `app/bim_ai/export_ifc.py`

Three additions:

### 1a — Pset functions per element kind

Add helpers:

```python
def _attach_stair_common_pset(ifc_file, ifc_stair, stair: StairElem) -> None: ...
def _attach_column_common_pset(ifc_file, ifc_column, column: ColumnElem) -> None: ...
def _attach_beam_common_pset(ifc_file, ifc_beam, beam: BeamElem) -> None: ...
def _attach_ceiling_common_pset(ifc_file, ifc_covering, ceiling: CeilingElem) -> None: ...
def _attach_railing_common_pset(ifc_file, ifc_railing, railing: RailingElem) -> None: ...
```

Each populates the standard properties from the IFC4 schema for that pset (e.g. `Pset_StairCommon` includes `NumberOfRiser`, `NumberOfTreads`, `RiserHeight`, `TreadLength`, `NosingLength`, `WaterproofingMembrane`, `IsExternal`, `LoadBearing`). Look up the canonical property names from buildingSMART; only emit properties that have a value on the bim-ai element.

Call these from the existing per-kind export functions where `Pset_*Common` is currently absent.

### 1b — Classifications for stairs / columns / beams

The current architectural-category code path (`if elem.ifcClassificationCode is not None: ...`) lives in the wall/floor/roof/door/window export functions. Extract that pattern into a shared helper:

```python
def _maybe_attach_classification(ifc_file, ifc_entity, element) -> None: ...
```

…and call it from the stair / column / beam export functions.

### 1c — Material category mapping

Add a small dict / function:

```python
_MATERIAL_CATEGORY_TO_IFC = {
  "wood": "Wood",
  "concrete": "Concrete",
  "steel": "Steel",
  "glass": "Glass",
  "masonry": "Masonry",
  "stone": "Stone",
  "metal": "Metal",
  "plastic": "Plastic",
  "gypsum": "Gypsum",
  "insulation": "Insulation",
  # add the full MAT-01 set
}

def _ifc_material_category(mat: MaterialEntry) -> str | None: ...
```

When emitting an `IfcMaterial`, set its `Category` attribute via this mapping.

## File 2 — `app/bim_ai/elements.py`

Add `ifc_classification_code: str | None` (alias `ifcClassificationCode`) to `StairElem`, `ColumnElem`, `BeamElem` (mirroring the architectural elements that already have it).

## File 3 — `packages/core/src/index.ts`

Mirror the new optional `ifcClassificationCode` fields on the TS Stair / Column / Beam shapes.

## Tests

`app/tests/test_export_ifc_broader_coverage.py` (new):

- `test_pset_stair_common_emitted`
- `test_pset_column_common_emitted`
- `test_pset_beam_common_emitted`
- `test_pset_ceiling_covering_emitted`
- `test_pset_railing_common_emitted`
- `test_classification_on_stair`
- `test_classification_on_column`
- `test_classification_on_beam`
- `test_material_category_wood_maps_to_ifc_wood`
- `test_material_category_unknown_falls_back_to_none`

Each test exports a tiny model containing the relevant element, re-parses the resulting IFC via `ifcopenshell`, and asserts the expected pset / classification / category attribute is present.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai/export_ifc.py bim_ai/elements.py
cd app && .venv/bin/pytest tests/test_export_ifc_broader_coverage.py tests/test_export_ifc.py
```

## Tracker

Flip IFC-04 row from `partial` → `done`. Replace deferred-scope text with as-shipped: full Pset_*Common across stairs / columns / beams / ceilings / railings; `IfcRelAssociatesClassification` on stairs / columns / beams; MAT-01 material category → IFC category mapping.

## Non-goals

- IFC import side — this is export only. Import path is FED-04.
- Custom `Pset_X` (project-specific propertysets) — schema-defined `Pset_*Common` only.
- IFC2x3 (legacy) compatibility — IFC4 only.
- Cost / schedule data (`Pset_Cost`, `Pset_Schedule`) — out of scope until QTO has a bigger product story.
