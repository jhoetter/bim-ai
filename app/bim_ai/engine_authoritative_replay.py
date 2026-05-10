from __future__ import annotations

import hashlib
import json
from typing import Any, NamedTuple

from bim_ai.commands import Command
from bim_ai.constraints import Violation
from bim_ai.document import Document
from bim_ai.elements import FloorElem, FloorTypeElem, LevelElem, RoofElem, RoofTypeElem, WallElem

# Imported lazily from the legacy engine facade while engine.py is being split.
# engine.py defines these names before importing this module.
from bim_ai.engine import (  # noqa: E402
    _AUTHORITATIVE_REPLAY_V0_TYPES,
    blocking_violation_element_ids_at_prefix,
    coerce_command,
    first_blocking_command_index_after_prefixes,
)


def _authoritative_replay_v0_declared_id(cmd: dict[str, Any]) -> str | None:
    cid = cmd.get("id")
    if isinstance(cid, str) and cid.strip():
        return cid.strip()
    return None


class AuthoritativePreflightFailure(NamedTuple):
    """First-step structured failure from authoritative replay merge preflight."""

    first_conflicting_step_index: int
    reason_code: str
    conflicting_declared_ids: tuple[str, ...]
    conflicting_existing_element_ids: tuple[str, ...]
    missing_reference_hints: tuple[dict[str, Any], ...]


def _sorted_missing_reference_hints(hints: list[dict[str, Any]]) -> tuple[dict[str, Any], ...]:
    def sort_key(h: dict[str, Any]) -> tuple[int, str, str]:
        si = h.get("stepIndex")
        step = int(si) if isinstance(si, int) and si >= 0 else -1
        rk = str(h.get("referenceKey", ""))
        rid = str(h.get("referenceId", ""))
        return step, rk, rid

    return tuple(sorted(hints, key=sort_key))


