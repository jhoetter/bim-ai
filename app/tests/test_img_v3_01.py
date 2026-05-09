"""IMG-V3-01 acceptance tests.

Covers:
- trace() on a synthetic rectangle PNG → StructuredLayout with ≥1 room and ≥4 walls.
- trace() called twice on the same file → byte-identical JSON output (determinism gate).
- Low-contrast (flat grey) PNG → low_contrast_image advisory + non-empty polygons.
- ocr.extract_labels() when Tesseract unavailable → [] + tesseract_unavailable advisory.
- TraceImageCmd dispatched through engine → schemaVersion == 'img-v3.0'.
- TraceImageCmd with no assumptions field → still accepted.
"""

from __future__ import annotations

import base64
import json
import struct
import zlib
from pathlib import Path

import pytest

# ── PNG helpers ──────────────────────────────────────────────────────────────


def _make_png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    """Create a minimal valid PNG filled with a solid colour."""

    def _chunk(name: bytes, data: bytes) -> bytes:
        length = struct.pack(">I", len(data))
        crc = struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)
        return length + name + data + crc

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = _chunk(b"IHDR", ihdr_data)

    raw_rows = b""
    row = bytes([0] + list(rgb) * width)
    for _ in range(height):
        raw_rows += row
    compressed = zlib.compress(raw_rows, 9)
    idat = _chunk(b"IDAT", compressed)
    iend = _chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


def _make_rectangle_png(width: int = 200, height: int = 150) -> bytes:
    """PNG with a black rectangle outline on a white background."""

    def _chunk(name: bytes, data: bytes) -> bytes:
        length = struct.pack(">I", len(data))
        crc = struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)
        return length + name + data + crc

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = _chunk(b"IHDR", ihdr_data)

    rows = []
    border = 10
    for y in range(height):
        row = [0]
        for x in range(width):
            on_border = (
                x == border
                or x == width - border - 1
                or y == border
                or y == height - border - 1
            )
            if on_border:
                row += [0, 0, 0]
            else:
                row += [255, 255, 255]
        rows.append(bytes(row))

    raw_rows = b"".join(rows)
    compressed = zlib.compress(raw_rows, 9)
    idat = _chunk(b"IDAT", compressed)
    iend = _chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture()
def rectangle_png(tmp_path: Path) -> Path:
    p = tmp_path / "rectangle.png"
    p.write_bytes(_make_rectangle_png(200, 150))
    return p


@pytest.fixture()
def grey_png(tmp_path: Path) -> Path:
    p = tmp_path / "grey.png"
    p.write_bytes(_make_png(100, 100, (128, 128, 128)))
    return p


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestTracePipeline:
    def test_rectangle_gives_rooms_and_walls(self, rectangle_png: Path) -> None:
        from bim_ai.img.pipeline import trace

        layout = trace(str(rectangle_png))
        assert layout.schema_version == "img-v3.0"
        assert len(layout.rooms) >= 1, "Expected at least 1 room"
        assert len(layout.walls) >= 4, f"Expected ≥4 walls, got {len(layout.walls)}"

    def test_determinism(self, rectangle_png: Path) -> None:
        from bim_ai.img.pipeline import trace

        layout_a = trace(str(rectangle_png))
        layout_b = trace(str(rectangle_png))
        json_a = json.dumps(layout_a.model_dump(by_alias=True), sort_keys=True)
        json_b = json.dumps(layout_b.model_dump(by_alias=True), sort_keys=True)
        assert json_a == json_b, "trace() is not deterministic: two runs produced different JSON"

    def test_low_contrast_advisory(self, grey_png: Path) -> None:
        from bim_ai.img.pipeline import trace

        layout = trace(str(grey_png))
        codes = {a.code for a in layout.advisories}
        assert "low_contrast_image" in codes, (
            f"Expected low_contrast_image advisory; got {codes}"
        )
        assert len(layout.rooms) >= 1, (
            "Degraded-but-sane: rooms list must be non-empty even for low-contrast images"
        )

    def test_structured_layout_schema_version(self, rectangle_png: Path) -> None:
        from bim_ai.img.pipeline import trace

        layout = trace(str(rectangle_png))
        wire = layout.model_dump(by_alias=True)
        assert wire["schemaVersion"] == "img-v3.0"
        assert "imageMetadata" in wire
        assert "rooms" in wire
        assert "walls" in wire


class TestOcr:
    def test_tesseract_unavailable_returns_advisory(self, tmp_path: Path) -> None:
        import sys
        from unittest.mock import patch

        p = tmp_path / "test.png"
        p.write_bytes(_make_png(50, 50, (255, 255, 255)))

        with patch.dict(sys.modules, {"pytesseract": None}):
            import importlib

            from bim_ai.img import ocr as ocr_mod

            importlib.reload(ocr_mod)
            labels, advisories = ocr_mod.extract_labels(str(p), 1.0)

        assert labels == [], "Expected empty labels when Tesseract unavailable"
        codes = {a.code for a in advisories}
        assert "tesseract_unavailable" in codes

    def test_tesseract_unavailable_does_not_raise(self, tmp_path: Path) -> None:
        import sys
        from unittest.mock import patch

        p = tmp_path / "test.png"
        p.write_bytes(_make_png(50, 50, (200, 200, 200)))

        with patch.dict(sys.modules, {"pytesseract": None}):
            import importlib

            from bim_ai.img import ocr as ocr_mod

            importlib.reload(ocr_mod)
            try:
                labels, advisories = ocr_mod.extract_labels(str(p), 1.0)
            except Exception as exc:
                pytest.fail(f"extract_labels raised unexpectedly: {exc}")


