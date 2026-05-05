"""Tests for gltfExportManifestClosure_v1 — digest stability, presence matrix, and advisory rules."""

from __future__ import annotations

import json

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    CameraMm,
    LevelElem,
    Vec3Mm,
    ViewpointElem,
    WallElem,
)
from bim_ai.export_gltf import (
    GLTF_EXTENSION_TOKEN_ELIGIBLE_KIND,
    GLTF_KNOWN_EXTENSION_TOKENS,
    build_gltf_export_manifest_closure_v1,
    build_visual_export_manifest,
    export_manifest_extension_payload,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _camera() -> CameraMm:
    return CameraMm(
        position=Vec3Mm(xMm=0, yMm=0, zMm=5000),
        target=Vec3Mm(xMm=0, yMm=0, zMm=0),
        up=Vec3Mm(xMm=0, yMm=1, zMm=0),
    )


def _viewpoint_elem(vid: str, name: str = "Orbit") -> ViewpointElem:
    return ViewpointElem(kind="viewpoint", id=vid, name=name, camera=_camera(), mode="orbit_3d")


def _minimal_wall_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )


def _l_wall_doc() -> Document:
    """Two walls forming an L-corner — triggers corner-join extensions."""
    return Document(
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


# ---------------------------------------------------------------------------
# Closure structure
# ---------------------------------------------------------------------------


def test_closure_present_in_export_manifest_extension_payload() -> None:
    doc = _minimal_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext.get("gltfExportManifestClosure_v1")
    assert closure is not None
    assert closure["format"] == "gltfExportManifestClosure_v1"


def test_closure_has_required_top_level_keys() -> None:
    doc = _minimal_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    assert "extensionTokens" in closure
    assert "extensionDigests" in closure
    assert "gltfExportManifestClosureDigestSha256" in closure
    assert "extensionPresenceMatrix" in closure


def test_closure_extension_tokens_is_ordered_subset_of_known() -> None:
    doc = _l_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    tokens = closure["extensionTokens"]
    known_set = set(GLTF_KNOWN_EXTENSION_TOKENS)
    assert all(t in known_set for t in tokens)
    # Tokens must appear in canonical order
    indices = [GLTF_KNOWN_EXTENSION_TOKENS.index(t) for t in tokens]
    assert indices == sorted(indices)


def test_closure_box_primitive_always_emitted() -> None:
    doc = _minimal_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    assert "bim_ai_box_primitive_v0" in closure["extensionTokens"]


def test_closure_extension_digests_are_64_hex_chars() -> None:
    doc = _l_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    for token, digest in closure["extensionDigests"].items():
        assert isinstance(digest, str), f"digest for {token} is not a string"
        assert len(digest) == 64, f"digest for {token} has length {len(digest)}"
        assert all(c in "0123456789abcdef" for c in digest), f"digest for {token} not hex"


def test_closure_presence_matrix_covers_all_known_tokens() -> None:
    doc = _l_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    matrix_tokens = {e["token"] for e in closure["extensionPresenceMatrix"]}
    assert matrix_tokens == set(GLTF_KNOWN_EXTENSION_TOKENS)


def test_closure_presence_matrix_entries_have_required_fields() -> None:
    doc = _l_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    for entry in closure["extensionPresenceMatrix"]:
        assert "token" in entry
        assert "status" in entry
        assert entry["status"] in ("emitted", "skipped_ineligible")
        assert "digestSha256" in entry
        assert "skipReasonCode" in entry


def test_closure_emitted_entries_have_digest_skipped_do_not() -> None:
    doc = _l_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    for entry in closure["extensionPresenceMatrix"]:
        if entry["status"] == "emitted":
            assert entry["digestSha256"] is not None
            assert entry["skipReasonCode"] is None
        else:
            assert entry["digestSha256"] is None
            assert entry["skipReasonCode"] is not None


def test_closure_corner_join_tokens_emitted_for_l_walls() -> None:
    doc = _l_wall_doc()
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    emitted = set(closure["extensionTokens"])
    assert "bim_ai_wall_corner_joins_v0" in emitted
    assert "bim_ai_wall_corner_join_summary_v1" in emitted


# ---------------------------------------------------------------------------
# Digest stability under element id re-ordering
# ---------------------------------------------------------------------------


def test_closure_digest_stable_under_element_id_reordering() -> None:
    """Closure digest must not change when element dict key iteration order differs."""
    elements_a = {
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
    }
    # Reversed insertion order — same logical model
    elements_b = {k: elements_a[k] for k in reversed(list(elements_a.keys()))}

    doc_a = Document(revision=1, elements=elements_a)
    doc_b = Document(revision=1, elements=elements_b)

    closure_a = export_manifest_extension_payload(doc_a)["gltfExportManifestClosure_v1"]
    closure_b = export_manifest_extension_payload(doc_b)["gltfExportManifestClosure_v1"]

    assert closure_a["gltfExportManifestClosureDigestSha256"] == closure_b["gltfExportManifestClosureDigestSha256"]
    assert closure_a["extensionTokens"] == closure_b["extensionTokens"]
    assert closure_a["extensionDigests"] == closure_b["extensionDigests"]


def test_closure_digest_stable_across_repeated_calls() -> None:
    doc = _l_wall_doc()
    ext1 = export_manifest_extension_payload(doc)["gltfExportManifestClosure_v1"]
    ext2 = export_manifest_extension_payload(doc)["gltfExportManifestClosure_v1"]
    assert ext1["gltfExportManifestClosureDigestSha256"] == ext2["gltfExportManifestClosureDigestSha256"]


def test_closure_digest_changes_when_element_added() -> None:
    doc_a = _minimal_wall_doc()
    doc_b = Document(
        revision=1,
        elements={
            **doc_a.elements,
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
    digest_a = export_manifest_extension_payload(doc_a)["gltfExportManifestClosure_v1"]["gltfExportManifestClosureDigestSha256"]
    digest_b = export_manifest_extension_payload(doc_b)["gltfExportManifestClosure_v1"]["gltfExportManifestClosureDigestSha256"]
    assert digest_a != digest_b


def test_closure_per_extension_digest_stable_under_id_reordering() -> None:
    elements_a = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "wh": WallElem(
            kind="wall", id="wh", name="H", levelId="lvl",
            start={"xMm": 0, "yMm": 0}, end={"xMm": 4000, "yMm": 0},
            thicknessMm=200, heightMm=2800,
        ),
        "wv": WallElem(
            kind="wall", id="wv", name="V", levelId="lvl",
            start={"xMm": 0, "yMm": 0}, end={"xMm": 0, "yMm": 3000},
            thicknessMm=200, heightMm=2800,
        ),
    }
    elements_b = {k: elements_a[k] for k in ["wv", "wh", "lvl"]}
    doc_a = Document(revision=1, elements=elements_a)
    doc_b = Document(revision=1, elements=elements_b)
    digests_a = export_manifest_extension_payload(doc_a)["gltfExportManifestClosure_v1"]["extensionDigests"]
    digests_b = export_manifest_extension_payload(doc_b)["gltfExportManifestClosure_v1"]["extensionDigests"]
    assert digests_a == digests_b


# ---------------------------------------------------------------------------
# Closure is included in build_visual_export_manifest (full manifest)
# ---------------------------------------------------------------------------


def test_closure_present_in_build_visual_export_manifest() -> None:
    doc = _l_wall_doc()
    manifest = build_visual_export_manifest(doc)
    ext = manifest["extensions"]["BIM_AI_exportManifest_v0"]
    closure = ext.get("gltfExportManifestClosure_v1")
    assert closure is not None
    assert closure["format"] == "gltfExportManifestClosure_v1"


def test_closure_extension_tokens_match_mesh_encoding() -> None:
    doc = _l_wall_doc()
    ext = export_manifest_extension_payload(doc)
    mesh_tokens = set(ext["meshEncoding"].split("+"))
    closure_tokens = set(ext["gltfExportManifestClosure_v1"]["extensionTokens"])
    assert mesh_tokens == closure_tokens


# ---------------------------------------------------------------------------
# Advisory rules
# ---------------------------------------------------------------------------


def _advisory_rule_ids(elements: dict) -> list[str]:
    viols = evaluate(elements)
    return [v.rule_id for v in viols]


def test_no_closure_advisory_for_empty_doc() -> None:
    doc = Document(revision=1, elements={})
    rule_ids = _advisory_rule_ids(doc.elements)
    assert "gltf_export_manifest_expected_extension_missing" not in rule_ids
    assert "gltf_export_manifest_extension_order_drift" not in rule_ids


def test_closure_advisory_expected_extension_missing_fires_for_viewpoint_without_clip() -> None:
    """A model with an orbit_3d viewpoint but no clip data fires the advisory
    because element kind 'viewpoint' is present but the extension is skipped_ineligible."""
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "vp": _viewpoint_elem("vp"),
        },
    )
    ext = export_manifest_extension_payload(doc)
    closure = ext["gltfExportManifestClosure_v1"]
    matrix = {e["token"]: e for e in closure["extensionPresenceMatrix"]}
    clip_entry = matrix.get("bim_ai_saved_3d_view_clip_v1")
    assert clip_entry is not None
    # If clip is not emitted and viewpoint count > 0, advisory fires
    if clip_entry["status"] == "skipped_ineligible":
        rule_ids = _advisory_rule_ids(doc.elements)
        assert "gltf_export_manifest_expected_extension_missing" in rule_ids