def authoritative_replay_v0_preflight_detail(
    doc: Document, cmds_raw: list[dict[str, Any]]
) -> AuthoritativePreflightFailure | None:
    """Walk authoritative replay commands in order; return first merge failure with ids/refs."""

    declared: set[str] = set()
    known_levels: set[str] = {eid for eid, el in doc.elements.items() if isinstance(el, LevelElem)}
    known_floors: set[str] = {eid for eid, el in doc.elements.items() if isinstance(el, FloorElem)}
    known_walls: set[str] = {eid for eid, el in doc.elements.items() if isinstance(el, WallElem)}
    known_roofs: set[str] = {eid for eid, el in doc.elements.items() if isinstance(el, RoofElem)}

    for i, cmd in enumerate(cmds_raw):
        t = cmd.get("type")
        if t == "createLevel":
            pid = cmd.get("parentLevelId")
            if isinstance(pid, str) and pid.strip():
                ps = pid.strip()
                if ps not in known_levels:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": "parentLevelId", "referenceId": ps}]
                        ),
                    )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)
                known_levels.add(eid)

        elif t == "createFloor":
            lid = cmd.get("levelId")
            if not isinstance(lid, str) or not lid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ""}]
                    ),
                )
            ls = lid.strip()
            if ls not in known_levels:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ls}]
                    ),
                )
            ftid_raw = cmd.get("floorTypeId")
            if isinstance(ftid_raw, str) and ftid_raw.strip():
                fts = ftid_raw.strip()
                ft_el = doc.elements.get(fts)
                if not isinstance(ft_el, FloorTypeElem):
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": "floorTypeId", "referenceId": fts}]
                        ),
                    )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)
                known_floors.add(eid)

        elif t == "createWall":
            lid = cmd.get("levelId")
            if not isinstance(lid, str) or not lid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ""}]
                    ),
                )
            ls = lid.strip()
            if ls not in known_levels:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ls}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)
                known_walls.add(eid)

        elif t == "createRoof":
            rlid = cmd.get("referenceLevelId")
            if not isinstance(rlid, str) or not rlid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "referenceLevelId", "referenceId": ""}]
                    ),
                )
            rs = rlid.strip()
            if rs not in known_levels:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "referenceLevelId", "referenceId": rs}]
                    ),
                )
            rtid_raw = cmd.get("roofTypeId")
            if isinstance(rtid_raw, str) and rtid_raw.strip():
                rts = rtid_raw.strip()
                rt_el = doc.elements.get(rts)
                if not isinstance(rt_el, RoofTypeElem):
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": "roofTypeId", "referenceId": rts}]
                        ),
                    )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)
                known_roofs.add(eid)

        elif t == "createRoofOpening":
            hid = cmd.get("hostRoofId")
            if not isinstance(hid, str) or not hid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "hostRoofId", "referenceId": ""}]
                    ),
                )
            hs = hid.strip()
            if hs not in known_roofs:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "hostRoofId", "referenceId": hs}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        elif t == "createRoomOutline":
            lid = cmd.get("levelId")
            if not isinstance(lid, str) or not lid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ""}]
                    ),
                )
            ls = lid.strip()
            if ls not in known_levels:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ls}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        elif t == "createSlabOpening":
            hid = cmd.get("hostFloorId")
            if not isinstance(hid, str) or not hid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "hostFloorId", "referenceId": ""}]
                    ),
                )
            hs = hid.strip()
            if hs not in known_floors:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "hostFloorId", "referenceId": hs}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        elif t == "createStair":
            for lid_key in ("baseLevelId", "topLevelId"):
                lid = cmd.get(lid_key)
                if not isinstance(lid, str) or not lid.strip():
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": lid_key, "referenceId": ""}]
                        ),
                    )
                ls = lid.strip()
                if ls not in known_levels:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": lid_key, "referenceId": ls}]
                        ),
                    )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        elif t in {"insertDoorOnWall", "insertWindowOnWall"}:
            wid = cmd.get("wallId")
            if not isinstance(wid, str) or not wid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "wallId", "referenceId": ""}]
                    ),
                )
            ws = wid.strip()
            if ws not in known_walls:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "wallId", "referenceId": ws}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        else:
            return AuthoritativePreflightFailure(
                i,
                "invalid_command",
                (),
                (),
                (),
            )

    return None


def _authoritative_replay_v0_preflight(doc: Document, cmds_raw: list[dict[str, Any]]) -> str | None:
    """Return a failure outcome code before ``try_commit_bundle``, or ``None`` if safe to attempt."""

    detail = authoritative_replay_v0_preflight_detail(doc, cmds_raw)
    return detail.reason_code if detail is not None else None


def bundle_commands_are_authoritative_replay_v0_only(cmds_raw: list[dict[str, Any]]) -> bool:
    """True when every command dict uses only authoritativeReplay_v0 command types."""

    for cmd in cmds_raw:
        if not isinstance(cmd, dict):
            return False
        t = cmd.get("type")
        if not isinstance(t, str) or t not in _AUTHORITATIVE_REPLAY_V0_TYPES:
            return False
    return True


def _canonicalize_json_for_digest(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _canonicalize_json_for_digest(obj[k]) for k in sorted(obj)}
    if isinstance(obj, list):
        canon = [_canonicalize_json_for_digest(x) for x in obj]
        canon.sort(key=lambda x: json.dumps(x, sort_keys=True, separators=(",", ":")))
        return canon
    return obj


