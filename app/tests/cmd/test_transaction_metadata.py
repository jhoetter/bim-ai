"""M3-D — shared transaction metadata contract tests."""

from __future__ import annotations

from bim_ai.cmd.apply_bundle import apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin
from bim_ai.transaction_metadata import build_transaction_metadata

_ASSUMPTION = {
    "key": "ground_level_mm",
    "value": 0,
    "confidence": 0.95,
    "source": "brief",
}
_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-g", "name": "Ground", "elevationMm": 0}
_CREATE_WALL = {
    "type": "createWall",
    "id": "wall-01",
    "name": "W-01",
    "levelId": "lvl-g",
    "start": {"xMm": 0, "yMm": 0},
    "end": {"xMm": 5000, "yMm": 0},
    "thicknessMm": 200,
    "heightMm": 3000,
}


def test_cmd_v3_commit_transaction_metadata_captures_revision_identity_audit_and_delta() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    level_bundle = CommandBundle.model_validate({
        "schemaVersion": "cmd-v3.0",
        "commands": [_CREATE_LEVEL],
        "assumptions": [_ASSUMPTION],
        "parentRevision": doc.revision,
    })
    level_result, doc_with_level = apply_bundle(doc, level_bundle, "commit", submitter="agent")
    assert level_result.applied is True
    assert doc_with_level is not None

    bundle = CommandBundle.model_validate({
        "schemaVersion": "cmd-v3.0",
        "commands": [_CREATE_WALL],
        "assumptions": [_ASSUMPTION],
        "parentRevision": doc_with_level.revision,
    })
    result, new_doc = apply_bundle(doc_with_level, bundle, "commit", submitter="agent")
    assert result.applied is True
    assert new_doc is not None

    metadata = build_transaction_metadata(
        doc_before=doc_with_level,
        new_doc=new_doc,
        commands=bundle.commands,
        user_id="agent-1",
        submitter="agent",
        parent_revision=bundle.parent_revision,
        assumptions=list(bundle.assumptions),
        client_op_id="op-123",
        workflow={
            "route": "/api/models/{model_id}/bundles",
            "entryPoint": "cmd-v3-apply-bundle",
            "surface": "api-v3",
        },
    )

    assert metadata["schemaVersion"] == "txn-v1.0"
    assert metadata["parentRevision"] == 2
    assert metadata["revisionBefore"] == 2
    assert metadata["revisionAfter"] == 3
    assert metadata["agentIdentity"] == {"userId": "agent-1", "submitter": "agent"}
    assert "wall-01" in metadata["changedIds"]
    assert "wall-01" in metadata["collaborationDelta"]["changedIds"]
    assert "wall-01" in metadata["collaborationDelta"]["elementPatchIds"]
    assert metadata["collaborationDelta"]["clientOpId"] == "op-123"
    assert metadata["idempotency"]["clientOpId"] == "op-123"
    assert len(metadata["idempotency"]["bundleDigestSha256"]) == 64
    assert metadata["workflow"] == {
        "route": "/api/models/{model_id}/bundles",
        "entryPoint": "cmd-v3-apply-bundle",
        "surface": "api-v3",
    }
    assert metadata["assumptions"]["keys"] == ["ground_level_mm"]
    assert metadata["audit"]["hasAssumptionAudit"] is True
    assert len(metadata["audit"]["agentTraceBundleIds"]) == 1
    assert metadata["commandCount"] == 1
    assert metadata["commandTypes"] == ["createWall"]


def test_m3_workflow_transaction_metadata_preserves_entry_point_identity() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    bundle = CommandBundle.model_validate({
        "schemaVersion": "cmd-v3.0",
        "commands": [_CREATE_LEVEL],
        "assumptions": [_ASSUMPTION],
        "parentRevision": doc.revision,
    })
    result, new_doc = apply_bundle(doc, bundle, "commit", submitter="agent")
    assert result.applied is True
    assert new_doc is not None

    workflows = {
        "sketch": {
            "route": "/api/v3/sketch/phase/accept",
            "entryPoint": "sketch-phase-accept",
            "surface": "api-v3",
        },
        "export": {
            "route": "/api/models/{model_id}/exports",
            "entryPoint": "documentation-export",
            "surface": "api-v3",
        },
        "importLike": {
            "route": "/api/models/{model_id}/bundles",
            "entryPoint": "cmd-v3-apply-bundle",
            "surface": "api-v3",
        },
    }

    for workflow_name, workflow in workflows.items():
        metadata = build_transaction_metadata(
            doc_before=doc,
            new_doc=new_doc,
            commands=bundle.commands,
            user_id="agent-1",
            submitter="agent",
            parent_revision=bundle.parent_revision,
            assumptions=list(bundle.assumptions),
            client_op_id=f"m3-{workflow_name}-op",
            workflow=workflow,
        )

        assert metadata["workflow"] == workflow
        assert metadata["idempotency"]["clientOpId"] == f"m3-{workflow_name}-op"
        assert len(metadata["idempotency"]["bundleDigestSha256"]) == 64
        assert metadata["collaborationDelta"]["clientOpId"] == f"m3-{workflow_name}-op"
        assert metadata["parentRevision"] == 1
        assert metadata["revisionAfter"] == 2
