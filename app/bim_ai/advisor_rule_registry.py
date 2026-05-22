"""Canonical Advisor rule metadata registry.

The registry is intentionally independent from individual rule evaluators. It
defines the contract that Advisor, model-integrity, renderer diagnostics, and
sketch acceptance findings must satisfy before they are exposed through UI,
CLI, API, or MCP surfaces.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

Severity = Literal["error", "warning", "info"]
LayerOwner = Literal[
    "authoring_validation",
    "model_integrity",
    "constructability",
    "renderer_diagnostics",
    "sketch_acceptance",
]
Discipline = Literal[
    "architecture",
    "structure",
    "mep",
    "coordination",
    "exchange",
    "renderer",
    "sketch",
    "platform",
]
Perspective = Literal[
    "architecture",
    "structure",
    "mep",
    "coordination",
    "exchange",
    "renderer",
    "sketch",
    "platform",
]
Suppressibility = Literal["not_suppressible", "tolerable_with_evidence", "suppressible"]
RuleStatus = Literal["planned", "implemented"]
Priority = Literal["P0", "P1", "P2"]
RuleSurface = Literal["ui", "api", "cli", "mcp", "docs"]
Actionability = Literal[
    "modeled_fix_required",
    "quick_fix_available",
    "implementation_or_view_change_required",
    "evidence_regeneration_required",
]
SeverityPolicy = Literal[
    "p0_integrity_error",
    "p0_renderer_fidelity_error",
    "p0_sketch_acceptance_error",
    "profile_metadata_warning",
    "informational_evidence",
]


@dataclass(frozen=True, slots=True)
class TolerancePolicy:
    requires_owner: bool
    requires_expiry: bool
    requires_evidence: bool

    def to_dict(self) -> dict[str, bool]:
        data = asdict(self)
        data["requiresOwner"] = data.pop("requires_owner")
        data["requiresExpiry"] = data.pop("requires_expiry")
        data["requiresEvidence"] = data.pop("requires_evidence")
        return data


ALLOWED_SEVERITIES: frozenset[str] = frozenset({"error", "warning", "info"})
ALLOWED_LAYER_OWNERS: frozenset[str] = frozenset(
    {
        "authoring_validation",
        "model_integrity",
        "constructability",
        "renderer_diagnostics",
        "sketch_acceptance",
    }
)
ALLOWED_DISCIPLINES: frozenset[str] = frozenset(
    {
        "architecture",
        "structure",
        "mep",
        "coordination",
        "exchange",
        "renderer",
        "sketch",
        "platform",
    }
)
ALLOWED_PERSPECTIVES: frozenset[str] = frozenset(ALLOWED_DISCIPLINES)
ALLOWED_SUPPRESSIBILITY: frozenset[str] = frozenset(
    {"not_suppressible", "tolerable_with_evidence", "suppressible"}
)
ALLOWED_STATUSES: frozenset[str] = frozenset({"planned", "implemented"})
ALLOWED_PRIORITIES: frozenset[str] = frozenset({"P0", "P1", "P2"})
ALLOWED_SURFACES: frozenset[str] = frozenset({"ui", "api", "cli", "mcp", "docs"})
ALLOWED_ACTIONABILITY: frozenset[str] = frozenset(
    {
        "modeled_fix_required",
        "quick_fix_available",
        "implementation_or_view_change_required",
        "evidence_regeneration_required",
    }
)
ALLOWED_SEVERITY_POLICIES: frozenset[str] = frozenset(
    {
        "p0_integrity_error",
        "p0_renderer_fidelity_error",
        "p0_sketch_acceptance_error",
        "profile_metadata_warning",
        "informational_evidence",
    }
)

CANONICAL_RULE_SURFACES: tuple[RuleSurface, ...] = ("ui", "api", "cli", "mcp", "docs")
DEFAULT_RULE_TEST_REFS: tuple[str, ...] = (
    "app/tests/test_advisor_rule_registry.py",
    "app/tests/test_api_v3_registry.py",
    "packages/cli/cli.mcpParity.test.mjs",
)
NO_TOLERANCE_POLICY = TolerancePolicy(False, False, False)
EVIDENCE_TOLERANCE_POLICY = TolerancePolicy(True, True, True)


@dataclass(frozen=True, slots=True)
class AdvisorRule:
    rule_id: str
    title: str
    severity: Severity
    layer_owner: LayerOwner
    discipline: Discipline
    perspective: Perspective
    profiles: tuple[str, ...]
    source_layer: LayerOwner
    severity_policy: SeverityPolicy
    suppressibility: Suppressibility
    tolerance_policy: TolerancePolicy
    actionability: Actionability
    recommendation: str
    documentation: str
    ui_summary: str
    cli_code: str
    api_field: str
    surfaces: tuple[RuleSurface, ...]
    affected_id_kinds: tuple[str, ...]
    fix_command_hints: tuple[str, ...]
    test_refs: tuple[str, ...]
    tracker_items: tuple[str, ...]
    priority: Priority
    examples: tuple[str, ...]
    status: RuleStatus = "planned"

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["ruleId"] = data.pop("rule_id")
        data["layerOwner"] = data.pop("layer_owner")
        data["sourceLayer"] = data.pop("source_layer")
        data["severityPolicy"] = data.pop("severity_policy")
        data.pop("tolerance_policy")
        data["tolerancePolicy"] = self.tolerance_policy.to_dict()
        data["uiSummary"] = data.pop("ui_summary")
        data["cliCode"] = data.pop("cli_code")
        data["apiField"] = data.pop("api_field")
        data["affectedIdKinds"] = data.pop("affected_id_kinds")
        data["fixCommandHints"] = data.pop("fix_command_hints")
        data["testRefs"] = data.pop("test_refs")
        data["trackerItems"] = data.pop("tracker_items")
        return data


@dataclass(frozen=True, slots=True)
class RuleTaxonomyFamily:
    family_id: str
    title: str
    match_prefixes: tuple[str, ...]
    match_exact: tuple[str, ...]
    severity: Severity
    layer_owner: LayerOwner
    discipline: Discipline
    perspective: Perspective
    profiles: tuple[str, ...]
    severity_policy: SeverityPolicy
    suppressibility: Suppressibility
    actionability: Actionability
    affected_id_kinds: tuple[str, ...]
    fix_command_hints: tuple[str, ...]
    tracker_items: tuple[str, ...]
    priority: Priority
    recommendation: str

    def matches(self, rule_id: str) -> bool:
        return rule_id in self.match_exact or any(
            rule_id.startswith(prefix) for prefix in self.match_prefixes
        )

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["familyId"] = data.pop("family_id")
        data["matchPrefixes"] = data.pop("match_prefixes")
        data["matchExact"] = data.pop("match_exact")
        data["layerOwner"] = data.pop("layer_owner")
        data["severityPolicy"] = data.pop("severity_policy")
        data["affectedIdKinds"] = data.pop("affected_id_kinds")
        data["fixCommandHints"] = data.pop("fix_command_hints")
        data["trackerItems"] = data.pop("tracker_items")
        return data


def _title_from_rule_id(rule_id: str) -> str:
    return rule_id.replace("_", " ").strip().title() or "Advisor Rule"


ADVISOR_RULES: tuple[AdvisorRule, ...] = (
    AdvisorRule(
        rule_id="bim_invariant_failure",
        title="BIM Document Invariant Failure",
        severity="error",
        layer_owner="model_integrity",
        discipline="platform",
        perspective="platform",
        profiles=("model_integrity", "construction_readiness", "agent_preflight"),
        source_layer="model_integrity",
        severity_policy="p0_integrity_error",
        suppressibility="not_suppressible",
        tolerance_policy=NO_TOLERANCE_POLICY,
        actionability="modeled_fix_required",
        recommendation=(
            "Repair the invalid document state before continuing; rerun the command bundle "
            "after ids, levels, units, type references, and deleted references are consistent."
        ),
        documentation=(
            "Generic guardrail for always-true document invariants such as unique ids, "
            "valid level/type references, valid units, valid physical-role declarations, "
            "and no stale references to deleted elements."
        ),
        ui_summary="The model contains an invalid document invariant.",
        cli_code="bim_invariant_failure",
        api_field="ruleId",
        surfaces=CANONICAL_RULE_SURFACES,
        affected_id_kinds=("element", "level", "type", "document"),
        fix_command_hints=("repairReferences", "normalizeDocument", "rollbackTransaction"),
        test_refs=DEFAULT_RULE_TEST_REFS,
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-P01"),
        priority="P0",
        examples=("Duplicate ids, stale references, or invalid physical-role declarations.",),
    ),
    AdvisorRule(
        rule_id="host_wall_outside_envelope",
        title="Physical Host Wall Outside Building Envelope",
        severity="error",
        layer_owner="model_integrity",
        discipline="architecture",
        perspective="architecture",
        profiles=("model_integrity", "architecture", "construction_readiness", "agent_preflight"),
        source_layer="model_integrity",
        severity_policy="p0_integrity_error",
        suppressibility="tolerable_with_evidence",
        tolerance_policy=EVIDENCE_TOLERANCE_POLICY,
        actionability="modeled_fix_required",
        recommendation=(
            "Move the wall into the level floor/building envelope, attach it to an explicit "
            "exterior support condition, or mark it as a documented detached condition."
        ),
        documentation=(
            "Physical walls on a storey must align with a floor, room boundary, envelope, or "
            "explicit detached/exterior condition. Hosted children inherit this error when "
            "their host wall is out of context."
        ),
        ui_summary="A physical wall is outside the supported building envelope.",
        cli_code="host_wall_outside_envelope",
        api_field="ruleId",
        surfaces=CANONICAL_RULE_SURFACES,
        affected_id_kinds=("wall", "door", "window", "floor", "level"),
        fix_command_hints=("moveWallIntoEnvelope", "addDetachedCondition", "convertToAnalysis"),
        test_refs=DEFAULT_RULE_TEST_REFS,
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-C02"),
        priority="P0",
        examples=("A wall and its hosted openings sit outside the active floor/envelope.",),
    ),
    AdvisorRule(
        rule_id="hosted_door_not_embedded",
        title="Hosted Door Not Embedded In Real Wall",
        severity="error",
        layer_owner="model_integrity",
        discipline="architecture",
        perspective="architecture",
        profiles=("model_integrity", "architecture", "construction_readiness", "agent_preflight"),
        source_layer="model_integrity",
        severity_policy="p0_integrity_error",
        suppressibility="not_suppressible",
        tolerance_policy=NO_TOLERANCE_POLICY,
        actionability="quick_fix_available",
        recommendation=(
            "Rehost the door to a physical architectural wall inside the building envelope, "
            "or convert the access artifact to a nonphysical analysis object."
        ),
        documentation=(
            "A door may have a syntactically valid wall reference while still being invalid "
            "because the host is nonphysical, analysis-only, outside the level floor, too "
            "short, or not part of a room/building boundary."
        ),
        ui_summary="A hosted door is not embedded in a valid physical wall.",
        cli_code="hosted_door_not_embedded",
        api_field="ruleId",
        surfaces=CANONICAL_RULE_SURFACES,
        affected_id_kinds=("door", "wall", "level", "floor"),
        fix_command_hints=("rehostDoor", "moveWallIntoEnvelope", "convertToAnalysis"),
        test_refs=DEFAULT_RULE_TEST_REFS,
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-C01"),
        priority="P0",
        examples=(
            "A door references a wall that is analysis-only, outside context, or too short.",
        ),
    ),
    AdvisorRule(
        rule_id="physical_helper_leakage",
        title="Physical Helper Or Analysis Element Leakage",
        severity="error",
        layer_owner="model_integrity",
        discipline="coordination",
        perspective="coordination",
        profiles=("model_integrity", "coordination", "construction_readiness", "agent_preflight"),
        source_layer="model_integrity",
        severity_policy="p0_integrity_error",
        suppressibility="not_suppressible",
        tolerance_policy=NO_TOLERANCE_POLICY,
        actionability="quick_fix_available",
        recommendation=(
            "Mark helper/access/diagnostic geometry as nonphysical and hidden from normal "
            "BIM surfaces, or replace it with authored physical building elements."
        ),
        documentation=(
            "Access-graph, room-closure, diagnostic, sketch, and other helper entities must "
            "not appear as visible physical BIM, schedules, exports, or valid hosts unless "
            "they have been explicitly promoted to a real element category."
        ),
        ui_summary="A helper or analysis element leaked into the physical BIM model.",
        cli_code="physical_helper_leakage",
        api_field="ruleId",
        surfaces=CANONICAL_RULE_SURFACES,
        affected_id_kinds=("element", "wall", "door", "room", "analysis_object"),
        fix_command_hints=(
            "convertToAnalysis",
            "hideHelper",
            "deleteElement",
            "promotePhysicalElement",
        ),
        test_refs=DEFAULT_RULE_TEST_REFS,
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-B03"),
        priority="P0",
        examples=("Room-closure or access-graph helper geometry appears as physical BIM.",),
    ),
    AdvisorRule(
        rule_id="renderer_unsupported_cut",
        title="Renderer Unsupported Or Failed Geometry Cut",
        severity="error",
        layer_owner="renderer_diagnostics",
        discipline="renderer",
        perspective="renderer",
        profiles=("renderer_fidelity", "construction_readiness", "sketch_acceptance"),
        source_layer="renderer_diagnostics",
        severity_policy="p0_renderer_fidelity_error",
        suppressibility="tolerable_with_evidence",
        tolerance_policy=EVIDENCE_TOLERANCE_POLICY,
        actionability="implementation_or_view_change_required",
        recommendation=(
            "Add renderer support or fallback diagnostics for the requested cut before using "
            "the viewport, screenshot evidence, or export preview as acceptance evidence."
        ),
        documentation=(
            "The semantic model may request a roof, slab, wall, or host cut that the current "
            "renderer cannot display faithfully. Renderer diagnostics must surface this as "
            "a fidelity error instead of silently showing uncut or proxy geometry."
        ),
        ui_summary="The renderer cannot faithfully display a required geometry cut.",
        cli_code="renderer_unsupported_cut",
        api_field="ruleId",
        surfaces=CANONICAL_RULE_SURFACES,
        affected_id_kinds=("element", "roof", "floor", "wall", "opening", "view"),
        fix_command_hints=("addRendererFallback", "switchEvidenceView", "markRendererUnsupported"),
        test_refs=DEFAULT_RULE_TEST_REFS,
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-I01", "BIR-M04"),
        priority="P0",
        examples=("A slab, roof, wall, or host cut is required but not faithfully rendered.",),
    ),
    AdvisorRule(
        rule_id="sketch_evidence_stale",
        title="Sketch Acceptance Evidence Stale",
        severity="error",
        layer_owner="sketch_acceptance",
        discipline="sketch",
        perspective="sketch",
        profiles=("sketch_acceptance", "agent_preflight"),
        source_layer="sketch_acceptance",
        severity_policy="p0_sketch_acceptance_error",
        suppressibility="not_suppressible",
        tolerance_policy=NO_TOLERANCE_POLICY,
        actionability="evidence_regeneration_required",
        recommendation=(
            "Regenerate the evidence packet after the current model revision, rule digest, "
            "renderer support matrix, target spec, and git head are all recorded."
        ),
        documentation=(
            "Sketch-to-BIM acceptance evidence becomes stale when the model revision, "
            "Advisor rule digest, renderer support matrix, seed source, target spec, or git "
            "head changes after the evidence was captured."
        ),
        ui_summary="The sketch-to-BIM evidence packet is stale for the current model.",
        cli_code="sketch_evidence_stale",
        api_field="ruleId",
        surfaces=CANONICAL_RULE_SURFACES,
        affected_id_kinds=("evidence", "snapshot", "view", "document"),
        fix_command_hints=("regenerateEvidence", "recordRuleDigest", "recordRendererDigest"),
        test_refs=DEFAULT_RULE_TEST_REFS,
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-T04"),
        priority="P0",
        examples=("Evidence was captured before the current git head or Advisor rule digest.",),
    ),
)

CANONICAL_RULE_TAXONOMY_FAMILIES: tuple[RuleTaxonomyFamily, ...] = (
    RuleTaxonomyFamily(
        family_id="explicit_registry",
        title="Explicit canonical registry rule",
        match_prefixes=(),
        match_exact=tuple(rule.rule_id for rule in ADVISOR_RULES),
        severity="error",
        layer_owner="model_integrity",
        discipline="platform",
        perspective="platform",
        profiles=("model_integrity", "construction_readiness", "agent_preflight"),
        severity_policy="p0_integrity_error",
        suppressibility="not_suppressible",
        actionability="modeled_fix_required",
        affected_id_kinds=("element", "document"),
        fix_command_hints=("useExplicitRuleMetadata",),
        tracker_items=("BIR-A02",),
        priority="P0",
        recommendation="Use the explicit canonical AdvisorRule metadata for this rule id.",
    ),
    RuleTaxonomyFamily(
        family_id="authoring_validation",
        title="Authoring validation",
        match_prefixes=("opening_", "create_", "update_", "delete_", "place_", "move_"),
        match_exact=("door_off_wall", "wall_missing_level", "floor_missing_level"),
        severity="error",
        layer_owner="authoring_validation",
        discipline="architecture",
        perspective="architecture",
        profiles=("model_integrity", "architecture", "agent_preflight"),
        severity_policy="p0_integrity_error",
        suppressibility="not_suppressible",
        actionability="modeled_fix_required",
        affected_id_kinds=("element", "host", "level", "command"),
        fix_command_hints=("rejectCommand", "repairCommandPayload", "selectValidHost"),
        tracker_items=("BIR-B01", "BIR-B04", "BIR-B05"),
        priority="P0",
        recommendation="Reject or repair the authoring command before committing invalid geometry.",
    ),
    RuleTaxonomyFamily(
        family_id="model_integrity_architecture",
        title="Architectural model integrity",
        match_prefixes=(
            "hosted_",
            "physical_",
            "model_integrity_",
            "wall_",
            "floor_",
            "room_",
            "stair_",
            "slab_",
            "level_",
            "grid_",
            "dimension_",
        ),
        match_exact=("bim_invariant_failure",),
        severity="error",
        layer_owner="model_integrity",
        discipline="architecture",
        perspective="architecture",
        profiles=("model_integrity", "architecture", "construction_readiness", "agent_preflight"),
        severity_policy="p0_integrity_error",
        suppressibility="tolerable_with_evidence",
        actionability="modeled_fix_required",
        affected_id_kinds=("element", "host", "level", "room", "floor"),
        fix_command_hints=("repairModelGeometry", "rehostElement", "addMissingSupport"),
        tracker_items=("BIR-C01", "BIR-D03", "BIR-E01", "BIR-P01"),
        priority="P0",
        recommendation="Repair the model topology, host/support relationship, or invariant.",
    ),
    RuleTaxonomyFamily(
        family_id="constructability_profile",
        title="Constructability and code-profile finding",
        match_prefixes=(
            "constructability_",
            "clearance_",
            "egress_",
            "fire_",
            "accessibility_",
            "load_",
            "pipe_",
            "duct_",
            "mep_",
            "ids_",
        ),
        match_exact=(
            "furniture_wall_hard_clash",
            "stair_wall_hard_clash",
            "physical_hard_clash",
            "room_without_door_access",
            "room_without_egress_path",
        ),
        severity="warning",
        layer_owner="constructability",
        discipline="coordination",
        perspective="coordination",
        profiles=(
            "architecture",
            "structure",
            "mep",
            "fire",
            "accessibility",
            "construction_readiness",
        ),
        severity_policy="profile_metadata_warning",
        suppressibility="tolerable_with_evidence",
        actionability="modeled_fix_required",
        affected_id_kinds=("element", "room", "route", "profile_requirement"),
        fix_command_hints=("addRequiredMetadata", "repairClearance", "addOpeningOrSleeve"),
        tracker_items=("BIR-D07", "BIR-G01", "BIR-U03"),
        priority="P1",
        recommendation=(
            "Resolve the profile-specific constructability issue or record an audited tolerance."
        ),
    ),
    RuleTaxonomyFamily(
        family_id="renderer_diagnostics",
        title="Renderer diagnostic",
        match_prefixes=(
            "renderer_",
            "render_",
            "roof_opening_render_",
            "wall_cut_",
            "gltf_render_",
        ),
        match_exact=("renderer_unsupported_cut", "renderer_failed_cut"),
        severity="error",
        layer_owner="renderer_diagnostics",
        discipline="renderer",
        perspective="renderer",
        profiles=("renderer_fidelity", "construction_readiness", "sketch_acceptance"),
        severity_policy="p0_renderer_fidelity_error",
        suppressibility="tolerable_with_evidence",
        actionability="implementation_or_view_change_required",
        affected_id_kinds=("element", "view", "renderer_feature"),
        fix_command_hints=(
            "addRendererSupport",
            "captureDiagnosticView",
            "markRendererUnsupported",
        ),
        tracker_items=("BIR-I02", "BIR-J09"),
        priority="P0",
        recommendation=(
            "Add renderer support or use a diagnostic view that explicitly records the limitation."
        ),
    ),
    RuleTaxonomyFamily(
        family_id="exchange_documentation",
        title="Exchange and documentation fidelity",
        match_prefixes=(
            "exchange_",
            "ifc_",
            "gltf_",
            "dxf_",
            "schedule_",
            "sheet_",
            "plan_view_sheet_",
            "evidence_package_",
        ),
        match_exact=("export_readback_drift",),
        severity="warning",
        layer_owner="constructability",
        discipline="exchange",
        perspective="exchange",
        profiles=("exchange", "documentation", "construction_readiness"),
        severity_policy="profile_metadata_warning",
        suppressibility="tolerable_with_evidence",
        actionability="evidence_regeneration_required",
        affected_id_kinds=("element", "schedule", "sheet", "view", "artifact"),
        fix_command_hints=(
            "regenerateExportEvidence",
            "repairScheduleOrSheet",
            "addReadbackMapping",
        ),
        tracker_items=("BIR-K01", "BIR-K02", "BIR-R05"),
        priority="P1",
        recommendation=(
            "Refresh or repair exchange/documentation evidence until readback and source "
            "rows agree."
        ),
    ),
    RuleTaxonomyFamily(
        family_id="sketch_methodology",
        title="Sketch-to-BIM methodology acceptance",
        match_prefixes=(
            "sketch_",
            "semantic_",
            "source_feature_",
            "assumption_",
            "target_house_",
        ),
        match_exact=("sketch_evidence_stale",),
        severity="error",
        layer_owner="sketch_acceptance",
        discipline="sketch",
        perspective="sketch",
        profiles=("sketch_acceptance", "agent_preflight"),
        severity_policy="p0_sketch_acceptance_error",
        suppressibility="not_suppressible",
        actionability="evidence_regeneration_required",
        affected_id_kinds=("evidence", "feature", "view", "snapshot"),
        fix_command_hints=(
            "regenerateEvidence",
            "mapSourceFeature",
            "recordAcceptanceDisposition",
        ),
        tracker_items=("BIR-M03", "BIR-T01", "BIR-T04"),
        priority="P0",
        recommendation=(
            "Regenerate methodology evidence and resolve source-feature or semantic "
            "acceptance blockers."
        ),
    ),
    RuleTaxonomyFamily(
        family_id="platform_transaction",
        title="Platform transaction and provenance",
        match_prefixes=(
            "transaction_",
            "undo_",
            "redo_",
            "collaboration_",
            "provenance_",
        ),
        match_exact=("stale_reference",),
        severity="error",
        layer_owner="model_integrity",
        discipline="platform",
        perspective="platform",
        profiles=("model_integrity", "agent_preflight"),
        severity_policy="p0_integrity_error",
        suppressibility="not_suppressible",
        actionability="modeled_fix_required",
        affected_id_kinds=("transaction", "command", "element", "document"),
        fix_command_hints=(
            "rollbackTransaction",
            "repairReferences",
            "replayWithPreflight",
        ),
        tracker_items=("BIR-Q01", "BIR-T02"),
        priority="P0",
        recommendation=(
            "Repair or replay the transaction with preflight, provenance, and undo/redo "
            "metadata intact."
        ),
    ),
    RuleTaxonomyFamily(
        family_id="general_review",
        title="General Advisor review",
        match_prefixes=(),
        match_exact=(),
        severity="warning",
        layer_owner="constructability",
        discipline="coordination",
        perspective="coordination",
        profiles=("architecture", "construction_readiness"),
        severity_policy="profile_metadata_warning",
        suppressibility="tolerable_with_evidence",
        actionability="modeled_fix_required",
        affected_id_kinds=("element", "document"),
        fix_command_hints=("reviewFinding", "recordTolerance", "repairModel"),
        tracker_items=("BIR-A02", "BIR-U05"),
        priority="P1",
        recommendation="Review the finding, then repair the model or record an audited tolerance.",
    ),
)


def advisor_rule_registry() -> tuple[AdvisorRule, ...]:
    return ADVISOR_RULES


def advisor_rule_by_id(rule_id: str) -> AdvisorRule:
    for rule in ADVISOR_RULES:
        if rule.rule_id == rule_id:
            return rule
    raise KeyError(rule_id)


def advisor_rules_for_profile(profile: str) -> tuple[AdvisorRule, ...]:
    return tuple(rule for rule in ADVISOR_RULES if profile in rule.profiles)


def advisor_rule_payloads() -> list[dict[str, object]]:
    return [rule.to_dict() for rule in ADVISOR_RULES]


def canonical_taxonomy_family_for(rule_id: str) -> RuleTaxonomyFamily:
    for family in CANONICAL_RULE_TAXONOMY_FAMILIES:
        if family.family_id == "explicit_registry":
            continue
        if family.matches(rule_id):
            return family
    return CANONICAL_RULE_TAXONOMY_FAMILIES[-1]


def canonical_rule_metadata_for(
    rule_id: str,
    *,
    severity: str | None = None,
    tracker_items: tuple[str, ...] = (),
) -> dict[str, object]:
    try:
        return advisor_rule_by_id(rule_id).to_dict()
    except KeyError:
        family = canonical_taxonomy_family_for(rule_id)
        resolved_severity = severity if severity in ALLOWED_SEVERITIES else family.severity
        tolerance_policy = (
            EVIDENCE_TOLERANCE_POLICY
            if family.suppressibility == "tolerable_with_evidence"
            else NO_TOLERANCE_POLICY
        )
        return {
            "ruleId": rule_id,
            "title": _title_from_rule_id(rule_id),
            "severity": resolved_severity,
            "layerOwner": family.layer_owner,
            "discipline": family.discipline,
            "perspective": family.perspective,
            "profiles": list(family.profiles),
            "sourceLayer": family.layer_owner,
            "severityPolicy": family.severity_policy,
            "suppressibility": family.suppressibility,
            "tolerancePolicy": tolerance_policy.to_dict(),
            "actionability": family.actionability,
            "recommendation": family.recommendation,
            "documentation": (
                f"{family.title} taxonomy fallback for emitted rule `{rule_id}`. "
                "Add an explicit AdvisorRule entry when a rule needs narrower metadata."
            ),
            "uiSummary": _title_from_rule_id(rule_id),
            "cliCode": rule_id,
            "apiField": "ruleId",
            "surfaces": list(CANONICAL_RULE_SURFACES),
            "affectedIdKinds": list(family.affected_id_kinds),
            "fixCommandHints": list(family.fix_command_hints),
            "testRefs": list(DEFAULT_RULE_TEST_REFS),
            "trackerItems": list(tracker_items or family.tracker_items),
            "priority": family.priority,
            "examples": [
                f"Emitted rule id `{rule_id}` matched taxonomy family `{family.family_id}`."
            ],
            "status": "planned",
            "taxonomyFamily": family.family_id,
        }


def advisor_rule_catalog_payload(
    *,
    profile: str | None = None,
    surface: str | None = None,
) -> dict[str, object]:
    rules = ADVISOR_RULES
    if profile:
        rules = tuple(rule for rule in rules if profile in rule.profiles)
    if surface:
        rules = tuple(rule for rule in rules if surface in rule.surfaces)
    rule_payloads = [rule.to_dict() for rule in rules]
    return {
        "format": "advisorRuleCatalog_v1",
        "schemaVersion": "advisor-rule-registry.v1",
        "source": "app/bim_ai/advisor_rule_registry.py",
        "filters": {"profile": profile, "surface": surface},
        "summary": {
            "ruleCount": len(rule_payloads),
            "canonicalRuleCount": len(ADVISOR_RULES),
            "taxonomyFamilyCount": len(CANONICAL_RULE_TAXONOMY_FAMILIES),
            "coverageMode": "explicit_rules_plus_taxonomy_fallback",
            "surfaces": list(CANONICAL_RULE_SURFACES),
            "rulesBySurface": {
                name: sum(1 for rule in ADVISOR_RULES if name in rule.surfaces)
                for name in CANONICAL_RULE_SURFACES
            },
        },
        "rules": rule_payloads,
        "taxonomyFamilies": [family.to_dict() for family in CANONICAL_RULE_TAXONOMY_FAMILIES],
    }


def validate_advisor_rule_registry(rules: tuple[AdvisorRule, ...] = ADVISOR_RULES) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for rule in rules:
        prefix = rule.rule_id or "<missing rule_id>"
        if not rule.rule_id:
            errors.append("rule missing rule_id")
        if rule.rule_id in seen:
            errors.append(f"{rule.rule_id}: duplicate rule_id")
        seen.add(rule.rule_id)
        for field_name in (
            "title",
            "recommendation",
            "documentation",
            "ui_summary",
            "cli_code",
            "api_field",
        ):
            value = getattr(rule, field_name)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{prefix}: missing {field_name}")
        if rule.severity not in ALLOWED_SEVERITIES:
            errors.append(f"{prefix}: invalid severity {rule.severity!r}")
        if rule.layer_owner not in ALLOWED_LAYER_OWNERS:
            errors.append(f"{prefix}: invalid layer_owner {rule.layer_owner!r}")
        if rule.discipline not in ALLOWED_DISCIPLINES:
            errors.append(f"{prefix}: invalid discipline {rule.discipline!r}")
        if rule.perspective not in ALLOWED_PERSPECTIVES:
            errors.append(f"{prefix}: invalid perspective {rule.perspective!r}")
        if rule.suppressibility not in ALLOWED_SUPPRESSIBILITY:
            errors.append(f"{prefix}: invalid suppressibility {rule.suppressibility!r}")
        if rule.source_layer not in ALLOWED_LAYER_OWNERS:
            errors.append(f"{prefix}: invalid source_layer {rule.source_layer!r}")
        if rule.source_layer != rule.layer_owner:
            errors.append(f"{prefix}: source_layer must match layer_owner")
        if rule.actionability not in ALLOWED_ACTIONABILITY:
            errors.append(f"{prefix}: invalid actionability {rule.actionability!r}")
        if rule.severity_policy not in ALLOWED_SEVERITY_POLICIES:
            errors.append(f"{prefix}: invalid severity_policy {rule.severity_policy!r}")
        if rule.status not in ALLOWED_STATUSES:
            errors.append(f"{prefix}: invalid status {rule.status!r}")
        if rule.priority not in ALLOWED_PRIORITIES:
            errors.append(f"{prefix}: invalid priority {rule.priority!r}")
        if not rule.profiles:
            errors.append(f"{prefix}: missing profiles")
        if not rule.affected_id_kinds:
            errors.append(f"{prefix}: missing affected_id_kinds")
        if not rule.fix_command_hints:
            errors.append(f"{prefix}: missing fix_command_hints")
        if not rule.examples:
            errors.append(f"{prefix}: missing examples")
        if not rule.surfaces:
            errors.append(f"{prefix}: missing surfaces")
        for surface in rule.surfaces:
            if surface not in ALLOWED_SURFACES:
                errors.append(f"{prefix}: invalid surface {surface!r}")
        if set(rule.surfaces) != set(CANONICAL_RULE_SURFACES):
            errors.append(f"{prefix}: must declare all canonical UI/API/CLI/MCP/doc surfaces")
        if not rule.test_refs:
            errors.append(f"{prefix}: missing test_refs")
        if not rule.tracker_items:
            errors.append(f"{prefix}: missing tracker_items")
        if (
            rule.priority == "P0"
            and rule.layer_owner
            in {
                "authoring_validation",
                "model_integrity",
                "renderer_diagnostics",
                "sketch_acceptance",
            }
            and rule.severity != "error"
        ):
            errors.append(f"{prefix}: P0 {rule.layer_owner} rule must be error severity")
        if rule.layer_owner == "sketch_acceptance" and rule.severity == "info":
            errors.append(f"{prefix}: sketch acceptance blocker cannot be info severity")
        if rule.severity_policy.startswith("p0_") and rule.severity != "error":
            errors.append(f"{prefix}: {rule.severity_policy} must be error severity")
        policy = rule.tolerance_policy
        if rule.suppressibility == "tolerable_with_evidence" and not (
            policy.requires_owner and policy.requires_expiry and policy.requires_evidence
        ):
            errors.append(f"{prefix}: tolerable_with_evidence requires owner, expiry, and evidence")
        if rule.suppressibility == "not_suppressible" and (
            policy.requires_owner or policy.requires_expiry or policy.requires_evidence
        ):
            errors.append(f"{prefix}: not_suppressible cannot declare tolerance requirements")
    return sorted(errors)


def validate_canonical_rule_taxonomy(
    families: tuple[RuleTaxonomyFamily, ...] = CANONICAL_RULE_TAXONOMY_FAMILIES,
) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for family in families:
        prefix = family.family_id or "<missing family_id>"
        if not family.family_id:
            errors.append("taxonomy family missing family_id")
        if family.family_id in seen:
            errors.append(f"{family.family_id}: duplicate family_id")
        seen.add(family.family_id)
        for field_name in ("title", "recommendation"):
            value = getattr(family, field_name)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{prefix}: missing {field_name}")
        if family.severity not in ALLOWED_SEVERITIES:
            errors.append(f"{prefix}: invalid severity {family.severity!r}")
        if family.layer_owner not in ALLOWED_LAYER_OWNERS:
            errors.append(f"{prefix}: invalid layer_owner {family.layer_owner!r}")
        if family.discipline not in ALLOWED_DISCIPLINES:
            errors.append(f"{prefix}: invalid discipline {family.discipline!r}")
        if family.perspective not in ALLOWED_PERSPECTIVES:
            errors.append(f"{prefix}: invalid perspective {family.perspective!r}")
        if family.suppressibility not in ALLOWED_SUPPRESSIBILITY:
            errors.append(f"{prefix}: invalid suppressibility {family.suppressibility!r}")
        if family.actionability not in ALLOWED_ACTIONABILITY:
            errors.append(f"{prefix}: invalid actionability {family.actionability!r}")
        if family.severity_policy not in ALLOWED_SEVERITY_POLICIES:
            errors.append(f"{prefix}: invalid severity_policy {family.severity_policy!r}")
        if family.priority not in ALLOWED_PRIORITIES:
            errors.append(f"{prefix}: invalid priority {family.priority!r}")
        if not family.profiles:
            errors.append(f"{prefix}: missing profiles")
        if not family.affected_id_kinds:
            errors.append(f"{prefix}: missing affected_id_kinds")
        if not family.fix_command_hints:
            errors.append(f"{prefix}: missing fix_command_hints")
        if not family.tracker_items:
            errors.append(f"{prefix}: missing tracker_items")
        if (
            family.priority == "P0"
            and family.layer_owner
            in {
                "authoring_validation",
                "model_integrity",
                "renderer_diagnostics",
                "sketch_acceptance",
            }
            and family.severity != "error"
        ):
            errors.append(f"{prefix}: P0 {family.layer_owner} family must be error severity")
        if family.severity_policy.startswith("p0_") and family.severity != "error":
            errors.append(f"{prefix}: {family.severity_policy} must be error severity")
    if not families or families[-1].family_id != "general_review":
        errors.append("taxonomy must end with general_review fallback family")
    return sorted(errors)


def render_advisor_rule_ledger(rules: tuple[AdvisorRule, ...] = ADVISOR_RULES) -> str:
    lines = [
        "# Advisor Rule Ledger",
        "",
        "Generated from `app/bim_ai/advisor_rule_registry.py`.",
        "",
        "| Rule ID | Severity | Policy | Layer | Discipline | Profiles | Surfaces | "
        "Suppressibility | Actionability | Status | Tracker |",
        "| ------- | -------- | ------ | ----- | ---------- | -------- | -------- | "
        "--------------- | ------------- | ------ | ------- |",
    ]
    for rule in rules:
        lines.append(
            "| "
            + " | ".join(
                [
                    f"`{rule.rule_id}`",
                    rule.severity,
                    rule.severity_policy,
                    rule.layer_owner,
                    rule.discipline,
                    ", ".join(f"`{profile}`" for profile in rule.profiles),
                    ", ".join(f"`{surface}`" for surface in rule.surfaces),
                    rule.suppressibility,
                    rule.actionability,
                    rule.status,
                    ", ".join(f"`{item}`" for item in rule.tracker_items),
                ]
            )
            + " |"
        )
    lines.extend(["", "## Rule Details", ""])
    for rule in rules:
        lines.extend(
            [
                f"### `{rule.rule_id}`",
                "",
                f"**Title:** {rule.title}",
                "",
                f"**UI summary:** {rule.ui_summary}",
                "",
                f"**Source layer:** {rule.source_layer}",
                "",
                f"**Severity policy:** {rule.severity_policy}",
                "",
                f"**Surfaces:** {', '.join(rule.surfaces)}",
                "",
                f"**Status:** {rule.status}",
                "",
                f"**Recommendation:** {rule.recommendation}",
                "",
                f"**Documentation:** {rule.documentation}",
                "",
                f"**Examples:** {'; '.join(rule.examples)}",
                "",
                f"**Affected ids:** {', '.join(rule.affected_id_kinds)}",
                "",
                f"**Fix command hints:** {', '.join(rule.fix_command_hints)}",
                "",
                f"**Tests:** {', '.join(rule.test_refs)}",
                "",
            ]
        )
    lines.extend(["", "## Taxonomy Families", ""])
    lines.extend(
        [
            "| Family | Layer | Discipline | Severity | Profiles | Match | Tracker |",
            "| ------ | ----- | ---------- | -------- | -------- | ----- | ------- |",
        ]
    )
    for family in CANONICAL_RULE_TAXONOMY_FAMILIES:
        matchers = [*family.match_exact, *[f"{prefix}*" for prefix in family.match_prefixes]]
        lines.append(
            "| "
            + " | ".join(
                [
                    f"`{family.family_id}`",
                    family.layer_owner,
                    family.discipline,
                    family.severity,
                    ", ".join(f"`{profile}`" for profile in family.profiles),
                    ", ".join(f"`{matcher}`" for matcher in matchers) or "`<fallback>`",
                    ", ".join(f"`{item}`" for item in family.tracker_items),
                ]
            )
            + " |"
        )
    return "\n".join(lines).rstrip() + "\n"
