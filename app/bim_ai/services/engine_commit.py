from __future__ import annotations

from typing import Any

from bim_ai.engine import (
    _AUTHORITATIVE_REPLAY_V0_TYPES,
    AUTHORITATIVE_REPLAY_KIND_V0,
    KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
    Command,
    Document,
    Element,
    PlanViewElem,
    SourceDocProvider,
    UnbindViewTemplateCmd,
    UpdateViewTemplateCmd,
    Violation,
    apply_inplace,
    bundle_replay_diagnostics,
    clone_document,
    coerce_command,
    ensure_internal_origin,
    ensure_sun_settings,
    evaluate,
)
from bim_ai.model_integrity_hosting import (
    hosted_opening_integrity_violations,
    physical_support_context_violations,
)


def diff_undo_cmds(prev_doc: Document, next_doc: Document) -> list[dict[str, Any]]:
    cmds: list[dict[str, Any]] = []

    prev_ids = set(prev_doc.elements.keys())
    next_ids = set(next_doc.elements.keys())

    def delete_rank(eid: str) -> tuple[int, str]:
        el = next_doc.elements[eid]
        if getattr(el, "kind", None) in {"door", "window", "wall_opening"}:
            return (0, eid)
        if getattr(el, "kind", None) == "wall":
            return (2, eid)
        return (1, eid)

    delete_ids = sorted(next_ids - prev_ids, key=delete_rank)
    for nid in delete_ids:
        cmds.append({"type": "deleteElement", "elementId": nid})

    for pid in sorted(prev_ids.union(next_ids)):
        pv = prev_doc.elements.get(pid)
        nx = next_doc.elements.get(pid)
        if nx != pv and pv is not None:
            cmds.append({"type": "restoreElement", "element": pv.model_dump(by_alias=True)})
    return cmds


def compute_delta_wire(
    prev_doc: Document,
    next_doc: Document,
    *,
    violations: list[Violation] | None = None,
    validation_scope: str = "full",
) -> dict[str, Any]:
    """Build the WS delta payload for next_doc.

    PERF-B07: ``validation_scope='blocking_only'`` stamps the wire
    payload with the matching scope flag so the FE applyDelta path
    preserves prior info-level violations rather than dropping them on
    replace.  Default ``'full'`` matches the long-standing contract —
    callers that pass a precomputed ``violations`` list which still
    includes all info advisors should leave the default alone.
    """

    removed_ids = sorted(prev_doc.elements.keys() - next_doc.elements.keys())
    elements_patch: dict[str, Any] = {}
    next_ids_all = next_doc.elements.keys()
    prev_ids_all = prev_doc.elements.keys()
    union = sorted(set(next_ids_all) | set(prev_ids_all))
    for eid in union:
        p = prev_doc.elements.get(eid)
        n = next_doc.elements.get(eid)
        if n is None:
            continue
        if n != p:
            elements_patch[eid] = n.model_dump(by_alias=True)

    payload: dict[str, Any] = {
        "revision": next_doc.revision,
        "removedIds": removed_ids,
        "elements": elements_patch,
        "violations": [
            v.model_dump(by_alias=True)
            for v in (violations if violations is not None else _commit_violations(next_doc))
        ],
    }
    if validation_scope != "full":
        payload["validationScope"] = validation_scope
    return payload


def first_blocking_command_index_after_prefixes(doc: Document, cmds: list[Command]) -> int | None:
    """First apply index (0-based) where accumulated model hits a blocking/error violation."""

    cand = clone_document(doc)
    for i, cmd in enumerate(cmds):
        apply_inplace(cand, cmd)
        violations = _commit_violations(cand)
        blocking = [v for v in violations if v.blocking or v.severity == "error"]
        if blocking:
            return i
    return None


