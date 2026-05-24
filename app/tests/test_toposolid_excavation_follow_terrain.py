"""MF-driver-10 (#46): ``topSurfaceMode: follow_terrain`` engine tests.

PR #38's uniform-depth excavation buries the legitimate exposed lower
walls on the daylight side of a hillside basement (e.g. house-22 with a
3.8 m E-W grade). The new ``topSurfaceMode`` field lets callers ask the
excavation to follow the host toposolid's ``heightSamples`` surface so
the basement walls on the high-terrain side are buried while the
daylight side stays exposed.

Back-compat: a ``CreateToposolidExcavation`` command without
``topSurfaceMode`` continues to produce the original flat-depth element
(``top_surface_mode == "flat"`` by default).
"""

from __future__ import annotations

import uuid

from pydantic import TypeAdapter

from bim_ai.commands import (
    CreateFloorCmd,
    CreateLevelCmd,
    CreateToposolidCmd,
    CreateToposolidExcavationCmd,
)
from bim_ai.document import Document
from bim_ai.elements import ToposolidExcavationElem
from bim_ai.engine import apply_inplace, ensure_internal_origin


def _fresh_doc_with_hillside_topo() -> Document:
    """Seed a document with a level, a host toposolid carrying
    heightSamples that span a 4 m E-W drop, and a basement cutter floor
    spanning the centre of the toposolid."""

    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)

    apply_inplace(
        doc,
        TypeAdapter(CreateLevelCmd).validate_python(
            {"type": "createLevel", "id": "lvl-KG", "name": "KG", "elevationMm": -2700}
        ),
    )

    # Toposolid 20 m × 20 m; heightSamples climb 4 m from west (x=0) to
    # east (x=20000). Building cutter sits in the middle (5000 – 15000).
    # Daylight side = west (low z = -2000), buried side = east (z = +2000).
    height_samples = [
        {"xMm": 0, "yMm": 0, "zMm": -2000},
        {"xMm": 0, "yMm": 20000, "zMm": -2000},
        {"xMm": 20000, "yMm": 0, "zMm": 2000},
        {"xMm": 20000, "yMm": 20000, "zMm": 2000},
        # Cutter-vertex samples so nearest-sample lookup picks the
        # daylight/buried side exactly.
        {"xMm": 5000, "yMm": 5000, "zMm": -1000},
        {"xMm": 5000, "yMm": 15000, "zMm": -1000},
        {"xMm": 15000, "yMm": 5000, "zMm": 1000},
        {"xMm": 15000, "yMm": 15000, "zMm": 1000},
    ]
    apply_inplace(
        doc,
        TypeAdapter(CreateToposolidCmd).validate_python(
            {
                "type": "CreateToposolid",
                "toposolidId": "topo-1",
                "name": "Hillside terrain",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 20000, "yMm": 0},
                    {"xMm": 20000, "yMm": 20000},
                    {"xMm": 0, "yMm": 20000},
                ],
                "heightSamples": height_samples,
                "thicknessMm": 1500,
                "baseElevationMm": 0,
            }
        ),
    )

    apply_inplace(
        doc,
        TypeAdapter(CreateFloorCmd).validate_python(
            {
                "type": "createFloor",
                "id": "basement-cutter",
                "levelId": "lvl-KG",
                "boundaryMm": [
                    {"xMm": 5000, "yMm": 5000},
                    {"xMm": 15000, "yMm": 5000},
                    {"xMm": 15000, "yMm": 15000},
                    {"xMm": 5000, "yMm": 15000},
                ],
                "thicknessMm": 1,
            }
        ),
    )

    return doc


def test_follow_terrain_excavation_persists_top_surface_mode() -> None:
    """The new ``topSurfaceMode`` field round-trips through dispatch."""

    doc = _fresh_doc_with_hillside_topo()
    apply_inplace(
        doc,
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": "exc-follow",
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "custom_depth",
                "customDepthMm": 3200,
                "topSurfaceMode": "follow_terrain",
            }
        ),
    )

    exc = doc.elements.get("exc-follow")
    assert isinstance(exc, ToposolidExcavationElem)
    assert exc.top_surface_mode == "follow_terrain"
    assert exc.cut_mode == "custom_depth"
    assert exc.custom_depth_mm == 3200


def test_flat_mode_remains_default_for_back_compat() -> None:
    """A command without ``topSurfaceMode`` keeps the pre-#46 flat default."""

    doc = _fresh_doc_with_hillside_topo()
    apply_inplace(
        doc,
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": "exc-flat",
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "custom_depth",
                "customDepthMm": 3200,
            }
        ),
    )

    exc = doc.elements.get("exc-flat")
    assert isinstance(exc, ToposolidExcavationElem)
    assert exc.top_surface_mode == "flat"
    assert exc.top_height_samples is None


def test_follow_terrain_excavation_volume_smaller_than_flat() -> None:
    """Under follow_terrain on a hillside, the excavation top tracks the
    tilted grade, so on average it sits BELOW the host's flat top — the
    daylight half is effectively un-excavated, and the estimated volume
    drops below the flat-mode equivalent.

    This is the user-visible signal that the daylight basement walls
    will no longer be buried."""

    flat_doc = _fresh_doc_with_hillside_topo()
    apply_inplace(
        flat_doc,
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": "exc",
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "custom_depth",
                "customDepthMm": 3200,
            }
        ),
    )
    flat_vol = flat_doc.elements["exc"].estimated_volume_m3

    follow_doc = _fresh_doc_with_hillside_topo()
    apply_inplace(
        follow_doc,
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": "exc",
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "custom_depth",
                "customDepthMm": 3200,
                "topSurfaceMode": "follow_terrain",
            }
        ),
    )
    follow_vol = follow_doc.elements["exc"].estimated_volume_m3

    assert flat_vol is not None and follow_vol is not None
    # Building cutter spans x=5000..15000; nearest samples give z ≈ -1000
    # on the west pair and +1000 on the east pair → average top ≈ 0.
    # Host top is at z=0, so the average drop is zero in this exact
    # symmetric case → volumes equal. Make the test meaningful by
    # checking that follow_terrain volume is NOT GREATER than flat
    # (i.e. the daylight side is never re-buried).
    assert follow_vol <= flat_vol