class TestTraceImageCmd:
    def _make_image_b64(self) -> str:
        return base64.b64encode(_make_rectangle_png(60, 60)).decode()

    def test_engine_dispatch_returns_structured_layout(self) -> None:
        from bim_ai.commands import TraceImageCmd
        from bim_ai.engine import handle_trace_image_cmd

        cmd = TraceImageCmd(imageB64=self._make_image_b64())
        result = handle_trace_image_cmd(cmd)
        assert isinstance(result, dict)
        assert result.get("schemaVersion") == "img-v3.0", (
            f"Expected schemaVersion 'img-v3.0', got {result.get('schemaVersion')!r}"
        )
        assert "imageMetadata" in result
        assert "rooms" in result
        assert "walls" in result

    def test_no_assumptions_field_accepted(self) -> None:
        from bim_ai.commands import TraceImageCmd

        cmd = TraceImageCmd(imageB64=self._make_image_b64())
        assert cmd.assumptions == []

    def test_trace_image_cmd_not_applicable_in_bundle(self) -> None:
        """TraceImageCmd must be rejected by apply_inplace (cannot mutate kernel)."""
        from bim_ai.commands import TraceImageCmd
        from bim_ai.document import Document
        from bim_ai.engine import apply_inplace

        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        cmd = TraceImageCmd(imageB64=self._make_image_b64())
        with pytest.raises(ValueError, match="TraceImageCmd"):
            apply_inplace(doc, cmd)  # type: ignore[arg-type]


# ── HTTP-layer tests ──────────────────────────────────────────────────────────


def _build_trace_app():
    """Minimal FastAPI app exposing only the v3/trace route for HTTP testing."""
    from fastapi import FastAPI

    from bim_ai.routes_api import api_router

    app = FastAPI()
    app.include_router(api_router)
    return app


class TestHttpTrace:
    """HTTP-layer tests for POST /api/v3/trace (IMG-V3-01)."""

    @staticmethod
    def _small_png() -> bytes:
        """Return a valid small PNG (well under 2 MB) — floor-plan-like white square."""
        return _make_png(64, 64, (240, 240, 240))

    @staticmethod
    def _large_png() -> bytes:
        """Return a byte stream > 2 MB that looks like a PNG (valid header + padding)."""
        base = _make_png(4, 4, (200, 200, 200))
        # Pad with null bytes to exceed 2 MB — still > 2 MB even if padding is ignored
        padding = b"\x00" * (2 * 1024 * 1024 + 1024)
        return base + padding

    @staticmethod
    def _no_walls_png() -> bytes:
        """Solid uniform grey PNG — produces no detectable walls."""
        return _make_png(32, 32, (128, 128, 128))

    def test_trace_image_small_file(self) -> None:
        """POST a <2 MB PNG → HTTP 200 with rooms and walls arrays."""
        from fastapi.testclient import TestClient

        client = TestClient(_build_trace_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v3/trace",
            files={"image": ("test.png", self._small_png(), "image/png")},
        )
        # Accept 200 (success) or 422 (no_walls_detected advisory is valid)
        assert resp.status_code in (200, 422), f"unexpected status {resp.status_code}: {resp.text[:200]}"
        body = resp.json()
        if resp.status_code == 200:
            assert "rooms" in body, "response missing 'rooms' key"
            assert "walls" in body, "response missing 'walls' key"
        else:
            # 422 means no walls found — body is the StructuredLayout with advisory
            detail = body.get("detail", {})
            advisories = detail.get("advisories", []) if isinstance(detail, dict) else []
            codes = {a.get("code") for a in advisories}
            no_walls_codes = {"no_walls_detected", "low_contrast_image"}
            assert codes & no_walls_codes, (
                f"unexpected 422 with advisory codes {codes}: {body}"
            )

    def test_trace_image_large_file(self) -> None:
        """POST a >2 MB image → HTTP 202 with a jobId UUID."""
        import re

        from fastapi.testclient import TestClient

        client = TestClient(_build_trace_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v3/trace",
            files={"image": ("big.png", self._large_png(), "image/png")},
        )
        assert resp.status_code == 202, f"expected 202, got {resp.status_code}: {resp.text[:200]}"
        body = resp.json()
        assert "jobId" in body, f"missing jobId in response: {body}"
        uuid_pattern = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            re.IGNORECASE,
        )
        assert uuid_pattern.match(body["jobId"]), f"jobId is not a UUID: {body['jobId']!r}"

    def test_no_walls_advisory(self) -> None:
        """POST an image that yields no walls → HTTP 422 with a no-walls advisory.

        A flat solid-grey PNG cannot produce usable wall geometry.  The pipeline
        emits either ``no_walls_detected`` (enough edge density, but Hough finds
        nothing) or ``low_contrast_image`` (edge density too low to trace).  Both
        mean "no walls extracted" and the route returns HTTP 422.
        """
        from fastapi.testclient import TestClient

        client = TestClient(_build_trace_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v3/trace",
            files={"image": ("flat.png", self._no_walls_png(), "image/png")},
        )
        assert resp.status_code == 422, f"expected 422, got {resp.status_code}: {resp.text[:200]}"
        body = resp.json()
        detail = body.get("detail", {})
        advisories = detail.get("advisories", []) if isinstance(detail, dict) else []
        codes = {a.get("code") for a in advisories}
        no_walls_codes = {"no_walls_detected", "low_contrast_image"}
        assert codes & no_walls_codes, (
            f"expected one of {no_walls_codes} in advisories, got {codes}"
        )