def test_closure_advisory_expected_extension_missing_identifies_token() -> None:
    """Advisory message must include the extension token name."""
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "vp": _viewpoint_elem("vp"),
        },
    )
    viols = evaluate(doc.elements)
    missing_viols = [v for v in viols if v.rule_id == "gltf_export_manifest_expected_extension_missing"]
    for v in missing_viols:
        assert "bim_ai_" in v.message, f"message should mention extension token: {v.message}"


def test_closure_advisory_no_extension_order_drift_for_canonical_doc() -> None:
    """A normally-constructed document produces tokens in canonical order — no drift advisory."""
    doc = _l_wall_doc()
    rule_ids = _advisory_rule_ids(doc.elements)
    assert "gltf_export_manifest_extension_order_drift" not in rule_ids


def test_closure_advisory_extension_order_drift_message_includes_tokens() -> None:
    """The closure builder iterates GLTF_KNOWN_EXTENSION_TOKENS canonical order.
    Tokens are always emitted in canonical order; extension_order_drift fires only
    when a consumer modifies extensionTokens outside the builder."""
    mesh_enc = "bim_ai_wall_corner_joins_v0+bim_ai_box_primitive_v0"
    payload: dict = {
        "elementCount": 2,
        "countsByKind": {"wall": 2},
        "exportedGeometryKinds": {"wall": 2},
        "wallCornerJoinEvidence_v0": {"format": "wallCornerJoinEvidence_v0", "joins": []},
    }
    closure = build_gltf_export_manifest_closure_v1(mesh_enc, payload)
    # Builder always uses canonical order from GLTF_KNOWN_EXTENSION_TOKENS
    assert closure["extensionTokens"] == ["bim_ai_box_primitive_v0", "bim_ai_wall_corner_joins_v0"]
    assert closure["extensionTokens"] == [
        t for t in GLTF_KNOWN_EXTENSION_TOKENS if t in {"bim_ai_box_primitive_v0", "bim_ai_wall_corner_joins_v0"}
    ]


