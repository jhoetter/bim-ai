"""Tests for ``render_pdf_pages`` per-page subprocess fan-out (#69).

Before #69 the render fired a single ``pdftoppm`` covering the whole PDF
with a 120 s cap. On the testhouse house-21 (25 MB / 63 pp / 240 DPI) that
call timed out, the API returned 500, and the preflight driver died before
any reader work began.

The fix renders one page per subprocess so each invocation fits inside a
small timeout (currently 30 s) and per-page failures name the exact page.
These tests pin that behaviour:

1. A 3-page PDF triggers 3 pdftoppm invocations, each with ``-f N -l N``
   and the bounded per-page timeout.
2. A timeout on a specific page surfaces a diagnostic naming that page;
   the remaining pages still render.
3. The aggregate output (file list shape) matches the pre-fix format.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import pytest

from bim_ai.services import source_ingestion

PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00"
    b"\x90wS\xde"
)


def _seed_pdf(tmp_path: Path) -> Path:
    pdf = tmp_path / "house-21.pdf"
    pdf.write_bytes(b"%PDF-1.4\n% fake test pdf\n")
    return pdf


class _FakeProc:
    def __init__(self, returncode: int = 0, stderr: str = "") -> None:
        self.returncode = returncode
        self.stderr = stderr
        self.stdout = ""


def _patch_page_count(
    monkeypatch: pytest.MonkeyPatch, page_count: int
) -> None:
    monkeypatch.setattr(
        source_ingestion,
        "_count_pdf_pages",
        lambda _path: (page_count, None),
    )


def test_render_pdf_pages_fans_out_one_subprocess_per_page(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pdf = _seed_pdf(tmp_path)
    out_dir = tmp_path / "rendered"
    _patch_page_count(monkeypatch, page_count=3)

    calls: list[dict[str, Any]] = []

    def fake_run(cmd: list[str], **kwargs: Any) -> _FakeProc:
        calls.append({"cmd": list(cmd), "timeout": kwargs.get("timeout")})
        # Mimic pdftoppm: write a one-byte-name-suffixed PNG so the glob
        # picks it up. pdftoppm pads the page number automatically; the
        # render function only relies on ``<stem>-*.png`` matching.
        prefix = Path(cmd[-1])
        page_no = int(cmd[cmd.index("-f") + 1])
        target = prefix.parent / f"{prefix.name}-{page_no}.png"
        target.write_bytes(PNG_1X1)
        return _FakeProc(returncode=0)

    monkeypatch.setattr(source_ingestion.subprocess, "run", fake_run)

    result = source_ingestion.render_pdf_pages(pdf, output_dir=out_dir, dpi=240)

    assert result["ok"] is True
    assert result["format"] == "sourcePdfRender_v1"
    assert len(result["pages"]) == 3
    # All page entries carry the historical shape.
    for idx, page in enumerate(result["pages"], start=1):
        assert page["page"] == idx
        assert page["path"].endswith(f"house-21-{idx}.png")
        assert isinstance(page["sha256"], str) and len(page["sha256"]) == 64
        assert page["image"]["widthPx"] == 1
        assert page["image"]["heightPx"] == 1

    # Exactly one subprocess per page, each bounded.
    assert len(calls) == 3
    for page_no, call in enumerate(calls, start=1):
        cmd = call["cmd"]
        assert cmd[0] == "pdftoppm"
        assert "-png" in cmd
        # DPI is forwarded.
        assert cmd[cmd.index("-r") + 1] == "240"
        # Each call addresses exactly one page via -f N -l N.
        assert cmd[cmd.index("-f") + 1] == str(page_no)
        assert cmd[cmd.index("-l") + 1] == str(page_no)
        # Per-page timeout must stay well under the old 120 s ceiling.
        assert call["timeout"] is not None
        assert call["timeout"] <= 60


def test_render_pdf_pages_surfaces_failing_page_number(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pdf = _seed_pdf(tmp_path)
    out_dir = tmp_path / "rendered"
    _patch_page_count(monkeypatch, page_count=3)

    def fake_run(cmd: list[str], **kwargs: Any) -> _FakeProc:
        page_no = int(cmd[cmd.index("-f") + 1])
        prefix = Path(cmd[-1])
        if page_no == 2:
            # Simulate the historical failure mode: pdftoppm hangs on a
            # single problem page. Page 1 still renders; page 3 still
            # renders; the diagnostic names page 2.
            raise subprocess.TimeoutExpired(cmd=cmd, timeout=kwargs.get("timeout", 30))
        target = prefix.parent / f"{prefix.name}-{page_no}.png"
        target.write_bytes(PNG_1X1)
        return _FakeProc(returncode=0)

    monkeypatch.setattr(source_ingestion.subprocess, "run", fake_run)

    result = source_ingestion.render_pdf_pages(pdf, output_dir=out_dir, dpi=240)

    assert result["ok"] is True
    rendered_pages = [p["page"] for p in result["pages"]]
    # Only the surviving pages show up in the page list.
    assert len(result["pages"]) == 2
    assert rendered_pages == [1, 2]  # post-glob re-indexing keeps 1..N

    # The diagnostic must pin the exact broken page (#69 motivation).
    timeout_diags = [
        d for d in result["diagnostics"] if d.get("code") == "pdf_render_page_timeout"
    ]
    assert len(timeout_diags) == 1
    assert timeout_diags[0]["page"] == 2
    assert "page 2" in timeout_diags[0]["message"]


def test_render_pdf_pages_aggregate_shape_matches_legacy_contract(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pdf = _seed_pdf(tmp_path)
    out_dir = tmp_path / "rendered"
    _patch_page_count(monkeypatch, page_count=2)

    def fake_run(cmd: list[str], **kwargs: Any) -> _FakeProc:
        prefix = Path(cmd[-1])
        page_no = int(cmd[cmd.index("-f") + 1])
        (prefix.parent / f"{prefix.name}-{page_no}.png").write_bytes(PNG_1X1)
        return _FakeProc(returncode=0)

    monkeypatch.setattr(source_ingestion.subprocess, "run", fake_run)

    result = source_ingestion.render_pdf_pages(pdf, output_dir=out_dir, dpi=200)

    # Top-level keys must match the historical sourcePdfRender_v1 shape
    # so callers in routes/reverse_bim.py and folder_output/render.py keep
    # working unchanged.
    assert set(result.keys()) == {
        "ok",
        "format",
        "sourcePath",
        "outputDir",
        "dpi",
        "pages",
        "diagnostics",
    }
    assert result["sourcePath"] == str(pdf.resolve())
    assert result["outputDir"] == str(out_dir.resolve())
    assert result["dpi"] == 200
    for page in result["pages"]:
        assert set(page.keys()) == {"page", "path", "sha256", "image"}


def test_render_pdf_pages_honors_first_and_last_page(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pdf = _seed_pdf(tmp_path)
    out_dir = tmp_path / "rendered"
    _patch_page_count(monkeypatch, page_count=10)

    rendered_pages: list[int] = []

    def fake_run(cmd: list[str], **kwargs: Any) -> _FakeProc:
        page_no = int(cmd[cmd.index("-f") + 1])
        rendered_pages.append(page_no)
        prefix = Path(cmd[-1])
        (prefix.parent / f"{prefix.name}-{page_no}.png").write_bytes(PNG_1X1)
        return _FakeProc(returncode=0)

    monkeypatch.setattr(source_ingestion.subprocess, "run", fake_run)

    source_ingestion.render_pdf_pages(
        pdf, output_dir=out_dir, dpi=200, first_page=3, last_page=5
    )

    assert rendered_pages == [3, 4, 5]


def test_render_pdf_pages_reports_pdftoppm_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pdf = _seed_pdf(tmp_path)
    out_dir = tmp_path / "rendered"
    _patch_page_count(monkeypatch, page_count=1)

    def fake_run(cmd: list[str], **kwargs: Any) -> _FakeProc:
        raise FileNotFoundError(2, "No such file or directory: 'pdftoppm'")

    monkeypatch.setattr(source_ingestion.subprocess, "run", fake_run)

    result = source_ingestion.render_pdf_pages(pdf, output_dir=out_dir, dpi=200)

    assert result["ok"] is True
    assert result["pages"] == []
    codes = [d["code"] for d in result["diagnostics"]]
    assert "pdftoppm_unavailable" in codes
