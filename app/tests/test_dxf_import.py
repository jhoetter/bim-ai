"""FED-04 — DXF parser unit tests.

Each test builds a minimal in-memory DXF via ``ezdxf`` (so we don't ship
binary fixtures), writes it to a temp path, and asserts the parser's
output. No backend round-trip — that lives in
``test_create_link_dxf_command.py``.
"""

from __future__ import annotations

from pathlib import Path

import pytest

ezdxf = pytest.importorskip("ezdxf")


def _new_dxf():
    return ezdxf.new("R2018", setup=True)


def test_parse_dxf_lines(tmp_path: Path) -> None:
    """Two LINE entities round-trip into two ``line`` primitives at the
    expected mm coordinates (default ``$INSUNITS=0`` is treated as mm)."""

    from bim_ai.dxf_import import parse_dxf_to_linework

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 0
    msp = doc.modelspace()
    msp.add_line((0.0, 0.0), (1000.0, 0.0))
    msp.add_line((1000.0, 0.0), (1000.0, 1000.0))
    path = tmp_path / "lines.dxf"
    doc.saveas(str(path))

    linework = parse_dxf_to_linework(path)
    assert len(linework) == 2
    assert linework[0]["kind"] == "line"
    assert linework[0]["start"] == {"xMm": 0.0, "yMm": 0.0}
    assert linework[0]["end"] == {"xMm": 1000.0, "yMm": 0.0}
    assert linework[1]["start"] == {"xMm": 1000.0, "yMm": 0.0}
    assert linework[1]["end"] == {"xMm": 1000.0, "yMm": 1000.0}


def test_parse_dxf_preserves_layer_names_and_colours(tmp_path: Path) -> None:
    from bim_ai.dxf_import import collect_dxf_layers, parse_dxf_to_linework

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 0
    doc.layers.new("A-WALL", dxfattribs={"color": 1})
    doc.layers.new("A-DOOR", dxfattribs={"color": 3})
    msp = doc.modelspace()
    msp.add_line((0.0, 0.0), (100.0, 0.0), dxfattribs={"layer": "A-WALL"})
    msp.add_circle((25.0, 25.0), 10.0, dxfattribs={"layer": "A-DOOR"})
    path = tmp_path / "layers.dxf"
    doc.saveas(str(path))

    linework = parse_dxf_to_linework(path)
    assert [p["layerName"] for p in linework] == ["A-WALL", "A-DOOR"]
    assert linework[0]["layerColor"] == "#ff0000"
    layers = collect_dxf_layers(linework)
    assert layers == [
        {"name": "A-DOOR", "primitiveCount": 1, "color": "#00ff00"},
        {"name": "A-WALL", "primitiveCount": 1, "color": "#ff0000"},
    ]


def test_parse_dxf_polylines(tmp_path: Path) -> None:
    """An LWPOLYLINE round-trips into a single closed ``polyline`` primitive."""

    from bim_ai.dxf_import import parse_dxf_to_linework

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 0
    msp = doc.modelspace()
    msp.add_lwpolyline(
        [(0.0, 0.0), (1000.0, 0.0), (1000.0, 500.0), (0.0, 500.0)],
        close=True,
    )
    path = tmp_path / "polyline.dxf"
    doc.saveas(str(path))

    linework = parse_dxf_to_linework(path)
    assert len(linework) == 1
    assert linework[0]["kind"] == "polyline"
    assert linework[0]["closed"] is True
    pts = linework[0]["points"]
    assert len(pts) == 4
    assert pts[0] == {"xMm": 0.0, "yMm": 0.0}
    assert pts[2] == {"xMm": 1000.0, "yMm": 500.0}


def test_parse_dxf_skips_3d_entities(tmp_path: Path) -> None:
    """3DFACE entities are ignored; LINE entities still come through."""

    from bim_ai.dxf_import import parse_dxf_to_linework

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 0
    msp = doc.modelspace()
    msp.add_3dface(
        [(0.0, 0.0, 0.0), (100.0, 0.0, 0.0), (100.0, 100.0, 50.0), (0.0, 100.0, 50.0)],
    )
    msp.add_line((0.0, 0.0), (250.0, 250.0))
    path = tmp_path / "mixed.dxf"
    doc.saveas(str(path))

    linework = parse_dxf_to_linework(path)
    assert len(linework) == 1
    assert linework[0]["kind"] == "line"


def test_parse_dxf_units_scaling(tmp_path: Path) -> None:
    """``$INSUNITS=1`` (inches) converts coordinates to millimetres."""

    from bim_ai.dxf_import import parse_dxf_to_linework

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 1  # inches
    msp = doc.modelspace()
    msp.add_line((0.0, 0.0), (10.0, 0.0))
    path = tmp_path / "inches.dxf"
    doc.saveas(str(path))

    linework = parse_dxf_to_linework(path)
    assert len(linework) == 1
    line = linework[0]
    assert line["kind"] == "line"
    assert line["start"] == {"xMm": 0.0, "yMm": 0.0}
    assert line["end"]["xMm"] == pytest.approx(254.0, rel=1e-9)
    assert line["end"]["yMm"] == 0.0


def test_parse_dxf_unit_override_replaces_insunits(tmp_path: Path) -> None:
    from bim_ai.dxf_import import parse_dxf_to_linework

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 1  # inches
    doc.modelspace().add_line((0.0, 0.0), (1.0, 0.0))
    path = tmp_path / "override.dxf"
    doc.saveas(str(path))

    default_linework = parse_dxf_to_linework(path)
    override_linework = parse_dxf_to_linework(path, unit_override="meters")

    assert default_linework[0]["end"] == {"xMm": 25.4, "yMm": 0.0}
    assert override_linework[0]["end"] == {"xMm": 1000.0, "yMm": 0.0}


