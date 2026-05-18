from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.engine import compute_delta_wire

TRANSACTION_METADATA_SCHEMA_VERSION = "txn-v1.0"


def changed_element_ids(prev_doc: Document, next_doc: Document) -> list[str]:
    """Stable changed id list for transaction logs and API results."""
    changed: list[str] = []
    for eid in sorted(set(prev_doc.elements) | set(next_doc.elements)):
        if prev_doc.elements.get(eid) != next_doc.elements.get(eid):
            changed.append(eid)
    return changed


def _wire_assumption(entry: Any) -> dict[str, Any]:
    if hasattr(entry, "model_dump"):
        dumped = entry.model_dump(by_alias=True)
        return dumped if isinstance(dumped, dict) else {"value": dumped}
    if isinstance(entry, dict):
        return dict(entry)
    return {"value": entry}


def _assumption_key(entry: dict[str, Any]) -> str:
    key = entry.get("key")
    return str(key) if key not in (None, "") else ""


def _agent_trace_bundle_ids(doc: Document, changed_ids: list[str]) -> list[str]:
    bundle_ids: set[str] = set()
    for eid in changed_ids:
        elem = doc.elements.get(eid)
        trace = getattr(elem, "agent_trace", None)
        bundle_id = getattr(trace, "bundle_id", None)
        if bundle_id:
            bundle_ids.add(str(bundle_id))
    return sorted(bundle_ids)


def build_transaction_metadata(
    *,
    doc_before: Document,
    new_doc: Document,
    commands: list[dict[str, Any]],
    user_id: str,
    submitter: str | None = None,
    parent_revision: int | None = None,
    assumptions: list[Any] | None = None,
    client_op_id: str | None = None,
    action: str = "commit",
) -> dict[str, Any]:
    """Shared transaction/audit summary for commits, command-log, and collab deltas."""
    assumption_entries = [_wire_assumption(a) for a in assumptions or []]
    assumption_keys = sorted(k for k in (_assumption_key(a) for a in assumption_entries) if k)
    changed_ids = changed_element_ids(doc_before, new_doc)
    delta = compute_delta_wire(doc_before, new_doc)
    element_patch_ids = sorted(str(k) for k in delta.get("elements", {}).keys())
    removed_ids = sorted(str(x) for x in delta.get("removedIds", []))
    command_types = [str(c.get("type", "")) for c in commands if isinstance(c, dict)]

    metadata: dict[str, Any] = {
        "schemaVersion": TRANSACTION_METADATA_SCHEMA_VERSION,
        "action": action,
        "parentRevision": parent_revision if parent_revision is not None else doc_before.revision,
        "revisionBefore": doc_before.revision,
        "revisionAfter": new_doc.revision,
        "changedIds": changed_ids,
        "commandCount": len(commands),
        "commandTypes": command_types,
        "agentIdentity": {
            "userId": user_id,
            "submitter": submitter or "unknown",
        },
        "assumptions": {
            "count": len(assumption_entries),
            "keys": assumption_keys,
            "entries": assumption_entries,
        },
        "audit": {
            "assumptionLogFormat": "assumptionLog_v0",
            "assumptionKeys": assumption_keys,
            "hasAssumptionAudit": bool(assumption_entries),
            "agentTraceBundleIds": _agent_trace_bundle_ids(new_doc, changed_ids),
        },
        "collaborationDelta": {
            "revision": new_doc.revision,
            "changedIds": changed_ids,
            "removedIds": removed_ids,
            "elementPatchIds": element_patch_ids,
        },
        "undo": {
            "available": action in {"commit", "redo"},
            "redoAvailable": action == "undo",
        },
    }
    if client_op_id:
        metadata["clientOpId"] = client_op_id
        metadata["collaborationDelta"]["clientOpId"] = client_op_id
    return metadata
