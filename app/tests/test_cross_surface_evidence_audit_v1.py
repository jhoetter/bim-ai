"""Tests for cross_surface_evidence_audit_v1 (WP-A02 / WP-A03 / WP-F02)."""

from __future__ import annotations

import json

from bim_ai.cross_surface_evidence_audit_v1 import (
    build_cross_surface_evidence_audit_manifest_v1,
    enumerate_evidence_emitters_v1,
)

_VALID_COVERAGE_STATES = frozenset({"full", "partial", "missing"})


def _evidence_pkg(*keys: str) -> dict:
    return {k: {} for k in keys}


def _readout(*keys: str) -> dict:
    return {k: {} for k in keys}


def test_determinism() -> None:
    emitters = enumerate_evidence_emitters_v1()
    all_keys = [e.manifest_key for e in emitters]
    doc = _evidence_pkg(*all_keys)
    readout = _readout(*all_keys)
    tracker = list(all_keys)

    a = build_cross_surface_evidence_audit_manifest_v1(
        doc, agent_review_readout=readout, tracker_row_index=tracker
    )
    b = build_cross_surface_evidence_audit_manifest_v1(
        doc, agent_review_readout=readout, tracker_row_index=tracker
    )

    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def test_all_emitters_present_with_valid_coverage_state() -> None:
    emitters = enumerate_evidence_emitters_v1()
    manifest = build_cross_surface_evidence_audit_manifest_v1(
        {}, agent_review_readout={}, tracker_row_index=[]
    )
    manifest_keys = {row["manifestKey"] for row in manifest["rows"]}
    for emitter in emitters:
        assert emitter.manifest_key in manifest_keys
        row = next(r for r in manifest["rows"] if r["manifestKey"] == emitter.manifest_key)
        assert row["coverage"] in _VALID_COVERAGE_STATES


def test_manifest_aggregate_digest_stable() -> None:
    emitters = enumerate_evidence_emitters_v1()
    all_keys = [e.manifest_key for e in emitters]
    doc = _evidence_pkg(*all_keys)
    readout = _readout(*all_keys)
    tracker = list(all_keys)

    m1 = build_cross_surface_evidence_audit_manifest_v1(
        doc, agent_review_readout=readout, tracker_row_index=tracker
    )
    m2 = build_cross_surface_evidence_audit_manifest_v1(
        doc, agent_review_readout=readout, tracker_row_index=tracker
    )

    assert "crossSurfaceEvidenceAuditManifestDigestSha256" in m1
    assert (
        m1["crossSurfaceEvidenceAuditManifestDigestSha256"]
        == m2["crossSurfaceEvidenceAuditManifestDigestSha256"]
    )


def test_absent_from_agent_review_readout_reports_partial_or_missing() -> None:
    emitters = enumerate_evidence_emitters_v1()
    all_keys = [e.manifest_key for e in emitters]
    # All emitters present in evidence package and tracker but NOT in readout.
    doc = _evidence_pkg(*all_keys)
    tracker = list(all_keys)

    manifest = build_cross_surface_evidence_audit_manifest_v1(
        doc, agent_review_readout={}, tracker_row_index=tracker
    )

    for row in manifest["rows"]:
        assert row["agentReviewReadoutPresent"] is False
        assert row["coverage"] in {"partial", "missing"}