def _merge_preflight_guidance(reason_code: str) -> tuple[str, str, str]:
    rc = reason_code
    if rc == "ok":
        return (
            "safe_retry_unchanged",
            "No merge blocking detected for this bundle snapshot.",
            "Proceed with apply when operational gates pass.",
        )
    if rc == "merge_reference_unresolved":
        return (
            "safe_after_dependency_refresh",
            "Refresh level/host/type references in the source model or IFC sketch, then replay.",
            "Regenerate authoritative replay commands after resolving reference ids against the target document.",
        )
    if rc == "merge_id_collision":
        return (
            "requires_manual_resolution",
            "Rename declared element ids in the bundle or remove conflicting elements on the server before merge.",
            "Emit replacement commands with non-colliding ids mapped to the target document.",
        )
    if rc == "invalid_command":
        return (
            "requires_agent_replacement_bundle",
            "Inspect bundle command schema and types; remove unsupported commands from authoritative replay.",
            "Replace bundle with a schema-valid authoritativeReplay_v0 command list.",
        )
    if rc == "constraint_error":
        return (
            "requires_manual_resolution",
            "Resolve blocking constraints at the indicated step (geometry, levels, hosts) before replay.",
            "Trim or rewrite commands after the blocking prefix using Advisor violations.",
        )
    return (
        "requires_agent_replacement_bundle",
        "Fix sketch availability and schema version before replay.",
        "Provide a valid authoritativeReplay_v0 sketch payload.",
    )


def command_bundle_merge_preflight_v1(
    *,
    doc: Document,
    cmds_raw: list[dict[str, Any]],
    authoritative_failure: AuthoritativePreflightFailure | None,
    outcome_code: str,
    violations: list[Violation],
    replay_diag: dict[str, Any],
) -> dict[str, Any]:
    """Stable merge preflight evidence object for bundle 409 / dry-run (camelCase JSON)."""

    _ = violations

    first_idx: int | None
    decl_ids: list[str]
    exist_ids: list[str]
    missing: list[dict[str, Any]]

    if authoritative_failure is not None:
        reason_code = authoritative_failure.reason_code
        first_idx = authoritative_failure.first_conflicting_step_index
        decl_ids = sorted(authoritative_failure.conflicting_declared_ids)
        exist_ids = sorted(authoritative_failure.conflicting_existing_element_ids)
        missing = list(authoritative_failure.missing_reference_hints)
    elif outcome_code == "constraint_error":
        reason_code = "constraint_error"
        idx_raw = replay_diag.get("firstBlockingCommandIndex")
        cmds_coerced: list[Command] | None = None
        if isinstance(idx_raw, int) and idx_raw >= 0:
            first_idx = idx_raw
        else:
            try:
                cmds_coerced = [coerce_command(c) for c in cmds_raw]
            except Exception:
                cmds_coerced = []
            first_idx = (
                first_blocking_command_index_after_prefixes(doc, cmds_coerced)
                if cmds_coerced
                else None
            )
        decl_ids = []
        cmds_for_elems = cmds_coerced
        if cmds_for_elems is None:
            try:
                cmds_for_elems = [coerce_command(c) for c in cmds_raw]
            except Exception:
                cmds_for_elems = []
        exist_ids = (
            blocking_violation_element_ids_at_prefix(doc, cmds_for_elems, first_idx)
            if first_idx is not None and cmds_for_elems
            else []
        )
        missing = []
    elif outcome_code == "ok":
        reason_code = "ok"
        first_idx = None
        decl_ids = []
        exist_ids = []
        missing = []
    else:
        reason_code = outcome_code
        first_idx = None
        decl_ids = []
        exist_ids = []
        missing = []

    cls, manual, agent_act = _merge_preflight_guidance(reason_code)

    core: dict[str, Any] = {
        "format": "commandBundleMergePreflight_v1",
        "reasonCode": reason_code,
        "conflictingDeclaredIds": decl_ids,
        "conflictingExistingElementIds": exist_ids,
        "missingReferenceHints": _canonicalize_json_for_digest(missing),
        "safeRetryClassification": cls,
        "suggestedManualAction": manual,
        "suggestedAgentAction": agent_act,
    }
    if first_idx is not None:
        core["firstConflictingStepIndex"] = first_idx
    elif reason_code == "ok":
        core["firstConflictingStepIndex"] = None

    blob = json.dumps(_canonicalize_json_for_digest(core), sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(blob.encode()).hexdigest()
    return {**core, "evidenceDigestSha256": digest}
