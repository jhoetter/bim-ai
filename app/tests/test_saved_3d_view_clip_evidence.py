"""Tests for saved 3D view section box / clip evidence (WP-E02, WP-X02)."""

from __future__ import annotations

import json

from bim_ai.document import Document
from bim_ai.elements import CameraMm, Vec3Mm, ViewpointElem
from bim_ai.export_gltf import (
    build_visual_export_manifest,
    collect_saved_3d_view_clip_evidence_v1,
    document_to_gltf,
    export_manifest_extension_payload,
)
from bim_ai.model_summary import compute_model_summary


def _camera() -> CameraMm:
    return CameraMm(
        position=Vec3Mm(xMm=0, yMm=0, zMm=5000),
        target=Vec3Mm(xMm=0, yMm=0, zMm=0),
        up=Vec3Mm(xMm=0, yMm=1, zMm=0),
    )


def _vp_basic(vid: str, name: str = "Orbit") -> ViewpointElem:
    return ViewpointElem(
        kind="viewpoint",
        id=vid,
        name=name,
        camera=_camera(),
        mode="orbit_3d",
    )


class TestCollectSaved3dViewClipEvidenceV1:
    def test_returns_none_when_no_orbit_3d_viewpoints(self) -> None:
        doc = Document(revision=1, elements={})
        assert collect_saved_3d_view_clip_evidence_v1(doc) is None

    def test_returns_none_when_only_plan_viewpoints(self) -> None:
        vp = ViewpointElem(kind="viewpoint", id="v1", name="Plan", camera=_camera(), mode="plan_2d")
        doc = Document(revision=1, elements={"v1": vp})
        assert collect_saved_3d_view_clip_evidence_v1(doc) is None

    def test_basic_orbit_viewpoint_serialised(self) -> None:
        vp = _vp_basic("vp-a")
        doc = Document(revision=1, elements={"vp-a": vp})
        ev = collect_saved_3d_view_clip_evidence_v1(doc)
        assert ev is not None
        assert ev["format"] == "saved3dViewClipEvidence_v1"
        assert ev["viewCount"] == 1
        row = ev["views"][0]
        assert row["viewId"] == "vp-a"
        assert row["viewName"] == "Orbit"
        assert row["clipEnabled"] is False
        assert row["viewerClipCapElevMm"] is None
        assert row["viewerClipFloorElevMm"] is None
        assert row["hiddenCategoryCount"] == 0
        assert row["sectionBoxEnabled"] is None

    def test_clip_cap_floor_round_trips(self) -> None:
        vp = ViewpointElem(
            kind="viewpoint",
            id="vp-clip",
            name="Clipped",
            camera=_camera(),
            mode="orbit_3d",
            viewerClipCapElevMm=3500.0,
            viewerClipFloorElevMm=500.0,
            hiddenSemanticKinds3d=["roof", "stair"],
            cutawayStyle="cap",
        )
        doc = Document(revision=1, elements={"vp-clip": vp})
        ev = collect_saved_3d_view_clip_evidence_v1(doc)
        assert ev is not None
        row = ev["views"][0]
        assert row["clipEnabled"] is True
        assert row["viewerClipCapElevMm"] == 3500.0
        assert row["viewerClipFloorElevMm"] == 500.0
        assert row["hiddenCategoryCount"] == 2
        assert row["cutawayStyle"] == "cap"

    def test_section_box_bounds_serialised(self) -> None:
        vp = ViewpointElem(
            kind="viewpoint",
            id="vp-sbox",
            name="SectionBox",
            camera=_camera(),
            mode="orbit_3d",
            sectionBoxEnabled=True,
            sectionBoxMinMm={"xMm": -1000.0, "yMm": -500.0, "zMm": 0.0},
            sectionBoxMaxMm={"xMm": 5000.0, "yMm": 4000.0, "zMm": 3000.0},
        )
        doc = Document(revision=1, elements={"vp-sbox": vp})
        ev = collect_saved_3d_view_clip_evidence_v1(doc)
        assert ev is not None
        row = ev["views"][0]
        assert row["sectionBoxEnabled"] is True
        assert row["sectionBoxMinMm"] == {"xMm": -1000.0, "yMm": -500.0, "zMm": 0.0}
        assert row["sectionBoxMaxMm"] == {"xMm": 5000.0, "yMm": 4000.0, "zMm": 3000.0}

    def test_section_box_absent_when_not_set(self) -> None:
        vp = _vp_basic("vp-nosbox")
        doc = Document(revision=1, elements={"vp-nosbox": vp})
        ev = collect_saved_3d_view_clip_evidence_v1(doc)
        assert ev is not None
        row = ev["views"][0]
        assert "sectionBoxMinMm" not in row
        assert "sectionBoxMaxMm" not in row

    def test_multiple_viewpoints_sorted_by_id(self) -> None:
        vp_b = _vp_basic("vp-b", "B")
        vp_a = _vp_basic("vp-a", "A")
        doc = Document(revision=1, elements={"vp-b": vp_b, "vp-a": vp_a})
        ev = collect_saved_3d_view_clip_evidence_v1(doc)
        assert ev is not None
        assert ev["viewCount"] == 2
        assert [r["viewId"] for r in ev["views"]] == ["vp-a", "vp-b"]

    def test_plan_2d_viewpoints_excluded(self) -> None:
        vp_orbit = _vp_basic("vp-orbit")
        vp_plan = ViewpointElem(
            kind="viewpoint", id="vp-plan", name="Plan", camera=_camera(), mode="plan_2d"
        )
        doc = Document(revision=1, elements={"vp-orbit": vp_orbit, "vp-plan": vp_plan})
        ev = collect_saved_3d_view_clip_evidence_v1(doc)
        assert ev is not None
        assert ev["viewCount"] == 1
        assert ev["views"][0]["viewId"] == "vp-orbit"


