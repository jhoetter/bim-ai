"""Tests for SKB-14 edge detection helper."""

from __future__ import annotations

from pathlib import Path

import pytest

from bim_ai.skb.edge_detection import detect_edges, edge_density


def _make_test_png(path: Path, size: int = 64) -> None:
    """Make a simple test PNG: a black-bordered white square with a
    diagonal line — should produce non-zero edges."""
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (size, size), color="white")
    draw = ImageDraw.Draw(img)
    draw.rectangle([4, 4, size - 5, size - 5], outline="black", width=2)
    draw.line([(8, 8), (size - 9, size - 9)], fill="black", width=2)
    img.save(path)


def _have_cv() -> bool:
    try:
        import cv2  # noqa: F401
        return True
    except ImportError:
        try:
            import skimage  # noqa: F401
            return True
        except ImportError:
            return False


@pytest.mark.skipif(not _have_cv(), reason="no OpenCV / scikit-image installed")
def test_detect_edges_writes_output(tmp_path: Path) -> None:
    inp = tmp_path / "in.png"
    out = tmp_path / "edges.png"
    _make_test_png(inp)
    res = detect_edges(inp, out)
    assert out.exists()
    assert res.edge_pixel_count > 0
    assert res.image_size == (64, 64)


@pytest.mark.skipif(not _have_cv(), reason="no OpenCV / scikit-image installed")
def test_edge_density_in_range(tmp_path: Path) -> None:
    inp = tmp_path / "in.png"
    out = tmp_path / "edges.png"
    _make_test_png(inp)
    res = detect_edges(inp, out)
    d = edge_density(res)
    assert 0.0 < d < 1.0


@pytest.mark.skipif(not _have_cv(), reason="no OpenCV / scikit-image installed")
def test_creates_output_dir(tmp_path: Path) -> None:
    inp = tmp_path / "in.png"
    out = tmp_path / "deep" / "nested" / "edges.png"
    _make_test_png(inp)
    res = detect_edges(inp, out)
    assert out.exists()
    assert out.parent.is_dir()
    assert res.output_path == str(out)


@pytest.mark.skipif(not _have_cv(), reason="no OpenCV / scikit-image installed")
def test_thresholds_recorded_in_result(tmp_path: Path) -> None:
    inp = tmp_path / "in.png"
    out = tmp_path / "edges.png"
    _make_test_png(inp)
    res = detect_edges(inp, out, canny_low=30, canny_high=120, blur_sigma=2.0)
    assert res.canny_low == 30
    assert res.canny_high == 120
    assert res.blur_sigma == 2.0


@pytest.mark.skipif(not _have_cv(), reason="no OpenCV / scikit-image installed")
def test_missing_input_raises(tmp_path: Path) -> None:
    out = tmp_path / "edges.png"
    with pytest.raises((FileNotFoundError, RuntimeError, OSError)):
        detect_edges(tmp_path / "no_such_file.png", out)
