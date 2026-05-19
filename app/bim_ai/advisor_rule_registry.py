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


@dataclass(frozen=True, slots=True)
class AdvisorRule:
    rule_id: str
    title: str
    severity: Severity
    layer_owner: LayerOwner
    discipline: Discipline
    perspective: Perspective
    profiles: tuple[str, ...]
    suppressibility: Suppressibility
    recommendation: str
    documentation: str
    ui_summary: str
    cli_code: str
    api_field: str
    affected_id_kinds: tuple[str, ...]
    fix_command_hints: tuple[str, ...]
    tracker_items: tuple[str, ...]
    priority: Priority
    status: RuleStatus = "planned"

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["ruleId"] = data.pop("rule_id")
        data["layerOwner"] = data.pop("layer_owner")
        data["uiSummary"] = data.pop("ui_summary")
        data["cliCode"] = data.pop("cli_code")
        data["apiField"] = data.pop("api_field")
        data["affectedIdKinds"] = data.pop("affected_id_kinds")
        data["fixCommandHints"] = data.pop("fix_command_hints")
        data["trackerItems"] = data.pop("tracker_items")
        return data


ADVISOR_RULES: tuple[AdvisorRule, ...] = (
    AdvisorRule(
        rule_id="bim_invariant_failure",
        title="BIM Document Invariant Failure",
        severity="error",
        layer_owner="model_integrity",
        discipline="platform",
        perspective="platform",
        profiles=("model_integrity", "construction_readiness", "agent_preflight"),
        suppressibility="not_suppressible",
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
        affected_id_kinds=("element", "level", "type", "document"),
        fix_command_hints=("repairReferences", "normalizeDocument", "rollbackTransaction"),
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-P01"),
        priority="P0",
    ),
    AdvisorRule(
        rule_id="host_wall_outside_envelope",
        title="Physical Host Wall Outside Building Envelope",
        severity="error",
        layer_owner="model_integrity",
        discipline="architecture",
        perspective="architecture",
        profiles=("model_integrity", "architecture", "construction_readiness", "agent_preflight"),
        suppressibility="tolerable_with_evidence",
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
        affected_id_kinds=("wall", "door", "window", "floor", "level"),
        fix_command_hints=("moveWallIntoEnvelope", "addDetachedCondition", "convertToAnalysis"),
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-C02"),
        priority="P0",
    ),
    AdvisorRule(
        rule_id="hosted_door_not_embedded",
        title="Hosted Door Not Embedded In Real Wall",
        severity="error",
        layer_owner="model_integrity",
        discipline="architecture",
        perspective="architecture",
        profiles=("model_integrity", "architecture", "construction_readiness", "agent_preflight"),
        suppressibility="not_suppressible",
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
        affected_id_kinds=("door", "wall", "level", "floor"),
        fix_command_hints=("rehostDoor", "moveWallIntoEnvelope", "convertToAnalysis"),
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-C01"),
        priority="P0",
    ),
    AdvisorRule(
        rule_id="physical_helper_leakage",
        title="Physical Helper Or Analysis Element Leakage",
        severity="error",
        layer_owner="model_integrity",
        discipline="coordination",
        perspective="coordination",
        profiles=("model_integrity", "coordination", "construction_readiness", "agent_preflight"),
        suppressibility="not_suppressible",
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
        affected_id_kinds=("element", "wall", "door", "room", "analysis_object"),
        fix_command_hints=("convertToAnalysis", "hideHelper", "deleteElement", "promotePhysicalElement"),
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-B03"),
        priority="P0",
    ),
    AdvisorRule(
        rule_id="renderer_unsupported_cut",
        title="Renderer Unsupported Or Failed Geometry Cut",
        severity="error",
        layer_owner="renderer_diagnostics",
        discipline="renderer",
        perspective="renderer",
        profiles=("renderer_fidelity", "construction_readiness", "sketch_acceptance"),
        suppressibility="tolerable_with_evidence",
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
        affected_id_kinds=("element", "roof", "floor", "wall", "opening", "view"),
        fix_command_hints=("addRendererFallback", "switchEvidenceView", "markRendererUnsupported"),
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-I01", "BIR-M04"),
        priority="P0",
    ),
    AdvisorRule(
        rule_id="sketch_evidence_stale",
        title="Sketch Acceptance Evidence Stale",
        severity="error",
        layer_owner="sketch_acceptance",
        discipline="sketch",
        perspective="sketch",
        profiles=("sketch_acceptance", "agent_preflight"),
        suppressibility="not_suppressible",
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
        affected_id_kinds=("evidence", "snapshot", "view", "document"),
        fix_command_hints=("regenerateEvidence", "recordRuleDigest", "recordRendererDigest"),
        tracker_items=("BIR-A02", "BIR-A03", "BIR-A05", "BIR-T04"),
        priority="P0",
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
        if not rule.tracker_items:
            errors.append(f"{prefix}: missing tracker_items")
        if rule.priority == "P0" and rule.layer_owner in {
            "authoring_validation",
            "model_integrity",
            "renderer_diagnostics",
            "sketch_acceptance",
        } and rule.severity != "error":
            errors.append(f"{prefix}: P0 {rule.layer_owner} rule must be error severity")
        if rule.layer_owner == "sketch_acceptance" and rule.severity == "info":
            errors.append(f"{prefix}: sketch acceptance blocker cannot be info severity")
    return sorted(errors)


def render_advisor_rule_ledger(rules: tuple[AdvisorRule, ...] = ADVISOR_RULES) -> str:
    lines = [
        "# Advisor Rule Ledger",
        "",
        "Generated from `app/bim_ai/advisor_rule_registry.py`.",
        "",
        "| Rule ID | Severity | Layer | Discipline | Profiles | Suppressibility | Tracker |",
        "| ------- | -------- | ----- | ---------- | -------- | --------------- | ------- |",
    ]
    for rule in rules:
        lines.append(
            "| "
            + " | ".join(
                [
                    f"`{rule.rule_id}`",
                    rule.severity,
                    rule.layer_owner,
                    rule.discipline,
                    ", ".join(f"`{profile}`" for profile in rule.profiles),
                    rule.suppressibility,
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
                f"**Recommendation:** {rule.recommendation}",
                "",
                f"**Documentation:** {rule.documentation}",
                "",
                f"**Affected ids:** {', '.join(rule.affected_id_kinds)}",
                "",
                f"**Fix command hints:** {', '.join(rule.fix_command_hints)}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"
