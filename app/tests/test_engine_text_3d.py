"""FAM-06: tests for the createText3d command + Text3dElem snapshot."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import Text3dElem
from bim_ai.engine import try_commit


def _empty_doc() -> Document:
    return Document(revision=1, elements={})


def test_create_text_3d_minimal_succeeds():
    ok, new_doc, _cmd, _viols, code = try_commit(
        _empty_doc(),
        {
            "type": "createText3d",
            "id": "t1",
            "text": "BIM AI",
            "fontFamily": "helvetiker",
            "fontSizeMm": 200,
            "depthMm": 50,
            "positionMm": {"xMm": 0, "yMm": -2000, "zMm": 0},
            "rotationDeg": 0,
        },
    )

    assert ok, f"expected success, got code={code}"
    el = new_doc.elements["t1"]
    assert isinstance(el, Text3dElem)
    assert el.text == "BIM AI"
    assert el.font_family == "helvetiker"
    assert el.font_size_mm == 200
    assert el.depth_mm == 50
    assert el.position_mm.x_mm == 0
    assert el.position_mm.y_mm == -2000
    assert el.position_mm.z_mm == 0
    assert el.rotation_deg == 0


def test_create_text_3d_default_font_is_helvetiker():
    ok, new_doc, _cmd, _viols, _code = try_commit(
        _empty_doc(),
        {
            "type": "createText3d",
            "id": "t1",
            "text": "Hello",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
        },
    )

    assert ok
    assert new_doc.elements["t1"].font_family == "helvetiker"


def test_create_text_3d_rejects_empty_text():
    with pytest.raises(ValueError, match="non-empty"):
        try_commit(
            _empty_doc(),
            {
                "type": "createText3d",
                "id": "t1",
                "text": "",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            },
        )


def test_create_text_3d_rejects_duplicate_id():
    base_ok, doc_after_first, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createText3d",
            "id": "t1",
            "text": "First",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
        },
    )
    assert base_ok

    with pytest.raises(ValueError, match="duplicate"):
        try_commit(
            doc_after_first,
            {
                "type": "createText3d",
                "id": "t1",
                "text": "Second",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            },
        )


def test_create_text_3d_supports_all_three_font_families():
    doc = _empty_doc()
    for i, family in enumerate(("helvetiker", "optimer", "gentilis")):
        ok, doc, _c, _v, _code = try_commit(
            doc,
            {
                "type": "createText3d",
                "id": f"t{i}",
                "text": f"Sample {family}",
                "fontFamily": family,
                "positionMm": {"xMm": i * 1000.0, "yMm": 0, "zMm": 0},
            },
        )
        assert ok, f"font family {family} should be accepted"
        assert doc.elements[f"t{i}"].font_family == family


def test_create_text_3d_rejects_unknown_font_family():
    with pytest.raises(Exception):
        try_commit(
            _empty_doc(),
            {
                "type": "createText3d",
                "id": "t1",
                "text": "X",
                "fontFamily": "comic_sans",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            },
        )