class TestExportManifestSaved3dClipEvidence:
    def test_mesh_encoding_includes_saved_3d_clip_token(self) -> None:
        vp = _vp_basic("vp-1")
        doc = Document(revision=1, elements={"vp-1": vp})
        ext = export_manifest_extension_payload(doc)
        assert "+bim_ai_saved_3d_view_clip_v1" in ext["meshEncoding"]

    def test_manifest_absent_without_orbit_viewpoints(self) -> None:
        doc = Document(revision=1, elements={})
        ext = export_manifest_extension_payload(doc)
        assert "saved3dViewClipEvidence_v1" not in ext
        assert "+bim_ai_saved_3d_view_clip_v1" not in ext["meshEncoding"]

    def test_manifest_readback_section_box_survives_round_trip(self) -> None:
        vp = ViewpointElem(
            kind="viewpoint",
            id="vp-rt",
            name="Readback",
            camera=_camera(),
            mode="orbit_3d",
            sectionBoxEnabled=True,
            sectionBoxMinMm={"xMm": 0.0, "yMm": 0.0, "zMm": 0.0},
            sectionBoxMaxMm={"xMm": 8000.0, "yMm": 6000.0, "zMm": 3500.0},
            viewerClipCapElevMm=3500.0,
            hiddenSemanticKinds3d=["roof"],
            cutawayStyle="box",
        )
        doc = Document(revision=1, elements={"vp-rt": vp})
        ext = export_manifest_extension_payload(doc)
        clip_ev = ext["saved3dViewClipEvidence_v1"]
        assert clip_ev["format"] == "saved3dViewClipEvidence_v1"
        assert clip_ev["viewCount"] == 1
        row = clip_ev["views"][0]
        assert row["viewId"] == "vp-rt"
        assert row["sectionBoxEnabled"] is True
        assert row["sectionBoxMinMm"] == {"xMm": 0.0, "yMm": 0.0, "zMm": 0.0}
        assert row["sectionBoxMaxMm"] == {"xMm": 8000.0, "yMm": 6000.0, "zMm": 3500.0}
        assert row["viewerClipCapElevMm"] == 3500.0
        assert row["hiddenCategoryCount"] == 1
        assert row["cutawayStyle"] == "box"


