"""CMD-V3-01 — Pure apply_bundle function.

No DB I/O.  Route layer handles persistence and optimistic-lock enforcement.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from bim_ai.cmd.types import AgentTrace, AssumptionEntry, BundleResult, CommandBundle
from bim_ai.document import Document
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
    now_iso = datetime.now(timezone.utc).isoformat()
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


def apply_bundle(
    doc: Document,
    bundle: CommandBundle,
    mode: Literal["dry_run", "commit"],
    model_id: str | None = None,
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

    # Step 3: targetOptionId guard (OPT-V3-01 stubs)
    if bundle.target_option_id == "main":
        return (
            BundleResult(
                applied=False,
                violations=[{
                    "advisoryClass": "direct_main_commit_forbidden",
                    "message": (
                        "targetOptionId 'main' is permanently forbidden; "
                        "commits must target a design option"
                    ),
                    "blocking": True,
                }],
            ),
            None,
        )
    if bundle.target_option_id is not None:
        # TODO(OPT-V3-01): implement full DesignOption routing (requires KRN-V3-04)
        return (
            BundleResult(
                applied=False,
                violations=[{
                    "advisoryClass": "option_routing_not_yet_implemented",
                    "message": (
                        f"targetOptionId routing is not yet implemented "
                        f"(see OPT-V3-01 / KRN-V3-04); got '{bundle.target_option_id}'"
                    ),
                    "blocking": True,
                }],
            ),
            None,
        )

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

        applied_at = datetime.now(timezone.utc).isoformat()
        if model_id is not None:
            try:
                _write_assumption_audit(model_id, bundle_id, bundle.assumptions, applied_at)
            except Exception:
                pass

        return (
            BundleResult(
                applied=True,
                new_revision=new_doc.revision,
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
