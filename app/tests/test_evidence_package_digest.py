from __future__ import annotations

from bim_ai.evidence_manifest import (
    DIGEST_EXCLUDED_KEYS,
    DIGEST_INCLUDED_KEYS,
    evidence_package_digest_invariants_v1,
    evidence_package_semantic_digest_sha256,
)


def test_evidence_digest_ignores_generated_at_stamp() -> None:
    payload = {"format": "evidencePackage_v1", "modelId": "m", "revision": 2, "generatedAt": "a"}
    shifted = dict(payload)
    shifted["generatedAt"] = "b"
    assert evidence_package_semantic_digest_sha256(payload) == evidence_package_semantic_digest_sha256(shifted)


def test_evidence_digest_sorts_violations_deterministically() -> None:
    v1 = {"ruleId": "b", "severity": "info", "message": "m2", "elementIds": [], "blocking": False}
    v2 = {"ruleId": "a", "severity": "info", "message": "m1", "elementIds": ["z"], "blocking": False}
    base = {
        "format": "evidencePackage_v1",
        "revision": 1,
        "modelId": "x",
        "validate": {"violations": [v1, v2]},
    }
    rev = dict(base)
    rev["validate"] = {"violations": [v2, v1]}
    assert evidence_package_semantic_digest_sha256(base) == evidence_package_semantic_digest_sha256(rev)


def test_evidence_digest_canonicalizes_room_derivation_nested_lists() -> None:
    c1 = {
        "candidateId": "b",
        "comparisonToAuthoredRooms": [{"roomId": "z", "iouApprox": 0.1}, {"roomId": "a", "iouApprox": 0.2}],
        "warnings": [{"code": "b", "message": "m2"}, {"code": "a", "message": "m1"}],
        "separationHintGridLineIds": ["g2", "g1"],
    }
    c2 = {
        "candidateId": "a",
        "comparisonToAuthoredRooms": [],
        "warnings": [],
        "separationHintGridLineIds": [],
    }
    base = {
        "format": "evidencePackage_v1",
        "revision": 1,
        "modelId": "x",
        "roomDerivationCandidates": {"format": "roomDerivationCandidates_v1", "candidates": [c1, c2]},
    }
    rev = dict(base)
    r2 = dict(base["roomDerivationCandidates"])
    c1_swapped = dict(c1)
    c1_swapped["comparisonToAuthoredRooms"] = list(reversed(c1["comparisonToAuthoredRooms"]))
    c1_swapped["warnings"] = list(reversed(c1["warnings"]))
    c1_swapped["separationHintGridLineIds"] = list(reversed(c1["separationHintGridLineIds"]))
    r2["candidates"] = [c2, c1_swapped]
    rev["roomDerivationCandidates"] = r2
    assert evidence_package_semantic_digest_sha256(base) == evidence_package_semantic_digest_sha256(rev)


def test_evidence_digest_canonicalizes_plan_projection_sample_primitives() -> None:
    w_b = {"id": "wb", "levelId": "l", "startMm": {"x": 0, "y": 0}, "endMm": {"x": 1, "y": 0}}
    w_a = {"id": "wa", "levelId": "l", "startMm": {"x": 0, "y": 0}, "endMm": {"x": 2, "y": 0}}

    warn_b = {"code": "b", "message": "later"}
    warn_a = {"code": "a", "message": "first"}

    base = {
        "format": "evidencePackage_v1",
        "revision": 1,
        "modelId": "x",
        "planProjectionWireSample": {
            "format": "planProjectionWire_v1",
            "warnings": [warn_b, warn_a],
            "primitives": {
                "format": "planProjectionPrimitives_v1",
                "walls": [w_b, w_a],
                "floors": [],
                "rooms": [],
                "doors": [],
                "windows": [],
                "stairs": [],
                "roofs": [],
                "gridLines": [],
                "dimensions": [],
            },
        },
    }
    swapped = {
        **base,
        "planProjectionWireSample": {
            **base["planProjectionWireSample"],
            "warnings": [warn_a, warn_b],
            "primitives": {
                **base["planProjectionWireSample"]["primitives"],
                "walls": [w_a, w_b],
            },
        },
    }
    assert evidence_package_semantic_digest_sha256(base) == evidence_package_semantic_digest_sha256(swapped)


# ── evidencePackageDigestInvariants_v1 ────────────────────────────────────────


