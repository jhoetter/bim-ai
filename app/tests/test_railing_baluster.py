"""KRN-V3-11: railing baluster pattern + handrail supports — unit tests."""

from __future__ import annotations

import pytest

from bim_ai.commands import (
    CreateLevelCmd,
    CreateRailingCmd,
    CreateWallCmd,
    SetRailingBalusterPatternCmd,
    SetRailingHandrailSupportsCmd,
)
from bim_ai.document import Document
from bim_ai.elements import BalusterPattern, HandrailSupport, RailingElem, Vec2Mm
from bim_ai.engine import (
    _validate_baluster_pattern,
    _validate_handrail_supports,
    apply_inplace,
    compute_baluster_positions,
)


# ─────────────────────────── helpers ────────────────────────────────────────


def _base_doc() -> tuple[Document, str, str]:
    """Return (doc, level_id, wall_id) ready for railing tests."""
    doc = Document(revision=1, elements={})
    lvl_cmd = CreateLevelCmd(id="lvl-1", name="Ground", elevationMm=0)
    apply_inplace(doc, lvl_cmd)
    wall_cmd = CreateWallCmd(
        id="wall-1",
        name="Wall",
        levelId="lvl-1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=5000, yMm=0),
        heightMm=2800,
        thicknessMm=200,
    )
    apply_inplace(doc, wall_cmd)
    return doc, "lvl-1", "wall-1"


def _railing_cmd(**kwargs) -> CreateRailingCmd:
    return CreateRailingCmd(
        id=kwargs.pop("id", "rail-1"),
        name=kwargs.pop("name", "Railing"),
        pathMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=3000, yMm=0)],
        **kwargs,
    )


# ─────────────────────────── CreateRailingCmd basic ─────────────────────────


def test_create_railing_no_pattern():
    doc, *_ = _base_doc()
    apply_inplace(doc, _railing_cmd())
    railing = doc.elements["rail-1"]
    assert isinstance(railing, RailingElem)
    assert railing.baluster_pattern is None
    assert railing.handrail_supports is None


def test_create_railing_regular_pattern():
    doc, *_ = _base_doc()
    apply_inplace(
        doc,
        _railing_cmd(
            balusterPattern={"rule": "regular", "spacingMm": 120}
        ),
    )
    railing = doc.elements["rail-1"]
    assert isinstance(railing, RailingElem)
    assert railing.baluster_pattern is not None
    assert railing.baluster_pattern.rule == "regular"
    assert railing.baluster_pattern.spacing_mm == 120


def test_create_railing_glass_panel_no_spacing():
    doc, *_ = _base_doc()
    apply_inplace(
        doc,
        _railing_cmd(balusterPattern={"rule": "glass_panel"}),
    )
    railing = doc.elements["rail-1"]
    assert railing.baluster_pattern is not None
    assert railing.baluster_pattern.rule == "glass_panel"
    assert railing.baluster_pattern.spacing_mm is None


def test_create_railing_regular_missing_spacing_rejected():
    doc, *_ = _base_doc()
    with pytest.raises(Exception):
        apply_inplace(doc, _railing_cmd(balusterPattern={"rule": "regular"}))


# ─────────────────────────── SetRailingBalusterPatternCmd ───────────────────


def test_set_baluster_pattern_on_existing_railing():
    doc, *_ = _base_doc()
    apply_inplace(doc, _railing_cmd())
    apply_inplace(
        doc,
        SetRailingBalusterPatternCmd(
            railingId="rail-1",
            balusterPattern={"rule": "cable"},
        ),
    )
    railing = doc.elements["rail-1"]
    assert isinstance(railing, RailingElem)
    assert railing.baluster_pattern is not None
    assert railing.baluster_pattern.rule == "cable"


def test_set_baluster_pattern_none_clears_pattern():
    doc, *_ = _base_doc()
    apply_inplace(doc, _railing_cmd(balusterPattern={"rule": "glass_panel"}))
    apply_inplace(
        doc,
        SetRailingBalusterPatternCmd(
            railingId="rail-1",
            balusterPattern=None,
        ),
    )
    railing = doc.elements["rail-1"]
    assert railing.baluster_pattern is None


