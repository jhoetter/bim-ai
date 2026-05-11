"""AGT-V3-06 and COL-V3-05 trust-surface tests."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from bim_ai.ai_boundary import (
    AUDIT_CSV_HEADER,
    bill_of_rights_path,
    empty_external_model_call_audit_csv,
    load_bill_of_rights_markdown,
    validate_external_model_call,
)
from bim_ai.routes_api import api_router


def _valid_payload() -> dict[str, object]:
    return {
        "jobId": "job-1",
        "modelId": "project-1",
        "modelVersion": "future-model-1",
        "trainOnInputFlag": False,
        "timestamp": datetime(2026, 5, 11, tzinfo=UTC).isoformat(),
        "agentIdentifier": "external-agent",
    }


def test_external_model_call_requires_explicit_no_training_flag() -> None:
    row = validate_external_model_call(_valid_payload())

    assert row.train_on_input_flag is False


def test_external_model_call_rejects_training_enabled() -> None:
    payload = _valid_payload()
    payload["trainOnInputFlag"] = True

    with pytest.raises(ValidationError):
        validate_external_model_call(payload)


def test_external_model_call_rejects_missing_training_flag() -> None:
    payload = _valid_payload()
    del payload["trainOnInputFlag"]

    with pytest.raises(ValidationError):
        validate_external_model_call(payload)


def test_empty_audit_export_is_header_only_csv() -> None:
    csv_text = empty_external_model_call_audit_csv()

    assert csv_text == ",".join(AUDIT_CSV_HEADER) + "\n"


def test_bill_of_rights_artifact_contains_nine_rights_and_no_training_clause() -> None:
    text = load_bill_of_rights_markdown()

    assert bill_of_rights_path().exists()
    assert text.count("## ") == 9
    assert "Your work is not training data" in text
    assert "trainOnInputFlag=false" in text
    assert "IFC and BCF" in text
    assert "activity stream" in text
    assert "assumptions before applying" in text


def test_api_exposes_bill_of_rights_and_empty_audit_csv() -> None:
    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    bill = client.get("/api/v3/bill-of-rights")
    assert bill.status_code == 200
    assert "Designer" in bill.text
    assert "never used to train any AI model" in bill.text

    audit = client.get("/api/v3/ai/audit-log.csv")
    assert audit.status_code == 200
    assert audit.headers["content-type"].startswith("text/csv")
    assert audit.text == ",".join(AUDIT_CSV_HEADER) + "\n"
