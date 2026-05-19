from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass
from typing import Any, Literal

RuleSuppressibility = Literal["ignorable", "review_required", "non_suppressible"]

PROFILE_PRESETS: dict[str, dict[str, Any]] = {
    "architecture": {
        "id": "architecture",
        "label": "Architecture",
        "defaultSeverityFloor": "info",
        "disciplineFocus": ["architecture", "coordination"],
        "ruleMembership": ["architecture", "coordination", "documentation"],
    },
    "structure": {
        "id": "structure",
        "label": "Structure",
        "defaultSeverityFloor": "warning",
        "disciplineFocus": ["structure", "coordination"],
        "ruleMembership": ["structure", "coordination", "geometry"],
    },
    "mep": {
        "id": "mep",
        "label": "MEP",
        "defaultSeverityFloor": "warning",
        "disciplineFocus": ["mep", "coordination"],
        "ruleMembership": ["mep", "coordination", "penetration"],
    },
    "fire": {
        "id": "fire",
        "label": "Fire",
        "defaultSeverityFloor": "warning",
        "disciplineFocus": ["architecture", "coordination"],
        "ruleMembership": ["egress", "door", "stair", "metadata"],
    },
    "accessibility": {
        "id": "accessibility",
        "label": "Accessibility",
        "defaultSeverityFloor": "warning",
        "disciplineFocus": ["architecture"],
        "ruleMembership": ["door", "room", "stair", "clearance"],
    },
    "construction_readiness": {
        "id": "construction_readiness",
        "label": "Construction Readiness",
        "defaultSeverityFloor": "error",
        "disciplineFocus": ["architecture", "structure", "mep", "coordination"],
        "ruleMembership": ["geometry", "constructability", "support", "penetration"],
    },
    "exchange": {
        "id": "exchange",
        "label": "Exchange",
        "defaultSeverityFloor": "warning",
        "disciplineFocus": ["exchange", "coordination"],
        "ruleMembership": ["exchange", "documentation", "metadata"],
    },
    "sketch_acceptance": {
        "id": "sketch_acceptance",
        "label": "Sketch Acceptance",
        "defaultSeverityFloor": "warning",
        "disciplineFocus": ["agent", "coordination", "architecture"],
        "ruleMembership": ["evidence", "renderer", "methodology"],
    },
}


@dataclass(frozen=True)
class AudienceText:
    ui: str
    agent: str
    docs: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True)
class RulePolicy:
    rule_id: str
    title: str
    layer_owner: str
    suppressibility: RuleSuppressibility
    profile_membership: tuple[str, ...]
    audience_text: AudienceText
    tolerance_requires_owner: bool = True
    tolerance_requires_expiry: bool = True
    tolerance_requires_evidence: bool = True
    root_cause_family: str = "general"
    visible_impact_rank: int = 5
    dependency_rank: int = 5
    learning_corpus_eligible: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "ruleId": self.rule_id,
            "title": self.title,
            "layerOwner": self.layer_owner,
            "suppressibility": self.suppressibility,
            "profileMembership": list(self.profile_membership),
            "audienceText": self.audience_text.to_dict(),
            "tolerancePolicy": {
                "requiresOwner": self.tolerance_requires_owner,
                "requiresExpiry": self.tolerance_requires_expiry,
                "requiresEvidence": self.tolerance_requires_evidence,
            },
            "rootCauseFamily": self.root_cause_family,
            "visibleImpactRank": self.visible_impact_rank,
            "dependencyRank": self.dependency_rank,
            "learningCorpusEligible": self.learning_corpus_eligible,
        }


def _policy(
    rule_id: str,
    title: str,
    *,
    owner: str,
    suppressibility: RuleSuppressibility,
    profiles: tuple[str, ...],
    family: str,
    ui: str,
    agent: str,
    docs: str,
    visible: int = 5,
    dependency: int = 5,
) -> RulePolicy:
    return RulePolicy(
        rule_id=rule_id,
        title=title,
        layer_owner=owner,
        suppressibility=suppressibility,
        profile_membership=profiles,
        root_cause_family=family,
        audience_text=AudienceText(ui=ui, agent=agent, docs=docs),
        visible_impact_rank=visible,
        dependency_rank=dependency,
    )


_CONSTRUCTION = ("construction_readiness",)
_ARCH_CONSTRUCTION = ("architecture", "construction_readiness")
_STRUCT_CONSTRUCTION = ("structure", "construction_readiness")
_MEP_CONSTRUCTION = ("mep", "construction_readiness")

