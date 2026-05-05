"""Deterministic site pad / context entourage slice (Prompt 1 v0)."""

from __future__ import annotations

import pytest

from bim_ai.commands import UpsertSiteCmd
from bim_ai.document import Document
from bim_ai.elements import LevelElem, SiteElem, Vec2Mm
from bim_ai.engine import apply_inplace, try_commit_bundle
from bim_ai.export_gltf import document_to_gltf, export_manifest_extension_payload


def _minimal_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=100),
        },
    )


def test_upsert_site_canonicalizes_ccw_rectangle() -> None:
    doc = _minimal_doc()
    cmd = UpsertSiteCmd(
        id="site-a",
        name="Lot",
        referenceLevelId="lvl",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=10_000, yMm=0),
            Vec2Mm(xMm=10_000, yMm=5000),
            Vec2Mm(xMm=0, yMm=5000),
        ],
        padThicknessMm=120,
        baseOffsetMm=-50,
        northDegCwFromPlanX=12.5,
        uniformSetbackMm=600,
        contextObjects=[],
    )
    apply_inplace(doc, cmd)
    site = doc.elements["site-a"]
    assert isinstance(site, SiteElem)
    assert site.boundary_mm[0].x_mm == 0 and site.boundary_mm[0].y_mm == 0
    assert site.pad_thickness_mm == 120
    assert site.base_offset_mm == -50
    assert site.north_deg_cw_from_plan_x == 12.5
    assert site.uniform_setback_mm == 600


def test_upsert_site_context_objects_sorted_by_id() -> None:
    doc = _minimal_doc()
    cmd = UpsertSiteCmd(
        id="site-a",
        referenceLevelId="lvl",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=5000, yMm=0),
            Vec2Mm(xMm=5000, yMm=5000),
            Vec2Mm(xMm=0, yMm=5000),
        ],
        contextObjects=[
            {
                "id": "c-b",
                "contextType": "tree",
                "label": "Oak",
                "positionMm": {"xMm": 1000, "yMm": 2000},
                "scale": 1.2,
            },
            {
                "id": "c-a",
                "contextType": "shrub",
                "positionMm": {"xMm": 500, "yMm": 500},
            },
        ],
    )
    apply_inplace(doc, cmd)
    site = doc.elements["site-a"]
    assert isinstance(site, SiteElem)
    assert [r.id for r in site.context_objects] == ["c-a", "c-b"]


def test_upsert_site_rejects_duplicate_context_ids() -> None:
    doc = _minimal_doc()
    cmd = UpsertSiteCmd(
        id="site-a",
        referenceLevelId="lvl",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=4000, yMm=0),
            Vec2Mm(xMm=4000, yMm=4000),
            Vec2Mm(xMm=0, yMm=4000),
        ],
        contextObjects=[
            {"id": "x", "contextType": "tree", "positionMm": {"xMm": 1, "yMm": 2}},
            {"id": "x", "contextType": "tree", "positionMm": {"xMm": 3, "yMm": 4}},
        ],
    )
    with pytest.raises(ValueError, match="unique ids"):
        apply_inplace(doc, cmd)


def test_upsert_site_rejects_non_convex_boundary() -> None:
    doc = _minimal_doc()
    cmd = UpsertSiteCmd(
        id="site-a",
        referenceLevelId="lvl",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=10000, yMm=0),
            Vec2Mm(xMm=10000, yMm=5000),
            Vec2Mm(xMm=5000, yMm=2500),
            Vec2Mm(xMm=0, yMm=5000),
        ],
    )
    with pytest.raises(ValueError, match="strictly convex"):
        apply_inplace(doc, cmd)


def test_try_commit_bundle_replay_site_deterministic() -> None:
    base = _minimal_doc()
    raw = [
        {
            "type": "upsertSite",
            "id": "site-a",
            "referenceLevelId": "lvl",
            "boundaryMm": [
                {"xMm": 5000, "yMm": 5000},
                {"xMm": 0, "yMm": 5000},
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
            ],
            "padThicknessMm": 90,
        }
    ]
    ok1, d1, *_ = try_commit_bundle(base, raw)
    ok2, d2, *_ = try_commit_bundle(base, raw)
    assert ok1 and ok2 and d1 is not None and d2 is not None
    s1 = d1.elements["site-a"]
    s2 = d2.elements["site-a"]
    assert isinstance(s1, SiteElem) and isinstance(s2, SiteElem)
    assert s1.model_dump(by_alias=True) == s2.model_dump(by_alias=True)


def test_export_manifest_includes_site_context_evidence() -> None:
    doc = _minimal_doc()
    apply_inplace(
        doc,
        UpsertSiteCmd(
            id="site-a",
            referenceLevelId="lvl",
            boundaryMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=8000, yMm=0),
                Vec2Mm(xMm=8000, yMm=6000),
                Vec2Mm(xMm=0, yMm=6000),
            ],
            northDegCwFromPlanX=45,
            uniformSetbackMm=900,
        ),
    )
    ext = export_manifest_extension_payload(doc)
    assert "bim_ai_site_context_v0" in ext["meshEncoding"]
    ev = ext.get("siteContextEvidence_v0")
    assert ev is not None
    assert ev["format"] == "siteContextEvidence_v0"
    assert len(ev["sites"]) == 1
    row = ev["sites"][0]
    assert row["elementId"] == "site-a"
    assert row["vertexCount"] == 4
    assert row["northDegCwFromPlanX"] == 45
    assert row["uniformSetbackMm"] == 900


def test_document_to_gltf_includes_site_pad_node() -> None:
    doc = _minimal_doc()
    apply_inplace(
        doc,
        UpsertSiteCmd(
            id="site-a",
            referenceLevelId="lvl",
            boundaryMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=6000, yMm=0),
                Vec2Mm(xMm=6000, yMm=4000),
                Vec2Mm(xMm=0, yMm=4000),
            ],
            contextObjects=[
                {
                    "id": "t1",
                    "contextType": "tree",
                    "positionMm": {"xMm": 1500, "yMm": 2000},
                    "scale": 1.0,
                },
            ],
        ),
    )
    g = document_to_gltf(doc)
    names = [str(n["name"]) for n in g["nodes"]]
    assert "site:site-a" in names
    assert any(n.startswith("site:site-a:ctx:") for n in names)
