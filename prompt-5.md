# Prompt 5 - OpenBIM IFC PropertySet QTO And IDS Deepening V1

## Mission

Deepen IFC export/import to cover fuller PropertySet and QTO surfaces, extend IDS adviser coverage, and harden the authoritative replay bundle with richer identity and quantity data.

## Target Workpackages

- WP-X03 (IFC export/import) — currently partial ~64%
- WP-X05 (IDS validation) — currently partial ~60%
- WP-D06 (Cleanroom metadata and IDS) — currently partial ~64%

## Scope

### Backend (`app/bim_ai/`)

1. **PropertySet coverage expansion** — extend `ifc_property_set_coverage_evidence_v0.py`:
   - Add floor (`IfcSlab`) and roof (`IfcRoof`) property set coverage rows alongside existing wall/door/window.
   - Include `Pset_SlabCommon`, `Pset_RoofCommon` property mapping.
   - `ifcPropertySetCoverageExpansion_v1` evidence: per-product-class pset name → field count → populated count.

2. **QTO deepening** — extend `export_ifc.py` and `ifc_stub.py`:
   - Stair QTO: `Qto_StairBaseQuantities` (riser count, tread count, total height, total length).
   - Room QTO: `Qto_SpaceBaseQuantities` (net floor area, net volume, net perimeter) derived from room element data.
   - Evidence: `ifcQtoExpansion_v1` per-product QTO field completeness.

3. **IDS adviser expansion** — extend `constraints.py`:
   - `exchange_ifc_qto_stair_gap`: fires when stair QTO fields are incomplete.
   - `exchange_ifc_qto_room_gap`: fires when room/space QTO fields are incomplete.
   - `exchange_ifc_pset_floor_gap`: fires when floor Pset fields are incomplete.
   - `exchange_ifc_pset_roof_gap`: fires when roof Pset fields are incomplete.

4. **Authoritative replay enrichment** — extend `ifc_stub.py`:
   - `authoritativeReplay_v0` stair rows: include `riserCount`, `treadCount`, `totalHeightMm`.
   - `idsAuthoritativeReplayMap_v0` includes typed `stairs`/`IfcStairFlight` rows.

### Tests

5. `test_ifc_pset_qto_deepening.py`:
   - Export doc with floors, roofs, stairs, rooms → verify PropertySet and QTO fields populated in IFC semantics.
   - Verify IDS adviser rules fire for incomplete products.
   - Verify authoritative replay includes stair quantity data.
   - Verify `ifcPropertySetCoverageExpansion_v1` evidence counts.

## Non-goals

- Arbitrary IFC graph merge (remains deferred).
- Custom user-defined property sets.
- IFC4x3 or IFC5 schema extensions.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_ifc_pset_qto_deepening.py tests/test_export_ifc.py tests/test_ids_enforcement.py tests/test_ifc_exchange_manifest_offline.py -x -v
cd packages/web && pnpm typecheck
```

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md`: Recent Sprint Ledger + WP-X03, WP-X05, WP-D06 rows.
- Create branch `prompt-5-ifc-pset-qto-ids-deepening` from `main`.
- Commit and push. Do not open a pull request.
