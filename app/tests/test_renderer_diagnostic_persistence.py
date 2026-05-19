from __future__ import annotations

from bim_ai.evidence_manifest import evidence_package_digest_invariants_v1
from bim_ai.renderer_diagnostic_persistence import (
    append_renderer_diagnostic_packet,
    latest_renderer_diagnostic_packet_for_evidence,
    normalize_renderer_diagnostic_packet,
    renderer_diagnostic_packet_embedding,
)


def test_renderer_packet_persistence_embeds_latest_same_revision_packet() -> None:
    packet = normalize_renderer_diagnostic_packet(
        {
            "format": "rendererDiagnosticPacket_v1",
            "generatedAtIso": "2026-05-19T08:00:00+00:00",
            "modelRevision": 7,
            "viewId": "view-3d",
            "gitHead": "abc123",
            "rendererBuild": "web-test",
            "supportMatrixDigest": "rsm-test",
            "diagnostics": [
                {
                    "code": "renderer.roof_opening.unsupported",
                    "severity": "error",
                    "issueClass": "renderer-unsupported",
                    "elementIds": ["roof-1", "opening-1"],
                    "trackerItems": ["BIR-I02"],
                }
            ],
        },
        model_id="model-1",
        model_revision=7,
    )

    document = append_renderer_diagnostic_packet({"revision": 7, "elements": {}}, packet)
    embedding = renderer_diagnostic_packet_embedding(document, model_revision=7)
    embedded = latest_renderer_diagnostic_packet_for_evidence(document, model_revision=7)

    assert embedding["format"] == "rendererDiagnosticPacketEmbedding_v1"
    assert embedding["embedded"] is True
    assert embedding["status"] == "embedded"
    assert embedding["packetDigestSha256"] == packet["packetDigestSha256"]
    assert embedded is not None
    assert embedded["summary"]["diagnosticCount"] == 1
    assert embedded["affectedElementIds"] == ["opening-1", "roof-1"]
    assert "BIR-I06" in embedded["diagnostics"][0]["trackerItems"]


def test_renderer_packet_embedding_reports_stale_revision() -> None:
    packet = normalize_renderer_diagnostic_packet(
        {"generatedAtIso": "2026-05-19T08:00:00+00:00", "diagnostics": []},
        model_id="model-1",
        model_revision=6,
    )
    document = append_renderer_diagnostic_packet({"revision": 7, "elements": {}}, packet)

    assert latest_renderer_diagnostic_packet_for_evidence(document, model_revision=7) is None
    embedding = renderer_diagnostic_packet_embedding(document, model_revision=7)
    assert embedding["embedded"] is False
    assert embedding["status"] == "stale_revision"
    assert embedding["latestPacketRevision"] == 6


def test_renderer_packet_evidence_keys_are_digest_classified() -> None:
    payload = {
        "format": "evidencePackage_v1",
        "modelId": "m",
        "revision": 1,
        "rendererDiagnosticPacket_v1": {"format": "rendererDiagnosticPacket_v1"},
        "rendererDiagnosticPacketEmbedding_v1": {"format": "rendererDiagnosticPacketEmbedding_v1"},
    }

    invariants = evidence_package_digest_invariants_v1(payload)
    assert "rendererDiagnosticPacket_v1" not in invariants["unknownTopLevelKeys"]
    assert "rendererDiagnosticPacketEmbedding_v1" not in invariants["unknownTopLevelKeys"]