def blocking_violation_rule_ids_at_prefix(
    doc: Document, cmds: list[Command], idx: int
) -> list[str]:
    """Sorted unique rule ids from blocking/error violations after cmds[0..idx] inclusive."""

    cand = clone_document(doc)
    for i in range(idx + 1):
        apply_inplace(cand, cmds[i])
    violations = _commit_violations(cand)
    blocking = [v for v in violations if v.blocking or v.severity == "error"]
    return sorted({v.rule_id for v in blocking})


def blocking_violation_element_ids_at_prefix(
    doc: Document, cmds: list[Command], idx: int
) -> list[str]:
    """Sorted unique element ids from blocking/error violations after cmds[0..idx] inclusive."""

    cand = clone_document(doc)
    for i in range(idx + 1):
        apply_inplace(cand, cmds[i])
    violations = _commit_violations(cand)
    blocking = [v for v in violations if v.blocking or v.severity == "error"]
    ids: set[str] = set()
    for v in blocking:
        ids.update(v.element_ids)
    return sorted(ids)


def replay_bundle_diagnostics_for_outcome(
    doc: Document,
    cmds_raw: list[dict[str, Any]],
    *,
    outcome_code: str,
) -> dict[str, Any]:
    """Augment ordering metadata after a bundle try; adds conflict index on constraint failures."""

    base = bundle_replay_diagnostics(cmds_raw)
    if outcome_code != "constraint_error":
        return base
    try:
        cmds = [coerce_command(c) for c in cmds_raw]
    except Exception:
        return base
    idx = first_blocking_command_index_after_prefixes(doc, cmds)
    if idx is not None:
        rule_ids = blocking_violation_rule_ids_at_prefix(doc, cmds, idx)
        budget_raw = base.get("replayPerformanceBudget_v1")
        budget_merged = (
            {**budget_raw, "firstBlockingCommandIndex": idx}
            if isinstance(budget_raw, dict)
            else budget_raw
        )
        return {
            **base,
            "firstBlockingCommandIndex": idx,
            "blockingViolationRuleIds": rule_ids,
            "replayPerformanceBudget_v1": budget_merged,
        }
    return base


def _blocking_violation_signature(v: Violation) -> tuple[str, tuple[str, ...]]:
    return (v.rule_id, tuple(sorted(v.element_ids)))


def _new_blocking_violations(
    before: list[Violation],
    after: list[Violation],
) -> list[Violation]:
    before_blocking = {
        _blocking_violation_signature(v) for v in before if v.blocking or v.severity == "error"
    }
    return [
        v
        for v in after
        if (v.blocking or v.severity == "error")
        and _blocking_violation_signature(v) not in before_blocking
    ]


def _has_blocking_violations(violations: list[Violation]) -> bool:
    return any(v.blocking or v.severity == "error" for v in violations)


def _commit_violations(doc: Document, *, documentation_advisors: bool = True) -> list[Violation]:
    """Validation surface used by dry-run, commit, and commit deltas.

    PERF-B07: pass ``documentation_advisors=False`` to skip the
    info-level advisor passes (see PERF-C09 gate in
    :func:`bim_ai.constraints_evaluation.evaluate`). The two hosted-
    integrity passes always run because they emit error/blocking rows
    that callers rely on for rollback.
    """

    return (
        evaluate(doc.elements, documentation_advisors=documentation_advisors)
        + hosted_opening_integrity_violations(doc)
        + physical_support_context_violations(doc)
    )


# PERF-B07: commands whose effect is local enough that documentation
# advisor passes can be skipped at commit time. Each command in this
# allowlist only edits one element + its host: dropping the docs
# advisors during commit doesn't lose blocking/error context, and the
# FE preserves prior info violations through the validationScope
# 'blocking_only' delta flag.
_FAST_PATH_COMMAND_TYPES: frozenset[str] = frozenset(
    {
        "insertDoorOnWall",
        "insertWindowOnWall",
        "createWallOpening",
        "moveWallEndpoints",
        "moveWallDelta",
    }
)


