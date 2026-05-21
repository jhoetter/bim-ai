"""BCF, constructability, construction, agent assumption/deviation, and
validation rule element models extracted from elements.py.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import (
    ConstructionLogisticsKind,
    ConstructionProgressStatus,
    EvidenceRef,
    Vec2Mm,
)


class BcfElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["bcf"] = "bcf"
    id: str
    title: str
    viewpoint_ref: str | None = Field(default=None, alias="viewpointRef")
    status: str = Field(default="open")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    plan_view_id: str | None = Field(default=None, alias="planViewId")
    section_cut_id: str | None = Field(default=None, alias="sectionCutId")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")


class ConstructabilitySuppressionElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["constructability_suppression"] = "constructability_suppression"
    id: str
    rule_id: str | None = Field(default=None, alias="ruleId")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    reason: str
    active: bool = True
    expires_revision: int | None = Field(default=None, alias="expiresRevision")
    owner: str | None = None
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")
    review_classification: str | None = Field(default=None, alias="reviewClassification")


ConstructabilityIssueStatus = Literal[
    "new",
    "active",
    "reviewed",
    "approved",
    "not_an_issue",
    "resolved",
    "suppressed",
]


class ConstructabilityIssueElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["constructability_issue"] = "constructability_issue"
    id: str
    fingerprint: str
    rule_id: str = Field(alias="ruleId")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    pair_key: str | None = Field(default=None, alias="pairKey")
    status: ConstructabilityIssueStatus = "new"
    first_seen_revision: str | int | None = Field(default=None, alias="firstSeenRevision")
    last_seen_revision: str | int | None = Field(default=None, alias="lastSeenRevision")
    resolved_revision: str | int | None = Field(default=None, alias="resolvedRevision")
    location_bucket: str | None = Field(default=None, alias="locationBucket")
    message: str | None = None
    severity: str | None = None
    discipline: str | None = None
    blocking_class: str | None = Field(default=None, alias="blockingClass")
    recommendation: str | None = None
    assignee_placeholder: str | None = Field(default=None, alias="assigneePlaceholder")
    resolution_comment: str | None = Field(default=None, alias="resolutionComment")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")
    review_classification: str | None = Field(default=None, alias="reviewClassification")
    review_owner: str | None = Field(default=None, alias="reviewOwner")
    review_note: str | None = Field(default=None, alias="reviewNote")


class ConstructionPackageElem(BaseModel):
    """Construction-lens work package that design elements can reference by id."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["construction_package"] = "construction_package"
    id: str
    name: str
    code: str | None = None
    phase_id: str | None = Field(default=None, alias="phaseId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    actual_start: str | None = Field(default=None, alias="actualStart")
    actual_end: str | None = Field(default=None, alias="actualEnd")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    dependencies: list[str] = Field(default_factory=list)


class ConstructionLogisticsElem(BaseModel):
    """Explicit temporary/site-logistics element; design elements are not repurposed."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["construction_logistics"] = "construction_logistics"
    id: str
    name: str
    logistics_kind: ConstructionLogisticsKind = Field(alias="logisticsKind")
    boundary_mm: list[Vec2Mm] = Field(default_factory=list, alias="boundaryMm")
    path_mm: list[Vec2Mm] = Field(default_factory=list, alias="pathMm")
    phase_id: str | None = Field(default=None, alias="phaseId")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    actual_start: str | None = Field(default=None, alias="actualStart")
    actual_end: str | None = Field(default=None, alias="actualEnd")
    progress_status: ConstructionProgressStatus = Field(
        default="not_started", alias="progressStatus"
    )
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")
    issue_ids: list[str] = Field(default_factory=list, alias="issueIds")


class ConstructionChecklistItem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    label: str
    status: Literal["open", "pass", "fail", "na"] = "open"
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")


class ConstructionQaChecklistElem(BaseModel):
    """Field QA checklist linked to model elements, packages, and evidence."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["construction_qa_checklist"] = "construction_qa_checklist"
    id: str
    name: str
    target_element_ids: list[str] = Field(default_factory=list, alias="targetElementIds")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    phase_id: str | None = Field(default=None, alias="phaseId")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    progress_status: ConstructionProgressStatus = Field(
        default="not_started", alias="progressStatus"
    )
    checklist: list[ConstructionChecklistItem] = Field(default_factory=list)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")
    issue_ids: list[str] = Field(default_factory=list, alias="issueIds")


AgentAssumptionSource = Literal["manual", "bundle_dry_run", "evidence_summary"]
AgentAssumptionClosureStatus = Literal["open", "resolved", "accepted", "deferred"]
# SKB-08: phaseId values match the SKB-12 cookbook's seven phase tags.
SkbPhaseId = Literal[
    "massing",
    "skeleton",
    "envelope",
    "openings",
    "interior",
    "detail",
    "documentation",
]


class AgentAssumptionElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["agent_assumption"] = "agent_assumption"
    id: str
    statement: str
    source: AgentAssumptionSource = "manual"
    closure_status: AgentAssumptionClosureStatus = Field(
        default="resolved",
        alias="closureStatus",
        description="Open assumptions require explicit resolution before acceptance.",
    )
    related_element_ids: list[str] = Field(default_factory=list, alias="relatedElementIds")
    related_topic_id: str | None = Field(default=None, alias="relatedTopicId")
    # SKB-08: phase + sketch anchor for sketch-to-BIM auditability.
    phase_id: SkbPhaseId | None = Field(
        default=None,
        alias="phaseId",
        description="SKB-08: the SKB-12 phase the assumption was made in.",
    )
    sketch_anchor_mm: dict | None = Field(
        default=None,
        alias="sketchAnchorMm",
        description=(
            "SKB-08: optional sketch-coordinate anchor for the inference. "
            "Free-form dict so authors can carry pixel coords, polygon refs, "
            "or panel labels without a forced schema."
        ),
    )


AgentDeviationSeverity = Literal["info", "warning", "error"]


class AgentDeviationElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["agent_deviation"] = "agent_deviation"
    id: str
    statement: str
    severity: AgentDeviationSeverity = "warning"
    acknowledged: bool = True
    related_assumption_id: str | None = Field(default=None, alias="relatedAssumptionId")
    related_element_ids: list[str] = Field(default_factory=list, alias="relatedElementIds")


class ValidationRuleElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["validation_rule"] = "validation_rule"
    id: str
    name: str = "IDS clause"
    rule_json: dict[str, Any] = Field(default_factory=dict, alias="ruleJson")


SiteContextType = Literal["tree", "shrub", "neighbor_proxy", "entourage"]