class TestModelSummarySaved3dClipSummary:
    def test_summary_zero_when_no_viewpoints(self) -> None:
        doc = Document(revision=1, elements={})
        summary = compute_model_summary(doc)
        clip_sum = summary["saved3dViewClipSummary"]
        assert clip_sum["saved3dViewCount"] == 0
        assert clip_sum["clipEnabledCount"] == 0
        assert clip_sum["sectionBoxEnabledCount"] == 0
        assert clip_sum["totalHiddenCategoryCount"] == 0

    def test_summary_counts_orbit_3d_only(self) -> None:
        vp_3d = ViewpointElem(
            kind="viewpoint",
            id="v3d",
            name="3D",
            camera=_camera(),
            mode="orbit_3d",
            viewerClipCapElevMm=3000.0,
            hiddenSemanticKinds3d=["roof", "stair"],
            sectionBoxEnabled=True,
        )
        vp_plan = ViewpointElem(
            kind="viewpoint", id="vplan", name="Plan", camera=_camera(), mode="plan_2d"
        )
        doc = Document(revision=1, elements={"v3d": vp_3d, "vplan": vp_plan})
        summary = compute_model_summary(doc)
        clip_sum = summary["saved3dViewClipSummary"]
        assert clip_sum["saved3dViewCount"] == 1
        assert clip_sum["clipEnabledCount"] == 1
        assert clip_sum["sectionBoxEnabledCount"] == 1
        assert clip_sum["totalHiddenCategoryCount"] == 2

    def test_summary_multiple_views_aggregate_correctly(self) -> None:
        vp_a = ViewpointElem(
            kind="viewpoint",
            id="va",
            name="A",
            camera=_camera(),
            mode="orbit_3d",
            viewerClipCapElevMm=2500.0,
            hiddenSemanticKinds3d=["roof"],
            sectionBoxEnabled=False,
        )
        vp_b = ViewpointElem(
            kind="viewpoint",
            id="vb",
            name="B",
            camera=_camera(),
            mode="orbit_3d",
            hiddenSemanticKinds3d=["stair", "railing"],
            sectionBoxEnabled=True,
        )
        vp_c = _vp_basic("vc", "C")
        doc = Document(revision=1, elements={"va": vp_a, "vb": vp_b, "vc": vp_c})
        summary = compute_model_summary(doc)
        clip_sum = summary["saved3dViewClipSummary"]
        assert clip_sum["saved3dViewCount"] == 3
        assert clip_sum["clipEnabledCount"] == 1
        assert clip_sum["sectionBoxEnabledCount"] == 1
        assert clip_sum["totalHiddenCategoryCount"] == 3


