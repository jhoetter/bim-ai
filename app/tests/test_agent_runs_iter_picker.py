"""Time-travel Wave 4 — unit tests for the unified iter-picker endpoint.

The endpoint merges filesystem evidence (per-house iter directories +
legacy iter-N-captures) with commits tagged
``context.testhouse_iter.house`` and surfaces a single per-iter list
that the inspector renders as a strip. Preflight-only iters (no
commit) appear as visible-but-disabled rows.

The DB-touching half (live commit grouping) is exercised by the
integration tier and by the running-instance probe; here we cover the
pure helpers + the route's shape contract.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from bim_ai.db import get_session
from bim_ai.routes.agent_runs import (
    _discover_filesystem_houses,
    _parse_iter_token,
    _scan_house_iter_directories,
)


class _StubSession:
    """Tiny AsyncSession stand-in: ``execute`` always returns an empty result.

    The dashboard / iter-picker discovery queries are best-effort; an
    empty DB just means "no DB-discovered houses / no resolved model id"
    which the routes handle gracefully. Using a stub here keeps tests
    DB-free and avoids the asyncpg event-loop-closed lifecycle issue
    you hit with the live TestClient pool when batches of route tests
    run in sequence.
    """

    async def execute(self, *args: Any, **kwargs: Any) -> Any:  # noqa: ARG002
        mock = MagicMock()
        mock.scalar_one_or_none.return_value = None
        mock.scalars.return_value = iter(())
        mock.all.return_value = []
        return mock


@contextmanager
def _stub_db(app: Any) -> Iterator[None]:
    async def override() -> Any:
        yield _StubSession()

    app.dependency_overrides[get_session] = override
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_parse_iter_token_handles_numeric_and_suffix() -> None:
    assert _parse_iter_token("3") == (3, "")
    assert _parse_iter_token("12") == (12, "")
    assert _parse_iter_token("16b") == (16, "b")
    assert _parse_iter_token("xx") is None


def test_discover_filesystem_houses_returns_house_dashed_dirs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "reverse-bim"
    (root / "house-alpha").mkdir(parents=True)
    (root / "house-foo").mkdir(parents=True)
    (root / "not-a-house").mkdir(parents=True)
    monkeypatch.setenv("BIM_AI_REVERSE_BIM_DIR", str(root))
    assert _discover_filesystem_houses() == {"alpha", "foo"}


def test_scan_house_iter_directories_picks_up_new_rebuild_layout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """house-<X>/iter-N/ is the new rebuild layout; captures live inside.

    iter-2 holds a preflight artifact (no captures); iter-3 holds two
    capture PNGs. Both appear in the result; the captureCount on iter-2
    is zero.
    """

    root = tmp_path / "reverse-bim"
    (root / "house-alpha" / "iter-2").mkdir(parents=True)
    (root / "house-alpha" / "iter-2" / "scope.json").write_text("{}")
    (root / "house-alpha" / "iter-3").mkdir(parents=True)
    (root / "house-alpha" / "iter-3" / "alpha-3d-full.png").write_bytes(b"x")
    (root / "house-alpha" / "iter-3" / "alpha-elev-north.png").write_bytes(b"x")
    monkeypatch.setenv("BIM_AI_REVERSE_BIM_DIR", str(root))

    out = _scan_house_iter_directories("alpha")
    assert "iter-2" in out and out["iter-2"]["captureCount"] == 0
    assert "iter-3" in out and out["iter-3"]["captureCount"] == 2


def test_scan_house_iter_directories_falls_back_to_legacy_captures(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Legacy layout: tmp/reverse-bim/iter-N-captures/<house>-*.png."""

    root = tmp_path / "reverse-bim"
    (root / "iter-9-captures").mkdir(parents=True)
    (root / "iter-9-captures" / "alpha-3d-full.png").write_bytes(b"x")
    (root / "iter-9-captures" / "beta-3d-full.png").write_bytes(b"x")
    monkeypatch.setenv("BIM_AI_REVERSE_BIM_DIR", str(root))

    out = _scan_house_iter_directories("alpha")
    # Only the alpha-prefixed file counts.
    assert "iter-9" in out and out["iter-9"]["captureCount"] == 1


def test_scan_house_iter_directories_unions_new_and_legacy_layouts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An iter present in both layouts unions its capture count."""

    root = tmp_path / "reverse-bim"
    (root / "house-alpha" / "iter-5").mkdir(parents=True)
    (root / "house-alpha" / "iter-5" / "alpha-3d-full.png").write_bytes(b"x")
    (root / "iter-5-captures").mkdir(parents=True)
    (root / "iter-5-captures" / "alpha-elev-east.png").write_bytes(b"x")
    (root / "iter-5-captures" / "alpha-elev-west.png").write_bytes(b"x")
    monkeypatch.setenv("BIM_AI_REVERSE_BIM_DIR", str(root))

    out = _scan_house_iter_directories("alpha")
    assert out["iter-5"]["captureCount"] == 3


def test_iter_picker_route_registered() -> None:
    """The new endpoint lives at /agent-runs/houses/{house}/iter-picker."""

    from bim_ai.routes.agent_runs import agent_runs_router

    paths = {getattr(route, "path", "") for route in agent_runs_router.routes}
    assert "/agent-runs/houses/{house}/iter-picker" in paths


def test_iter_picker_response_has_documented_shape(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The endpoint returns {house, modelId, items[]} with documented keys."""

    root = tmp_path / "reverse-bim"
    (root / "house-alpha" / "iter-2").mkdir(parents=True)
    monkeypatch.setenv("BIM_AI_REVERSE_BIM_DIR", str(root))

    from bim_ai.main import app

    with _stub_db(app):
        client = TestClient(app)
        res = client.get("/api/agent-runs/houses/alpha/iter-picker")
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["house"] == "alpha"
    assert "modelId" in payload  # null with the stub DB
    assert isinstance(payload["items"], list)
    # iter-2 from the filesystem appears; no commit so it's preflight-only.
    iter2 = next((row for row in payload["items"] if row["iter"] == "iter-2"), None)
    assert iter2 is not None, payload
    assert iter2["commit"] is None
    for key in ("iter", "iterNumber", "fsPath", "captureCount", "commit"):
        assert key in iter2, f"iter-picker row missing key {key!r}"


def test_houses_endpoint_returns_provenance_flags(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`/agent-runs/houses` annotates each row with inSeed/Filesystem/Database."""

    root = tmp_path / "reverse-bim"
    (root / "house-alpha").mkdir(parents=True)
    monkeypatch.setenv("BIM_AI_REVERSE_BIM_DIR", str(root))

    from bim_ai.main import app

    with _stub_db(app):
        client = TestClient(app)
        res = client.get("/api/agent-runs/houses")
    assert res.status_code == 200
    payload = res.json()
    assert isinstance(payload["items"], list)
    for item in payload["items"]:
        for key in ("inSeed", "inFilesystem", "inDatabase"):
            assert key in item, f"houses row missing {key!r}"
    alpha = next((it for it in payload["items"] if it["name"] == "alpha"), None)
    assert alpha is not None
    assert alpha["inFilesystem"] is True
    assert alpha["inDatabase"] is False  # stub DB returns nothing
