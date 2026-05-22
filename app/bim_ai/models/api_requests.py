"""Pydantic request bodies for ``routes_api`` (BRT-02).

Three handlers in ``routes_api.py`` accepted an untyped dict body:

- ``POST /semantic-authoring/{surface_id}`` forwards the body to
  ``build_semantic_authoring_bundle``, which accepts either a dict or a
  Pydantic model. Extras are allowed because each surface has its own
  payload schema.

- ``POST /v3/models/{model_id}/reverse-bim/hybrid-slice-execute`` reads a
  large constellation of keys (``facts``, ``phase``, ``mcpReadiness``,
  ``bundle``, ``userId``, ``modelReadback``, ...). The model declares
  the keys the handler inspects explicitly; downstream functions still
  receive a dict via ``body.model_dump(by_alias=True)`` where needed.

- ``POST /v3/models/{model_id}/reverse-bim/hybrid-run-execute`` reads
  ``slices`` plus the same hybrid-slice payload keys it forwards down
  into each child slice invocation.

Per the BRT-01 ground rules, required-field validation stays in the
handler.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True, protected_namespaces=())


class SemanticAuthoringRequest(_Base):
    """Forwarded wholesale to ``build_semantic_authoring_bundle``."""


class ReverseBimHybridSliceExecuteRequest(_Base):
    phase: Any | None = None
    phase_id: Any | None = Field(default=None, alias="phaseId")
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    mcp_readiness: Any | None = Field(default=None, alias="mcpReadiness")
    force_dry_run_with_blockers: Any | None = Field(default=None, alias="forceDryRunWithBlockers")
    bundle: Any | None = None
    command_bundle: Any | None = Field(default=None, alias="commandBundle")
    user_id: Any | None = Field(default=None, alias="userId")
    submitter: Any | None = None
    actor_kind: Any | None = Field(default=None, alias="actorKind")
    client_op_id: Any | None = Field(default=None, alias="clientOpId")
    commit: Any | None = None
    mode: Any | None = None
    model_readback: Any | None = Field(default=None, alias="modelReadback")
    readback: Any | None = None
    tolerance_defaults: Any | None = Field(default=None, alias="toleranceDefaults")
    advisor_profile: Any | None = Field(default=None, alias="advisorProfile")
    constructability_profile: Any | None = Field(default=None, alias="constructabilityProfile")
    source_overlay: Any | None = Field(default=None, alias="sourceOverlay")
    source_revision_ledger: Any | None = Field(default=None, alias="sourceRevisionLedger")
    phase_authoring_spec: Any | None = Field(default=None, alias="phaseAuthoringSpec")
    phase_spec: Any | None = Field(default=None, alias="phaseSpec")
    output_dir: Any | None = Field(default=None, alias="outputDir")
    run_id: Any | None = Field(default=None, alias="runId")
    finding_dispositions: Any | None = Field(default=None, alias="findingDispositions")
    evidence_requirements: Any | None = Field(default=None, alias="evidenceRequirements")
    source_page_index: Any | None = Field(default=None, alias="sourcePageIndex")
    require_visual_evidence: Any | None = Field(default=None, alias="requireVisualEvidence")
    view_capture_plan: Any | None = Field(default=None, alias="viewCapturePlan")
    view_capture_output_dir: Any | None = Field(default=None, alias="viewCaptureOutputDir")
    view_capture_base_url: Any | None = Field(default=None, alias="viewCaptureBaseUrl")
    base_url: Any | None = Field(default=None, alias="baseUrl")
    capture_viewport: Any | None = Field(default=None, alias="captureViewport")
    viewport: Any | None = None
    ui_evidence: Any | None = Field(default=None, alias="uiEvidence")
    expected_readback: Any | None = Field(default=None, alias="expectedReadback")
    source_fact_ids: Any | None = Field(default=None, alias="sourceFactIds")


class ReverseBimHybridRunExecuteRequest(_Base):
    slices: Any | None = None
    continue_on_blockers: Any | None = Field(default=None, alias="continueOnBlockers")
    phase_authoring_spec: Any | None = Field(default=None, alias="phaseAuthoringSpec")
    phase_spec: Any | None = Field(default=None, alias="phaseSpec")
    package_acceptance: Any | None = Field(default=None, alias="packageAcceptance")
    folder_output: Any | None = Field(default=None, alias="folderOutput")
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")


__all__ = [
    "ReverseBimHybridRunExecuteRequest",
    "ReverseBimHybridSliceExecuteRequest",
    "SemanticAuthoringRequest",
]