def _command_supports_fast_validation_path(cmd_raw: dict[str, Any]) -> bool:
    raw_type = cmd_raw.get("type") if isinstance(cmd_raw, dict) else None
    return isinstance(raw_type, str) and raw_type in _FAST_PATH_COMMAND_TYPES


def command_supports_fast_validation_path(cmd_raw: dict[str, Any]) -> bool:
    """Public alias for routes that need to stamp `validationScope` on
    the delta payload when the command used the fast-path commit."""

    return _command_supports_fast_validation_path(cmd_raw)


# PERF-CQ-02: schema-altering command verbs. These mutate document-wide
# structures (schedule definitions, view templates, design-option sets,
# family-type catalog, material palettes, phases, brand templates,
# property definitions, exchange packages, color-fill legends, monitored
# source-view evidence) that the documentation advisors read across the
# entire element graph. Even when only one such command is committed at
# a time, its effect on the advisor surface is global, so we must NOT
# skip the documentation advisor passes for these verbs.
_SCHEMA_ALTERING_COMMAND_TYPES: frozenset[str] = frozenset(
    {
        # Schedule catalog (drives schedule_on_sheet advisors)
        "upsertSchedule",
        "upsertScheduleFilters",
        "create_schedule_view",
        # View templates (drives plan-view-tag-style + section-on-sheet)
        "CreateViewTemplate",
        "UpdateViewTemplate",
        "DeleteViewTemplate",
        "ApplyViewTemplate",
        "UnbindViewTemplate",
        "upsertViewTemplate",
        "upsertPlanViewTemplate",
        "applyPlanViewTemplate",
        # Design options & phases (drives constructability + agent brief)
        "createOptionSet",
        "addOption",
        "removeOption",
        "setPrimaryOption",
        "setViewOptionLock",
        "assignElementToOption",
        "createPhase",
        "deletePhase",
        "renamePhase",
        "reorderPhase",
        "setElementPhase",
        "setViewPhase",
        "setViewPhaseFilter",
        # Family / type catalog (drives constructability + exchange)
        "upsertFamilyType",
        "assignOpeningFamily",
        "placeFamilyInstance",
        # Property definitions & material palette (drives exchange + room color)
        "create_property_definition",
        "update_material_pbr",
        "createColorFillLegend",
        # Brand templates (drives section-on-sheet)
        "create_brand_template",
        "update_brand_template",
        "delete_brand_template",
        # Exchange / monitored source drift (drives exchange + monitored drift)
        "applyExchangePackage",
        "bumpMonitoredRevisions",
        "reconcileMonitoredElement",
        "upsertSourceViewEvidence",
        # Agent / coordination annotations the agent-brief advisor reads
        "createAgentAssumption",
        "createAgentDeviation",
    }
)


def _command_is_schema_altering(cmd_raw: dict[str, Any]) -> bool:
    """PERF-CQ-02: True if the command verb mutates a document-wide
    schema/catalog that the documentation advisor passes scan globally.

    Schema-altering commands MUST keep ``documentation_advisors=True``
    even when committed singly, because the advisor surface they affect
    is not bounded to the single element id named in the command.
    """
    raw_type = cmd_raw.get("type") if isinstance(cmd_raw, dict) else None
    return isinstance(raw_type, str) and raw_type in _SCHEMA_ALTERING_COMMAND_TYPES


def _command_is_single_element_safe(cmd_raw: dict[str, Any]) -> bool:
    """PERF-CQ-02: True when a single command can commit without re-running
    the documentation advisor passes.

    A command qualifies when it is NOT in the schema-altering denylist —
    everything else either touches a single element id or a single
    host+child pair, both of which the advisor surface treats as local.
    The existing fast-path allowlist (``_FAST_PATH_COMMAND_TYPES``) is a
    strict subset of this gate.
    """
    if not isinstance(cmd_raw, dict):
        return False
    raw_type = cmd_raw.get("type")
    if not isinstance(raw_type, str):
        return False
    return not _command_is_schema_altering(cmd_raw)


