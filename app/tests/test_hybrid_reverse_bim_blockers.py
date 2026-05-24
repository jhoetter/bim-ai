"""MF-driver-2 (#11): blockers extraction for hybrid-slice-execute response.

The slice-execute response now carries a flat ``blockers`` array so callers
(testhouse_drive, bim-agent) don't have to walk three nested report dicts to
find out why ``executionState: commit_blocked``.
"""

from __future__ import annotations

from typing import Any

from bim_ai.routes.hybrid_reverse_bim_execute import _extract_blockers, _iter_findings


def _finding(
    severity: str, rule_id: str, message: str, element_ids: list[str]
) -> dict[str, Any]:
    return {
        "ruleId": rule_id,
        "severity": severity,
        "message": message,
        "elementIds": element_ids,
    }


class _PydanticLike:
    """Stand-in for IntegrityPreflightResponse (has .findings attribute)."""

    def __init__(self, findings: list[dict[str, Any]]):
        self.findings = findings


def test_iter_findings_handles_all_three_shapes() -> None:
    advisor_envelope = {
        "ok": True,
        "data": {"findings": [_finding("warning", "R1", "m1", ["e1"])]},
    }
    constructability_bare = {
        "findings": [_finding("error", "R2", "m2", ["e2"])],
    }
    integrity_pyd = _PydanticLike([_finding("blocker", "R3", "m3", ["e3"])])

    assert len(_iter_findings(advisor_envelope)) == 1
    assert len(_iter_findings(constructability_bare)) == 1
    assert len(_iter_findings(integrity_pyd)) == 1
    assert _iter_findings(None) == []
    assert _iter_findings({"foo": "bar"}) == []


def test_extract_blockers_collects_error_and_blocker_severities_from_all_sources() -> None:
    advisor = {
        "ok": True,
        "data": {
            "findings": [
                _finding("warning", "ADV.W", "warn", ["w-1"]),
                _finding("error", "ADV.E", "advisor error", ["w-2"]),
            ]
        },
    }
    constructability = {
        "findings": [
            _finding("info", "CON.I", "info", ["c-1"]),
            _finding("blocker", "CON.B", "construct blocker", ["c-2"]),
        ]
    }
    integrity = _PydanticLike(
        [
            _finding("error", "INT.E", "integrity error", ["i-1"]),
        ]
    )

    blockers = _extract_blockers(
        advisor=advisor, constructability=constructability, integrity=integrity
    )
    sources = sorted(b["source"] for b in blockers)
    assert sources == ["advisor", "constructability", "integrityPreflight"]
    rule_ids = sorted(b["ruleId"] for b in blockers)
    assert rule_ids == ["ADV.E", "CON.B", "INT.E"]
    # severities are normalised to lowercase
    assert all(b["severity"] in {"error", "blocker"} for b in blockers)


def test_extract_blockers_returns_empty_list_when_nothing_blocks() -> None:
    advisor = {"ok": True, "data": {"findings": [_finding("info", "X", "i", [])]}}
    blockers = _extract_blockers(
        advisor=advisor, constructability=None, integrity=None
    )
    assert blockers == []


def test_extract_blockers_preserves_element_ids_for_driver_actionability() -> None:
    # The whole point of the fix — the driver needs to know WHICH walls
    # blocked so it can skip or regenerate the IR.
    constructability = {
        "findings": [
            _finding("error", "DUPLICATE_WALL", "wall overlaps", ["wall-eg-3", "wall-eg-4"])
        ]
    }
    blockers = _extract_blockers(
        advisor=None, constructability=constructability, integrity=None
    )
    assert blockers == [
        {
            "source": "constructability",
            "ruleId": "DUPLICATE_WALL",
            "severity": "error",
            "message": "wall overlaps",
            "elementIds": ["wall-eg-3", "wall-eg-4"],
        }
    ]


def test_extract_blockers_caps_at_max_to_protect_response_size() -> None:
    many_findings = [_finding("error", f"R{i}", f"m{i}", []) for i in range(120)]
    blockers = _extract_blockers(
        advisor=None,
        constructability={"findings": many_findings},
        integrity=None,
        max_blockers=10,
    )
    assert len(blockers) == 10


def test_extract_blockers_tolerates_missing_severity_and_falsy_payloads() -> None:
    blockers = _extract_blockers(
        advisor={},  # empty envelope
        constructability={"findings": [{"ruleId": "R"}]},  # no severity → ignored
        integrity=None,
    )
    assert blockers == []