def test_parse_dxf_arcs_and_circles(tmp_path: Path) -> None:
    """ARC / CIRCLE entities round-trip into ``arc`` primitives."""

    from bim_ai.dxf_import import parse_dxf_to_linework

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 0
    msp = doc.modelspace()
    msp.add_arc(center=(500.0, 500.0), radius=200.0, start_angle=0.0, end_angle=90.0)
    msp.add_circle(center=(0.0, 0.0), radius=50.0)
    path = tmp_path / "arcs.dxf"
    doc.saveas(str(path))

    linework = parse_dxf_to_linework(path)
    assert len(linework) == 2
    arc = next(p for p in linework if p["startDeg"] == 0.0 and p["endDeg"] == 90.0)
    assert arc["kind"] == "arc"
    assert arc["center"] == {"xMm": 500.0, "yMm": 500.0}
    assert arc["radiusMm"] == 200.0
    circle = next(p for p in linework if p["endDeg"] == 360.0)
    assert circle["kind"] == "arc"
    assert circle["radiusMm"] == 50.0


def test_build_link_dxf_payload_default_origin(tmp_path: Path) -> None:
    """``build_link_dxf_payload`` returns the wire-shape engine command."""

    from bim_ai.dxf_import import build_link_dxf_payload

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 0
    doc.modelspace().add_line((0.0, 0.0), (100.0, 0.0))
    path = tmp_path / "payload.dxf"
    doc.saveas(str(path))

    payload = build_link_dxf_payload(path, level_id="lvl-1")
    assert payload["type"] == "createLinkDxf"
    assert payload["levelId"] == "lvl-1"
    assert payload["originMm"] == {"xMm": 0.0, "yMm": 0.0}
    assert payload["originAlignmentMode"] == "origin_to_origin"
    assert payload["unitScaleToMm"] == 1.0
    assert payload["rotationDeg"] == 0.0
    assert payload["scaleFactor"] == 1.0
    assert len(payload["linework"]) == 1
    assert payload["linework"][0]["kind"] == "line"
    assert payload["dxfLayers"] == [{"name": "0", "primitiveCount": 1, "color": "#ffffff"}]
    assert payload["sourcePath"] == str(path)
    assert payload["cadReferenceType"] == "linked"
    assert payload["sourceMetadata"]["path"] == str(path)
    assert payload["reloadStatus"] == "ok"
    assert payload["loaded"] is True


def test_build_link_dxf_payload_includes_import_time_options(tmp_path: Path) -> None:
    """Import-time CAD options are emitted on the initial create command."""

    from bim_ai.dxf_import import build_link_dxf_payload

    doc = _new_dxf()
    doc.header["$INSUNITS"] = 1
    doc.layers.new("A-WALL", dxfattribs={"color": 1})
    doc.modelspace().add_line((0.0, 0.0), (1.0, 0.0), dxfattribs={"layer": "A-WALL"})
    path = tmp_path / "options.dxf"
    doc.saveas(str(path))

    payload = build_link_dxf_payload(
        path,
        level_id="lvl-1",
        origin_alignment_mode="shared_coords",
        unit_override="meters",
        color_mode="native",
        overlay_opacity=0.65,
        hidden_layer_names=["A-WALL"],
    )

    assert payload["originAlignmentMode"] == "shared_coords"
    assert payload["unitOverride"] == "meters"
    assert payload["unitScaleToMm"] == 1000.0
    assert payload["linework"][0]["end"] == {"xMm": 1000.0, "yMm": 0.0}
    assert payload["dxfLayers"] == [{"name": "A-WALL", "primitiveCount": 1, "color": "#ff0000"}]
    assert payload["hiddenLayerNames"] == ["A-WALL"]
    assert payload["colorMode"] == "native"
    assert payload["overlayOpacity"] == 0.65


def test_expand_dxf_reload_command_reparses_current_source(tmp_path: Path) -> None:
    from bim_ai.document import Document
    from bim_ai.elements import LevelElem, LinkDxfElem
    from bim_ai.routes_commands import _expand_dxf_reload_command

    doc_file = _new_dxf()
    doc_file.header["$INSUNITS"] = 0
    doc_file.layers.new("A-WALL", dxfattribs={"color": 1})
    doc_file.modelspace().add_line(
        (0.0, 0.0),
        (250.0, 0.0),
        dxfattribs={"layer": "A-WALL"},
    )
    path = tmp_path / "reload.dxf"
    doc_file.saveas(str(path))

    host_doc = Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(id="lvl-1", name="Level 1", elevation_mm=0.0),
            "dxf-1": LinkDxfElem(
                id="dxf-1",
                level_id="lvl-1",
                origin_mm={"xMm": 0.0, "yMm": 0.0},
                source_path=str(path),
                cad_reference_type="linked",
                linework=[],
                loaded=False,
            ),
        },
    )

    expanded = _expand_dxf_reload_command(
        host_doc,
        {"type": "updateLinkDxf", "linkId": "dxf-1", "reloadSource": True},
    )

    assert expanded["type"] == "updateLinkDxf"
    assert expanded["linkId"] == "dxf-1"
    assert expanded["loaded"] is True
    assert expanded["reloadStatus"] == "ok"
    assert expanded["sourcePath"] == str(path)
    assert expanded["sourceMetadata"]["path"] == str(path)
    assert expanded["linework"][0]["layerName"] == "A-WALL"
    assert expanded["dxfLayers"] == [{"name": "A-WALL", "primitiveCount": 1, "color": "#ff0000"}]
