"""CMD-V3-01 — Pure apply_bundle function.

No DB I/O.  Route layer handles persistence and optimistic-lock enforcement.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Literal

from bim_ai.cmd.types import AssumptionEntry, BundleResult, CommandBundle
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


def apply_bundle(
    doc: Document,
    bundle: CommandBundle,
    mode: Literal["dry_run", "commit"],
) -> BundleResult:
    """Validate and optionally apply a CommandBundle.

    Pure — no DB I/O.  Route layer handles persistence and optimistic-lock.
    """
    # Step 1: structural assumption validation
    assumption_advisories = _validate_assumptions(bundle.assumptions)
    if assumption_advisories:
        return BundleResult(
            applied=False,
            violations=assumption_advisories,
            checkpoint_snapshot_id=_checkpoint_id(doc.elements),
        )

    # Step 2: optimistic-concurrency revision guard
    if bundle.parent_revision != doc.revision:
        return BundleResult(
            applied=False,
            violations=[{
                "advisoryClass": "revision_conflict",
                "message": (
                    f"parentRevision {bundle.parent_revision} != "
                    f"current revision {doc.revision}"
                ),
                "blocking": True,
            }],
        )

    # Step 3: targetOptionId guard (OPT-V3-01 stubs)
    if bundle.target_option_id == "main":
        return BundleResult(
            applied=False,
            violations=[{
                "advisoryClass": "direct_main_commit_forbidden",
                "message": (
                    "targetOptionId 'main' is permanently forbidden; "
                    "commits must target a design option"
                ),
                "blocking": True,
            }],
        )
    if bundle.target_option_id is not None:
        # TODO(OPT-V3-01): implement full DesignOption routing (requires KRN-V3-04)
        return BundleResult(
            applied=False,
            violations=[{
                "advisoryClass": "option_routing_not_yet_implemented",
                "message": (
                    f"targetOptionId routing is not yet implemented "
                    f"(see OPT-V3-01 / KRN-V3-04); got '{bundle.target_option_id}'"
                ),
                "blocking": True,
            }],
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
        return BundleResult(
            applied=False,
            violations=violations_wire,
            checkpoint_snapshot_id=checkpoint_id,
        )

    # commit mode
    if ok and new_doc is not None:
        return BundleResult(
            applied=True,
            new_revision=new_doc.revision,
            violations=violations_wire,
            checkpoint_snapshot_id=checkpoint_id,
        )
    return BundleResult(
        applied=False,
        violations=violations_wire,
        checkpoint_snapshot_id=checkpoint_id,
    )
