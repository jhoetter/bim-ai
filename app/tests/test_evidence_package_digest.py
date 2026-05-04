from __future__ import annotations

from bim_ai.evidence_manifest import evidence_package_semantic_digest_sha256


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