RULE_POLICIES: dict[str, RulePolicy] = {
    "physical_hard_clash": _policy(
        "physical_hard_clash",
        "Physical hard clash",
        owner="bim_integrity_advisor",
        suppressibility="non_suppressible",
        profiles=_CONSTRUCTION,
        family="physical_coordination",
        ui="Physical elements overlap and need a modeled correction.",
        agent=(
            "Do not suppress hard clashes. Move, trim, reroute, or model the "
            "missing opening/support."
        ),
        docs="Hard clashes are invalid physical states in construction-readiness profiles.",
        visible=0,
        dependency=0,
    ),
    "furniture_wall_hard_clash": _policy(
        "furniture_wall_hard_clash",
        "Furniture wall hard clash",
        owner="constructability_advisor",
        suppressibility="ignorable",
        profiles=_ARCH_CONSTRUCTION,
        family="physical_coordination",
        ui="A placed object intersects a wall.",
        agent=(
            "Review whether this is a real recess/built-in. If it is, classify "
            "as accepted tolerance with evidence."
        ),
        docs="Furniture/wall conflicts are suppressible only when intentionally reviewed.",
        visible=2,
        dependency=2,
    ),
    "physical_duplicate_geometry": _policy(
        "physical_duplicate_geometry",
        "Physical duplicate geometry",
        owner="bim_integrity_advisor",
        suppressibility="review_required",
        profiles=_CONSTRUCTION,
        family="duplicate_geometry",
        ui="Two physical elements occupy the same modeled space.",
        agent=(
            "Deduplicate or document a temporary review-required tolerance with "
            "owner, expiry, and evidence."
        ),
        docs=(
            "Duplicate geometry may be temporarily tolerated during cleanup but "
            "requires an auditable review record."
        ),
        visible=1,
        dependency=1,
    ),
    "stair_wall_hard_clash": _policy(
        "stair_wall_hard_clash",
        "Stair wall hard clash",
        owner="constructability_advisor",
        suppressibility="non_suppressible",
        profiles=("architecture", "accessibility", "fire", "construction_readiness"),
        family="stair_access",
        ui="Stair geometry is obstructed by wall geometry.",
        agent=(
            "Resolve stair/wall geometry before acceptance; this affects circulation and egress."
        ),
        docs="Stair hard clashes are modeled defects, not tolerances.",
        visible=0,
        dependency=0,
    ),
    "door_operation_clearance_conflict": _policy(
        "door_operation_clearance_conflict",
        "Door operation clearance conflict",
        owner="constructability_advisor",
        suppressibility="review_required",
        profiles=("architecture", "accessibility", "fire", "construction_readiness"),
        family="clearance",
        ui="A door operation zone is blocked.",
        agent=(
            "Fix the obstruction or record a reviewed tolerance with owner, expiry, and evidence."
        ),
        docs="Clearance exceptions require explicit review evidence.",
        visible=1,
        dependency=2,
    ),
    "room_without_door_access": _policy(
        "room_without_door_access",
        "Room without door access",
        owner="constructability_advisor",
        suppressibility="non_suppressible",
        profiles=("architecture", "accessibility", "fire", "construction_readiness"),
        family="room_access",
        ui="A room has no valid physical door access.",
        agent=(
            "Add or repair real hosted access. Do not count room-separation/helper "
            "geometry as access."
        ),
        docs="Room access findings must be fixed in the model.",
        visible=0,
        dependency=1,
    ),
    "room_without_egress_path": _policy(
        "room_without_egress_path",
        "Room without egress path",
        owner="constructability_advisor",
        suppressibility="non_suppressible",
        profiles=("architecture", "accessibility", "fire", "construction_readiness"),
        family="egress",
        ui="A room is not connected to an exit path.",
        agent="Repair the egress graph or mark an appropriate exit door; do not suppress.",
        docs="Egress-path failures are non-suppressible in readiness profiles.",
        visible=0,
        dependency=0,
    ),
    "pipe_wall_penetration_without_opening": _policy(
        "pipe_wall_penetration_without_opening",
        "Pipe wall penetration without opening",
        owner="constructability_advisor",
        suppressibility="review_required",
        profiles=_MEP_CONSTRUCTION,
        family="mep_penetration",
        ui="A pipe crosses a wall without a sleeve/opening.",
        agent=("Add the wall opening/sleeve, reroute, or record reviewed coordination evidence."),
        docs="MEP penetration tolerances require owner, expiry, and evidence.",
        visible=1,
        dependency=2,
    ),
    "duct_wall_penetration_without_opening": _policy(
        "duct_wall_penetration_without_opening",
        "Duct wall penetration without opening",
        owner="constructability_advisor",
        suppressibility="review_required",
        profiles=_MEP_CONSTRUCTION,
        family="mep_penetration",
        ui="A duct crosses a wall without a sleeve/opening.",
        agent=("Add the wall opening/sleeve, reroute, or record reviewed coordination evidence."),
        docs="MEP penetration tolerances require owner, expiry, and evidence.",
        visible=1,
        dependency=2,
    ),
    "load_bearing_wall_removed_without_transfer": _policy(
        "load_bearing_wall_removed_without_transfer",
        "Load-bearing wall removed without transfer",
        owner="constructability_advisor",
        suppressibility="non_suppressible",
        profiles=_STRUCT_CONSTRUCTION,
        family="load_path",
        ui="A load-bearing wall is removed without a transfer condition.",
        agent=(
            "Model the transfer/support condition or restore the bearing wall before acceptance."
        ),
        docs="Load-path defects require modeled correction.",
        visible=0,
        dependency=0,
    ),
    "constructability_metadata_requirement_missing": _policy(
        "constructability_metadata_requirement_missing",
        "Constructability metadata requirement missing",
        owner="constructability_advisor",
        suppressibility="review_required",
        profiles=(
            "architecture",
            "structure",
            "mep",
            "fire",
            "accessibility",
            "construction_readiness",
        ),
        family="metadata_requirement",
        ui="Required profile metadata is missing.",
        agent="Add the required property or record why the profile requirement is deferred.",
        docs="Profile metadata gaps may be temporarily tolerated with auditable evidence.",
        visible=4,
        dependency=4,
    ),
}


