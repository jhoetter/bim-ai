"""MF-driver-8 (#37): integrity check for below-grade levels without
an enclosing ``toposolid_excavation``.

A level with ``elevationMm < 0`` whose walls aren't enclosed by an
excavation should emit a ``BELOW_GRADE_LEVEL_NOT_EXCAVATED`` advisor
finding (warning, not blocker — we don't want to retroactively
invalidate models authored before the excavation primitive landed).
"""

from __future__ import annotations

from bim_ai.model_integrity import check_model_integrity_invariants

_RULE = "BELOW_GRADE_LEVEL_NOT_EXCAVATED"


def _rules(findings) -> set[str]:
    return {f.rule_id for f in findings}


def _below_grade_doc_without_excavation() -> dict:
    """KG level (elevationMm=-2700) with exterior walls but no excavation."""

    return {
        "elements": {
            "lvl-KG": {
                "kind": "level",
                "id": "lvl-KG",
                "name": "Kellergeschoss",
                "elevationMm": -2700,
            },
            "lvl-EG": {"kind": "level", "id": "lvl-EG", "name": "EG", "elevationMm": 0},
            "topo-1": {
                "kind": "toposolid",
                "id": "topo-1",
                "name": "Site",
                "boundaryMm": [
                    {"xMm": -5000, "yMm": -5000},
                    {"xMm": 15000, "yMm": -5000},
                    {"xMm": 15000, "yMm": 13000},
                    {"xMm": -5000, "yMm": 13000},
                ],
                "thicknessMm": 1500,
                "baseElevationMm": 0,
            },
            # KG exterior walls — establish the building extent on the
            # below-grade level so the check has a footprint to test.
            "wall-KG-S": {
                "kind": "wall",
                "id": "wall-KG-S",
                "levelId": "lvl-KG",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 10000, "yMm": 0},
                "thicknessMm": 365,
                "heightMm": 2700,
            },
            "wall-KG-N": {
                "kind": "wall",
                "id": "wall-KG-N",
                "levelId": "lvl-KG",
                "start": {"xMm": 0, "yMm": 8000},
                "end": {"xMm": 10000, "yMm": 8000},
                "thicknessMm": 365,
                "heightMm": 2700,
            },
        }
    }


def _below_grade_doc_with_excavation() -> dict:
    """Same as above but with a cutter floor + excavation covering the extent."""

    doc = _below_grade_doc_without_excavation()
    doc["elements"]["floor-KG-cutter"] = {
        "kind": "floor",
        "id": "floor-KG-cutter",
        "levelId": "lvl-KG",
        "boundaryMm": [
            {"xMm": -500, "yMm": -500},
            {"xMm": 10500, "yMm": -500},
            {"xMm": 10500, "yMm": 8500},
            {"xMm": -500, "yMm": 8500},
        ],
        "thicknessMm": 1,
    }
    doc["elements"]["topo-excavation-KG"] = {
        "kind": "toposolid_excavation",
        "id": "topo-excavation-KG",
        "hostToposolidId": "topo-1",
        "cutterElementId": "floor-KG-cutter",
        "cutMode": "custom_depth",
        "customDepthMm": 3200,
    }
    return doc


def test_below_grade_level_without_excavation_emits_finding() -> None:
    findings = check_model_integrity_invariants(_below_grade_doc_without_excavation())
    assert _RULE in _rules(findings), (
        f"Expected {_RULE} finding; got {_rules(findings)}"
    )
    matching = [f for f in findings if f.rule_id == _RULE]
    assert len(matching) == 1
    assert matching[0].severity == "warning"
    assert matching[0].element_ids == ("lvl-KG",)


def test_below_grade_level_with_excavation_does_not_emit_finding() -> None:
    findings = check_model_integrity_invariants(_below_grade_doc_with_excavation())
    assert _RULE not in _rules(findings), (
        f"Did not expect {_RULE} when excavation covers the footprint; "
        f"got rules={_rules(findings)}"
    )


def test_no_finding_when_no_below_grade_levels_present() -> None:
    doc = {
        "elements": {
            "lvl-EG": {"kind": "level", "id": "lvl-EG", "name": "EG", "elevationMm": 0},
            "lvl-DG": {"kind": "level", "id": "lvl-DG", "name": "DG", "elevationMm": 2700},
            "wall-EG-S": {
                "kind": "wall",
                "id": "wall-EG-S",
                "levelId": "lvl-EG",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 10000, "yMm": 0},
                "thicknessMm": 365,
                "heightMm": 2700,
            },
        }
    }
    findings = check_model_integrity_invariants(doc)
    assert _RULE not in _rules(findings)


def test_no_finding_when_below_grade_level_has_no_walls_yet() -> None:
    """In-progress model: a below-grade level is declared but no walls
    landed yet — don't fire the warning prematurely so authoring isn't
    spammed during topology / project-setup phases."""

    doc = {
        "elements": {
            "lvl-KG": {
                "kind": "level",
                "id": "lvl-KG",
                "name": "KG",
                "elevationMm": -2700,
            }
        }
    }
    findings = check_model_integrity_invariants(doc)
    assert _RULE not in _rules(findings)


def test_finding_when_excavation_too_small_to_cover_extent() -> None:
    """An excavation that doesn't span the building extent should NOT
    silence the warning — the basement walls would still poke out."""

    doc = _below_grade_doc_without_excavation()
    doc["elements"]["floor-KG-cutter-tiny"] = {
        "kind": "floor",
        "id": "floor-KG-cutter-tiny",
        "levelId": "lvl-KG",
        "boundaryMm": [
            {"xMm": 1000, "yMm": 1000},
            {"xMm": 2000, "yMm": 1000},
            {"xMm": 2000, "yMm": 2000},
            {"xMm": 1000, "yMm": 2000},
        ],
        "thicknessMm": 1,
    }
    doc["elements"]["topo-excavation-KG"] = {
        "kind": "toposolid_excavation",
        "id": "topo-excavation-KG",
        "hostToposolidId": "topo-1",
        "cutterElementId": "floor-KG-cutter-tiny",
        "cutMode": "custom_depth",
        "customDepthMm": 3200,
    }
    findings = check_model_integrity_invariants(doc)
    assert _RULE in _rules(findings)