def test_digest_invariants_included_excluded_sets_are_disjoint() -> None:
    assert DIGEST_INCLUDED_KEYS.isdisjoint(DIGEST_EXCLUDED_KEYS), (
        "A key appears in both DIGEST_INCLUDED_KEYS and DIGEST_EXCLUDED_KEYS: "
        f"{DIGEST_INCLUDED_KEYS & DIGEST_EXCLUDED_KEYS}"
    )


def test_digest_invariants_no_unknowns_for_known_payload() -> None:
    payload: dict = {k: None for k in DIGEST_INCLUDED_KEYS | DIGEST_EXCLUDED_KEYS}
    result = evidence_package_digest_invariants_v1(payload)
    assert result["unknownTopLevelKeys"] == [], result["unknownTopLevelKeys"]
    assert result["advisoryFindings"] == []


def test_digest_invariants_detects_unknown_key() -> None:
    payload: dict = {
        "format": "evidencePackage_v1",
        "revision": 1,
        "newUnregisteredKey": "oops",
    }
    result = evidence_package_digest_invariants_v1(payload)
    assert "newUnregisteredKey" in result["unknownTopLevelKeys"]
    assert any(
        f["ruleId"] == "evidence_package_unknown_top_level_key"
        and f["keyName"] == "newUnregisteredKey"
        for f in result["advisoryFindings"]
    )


def test_digest_invariants_excludes_meta_key_from_classification() -> None:
    payload: dict = {
        "format": "evidencePackage_v1",
        "revision": 1,
        "evidencePackageDigestInvariants_v1": {},
    }
    result = evidence_package_digest_invariants_v1(payload)
    assert "evidencePackageDigestInvariants_v1" not in result["unknownTopLevelKeys"]
    assert "evidencePackageDigestInvariants_v1" not in result["digestIncludedTopLevelKeys"]


def test_digest_invariants_digest_is_stable_under_key_ordering_permutation() -> None:
    payload_a: dict = {k: None for k in DIGEST_INCLUDED_KEYS | DIGEST_EXCLUDED_KEYS}
    payload_b = dict(reversed(list(payload_a.items())))
    inv_a = evidence_package_digest_invariants_v1(payload_a)
    inv_b = evidence_package_digest_invariants_v1(payload_b)
    assert inv_a["evidencePackageDigestInvariantsDigestSha256"] == inv_b["evidencePackageDigestInvariantsDigestSha256"]


def test_digest_invariants_digest_changes_when_unknown_key_added() -> None:
    payload_clean: dict = {k: None for k in DIGEST_INCLUDED_KEYS | DIGEST_EXCLUDED_KEYS}
    payload_dirty = dict(payload_clean)
    payload_dirty["unexpectedKey_v99"] = "surprise"
    inv_clean = evidence_package_digest_invariants_v1(payload_clean)
    inv_dirty = evidence_package_digest_invariants_v1(payload_dirty)
    assert inv_clean["evidencePackageDigestInvariantsDigestSha256"] != inv_dirty["evidencePackageDigestInvariantsDigestSha256"]


def test_digest_invariants_excluded_keys_list_has_rationale() -> None:
    payload: dict = {"format": "evidencePackage_v1"}
    result = evidence_package_digest_invariants_v1(payload)
    excluded = result["digestExcludedTopLevelKeys"]
    assert isinstance(excluded, list)
    assert len(excluded) == len(DIGEST_EXCLUDED_KEYS)
    for row in excluded:
        assert "key" in row and "rationale" in row


def test_semantic_digest_stable_under_schedule_id_ordering() -> None:
    s1 = {"id": "sch-b", "name": "Schedule B"}
    s2 = {"id": "sch-a", "name": "Schedule A"}
    base = {"format": "evidencePackage_v1", "revision": 1, "modelId": "x", "scheduleIds": [s1, s2]}
    swapped = {**base, "scheduleIds": [s2, s1]}
    assert evidence_package_semantic_digest_sha256(base) == evidence_package_semantic_digest_sha256(swapped)


def test_semantic_digest_stable_under_plan_view_ordering() -> None:
    p1 = {"id": "pv-b", "name": "Plan B"}
    p2 = {"id": "pv-a", "name": "Plan A"}
    base = {"format": "evidencePackage_v1", "revision": 1, "modelId": "x", "planViews": [p1, p2]}
    swapped = {**base, "planViews": [p2, p1]}
    assert evidence_package_semantic_digest_sha256(base) == evidence_package_semantic_digest_sha256(swapped)