def command_skips_documentation_advisors(cmd_raw: dict[str, Any]) -> bool:
    """PERF-CQ-02 public alias: True when ``try_commit`` will skip the nine
    documentation advisor passes for this command.

    Route handlers use this to stamp the delta-wire ``validationScope``
    flag so the FE preserves prior info-level violations rather than
    dropping them on replace. Mirrors the gate ``try_commit`` consults
    internally (``_command_is_single_element_safe``).
    """
    return _command_is_single_element_safe(cmd_raw)


def _bundle_is_single_element_safe(cmds_raw: list[dict[str, Any]]) -> bool:
    """PERF-CQ-02: True when an entire bundle can commit without re-running
    the documentation advisor passes.

    Qualifying bundles either:
    - contain exactly one command that itself passes
      ``_command_is_single_element_safe``, or
    - contain multiple commands that all target the same element id and
      none of which are schema-altering verbs.

    Multi-element bundles always re-run advisors (the surface they touch
    is broader than the gate can prove safe to skip).
    """
    if not cmds_raw:
        return False
    if any(_command_is_schema_altering(c) for c in cmds_raw):
        return False
    if len(cmds_raw) == 1:
        return _command_is_single_element_safe(cmds_raw[0])
    target_ids: set[str] = set()
    for cmd in cmds_raw:
        if not isinstance(cmd, dict):
            return False
        cmd_id = _command_primary_element_id(cmd)
        if cmd_id is None:
            return False
        target_ids.add(cmd_id)
        if len(target_ids) > 1:
            return False
    return len(target_ids) == 1


# Field names that nominate the primary element id a command targets.
# Used by ``_bundle_is_single_element_safe`` to detect multi-command
# bundles that still touch a single element.
_PRIMARY_ID_FIELDS: tuple[str, ...] = (
    "id",
    "elementId",
    "wallId",
    "hostWallId",
    "hostFloorId",
    "hostRoofId",
    "targetId",
)


def _command_primary_element_id(cmd_raw: dict[str, Any]) -> str | None:
    for key in _PRIMARY_ID_FIELDS:
        value = cmd_raw.get(key)
        if isinstance(value, str) and value:
            return value
    return None


_AGENT_STRICT_COMMAND_TYPES: dict[str, tuple[str, ...]] = {
    "createWall": ("levelId", "physicalRole"),
    "createFloor": ("levelId", "physicalRole"),
    "createRoof": ("referenceLevelId", "physicalRole"),
    "createStair": ("baseLevelId", "topLevelId", "physicalRole"),
    "createRailing": ("physicalRole",),
    "insertDoorOnWall": ("wallId", "familyTypeId", "physicalRole"),
    "insertWindowOnWall": ("wallId", "familyTypeId", "physicalRole"),
    "createWallOpening": ("hostWallId", "physicalRole"),
    "createColumn": ("levelId", "materialKey", "physicalRole"),
    "createBeam": ("levelId", "materialKey", "physicalRole"),
    "PlaceAsset": ("levelId", "assetId", "physicalRole"),
    "placeFamilyInstance": ("familyTypeId", "physicalRole"),
}

_AGENT_TYPE_ALTERNATIVES: dict[str, tuple[str, ...]] = {
    "createWall": ("wallTypeId", "materialKey"),
    "createFloor": ("floorTypeId", "materialKey"),
    "createRoof": ("roofTypeId", "materialKey"),
    "createStair": ("materialSlots", "subKind"),
    "createRailing": ("hostedStairId", "hostFloorId", "hostWallId", "hostEdgeId"),
    "PlaceAsset": ("hostElementId", "placementSupport"),
    "placeFamilyInstance": ("levelId", "hostElementId", "hostViewId"),
}

_VALID_AGENT_ROLES = {"physical", "analysis"}