def test_set_baluster_pattern_preserves_other_fields():
    doc, *_ = _base_doc()
    apply_inplace(doc, _railing_cmd(name="My Railing"))
    apply_inplace(
        doc,
        SetRailingBalusterPatternCmd(
            railingId="rail-1",
            balusterPattern={"rule": "glass_panel"},
        ),
    )
    railing = doc.elements["rail-1"]
    assert railing.name == "My Railing"
    assert railing.path_mm[0].x_mm == 0
    assert railing.path_mm[1].x_mm == 3000


# ─────────────────────────── handrail supports ──────────────────────────────


def test_create_railing_with_handrail_supports():
    doc, _, wall_id = _base_doc()
    apply_inplace(
        doc,
        _railing_cmd(
            handrailSupports=[
                {
                    "intervalMm": 800,
                    "bracketFamilyId": "bkt-01",
                    "hostWallId": wall_id,
                }
            ]
        ),
    )
    railing = doc.elements["rail-1"]
    assert railing.handrail_supports is not None
    assert len(railing.handrail_supports) == 1
    assert railing.handrail_supports[0].interval_mm == 800
    assert railing.handrail_supports[0].bracket_family_id == "bkt-01"
    assert railing.handrail_supports[0].host_wall_id == wall_id


def test_create_railing_invalid_host_wall_rejected():
    doc, *_ = _base_doc()
    with pytest.raises(Exception):
        apply_inplace(
            doc,
            _railing_cmd(
                handrailSupports=[
                    {
                        "intervalMm": 800,
                        "bracketFamilyId": "bkt-01",
                        "hostWallId": "nonexistent-wall",
                    }
                ]
            ),
        )


# ─────────────────────────── SetRailingHandrailSupportsCmd ──────────────────


def test_set_handrail_supports():
    doc, _, wall_id = _base_doc()
    apply_inplace(doc, _railing_cmd())
    apply_inplace(
        doc,
        SetRailingHandrailSupportsCmd(
            railingId="rail-1",
            handrailSupports=[
                {
                    "intervalMm": 600,
                    "bracketFamilyId": "bkt-02",
                    "hostWallId": wall_id,
                }
            ],
        ),
    )
    railing = doc.elements["rail-1"]
    assert railing.handrail_supports is not None
    assert len(railing.handrail_supports) == 1
    assert railing.handrail_supports[0].interval_mm == 600


def test_set_handrail_supports_empty_clears():
    doc, _, wall_id = _base_doc()
    apply_inplace(
        doc,
        _railing_cmd(
            handrailSupports=[
                {"intervalMm": 800, "bracketFamilyId": "bkt-01", "hostWallId": wall_id}
            ]
        ),
    )
    apply_inplace(
        doc,
        SetRailingHandrailSupportsCmd(railingId="rail-1", handrailSupports=[]),
    )
    railing = doc.elements["rail-1"]
    assert railing.handrail_supports is None


# ─────────────────────────── compute_baluster_positions ─────────────────────


def test_compute_baluster_positions_regular():
    positions = compute_baluster_positions(3000, 120)
    assert len(positions) > 0
    assert positions[0] == pytest.approx(60.0)
    assert positions[-1] == pytest.approx(2940.0)
    for i in range(1, len(positions)):
        assert positions[i] - positions[i - 1] == pytest.approx(120.0)


def test_compute_baluster_positions_path_shorter_than_spacing():
    positions = compute_baluster_positions(50, 120)
    assert positions == []


def test_compute_baluster_positions_zero_spacing():
    positions = compute_baluster_positions(3000, 0)
    assert positions == []


def test_compute_baluster_positions_negative_spacing():
    positions = compute_baluster_positions(3000, -10)
    assert positions == []


# ─────────────────────────── validation helpers (unit) ──────────────────────


def test_validate_baluster_pattern_regular_ok():
    p = BalusterPattern(rule="regular", spacingMm=100)
    _validate_baluster_pattern(p)  # must not raise


def test_validate_baluster_pattern_regular_no_spacing_raises():
    with pytest.raises(ValueError, match="spacingMm"):
        _validate_baluster_pattern(BalusterPattern(rule="regular"))


def test_validate_handrail_supports_invalid_wall_raises():
    els = {}
    support = HandrailSupport(intervalMm=800, bracketFamilyId="bkt-01", hostWallId="bad-id")
    with pytest.raises(ValueError, match="must reference a Wall"):
        _validate_handrail_supports([support], els)
