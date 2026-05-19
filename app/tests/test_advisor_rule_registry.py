from __future__ import annotations

from dataclasses import replace
from pathlib import Path

from bim_ai.advisor_rule_registry import (
    ADVISOR_RULES,
    CANONICAL_RULE_SURFACES,
    advisor_rule_by_id,
    advisor_rule_catalog_payload,
    advisor_rule_payloads,
    advisor_rules_for_profile,
    render_advisor_rule_ledger,
    validate_advisor_rule_registry,
)


def test_registry_is_valid() -> None:
    assert validate_advisor_rule_registry() == []


def test_registry_rule_ids_are_unique_and_sorted() -> None:
    ids = [rule.rule_id for rule in ADVISOR_RULES]
    assert len(ids) == len(set(ids))
    assert ids == sorted(ids)


def test_required_seed_rules_are_present() -> None:
    expected = {
        "bim_invariant_failure",
        "hosted_door_not_embedded",
        "physical_helper_leakage",
        "host_wall_outside_envelope",
        "renderer_unsupported_cut",
        "sketch_evidence_stale",
    }
    assert expected.issubset({rule.rule_id for rule in ADVISOR_RULES})


def test_every_rule_has_ui_cli_api_and_profile_metadata() -> None:
    for rule in ADVISOR_RULES:
        assert rule.title
        assert rule.ui_summary
        assert rule.cli_code == rule.rule_id
        assert rule.api_field == "ruleId"
        assert rule.profiles
        assert rule.perspective
        assert rule.source_layer == rule.layer_owner
        assert rule.severity_policy
        assert set(rule.surfaces) == set(CANONICAL_RULE_SURFACES)
        assert rule.actionability
        assert rule.affected_id_kinds
        assert rule.fix_command_hints
        assert rule.test_refs
        assert rule.recommendation
        assert rule.documentation
        assert rule.tracker_items


def test_p0_registry_severity_policy() -> None:
    for rule in ADVISOR_RULES:
        if rule.priority == "P0" and rule.layer_owner in {
            "authoring_validation",
            "model_integrity",
            "renderer_diagnostics",
            "sketch_acceptance",
        }:
            assert rule.severity == "error"
        if rule.layer_owner == "sketch_acceptance":
            assert rule.severity != "info"


def test_registry_validation_rejects_missing_required_fields() -> None:
    bad_rule = replace(ADVISOR_RULES[0], title="", profiles=(), fix_command_hints=())
    errors = validate_advisor_rule_registry((bad_rule,))
    assert any("missing title" in error for error in errors)
    assert any("missing profiles" in error for error in errors)
    assert any("missing fix_command_hints" in error for error in errors)


def test_registry_validation_rejects_duplicate_rule_ids() -> None:
    errors = validate_advisor_rule_registry((ADVISOR_RULES[0], ADVISOR_RULES[0]))
    assert any("duplicate rule_id" in error for error in errors)


def test_registry_validation_enforces_p0_severity() -> None:
    bad_rule = replace(ADVISOR_RULES[0], severity="warning")
    errors = validate_advisor_rule_registry((bad_rule,))
    assert any("must be error severity" in error for error in errors)


def test_profile_filter_returns_matching_rules_only() -> None:
    rules = advisor_rules_for_profile("sketch_acceptance")
    assert {rule.rule_id for rule in rules} == {
        "renderer_unsupported_cut",
        "sketch_evidence_stale",
    }


def test_lookup_by_id_returns_rule() -> None:
    rule = advisor_rule_by_id("hosted_door_not_embedded")
    assert rule.title == "Hosted Door Not Embedded In Real Wall"


def test_payloads_use_external_camel_case_contract() -> None:
    payload = advisor_rule_payloads()[0]
    assert "ruleId" in payload
    assert "layerOwner" in payload
    assert "sourceLayer" in payload
    assert "severityPolicy" in payload
    assert "affectedIdKinds" in payload
    assert "fixCommandHints" in payload
    assert "testRefs" in payload
    assert "rule_id" not in payload
    assert "layer_owner" not in payload


def test_catalog_payload_is_canonical_rule_contract_for_all_surfaces() -> None:
    payload = advisor_rule_catalog_payload()
    assert payload["format"] == "advisorRuleCatalog_v1"
    assert payload["schemaVersion"] == "advisor-rule-registry.v1"
    assert payload["summary"]["ruleCount"] == len(ADVISOR_RULES)
    assert payload["summary"]["rulesBySurface"] == {
        surface: len(ADVISOR_RULES) for surface in CANONICAL_RULE_SURFACES
    }
    assert [rule["ruleId"] for rule in payload["rules"]] == [
        rule.rule_id for rule in ADVISOR_RULES
    ]
    for rule in payload["rules"]:
        assert set(rule["surfaces"]) == set(CANONICAL_RULE_SURFACES)
        assert {"ui", "api", "cli", "mcp"} <= set(rule["surfaces"])


def test_catalog_payload_filters_by_profile_and_surface() -> None:
    payload = advisor_rule_catalog_payload(profile="sketch_acceptance", surface="mcp")
    assert {rule["ruleId"] for rule in payload["rules"]} == {
        "renderer_unsupported_cut",
        "sketch_evidence_stale",
    }
    assert payload["filters"] == {"profile": "sketch_acceptance", "surface": "mcp"}


def test_rendered_ledger_mentions_all_rules_and_tracker_items() -> None:
    ledger = render_advisor_rule_ledger()
    for rule in ADVISOR_RULES:
        assert f"`{rule.rule_id}`" in ledger
        assert rule.severity_policy in ledger
        assert rule.actionability in ledger
        assert f"**Status:** {rule.status}" in ledger
        for tracker_item in rule.tracker_items:
            assert f"`{tracker_item}`" in ledger
        for test_ref in rule.test_refs:
            assert test_ref in ledger


def test_generated_ledger_is_up_to_date() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    ledger_path = repo_root / "spec" / "generated" / "advisor-rule-ledger.md"
    assert ledger_path.read_text() == render_advisor_rule_ledger()
