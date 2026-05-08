"""IFC-04 closeout — broader Pset_*Common, classification, and material category coverage.

These tests round-trip a kernel `Document` through `export_ifc_model_step`,
re-parse the resulting IFC4 STEP via ifcopenshell, and assert the new
psets / IfcRelAssociatesClassification / IfcMaterial.Category attributes
land on the expected products.
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    BeamElem,
    CeilingElem,
    ColumnElem,
    LevelElem,
    RailingElem,
    StairElem,
)
from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step

pytestmark = pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)


def _parse(step: str):
    import ifcopenshell

    return ifcopenshell.file.from_string(step)


def _psets_for(product) -> dict:
    import ifcopenshell.util.element as elem_util

    return elem_util.get_psets(product) or {}


def _classification_codes_for(product) -> list[str]:
    """Pull classification identifications from `IfcRelAssociatesClassification`
    rels referencing this product."""

    out: list[str] = []
    for rel in product.HasAssociations or []:
        if not rel.is_a("IfcRelAssociatesClassification"):
            continue
        ref = rel.RelatingClassification
        if ref is None:
            continue
        ident = getattr(ref, "Identification", None) or getattr(ref, "ItemReference", None)
        if ident:
            out.append(str(ident))
    return out


def _stair_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="L1", elevationMm=3000),
            "stair-a": StairElem(
                kind="stair",
                id="stair-a",
                name="Stair",
                baseLevelId="lvl-g",
                topLevelId="lvl-1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 3000, "yMm": 0},
                widthMm=1100,
                riserMm=180,
                treadMm=280,
                ifcClassificationCode="OmniClass:23.30.20.14",
            ),
        },
    )


def test_pset_stair_common_emitted() -> None:
    doc = _stair_doc()
    step = export_ifc_model_step(doc)
    model = _parse(step)
    stairs = model.by_type("IfcStair") or []
    assert len(stairs) == 1
    psets = _psets_for(stairs[0])
    bucket = psets.get("Pset_StairCommon") or {}
    assert int(bucket.get("NumberOfRiser") or 0) >= 1
    assert int(bucket.get("NumberOfTreads") or 0) >= 0
    assert float(bucket.get("RiserHeight") or 0) == pytest.approx(0.180, abs=1e-3)
    assert float(bucket.get("TreadLength") or 0) == pytest.approx(0.280, abs=1e-3)


def test_classification_on_stair() -> None:
    doc = _stair_doc()
    step = export_ifc_model_step(doc)
    model = _parse(step)
    stairs = model.by_type("IfcStair") or []
    assert len(stairs) == 1
    codes = _classification_codes_for(stairs[0])
    assert "OmniClass:23.30.20.14" in codes


def _column_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "col-a": ColumnElem(
                kind="column",
                id="col-a",
                name="Col",
                levelId="lvl-g",
                positionMm={"xMm": 1000, "yMm": 1000},
                bMm=300,
                hMm=300,
                heightMm=2800,
                materialKey="timber_stud",
                ifcClassificationCode="Uniclass:Pr_20_31_53",
            ),
        },
    )


def test_pset_column_common_emitted() -> None:
    doc = _column_doc()
    step = export_ifc_model_step(doc)
    model = _parse(step)
    cols = model.by_type("IfcColumn") or []
    assert len(cols) == 1
    psets = _psets_for(cols[0])
    bucket = psets.get("Pset_ColumnCommon") or {}
    assert str(bucket.get("Reference")) == "col-a"
    assert bool(bucket.get("LoadBearing")) is True
    assert bool(bucket.get("IsExternal")) is False


def test_classification_on_column() -> None:
    doc = _column_doc()
    step = export_ifc_model_step(doc)
    model = _parse(step)
    cols = model.by_type("IfcColumn") or []
    assert len(cols) == 1
    codes = _classification_codes_for(cols[0])
    assert "Uniclass:Pr_20_31_53" in codes


def _beam_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "beam-a": BeamElem(
                kind="beam",
                id="beam-a",
                name="Beam",
                levelId="lvl-g",
                startMm={"xMm": 0, "yMm": 0},
                endMm={"xMm": 4000, "yMm": 0},
                widthMm=200,
                heightMm=400,
                ifcClassificationCode="OmniClass:23.30.30.11",
            ),
        },
    )


def test_pset_beam_common_emitted() -> None:
    doc = _beam_doc()
    step = export_ifc_model_step(doc)
    model = _parse(step)
    beams = model.by_type("IfcBeam") or []
    assert len(beams) == 1
    psets = _psets_for(beams[0])
    bucket = psets.get("Pset_BeamCommon") or {}
    assert str(bucket.get("Reference")) == "beam-a"
    assert float(bucket.get("Span") or 0) == pytest.approx(4.0, abs=1e-3)
    assert bool(bucket.get("LoadBearing")) is True


def test_classification_on_beam() -> None:
    doc = _beam_doc()
    step = export_ifc_model_step(doc)
    model = _parse(step)
    beams = model.by_type("IfcBeam") or []
    assert len(beams) == 1
    codes = _classification_codes_for(beams[0])
    assert "OmniClass:23.30.30.11" in codes


def test_pset_ceiling_covering_emitted() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "ceil-a": CeilingElem(
                kind="ceiling",
                id="ceil-a",
                name="Ceiling",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                heightOffsetMm=2700,
                thicknessMm=20,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = _parse(step)
    coverings = model.by_type("IfcCovering") or []
    assert len(coverings) == 1
    psets = _psets_for(coverings[0])
    bucket = psets.get("Pset_CoveringCommon") or {}
    assert str(bucket.get("Reference")) == "ceil-a"


def test_pset_railing_common_emitted() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="L1", elevationMm=3000),
            "stair-a": StairElem(
                kind="stair",
                id="stair-a",
                name="Stair",
                baseLevelId="lvl-g",
                topLevelId="lvl-1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 3000, "yMm": 0},
                widthMm=1100,
                riserMm=180,
                treadMm=280,
            ),
            "rail-a": RailingElem(
                kind="railing",
                id="rail-a",
                name="Rail",
                hostedStairId="stair-a",
                pathMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                ],
                guardHeightMm=1040,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = _parse(step)
    rails = model.by_type("IfcRailing") or []
    assert len(rails) == 1
    psets = _psets_for(rails[0])
    bucket = psets.get("Pset_RailingCommon") or {}
    assert str(bucket.get("Reference")) == "rail-a"
    assert float(bucket.get("Height") or 0) == pytest.approx(1.040, abs=1e-3)


def test_material_category_wood_maps_to_ifc_wood() -> None:
    """`timber_stud` is a MAT-01 timber spec → IfcMaterial.Category=='Wood'.

    Uses an `IfcColumn` because columns / beams emit a single
    `IfcRelAssociatesMaterial` directly from the kernel `materialKey`,
    which is the cleanest path to assert the IFC4-standard category
    string ("Wood") landed on the IfcMaterial.
    """

    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "col-wood": ColumnElem(
                kind="column",
                id="col-wood",
                name="Col",
                levelId="lvl-g",
                positionMm={"xMm": 1000, "yMm": 1000},
                bMm=300,
                hMm=300,
                heightMm=2800,
                materialKey="timber_stud",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = _parse(step)
    materials = [
        m for m in (model.by_type("IfcMaterial") or []) if str(m.Name or "") == "timber_stud"
    ]
    assert len(materials) >= 1
    assert str(materials[0].Category or "") == "Wood"


def test_material_category_unknown_falls_back_to_none() -> None:
    """An unknown material_key has no MAT-01 spec → IfcMaterial.Category is None / empty."""

    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "col-mystery": ColumnElem(
                kind="column",
                id="col-mystery",
                name="Col",
                levelId="lvl-g",
                positionMm={"xMm": 1000, "yMm": 1000},
                bMm=300,
                hMm=300,
                heightMm=2800,
                materialKey="not_a_real_material_xyz",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = _parse(step)
    materials = [
        m
        for m in (model.by_type("IfcMaterial") or [])
        if str(m.Name or "") == "not_a_real_material_xyz"
    ]
    assert len(materials) >= 1
    cat = materials[0].Category
    assert cat is None or str(cat) == ""