def _agent_authoring_preflight_violations(cmds_raw: list[dict[str, Any]]) -> list[Violation]:
    violations: list[Violation] = []
    for index, command in enumerate(cmds_raw):
        if not _is_agent_authored_command(command):
            continue
        command_type = str(command.get("type") or "")
        required = _AGENT_STRICT_COMMAND_TYPES.get(command_type)
        if required is None:
            continue
        missing = [field for field in required if not _has_explicit_value(command, field)]
        alternative_fields = _AGENT_TYPE_ALTERNATIVES.get(command_type, ())
        if alternative_fields and not any(
            _has_explicit_value(command, field) for field in alternative_fields
        ):
            missing.append("/".join(alternative_fields))
        role = _explicit_model_role(command)
        if role is not None and role not in _VALID_AGENT_ROLES:
            missing.append("physicalRole=physical|analysis")
        if missing:
            element_id = str(command.get("id") or f"command[{index}]")
            violations.append(
                Violation(
                    rule_id="agent_authoring_explicit_context_required",
                    severity="error",
                    message=(
                        f"Agent-authored {command_type} must provide explicit "
                        f"{', '.join(sorted(dict.fromkeys(missing)))}."
                    ),
                    element_ids=[element_id],
                    blocking=True,
                    quick_fix_command=_agent_context_hint(command, missing),
                    discipline="coordination",
                    blocking_class="authoring_validation",
                    trackerItems=["BIR-B06"],
                    recommendation=(
                        "Provide explicit level/host/type/material context and an intended "
                        "physical or analysis role before an agent-authored command can mutate "
                        "the BIM model."
                    ),
                    affectedElementIds=[element_id],
                    safeFixHints=[
                        {
                            "kind": "complete_agent_authoring_context",
                            "safety": "required_before_commit",
                            "required": sorted(dict.fromkeys(missing)),
                        }
                    ],
                )
            )
    return violations


def _is_agent_authored_command(command: dict[str, Any]) -> bool:
    actor = str(command.get("actor") or command.get("source") or "").strip().lower()
    if actor == "agent":
        return True
    if command.get("agentAuthored") is True:
        return True
    trace = command.get("agentTrace")
    return isinstance(trace, dict)


def _has_explicit_value(command: dict[str, Any], field: str) -> bool:
    value = command.get(field)
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict, tuple, set)):
        return bool(value)
    return True


def _explicit_model_role(command: dict[str, Any]) -> str | None:
    value = command.get("physicalRole") or command.get("modelRole") or command.get("authoringRole")
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized or None


def _agent_context_hint(command: dict[str, Any], missing: list[str]) -> dict[str, Any]:
    return {
        "type": "completeAgentAuthoringContext",
        "commandType": command.get("type"),
        "commandId": command.get("id"),
        "required": sorted(dict.fromkeys(missing)),
        "acceptedRoles": sorted(_VALID_AGENT_ROLES),
    }


