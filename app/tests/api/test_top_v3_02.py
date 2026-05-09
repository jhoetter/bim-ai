"""TOP-V3-02 — Toposolid subdivision tests.

Covers:
- Create subdivision on valid toposolid host → element in state
- Create with boundary outside host → warning deviation (not 400)
- Update finish_category → reflected in state
- Delete subdivision → removed from state
- List model returns subdivision elements
- Schedule derivation: subdivision area (m²) from shoelace formula
- TypeScript round-trip: serialize + deserialize ToposolidSubdivisionElem shape
- Create on nonexistent host → 400 (ValueError)
- Multiple subdivisions on same host coexist
- Update nonexistent → ValueError (404 semantic)
"""

from __future__ import annotations

import uuid

import pytest

from bim_ai.commands import (
    CreateToposolidCmd,
    CreateToposolidSubdivisionCmd,
    DeleteToposolidSubdivisionCmd,
    UpdateToposolidSubdivisionCmd,
)
from bim_ai.document import Document
from bim_ai.elements import AgentDeviationElem, ToposolidSubdivisionElem
from bim_ai.engine import apply_inplace

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TOPO_BOUNDARY = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 10000, "yMm": 0},
    {"xMm": 10000, "yMm": 10000},
    {"xMm": 0, "yMm": 10000},
]

_SUB_BOUNDARY = [
    {"xMm": 1000, "yMm": 1000},
    {"xMm": 4000, "yMm": 1000},
    {"xMm": 4000, "yMm": 4000},
    {"xMm": 1000, "yMm": 4000},
]


def _seed() -> Document:
    """Return a document with one toposolid already created."""
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    apply_inplace(
        doc,
        CreateToposolidCmd(
            toposolidId="topo-1",
            name="Site",
            boundaryMm=_TOPO_BOUNDARY,
            thicknessMm=1500,
        ),
    )
    return doc


def _shoelace_area_m2(boundary: list[dict]) -> float:
    """Shoelace formula → m² (input in mm)."""
    n = len(boundary)
    area_sq_mm = 0.0
    for i in range(n):
        j = (i + 1) % n
        area_sq_mm += boundary[i]["xMm"] * boundary[j]["yMm"]
        area_sq_mm -= boundary[j]["xMm"] * boundary[i]["yMm"]
    return abs(area_sq_mm) / 2 / 1_000_000  # mm² → m²


# ---------------------------------------------------------------------------
# Test 1: Create subdivision on valid toposolid host → 200, element in state
# ---------------------------------------------------------------------------


def test_create_subdivision_stores_element() -> None:
    doc = _seed()
    sid = str(uuid.uuid4())
    apply_inplace(
        doc,
        CreateToposolidSubdivisionCmd(
            id=sid,
            hostToposolidId="topo-1",
            boundaryMm=_SUB_BOUNDARY,
            finishCategory="paving",
            materialKey="mat:concrete",
            name="Paved Area",
        ),
    )
    elem = doc.elements[sid]
    assert isinstance(elem, ToposolidSubdivisionElem)
    assert elem.kind == "toposolid_subdivision"
    assert elem.host_toposolid_id == "topo-1"
    assert elem.finish_category == "paving"
    assert elem.material_key == "mat:concrete"
    assert elem.name == "Paved Area"
    assert len(elem.boundary_mm) == 4


# ---------------------------------------------------------------------------
# Test 2: Create with boundary outside host → 200 with assumption log warning
# ---------------------------------------------------------------------------


def test_create_outside_host_boundary_emits_warning_not_400() -> None:
    doc = _seed()
    sid = str(uuid.uuid4())
    outside_boundary = [
        {"xMm": 50000, "yMm": 50000},
        {"xMm": 60000, "yMm": 50000},
        {"xMm": 60000, "yMm": 60000},
    ]
    # Should NOT raise — emits a deviation warning instead
    apply_inplace(
        doc,
        CreateToposolidSubdivisionCmd(
            id=sid,
            hostToposolidId="topo-1",
            boundaryMm=outside_boundary,
            finishCategory="lawn",
            materialKey="mat:grass",
        ),
    )
    # Element still created
    assert sid in doc.elements
    assert isinstance(doc.elements[sid], ToposolidSubdivisionElem)
    # A deviation warning was emitted
    deviations = [
        e
        for e in doc.elements.values()
        if isinstance(e, AgentDeviationElem) and sid in (e.related_element_ids or [])
    ]
    assert len(deviations) == 1
    assert deviations[0].severity == "warning"


