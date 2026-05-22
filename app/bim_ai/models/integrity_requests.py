"""Pydantic request bodies for ``routes_integrity`` (BRT-03).

Two routes in ``routes_integrity.py`` accepted an untyped dict body:

- ``POST /v3/invariants/smoke`` forwards the whole body to
  ``model_integrity_smoke_command_evidence_v1`` (which still expects a
  ``dict[str, Any]``), so the model is purely a typing-vehicle and
  permits any extras.

- ``POST /models/{model_id}/qa/integrity-remediation`` inspects
  ``mode`` and ``proposalIds`` directly.

Per the BRT-01 ground rules, required-field validation stays in the
handler.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True, protected_namespaces=())


class InvariantSmokeRequest(_Base):
    """Forwarded wholesale to ``model_integrity_smoke_command_evidence_v1``."""


class IntegrityRemediationRequest(_Base):
    mode: Any | None = None
    proposal_ids: Any | None = Field(default=None, alias="proposalIds")


__all__ = [
    "IntegrityRemediationRequest",
    "InvariantSmokeRequest",
]
