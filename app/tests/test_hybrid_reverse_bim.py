from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.hybrid_reverse_bim import (
    build_hybrid_reverse_bim_run_report,
    build_hybrid_reverse_bim_slice_report,
    build_source_spec_revision_report,
)
from bim_ai.reverse_bim_document_authority import build_reverse_bim_document_authority_report
from bim_ai.reverse_bim_readback import build_reverse_bim_readback_comparison
from bim_ai.routes_api import api_router


def _expectation() -> dict:
    return {
        "expectationId": "readback:wall-1",
        "sourceFactId": "wall-1",
        "expected": {
            "elementKind": "wall",
            "elementCount": {"min": 1, "max": 1},
            "levelId": "EG",
            "parameters": {"thicknessMm": 240},
        },
        "tolerances": {"lengthMm": 5},
    }


def test_readback_comparison_matches_source_fact_element() -> None:
    report = build_reverse_bim_readback_comparison(
        expected_readback=[_expectation()],
        elements=[
            {
                "id": "model-wall-1",
                "kind": "wall",
                "levelId": "EG",
                "thicknessMm": 240,
                "sourceFactIds": ["wall-1"],
            }
        ],
    )

    assert report["ok"] is True
    assert report["summary"]["matchedCount"] == 1
    assert report["rows"][0]["status"] == "matched"


def test_readback_comparison_blocks_missing_or_mismatched_elements() -> None:
    report = build_reverse_bim_readback_comparison(
        expected_readback=[_expectation()],
        elements=[
            {
                "id": "wrong-wall",
                "kind": "wall",
                "levelId": "EG",
                "thicknessMm": 115,
            }
        ],
    )

    assert report["ok"] is False
    assert report["summary"]["blockedCount"] == 1
    assert report["rows"][0]["status"] in {"missing", "mismatched"}


def test_source_spec_revision_reopens_facts_when_model_disproves_source_spec() -> None:
    readback = build_reverse_bim_readback_comparison(
        expected_readback=[_expectation()],
        elements=[
            {
                "id": "model-wall-1",
                "kind": "wall",
                "levelId": "EG",
                "thicknessMm": 115,
                "sourceFactIds": ["wall-1"],
            }
        ],
    )
    revision = build_source_spec_revision_report(
        readback_comparison=readback,
        facts=[
            {
                "factId": "wall-1",
                "kind": "wall_chain",
                "value": {"thicknessMm": 240},
                "confidence": 0.7,
            }
        ],
    )

    assert revision["ok"] is False
    assert revision["summary"]["sourceRevisionActionCount"] == 1
    assert revision["summary"]["reopenedSourceFactIds"] == ["wall-1"]
    assert revision["actions"][0]["action"] == "reopen_source_fact_and_request_reader_repair"


def test_hybrid_slice_requires_source_revision_before_acceptance() -> None:
    revision = {
        "summary": {
            "sourceRevisionActionCount": 1,
            "toolGapActionCount": 0,
        }
    }
    report = build_hybrid_reverse_bim_slice_report(
        phase={"phaseId": "S2-EG"},
        mcp_readiness={"summary": {"blockerCount": 0}},
        readback_comparison={"ok": False, "summary": {"blockedCount": 1}},
        source_spec_revision=revision,
    )

    assert report["ok"] is False
    assert report["state"] == "source_revision_required"
    assert report["blockers"][0]["code"] == "slice_source_spec_revision_required"


def test_hybrid_run_blocks_when_source_package_not_handoff_ready() -> None:
    run = build_hybrid_reverse_bim_run_report(
        phase_authoring_spec={"phases": []},
        phase_packets=[],
        package_acceptance={"packageState": "source_understanding_blocked"},
    )

    assert run["ok"] is False
    assert run["summary"]["packageBlocksModeling"] is True
    assert "source preflight" in run["nextStep"]


