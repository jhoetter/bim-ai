"""Tests for the TH-X-F006 source_view_evidence schema, bundle builders, and
dispatch.

Covers:

* Engine dispatch creates and updates a SourceViewEvidenceElem with merge
  semantics (None means "do not change" rather than "clear").
* Engine dispatch validates the joined view kind.
* The semantic-authoring bundle builders pair view creation with an evidence
  upsert when source provenance is supplied.
* The four new REST routes return SemanticAuthoringBundle-shaped responses.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.commands import (
    CreateElevationViewCmd,
    CreateSectionCutCmd,
    UpsertPlanViewCmd,
    UpsertSourceViewEvidenceCmd,
)
from bim_ai.document import Document
from bim_ai.elements_links import (
    ElevationViewElem,
    SectionCutElem,
    SourceViewEvidenceElem,
)
from bim_ai.engine import apply_inplace
from bim_ai.routes_reverse_bim import reverse_bim_router
from bim_ai.semantic_authoring import (
    ReverseBimExteriorViewPayload,
    ReverseBimSectionViewPayload,
    ReverseBimSourceViewEvidencePayload,
    reverse_bim_exterior_view_bundle,
    reverse_bim_section_view_bundle,
    reverse_bim_source_view_evidence_bundle,
)


def _doc_with(*elements):
    return Document(modelId="m1", elements={el.id: el for el in elements})


def _apply(doc: Document, cmd) -> Document:
    apply_inplace(doc, cmd)
    return doc


def test_create_source_view_evidence_for_existing_section_cut() -> None:
    doc = _doc_with(
        SectionCutElem(
            id="sc-1",
            name="Querschnitt A-A",
            line_start_mm={"xMm": 0.0, "yMm": 0.0},
            line_end_mm={"xMm": 0.0, "yMm": 10000.0},
        )
    )
    _apply(
        doc,
        UpsertSourceViewEvidenceCmd(
            id="ev-1",
            viewElementId="sc-1",
            category="section",
            status="source_linked",
            sourceDocumentId="srcdoc-kannenofen",
            sourcePage=9,
        ),
    )
    evidence = doc.elements["ev-1"]
    assert isinstance(evidence, SourceViewEvidenceElem)
    assert evidence.view_element_id == "sc-1"
    assert evidence.category == "section"
    assert evidence.status == "source_linked"
    assert evidence.source_document_id == "srcdoc-kannenofen"
    assert evidence.source_page == 9


def test_upsert_merges_fields_and_preserves_unset_values() -> None:
    doc = _doc_with(
        ElevationViewElem(id="ev-strasse", name="Strassenansicht", direction="north"),
        SourceViewEvidenceElem(
            id="sve-1",
            view_element_id="ev-strasse",
            category="exterior",
            status="source_linked",
            source_document_id="srcdoc-kannenofen",
            source_page=6,
            comparison_type="overlay",
        ),
    )
    _apply(
        doc,
        UpsertSourceViewEvidenceCmd(
            id="sve-1",
            viewElementId="ev-strasse",
            category="exterior",
            status="overlay_compared",
            screenshotPath="evidence/strasse.png",
        ),
    )
    evidence = doc.elements["sve-1"]
    assert isinstance(evidence, SourceViewEvidenceElem)
    assert evidence.status == "overlay_compared"
    # Untouched fields are preserved on upsert.
    assert evidence.source_document_id == "srcdoc-kannenofen"
    assert evidence.source_page == 6
    assert evidence.comparison_type == "overlay"
    assert evidence.screenshot_path == "evidence/strasse.png"


def test_dispatch_rejects_evidence_against_non_view_element() -> None:
    from bim_ai.elements_links import JoinGeometryElem

    doc = _doc_with(
        JoinGeometryElem(id="jg-1", joinedElementIds=["el-a", "el-b"]),
    )
    with pytest.raises(ValueError, match="must reference an existing"):
        _apply(
            doc,
            UpsertSourceViewEvidenceCmd(
                viewElementId="jg-1",
                category="section",
            ),
        )


def test_dispatch_rejects_evidence_when_id_targets_non_evidence_element() -> None:
    doc = _doc_with(
        SectionCutElem(
            id="sc-2",
            name="Section",
            line_start_mm={"xMm": 0.0, "yMm": 0.0},
            line_end_mm={"xMm": 0.0, "yMm": 1000.0},
        ),
    )
    with pytest.raises(ValueError, match="is not a source_view_evidence"):
        _apply(
            doc,
            UpsertSourceViewEvidenceCmd(
                id="sc-2",
                viewElementId="sc-2",
                category="section",
            ),
        )


def test_exterior_view_bundle_pairs_create_with_evidence_when_source_provided() -> None:
    payload = ReverseBimExteriorViewPayload(
        name="Berg-Ansicht",
        direction="north",
        sourceDocumentId="srcdoc-ansichten",
        sourcePage=1,
        comparisonType="overlay",
    )
    bundle = reverse_bim_exterior_view_bundle(payload)
    assert bundle.operation == "reverse_bim_exterior_view"
    assert len(bundle.commands) == 2
    create_cmd, evidence_cmd = bundle.commands
    assert create_cmd["type"] == "createElevationView"
    assert evidence_cmd["type"] == "upsertSourceViewEvidence"
    # Evidence references the same view id assigned to the create command.
    assert evidence_cmd["viewElementId"] == create_cmd["id"]
    assert evidence_cmd["category"] == "exterior"
    assert evidence_cmd["status"] == "source_linked"
    assert evidence_cmd["sourceDocumentId"] == "srcdoc-ansichten"


def test_section_view_bundle_skips_evidence_when_no_source_provided() -> None:
    payload = ReverseBimSectionViewPayload(
        name="Querschnitt",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 0.0, "yMm": 5000.0},
    )
    bundle = reverse_bim_section_view_bundle(payload)
    assert bundle.operation == "reverse_bim_section_view"
    assert len(bundle.commands) == 1
    assert bundle.commands[0]["type"] == "createSectionCut"


def test_source_view_evidence_bundle_is_evidence_only() -> None:
    payload = ReverseBimSourceViewEvidencePayload(
        viewElementId="ev-strasse",
        category="exterior",
        status="accepted",
        screenshotPath="evidence/strasse.png",
        overlayPath="evidence/strasse.overlay.png",
    )
    bundle = reverse_bim_source_view_evidence_bundle(payload)
    assert bundle.operation == "reverse_bim_source_view_evidence"
    assert len(bundle.commands) == 1
    assert bundle.commands[0]["type"] == "upsertSourceViewEvidence"
    assert bundle.commands[0]["status"] == "accepted"


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(reverse_bim_router, prefix="/api")
    return TestClient(app)


def test_exterior_view_route_returns_bundle_payload() -> None:
    client = _client()
    response = client.post(
        "/api/v3/reverse-bim/exterior-view-create",
        json={
            "name": "Berg-Ansicht",
            "direction": "north",
            "sourceDocumentId": "srcdoc-ansichten",
            "sourcePage": 1,
            "comparisonType": "overlay",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["operation"] == "reverse_bim_exterior_view"
    assert len(body["commands"]) == 2
    assert body["commands"][0]["type"] == "createElevationView"
    assert body["commands"][1]["type"] == "upsertSourceViewEvidence"


def test_source_view_evidence_route_validates_payload() -> None:
    client = _client()
    bad = client.post(
        "/api/v3/reverse-bim/source-view-evidence-upsert",
        json={
            # missing viewElementId
            "category": "exterior",
        },
    )
    assert bad.status_code == 422
    detail = bad.json()["detail"]
    assert detail["code"] == "invalid_semantic_payload"


def test_detail_view_route_emits_callout_plan_view() -> None:
    client = _client()
    response = client.post(
        "/api/v3/reverse-bim/detail-view-create",
        json={
            "name": "Eave detail south",
            "levelId": "lvl-eg",
            "sourceDocumentId": "srcdoc-kannenofen",
            "sourcePage": 6,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    cmds = body["commands"]
    assert cmds[0]["type"] == "upsertPlanView"
    assert cmds[0]["planViewSubtype"] == "callout"
    assert cmds[1]["type"] == "upsertSourceViewEvidence"
    assert cmds[1]["category"] == "detail"


def test_section_view_route_round_trip() -> None:
    client = _client()
    response = client.post(
        "/api/v3/reverse-bim/section-view-create",
        json={
            "name": "Querschnitt A-A",
            "lineStartMm": {"xMm": 0.0, "yMm": 0.0},
            "lineEndMm": {"xMm": 0.0, "yMm": 10000.0},
            "sourceDocumentId": "srcdoc-kannenofen",
            "sourcePage": 9,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    cmds = body["commands"]
    assert cmds[0]["type"] == "createSectionCut"
    assert cmds[1]["type"] == "upsertSourceViewEvidence"
    assert cmds[1]["category"] == "section"


def test_unused_imports_are_referenced() -> None:
    # Static reference to keep imports useful — surfaces missing imports early.
    assert CreateElevationViewCmd.__name__ == "CreateElevationViewCmd"
    assert CreateSectionCutCmd.__name__ == "CreateSectionCutCmd"
    assert UpsertPlanViewCmd.__name__ == "UpsertPlanViewCmd"
