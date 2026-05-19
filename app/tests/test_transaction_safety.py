from __future__ import annotations

from bim_ai.transaction_safety import (
    ActorIdentity,
    DryRunEvidence,
    assess_transaction_safety,
    build_agent_remediation_proposal,
    build_dry_run_evidence,
    build_transaction_preflight_audit,
    build_undo_redo_integrity_metadata,
    canonical_command_digest,
    classify_fix_safety,
    infer_permission_scopes,
    validate_fix_provenance,
    validate_undo_redo_contract,
)


def _wall_command(wall_id: str = "w-1") -> dict[str, object]:
    return {
        "type": "createWall",
        "id": wall_id,
        "levelId": "lvl-1",
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 3000, "yMm": 0},
        "thicknessMm": 200,
        "heightMm": 2800,
    }


def test_q01_all_mutating_surfaces_require_parent_revision() -> None:
    commands = [_wall_command()]

    for surface in ("dry-run", "commit", "bundle-commit", "ui-command-commit", "mcp-mutation"):
        decision = assess_transaction_safety(
            current_revision=7,
            parent_revision=None,
            mode="dry_run",
            surface=surface,  # type: ignore[arg-type]
            actor_kind="human",
            commands=commands,
        )

        assert decision.ok is False
        assert decision.reason_code == "missing_parent_revision"
        assert (
            decision.rollback_guidance
            == "Model remains unchanged; do not append undo or redo rows."
        )


def test_q01_transaction_preflight_audit_is_deterministic_and_pre_mutation() -> None:
    commands = [_wall_command()]
    decision = assess_transaction_safety(
        current_revision=7,
        parent_revision=7,
        mode="commit",
        surface="bundle-commit",
        actor_kind="human",
        commands=commands,
    )

    audit = build_transaction_preflight_audit(
        current_revision=7,
        parent_revision=7,
        mode="commit",
        surface="bundle-commit",
        actor_kind="human",
        commands=commands,
        decision=decision,
    )

    assert audit["schemaVersion"] == "transactionPreflightAudit_v1"
    assert audit["decisionOk"] is True
    assert audit["decisionReasonCode"] == "ok"
    assert audit["commandDigestSha256"] == canonical_command_digest(commands)
    assert audit["mutationPolicy"] == "candidate_document_only_until_safety_gate_passes"
    assert (
        build_transaction_preflight_audit(
            current_revision=7,
            parent_revision=7,
            mode="commit",
            surface="bundle-commit",
            actor_kind="human",
            commands=commands,
            decision=decision,
        )
        == audit
    )


def test_q03_stale_revision_reports_explicit_retry_safe_conflict() -> None:
    decision = assess_transaction_safety(
        current_revision=9,
        parent_revision=8,
        mode="commit",
        surface="bundle-commit",
        actor_kind="human",
        commands=[_wall_command()],
    )

    assert decision.ok is False
    assert decision.reason_code == "revision_conflict"
    assert decision.conflict is not None
    assert decision.conflict.current_revision == 9
    assert decision.conflict.parent_revision == 8
    assert decision.conflict.retry_safe is True
    assert "rebase" in decision.retry_guidance


def test_q03_stale_undo_redo_stack_revision_is_a_collaboration_conflict() -> None:
    decision = assess_transaction_safety(
        current_revision=12,
        parent_revision=10,
        mode="undo",
        surface="undo",
        actor_kind="human",
        commands=[{"type": "deleteElement", "elementId": "w-1"}],
    )

    assert decision.ok is False
    assert decision.reason_code == "revision_conflict"
    assert decision.conflict is not None
    assert decision.conflict.current_revision == 12
    assert decision.conflict.parent_revision == 10
    assert decision.undoable is False
    assert decision.inspectable is False


def test_q05_agent_commit_requires_matching_successful_dry_run_evidence() -> None:
    commands = [_wall_command()]
    digest = canonical_command_digest(commands)

    missing = assess_transaction_safety(
        current_revision=4,
        parent_revision=4,
        mode="commit",
        surface="mcp-mutation",
        actor_kind="agent",
        commands=commands,
    )
    assert missing.ok is False
    assert missing.reason_code == "dry_run_required"

    mismatch = assess_transaction_safety(
        current_revision=4,
        parent_revision=4,
        mode="commit",
        surface="mcp-mutation",
        actor_kind="agent",
        commands=commands,
        dry_run_evidence=DryRunEvidence(
            parent_revision=4,
            command_digest_sha256="0" * 64,
            ok=True,
            evidence_path="evidence/dry-run.json",
        ),
    )
    assert mismatch.ok is False
    assert mismatch.reason_code == "dry_run_command_mismatch"

    ok = assess_transaction_safety(
        current_revision=4,
        parent_revision=4,
        mode="commit",
        surface="mcp-mutation",
        actor_kind="agent",
        commands=commands,
        dry_run_evidence={
            "parentRevision": 4,
            "commandDigestSha256": digest,
            "ok": True,
            "evidencePath": "evidence/dry-run.json",
        },
    )
    assert ok.ok is True
    assert ok.dry_run_required is True
    assert ok.command_digest_sha256 == digest
    assert ok.undoable is True
    assert ok.inspectable is True