def try_apply_kernel_ifc_authoritative_replay_v0(
    doc: Document,
    sketch: dict[str, Any],
) -> tuple[bool, Document | None, list[dict[str, Any]], list[Violation], str]:
    """Apply ``authoritativeReplay_v0`` commands via ``try_commit_bundle`` (additive merge).

    OpenBIM slice: ``createLevel`` / ``createFloor`` / ``createWall`` / ``createRoof`` / ``createStair`` /
    ``createRoomOutline`` / ``insertDoorOnWall`` / ``insertWindowOnWall`` /
    ``createSlabOpening`` payloads from
    ``build_kernel_ifc_authoritative_replay_sketch_v0``. Runs preflight for id collisions and
    unresolved references vs the current document plus preceding commands in the bundle. Returns raw
    command dicts that were validated (third tuple element).
    """

    if sketch.get("available") is not True:
        return False, None, [], [], "sketch_unavailable"

    if sketch.get("replayKind") != AUTHORITATIVE_REPLAY_KIND_V0:
        return False, None, [], [], "invalid_sketch"

    try:
        ver = int(sketch["schemaVersion"])
    except (KeyError, TypeError, ValueError):
        return False, None, [], [], "invalid_sketch"
    if ver != KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION:
        return False, None, [], [], "invalid_sketch"

    raw_cmds = sketch.get("commands")
    if not isinstance(raw_cmds, list):
        return False, None, [], [], "invalid_command"

    cmds_raw: list[dict[str, Any]] = []
    for item in raw_cmds:
        if not isinstance(item, dict):
            return False, None, [], [], "invalid_command"
        t = item.get("type")
        if not isinstance(t, str) or t not in _AUTHORITATIVE_REPLAY_V0_TYPES:
            return False, None, [], [], "invalid_command"
        cmds_raw.append(item)

    from bim_ai.engine_authoritative_replay import _authoritative_replay_v0_preflight

    pre = _authoritative_replay_v0_preflight(doc, cmds_raw)
    if pre is not None:
        return False, None, cmds_raw, [], pre

    ok, new_doc, _cmds, violations, code = try_commit_bundle(doc, cmds_raw)
    if not ok:
        return False, None, cmds_raw, violations, code
    return True, new_doc, cmds_raw, violations, code


def _evaluate_edt_constraint_violations(els: dict[str, Element]) -> list[Violation]:
    """EDT-02 — evaluate constraint elements against the post-apply world.

    Returns engine ``Violation`` rows for every error-severity break so
    the bundle caller can roll back. The message includes the violating
    constraint id, rule, and residual_mm so the rejection is deterministic
    without re-running the evaluator.
    """
    from bim_ai.edt.constraints import errors_only, evaluate_all

    elem_dicts = [el.model_dump(by_alias=True) for el in els.values()]
    violations = errors_only(evaluate_all(elem_dicts))
    out: list[Violation] = []
    for v in violations:
        out.append(
            Violation(
                ruleId="edt_constraint_violated",
                severity="error",
                message=(
                    f"constraint {v.constraint_id} ({v.rule}) violated: "
                    f"residual {v.residual_mm:.1f}mm — {v.message}"
                ),
                elementIds=[v.constraint_id],
                blocking=True,
            )
        )
    return out


def compute_view_template_propagation(
    doc_before: Document,
    doc_after: Document,
    cmd: Any,
) -> dict[str, Any] | None:
    """Compute the ViewTemplatePropagation event for VIE-V3-03 commands.

    Returns a propagation dict for UpdateViewTemplateCmd and UnbindViewTemplateCmd;
    None for all other commands. Called by the route layer and tests.
    """
    if isinstance(cmd, UpdateViewTemplateCmd):
        template_id = cmd.template_id
        affected = [
            v.id
            for v in doc_after.elements.values()
            if isinstance(v, PlanViewElem) and v.template_id == template_id
        ]
        return {
            "event": "ViewTemplatePropagation",
            "templateId": template_id,
            "affected": affected,
            "unbound": [],
        }
    if isinstance(cmd, UnbindViewTemplateCmd):
        view_id = cmd.view_id
        view_before = doc_before.elements.get(view_id)
        template_id = view_before.template_id if isinstance(view_before, PlanViewElem) else None
        return {
            "event": "ViewTemplatePropagation",
            "templateId": template_id or "",
            "affected": [],
            "unbound": [view_id],
        }
    return None


