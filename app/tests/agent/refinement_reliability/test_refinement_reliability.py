"""TST-V3-01 — 12-step deterministic refinement reliability harness."""

from __future__ import annotations

import json
import math
import time
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

from bim_ai.api.registry import get_catalog
from bim_ai.cmd.apply_bundle import apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.elements import AgentAssumptionElem, WallElem
from bim_ai.engine import diff_undo_cmds, try_commit_bundle
from bim_ai.tkn import decode, encode
from bim_ai.tkn.types import TokenSequence
from bim_ai.vg.compare import compare_snapshots

FIXTURE_PATH = Path(__file__).parent / "12_step_refinement.yaml"
_FLOAT_EPSILON = 1e-6


def load_fixture() -> dict[str, Any]:
    return yaml.safe_load(FIXTURE_PATH.read_text())


def _stable_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _wire_elements(doc: Document) -> dict[str, Any]:
    return {
        eid: elem.model_dump(mode="json", by_alias=True)
        for eid, elem in sorted(doc.elements.items())
    }


def _canonical_elements(doc: Document) -> str:
    return _stable_json(_wire_elements(doc))


def _snapshot_for_compare(doc: Document, expected_ids: dict[str, str]) -> dict[str, Any]:
    elements: dict[str, dict[str, str]] = {}
    for eid, expected_kind in sorted(expected_ids.items()):
        elem = doc.elements[eid]
        elements[eid] = {"id": eid, "kind": elem.kind}
        assert elem.kind == expected_kind
    return {"elements": elements}


def _expected_snapshot(expected_ids: dict[str, str]) -> dict[str, Any]:
    return {
        "elements": {eid: {"id": eid, "kind": kind} for eid, kind in sorted(expected_ids.items())}
    }


def _option_ids(doc: Document) -> set[str]:
    return {option.id for option_set in doc.design_option_sets for option in option_set.options}


def _agent_proposal_option_ids(doc: Document) -> set[str]:
    proposals = next(
        (
            option_set
            for option_set in doc.design_option_sets
            if option_set.name == "Agent proposals"
        ),
        None,
    )
    return {option.id for option in proposals.options} if proposals is not None else set()


def _blocking_classes(result: Any) -> set[str]:
    return {
        str(v.get("advisoryClass") or v.get("ruleId") or "")
        for v in result.violations
        if v.get("blocking") or v.get("severity") == "error"
    }


def _bundle_for_step(doc: Document, step: dict[str, Any]) -> CommandBundle:
    raw_bundle = dict(step["bundle"])
    raw_bundle.update(
        {
            "schemaVersion": "cmd-v3.0",
            "parentRevision": doc.revision,
        }
    )
    return CommandBundle.model_validate(raw_bundle)


def _assert_invariants(doc: Document, invariants: dict[str, Any]) -> None:
    if "element_count_gte" in invariants:
        assert len(doc.elements) >= int(invariants["element_count_gte"])

    if "element_kinds_include" in invariants:
        kinds = {elem.kind for elem in doc.elements.values()}
        for required_kind in invariants["element_kinds_include"]:
            assert required_kind in kinds

    if "element_ids_include" in invariants:
        for eid, expected_kind in invariants["element_ids_include"].items():
            assert eid in doc.elements
            assert doc.elements[eid].kind == expected_kind

    if "wall_lengths_mm" in invariants:
        for eid, expected_length in invariants["wall_lengths_mm"].items():
            wall = doc.elements[eid]
            assert isinstance(wall, WallElem)
            dx = wall.end.x_mm - wall.start.x_mm
            dy = wall.end.y_mm - wall.start.y_mm
            assert math.isclose(
                math.hypot(dx, dy),
                float(expected_length),
                abs_tol=_FLOAT_EPSILON,
            )

    if "agent_assumption_count_gte" in invariants:
        count = sum(isinstance(elem, AgentAssumptionElem) for elem in doc.elements.values())
        assert count >= int(invariants["agent_assumption_count_gte"])

    if "design_option_sets_include" in invariants:
        sets_by_id = {option_set.id: option_set for option_set in doc.design_option_sets}
        for set_id, expected_name in invariants["design_option_sets_include"].items():
            assert set_id in sets_by_id
            assert sets_by_id[set_id].name == expected_name


def _assert_tkn_round_trip_byte_identical(doc: Document) -> None:
    seq_a = encode(doc.elements)
    wire_a = _stable_json(seq_a.model_dump(mode="json", by_alias=True))
    reloaded = TokenSequence.model_validate(json.loads(wire_a))
    replay_commands = decode(reloaded, doc.elements)
    assert replay_commands == []
    seq_b = encode(doc.elements)
    wire_b = _stable_json(seq_b.model_dump(mode="json", by_alias=True))
    assert wire_b == wire_a


def _assert_api_tool_surface_registered() -> None:
    tools = {tool.name: tool for tool in get_catalog().tools}
    assert "apply-bundle" in tools
    assert "compare-snapshots" in tools
    assert tools["apply-bundle"].restEndpoint.path == "/api/models/{model_id}/bundles"
    assert tools["compare-snapshots"].restEndpoint.path == "/api/v3/compare"


