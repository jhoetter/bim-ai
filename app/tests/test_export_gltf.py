from __future__ import annotations

import base64
import json
import struct

from bim_ai.commands import CreateRoofCmd, UpsertRoofTypeCmd
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    ScheduleElem,
    SlabOpeningElem,
    StairElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
    WindowElem,
)
from bim_ai.engine import apply_inplace
from bim_ai.export_gltf import (
    _collect_geom_boxes,
    build_visual_export_manifest,
    document_to_glb_bytes,
    document_to_gltf,
    export_manifest_extension_payload,
)


def test_export_manifest_includes_wall_corner_join_evidence_for_l_walls() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wh": WallElem(
                kind="wall",
                id="wh",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "wv": WallElem(
                kind="wall",
                id="wv",
                name="V",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 0, "yMm": 3000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    ext = export_manifest_extension_payload(doc)
    assert "bim_ai_wall_corner_joins_v0" in ext["meshEncoding"]
    jev = ext.get("wallCornerJoinEvidence_v0")
    assert jev is not None
    assert jev["format"] == "wallCornerJoinEvidence_v0"
    assert len(jev["joins"]) == 1
    assert jev["joins"][0]["joinKind"] == "corner"


def test_gltf_manifest_lists_unsupported_kinds_when_no_geometry_categories():
    doc = Document(revision=1, elements={"sch": ScheduleElem(kind="schedule", id="sch-1", name="S")})
    gm = build_visual_export_manifest(doc)
    ext = gm["extensions"]["BIM_AI_exportManifest_v0"]
    assert ext["elementCount"] == 1
    assert ext["exportedGeometryKinds"] == {}
    kinds = [e["kind"] for e in ext["unsupportedDocumentKindsDetailed"]]
    assert "schedule" in kinds


def test_document_to_gltf_wall_level_metadata_semantic_nodes():
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=1000),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    g = document_to_gltf(doc)
    assert g["asset"]["version"] == "2.0"
    assert g["asset"]["generator"] == "bim-ai/visual_gltf_v0"
    assert len(g["meshes"]) == 1
    names = sorted(n["name"] for n in g["nodes"])
    assert names == sorted(["level:lvl-g", "wall:w-a"])
    manifest = g["extensions"]["BIM_AI_exportManifest_v0"]
    assert manifest["countsByKind"]["wall"] == 1
    assert manifest["countsByKind"]["level"] == 1
    assert len(g["materials"]) == 9
    wall_mesh = next(m for m in g["meshes"] if str(m["name"]).startswith("wall:"))
    prim = wall_mesh["primitives"][0]
    assert prim["material"] == 0
    pos_ix = prim["attributes"]["POSITION"]
    pos_acc = g["accessors"][pos_ix]
    assert pos_acc["min"] is not None and pos_acc["max"] is not None
    assert len(pos_acc["min"]) == len(pos_acc["max"]) == 3


def test_build_visual_export_manifest_includes_material_assembly_evidence_with_layered_wall_type():
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="WT",
                layers=[
                    WallTypeLayer(thicknessMm=100, layer_function="structure"),
                    WallTypeLayer(thicknessMm=50, layer_function="finish"),
                ],
            ),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=150,
                heightMm=2800,
                wallTypeId="wt",
            ),
        },
    )
    gm = build_visual_export_manifest(doc)
    ext = gm["extensions"]["BIM_AI_exportManifest_v0"]
    asm = ext.get("materialAssemblyEvidence_v0")
    assert asm is not None
    assert asm.get("format") == "materialAssemblyEvidence_v0"
    hosts = asm.get("hosts") or []
    assert len(hosts) >= 1
    assert any(h.get("hostElementId") == "w1" for h in hosts)


