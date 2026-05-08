"""CMD-V3-02 — AssumptionLog + AgentTrace acceptance tests."""

from __future__ import annotations

import json

from bim_ai.cmd.apply_bundle import apply_bundle
from bim_ai.cmd.types import AgentTrace, AssumptionEntry, CommandBundle
from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin

_VALID_ASSUMPTION = {
    "key": "ground_level_mm",
    "value": 0,
    "confidence": 0.95,
    "source": "brief",
}
_SECOND_ASSUMPTION = {
    "key": "floor_height_mm",
    "value": 3000,
    "confidence": 0.8,
    "source": "code",
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


def _seed_doc(revision: int = 1) -> Document:
    doc = Document(revision=revision, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    return doc


def _seed_doc_with_level() -> Document:
    """Commit a level so walls can reference it (revision 2 on exit)."""
    doc = _seed_doc()
    level_bundle = CommandBundle.model_validate({
        "schemaVersion": "cmd-v3.0",
        "commands": [_CREATE_LEVEL],
        "assumptions": [_VALID_ASSUMPTION],
        "parentRevision": 1,
    })
    result, new_doc = apply_bundle(doc, level_bundle, "commit")
    assert result.applied and new_doc is not None
    return new_doc


def _bundle(**kwargs) -> CommandBundle:
    defaults = {
        "schemaVersion": "cmd-v3.0",
        "commands": [_CREATE_LEVEL],
        "assumptions": [_VALID_ASSUMPTION],
        "parentRevision": 1,
    }
    defaults.update(kwargs)
    return CommandBundle.model_validate(defaults)


class TestAgentTraceOnCommit:
    def test_agent_trace_attached_on_commit(self):
        doc = _seed_doc_with_level()
        wall_bundle = CommandBundle.model_validate({
            "schemaVersion": "cmd-v3.0",
            "commands": [_CREATE_WALL],
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": doc.revision,
        })
        result, new_doc = apply_bundle(doc, wall_bundle, "commit")
        assert result.applied is True
        assert new_doc is not None
        traced = [e for e in new_doc.elements.values() if getattr(e, "agent_trace", None) is not None]
        assert len(traced) >= 1

    def test_agent_trace_not_attached_on_dry_run(self):
        doc = _seed_doc()
        result, new_doc = apply_bundle(doc, _bundle(), "dry_run")
        assert result.applied is False
        assert new_doc is None

    def test_assumption_keys_match_bundle(self):
        doc = _seed_doc_with_level()
        wall_bundle = CommandBundle.model_validate({
            "schemaVersion": "cmd-v3.0",
            "commands": [_CREATE_WALL],
            "assumptions": [_VALID_ASSUMPTION, _SECOND_ASSUMPTION],
            "parentRevision": doc.revision,
        })
        result, new_doc = apply_bundle(doc, wall_bundle, "commit")
        assert result.applied is True
        assert new_doc is not None
        traced = [e for e in new_doc.elements.values() if getattr(e, "agent_trace", None) is not None]
        assert traced, "expected at least one traced element"
        trace = traced[0].agent_trace
        assert set(trace.assumption_keys) == {"ground_level_mm", "floor_height_mm"}


class TestAuditLog:
    def test_audit_log_written_on_commit(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        doc = _seed_doc()
        result, new_doc = apply_bundle(doc, _bundle(), "commit", model_id="model-abc")
        assert result.applied is True
        audit_file = tmp_path / "data" / "models" / "model-abc" / "audit" / "assumptions.jsonl"
        assert audit_file.exists(), "audit JSONL was not created"
        records = [json.loads(line) for line in audit_file.read_text().splitlines() if line.strip()]
        assert len(records) == 1
        assert records[0]["assumptions"][0]["key"] == "ground_level_mm"

    def test_audit_log_not_written_on_dry_run(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        doc = _seed_doc()
        apply_bundle(doc, _bundle(), "dry_run", model_id="model-xyz")
        audit_file = tmp_path / "data" / "models" / "model-xyz" / "audit" / "assumptions.jsonl"
        assert not audit_file.exists()


class TestAgentTraceModel:
    def test_agent_trace_field_is_none_by_default(self):
        doc = _seed_doc()
        for elem in doc.elements.values():
            if hasattr(elem, "agent_trace"):
                assert elem.agent_trace is None

    def test_agent_trace_round_trips(self):
        trace = AgentTrace(
            bundle_id="bundle-001",
            assumption_keys=["key_a", "key_b"],
            applied_at="2026-01-01T00:00:00+00:00",
        )
        as_dict = trace.model_dump(by_alias=True)
        assert as_dict["bundleId"] == "bundle-001"
        assert as_dict["assumptionKeys"] == ["key_a", "key_b"]
        assert as_dict["appliedAt"] == "2026-01-01T00:00:00+00:00"
        rehydrated = AgentTrace.model_validate(as_dict)
        assert rehydrated.bundle_id == trace.bundle_id
        assert rehydrated.assumption_keys == trace.assumption_keys


class TestAssumptionValidation:
    def test_bundle_without_assumptions_rejected(self):
        doc = _seed_doc()
        bundle = CommandBundle.model_validate({
            "schemaVersion": "cmd-v3.0",
            "commands": [_CREATE_LEVEL],
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": 1,
        })
        object.__setattr__(bundle, "assumptions", [])
        result, new_doc = apply_bundle(doc, bundle, "dry_run")
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "assumption_log_required" in classes
        assert result.applied is False
        assert new_doc is None

    def test_bundle_with_malformed_assumptions_rejected(self):
        doc = _seed_doc()
        bundle = _bundle()
        # Bypass Pydantic validation to inject a malformed entry (confidence > 1)
        bad_entry = AssumptionEntry.model_construct(
            key="k", value=1, confidence=1.5, source="test"
        )
        object.__setattr__(bundle, "assumptions", [bad_entry])
        result, new_doc = apply_bundle(doc, bundle, "dry_run")
        classes = {v.get("advisoryClass") for v in result.violations}
        assert "assumption_log_malformed" in classes
        assert result.applied is False
        assert new_doc is None
