from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.hybrid_reverse_bim import (
    build_hybrid_reverse_bim_run_report,
    build_hybrid_reverse_bim_slice_report,
    build_source_spec_revision_report,
)
from bim_ai.reverse_bim_document_authority import build_reverse_bim_document_authority_report
from bim_ai.reverse_bim_handoff_regeneration import build_reverse_bim_handoff_regeneration_plan
from bim_ai.reverse_bim_readback import build_reverse_bim_readback_comparison
from bim_ai.reverse_bim_source_revision_ledger import build_reverse_bim_source_revision_ledger
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


def test_readback_comparison_requires_source_fact_reference_for_source_expectation() -> None:
    report = build_reverse_bim_readback_comparison(
        expected_readback=[_expectation()],
        elements=[
            {
                "id": "generic-wall",
                "kind": "wall",
                "levelId": "EG",
                "thicknessMm": 240,
            }
        ],
    )
    traced_report = build_reverse_bim_readback_comparison(
        expected_readback=[_expectation()],
        elements=[
            {
                "id": "traced-wall",
                "kind": "wall",
                "levelId": "EG",
                "thicknessMm": 240,
                "raw": {"agentTrace": {"assumptionKeys": ["sourceFact:wall-1"]}},
            }
        ],
    )

    assert report["ok"] is False
    assert report["rows"][0]["status"] == "missing"
    assert traced_report["ok"] is True


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


def test_source_revision_ledger_reopens_facts_and_names_affected_phase() -> None:
    ledger = build_reverse_bim_source_revision_ledger(
        facts=[{"factId": "wall-1", "status": "accepted"}],
        source_spec_revision={
            "actions": [
                {
                    "findingId": "readback:wall-1",
                    "classification": "source_fact_misread",
                    "sourceFactIds": ["wall-1"],
                    "affectedElementIds": ["model-wall-1"],
                }
            ]
        },
        phase_authoring_spec={
            "phases": [
                {"phaseId": "S2-EG", "sourceFactIds": ["wall-1"]},
                {"phaseId": "S3-DG", "sourceFactIds": ["wall-2"]},
            ]
        },
    )

    assert ledger["ok"] is False
    assert ledger["summary"]["reopenedFactCount"] == 1
    assert ledger["summary"]["affectedPhaseIds"] == ["S2-EG"]
    assert ledger["factUpdates"][0]["nextStatus"] == "reopened"


def test_handoff_regeneration_blocks_reopened_source_facts() -> None:
    ledger = {
        "entries": [
            {
                "ledgerEntryId": "rev-1",
                "classification": "source_fact_misread",
                "sourceFactIds": ["wall-1"],
                "affectedPhaseIds": ["S2-EG"],
                "requiredResolution": "focused_ai_reader_repair_with_provenance",
                "reason": "Wall thickness did not match readback.",
            }
        ]
    }
    plan = build_reverse_bim_handoff_regeneration_plan(
        facts=[
            {
                "factId": "wall-1",
                "kind": "wall_chain",
                "value": {
                    "levelId": "EG",
                    "points": [[0, 0], [5000, 0], [5000, 4000]],
                    "thicknessMm": 240,
                    "wallRole": "exterior",
                },
                "provenance": {"sourceDocumentId": "doc-eg", "page": 1},
            }
        ],
        source_revision_ledger=ledger,
        phase_authoring_spec={
            "phases": [{"phaseId": "S2-EG", "sourceFactIds": ["wall-1"]}]
        },
    )

    assert plan["ok"] is False
    assert plan["phasePlans"][0]["status"] == "source_repair_required"
    assert plan["readerRepairRequests"][0]["factId"] == "wall-1"


def test_handoff_regeneration_rebuilds_ready_handoff_rows_for_payload_repairs() -> None:
    ledger = {
        "entries": [
            {
                "ledgerEntryId": "rev-1",
                "classification": "mcp_payload_wrong",
                "sourceFactIds": ["wall-1"],
                "affectedPhaseIds": ["S2-EG"],
            }
        ]
    }
    plan = build_reverse_bim_handoff_regeneration_plan(
        facts=[
            {
                "factId": "wall-1",
                "kind": "wall_chain",
                "value": {
                    "levelId": "EG",
                    "points": [[0, 0], [5000, 0], [5000, 4000]],
                    "thicknessMm": 240,
                    "wallRole": "exterior",
                },
            }
        ],
        source_revision_ledger=ledger,
        phase_authoring_spec={
            "phases": [{"phaseId": "S2-EG", "sourceFactIds": ["wall-1"]}]
        },
    )

    assert plan["ok"] is True
    assert plan["phasePlans"][0]["status"] == "handoff_regeneration_ready"
    assert plan["phasePlans"][0]["expectedReadback"][0]["sourceFactId"] == "wall-1"


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
    ledger_resp = client.post(
        "/api/v3/reverse-bim/source-revision-ledger",
        json={"sourceSpecRevision": revision_resp.json(), "facts": []},
    )
    handoff_resp = client.post(
        "/api/v3/reverse-bim/handoff-regeneration",
        json={"sourceRevisionLedger": ledger_resp.json(), "facts": []},
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
    assert ledger_resp.status_code == 200
    assert ledger_resp.json()["format"] == "reverseBimSourceRevisionLedger_v1"
    assert handoff_resp.status_code == 200
    assert handoff_resp.json()["format"] == "reverseBimHandoffRegenerationPlan_v1"
    assert slice_resp.status_code == 200
    assert slice_resp.json()["format"] == "hybridReverseBimSliceReport_v1"
    assert run_resp.status_code == 200
    assert run_resp.json()["format"] == "hybridReverseBimRunReport_v1"