class TestGltfJsonReadbackSaved3dClipEvidence:
    """Validate clip/section-box evidence survives full glTF JSON serialization (WP-X02 readback)."""

    def _readback_clip_ev(self, doc: Document) -> dict:
        readback = json.loads(json.dumps(document_to_gltf(doc)))
        return readback["extensions"]["BIM_AI_exportManifest_v0"]["saved3dViewClipEvidence_v1"]

    def test_section_box_bounds_survive_gltf_json_round_trip(self) -> None:
        vp = ViewpointElem(
            kind="viewpoint",
            id="vp-rt",
            name="RT",
            camera=_camera(),
            mode="orbit_3d",
            sectionBoxEnabled=True,
            sectionBoxMinMm={"xMm": -500.0, "yMm": -200.0, "zMm": 0.0},
            sectionBoxMaxMm={"xMm": 6000.0, "yMm": 4500.0, "zMm": 3200.0},
            viewerClipCapElevMm=3200.0,
            viewerClipFloorElevMm=0.0,
            hiddenSemanticKinds3d=["roof", "stair"],
            cutawayStyle="cap",
        )
        doc = Document(revision=1, elements={"vp-rt": vp})
        clip_ev = self._readback_clip_ev(doc)
        assert clip_ev["format"] == "saved3dViewClipEvidence_v1"
        assert clip_ev["viewCount"] == 1
        row = clip_ev["views"][0]
        assert row["viewId"] == "vp-rt"
        assert row["viewName"] == "RT"
        assert row["clipEnabled"] is True
        assert row["sectionBoxEnabled"] is True
        assert row["sectionBoxMinMm"] == {"xMm": -500.0, "yMm": -200.0, "zMm": 0.0}
        assert row["sectionBoxMaxMm"] == {"xMm": 6000.0, "yMm": 4500.0, "zMm": 3200.0}
        assert row["viewerClipCapElevMm"] == 3200.0
        assert row["viewerClipFloorElevMm"] == 0.0
        assert row["hiddenCategoryCount"] == 2
        assert row["cutawayStyle"] == "cap"

    def test_hidden_category_count_survives_json_round_trip(self) -> None:
        vp = ViewpointElem(
            kind="viewpoint",
            id="vp-hc",
            name="HidCat",
            camera=_camera(),
            mode="orbit_3d",
            hiddenSemanticKinds3d=["roof", "stair", "railing"],
        )
        doc = Document(revision=1, elements={"vp-hc": vp})
        clip_ev = self._readback_clip_ev(doc)
        assert clip_ev["views"][0]["hiddenCategoryCount"] == 3

    def test_no_clip_metadata_absent_keys_in_json(self) -> None:
        vp = _vp_basic("vp-bare")
        doc = Document(revision=1, elements={"vp-bare": vp})
        clip_ev = self._readback_clip_ev(doc)
        row = clip_ev["views"][0]
        assert "sectionBoxMinMm" not in row
        assert "sectionBoxMaxMm" not in row
        assert row["clipEnabled"] is False

    def test_multiple_views_sorted_by_id_in_json(self) -> None:
        vp_z = _vp_basic("vp-z", "Z")
        vp_a = _vp_basic("vp-a", "A")
        doc = Document(revision=1, elements={"vp-z": vp_z, "vp-a": vp_a})
        clip_ev = self._readback_clip_ev(doc)
        assert clip_ev["viewCount"] == 2
        ids = [r["viewId"] for r in clip_ev["views"]]
        assert ids == sorted(ids)

    def test_build_visual_export_manifest_json_readback(self) -> None:
        vp = ViewpointElem(
            kind="viewpoint",
            id="vp-mv",
            name="ManifestView",
            camera=_camera(),
            mode="orbit_3d",
            sectionBoxEnabled=False,
            hiddenSemanticKinds3d=["door"],
        )
        doc = Document(revision=1, elements={"vp-mv": vp})
        manifest = build_visual_export_manifest(doc)
        readback = json.loads(json.dumps(manifest))
        clip_ev = readback["extensions"]["BIM_AI_exportManifest_v0"]["saved3dViewClipEvidence_v1"]
        row = clip_ev["views"][0]
        assert row["viewId"] == "vp-mv"
        assert row["viewName"] == "ManifestView"
        assert row["sectionBoxEnabled"] is False
        assert row["hiddenCategoryCount"] == 1

    def test_mesh_encoding_token_present_in_json_readback(self) -> None:
        vp = _vp_basic("vp-enc")
        doc = Document(revision=1, elements={"vp-enc": vp})
        readback = json.loads(json.dumps(document_to_gltf(doc)))
        enc = readback["extensions"]["BIM_AI_exportManifest_v0"]["meshEncoding"]
        assert "+bim_ai_saved_3d_view_clip_v1" in enc
