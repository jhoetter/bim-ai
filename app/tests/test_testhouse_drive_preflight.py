"""MF-driver-12 (#49): preflight folds in the sibling combined PDF.

Post-restructure ``bim-database/`` lays each catalog house out as two
siblings — ``house-5.pdf`` (the combined source PDF) next to
``house-5/`` (a folder of AVIF renders). PR #44 (issue #39) taught
``_house_root`` to return the folder, but the preflight subcommand kept
passing the folder straight to
``/api/v3/source/prepare-ai-visual-trace-run``; with no PDF inside, the
render pass produced ``renderedPdfCount: 0``.

These tests pin the staging contract: when a sibling ``<house>.pdf``
exists, ``_prepare_preflight_source_root`` builds a staging directory
that symlinks both the sibling PDF (primary doc) and every file inside
the house folder (supplementary visual context). Legacy
``testhouses/house-<alpha>/`` layouts (PDFs directly inside the folder,
no sibling) bypass staging unchanged — the existing 11+
``test_testhouse_drive_*.py`` tests still depend on that branch.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

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


# ---------------------------------------------------------------------------
# _sibling_combined_pdf
# ---------------------------------------------------------------------------


def test_sibling_combined_pdf_returns_path_when_catalog_layout(
    tmp_path: Path, monkeypatch
) -> None:
    """Given the catalog layout ``house-5.pdf`` + ``house-5/``, the helper
    returns the sibling PDF path so the preflight can ingest it."""

    base = tmp_path / "bim-database"
    base.mkdir()
    (base / "house-5").mkdir()
    (base / "house-5" / "exterior.avif").write_bytes(b"avif-stub")
    sibling = base / "house-5.pdf"
    sibling.write_bytes(b"%PDF-1.4\nsibling combined\n")
    monkeypatch.setenv("BIM_DATABASE_PATH", str(base))

    assert _DRV._sibling_combined_pdf("house-5") == sibling


def test_sibling_combined_pdf_returns_none_for_legacy_layout(
    tmp_path: Path, monkeypatch
) -> None:
    """Legacy ``testhouses/house-alpha/`` layout has no sibling — the helper
    returns ``None`` so the caller can fall back to scanning the folder."""

    fake_db = tmp_path / "bim-database-empty"
    fake_db.mkdir()
    monkeypatch.setenv("BIM_DATABASE_PATH", str(fake_db))

    fake_repo_root = tmp_path / "repo"
    legacy = fake_repo_root / "testhouses" / "house-alpha"
    legacy.mkdir(parents=True)
    (legacy / "Ansichten.pdf").write_bytes(b"%PDF-1.4\nlegacy in-folder\n")
    monkeypatch.setattr(_DRV, "REPO_ROOT", fake_repo_root)

    assert _DRV._sibling_combined_pdf("alpha") is None


# ---------------------------------------------------------------------------
# _prepare_preflight_source_root
# ---------------------------------------------------------------------------


def test_prepare_preflight_source_root_stages_sibling_pdf_plus_folder(
    tmp_path: Path, monkeypatch
) -> None:
    """Catalog layout (``house-5.pdf`` + ``house-5/foo.avif``): the staged
    root contains both the sibling PDF (as primary) AND the folder's AVIF
    files. ``build_folder_manifest`` walks files (and follows file-level
    symlinks), so it will see the PDF and render it during preflight."""

    base = tmp_path / "bim-database"
    base.mkdir()
    house_dir = base / "house-5"
    house_dir.mkdir()
    (house_dir / "exterior1.avif").write_bytes(b"avif-1")
    (house_dir / "exterior2.avif").write_bytes(b"avif-2")
    sibling = base / "house-5.pdf"
    sibling.write_bytes(b"%PDF-1.4\nsibling combined\n")
    monkeypatch.setenv("BIM_DATABASE_PATH", str(base))

    # Point the workdir somewhere isolated so the staging dir lives there.
    fake_repo_root = tmp_path / "repo"
    fake_repo_root.mkdir()
    monkeypatch.setattr(_DRV, "REPO_ROOT", fake_repo_root)

    root, info = _DRV._prepare_preflight_source_root("house-5")

    assert info["layout"] == "catalog_sibling_pdf"
    assert info["hasSiblingPdf"] is True
    assert info["siblingPdfPath"] == str(sibling)

    # The staged root lives under the per-house workdir, not under the
    # bim-database catalog (we must not pollute the read-only source).
    assert root.is_dir()
    assert str(root).startswith(str(fake_repo_root / "tmp" / "reverse-bim" / "house-house-5"))

    # The sibling PDF is present (with a sort-first prefix so it lands in
    # the manifest as the primary document) and resolves to the real file.
    staged_entries = sorted(p.name for p in root.iterdir())
    pdf_entries = [n for n in staged_entries if n.endswith(".pdf")]
    assert len(pdf_entries) == 1
    pdf_link = root / pdf_entries[0]
    assert pdf_link.is_symlink()
    assert pdf_link.resolve() == sibling.resolve()
    # Sort-first prefix is the load-bearing detail for "primary document"
    # ordering in the manifest.
    assert pdf_entries[0].startswith("00_")

    # All AVIFs from the folder are mirrored so the manifest still lists
    # them as supplementary visual context for downstream readers.
    avifs = sorted(p.name for p in root.iterdir() if p.name.endswith(".avif"))
    assert avifs == ["exterior1.avif", "exterior2.avif"]
    for n in avifs:
        link = root / n
        assert link.is_symlink()
        assert link.resolve() == (house_dir / n).resolve()


def test_prepare_preflight_source_root_legacy_layout_passes_folder_through(
    tmp_path: Path, monkeypatch
) -> None:
    """Legacy ``testhouses/house-alpha/Ansichten.pdf`` layout (no sibling):
    the helper returns the folder unchanged. This preserves the
    back-compat branch PR #44 left in place — the existing 11+
    ``test_testhouse_drive_*.py`` tests depend on it."""

    fake_db = tmp_path / "bim-database-empty"
    fake_db.mkdir()
    monkeypatch.setenv("BIM_DATABASE_PATH", str(fake_db))

    fake_repo_root = tmp_path / "repo"
    legacy = fake_repo_root / "testhouses" / "house-alpha"
    legacy.mkdir(parents=True)
    (legacy / "Ansichten.pdf").write_bytes(b"%PDF-1.4\nlegacy in-folder\n")
    monkeypatch.setattr(_DRV, "REPO_ROOT", fake_repo_root)

    root, info = _DRV._prepare_preflight_source_root("alpha")

    # Folder returned as-is — no staging dir is created so the legacy flow
    # behaves byte-identically to before.
    assert root == legacy
    assert info == {
        "layout": "legacy_folder_only",
        "hasSiblingPdf": False,
        "siblingPdfPath": None,
    }


def test_prepare_preflight_source_root_missing_everything_raises(
    tmp_path: Path, monkeypatch
) -> None:
    """When neither the catalog folder, the sibling PDF, nor the legacy
    folder exists, the helper raises ``FileNotFoundError`` with the path
    operators are expected to populate — never crashes silently."""

    fake_db = tmp_path / "bim-database-empty"
    fake_db.mkdir()
    monkeypatch.setenv("BIM_DATABASE_PATH", str(fake_db))

    fake_repo_root = tmp_path / "repo"
    fake_repo_root.mkdir()
    monkeypatch.setattr(_DRV, "REPO_ROOT", fake_repo_root)

    try:
        _DRV._prepare_preflight_source_root("house-99")
    except FileNotFoundError as exc:
        assert "house-99" in str(exc)
    else:  # pragma: no cover - defensive
        raise AssertionError("expected FileNotFoundError for missing layout")


def test_prepare_preflight_source_root_empty_folder_no_sibling_returns_folder(
    tmp_path: Path, monkeypatch
) -> None:
    """Edge case: catalog folder exists but is empty AND no sibling PDF.
    The helper falls through to the legacy branch and returns the folder
    unchanged — preflight will see ``renderedPdfCount: 0`` but won't
    crash, which is exactly what the issue's guardrail asks for."""

    base = tmp_path / "bim-database"
    base.mkdir()
    (base / "house-7").mkdir()  # empty, no sibling PDF
    monkeypatch.setenv("BIM_DATABASE_PATH", str(base))

    fake_repo_root = tmp_path / "repo"
    fake_repo_root.mkdir()
    monkeypatch.setattr(_DRV, "REPO_ROOT", fake_repo_root)

    root, info = _DRV._prepare_preflight_source_root("house-7")

    assert root == base / "house-7"
    assert info["hasSiblingPdf"] is False
    assert info["layout"] == "legacy_folder_only"