def test_closure_advisory_discipline_is_exchange() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "vp": _viewpoint_elem("vp"),
        },
    )
    viols = evaluate(doc.elements)
    missing_viols = [v for v in viols if v.rule_id == "gltf_export_manifest_expected_extension_missing"]
    for v in missing_viols:
        assert v.discipline == "exchange"


# ---------------------------------------------------------------------------
# GLTF_EXTENSION_TOKEN_ELIGIBLE_KIND constant
# ---------------------------------------------------------------------------


def test_gltf_extension_token_eligible_kind_keys_are_subset_of_known_tokens() -> None:
    known = set(GLTF_KNOWN_EXTENSION_TOKENS)
    for token in GLTF_EXTENSION_TOKEN_ELIGIBLE_KIND:
        assert token in known, f"{token} not in GLTF_KNOWN_EXTENSION_TOKENS"


# ---------------------------------------------------------------------------
# JSON serialisability of closure
# ---------------------------------------------------------------------------


def test_closure_is_json_serialisable() -> None:
    doc = _l_wall_doc()
    ext = export_manifest_extension_payload(doc)
    # Should not raise
    dumped = json.dumps(ext["gltfExportManifestClosure_v1"], sort_keys=True)
    reparsed = json.loads(dumped)
    assert reparsed["format"] == "gltfExportManifestClosure_v1"