def test_build_visual_export_manifest_includes_layered_assembly_cut_alignment_evidence() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="WT",
                layers=[
                    WallTypeLayer(thicknessMm=100, layer_function="structure"),
                    WallTypeLayer(thicknessMm=50, layer_function="finish"),
                ],
            ),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=150,
                heightMm=2800,
                wallTypeId="wt",
            ),
        },
    )
    ext = export_manifest_extension_payload(doc)
    assert "bim_ai_layered_assembly_cut_alignment_v0" in ext["meshEncoding"]
    assert "bim_ai_layered_assembly_witness_v0" in ext["meshEncoding"]
    cut_ev = ext.get("layeredAssemblyCutAlignmentEvidence_v0")
    assert cut_ev is not None
    assert cut_ev["format"] == "layeredAssemblyCutAlignmentEvidence_v0"
    h0 = cut_ev["hosts"][0]
    assert h0["hostElementId"] == "w1"
    assert h0["layerStackMatchesCutThickness"] is True
    wit_ev = ext.get("layeredAssemblyWitness_v0")
    assert wit_ev is not None
    assert wit_ev["format"] == "layeredAssemblyWitness_v0"
    w0 = wit_ev["witnesses"][0]
    assert w0["hostElementId"] == "w1"
    assert len(w0.get("layerSummaries") or []) == 2


def test_build_visual_export_manifest_includes_roof_assembly_evidence():
    doc = Document(revision=1, elements={"lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0)})
    apply_inplace(
        doc,
        UpsertRoofTypeCmd(
            type="upsertRoofType",
            id="rt-1",
            name="Warm deck",
            layers=[
                WallTypeLayer(thicknessMm=18, layer_function="structure"),
                WallTypeLayer(thicknessMm=120, layer_function="insulation"),
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateRoofCmd(
            type="createRoof",
            id="r1",
            name="R",
            reference_level_id="lvl",
            footprint_mm=[
                Vec2Mm(x_mm=0, y_mm=0),
                Vec2Mm(x_mm=2000, y_mm=0),
                Vec2Mm(x_mm=2000, y_mm=2000),
                Vec2Mm(x_mm=0, y_mm=2000),
            ],
            roof_geometry_mode="mass_box",
            roof_type_id="rt-1",
        ),
    )
    gm = build_visual_export_manifest(doc)
    ext = gm["extensions"]["BIM_AI_exportManifest_v0"]
    asm = ext.get("materialAssemblyEvidence_v0")
    assert asm is not None
    hosts = asm.get("hosts") or []
    roof_hosts = [h for h in hosts if h.get("hostKind") == "roof"]
    assert len(roof_hosts) == 1
    assert roof_hosts[0].get("hostElementId") == "r1"
    assert roof_hosts[0].get("assemblyTypeId") == "rt-1"
    layers = roof_hosts[0].get("layers") or []
    assert len(layers) == 2
    assert float(layers[0]["thicknessMm"]) == 18.0
    assert float(layers[1]["thicknessMm"]) == 120.0


def test_document_to_gltf_subset_counts_and_manifest_extension():
    doc = Document(
        revision=3,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="EG", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "door-1": DoorElem(kind="door", id="door-1", name="D", wallId="w1", alongT=0.5),
            "win-1": WindowElem(
                kind="window",
                id="win-1",
                name="Wn",
                wallId="w1",
                alongT=0.2,
                widthMm=900,
                sillHeightMm=900,
                heightMm=1200,
            ),
            "roof-1": RoofElem(
                kind="roof",
                id="roof-1",
                name="Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": -1000, "yMm": -1000},
                    {"xMm": 7000, "yMm": -1000},
                    {"xMm": 7000, "yMm": 9000},
                    {"xMm": -1000, "yMm": 9000},
                ],
                overhangMm=400,
                slopeDeg=28,
            ),
            "st-1": StairElem(
                kind="stair",
                id="st-1",
                name="S",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 4400, "yMm": 4200},
                runEndMm={"xMm": 7400, "yMm": 4200},
                widthMm=1100,
                riserMm=175,
                treadMm=280,
            ),
            "rm-a": RoomElem(
                kind="room",
                id="rm-a",
                name="R",
                levelId="l0",
                outlineMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 4200, "yMm": 1000},
                    {"xMm": 4200, "yMm": 5400},
                    {"xMm": 1000, "yMm": 5400},
                ],
            ),
            "misc": ScheduleElem(kind="schedule", id="misc", name="S"),
        },
    )
    g = document_to_gltf(doc)
    node_names = {n["name"] for n in g["nodes"]}
    expected_geo = {"door:door-1", "window:win-1", "roof:roof-1", "stair:st-1", "room:rm-a"}
    assert expected_geo.issubset(node_names)
    wall_nodes = [n["name"] for n in g["nodes"] if str(n["name"]).startswith("wall:w1")]
    assert len(wall_nodes) >= 3
    assert any(":yv" in n for n in wall_nodes)

    mf = g["extensions"]["BIM_AI_exportManifest_v0"]["unsupportedDocumentKindsDetailed"]
    assert sorted(x["kind"] for x in mf) == ["schedule"]

    geo_kinds_exported = g["extensions"]["BIM_AI_exportManifest_v0"]["exportedGeometryKinds"]
    for k in ("wall", "door", "window", "roof", "stair", "room"):
        assert geo_kinds_exported[k] == 1


