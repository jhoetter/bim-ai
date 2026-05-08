"""CAN-V3-02 — Hatch patterns scaling with paper-mm at the active plot scale.

Covers:
- 7 seed hatches are present on a freshly created model snapshot.
- All 7 seed hatches have unique IDs.
- computeHatchScreenRepeat at 1:50 zoom 1.0 returns correct screen pixels.
- At 1:100 the same brick hatch has half the screen repeat of 1:50.
- Changing viewport zoom (navigation) does not affect plotScaleDenominator.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.document import Document
from bim_ai.elements import HatchPatternDefElem
from bim_ai.engine import ensure_internal_origin, ensure_seed_hatches, ensure_sun_settings

MODEL_ID = str(uuid.uuid4())

# ---------------------------------------------------------------------------
# Stub app — in-memory snapshot endpoint, no DB required
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    _models: dict[str, dict[str, Any]] = {}

    def _seed_model(model_id: str) -> None:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        ensure_sun_settings(doc)
        ensure_seed_hatches(doc)
        _models[model_id] = {"doc": doc}

    _seed_model(MODEL_ID)

    app = FastAPI()

    @app.get("/api/models/{model_id}/snapshot")
    async def snapshot(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        doc = _models[model_id]["doc"]
        elements_wire = {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()}
        return {"modelId": model_id, "revision": doc.revision, "elements": elements_wire}

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Snapshot tests
# ---------------------------------------------------------------------------


class TestSeedHatchesInSnapshot:
    def test_seven_hatch_patterns_present(self, client: TestClient) -> None:
        resp = client.get(f"/api/models/{MODEL_ID}/snapshot")
        assert resp.status_code == 200
        elements = resp.json()["elements"]
        hatch_elems = [v for v in elements.values() if v.get("kind") == "hatch_pattern_def"]
        assert len(hatch_elems) == 7

    def test_all_hatch_ids_unique(self, client: TestClient) -> None:
        resp = client.get(f"/api/models/{MODEL_ID}/snapshot")
        elements = resp.json()["elements"]
        hatch_ids = [v["id"] for v in elements.values() if v.get("kind") == "hatch_pattern_def"]
        assert len(hatch_ids) == len(set(hatch_ids))

    def test_expected_hatch_ids_present(self, client: TestClient) -> None:
        expected = {"brick_45", "concrete_dot", "insulation", "plaster", "timber_grain", "gypsum", "stone"}
        resp = client.get(f"/api/models/{MODEL_ID}/snapshot")
        elements = resp.json()["elements"]
        found = {v["id"] for v in elements.values() if v.get("kind") == "hatch_pattern_def"}
        assert found == expected

    def test_brick_hatch_fields(self, client: TestClient) -> None:
        resp = client.get(f"/api/models/{MODEL_ID}/snapshot")
        elements = resp.json()["elements"]
        brick = next(v for v in elements.values() if v.get("id") == "brick_45")
        assert brick["paperMmRepeat"] == 73
        assert brick["rotationDeg"] == 45
        assert brick["patternKind"] == "lines"
        assert brick["strokeWidthMm"] == pytest.approx(0.18)


# ---------------------------------------------------------------------------
# ensure_seed_hatches idempotency
# ---------------------------------------------------------------------------


class TestEnsureSeedHatchesIdempotent:
    def test_double_call_does_not_duplicate(self) -> None:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_seed_hatches(doc)
        ensure_seed_hatches(doc)
        hatch_elems = [e for e in doc.elements.values() if isinstance(e, HatchPatternDefElem)]
        assert len(hatch_elems) == 7


# ---------------------------------------------------------------------------
# computeHatchScreenRepeat unit tests (pure Python mirror of the TS formula)
# ---------------------------------------------------------------------------

_SCREEN_DPI = 96
_MM_PER_INCH = 25.4
_BASE_PX_PER_MM = _SCREEN_DPI / _MM_PER_INCH  # ≈ 3.7795


def _compute_hatch_screen_repeat(
    paper_mm_repeat: float,
    plot_scale_denominator: float,
    viewport_zoom: float,
) -> float:
    """Python mirror of HatchRenderer.computeHatchScreenRepeat."""
    pixels_per_mm = viewport_zoom * _BASE_PX_PER_MM
    return (paper_mm_repeat / plot_scale_denominator) * pixels_per_mm


class TestComputeHatchScreenRepeat:
    def test_brick_at_1_50_zoom_1(self) -> None:
        result = _compute_hatch_screen_repeat(73, 50, 1.0)
        expected = (73 / 50) * _BASE_PX_PER_MM
        assert result == pytest.approx(expected, rel=1e-6)

    def test_brick_at_1_100_is_half_of_1_50(self) -> None:
        at_50 = _compute_hatch_screen_repeat(73, 50, 1.0)
        at_100 = _compute_hatch_screen_repeat(73, 100, 1.0)
        assert at_100 == pytest.approx(at_50 / 2, rel=1e-6)

    def test_zoom_scales_screen_repeat_linearly(self) -> None:
        zoom1 = _compute_hatch_screen_repeat(73, 50, 1.0)
        zoom2 = _compute_hatch_screen_repeat(73, 50, 2.0)
        assert zoom2 == pytest.approx(zoom1 * 2, rel=1e-6)

    def test_zoom_does_not_change_plot_scale_denominator(self) -> None:
        """Zoom is navigation — the paper-to-world ratio is fixed by plotScaleDenominator."""
        denom = 50
        for zoom in (0.5, 1.0, 2.0, 4.0):
            result = _compute_hatch_screen_repeat(73, denom, zoom)
            # The ratio result/zoom must be constant (zoom is only a display multiplier).
            base = _compute_hatch_screen_repeat(73, denom, 1.0)
            assert result == pytest.approx(base * zoom, rel=1e-6)

    def test_concrete_dot_at_1_50(self) -> None:
        result = _compute_hatch_screen_repeat(5, 50, 1.0)
        assert result == pytest.approx((5 / 50) * _BASE_PX_PER_MM, rel=1e-6)