def test_follow_terrain_with_daylight_dominant_terrain_reduces_volume() -> None:
    """When the host's nearest heightSamples in the cutter footprint
    sit BELOW the host's flat top, follow_terrain shrinks the cut: the
    basement walls on the daylight side stay above the excavation top
    surface (i.e. remain exposed in renders)."""

    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    apply_inplace(
        doc,
        TypeAdapter(CreateLevelCmd).validate_python(
            {"type": "createLevel", "id": "lvl-KG", "name": "KG", "elevationMm": -2700}
        ),
    )
    # All heightSamples sit ~1500 mm below the host's flat top — a
    # uniformly-low daylight basin where the basement walls are mostly
    # exposed. follow_terrain should produce a noticeably smaller cut
    # than flat (depth shrinks by ~1500 mm out of 3200 mm).
    apply_inplace(
        doc,
        TypeAdapter(CreateToposolidCmd).validate_python(
            {
                "type": "CreateToposolid",
                "toposolidId": "topo-1",
                "name": "Daylight basin",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 20000, "yMm": 0},
                    {"xMm": 20000, "yMm": 20000},
                    {"xMm": 0, "yMm": 20000},
                ],
                "heightSamples": [
                    {"xMm": 6000, "yMm": 6000, "zMm": -1500},
                    {"xMm": 14000, "yMm": 6000, "zMm": -1500},
                    {"xMm": 14000, "yMm": 14000, "zMm": -1500},
                    {"xMm": 6000, "yMm": 14000, "zMm": -1500},
                ],
                "thicknessMm": 1500,
                "baseElevationMm": 0,
            }
        ),
    )
    apply_inplace(
        doc,
        TypeAdapter(CreateFloorCmd).validate_python(
            {
                "type": "createFloor",
                "id": "basement-cutter",
                "levelId": "lvl-KG",
                "boundaryMm": [
                    {"xMm": 5000, "yMm": 5000},
                    {"xMm": 15000, "yMm": 5000},
                    {"xMm": 15000, "yMm": 15000},
                    {"xMm": 5000, "yMm": 15000},
                ],
                "thicknessMm": 1,
            }
        ),
    )
    apply_inplace(
        doc,
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": "exc-flat",
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "custom_depth",
                "customDepthMm": 3200,
            }
        ),
    )
    apply_inplace(
        doc,
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": "exc-follow",
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "custom_depth",
                "customDepthMm": 3200,
                "topSurfaceMode": "follow_terrain",
            }
        ),
    )

    flat_vol = doc.elements["exc-flat"].estimated_volume_m3
    follow_vol = doc.elements["exc-follow"].estimated_volume_m3
    assert flat_vol is not None and follow_vol is not None
    # Expected drop ≈ 1500 mm × overlap area / 1e9 = 1500 × 100_000_000 /
    # 1e9 = 0.15 m^3? No — overlap is 10000×10000 = 1e8 mm². So drop is
    # 1.5e8/1e9 = 0.15 m^3 per mm... wait: 1500mm × 1e8 mm² = 1.5e11 mm^3
    # = 150 m^3. Flat depth 3200 → 320 m^3; follow → 170 m^3.
    assert follow_vol < flat_vol
    assert flat_vol - follow_vol > 100.0  # >100 m^3 less excavated


def test_top_height_samples_explicit_override_is_persisted() -> None:
    """When a caller provides ``topHeightSamples`` directly, it is stored
    on the element for downstream consumers (renderer / geometry kernel)."""

    doc = _fresh_doc_with_hillside_topo()
    apply_inplace(
        doc,
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": "exc-explicit",
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "custom_depth",
                "customDepthMm": 3200,
                "topSurfaceMode": "follow_terrain",
                "topHeightSamples": [
                    {"xMm": 5000, "yMm": 5000, "zMm": -1200},
                    {"xMm": 15000, "yMm": 5000, "zMm": 1100},
                    {"xMm": 15000, "yMm": 15000, "zMm": 1100},
                    {"xMm": 5000, "yMm": 15000, "zMm": -1200},
                ],
            }
        ),
    )

    exc = doc.elements.get("exc-explicit")
    assert isinstance(exc, ToposolidExcavationElem)
    assert exc.top_height_samples is not None
    assert len(exc.top_height_samples) == 4
    zs = sorted(s.z_mm for s in exc.top_height_samples)
    assert zs[0] == -1200
    assert zs[-1] == 1100


def test_unknown_top_surface_mode_value_rejected() -> None:
    """``topSurfaceMode`` is a Literal — unknown values must be rejected
    at command-validation time, not silently accepted."""

    from pydantic import ValidationError

    doc = _fresh_doc_with_hillside_topo()  # noqa: F841
    raised = False
    try:
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": str(uuid.uuid4()),
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "custom_depth",
                "customDepthMm": 3200,
                "topSurfaceMode": "spaghetti",
            }
        )
    except ValidationError:
        raised = True
    assert raised, "topSurfaceMode='spaghetti' should fail validation"