def try_commit_bundle(
    doc: Document,
    cmds_raw: list[dict[str, Any]],
    *,
    source_provider: SourceDocProvider | None = None,
) -> tuple[bool, Document | None, list[Command], list[Violation], str]:
    authoring_violations = _agent_authoring_preflight_violations(cmds_raw)
    if authoring_violations:
        return False, None, [], authoring_violations, "authoring_validation_error"
    try:
        cmds: list[Command] = [coerce_command(c) for c in cmds_raw]
    except Exception as exc:
        return False, None, [], [], str(exc)
    cand = clone_document(doc)
    # KRN-06: backfill the singleton on every commit so persisted state always
    # has it (matches `try_commit`'s behaviour for the single-command path).
    ensure_internal_origin(cand)
    try:
        for cmd in cmds:
            apply_inplace(cand, cmd, source_provider=source_provider)
    except (ValueError, KeyError) as exc:
        return False, None, cmds, [], str(exc)

    ensure_sun_settings(cand)
    # PERF-CQ-02: bundle-level documentation_advisors gate. A bundle whose
    # commands all target a single element id and none of which are
    # schema-altering can skip the 9 info-only advisor passes; multi-
    # element / schema-altering bundles keep the full evaluation.
    documentation_advisors = not _bundle_is_single_element_safe(cmds_raw)
    violations = _commit_violations(cand, documentation_advisors=documentation_advisors)

    # EDT-02 — reject bundles that break an error-severity locked constraint.
    # Runs after every command apply; the clone rollback is implicit because
    # we never return ``cand`` on failure.
    edt_violations = _evaluate_edt_constraint_violations(cand.elements)
    violations = violations + edt_violations

    if _has_blocking_violations(violations):
        before_violations = _commit_violations(
            doc, documentation_advisors=documentation_advisors
        )
        blocking = _new_blocking_violations(before_violations, violations)
        if blocking:
            return False, None, cmds, violations, "constraint_error"

    cand.revision = doc.revision + 1

    _assert_tkn_round_trip(cand)

    return True, cand, cmds, violations, "ok"


def _assert_tkn_round_trip(doc: Document) -> None:
    """Verify TKN encode→decode→encode produces the same sequence (determinism gate)."""
    from bim_ai.tkn import decode, encode

    seq_a = encode(doc.elements)
    replay_cmds = decode(seq_a, doc.elements)
    if replay_cmds:
        raise RuntimeError(
            f"TKN round-trip failure: decode produced {len(replay_cmds)} unexpected commands"
        )
    seq_b = encode(doc.elements)
    if seq_a != seq_b:
        raise RuntimeError("TKN round-trip failure: encode is not deterministic")


def try_commit(
    doc: Document,
    cmd_raw: dict[str, Any],
    *,
    source_provider: SourceDocProvider | None = None,
) -> tuple[bool, Document | None, Command, list[Violation], str]:
    authoring_violations = _agent_authoring_preflight_violations([cmd_raw])
    if authoring_violations:
        return False, None, None, authoring_violations, "authoring_validation_error"  # type: ignore[return-value]
    cmds = coerce_command(cmd_raw)
    cand = clone_document(doc)
    # KRN-06: backfill the singleton on every commit so persisted state always has it.
    ensure_internal_origin(cand)
    apply_inplace(cand, cmds, source_provider=source_provider)
    ensure_sun_settings(cand)

    # PERF-CQ-02 (widens PERF-B07): skip the 9 info-level advisor passes
    # for any single-element command whose verb is not in the schema-
    # altering denylist. Closes the createWall / createFloor / move-* tail
    # that PERF-B07's narrow allowlist still ran advisors against; the
    # delta wire caller continues to stamp validationScope='blocking_only'
    # for the legacy fast-path subset so the FE preserves prior info
    # violations.
    documentation_advisors = not _command_is_single_element_safe(cmd_raw)
    violations = _commit_violations(cand, documentation_advisors=documentation_advisors)

    if _has_blocking_violations(violations):
        before_violations = _commit_violations(doc, documentation_advisors=documentation_advisors)
        blocking = _new_blocking_violations(before_violations, violations)
        if blocking:
            return False, None, cmds, violations, "constraint_error"

    cand.revision = doc.revision + 1

    return True, cand, cmds, violations, "ok"
