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
