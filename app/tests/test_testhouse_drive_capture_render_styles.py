"""MF-render-3 (#27): capture-plan builder emits shaded + wireframe per ortho.

The reverse-BIM capture runner now drives the viewer at multiple
``viewerRenderStyle`` modes per ortho viewpoint so the bim-agent grader can
spot modeling defects (stray geometry, missing wall/roof joins) that a
shaded surface hides. This test pins the plan-builder's shape so a refactor
cannot silently regress the dual-capture behavior.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "scripts" / "testhouse_drive.py"


def _load_driver():
    spec = importlib.util.spec_from_file_location("testhouse_drive", SCRIPT_PATH)
    assert spec and spec.loader, "could not build importlib spec for testhouse_drive.py"
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("testhouse_drive", mod)
    spec.loader.exec_module(mod)
    return mod


_DRV = _load_driver()


def _build(render_styles=None, *, tmp_path: Path) -> dict:
    kwargs = dict(
        house="alpha",
        iter_n=7,
        model_id="model-123",
        web_base="http://127.0.0.1:22000",
        out_dir=tmp_path / "captures",
    )
    if render_styles is not None:
        kwargs["render_styles"] = render_styles
    return _DRV._ortho_capture_plan(**kwargs)


def test_default_plan_doubles_captures_with_shaded_and_wireframe(tmp_path: Path) -> None:
    plan = _build(tmp_path=tmp_path)
    # 4 cardinal orthos × 2 render styles (shaded, wireframe) = 8 captures.
    assert len(plan["captures"]) == 8
    by_style: dict[str, list[dict]] = {}
    for cap in plan["captures"]:
        by_style.setdefault(cap["renderStyle"], []).append(cap)
    assert sorted(by_style) == ["shaded", "wireframe"]
    assert len(by_style["shaded"]) == 4
    assert len(by_style["wireframe"]) == 4


def test_shaded_capture_preserves_legacy_path_and_id(tmp_path: Path) -> None:
    """Existing downstream tools find ``ortho-east.png`` at its current path;
    the new wireframe files land at ``ortho-east-wireframe.png``.
    """
    plan = _build(tmp_path=tmp_path)
    east_shaded = next(
        c for c in plan["captures"] if c["renderStyle"] == "shaded" and c["viewId"].endswith("-east")
    )
    east_wireframe = next(
        c
        for c in plan["captures"]
        if c["renderStyle"] == "wireframe" and c["viewId"].endswith("-east")
    )
    assert east_shaded["captureId"] == "ui:ortho-east"
    assert east_shaded["path"].endswith("/ortho-east.png")
    assert east_wireframe["captureId"] == "ui:ortho-east-wireframe"
    assert east_wireframe["path"].endswith("/ortho-east-wireframe.png")


def test_url_carries_render_style_query_param(tmp_path: Path) -> None:
    """The viewer parses ``?renderStyle=`` on mount (see Workspace.tsx), so
    the runner deep-links into a viewer with the mode already applied — no
    UI driving required.
    """
    plan = _build(tmp_path=tmp_path)
    for cap in plan["captures"]:
        assert f"renderStyle={cap['renderStyle']}" in cap["url"]
        assert "activeViewpoint=" in cap["url"]
        assert "modelId=model-123" in cap["url"]


def test_custom_render_styles_round_trip(tmp_path: Path) -> None:
    plan = _build(render_styles=("shaded",), tmp_path=tmp_path)
    assert len(plan["captures"]) == 4
    assert {c["renderStyle"] for c in plan["captures"]} == {"shaded"}


def test_normalize_render_styles_defaults_when_empty() -> None:
    assert _DRV._normalize_render_styles(None) == _DRV.DEFAULT_ORTHO_RENDER_STYLES
    assert _DRV._normalize_render_styles("") == _DRV.DEFAULT_ORTHO_RENDER_STYLES
    assert _DRV._normalize_render_styles("shaded,wireframe") == ("shaded", "wireframe")
    assert _DRV._normalize_render_styles("wireframe") == ("wireframe",)


def test_normalize_render_styles_rejects_unknown_value() -> None:
    with pytest.raises(ValueError, match="unsupported render style"):
        _DRV._normalize_render_styles("shaded,bogus")