def test_gltf_wall_prisms_shorten_when_hosted_door_has_reveal():
    """export uses same cut kernel; wider rough opening shrinks adjacent wall box half-lengths."""
    lvl = LevelElem(kind="level", id="l0", name="EG", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="l0",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 8000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    doc_plain = Document(
        revision=1,
        elements={
            "l0": lvl,
            "w1": wall,
            "d1": DoorElem(kind="door", id="d1", name="D", wallId="w1", alongT=0.5, widthMm=1000),
        },
    )
    doc_rev = Document(
        revision=1,
        elements={
            "l0": lvl,
            "w1": wall,
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=1000,
                revealInteriorMm=75,
            ),
        },
    )
    boxes0 = [b for b in _collect_geom_boxes(doc_plain) if b.kind == "wall"]
    boxes1 = [b for b in _collect_geom_boxes(doc_rev) if b.kind == "wall"]
    assert len(boxes0) == len(boxes1) == 2
    assert max(b.hx for b in boxes1) < max(b.hx for b in boxes0) - 1e-9


def test_document_to_glb_contains_header_json_and_matching_bin_chunk():
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )

    gj = document_to_gltf(doc)
    declared_len = gj["buffers"][0]["byteLength"]
    uri = gj["buffers"][0]["uri"]
    assert uri.startswith("data:application/octet-stream;base64,")
    expected_bin = base64.standard_b64decode(uri.split(",", 1)[1])
    assert len(expected_bin) == declared_len

    raw = document_to_glb_bytes(doc)

    assert raw[:4] == b"glTF"
    assert struct.unpack_from("<I", raw, 4)[0] == 2

    json_chunk_len = struct.unpack_from("<I", raw, 12)[0]
    assert struct.unpack_from("<I", raw, 16)[0] == 0x4E4F534A
    payload_start = 20
    payload_end = payload_start + json_chunk_len
    txt = raw[payload_start:payload_end].decode("utf-8").strip()
    parsed = json.loads(txt)
    assert parsed["buffers"][0]["byteLength"] == declared_len

    hdr2 = payload_end
    bin_chunk_len = struct.unpack_from("<I", raw, hdr2)[0]
    assert struct.unpack_from("<I", raw, hdr2 + 4)[0] == 0x004E4942

    bindata = raw[hdr2 + 8 : hdr2 + 8 + bin_chunk_len]

    assert len(bindata) == bin_chunk_len
    assert bindata[:declared_len] == expected_bin

    assert hdr2 + 8 + bin_chunk_len == len(raw)


def test_document_to_gltf_slab_opening_has_node_and_manifest_count():
    doc = Document(
        revision=8,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "fl-a": FloorElem(
                kind="floor",
                id="fl-a",
                name="S1",
                levelId="l0",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                thicknessMm=200,
            ),
            "so-1": SlabOpeningElem(
                kind="slab_opening",
                id="so-1",
                name="Void",
                hostFloorId="fl-a",
                boundaryMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 2200, "yMm": 1000},
                    {"xMm": 2200, "yMm": 2200},
                    {"xMm": 1000, "yMm": 2200},
                ],
            ),
        },
    )
    g = document_to_gltf(doc)
    names = {n["name"] for n in g["nodes"]}
    assert "slab_opening:so-1" in names
    floor_meshes = [m for m in g["meshes"] if str(m["name"]).startswith("floor:fl-a")]
    assert len(floor_meshes) == 4
    ext = g["extensions"]["BIM_AI_exportManifest_v0"]
    assert ext["exportedGeometryKinds"]["slab_opening"] == 1
    assert ext["exportedGeometryKinds"]["floor"] == 1
