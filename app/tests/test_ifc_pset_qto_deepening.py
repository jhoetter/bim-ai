"""Tests for WP-X03/WP-X05/WP-D06: PropertySet/QTO deepening and IDS adviser expansion."""

from __future__ import annotations

import math

from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    StairElem,
    WallElem,
)


def _make_full_doc() -> Document:
    """Document with wall, floor, roof, stair, and room for combined coverage tests."""
    return Document(
        revision=5001,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="Ground", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="First", elevationMm=3200),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 8000, "yMm": 0},
                thicknessMm=200,
                heightMm=3200,
            ),
            "fl1": FloorElem(
                kind="floor",
                id="fl1",
                name="Slab",
                levelId="l0",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 6000},
                    {"xMm": 0, "yMm": 6000},
                ],
                thicknessMm=250,
            ),
            "rf1": RoofElem(
                kind="roof",
                id="rf1",
                name="Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 6000},
                    {"xMm": 0, "yMm": 6000},
                ],
            ),
            "st1": StairElem(
                kind="stair",
                id="st1",
                name="MainStair",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 1000, "yMm": 1000},
                runEndMm={"xMm": 3500, "yMm": 1000},
                widthMm=1200,
                riserMm=200,
            ),
            "rm1": RoomElem(
                kind="room",
                id="rm1",
                name="Lab",
                levelId="l0",
                outlineMm=[
                    {"xMm": 500, "yMm": 500},
                    {"xMm": 7500, "yMm": 500},
                    {"xMm": 7500, "yMm": 5500},
                    {"xMm": 500, "yMm": 5500},
                ],
            ),
        },
    )


def test_stair_qto_emitted_in_ifc_export() -> None:
    """Exported IFC STEP includes Qto_StairBaseQuantities attached to IfcStair."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)

    qtys = model.by_type("IfcElementQuantity")
    names = {q.Name for q in qtys if getattr(q, "Name", None)}
    assert "Qto_StairBaseQuantities" in names, f"Stair QTO missing; QTO names present: {sorted(names)}"


def test_stair_qto_fields_present() -> None:
    """Qto_StairBaseQuantities contains NumberOfRisers, NumberOfTreads, Height, Length."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)

    stairs = model.by_type("IfcStair") or []
    assert stairs, "No IfcStair in exported STEP"

    for sta in stairs:
        rels = getattr(sta, "IsDefinedBy", None) or []
        found_qto: dict[str, float] = {}
        for rel in rels:
            try:
                if not rel.is_a("IfcRelDefinesByProperties"):
                    continue
            except Exception:
                continue
            dfn = getattr(rel, "RelatingPropertyDefinition", None)
            if dfn is None:
                continue
            try:
                if not dfn.is_a("IfcElementQuantity"):
                    continue
                if getattr(dfn, "Name", None) != "Qto_StairBaseQuantities":
                    continue
            except Exception:
                continue
            for qty in getattr(dfn, "Quantities", None) or []:
                name = str(getattr(qty, "Name", None) or "")
                for attr in ("CountValue", "LengthValue"):
                    val = getattr(qty, attr, None)
                    if val is not None:
                        found_qto[name] = float(val)
                        break

        assert "NumberOfRisers" in found_qto, f"NumberOfRisers missing from stair QTO: {found_qto}"
        assert "NumberOfTreads" in found_qto, f"NumberOfTreads missing from stair QTO: {found_qto}"
        assert "Height" in found_qto, f"Height missing from stair QTO: {found_qto}"
        assert "Length" in found_qto, f"Length missing from stair QTO: {found_qto}"

        riser_count = found_qto["NumberOfRisers"]
        tread_count = found_qto["NumberOfTreads"]
        assert riser_count >= 1
        assert tread_count == riser_count - 1

        height_m = found_qto["Height"]
        assert abs(height_m - 3.2) < 0.1, f"Expected ~3.2m height for 3200mm rise, got {height_m}"

        run_length_m = found_qto["Length"]
        expected_len = math.hypot(3500 - 1000, 0) / 1000.0
        assert abs(run_length_m - expected_len) < 0.01, f"Run length mismatch: {run_length_m} vs {expected_len}"


