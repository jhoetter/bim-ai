"""Tests for SKB-01 phased build workflow."""

from __future__ import annotations

import pytest

from bim_ai.skb.phases import (
    SKB_PHASES,
    PhasedBundle,
    PhasedCommand,
    commit_message_prefix,
    from_dict_list,
    from_legacy_bundle,
    is_phase_known,
    phase_index,
    validate_phase_order,
)


def test_phase_ordering_canonical() -> None:
    assert SKB_PHASES == (
        "massing", "skeleton", "envelope", "openings",
        "interior", "detail", "documentation",
    )


def test_phase_index_known() -> None:
    assert phase_index("massing") == 0
    assert phase_index("documentation") == len(SKB_PHASES) - 1


def test_phase_index_unknown_raises() -> None:
    with pytest.raises(ValueError):
        phase_index("not_a_phase")  # type: ignore


def test_is_phase_known() -> None:
    assert is_phase_known("massing")
    assert not is_phase_known("garbage")


def test_phased_bundle_groups_by_phase() -> None:
    b = PhasedBundle(commands=[
        PhasedCommand("massing", {"type": "createMass", "id": "m1"}),
        PhasedCommand("skeleton", {"type": "createWall", "id": "w1"}),
        PhasedCommand("massing", {"type": "createMass", "id": "m2"}),
    ])
    by = b.by_phase()
    assert list(by.keys()) == ["massing", "skeleton"]
    assert len(by["massing"]) == 2
    assert len(by["skeleton"]) == 1


def test_staged_subbundles_in_canonical_order() -> None:
    b = PhasedBundle(commands=[
        PhasedCommand("envelope", {"type": "x"}),
        PhasedCommand("massing", {"type": "y"}),
        PhasedCommand("skeleton", {"type": "z"}),
    ])
    out = b.staged_subbundles()
    phases = [p for p, _ in out]
    assert phases == ["massing", "skeleton", "envelope"]


def test_from_dict_list() -> None:
    rows = [
        {"phase": "massing", "command": {"type": "createMass", "id": "m1"}},
        {"phase": "envelope", "command": {"type": "createWall", "id": "w1"}},
    ]
    b = from_dict_list(rows)
    assert b.size == 2
    assert b.commands[0].phase == "massing"


def test_from_dict_list_rejects_bad_phase() -> None:
    with pytest.raises(ValueError):
        from_dict_list([{"phase": "garbage", "command": {"type": "x"}}])


def test_from_dict_list_rejects_non_dict_command() -> None:
    with pytest.raises(ValueError):
        from_dict_list([{"phase": "massing", "command": "not a dict"}])


def test_from_legacy_bundle_uses_default_phase() -> None:
    legacy = [{"type": "createWall", "id": "w1"}, {"type": "createWall", "id": "w2"}]
    b = from_legacy_bundle(legacy)
    assert all(pc.phase == "skeleton" for pc in b.commands)


def test_commit_message_prefix() -> None:
    assert commit_message_prefix("massing") == "feat(massing)"
    assert commit_message_prefix("documentation") == "docs(model)"


def test_validate_phase_order_canonical_silent() -> None:
    assert validate_phase_order(["massing", "skeleton", "envelope"]) == []


def test_validate_phase_order_revisit_flagged() -> None:
    warnings = validate_phase_order(["envelope", "massing"])
    assert len(warnings) == 1
    assert "massing" in warnings[0]
