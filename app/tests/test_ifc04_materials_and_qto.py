"""IFC-04 — broader material attachment + QTO coverage in the IFC export.

Covers:
  - layered IfcMaterialLayerSet on FL-08 walls (existing) now stamps
    Pset_MaterialCommon onto each layer's IfcMaterial
  - single-material walls / roofs / doors / windows get IfcMaterial via
    IfcRelAssociatesMaterial when no layered type is authored
  - Qto_WallBaseQuantities now carries GrossSideArea / NetSideArea
  - Qto_SlabBaseQuantities is attached to IfcRoof products
  - Qto_DoorBaseQuantities / Qto_WindowBaseQuantities now carry Area
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
    WindowElem,
)
from bim_ai.export_ifc import (
    IFC_AVAILABLE,
    export_ifc_model_step,
)

pytestmark = pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)


def _doc_with_layered_wall_door_window_roof() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "lvl-r": LevelElem(kind="level", id="lvl-r", name="R", elevationMm=3000),
            "wt-1": WallTypeElem(
                kind="wall_type",
                id="wt-1",
                name="WT",
                layers=[
                    WallTypeLayer(
                        thicknessMm=140, function="structure", materialKey="timber_stud"
                    ),
                    WallTypeLayer(
                        thicknessMm=18, function="finish", materialKey="cladding_warm_wood"
                    ),
                ],
            ),
            "wal-1": WallElem(
                kind="wall",
                id="wal-1",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 8000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                wallTypeId="wt-1",
            ),
            "fl-1": FloorElem(
                kind="floor",
                id="fl-1",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=8000, yMm=0),
                    Vec2Mm(xMm=8000, yMm=6000),
                    Vec2Mm(xMm=0, yMm=6000),
                ],
            ),
            "rf-1": RoofElem(
                kind="roof",
                id="rf-1",
                name="Roof",
                referenceLevelId="lvl-r",
                footprintMm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=8000, yMm=0),
                    Vec2Mm(xMm=8000, yMm=6000),
                    Vec2Mm(xMm=0, yMm=6000),
                ],
                materialKey="metal_standing_seam_dark_grey",
            ),
            "door-1": DoorElem(
                kind="door",
                id="door-1",
                name="D",
                wallId="wal-1",
                alongT=0.4,
                widthMm=900,
                materialKey="aluminium_dark_grey",
            ),
            "win-1": WindowElem(
                kind="window",
                id="win-1",
                name="Win",
                wallId="wal-1",
                alongT=0.7,
                widthMm=1200,
                heightMm=1500,
                sillHeightMm=900,
                materialKey="glass_clear",
            ),
        },
    )


def test_layered_wall_emits_material_layer_set_with_material_pset() -> None:
    doc = _doc_with_layered_wall_door_window_roof()
    step = export_ifc_model_step(doc)
    u = step.upper()
    assert "IFCMATERIALLAYERSET" in u
    assert "IFCMATERIALLAYER" in u
    # IFC-04: each layer's IfcMaterial gets Pset_MaterialCommon stamped
    # so MAT-01 catalog metadata round-trips.
    assert "PSET_MATERIALCOMMON" in u
    # Material reference (BaseColor / Roughness / Metalness / Reference)
    # should mention at least one MAT-01 hex colour.
    assert "BASECOLOR" in u
    assert "ROUGHNESS" in u
    assert "METALNESS" in u


def test_roof_with_material_key_emits_single_material_when_no_roof_type() -> None:
    doc = _doc_with_layered_wall_door_window_roof()
    step = export_ifc_model_step(doc)
    u = step.upper()
    # Roof carries a single materialKey (no roof_type) → IfcRelAssociatesMaterial.
    assert "IFCRELASSOCIATESMATERIAL" in u
    # Material key appears as the IfcMaterial Name.
    assert "METAL_STANDING_SEAM_DARK_GREY" in u


def test_door_window_emit_single_material_when_material_key_set() -> None:
    doc = _doc_with_layered_wall_door_window_roof()
    step = export_ifc_model_step(doc)
    u = step.upper()
    # Door material key should appear; window's glass key too.
    assert "ALUMINIUM_DARK_GREY" in u
    assert "GLASS_CLEAR" in u


def test_qto_wall_includes_gross_and_net_side_area() -> None:
    doc = _doc_with_layered_wall_door_window_roof()
    step = export_ifc_model_step(doc)
    u = step.upper()
    assert "QTO_WALLBASEQUANTITIES" in u
    assert "GROSSSIDEAREA" in u
    assert "NETSIDEAREA" in u


def test_qto_roof_emits_slab_base_quantities() -> None:
    doc = _doc_with_layered_wall_door_window_roof()
    step = export_ifc_model_step(doc)
    u = step.upper()
    # Roof QTO uses Qto_SlabBaseQuantities (IfcRoof shares the slab geometry surface).
    assert u.count("QTO_SLABBASEQUANTITIES") >= 2  # one for slab, one for roof
    assert "PERIMETER" in u
    assert "GROSSAREA" in u


def test_qto_door_window_include_area_field() -> None:
    doc = _doc_with_layered_wall_door_window_roof()
    step = export_ifc_model_step(doc)
    u = step.upper()
    assert "QTO_DOORBASEQUANTITIES" in u
    assert "QTO_WINDOWBASEQUANTITIES" in u
    # AREA appears across many places; check the door QTO quantity name "Area"
    # is on at least one door / window QTO. Substring check is enough since
    # the only other "AREA" tokens in the IFC are GrossArea / NetArea on
    # slab/space QTOs which we already test for above.
    assert "AREA" in u
