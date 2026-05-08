"""CMD-V3-01 — Pydantic type round-trips for CommandBundle / BundleResult."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from bim_ai.cmd.types import AssumptionEntry, BundleResult, CommandBundle

_VALID_ASSUMPTION = {
    "key": "site_width_m",
    "value": 15.0,
    "confidence": 0.9,
    "source": "brief",
}


class TestAssumptionEntry:
    def test_valid_round_trip(self):
        entry = AssumptionEntry.model_validate(_VALID_ASSUMPTION)
        assert entry.key == "site_width_m"
        assert entry.confidence == 0.9
        assert entry.contestable is True
        assert entry.evidence is None

    def test_confidence_bounds_zero(self):
        AssumptionEntry.model_validate({**_VALID_ASSUMPTION, "confidence": 0.0})

    def test_confidence_bounds_one(self):
        AssumptionEntry.model_validate({**_VALID_ASSUMPTION, "confidence": 1.0})

    def test_confidence_out_of_range_high(self):
        with pytest.raises(ValidationError):
            AssumptionEntry.model_validate({**_VALID_ASSUMPTION, "confidence": 1.01})

    def test_confidence_out_of_range_low(self):
        with pytest.raises(ValidationError):
            AssumptionEntry.model_validate({**_VALID_ASSUMPTION, "confidence": -0.01})

    def test_empty_key_rejected(self):
        with pytest.raises(ValidationError):
            AssumptionEntry.model_validate({**_VALID_ASSUMPTION, "key": ""})

    def test_missing_key_rejected(self):
        with pytest.raises(ValidationError):
            data = {k: v for k, v in _VALID_ASSUMPTION.items() if k != "key"}
            AssumptionEntry.model_validate(data)

    def test_optional_evidence_populated(self):
        entry = AssumptionEntry.model_validate({**_VALID_ASSUMPTION, "evidence": "page 3 of brief"})
        assert entry.evidence == "page 3 of brief"


class TestCommandBundle:
    def _make(self, **overrides):
        data = {
            "schemaVersion": "cmd-v3.0",
            "commands": [{"type": "createLevel", "id": "lvl", "name": "G", "elevationMm": 0}],
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": 1,
        }
        data.update(overrides)
        return CommandBundle.model_validate(data)

    def test_valid_round_trip(self):
        bundle = self._make()
        assert bundle.schema_version == "cmd-v3.0"
        assert bundle.parent_revision == 1
        assert len(bundle.assumptions) == 1
        assert bundle.target_option_id is None
        assert bundle.tolerances is None

    def test_camel_case_alias_parentRevision(self):
        bundle = CommandBundle.model_validate({
            "schemaVersion": "cmd-v3.0",
            "commands": [],
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": 42,
        })
        assert bundle.parent_revision == 42

    def test_empty_assumptions_rejected(self):
        with pytest.raises(ValidationError):
            self._make(assumptions=[])

    def test_wrong_schema_version_rejected(self):
        with pytest.raises(ValidationError):
            self._make(schemaVersion="v1")

    def test_tolerances_accepted(self):
        bundle = self._make(tolerances=[{"advisoryClass": "constraint_error", "reason": "ok"}])
        assert bundle.tolerances is not None
        assert bundle.tolerances[0].advisory_class == "constraint_error"

    def test_target_option_id_accepted(self):
        bundle = self._make(targetOptionId="opt-abc")
        assert bundle.target_option_id == "opt-abc"

    def test_model_dump_uses_aliases(self):
        bundle = self._make()
        wire = bundle.model_dump(by_alias=True)
        assert "parentRevision" in wire
        assert "schemaVersion" in wire


class TestBundleResult:
    def test_applied_true(self):
        result = BundleResult(applied=True, new_revision=2, violations=[])
        assert result.applied is True
        assert result.new_revision == 2

    def test_applied_false(self):
        result = BundleResult(applied=False, violations=[{"advisoryClass": "revision_conflict"}])
        assert result.applied is False
        assert result.new_revision is None

    def test_dump_by_alias(self):
        result = BundleResult(
            applied=True,
            new_revision=3,
            checkpoint_snapshot_id="abc123",
            violations=[],
        )
        wire = result.model_dump(by_alias=True)
        assert wire["applied"] is True
        assert wire["newRevision"] == 3
        assert wire["checkpointSnapshotId"] == "abc123"
        assert wire["schemaVersion"] == "cmd-v3.0"
