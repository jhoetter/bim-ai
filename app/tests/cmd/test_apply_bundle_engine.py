"""CMD-V3-01 — apply_bundle() pure-function acceptance tests."""

from __future__ import annotations

from bim_ai.cmd.apply_bundle import apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin

_VALID_ASSUMPTION = {
    "key": "ground_level_mm",
    "value": 0,
    "confidence": 0.95,
    "source": "brief",
}

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-g", "name": "Ground", "elevationMm": 0}


def _seed_doc(revision: int = 1) -> Document:
    doc = Document(revision=revision, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    return doc


def _bundle(**kwargs) -> CommandBundle:
    defaults = {
        "schemaVersion": "cmd-v3.0",
        "commands": [_CREATE_LEVEL],
        "assumptions": [_VALID_ASSUMPTION],
        "parentRevision": 1,
    }
    defaults.update(kwargs)
    return CommandBundle.model_validate(defaults)


class TestDryRun:
    def test_dry_run_returns_checkpoint_and_no_new_revision(self):
        doc = _seed_doc()
        result, _ = apply_bundle(doc, _bundle(), "dry_run")
        assert result.applied is False
        assert result.checkpoint_snapshot_id is not None
        assert len(result.checkpoint_snapshot_id) == 64  # SHA-256 hex
        assert result.new_revision is None

    def test_dry_run_does_not_mutate_doc(self):
        doc = _seed_doc()
        element_count_before = len(doc.elements)
        apply_bundle(doc, _bundle(), "dry_run")
        assert len(doc.elements) == element_count_before
        assert doc.revision == 1

    def test_dry_run_no_violations_for_valid_bundle(self):
        doc = _seed_doc()
        result, _ = apply_bundle(doc, _bundle(), "dry_run")
        blocking = [v for v in result.violations if v.get("blocking")]
        assert not blocking


class TestCommit:
    def test_commit_applied_true_and_revision_incremented(self):
        doc = _seed_doc()
        result, _ = apply_bundle(doc, _bundle(), "commit")
        assert result.applied is True
        assert result.new_revision == 2
        assert result.checkpoint_snapshot_id is not None

    def test_commit_does_not_mutate_original_doc(self):
        doc = _seed_doc()
        apply_bundle(doc, _bundle(), "commit")
        assert doc.revision == 1  # original untouched


class TestMissingAssumptions:
    def test_empty_assumptions_rejected(self):
        doc = _seed_doc()
        bundle = CommandBundle.model_validate({
            "schemaVersion": "cmd-v3.0",
            "commands": [_CREATE_LEVEL],
            "assumptions": [_VALID_ASSUMPTION],  # Pydantic requires min_length=1
            "parentRevision": 1,
        })
        # Force empty by bypassing validation
        object.__setattr__(bundle, "assumptions", [])
        result, _ = apply_bundle(doc, bundle, "dry_run")
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "assumption_log_required" in classes
        assert result.applied is False

    def test_duplicate_key_rejected(self):
        doc = _seed_doc()
        dup = [_VALID_ASSUMPTION, {**_VALID_ASSUMPTION}]
        bundle = _bundle(assumptions=dup)
        result, _ = apply_bundle(doc, bundle, "dry_run")
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "assumption_log_duplicate_key" in classes
        assert result.applied is False


class TestRevisionGuard:
    def test_stale_revision_rejected(self):
        doc = _seed_doc(revision=5)
        bundle = _bundle(parentRevision=3)
        result, _ = apply_bundle(doc, bundle, "dry_run")
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "revision_conflict" in classes
        assert result.applied is False

    def test_matching_revision_accepted(self):
        doc = _seed_doc(revision=5)
        bundle = _bundle(parentRevision=5)
        result, _ = apply_bundle(doc, bundle, "commit")
        assert result.applied is True


class TestTargetOptionId:
    def test_main_always_rejected(self):
        doc = _seed_doc()
        bundle = _bundle(targetOptionId="main")
        result, _ = apply_bundle(doc, bundle, "commit")
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "direct_main_commit_forbidden" in classes
        assert result.applied is False

    def test_non_main_option_id_rejected_with_not_implemented(self):
        doc = _seed_doc()
        bundle = _bundle(targetOptionId="opt-123")
        result, _ = apply_bundle(doc, bundle, "commit")
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "option_routing_not_yet_implemented" in classes
        assert result.applied is False


class TestTolerateMode:
    def test_tolerances_field_accepted_and_commit_proceeds(self):
        doc = _seed_doc()
        bundle = _bundle(tolerances=[{"advisoryClass": "info_advisory", "reason": "accepted"}])
        result, _ = apply_bundle(doc, bundle, "commit")
        assert result.applied is True
        assert result.new_revision == 2


class TestIdempotentReplay:
    def test_same_bundle_stale_after_first_commit(self):
        """After applying once, replaying the same bundle hits revision_conflict."""
        doc = _seed_doc()
        bundle = _bundle()
        first, _ = apply_bundle(doc, bundle, "commit")
        assert first.applied is True
        # doc is pure / unchanged — simulate the world where revision advanced
        new_doc = Document(revision=first.new_revision, elements=doc.elements)  # type: ignore[arg-type]
        second, _ = apply_bundle(new_doc, bundle, "commit")
        # parentRevision=1 but new_doc.revision=2 → conflict
        classes = {v.get("advisoryClass") for v in second.violations}
        assert "revision_conflict" in classes
        assert second.applied is False


class TestCheckpointDeterminism:
    def test_checkpoint_present_on_dry_run(self):
        doc = _seed_doc()
        result, _ = apply_bundle(doc, _bundle(), "dry_run")
        assert result.checkpoint_snapshot_id is not None
        assert len(result.checkpoint_snapshot_id) == 64

    def test_failure_path_checkpoint_is_deterministic(self):
        """On assumption failure the checkpoint is hash(doc.elements) — always repeatable."""
        doc = _seed_doc()
        stale_bundle = _bundle(parentRevision=99)
        r_a, _ = apply_bundle(doc, stale_bundle, "dry_run")
        r_b, _ = apply_bundle(doc, stale_bundle, "dry_run")
        assert r_a.checkpoint_snapshot_id == r_b.checkpoint_snapshot_id