def test_document_authority_marks_newer_document_authoritative() -> None:
    manifest = {
        "files": [
            {
                "sourceDocumentId": "doc-eg-old",
                "relativePath": "Plaene/EG Grundriss 2010-01-01.pdf",
                "absolutePath": "/tmp/Plaene/EG Grundriss 2010-01-01.pdf",
                "kind": "pdf",
                "sha256": "old-sha",
                "mtimeMs": 1,
            },
            {
                "sourceDocumentId": "doc-eg-new",
                "relativePath": "Plaene/EG Grundriss 2024-04-12.pdf",
                "absolutePath": "/tmp/Plaene/EG Grundriss 2024-04-12.pdf",
                "kind": "pdf",
                "sha256": "new-sha",
                "mtimeMs": 2,
            },
        ]
    }
    classifications = {
        "documents": [
            {
                "sourceDocumentId": "doc-eg-old",
                "relativePath": "Plaene/EG Grundriss 2010-01-01.pdf",
                "classification": "floor_plan",
                "confidence": 0.9,
                "kind": "pdf",
            },
            {
                "sourceDocumentId": "doc-eg-new",
                "relativePath": "Plaene/EG Grundriss 2024-04-12.pdf",
                "classification": "floor_plan",
                "confidence": 0.9,
                "kind": "pdf",
            },
        ]
    }

    report = build_reverse_bim_document_authority_report(
        manifest=manifest,
        classifications=classifications,
    )

    assert report["ok"] is True
    by_id = {row["sourceDocumentId"]: row for row in report["documents"]}
    assert by_id["doc-eg-new"]["authorityStatus"] == "authoritative"
    assert by_id["doc-eg-old"]["authorityStatus"] == "superseded"
    assert by_id["doc-eg-old"]["supersededBy"] == "doc-eg-new"


def test_document_authority_blocks_critical_ties_without_hints() -> None:
    classifications = {
        "documents": [
            {
                "sourceDocumentId": "doc-eg-a",
                "relativePath": "Plaene/EG Grundriss Variante A.pdf",
                "classification": "floor_plan",
                "confidence": 0.9,
            },
            {
                "sourceDocumentId": "doc-eg-b",
                "relativePath": "Plaene/EG Grundriss Variante B.pdf",
                "classification": "floor_plan",
                "confidence": 0.9,
            },
        ]
    }

    report = build_reverse_bim_document_authority_report(classifications=classifications)

    assert report["ok"] is False
    assert report["summary"]["blockerCount"] == 1
    assert report["findings"][0]["code"] == "document_authority_unresolved"


def test_hybrid_reverse_bim_routes() -> None:
    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    authority_resp = client.post(
        "/api/v3/reverse-bim/document-authority",
        json={
            "classifications": {
                "documents": [
                    {
                        "sourceDocumentId": "doc-eg",
                        "relativePath": "EG Grundriss.pdf",
                        "classification": "floor_plan",
                        "confidence": 0.9,
                    }
                ]
            }
        },
    )
    readback_resp = client.post(
        "/api/v3/reverse-bim/readback-compare",
        json={
            "expectedReadback": [_expectation()],
            "elements": [
                {
                    "id": "model-wall-1",
                    "kind": "wall",
                    "levelId": "EG",
                    "thicknessMm": 240,
                    "sourceFactIds": ["wall-1"],
                }
            ],
        },
    )
    revision_resp = client.post(
        "/api/v3/reverse-bim/source-spec-revision",
        json={"readbackComparison": readback_resp.json(), "facts": []},
    )
    slice_resp = client.post(
        "/api/v3/reverse-bim/hybrid-slice",
        json={
            "phase": {"phaseId": "S2-EG"},
            "mcpReadiness": {"summary": {"blockerCount": 0}},
            "readbackComparison": readback_resp.json(),
            "phasePacket": {"acceptedForNextPhase": True, "summary": {}},
        },
    )
    run_resp = client.post(
        "/api/v3/reverse-bim/hybrid-run",
        json={"phaseAuthoringSpec": {"phases": []}, "phasePackets": []},
    )

    assert authority_resp.status_code == 200
    assert authority_resp.json()["format"] == "reverseBimDocumentAuthorityReport_v1"
    assert readback_resp.status_code == 200
    assert readback_resp.json()["format"] == "reverseBimReadbackComparison_v1"
    assert revision_resp.status_code == 200
    assert revision_resp.json()["format"] == "reverseBimSourceSpecRevisionReport_v1"
    assert slice_resp.status_code == 200
    assert slice_resp.json()["format"] == "hybridReverseBimSliceReport_v1"
    assert run_resp.status_code == 200
    assert run_resp.json()["format"] == "hybridReverseBimRunReport_v1"
