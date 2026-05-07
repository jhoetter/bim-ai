"""Tests for SKB-03 visual checkpoint comparison."""

from __future__ import annotations

from pathlib import Path

from bim_ai.skb.visual_checkpoint import (
    CheckpointRegion,
    compare_pngs,
    run_checkpoint_against_target,
)


def _solid_png(path: Path, color: tuple[int, int, int], size: int = 64) -> None:
    from PIL import Image
    Image.new("RGB", (size, size), color=color).save(path)


def test_identical_pngs_pass(tmp_path: Path) -> None:
    a = tmp_path / "a.png"
    b = tmp_path / "b.png"
    _solid_png(a, (200, 100, 50))
    _solid_png(b, (200, 100, 50))
    rep = compare_pngs(a, b)
    assert rep.passed
    assert rep.overall_delta_normalised < 1e-6


def test_completely_different_fails(tmp_path: Path) -> None:
    a = tmp_path / "a.png"
    b = tmp_path / "b.png"
    _solid_png(a, (0, 0, 0))
    _solid_png(b, (255, 255, 255))
    rep = compare_pngs(a, b, threshold=0.1)
    assert not rep.passed
    assert rep.overall_delta_normalised > 0.9


def test_partial_difference_in_region(tmp_path: Path) -> None:
    a = tmp_path / "a.png"
    b = tmp_path / "b.png"
    _solid_png(a, (255, 255, 255))
    _solid_png(b, (255, 255, 255))
    # Now overlay a black square on `a` in the bottom-right
    from PIL import Image
    img_a = Image.open(a)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img_a)
    draw.rectangle([32, 32, 64, 64], fill="black")
    img_a.save(a)

    regions = [
        CheckpointRegion(label="top-left", bounds=(0, 0, 32, 32)),
        CheckpointRegion(label="bottom-right", bounds=(32, 32, 64, 64)),
    ]
    rep = compare_pngs(a, b, regions=regions, threshold=0.05)
    by_label = {r.label: r for r in rep.region_deltas}
    assert by_label["top-left"].mean_abs_delta < 1e-6
    assert by_label["bottom-right"].mean_abs_delta > 100


def test_size_mismatch_resampled(tmp_path: Path) -> None:
    a = tmp_path / "a.png"
    b = tmp_path / "b.png"
    _solid_png(a, (100, 100, 100), size=128)
    _solid_png(b, (100, 100, 100), size=64)
    rep = compare_pngs(a, b)
    # Same colour, different sizes — should resample and pass
    assert rep.passed


def test_report_to_dict_shape(tmp_path: Path) -> None:
    a = tmp_path / "a.png"
    b = tmp_path / "b.png"
    _solid_png(a, (10, 20, 30))
    _solid_png(b, (10, 20, 30))
    rep = compare_pngs(a, b)
    d = rep.to_dict()
    assert d["passed"] is True
    assert d["overall_delta_normalised"] >= 0
    assert "region_deltas" in d


def test_run_checkpoint_against_target_orchestration(tmp_path: Path) -> None:
    target = tmp_path / "target.png"
    _solid_png(target, (50, 50, 50))

    def screenshot_fn(out: Path) -> None:
        _solid_png(out, (50, 50, 50))

    rep = run_checkpoint_against_target(
        target_png=target,
        screenshot_fn=screenshot_fn,
        output_dir=tmp_path / "out",
    )
    assert rep.passed
    assert (tmp_path / "out" / "actual.png").exists()


def test_weighted_regions_dominate_overall(tmp_path: Path) -> None:
    """A heavy-weighted clean region should pull the overall down even
    when smaller regions disagree."""
    a = tmp_path / "a.png"
    b = tmp_path / "b.png"
    _solid_png(a, (255, 255, 255))
    _solid_png(b, (255, 255, 255))
    from PIL import Image, ImageDraw
    img_a = Image.open(a)
    draw = ImageDraw.Draw(img_a)
    draw.rectangle([60, 60, 64, 64], fill="black")  # tiny corner difference
    img_a.save(a)

    regions = [
        CheckpointRegion(label="bulk", bounds=(0, 0, 64, 60), weight=100.0),
        CheckpointRegion(label="corner", bounds=(60, 60, 64, 64), weight=1.0),
    ]
    rep = compare_pngs(a, b, regions=regions, threshold=0.05)
    assert rep.passed   # bulk region dominates with 100:1 weight