DEFAULT_RULE_POLICY = RulePolicy(
    rule_id="__default__",
    title="Advisor finding",
    layer_owner="advisor",
    suppressibility="review_required",
    profile_membership=("architecture", "construction_readiness"),
    root_cause_family="general",
    audience_text=AudienceText(
        ui="Advisor found a condition that needs review.",
        agent=(
            "Inspect the rule, affected elements, and profile before deciding "
            "whether to fix or tolerate it."
        ),
        docs="Unregistered rules default to review-required suppressibility.",
    ),
)

FALSE_POSITIVE_REVIEW_WORKFLOW = {
    "schemaVersion": "advisor.false-positive-review-workflow.v1",
    "classifications": [
        "rule_defect",
        "accepted_tolerance",
        "profile_mismatch",
        "model_defect",
    ],
    "requiredFieldsByClassification": {
        "rule_defect": ["owner", "evidenceRefs", "reviewNote"],
        "accepted_tolerance": ["owner", "expiresRevision", "evidenceRefs", "reviewNote"],
        "profile_mismatch": ["owner", "profileId", "evidenceRefs", "reviewNote"],
        "model_defect": ["owner", "fixPlan", "reviewNote"],
    },
    "statusMapping": {
        "rule_defect": "not_an_issue",
        "accepted_tolerance": "approved",
        "profile_mismatch": "reviewed",
        "model_defect": "active",
    },
}

LEARNING_CORPUS_CONTRACT = {
    "schemaVersion": "advisor.learning-corpus-hook.v1",
    "fixtureKeyFields": [
        "ruleId",
        "classification",
        "profileId",
        "elementKinds",
        "evidenceRefs",
    ],
    "allowedLabels": ["true_positive", "false_positive", "profile_mismatch"],
}


def rule_policy(rule_id: str) -> RulePolicy:
    policy = RULE_POLICIES.get(rule_id)
    if policy is not None:
        return policy
    return RulePolicy(
        rule_id=rule_id,
        title=rule_id.replace("_", " ").title(),
        layer_owner=DEFAULT_RULE_POLICY.layer_owner,
        suppressibility=DEFAULT_RULE_POLICY.suppressibility,
        profile_membership=DEFAULT_RULE_POLICY.profile_membership,
        audience_text=DEFAULT_RULE_POLICY.audience_text,
        root_cause_family=DEFAULT_RULE_POLICY.root_cause_family,
    )


def rule_policy_payload(rule_id: str) -> dict[str, Any]:
    return rule_policy(rule_id).to_dict()


def profile_preset(profile_id: str) -> dict[str, Any]:
    return dict(PROFILE_PRESETS.get(profile_id) or PROFILE_PRESETS["architecture"])


def profile_presets_payload() -> list[dict[str, Any]]:
    return [dict(PROFILE_PRESETS[key]) for key in sorted(PROFILE_PRESETS)]


def suppression_policy_decision(
    finding: Mapping[str, Any],
    suppression: Mapping[str, Any],
) -> dict[str, Any]:
    policy = rule_policy(str(finding.get("ruleId") or ""))
    missing: list[str] = []
    if policy.suppressibility == "non_suppressible":
        return {
            "allowed": False,
            "reason": "rule_non_suppressible",
            "missing": [],
            "policy": policy.to_dict(),
        }
    if policy.suppressibility == "review_required":
        if policy.tolerance_requires_owner and not str(suppression.get("owner") or "").strip():
            missing.append("owner")
        if policy.tolerance_requires_expiry and suppression.get("expiresRevision") is None:
            missing.append("expiresRevision")
        evidence_refs = suppression.get("evidenceRefs")
        if policy.tolerance_requires_evidence and not (
            isinstance(evidence_refs, list) and evidence_refs
        ):
            missing.append("evidenceRefs")
    return {
        "allowed": not missing,
        "reason": "ok" if not missing else "tolerance_policy_incomplete",
        "missing": missing,
        "policy": policy.to_dict(),
    }


def review_workflow_payload() -> dict[str, Any]:
    return dict(FALSE_POSITIVE_REVIEW_WORKFLOW)


def learning_corpus_contract_payload() -> dict[str, Any]:
    return dict(LEARNING_CORPUS_CONTRACT)
