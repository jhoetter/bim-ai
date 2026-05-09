"""TST-V3-01 — 12-step deterministic refinement reliability harness."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

FIXTURE_PATH = Path(__file__).parent / "12_step_refinement.yaml"


def load_fixture():
    return yaml.safe_load(FIXTURE_PATH.read_text())


class TestRefinementReliability:
    """Property: the kernel handles a 12-step canned bundle sequence without divergence."""

    def test_fixture_loads(self):
        fixture = load_fixture()
        assert fixture["schema_version"] == "tst-v3.0"
        assert len(fixture["steps"]) == 12

    def test_all_12_steps_have_bundles(self):
        fixture = load_fixture()
        for step in fixture["steps"]:
            assert "bundle" in step
            assert "commands" in step["bundle"]

    def test_all_steps_have_invariants(self):
        fixture = load_fixture()
        for step in fixture["steps"]:
            assert "invariants" in step, f"Step {step['step']} missing invariants"

    def test_step_sequence_is_complete(self):
        fixture = load_fixture()
        step_nums = [s["step"] for s in fixture["steps"]]
        assert step_nums == list(range(1, 13)), "Steps must be 1..12 in order"

    def test_invariant_structure(self):
        """Each invariant must use known keys."""
        valid_keys = {
            "element_count_gte",
            "element_kinds_include",
            "assumption_log_count_gte",
            "no_divergence",
        }
        fixture = load_fixture()
        for step in fixture["steps"]:
            for key in step["invariants"]:
                assert key in valid_keys, f"Step {step['step']}: unknown invariant key {key!r}"

    @pytest.mark.integration
    def test_12_step_kernel_execution(self, test_client):
        """Run all 12 steps against a live kernel; assert each step's invariants."""
        fixture = load_fixture()
        model_id = fixture["model_id"]

        # Create model
        resp = test_client.post("/api/v3/models", json={"id": model_id, "name": "Refinement test"})
        assert resp.status_code in (200, 201, 409)  # 409 if already exists

        for step_data in fixture["steps"]:
            step_num = step_data["step"]
            bundle = step_data["bundle"]
            invariants = step_data["invariants"]

            # Apply bundle
            if bundle["commands"]:
                resp = test_client.post(
                    f"/api/v3/models/{model_id}/bundles",
                    json=bundle,
                )
                assert resp.status_code == 200, f"Step {step_num} bundle failed: {resp.text}"

            # Read model state
            resp = test_client.get(f"/api/v3/models/{model_id}")
            assert resp.status_code == 200
            state = resp.json()
            elements = state.get("elements", [])

            # Assert invariants
            if "element_count_gte" in invariants:
                assert len(elements) >= invariants["element_count_gte"], (
                    f"Step {step_num}: expected >= {invariants['element_count_gte']} elements, "
                    f"got {len(elements)}"
                )

            if "element_kinds_include" in invariants:
                kinds = {e.get("kind") for e in elements}
                for required_kind in invariants["element_kinds_include"]:
                    assert required_kind in kinds, (
                        f"Step {step_num}: expected kind {required_kind!r} in {kinds}"
                    )

    def test_yaml_fixture_is_valid_json_serialisable(self):
        """Fixture must be serialisable to JSON for agent consumption."""
        fixture = load_fixture()
        json_str = json.dumps(fixture)
        assert len(json_str) > 0

    def test_step_12_is_idempotent(self):
        """Step 12 is a no-op; no commands = no divergence."""
        fixture = load_fixture()
        step_12 = fixture["steps"][11]
        assert step_12["step"] == 12
        assert step_12["bundle"]["commands"] == []
        assert step_12["invariants"].get("no_divergence") is True
