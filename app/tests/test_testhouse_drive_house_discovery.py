"""MF-driver-9 (#39): dynamic catalog-house discovery for ``testhouse_drive.py``.

The driver used to hard-code ``HOUSES = ("alpha", "beta", "gamma")`` and pass
that tuple to ``argparse``'s ``choices=``. Once the catalog grew to
``house-1`` / ``testhouse-2`` / … under ``$BIM_DATABASE_PATH``, every
``--house house-1`` invocation hard-failed at argparse before reaching any
real code.

These tests pin the new dynamic-discovery + key-direct path behavior while
proving the alpha/beta/gamma fallback (and the legacy ``testhouses/house-X``
layout the older tests rely on) keeps working unchanged.
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


def _seed_catalog(base: Path, keys: list[str]) -> None:
    """Lay out ``base`` to mimic the bim-database catalog layout.

    Each key gets a ``<base>/<key>/`` source folder + the sibling
    ``<base>/<key>.pdf`` brief that :func:`_discover_houses` keys off.
    """

    base.mkdir(parents=True, exist_ok=True)
    for k in keys:
        (base / k).mkdir(parents=True, exist_ok=True)
        (base / f"{k}.pdf").write_bytes(b"%PDF-1.4\n%stub for discovery test\n")


# ---------------------------------------------------------------------------
# _discover_houses
# ---------------------------------------------------------------------------


def test_discover_houses_returns_sorted_catalog_keys(
    tmp_path: Path, monkeypatch
) -> None:
    """Fixture dir with ``house-1`` + ``house-2`` (each w/ sibling PDF) is
    discovered, the result is sorted, and a folder without a sibling PDF is
    dropped."""

    base = tmp_path / "bim-database"
    _seed_catalog(base, ["house-2", "house-1"])
    # Folder without sibling PDF — must be ignored.
    (base / "house-3").mkdir()
    # Non-matching prefix — must also be ignored even with a sibling PDF.
    (base / "garden-1").mkdir()
    (base / "garden-1.pdf").write_bytes(b"%PDF-1.4\n")

    monkeypatch.setenv("BIM_DATABASE_PATH", str(base))
    assert _DRV._discover_houses() == ("house-1", "house-2")


def test_discover_houses_returns_empty_when_path_missing(
    tmp_path: Path, monkeypatch
) -> None:
    """When ``BIM_DATABASE_PATH`` points at a non-existent directory the
    helper returns an empty tuple so the caller can fall back."""

    monkeypatch.setenv("BIM_DATABASE_PATH", str(tmp_path / "does-not-exist"))
    assert _DRV._discover_houses() == ()


def test_discover_houses_returns_empty_when_catalog_is_empty(
    tmp_path: Path, monkeypatch
) -> None:
    """Empty bim-database dir — no candidates found, empty tuple returned.

    The caller wires this to the alpha/beta/gamma fallback via
    ``HOUSES = _discover_houses() or _FALLBACK_HOUSES``."""

    base = tmp_path / "bim-database"
    base.mkdir()
    monkeypatch.setenv("BIM_DATABASE_PATH", str(base))

    assert _DRV._discover_houses() == ()
    # Sanity-check the contract the module wires up at import time:
    # empty discovery falls back to alpha/beta/gamma.
    assert (_DRV._discover_houses() or _DRV._FALLBACK_HOUSES) == (
        "alpha",
        "beta",
        "gamma",
    )


def test_fallback_houses_constant_pins_alpha_beta_gamma() -> None:
    """The fallback tuple is the load-bearing back-compat surface — pin it
    explicitly so a refactor that drops alpha/beta/gamma trips this test
    before breaking the 11+ existing testhouse_drive tests."""

    assert _DRV._FALLBACK_HOUSES == ("alpha", "beta", "gamma")


# ---------------------------------------------------------------------------
# _house_root
# ---------------------------------------------------------------------------


def test_house_root_resolves_catalog_key_directly(
    tmp_path: Path, monkeypatch
) -> None:
    """``_house_root("house-1")`` returns ``<BIM_DATABASE_PATH>/house-1`` when
    that folder exists — the new key-direct path that lets the dynamic
    discovery feed straight into argparse + downstream PDF reads."""

    base = tmp_path / "bim-database"
    _seed_catalog(base, ["house-1"])
    monkeypatch.setenv("BIM_DATABASE_PATH", str(base))

    assert _DRV._house_root("house-1") == base / "house-1"


def test_house_root_preserves_legacy_alpha_beta_gamma_layout(
    tmp_path: Path, monkeypatch
) -> None:
    """The legacy ``<REPO_ROOT>/testhouses/house-alpha/`` layout the existing
    tests use must keep resolving — no regression for the fallback flow.

    Point ``BIM_DATABASE_PATH`` somewhere where no ``alpha`` folder exists, and
    create a fake ``testhouses/house-alpha`` layout under a fake repo root that
    we monkeypatch into the driver. ``_house_root`` should fall through the
    catalog miss and return the legacy path.
    """

    fake_db = tmp_path / "bim-database-empty"
    fake_db.mkdir()
    monkeypatch.setenv("BIM_DATABASE_PATH", str(fake_db))

    fake_repo_root = tmp_path / "repo"
    legacy = fake_repo_root / "testhouses" / "house-alpha"
    legacy.mkdir(parents=True)
    monkeypatch.setattr(_DRV, "REPO_ROOT", fake_repo_root)

    assert _DRV._house_root("alpha") == legacy


def test_house_root_returns_catalog_path_when_neither_exists(
    tmp_path: Path, monkeypatch
) -> None:
    """When neither the catalog nor the legacy folder is present, the helper
    returns the catalog path so the caller's eventual ``FileNotFoundError``
    surfaces the location operators are supposed to populate."""

    fake_db = tmp_path / "bim-database-empty"
    fake_db.mkdir()
    monkeypatch.setenv("BIM_DATABASE_PATH", str(fake_db))

    fake_repo_root = tmp_path / "repo"
    fake_repo_root.mkdir()
    monkeypatch.setattr(_DRV, "REPO_ROOT", fake_repo_root)

    assert _DRV._house_root("house-99") == fake_db / "house-99"