def test_q05_invalid_agent_remediation_commit_is_blocked_without_dry_run_match() -> None:
    dry_run_commands = [{"type": "setElementParameter", "elementId": "w-1", "mark": "A"}]
    commit_commands = [{"type": "setElementParameter", "elementId": "w-1", "mark": "B"}]
    evidence = build_dry_run_evidence(
        parent_revision=6,
        commands=dry_run_commands,
        ok=True,
        reason=None,
        violations=[],
        summary_before={"revision": 6},
        summary_after={"wouldRevision": 7},
    )

    decision = assess_transaction_safety(
        current_revision=6,
        parent_revision=6,
        mode="commit",
        surface="mcp-mutation",
        actor_kind="agent",
        commands=commit_commands,
        dry_run_evidence=evidence,
    )

    assert decision.ok is False
    assert decision.reason_code == "dry_run_command_mismatch"
    assert decision.command_digest_sha256 == canonical_command_digest(commit_commands)


def test_q05_valid_agent_remediation_commit_is_allowed_with_matching_dry_run() -> None:
    commands = [{"type": "setElementParameter", "elementId": "w-1", "mark": "A"}]
    evidence = build_dry_run_evidence(
        parent_revision=6,
        commands=commands,
        ok=True,
        reason=None,
        violations=[],
        summary_before={"revision": 6},
        summary_after={"wouldRevision": 7},
    )

    decision = assess_transaction_safety(
        current_revision=6,
        parent_revision=6,
        mode="commit",
        surface="mcp-mutation",
        actor_kind="agent",
        commands=commands,
        dry_run_evidence=evidence,
    )

    assert decision.ok is True
    assert decision.required_permission_scopes == ["mutation"]
    assert evidence["schemaVersion"] == "dryRunEvidence_v1"
    assert evidence["commandDigestSha256"] == canonical_command_digest(commands)
    assert evidence["summaryDigestSha256"]


def test_q02_undo_redo_contract_requires_inspectable_forward_and_inverse_commands() -> None:
    good = validate_undo_redo_contract(
        transaction_metadata={
            "revisionBefore": 3,
            "revisionAfter": 4,
            "changedIds": ["w-1"],
            "undo": {"available": True},
        },
        forward_commands=[_wall_command()],
        undo_commands=[{"type": "deleteElement", "elementId": "w-1"}],
    )
    assert good["ok"] is True
    assert good["undoable"] is True

    bad = validate_undo_redo_contract(
        transaction_metadata={
            "revisionBefore": 3,
            "revisionAfter": 3,
            "undo": {"available": False},
        },
        forward_commands=[],
        undo_commands=[],
    )
    assert bad["ok"] is False
    assert bad["failures"] == [
        "forward_commands_required",
        "undo_commands_required",
        "undo_metadata_available_required",
        "changed_ids_required",
        "revision_must_advance",
    ]


def test_q02_undo_redo_contract_preserves_integrity_metadata() -> None:
    original = {
        "action": "commit",
        "revisionAfter": 4,
        "transactionSafety": {"schemaVersion": "transactionSafety_v1", "ok": True},
        "dryRunEvidence": {"schemaVersion": "dryRunEvidence_v1", "ok": True},
        "sourceCommandLinks": [{"sourceCommandId": "sketch-wall-1"}],
    }
    preserved = build_undo_redo_integrity_metadata(
        original_transaction_metadata=original,
        action="undo",
        revision_before=4,
        revision_after=5,
    )
    metadata = {
        "revisionBefore": 4,
        "revisionAfter": 5,
        "changedIds": ["w-1"],
        "undo": {"available": True},
        "undoRedoIntegrityMetadata": preserved,
    }

    contract = validate_undo_redo_contract(
        transaction_metadata=metadata,
        forward_commands=[_wall_command()],
        undo_commands=[{"type": "deleteElement", "elementId": "w-1"}],
        original_transaction_metadata=original,
    )

    assert preserved["schemaVersion"] == "undoRedoIntegrityMetadata_v1"
    assert preserved["action"] == "undo"
    assert preserved["sourceAction"] == "commit"
    assert preserved["sourceRevisionAfter"] == 4
    assert preserved["preservedKeys"] == [
        "dryRunEvidence",
        "sourceCommandLinks",
        "transactionSafety",
    ]
    assert contract["ok"] is True
    assert contract["integrityMetadataPreserved"] is True