class TestRefinementReliability:
    """Property: the kernel handles a 12-step canned bundle sequence without divergence."""

    def test_fixture_loads(self) -> None:
        fixture = load_fixture()
        assert fixture["schema_version"] == "tst-v3.0"
        assert fixture["model_id"] == "test-model-refinement"
        assert len(fixture["steps"]) == 12

    def test_all_12_steps_have_bundles_and_assumptions(self) -> None:
        fixture = load_fixture()
        for step in fixture["steps"]:
            assert "bundle" in step
            assert "commands" in step["bundle"]
            assert step["bundle"]["assumptions"], f"Step {step['step']} missing assumptions"

    def test_all_steps_have_invariants(self) -> None:
        fixture = load_fixture()
        for step in fixture["steps"]:
            assert "invariants" in step, f"Step {step['step']} missing invariants"

    def test_step_sequence_is_complete(self) -> None:
        fixture = load_fixture()
        step_nums = [s["step"] for s in fixture["steps"]]
        assert step_nums == list(range(1, 13)), "Steps must be 1..12 in order"

    def test_invariant_structure(self) -> None:
        valid_keys = {
            "agent_assumption_count_gte",
            "design_option_sets_include",
            "element_count_gte",
            "element_ids_include",
            "element_kinds_include",
            "no_divergence",
            "tkn_round_trip_byte_identical",
            "wall_lengths_mm",
        }
        fixture = load_fixture()
        for step in fixture["steps"]:
            for key in step["invariants"]:
                assert key in valid_keys, f"Step {step['step']}: unknown invariant key {key!r}"

    def test_yaml_fixture_is_valid_json_serialisable(self) -> None:
        fixture = load_fixture()
        assert json.dumps(fixture)

    def test_12_step_kernel_tool_surface_reliability(self, tmp_path: Path) -> None:
        """Run the full TST-V3-01 property gate against real CMD/TKN/VG modules."""
        started = time.perf_counter()
        fixture = load_fixture()
        _assert_api_tool_surface_registered()
        compare_cfg = fixture["compare"]
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        step_docs: dict[int, Document] = {}
        proposal_counts: list[int] = []

        for step in fixture["steps"]:
            step_num = int(step["step"])
            bundle = _bundle_for_step(doc, step)
            pre_wire = _canonical_elements(doc)
            pre_proposal_options = _agent_proposal_option_ids(doc)

            dry_result, dry_doc = apply_bundle(doc, bundle, "dry_run", submitter="agent")
            assert dry_doc is None
            assert dry_result.applied is False
            assert _blocking_classes(dry_result) == set()
            assert _canonical_elements(doc) == pre_wire

            result, new_doc = apply_bundle(
                doc,
                bundle,
                "commit",
                submitter="agent",
            )
            assert result.applied is True, (step_num, result.violations)
            assert _blocking_classes(result) == set()
            assert result.new_revision == doc.revision + 1
            assert result.option_id is not None
            assert new_doc is not None

            post_proposal_options = _agent_proposal_option_ids(new_doc)
            assert result.option_id in post_proposal_options
            assert result.option_id not in pre_proposal_options
            assert len(post_proposal_options) == len(pre_proposal_options) + 1
            assert len(_option_ids(new_doc)) >= len(_option_ids(doc)) + 1

            proposals = next(s for s in new_doc.design_option_sets if s.name == "Agent proposals")
            proposal = next(o for o in proposals.options if o.id == result.option_id)
            assert proposal.provenance is not None
            assert proposal.provenance.submitter == "agent"

            _assert_invariants(new_doc, step["invariants"])

            expected_ids = step["invariants"].get("element_ids_include", {})
            if expected_ids:
                expected = _expected_snapshot(expected_ids)
                actual = _snapshot_for_compare(new_doc, expected_ids)
                compare_output_dir = tmp_path / f"step-{step_num:02d}"
                comparison = compare_snapshots(
                    expected,
                    actual,
                    metric=compare_cfg["metric"],
                    threshold=float(compare_cfg["threshold"]),
                    output_dir=compare_output_dir,
                )
                comparison_again = compare_snapshots(
                    expected,
                    actual,
                    metric=compare_cfg["metric"],
                    threshold=float(compare_cfg["threshold"]),
                    output_dir=compare_output_dir,
                )
                assert _stable_json(comparison) == _stable_json(comparison_again)
                assert comparison["thresholdPassed"] is True
                assert comparison["score"] >= float(compare_cfg["threshold"])
                assert Path(comparison["prePngPath"]).is_file()
                assert Path(comparison["postPngPath"]).is_file()
                assert Path(comparison["diffPngPath"]).is_file()

            if step["invariants"].get("tkn_round_trip_byte_identical"):
                _assert_tkn_round_trip_byte_identical(new_doc)

            doc = new_doc
            step_docs[step_num] = new_doc
            proposal_counts.append(len(post_proposal_options))

        assert proposal_counts == list(range(1, 13))
        assert Counter(elem.kind for elem in doc.elements.values())["agent_assumption"] >= 1

        step_5_doc = step_docs[5]
        final_doc = step_docs[12]
        undo_to_step_5 = diff_undo_cmds(step_5_doc, final_doc)
        ok, reverted, _cmds, violations, code = try_commit_bundle(final_doc, undo_to_step_5)
        assert ok is True, (code, [v.model_dump(by_alias=True) for v in violations])
        assert reverted is not None
        assert _canonical_elements(reverted) == _canonical_elements(step_5_doc)

        assert time.perf_counter() - started < 120
