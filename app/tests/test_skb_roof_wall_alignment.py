"""Tests for SKB-11 roof-wall alignment validator."""

from __future__ import annotations

from bim_ai.skb.roof_wall_alignment import check_alignment, check_alignments


SQUARE = [(0.0, 0.0), (5000.0, 0.0), (5000.0, 5000.0), (0.0, 5000.0)]


def test_wall_inside_roof_no_violation() -> None:
    v = check_alignment("w1", (1000.0, 1000.0), (4000.0, 1000.0), "r1", SQUARE)
    assert v is None


def test_wall_with_endpoint_outside_emits_violation() -> None:
    v = check_alignment("w1", (1000.0, 1000.0), (6000.0, 1000.0), "r1", SQUARE)
    assert v is not None
    assert v.wall_id == "w1"
    assert v.roof_id == "r1"
    assert v.distance_outside_mm > 0
    assert "outside" in v.message.lower()


def test_wall_with_both_endpoints_outside_uses_worst() -> None:
    v = check_alignment("w1", (-2000.0, 1000.0), (8000.0, 1000.0), "r1", SQUARE)
    assert v is not None
    # The worst is whichever is further; both are 2000-3000 outside
    assert v.distance_outside_mm >= 2000


def test_endpoint_on_boundary_within_tolerance_no_violation() -> None:
    # Endpoint at (5000, 1000) sits exactly on the east edge — point-in-polygon
    # may classify boundary as inside or outside; tolerance prevents spurious flag
    v = check_alignment(
        "w1",
        (1000.0, 1000.0),
        (5000.5, 1000.0),
        "r1",
        SQUARE,
        tolerance_mm=2.0,
    )
    assert v is None


def test_check_alignments_skips_unknown_roof() -> None:
    walls = [
        ("w1", (1000.0, 1000.0), (4000.0, 1000.0), "r-known"),
        ("w2", (10000.0, 10000.0), (12000.0, 10000.0), "r-unknown"),
    ]
    roofs = {"r-known": SQUARE}
    violations = check_alignments(walls, roofs)
    assert len(violations) == 0  # w1 inside, w2 unknown roof skipped


def test_check_alignments_emits_violation_for_overhanging_wall() -> None:
    walls = [
        ("w1", (1000.0, 1000.0), (4000.0, 1000.0), "r1"),  # inside
        ("w2", (4000.0, 1000.0), (7000.0, 1000.0), "r1"),  # extends 2000 east
    ]
    violations = check_alignments(walls, {"r1": SQUARE})
    ids = [v.wall_id for v in violations]
    assert ids == ["w2"]


def test_advisory_dict_shape() -> None:
    v = check_alignment("w1", (1000.0, 1000.0), (6000.0, 1000.0), "r1", SQUARE)
    assert v is not None
    d = v.to_advisory_dict()
    assert d["rule_id"] == "roof_wall_alignment_v1"
    assert d["severity"] == "warning"
    assert d["wall_id"] == "w1"
    assert d["roof_id"] == "r1"
    assert "sample_outside_mm" in d
    assert d["distance_outside_mm"] > 0
