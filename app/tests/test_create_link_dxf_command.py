"""FED-04 — engine-level test for the ``createLinkDxf`` command."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, LinkDxfElem
from bim_ai.engine import try_commit_bundle


def _doc_with_level() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(id="lvl-1", name="Level 1", elevation_mm=0.0),
            "lvl-2": LevelElem(id="lvl-2", name="Level 2", elevation_mm=3000.0),
        },
    )


def test_create_link_dxf_inserts_element() -> None:
    doc = _doc_with_level()
    cmd = {
        "type": "createLinkDxf",
        "name": "Site plan",
        "levelId": "lvl-1",
        "originMm": {"xMm": 100.0, "yMm": 50.0},
        "originAlignmentMode": "project_origin",
        "rotationDeg": 12.5,
        "scaleFactor": 1.5,
        "linework": [
            {
                "kind": "line",
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": 1000.0, "yMm": 0.0},
                "layerName": "A-WALL",
                "layerColor": "#ff0000",
            },
            {
                "kind": "polyline",
                "points": [
                    {"xMm": 0.0, "yMm": 0.0},
                    {"xMm": 100.0, "yMm": 100.0},
                    {"xMm": 200.0, "yMm": 0.0},
                ],
                "closed": True,
            },
            {
                "kind": "arc",
                "center": {"xMm": 0.0, "yMm": 0.0},
                "radiusMm": 50.0,
                "startDeg": 0.0,
                "endDeg": 90.0,
            },
        ],
    }

    ok, new_doc, _cmds, viols, code = try_commit_bundle(doc, [cmd])
    assert ok is True, (code, [v.model_dump(by_alias=True) for v in viols])
    assert new_doc is not None

    link_ids = [
        eid for eid, el in new_doc.elements.items() if getattr(el, "kind", None) == "link_dxf"
    ]
    assert len(link_ids) == 1
    link = new_doc.elements[link_ids[0]]
    assert isinstance(link, LinkDxfElem)
    assert link.name == "Site plan"
    assert link.level_id == "lvl-1"
    assert link.origin_mm.x_mm == 100.0
    assert link.origin_mm.y_mm == 50.0
    assert link.origin_alignment_mode == "project_origin"
    assert link.rotation_deg == pytest.approx(12.5)
    assert link.scale_factor == pytest.approx(1.5)
    assert len(link.linework) == 3
    assert link.linework[0].kind == "line"
    assert link.linework[0].layer_name == "A-WALL"
    wall_layer = next(row for row in link.dxf_layers if row.name == "A-WALL")
    assert wall_layer.color == "#ff0000"
    assert link.linework[1].kind == "polyline"
    assert link.linework[2].kind == "arc"


def test_create_link_dxf_rejects_unknown_level() -> None:
    """The engine refuses to create a `link_dxf` whose `levelId` doesn't
    resolve to an existing Level element on the host."""
    doc = _doc_with_level()
    cmd = {
        "type": "createLinkDxf",
        "levelId": "lvl-missing",
        "originMm": {"xMm": 0.0, "yMm": 0.0},
        "linework": [],
    }
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(doc, [cmd])
    assert ok is False, "Expected rejection for unknown levelId"
    assert new_doc is None
    assert "must reference an existing Level" in code


def test_create_link_dxf_round_trips_wire() -> None:
    """The new element serialises back through ``model_dump(by_alias=True)``
    with the camelCase wire shape clients expect."""
    doc = _doc_with_level()
    cmd = {
        "type": "createLinkDxf",
        "id": "lx-fixed",
        "levelId": "lvl-1",
        "originMm": {"xMm": 0.0, "yMm": 0.0},
        "linework": [
            {
                "kind": "line",
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": 1.0, "yMm": 1.0},
            },
        ],
    }
    ok, new_doc, _cmds, _viols, _code = try_commit_bundle(doc, [cmd])
    assert ok is True and new_doc is not None
    wire = new_doc.elements["lx-fixed"].model_dump(by_alias=True)
    assert wire["kind"] == "link_dxf"
    assert wire["levelId"] == "lvl-1"
    assert wire["originMm"] == {"xMm": 0.0, "yMm": 0.0}
    assert wire["originAlignmentMode"] == "origin_to_origin"
    assert wire["rotationDeg"] == 0.0
    assert wire["scaleFactor"] == 1.0
    assert wire["linework"][0]["kind"] == "line"
    assert wire["linework"][0]["start"] == {"xMm": 0.0, "yMm": 0.0}


def test_update_link_dxf_hidden_layer_names() -> None:
    doc = _doc_with_level()
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkDxf",
                "id": "lx-fixed",
                "levelId": "lvl-1",
                "originMm": {"xMm": 0.0, "yMm": 0.0},
                "linework": [
                    {
                        "kind": "line",
                        "start": {"xMm": 0.0, "yMm": 0.0},
                        "end": {"xMm": 1.0, "yMm": 1.0},
                        "layerName": "A-WALL",
                    }
                ],
            },
            {
                "type": "updateLinkDxf",
                "linkId": "lx-fixed",
                "hiddenLayerNames": ["A-WALL"],
            },
        ],
    )
    assert ok is True, code
    assert new_doc is not None
    link = new_doc.elements["lx-fixed"]
    assert isinstance(link, LinkDxfElem)
    assert link.hidden_layer_names == ["A-WALL"]


def test_update_link_dxf_load_path_and_native_color_mode() -> None:
    doc = _doc_with_level()
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkDxf",
                "id": "lx-fixed",
                "levelId": "lvl-1",
                "originMm": {"xMm": 0.0, "yMm": 0.0},
                "linework": [],
                "sourcePath": "/old/site.dxf",
            },
            {
                "type": "updateLinkDxf",
                "linkId": "lx-fixed",
                "colorMode": "native",
                "loaded": False,
                "sourcePath": "/new/site.dxf",
            },
        ],
    )
    assert ok is True, code
    assert new_doc is not None
    link = new_doc.elements["lx-fixed"]
    assert isinstance(link, LinkDxfElem)
    assert link.color_mode == "native"
    assert link.loaded is False
    assert link.source_path == "/new/site.dxf"


def test_update_link_dxf_replaces_linework_layers_and_reload_status() -> None:
    doc = _doc_with_level()
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkDxf",
                "id": "lx-fixed",
                "levelId": "lvl-1",
                "originMm": {"xMm": 0.0, "yMm": 0.0},
                "linework": [
                    {
                        "kind": "line",
                        "start": {"xMm": 0.0, "yMm": 0.0},
                        "end": {"xMm": 1.0, "yMm": 1.0},
                        "layerName": "OLD",
                    }
                ],
                "hiddenLayerNames": ["OLD"],
                "sourcePath": "/source/site.dxf",
                "cadReferenceType": "linked",
            },
            {
                "type": "updateLinkDxf",
                "linkId": "lx-fixed",
                "linework": [
                    {
                        "kind": "line",
                        "start": {"xMm": 0.0, "yMm": 0.0},
                        "end": {"xMm": 5.0, "yMm": 0.0},
                        "layerName": "NEW",
                        "layerColor": "#ff0000",
                    }
                ],
                "dxfLayers": [{"name": "NEW", "primitiveCount": 1, "color": "#ff0000"}],
                "sourceMetadata": {"path": "/source/site.dxf", "sizeBytes": 123},
                "reloadStatus": "ok",
                "lastReloadMessage": "Reloaded from /source/site.dxf",
                "loaded": True,
            },
        ],
    )
    assert ok is True, code
    assert new_doc is not None
    link = new_doc.elements["lx-fixed"]
    assert isinstance(link, LinkDxfElem)
    assert len(link.linework) == 1
    assert link.linework[0].layer_name == "NEW"
    assert [row.name for row in link.dxf_layers] == ["NEW"]
    assert link.hidden_layer_names == []
    assert link.source_metadata["sizeBytes"] == 123
    assert link.reload_status == "ok"


def test_update_link_dxf_level_id_via_property_command() -> None:
    doc = _doc_with_level()
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkDxf",
                "id": "lx-fixed",
                "levelId": "lvl-1",
                "originMm": {"xMm": 0.0, "yMm": 0.0},
                "linework": [],
            },
            {
                "type": "updateElementProperty",
                "elementId": "lx-fixed",
                "key": "levelId",
                "value": "lvl-2",
            },
        ],
    )
    assert ok is True, code
    assert new_doc is not None
    link = new_doc.elements["lx-fixed"]
    assert isinstance(link, LinkDxfElem)
    assert link.level_id == "lvl-2"


def test_update_link_dxf_level_id_rejects_unknown_level() -> None:
    doc = _doc_with_level()
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkDxf",
                "id": "lx-fixed",
                "levelId": "lvl-1",
                "originMm": {"xMm": 0.0, "yMm": 0.0},
                "linework": [],
            },
            {
                "type": "updateElementProperty",
                "elementId": "lx-fixed",
                "key": "levelId",
                "value": "lvl-missing",
            },
        ],
    )
    assert ok is False
    assert new_doc is None
    assert "levelId must reference an existing Level" in code


def test_update_link_dxf_alignment_mode() -> None:
    doc = _doc_with_level()
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkDxf",
                "id": "lx-fixed",
                "levelId": "lvl-1",
                "originMm": {"xMm": 0.0, "yMm": 0.0},
                "linework": [],
            },
            {
                "type": "updateLinkDxf",
                "linkId": "lx-fixed",
                "originAlignmentMode": "shared_coords",
            },
        ],
    )
    assert ok is True, code
    assert new_doc is not None
    link = new_doc.elements["lx-fixed"]
    assert isinstance(link, LinkDxfElem)
    assert link.origin_alignment_mode == "shared_coords"