def test_prepare_preflight_source_root_is_idempotent(
    tmp_path: Path, monkeypatch
) -> None:
    """Re-running preflight on the same house must rebuild the staging dir
    cleanly. A stale symlink from a previous run pointing at a moved file
    is not allowed to break the next invocation."""

    base = tmp_path / "bim-database"
    base.mkdir()
    house_dir = base / "house-8"
    house_dir.mkdir()
    (house_dir / "view.avif").write_bytes(b"avif")
    (base / "house-8.pdf").write_bytes(b"%PDF-1.4\n")
    monkeypatch.setenv("BIM_DATABASE_PATH", str(base))

    fake_repo_root = tmp_path / "repo"
    fake_repo_root.mkdir()
    monkeypatch.setattr(_DRV, "REPO_ROOT", fake_repo_root)

    root1, _ = _DRV._prepare_preflight_source_root("house-8")
    # Mutate the staged tree to simulate stale state from a prior run.
    (root1 / "stale-extra").write_text("leftover")
    root2, _ = _DRV._prepare_preflight_source_root("house-8")

    assert root1 == root2
    # The stale file is gone after the rebuild.
    assert not (root2 / "stale-extra").exists()
    # The expected entries are still all there.
    names = sorted(p.name for p in root2.iterdir())
    pdfs = [n for n in names if n.endswith(".pdf")]
    avifs = [n for n in names if n.endswith(".avif")]
    assert len(pdfs) == 1 and avifs == ["view.avif"]
