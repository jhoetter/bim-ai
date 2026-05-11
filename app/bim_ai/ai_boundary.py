"""AGT-V3-06/COL-V3-05 trust boundary helpers.

v3 does not call external AI models. This module defines the boundary future
integrations must use so the no-training promise is testable before callers
exist.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime
from pathlib import Path
from typing import Iterable, Literal

from pydantic import BaseModel, ConfigDict, Field


AUDIT_CSV_HEADER: tuple[str, ...] = (
    "jobId",
    "modelId",
    "modelVersion",
    "trainOnInputFlag",
    "timestamp",
    "agentIdentifier",
)


class ExternalModelCallAuditRow(BaseModel):
    """Audit row required for any future external model call."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    job_id: str = Field(alias="jobId", min_length=1)
    model_id: str = Field(alias="modelId", min_length=1)
    model_version: str = Field(alias="modelVersion", min_length=1)
    train_on_input_flag: Literal[False] = Field(alias="trainOnInputFlag")
    timestamp: datetime
    agent_identifier: str = Field(alias="agentIdentifier", min_length=1)


def validate_external_model_call(payload: dict[str, object]) -> ExternalModelCallAuditRow:
    """Validate an external model-call audit row and enforce no training."""

    return ExternalModelCallAuditRow.model_validate(payload)


def external_model_call_audit_csv(
    rows: Iterable[ExternalModelCallAuditRow] = (),
) -> str:
    """Return deterministic CSV for external model-call audit rows."""

    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=AUDIT_CSV_HEADER, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                "jobId": row.job_id,
                "modelId": row.model_id,
                "modelVersion": row.model_version,
                "trainOnInputFlag": str(row.train_on_input_flag).lower(),
                "timestamp": row.timestamp.isoformat(),
                "agentIdentifier": row.agent_identifier,
            }
        )
    return stream.getvalue()


def empty_external_model_call_audit_csv() -> str:
    """v3 has no external model calls, so the export is a header-only CSV."""

    return external_model_call_audit_csv()


def bill_of_rights_path() -> Path:
    return Path(__file__).resolve().parents[2] / "legal" / "bill-of-rights.md"


def load_bill_of_rights_markdown() -> str:
    return bill_of_rights_path().read_text(encoding="utf-8")
