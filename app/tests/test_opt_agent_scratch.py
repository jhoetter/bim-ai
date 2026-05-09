"""OPT-V3-01 — agent scratch surface + non-destruction invariant tests."""

from __future__ import annotations

import re

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
_CREATE_WALL = {
    "type": "createWall",
    "id": "w-1",
    "name": "Wall 1",
    "levelId": "lvl-g",
    "start": {"xMm": 0, "yMm": 0},
    "end": {"xMm": 5000, "yMm": 0},
    "thicknessMm": 200,
    "heightMm": 3000,
}


def _seed_doc(revision: int = 1) -> Document:
    doc = Document(revision=revision, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    return doc


def _bundle(commands: list | None = None, **kwargs) -> CommandBundle:
    defaults: dict = {
        "schemaVersion": "cmd-v3.0",
        "commands": commands if commands is not None else [_CREATE_LEVEL],
        "assumptions": [_VALID_ASSUMPTION],
        "parentRevision": 1,
    }
    defaults.update(kwargs)
    return CommandBundle.model_validate(defaults)


class TestAutoRoute:
    def test_no_target_option_id_creates_agent_proposals_set(self):
        doc = _seed_doc()
        result, new_doc = apply_bundle(doc, _bundle(), "commit")
        assert result.applied is True
        assert new_doc is not None
        set_names = [s.name for s in new_doc.design_option_sets]
        assert "Agent proposals" in set_names

    def test_no_target_option_id_creates_option_with_provenance(self):
        doc = _seed_doc()
        result, new_doc = apply_bundle(doc, _bundle(), "commit")
        assert result.applied is True
        assert result.option_id is not None
        assert new_doc is not None
        proposals_set = next(s for s in new_doc.design_option_sets if s.name == "Agent proposals")
        option = next((o for o in proposals_set.options if o.id == result.option_id), None)
        assert option is not None
        assert option.provenance is not None
        assert option.provenance.submitter == "human"

    def test_agent_submitter_records_agent_provenance(self):
        doc = _seed_doc()
        result, new_doc = apply_bundle(doc, _bundle(), "commit", submitter="agent")
        assert result.applied is True
        assert new_doc is not None
        proposals_set = next(s for s in new_doc.design_option_sets if s.name == "Agent proposals")
        option = next(o for o in proposals_set.options if o.id == result.option_id)
        assert option.provenance is not None
        assert option.provenance.submitter == "agent"

    def test_two_consecutive_agent_bundles_create_sibling_options(self):
        doc = _seed_doc()
        bundle1 = _bundle(
            commands=[{"type": "createLevel", "id": "lvl-1", "name": "L1", "elevationMm": 0}]
        )
        result1, new_doc1 = apply_bundle(doc, bundle1, "commit", submitter="agent")
        assert result1.applied is True
        assert new_doc1 is not None

        bundle2 = _bundle(
            commands=[{"type": "createLevel", "id": "lvl-2", "name": "L2", "elevationMm": 3000}],
            parentRevision=result1.new_revision,
        )
        result2, new_doc2 = apply_bundle(new_doc1, bundle2, "commit", submitter="agent")
        assert result2.applied is True
        assert new_doc2 is not None

        proposals_set = next(
            s for s in new_doc2.design_option_sets if s.name == "Agent proposals"
        )
        assert len(proposals_set.options) == 2
        option_ids = {o.id for o in proposals_set.options}
        assert result1.option_id in option_ids
        assert result2.option_id in option_ids

    def test_provenance_bundle_id_is_a_valid_uuid(self):
        doc = _seed_doc()
        result, new_doc = apply_bundle(doc, _bundle(), "commit")
        assert result.applied is True
        assert new_doc is not None
        proposals_set = next(s for s in new_doc.design_option_sets if s.name == "Agent proposals")
        option = next(o for o in proposals_set.options if o.id == result.option_id)
        assert option.provenance is not None
        assert re.match(r"^[0-9a-f\-]{36}$", option.provenance.bundle_id)

    def test_option_name_contains_timestamp(self):
        doc = _seed_doc()
        result, new_doc = apply_bundle(doc, _bundle(), "commit")
        assert new_doc is not None
        proposals_set = next(s for s in new_doc.design_option_sets if s.name == "Agent proposals")
        option = next(o for o in proposals_set.options if o.id == result.option_id)
        assert option.name.startswith("Proposal ")

    def test_dry_run_does_not_create_option_set(self):
        doc = _seed_doc()
        result, new_doc = apply_bundle(doc, _bundle(), "dry_run")
        assert result.applied is False
        assert new_doc is None
        assert len(doc.design_option_sets) == 0


class TestMainCommit:
    def test_main_target_human_commits_to_main(self):
        doc = _seed_doc()
        bundle = _bundle(targetOptionId="main")
        result, new_doc = apply_bundle(doc, bundle, "commit", submitter="human")
        assert result.applied is True
        assert new_doc is not None
        set_names = [s.name for s in new_doc.design_option_sets]
        assert "Agent proposals" not in set_names
        assert result.option_id is None

    def test_main_target_ci_commits_to_main(self):
        doc = _seed_doc()
        bundle = _bundle(targetOptionId="main")
        result, new_doc = apply_bundle(doc, bundle, "commit", submitter="ci")
        assert result.applied is True
        assert new_doc is not None

    def test_main_target_agent_rejected(self):
        doc = _seed_doc()
        bundle = _bundle(targetOptionId="main")
        result, new_doc = apply_bundle(doc, bundle, "commit", submitter="agent")
        assert result.applied is False
        assert new_doc is None
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "direct_main_commit_forbidden" in classes

    def test_main_rejected_agent_is_blocking(self):
        doc = _seed_doc()
        bundle = _bundle(targetOptionId="main")
        result, _ = apply_bundle(doc, bundle, "commit", submitter="agent")
        blocking = [v for v in result.violations if v.get("blocking")]
        assert blocking


class TestOptionDeletion:
    def test_remove_option_does_not_affect_sibling_option(self):
        doc = _seed_doc()
        # Create a set with 2 options via human commit to main
        setup = _bundle(
            commands=[
                {"type": "createOptionSet", "id": "set-1", "name": "Test Options"},
                {
                    "type": "addOption",
                    "optionSetId": "set-1",
                    "optionId": "opt-a",
                    "name": "A",
                    "isPrimary": True,
                },
                {
                    "type": "addOption",
                    "optionSetId": "set-1",
                    "optionId": "opt-b",
                    "name": "B",
                },
            ],
            targetOptionId="main",
        )
        r1, doc1 = apply_bundle(doc, setup, "commit", submitter="human")
        assert r1.applied
        assert doc1 is not None

        # Remove opt-b
        remove = _bundle(
            commands=[
                {"type": "removeOption", "optionSetId": "set-1", "optionId": "opt-b"}
            ],
            parentRevision=r1.new_revision,
            targetOptionId="main",
        )
        r2, doc2 = apply_bundle(doc1, remove, "commit", submitter="human")
        assert r2.applied
        assert doc2 is not None

        the_set = next(s for s in doc2.design_option_sets if s.id == "set-1")
        assert len(the_set.options) == 1
        assert the_set.options[0].id == "opt-a"

    def test_remove_option_does_not_affect_main_elements(self):
        doc = _seed_doc()
        # Create a set with 2 options + a level element in main
        setup = _bundle(
            commands=[
                {"type": "createLevel", "id": "lvl-main", "name": "Main Level", "elevationMm": 0},
                {"type": "createOptionSet", "id": "set-1", "name": "Test Options"},
                {
                    "type": "addOption",
                    "optionSetId": "set-1",
                    "optionId": "opt-a",
                    "name": "A",
                    "isPrimary": True,
                },
                {
                    "type": "addOption",
                    "optionSetId": "set-1",
                    "optionId": "opt-b",
                    "name": "B",
                },
            ],
            targetOptionId="main",
        )
        r1, doc1 = apply_bundle(doc, setup, "commit", submitter="human")
        assert r1.applied
        assert doc1 is not None

        remove = _bundle(
            commands=[
                {"type": "removeOption", "optionSetId": "set-1", "optionId": "opt-b"}
            ],
            parentRevision=r1.new_revision,
            targetOptionId="main",
        )
        r2, doc2 = apply_bundle(doc1, remove, "commit", submitter="human")
        assert r2.applied
        assert doc2 is not None

        # Main level is still present
        assert "lvl-main" in doc2.elements


class TestUnknownOptionTarget:
    def test_nonexistent_option_id_returns_option_not_found(self):
        doc = _seed_doc()
        bundle = _bundle(targetOptionId="opt-does-not-exist")
        result, _ = apply_bundle(doc, bundle, "commit")
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "option_not_found" in classes
        assert result.applied is False