def test_q04_fix_safety_distinguishes_safe_review_destructive_and_user_intent() -> None:
    assert (
        classify_fix_safety({"ruleId": "tag_missing"}, [{"type": "placeTag"}]) == "safe_automatic"
    )
    assert classify_fix_safety({"ruleId": "wall_missing"}, [_wall_command()]) == "review_required"
    assert (
        classify_fix_safety(
            {"ruleId": "bad_host"},
            [{"type": "deleteElement", "elementId": "door-1"}],
        )
        == "destructive"
    )
    assert classify_fix_safety({"ruleId": "egress_choice"}, []) == "needs_user_intent"
    assert (
        classify_fix_safety({"ruleId": "layout", "requiresUserIntent": True}, [_wall_command()])
        == "needs_user_intent"
    )


def test_q06_agent_remediation_proposal_records_audit_provenance() -> None:
    proposal = build_agent_remediation_proposal(
        current_revision=12,
        findings=[
            {
                "id": "finding-1",
                "ruleId": "wall_missing_level",
                "elementIds": ["w-1"],
                "message": "Wall references a missing level.",
                "recommendation": "Move wall to an existing level.",
            }
        ],
        commands=[{"type": "setElementParameter", "elementId": "w-1", "levelId": "lvl-1"}],
        actor_identity=ActorIdentity(actor_kind="agent", actor_id="codex-worker-b"),
        evidence_path="evidence/w7-b/dry-run.json",
    )

    assert proposal["schemaVersion"] == "agentRemediationProposal_v1"
    assert proposal["parentRevision"] == 12
    assert proposal["dryRunRequired"] is True
    assert proposal["commitAllowedWithoutDryRun"] is False
    assert proposal["fixSafety"] == "safe_automatic"
    assert proposal["findingIds"] == ["finding-1"]
    assert proposal["affectedElementIds"] == ["w-1"]
    assert proposal["provenanceValidation"]["ok"] is True
    assert proposal["provenanceDigestSha256"]
    assert proposal["provenanceStorage"] == {
        "transactionMetadataKey": "remediation.provenance",
        "evidencePathRequired": True,
        "sourceCommandLinksPreservedByUndoRedo": True,
    }
    record = proposal["provenance"][0]
    assert record["sourceFindingId"] == "finding-1"
    assert record["actorIdentity"] == {
        "actorKind": "agent",
        "actorId": "codex-worker-b",
    }
    assert record["evidencePath"] == "evidence/w7-b/dry-run.json"


def test_q06_provenance_validation_flags_missing_required_audit_fields() -> None:
    result = validate_fix_provenance(
        [
            {
                "sourceFindingId": " ",
                "affectedElementIds": [],
                "beforeSummary": "",
                "afterSummary": "",
                "actorIdentity": {"actorKind": "agent", "actorId": ""},
                "evidencePath": "",
            }
        ]
    )

    assert result["ok"] is False
    assert [row["field"] for row in result["missing"]] == [
        "sourceFindingId",
        "affectedElementIds",
        "beforeSummary",
        "afterSummary",
        "actorIdentity.actorId",
        "evidencePath",
    ]


def test_q07_permission_scopes_include_mutation_export_external_and_destructive() -> None:
    scopes = infer_permission_scopes(
        [
            _wall_command(),
            {"type": "exportIfc", "path": "out.ifc"},
            {"type": "reloadLinkModel", "sourceUrl": "https://example.test/model.ifc"},
            {"type": "deleteElement", "elementId": "w-1"},
        ]
    )

    assert scopes == ["mutation", "export", "external_service", "destructive"]


def test_q08_failed_safety_gate_is_rollback_neutral_and_retry_guided() -> None:
    decision = assess_transaction_safety(
        current_revision=2,
        parent_revision=2,
        mode="commit",
        surface="mcp-mutation",
        actor_kind="agent",
        commands=[_wall_command()],
        dry_run_evidence={
            "parentRevision": 1,
            "commandDigestSha256": canonical_command_digest([_wall_command()]),
            "ok": True,
        },
    )

    assert decision.ok is False
    assert decision.reason_code == "dry_run_stale"
    assert decision.rollback_guidance == "Model remains unchanged; do not append undo or redo rows."
    assert "Run dry-run again" in decision.retry_guidance