# ---------------------------------------------------------------------------
# Test 3: Update finish_category → reflected in state
# ---------------------------------------------------------------------------


def test_update_finish_category() -> None:
    doc = _seed()
    sid = str(uuid.uuid4())
    apply_inplace(
        doc,
        CreateToposolidSubdivisionCmd(
            id=sid,
            hostToposolidId="topo-1",
            boundaryMm=_SUB_BOUNDARY,
            finishCategory="lawn",
            materialKey="mat:grass",
        ),
    )
    apply_inplace(
        doc,
        UpdateToposolidSubdivisionCmd(id=sid, finishCategory="planting"),
    )
    elem = doc.elements[sid]
    assert isinstance(elem, ToposolidSubdivisionElem)
    assert elem.finish_category == "planting"


# ---------------------------------------------------------------------------
# Test 4: Delete subdivision → removed from state
# ---------------------------------------------------------------------------


def test_delete_subdivision_removes_element() -> None:
    doc = _seed()
    sid = str(uuid.uuid4())
    apply_inplace(
        doc,
        CreateToposolidSubdivisionCmd(
            id=sid,
            hostToposolidId="topo-1",
            boundaryMm=_SUB_BOUNDARY,
            finishCategory="road",
            materialKey="mat:asphalt",
        ),
    )
    assert sid in doc.elements
    apply_inplace(doc, DeleteToposolidSubdivisionCmd(id=sid))
    assert sid not in doc.elements


# ---------------------------------------------------------------------------
# Test 5: List model returns subdivision elements
# ---------------------------------------------------------------------------


def test_list_model_includes_subdivision_elements() -> None:
    doc = _seed()
    sid1 = "sub-a"
    sid2 = "sub-b"
    apply_inplace(
        doc,
        CreateToposolidSubdivisionCmd(
            id=sid1,
            hostToposolidId="topo-1",
            boundaryMm=_SUB_BOUNDARY,
            finishCategory="paving",
            materialKey="mat:stone",
        ),
    )
    apply_inplace(
        doc,
        CreateToposolidSubdivisionCmd(
            id=sid2,
            hostToposolidId="topo-1",
            boundaryMm=[
                {"xMm": 5000, "yMm": 5000},
                {"xMm": 8000, "yMm": 5000},
                {"xMm": 8000, "yMm": 8000},
            ],
            finishCategory="lawn",
            materialKey="mat:grass",
        ),
    )
    sub_elems = [
        e for e in doc.elements.values() if isinstance(e, ToposolidSubdivisionElem)
    ]
    assert len(sub_elems) == 2
    ids = {e.id for e in sub_elems}
    assert sid1 in ids
    assert sid2 in ids


# ---------------------------------------------------------------------------
# Test 6: Schedule derivation — area (m²) from shoelace formula
# ---------------------------------------------------------------------------


def test_subdivision_area_shoelace_rectangle() -> None:
    # 3000 mm × 3000 mm rectangle = 9 m²
    boundary = [
        {"xMm": 1000, "yMm": 1000},
        {"xMm": 4000, "yMm": 1000},
        {"xMm": 4000, "yMm": 4000},
        {"xMm": 1000, "yMm": 4000},
    ]
    area = _shoelace_area_m2(boundary)
    assert area == pytest.approx(9.0, rel=1e-6)


def test_subdivision_area_triangle() -> None:
    # Right triangle 6000mm × 8000mm = 24 m²
    boundary = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 6000, "yMm": 0},
        {"xMm": 0, "yMm": 8000},
    ]
    area = _shoelace_area_m2(boundary)
    assert area == pytest.approx(24.0, rel=1e-6)


