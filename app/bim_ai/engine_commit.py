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


def compute_delta_wire(prev_doc: Document, next_doc: Document) -> dict[str, Any]:
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

    return {
        "revision": next_doc.revision,
        "removedIds": removed_ids,
        "elements": elements_patch,
        "violations": [v.model_dump(by_alias=True) for v in evaluate(next_doc.elements)],
    }


def first_blocking_command_index_after_prefixes(doc: Document, cmds: list[Command]) -> int | None:
    """First apply index (0-based) where accumulated model hits a blocking/error violation."""

    cand = clone_document(doc)
    for i, cmd in enumerate(cmds):
        apply_inplace(cand, cmd)
        violations = evaluate(cand.elements)
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
    violations = evaluate(cand.elements)
    blocking = [v for v in violations if v.blocking or v.severity == "error"]
    return sorted({v.rule_id for v in blocking})


def blocking_violation_element_ids_at_prefix(
    doc: Document, cmds: list[Command], idx: int
) -> list[str]:
    """Sorted unique element ids from blocking/error violations after cmds[0..idx] inclusive."""

    cand = clone_document(doc)
    for i in range(idx + 1):
        apply_inplace(cand, cmds[i])
    violations = evaluate(cand.elements)
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
    before_violations = evaluate(doc.elements)
    violations = evaluate(cand.elements)

    # EDT-02 — reject bundles that break an error-severity locked constraint.
    # Runs after every command apply; the clone rollback is implicit because
    # we never return ``cand`` on failure.
    edt_violations = _evaluate_edt_constraint_violations(cand.elements)
    violations = violations + edt_violations

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
    cmds = coerce_command(cmd_raw)
    cand = clone_document(doc)
    # KRN-06: backfill the singleton on every commit so persisted state always has it.
    ensure_internal_origin(cand)
    apply_inplace(cand, cmds, source_provider=source_provider)
    ensure_sun_settings(cand)

    before_violations = evaluate(doc.elements)
    violations = evaluate(cand.elements)

    blocking = _new_blocking_violations(before_violations, violations)
    if blocking:
        return False, None, cmds, violations, "constraint_error"

    cand.revision = doc.revision + 1

    return True, cand, cmds, violations, "ok"
