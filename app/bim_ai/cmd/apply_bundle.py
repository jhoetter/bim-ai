"""CMD-V3-01 — Pure apply_bundle function.

No DB I/O.  Route layer handles persistence and optimistic-lock enforcement.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from bim_ai.cmd.types import AgentTrace, AssumptionEntry, BundleResult, CommandBundle
from bim_ai.document import (
    DesignOption,
    DesignOptionProvenance,
    DesignOptionSet,
    Document,
)
from bim_ai.engine import try_commit_bundle


def _validate_assumptions(assumptions: list[AssumptionEntry]) -> list[dict[str, Any]]:
    """Structural validation — semantics live in the agent."""
    advisories: list[dict[str, Any]] = []

    if not assumptions:
        advisories.append({
            "advisoryClass": "assumption_log_required",
            "message": "assumptions must be a non-empty array",
            "blocking": True,
        })
        return advisories

    seen_keys: set[str] = set()
    for i, entry in enumerate(assumptions):
        if not entry.key:
            advisories.append({
                "advisoryClass": "assumption_log_malformed",
                "message": f"assumptions[{i}].key must be a non-empty string",
                "entryIndex": i,
                "blocking": True,
            })
        if not (0.0 <= entry.confidence <= 1.0):
            advisories.append({
                "advisoryClass": "assumption_log_malformed",
                "message": f"assumptions[{i}].confidence must be in [0, 1], got {entry.confidence}",
                "entryIndex": i,
                "blocking": True,
            })
        if entry.key in seen_keys:
            advisories.append({
                "advisoryClass": "assumption_log_duplicate_key",
                "message": f"assumptions[{i}].key '{entry.key}' is duplicated",
                "entryIndex": i,
                "blocking": True,
            })
        elif entry.key:
            seen_keys.add(entry.key)

    return advisories


def _checkpoint_id(elements: dict[str, Any]) -> str:
    payload = json.dumps(
        {k: v.model_dump(by_alias=True) for k, v in elements.items()},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _attach_agent_traces(
    new_elements: dict[str, Any],
    old_elements: dict[str, Any],
    bundle: CommandBundle,
    bundle_id: str,
) -> None:
    """Stamp every element that is new or modified by this bundle with an AgentTrace."""
    now_iso = datetime.now(UTC).isoformat()
    assumption_keys = [entry.key for entry in bundle.assumptions]
    trace = AgentTrace(
        bundle_id=bundle_id,
        assumption_keys=assumption_keys,
        applied_at=now_iso,
    )
    for eid, elem in list(new_elements.items()):
        if eid not in old_elements or old_elements[eid] != elem:
            if hasattr(elem, "agent_trace"):
                new_elements[eid] = elem.model_copy(update={"agent_trace": trace})


def _write_assumption_audit(
    model_id: str,
    bundle_id: str,
    assumptions: list[AssumptionEntry],
    applied_at: str,
) -> None:
    """Append an audit record to <data_dir>/models/<model_id>/audit/assumptions.jsonl."""
    import os

    audit_dir = os.path.join("data", "models", str(model_id), "audit")
    os.makedirs(audit_dir, exist_ok=True)
    record = {
        "bundleId": bundle_id,
        "appliedAt": applied_at,
        "assumptions": [a.model_dump(by_alias=True) for a in assumptions],
    }
    with open(os.path.join(audit_dir, "assumptions.jsonl"), "a") as f:
        f.write(json.dumps(record) + "\n")


_AGENT_PROPOSALS_SET_NAME = "Agent proposals"


def _resolve_bundle_target(
    doc: Document,
    bundle: CommandBundle,
    submitter: str = "human",
) -> tuple[str | None, str | None]:
    """Return (option_set_id, option_id) for the bundle's target.

    Returns (None, None) if targeting main (only allowed when targetOptionId=='main').
    Returns (set_id, new_option_id) if auto-routing to a new option.
    Raises ValueError('direct_main_commit_forbidden') if targetOptionId=='main'
    but submitter is 'agent'.
    """
    if bundle.target_option_id == "main":
        if submitter == "agent":
            raise ValueError("direct_main_commit_forbidden")
        return (None, None)

    if bundle.target_option_id is None:
        # Auto-route: find existing "Agent proposals" set or signal creation needed
        existing_set = next(
            (s for s in doc.design_option_sets if s.name == _AGENT_PROPOSALS_SET_NAME),
            None,
        )
        set_id = existing_set.id if existing_set is not None else str(uuid.uuid4())
        option_id = str(uuid.uuid4())
        return (set_id, option_id)

    # Named target: validate the option exists
    for opt_set in doc.design_option_sets:
        for opt in opt_set.options:
            if opt.id == bundle.target_option_id:
                return (opt_set.id, bundle.target_option_id)

    raise ValueError(f"option_not_found:{bundle.target_option_id}")


def _apply_option_routing(
    new_doc: Document,
    old_elements: dict[str, Any],
    set_id: str,
    option_id: str,
    bundle_id: str,
    submitter: str,
    is_auto_routed: bool,
) -> None:
    """Create option infra if needed and assign new/modified elements to the option.

    Mutates new_doc in place.
    """
    timestamp_ms = int(datetime.now(UTC).timestamp() * 1000)
    provenance = DesignOptionProvenance(
        submitter=submitter,
        bundle_id=bundle_id,
        created_at=timestamp_ms,
    )

    if is_auto_routed:
        # Ensure "Agent proposals" set exists
        existing_set = next(
            (s for s in new_doc.design_option_sets if s.name == _AGENT_PROPOSALS_SET_NAME),
            None,
        )
        if existing_set is None:
            new_set = DesignOptionSet(id=set_id, name=_AGENT_PROPOSALS_SET_NAME)
            new_doc.design_option_sets.append(new_set)
            target_set = new_set
        else:
            target_set = existing_set
            set_id = existing_set.id

        name = f"Proposal {timestamp_ms}"
        target_set.options.append(DesignOption(id=option_id, name=name, provenance=provenance))
    else:
        # Named target: record provenance on the existing option
        for opt_set in new_doc.design_option_sets:
            for opt in opt_set.options:
                if opt.id == option_id:
                    opt.provenance = provenance
                    set_id = opt_set.id
                    break

    # Assign new/modified elements to this option
    for eid, elem in list(new_doc.elements.items()):
        if (eid not in old_elements or old_elements[eid] != elem) and hasattr(
            elem, "option_set_id"
        ):
            new_doc.elements[eid] = elem.model_copy(
                update={"option_set_id": set_id, "option_id": option_id}
            )


def apply_bundle(
    doc: Document,
    bundle: CommandBundle,
    mode: Literal["dry_run", "commit"],
    model_id: str | None = None,
    submitter: str = "human",
) -> tuple[BundleResult, Document | None]:
    """Validate and optionally apply a CommandBundle.

    Returns (BundleResult, new_doc). new_doc is the post-commit document with
    AgentTrace stamps when mode=='commit' and applied==True; None otherwise.
    Pure — no DB I/O except the best-effort audit JSONL.
    """
    # Step 1: structural assumption validation
    assumption_advisories = _validate_assumptions(bundle.assumptions)
    if assumption_advisories:
        return (
            BundleResult(
                applied=False,
                violations=assumption_advisories,
                checkpoint_snapshot_id=_checkpoint_id(doc.elements),
            ),
            None,
        )

    # Step 2: optimistic-concurrency revision guard
    if bundle.parent_revision != doc.revision:
        return (
            BundleResult(
                applied=False,
                violations=[{
                    "advisoryClass": "revision_conflict",
                    "message": (
                        f"parentRevision {bundle.parent_revision} != "
                        f"current revision {doc.revision}"
                    ),
                    "blocking": True,
                }],
            ),
            None,
        )

    # Step 3: OPT-V3-01 targetOptionId gate
    try:
        routing_target = _resolve_bundle_target(doc, bundle, submitter)
    except ValueError as exc:
        msg = str(exc)
        if msg == "direct_main_commit_forbidden":
            return (
                BundleResult(
                    applied=False,
                    violations=[{
                        "advisoryClass": "direct_main_commit_forbidden",
                        "message": "Bundles submitted by agents must target a DesignOption, not main.",
                        "commandIndex": -1,
                        "blocking": True,
                    }],
                    checkpoint_snapshot_id=_checkpoint_id(doc.elements),
                ),
                None,
            )
        if msg.startswith("option_not_found:"):
            missing_id = msg.split(":", 1)[1]
            return (
                BundleResult(
                    applied=False,
                    violations=[{
                        "advisoryClass": "option_not_found",
                        "message": f"targetOptionId '{missing_id}' does not exist in this document.",
                        "blocking": True,
                    }],
                    checkpoint_snapshot_id=_checkpoint_id(doc.elements),
                ),
                None,
            )
        raise

    # routing_target is (set_id, option_id) or (None, None) for main
    is_auto_routed = bundle.target_option_id is None
    target_set_id, target_option_id = routing_target

    # Step 4: run the engine
    ok, new_doc, _cmds, violations, _code = try_commit_bundle(doc, bundle.commands)
    violations_wire = [v.model_dump(by_alias=True) for v in violations]

    # Step 5: checkpoint snapshot id
    checkpoint_id = _checkpoint_id(
        new_doc.elements if (ok and new_doc is not None) else doc.elements
    )

    # Step 6: mode branch — dry_run never persists
    if mode == "dry_run":
        return (
            BundleResult(
                applied=False,
                violations=violations_wire,
                checkpoint_snapshot_id=checkpoint_id,
            ),
            None,
        )

    # commit mode
    if ok and new_doc is not None:
        bundle_id = str(uuid.uuid4())
        _attach_agent_traces(new_doc.elements, doc.elements, bundle, bundle_id)

        # Route to option if not committing to main
        out_option_id: str | None = None
        if target_set_id is not None and target_option_id is not None:
            _apply_option_routing(
                new_doc,
                doc.elements,
                target_set_id,
                target_option_id,
                bundle_id,
                submitter,
                is_auto_routed,
            )
            out_option_id = target_option_id

        applied_at = datetime.now(UTC).isoformat()
        if model_id is not None:
            try:
                _write_assumption_audit(model_id, bundle_id, bundle.assumptions, applied_at)
            except Exception:
                pass

        return (
            BundleResult(
                applied=True,
                new_revision=new_doc.revision,
                option_id=out_option_id,
                violations=violations_wire,
                checkpoint_snapshot_id=checkpoint_id,
            ),
            new_doc,
        )
    return (
        BundleResult(
            applied=False,
            violations=violations_wire,
            checkpoint_snapshot_id=checkpoint_id,
        ),
        None,
    )