def test_subdivision_element_kind_is_toposolid_subdivision() -> None:
    doc = _seed()
    sid = str(uuid.uuid4())
    apply_inplace(
        doc,
        CreateToposolidSubdivisionCmd(
            id=sid,
            hostToposolidId="topo-1",
            boundaryMm=_SUB_BOUNDARY,
            finishCategory="other",
            materialKey="mat:gravel",
        ),
    )
    elem = doc.elements[sid]
    assert isinstance(elem, ToposolidSubdivisionElem)
    assert elem.kind == "toposolid_subdivision"
    # Area via shoelace on the stored boundary
    area = _shoelace_area_m2(elem.boundary_mm)
    assert area == pytest.approx(9.0, rel=1e-6)  # 3000×3000 mm square = 9 m²


# ---------------------------------------------------------------------------
# Test 7: TypeScript round-trip: serialize + deserialize ToposolidSubdivisionElem
# ---------------------------------------------------------------------------


def test_wire_round_trip() -> None:
    """Serialize to wire (by_alias=True) and reconstruct → same data."""
    doc = _seed()
    sid = str(uuid.uuid4())
    apply_inplace(
        doc,
        CreateToposolidSubdivisionCmd(
            id=sid,
            hostToposolidId="topo-1",
            boundaryMm=_SUB_BOUNDARY,
            finishCategory="paving",
            materialKey="mat:brick",
            name="Front Drive",
        ),
    )
    elem = doc.elements[sid]
    assert isinstance(elem, ToposolidSubdivisionElem)
    wire = elem.model_dump(by_alias=True)

    assert wire["kind"] == "toposolid_subdivision"
    assert wire["hostToposolidId"] == "topo-1"
    assert wire["finishCategory"] == "paving"
    assert wire["materialKey"] == "mat:brick"
    assert wire["name"] == "Front Drive"
    assert len(wire["boundaryMm"]) == 4

    # Reconstruct from wire
    restored = ToposolidSubdivisionElem.model_validate(wire)
    assert restored.id == sid
    assert restored.finish_category == "paving"
    assert restored.host_toposolid_id == "topo-1"


# ---------------------------------------------------------------------------
# Test 8: Create on nonexistent host → 400
# ---------------------------------------------------------------------------


def test_create_on_nonexistent_host_raises() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="does not exist"):
        apply_inplace(
            doc,
            CreateToposolidSubdivisionCmd(
                id="sub-x",
                hostToposolidId="topo-ghost",
                boundaryMm=_SUB_BOUNDARY,
                finishCategory="paving",
                materialKey="mat:stone",
            ),
        )


# ---------------------------------------------------------------------------
# Test 9: Multiple subdivisions on same host coexist
# ---------------------------------------------------------------------------


def test_multiple_subdivisions_coexist() -> None:
    doc = _seed()
    sids = [str(uuid.uuid4()) for _ in range(4)]
    categories = ["paving", "lawn", "road", "planting"]
    for sid, cat in zip(sids, categories, strict=True):
        apply_inplace(
            doc,
            CreateToposolidSubdivisionCmd(
                id=sid,
                hostToposolidId="topo-1",
                boundaryMm=_SUB_BOUNDARY,
                finishCategory=cat,
                materialKey=f"mat:{cat}",
            ),
        )

    for sid, cat in zip(sids, categories, strict=True):
        elem = doc.elements[sid]
        assert isinstance(elem, ToposolidSubdivisionElem)
        assert elem.finish_category == cat
        assert elem.host_toposolid_id == "topo-1"


# ---------------------------------------------------------------------------
# Test 10: Update nonexistent → 404 (ValueError)
# ---------------------------------------------------------------------------


def test_update_nonexistent_raises() -> None:
    doc = _seed()
    with pytest.raises(ValueError, match="no subdivision element"):
        apply_inplace(
            doc,
            UpdateToposolidSubdivisionCmd(id="ghost-sub", finishCategory="road"),
        )
