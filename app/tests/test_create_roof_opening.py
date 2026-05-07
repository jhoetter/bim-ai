"""IFC-03 — engine-level validation for ``createRoofOpening``."""

from __future__ import annotations

import pytest

from bim_ai.commands import (
    CreateLevelCmd,
    CreateRoofCmd,
    CreateRoofOpeningCmd,
)
from bim_ai.document import Document
from bim_ai.elements import RoofOpeningElem, Vec2Mm
from bim_ai.engine import apply_inplace


def _doc_with_roof() -> Document:
    doc = Document(elements={})
    apply_inplace(doc, CreateLevelCmd(id="L1", name="L1", elevation_mm=0))
    apply_inplace(
        doc,
        CreateRoofCmd(
            id="R1",
            name="Main",
            referenceLevelId="L1",
            footprintMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=8000, yMm=0),
                Vec2Mm(xMm=8000, yMm=6000),
                Vec2Mm(xMm=0, yMm=6000),
            ],
        ),
    )
    return doc


def test_create_roof_opening_writes_a_roof_opening_element() -> None:
    doc = _doc_with_roof()
    apply_inplace(
        doc,
        CreateRoofOpeningCmd(
            id="O1",
            name="Skylight",
            hostRoofId="R1",
            boundaryMm=[
                Vec2Mm(xMm=2000, yMm=2000),
                Vec2Mm(xMm=3000, yMm=2000),
                Vec2Mm(xMm=3000, yMm=3000),
                Vec2Mm(xMm=2000, yMm=3000),
            ],
        ),
    )
    op = doc.elements["O1"]
    assert isinstance(op, RoofOpeningElem)
    assert op.host_roof_id == "R1"
    assert len(op.boundary_mm) == 4


def test_create_roof_opening_rejects_non_roof_host() -> None:
    doc = _doc_with_roof()
    with pytest.raises(ValueError, match="hostRoofId"):
        apply_inplace(
            doc,
            CreateRoofOpeningCmd(
                id="O2",
                name="Bad",
                hostRoofId="L1",  # level, not roof
                boundaryMm=[
                    Vec2Mm(xMm=2000, yMm=2000),
                    Vec2Mm(xMm=3000, yMm=2000),
                    Vec2Mm(xMm=3000, yMm=3000),
                    Vec2Mm(xMm=2000, yMm=3000),
                ],
            ),
        )


def test_create_roof_opening_rejects_degenerate_boundary() -> None:
    doc = _doc_with_roof()
    with pytest.raises(ValueError, match="boundaryMm"):
        apply_inplace(
            doc,
            CreateRoofOpeningCmd(
                id="O3",
                name="Tiny",
                hostRoofId="R1",
                boundaryMm=[
                    Vec2Mm(xMm=2000, yMm=2000),
                    Vec2Mm(xMm=3000, yMm=2000),
                ],
            ),
        )


def test_create_roof_opening_rejects_duplicate_id() -> None:
    doc = _doc_with_roof()
    apply_inplace(
        doc,
        CreateRoofOpeningCmd(
            id="O1",
            name="Skylight",
            hostRoofId="R1",
            boundaryMm=[
                Vec2Mm(xMm=2000, yMm=2000),
                Vec2Mm(xMm=3000, yMm=2000),
                Vec2Mm(xMm=3000, yMm=3000),
                Vec2Mm(xMm=2000, yMm=3000),
            ],
        ),
    )
    with pytest.raises(ValueError, match="duplicate"):
        apply_inplace(
            doc,
            CreateRoofOpeningCmd(
                id="O1",
                name="dup",
                hostRoofId="R1",
                boundaryMm=[
                    Vec2Mm(xMm=4000, yMm=4000),
                    Vec2Mm(xMm=5000, yMm=4000),
                    Vec2Mm(xMm=5000, yMm=5000),
                    Vec2Mm(xMm=4000, yMm=5000),
                ],
            ),
        )