def test_room_qto_includes_perimeter_and_volume() -> None:
    """Qto_SpaceBaseQuantities includes NetPerimeter and NetVolume in addition to NetFloorArea."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)

    spaces = model.by_type("IfcSpace") or []
    assert spaces, "No IfcSpace in exported STEP"

    for sp in spaces:
        found_qto: dict[str, float] = {}
        rels = getattr(sp, "IsDefinedBy", None) or []
        for rel in rels:
            try:
                if not rel.is_a("IfcRelDefinesByProperties"):
                    continue
            except Exception:
                continue
            dfn = getattr(rel, "RelatingPropertyDefinition", None)
            if dfn is None:
                continue
            try:
                if not dfn.is_a("IfcElementQuantity"):
                    continue
                if getattr(dfn, "Name", None) != "Qto_SpaceBaseQuantities":
                    continue
            except Exception:
                continue
            for qty in getattr(dfn, "Quantities", None) or []:
                name = str(getattr(qty, "Name", None) or "")
                for attr in ("AreaValue", "VolumeValue", "LengthValue", "CountValue"):
                    val = getattr(qty, attr, None)
                    if val is not None:
                        found_qto[name] = float(val)
                        break

        assert "NetFloorArea" in found_qto, f"NetFloorArea missing from space QTO: {found_qto}"
        assert "NetPerimeter" in found_qto, f"NetPerimeter missing from space QTO: {found_qto}"
        assert "NetVolume" in found_qto, f"NetVolume missing from space QTO: {found_qto}"

        assert found_qto["NetPerimeter"] > 0, "NetPerimeter must be positive"
        assert found_qto["NetVolume"] > 0, "NetVolume must be positive"
        assert found_qto["NetFloorArea"] > 0, "NetFloorArea must be positive"


def test_stair_authoritative_replay_includes_total_height_mm() -> None:
    """Stair replay commands carry totalHeightMm derived from geometry."""
    from bim_ai.export_ifc import (
        build_kernel_ifc_authoritative_replay_sketch_v0,
        export_ifc_model_step,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)

    assert sketch["available"] is True
    stair_cmds = [c for c in sketch["commands"] if c.get("type") == "createStair"]
    assert stair_cmds, "No stair replay commands"

    for cmd in stair_cmds:
        assert "totalHeightMm" in cmd, f"totalHeightMm missing from stair replay cmd: {cmd}"
        assert float(cmd["totalHeightMm"]) > 0, "totalHeightMm must be positive"


def test_stair_authoritative_replay_includes_riser_and_tread_count() -> None:
    """Stair replay commands carry riserCount and treadCount from Qto_StairBaseQuantities."""
    from bim_ai.export_ifc import (
        build_kernel_ifc_authoritative_replay_sketch_v0,
        export_ifc_model_step,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)

    stair_cmds = [c for c in sketch["commands"] if c.get("type") == "createStair"]
    assert stair_cmds

    for cmd in stair_cmds:
        assert "riserCount" in cmd, f"riserCount missing from stair cmd: {cmd}"
        assert "treadCount" in cmd, f"treadCount missing from stair cmd: {cmd}"
        assert int(cmd["riserCount"]) >= 1
        assert int(cmd["treadCount"]) == int(cmd["riserCount"]) - 1


def test_ids_authoritative_replay_map_includes_stairs_section() -> None:
    """idsAuthoritativeReplayMap_v0 includes a 'stairs' section with typed rows."""
    from bim_ai.export_ifc import (
        build_kernel_ifc_authoritative_replay_sketch_v0,
        export_ifc_model_step,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)

    assert sketch["available"] is True
    ids_map = sketch.get("idsAuthoritativeReplayMap_v0") or {}
    assert "stairs" in ids_map, f"No 'stairs' key in idsAuthoritativeReplayMap_v0: {list(ids_map.keys())}"

    stair_rows = ids_map["stairs"]
    assert isinstance(stair_rows, list)
    assert len(stair_rows) > 0, "Expected at least one stair IDS row"

    for row in stair_rows:
        assert "ifcGlobalId" in row
        assert "identityReference" in row
        assert "qtoStairBaseQuantitiesLinked" in row
        assert "totalHeightMm" in row
        assert isinstance(row["qtoStairBaseQuantitiesLinked"], bool)


def test_property_set_coverage_expansion_v1_includes_floor_and_roof() -> None:
    """ifcPropertySetCoverageExpansion_v1 covers IfcSlab and IfcRoof product classes."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step
    from bim_ai.ifc_property_set_coverage_evidence_v0 import (
        build_ifc_property_set_coverage_expansion_v1,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    result = build_ifc_property_set_coverage_expansion_v1(model)

    assert result["available"] is True
    rows = result["rows"]
    classes = {r["ifcProductClass"] for r in rows}
    assert "IfcSlab" in classes, f"IfcSlab missing from expansion: {sorted(classes)}"
    assert "IfcRoof" in classes, f"IfcRoof missing from expansion: {sorted(classes)}"
    assert "IfcStair" in classes, f"IfcStair missing from expansion: {sorted(classes)}"


def test_property_set_coverage_expansion_v1_field_counts() -> None:
    """Per-class rows have positive field counts where products are emitted."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step
    from bim_ai.ifc_property_set_coverage_evidence_v0 import (
        build_ifc_property_set_coverage_expansion_v1,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    result = build_ifc_property_set_coverage_expansion_v1(model)

    rows_by_class = {r["ifcProductClass"]: r for r in result["rows"]}

    for cls in ("IfcWall", "IfcSlab", "IfcRoof", "IfcStair", "IfcSpace"):
        row = rows_by_class.get(cls)
        assert row is not None, f"No expansion row for {cls}"
        assert row["productCount"] >= 1, f"{cls} should have ≥1 product in test doc"
        assert row["psetFieldCountTotal"] > 0, f"{cls} pset field count should be > 0"
        assert row["psetFieldPopulatedCount"] > 0, f"{cls} should have populated pset fields"


def test_ifc_manifest_property_set_coverage_includes_expansion_v1() -> None:
    """ifc_manifest_v0.ifcPropertySetCoverageEvidence_v0 includes ifcPropertySetCoverageExpansion_v1."""
    from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload

    doc = _make_full_doc()
    manifest = build_ifc_exchange_manifest_payload(doc)

    ps_cov = manifest.get("ifcPropertySetCoverageEvidence_v0")
    assert ps_cov is not None, "ifcPropertySetCoverageEvidence_v0 missing from manifest"
    assert "ifcPropertySetCoverageExpansion_v1" in ps_cov, (
        f"ifcPropertySetCoverageExpansion_v1 missing from coverage evidence; keys: {list(ps_cov.keys())}"
    )
    expansion = ps_cov["ifcPropertySetCoverageExpansion_v1"]
    assert expansion.get("available") is True
    assert len(expansion.get("rows", [])) > 0


def test_qto_linked_products_includes_ifc_stair() -> None:
    """inspect_kernel_ifc_semantics.qtoLinkedProducts includes IfcStair."""
    from bim_ai.export_ifc import export_ifc_model_step, inspect_kernel_ifc_semantics

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    inspection = inspect_kernel_ifc_semantics(doc=doc, step_text=step)

    assert inspection["available"] is True
    qto_linked = inspection.get("qtoLinkedProducts") or {}
    assert "IfcStair" in qto_linked, f"IfcStair missing from qtoLinkedProducts: {list(qto_linked.keys())}"
    assert qto_linked["IfcStair"] >= 1, f"Expected ≥1 stair with QTO, got {qto_linked['IfcStair']}"


def test_ids_adviser_exchange_ifc_pset_floor_gap_fires_for_orphan_floor() -> None:
    """exchange_ifc_pset_floor_gap fires when floor has missing Reference pset."""
    import ifcopenshell
    import ifcopenshell.api.pset
    import ifcopenshell.api.root

    from bim_ai.ifc_property_set_coverage_evidence_v0 import (
        build_kernel_ifc_property_set_coverage_evidence_v0,
    )

    doc = Document(
        revision=5002,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=3000,
            ),
            "fl1": FloorElem(
                kind="floor",
                id="fl1",
                name="Slab",
                levelId="l0",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                thicknessMm=200,
            ),
        },
    )

    from bim_ai.export_ifc import export_ifc_model_step

    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)

    coverage = build_kernel_ifc_property_set_coverage_evidence_v0(model, doc)
    floor_rows = [r for r in (coverage.get("rows") or []) if r.get("kernelKind") == "floor"]
    assert floor_rows, "No floor coverage rows"
    # A floor with Reference pointing to its doc element should not have a pset gap — this confirms wiring.
    ok_rows = [r for r in floor_rows if r.get("idsGapReasonToken") == "ids_ok"]
    assert ok_rows, "Expected floor rows to be ok when Reference matches document element"


def test_ids_adviser_exchange_ifc_qto_stair_gap_rule_registered() -> None:
    """exchange_ifc_qto_stair_gap is registered as an exchange-discipline rule."""
    from bim_ai.constraints import _RULE_DISCIPLINE  # type: ignore[attr-defined]

    assert "exchange_ifc_qto_stair_gap" in _RULE_DISCIPLINE
    assert _RULE_DISCIPLINE["exchange_ifc_qto_stair_gap"] == "exchange"


def test_ids_adviser_exchange_ifc_qto_room_gap_rule_registered() -> None:
    from bim_ai.constraints import _RULE_DISCIPLINE  # type: ignore[attr-defined]

    assert "exchange_ifc_qto_room_gap" in _RULE_DISCIPLINE
    assert _RULE_DISCIPLINE["exchange_ifc_qto_room_gap"] == "exchange"


def test_ids_adviser_exchange_ifc_pset_floor_gap_rule_registered() -> None:
    from bim_ai.constraints import _RULE_DISCIPLINE  # type: ignore[attr-defined]

    assert "exchange_ifc_pset_floor_gap" in _RULE_DISCIPLINE
    assert _RULE_DISCIPLINE["exchange_ifc_pset_floor_gap"] == "exchange"


def test_ids_adviser_exchange_ifc_pset_roof_gap_rule_registered() -> None:
    from bim_ai.constraints import _RULE_DISCIPLINE  # type: ignore[attr-defined]

    assert "exchange_ifc_pset_roof_gap" in _RULE_DISCIPLINE
    assert _RULE_DISCIPLINE["exchange_ifc_pset_roof_gap"] == "exchange"


def test_floor_pset_coverage_row_in_property_set_coverage_evidence() -> None:
    """build_kernel_ifc_property_set_coverage_evidence_v0 emits rows for IfcSlab with Pset_SlabCommon."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step
    from bim_ai.ifc_property_set_coverage_evidence_v0 import (
        build_kernel_ifc_property_set_coverage_evidence_v0,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    coverage = build_kernel_ifc_property_set_coverage_evidence_v0(model, doc)

    assert coverage["available"] is True
    rows = coverage["rows"]
    floor_rows = [r for r in rows if r.get("kernelKind") == "floor"]
    assert floor_rows, "No floor rows in property set coverage evidence"

    for row in floor_rows:
        assert row["ifcProductClass"] == "IfcSlab"
        assert "Pset_SlabCommon" in (row.get("expectedPropertySetNames") or [])


def test_roof_pset_coverage_row_in_property_set_coverage_evidence() -> None:
    """build_kernel_ifc_property_set_coverage_evidence_v0 emits rows for IfcRoof with Pset_RoofCommon."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step
    from bim_ai.ifc_property_set_coverage_evidence_v0 import (
        build_kernel_ifc_property_set_coverage_evidence_v0,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    coverage = build_kernel_ifc_property_set_coverage_evidence_v0(model, doc)

    roof_rows = [r for r in (coverage.get("rows") or []) if r.get("kernelKind") == "roof"]
    assert roof_rows, "No roof rows in property set coverage evidence"

    for row in roof_rows:
        assert row["ifcProductClass"] == "IfcRoof"
        assert "Pset_RoofCommon" in (row.get("expectedPropertySetNames") or [])


def test_stair_pset_coverage_row_ids_token_ok_for_well_formed_stair() -> None:
    """Stair coverage rows have ids_ok token when Pset_StairCommon.Reference matches document element."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step
    from bim_ai.ifc_property_set_coverage_evidence_v0 import (
        build_kernel_ifc_property_set_coverage_evidence_v0,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    coverage = build_kernel_ifc_property_set_coverage_evidence_v0(model, doc)

    stair_rows = [r for r in (coverage.get("rows") or []) if r.get("kernelKind") == "stair"]
    assert stair_rows, "No stair rows in property set coverage evidence"

    ok_rows = [r for r in stair_rows if r.get("idsGapReasonToken") == "ids_ok"]
    assert ok_rows, f"Expected stair rows with ids_ok; got tokens: {[r.get('idsGapReasonToken') for r in stair_rows]}"


def test_property_set_coverage_expansion_v1_schema_version() -> None:
    """ifcPropertySetCoverageExpansion_v1 carries schemaVersion=1."""
    import ifcopenshell

    from bim_ai.export_ifc import export_ifc_model_step
    from bim_ai.ifc_property_set_coverage_evidence_v0 import (
        build_ifc_property_set_coverage_expansion_v1,
    )

    doc = _make_full_doc()
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    result = build_ifc_property_set_coverage_expansion_v1(model)

    assert result["schemaVersion"] == 1
