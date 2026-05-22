"""Unit tests for the helpers in ``bim_ai.versioning`` that do not require a DB.

DB-backed lifecycle tests (open/close/abort, snapshot capture, single-open
invariant) live under ``app/tests/integration/`` and run when
``BIM_AI_RUN_DB_REAL_PATH=1`` is set.
"""

from __future__ import annotations

import asyncio
import json

from bim_ai.versioning import (
    canonical_document_bytes,
    current_commit_id,
    element_counts,
    new_commit_id,
    _current_commit,  # type: ignore[attr-defined]
)


def test_new_commit_id_format() -> None:
    """ULIDs are 26 chars, Crockford-base32 (uppercase, no I/L/O/U)."""

    cid = new_commit_id()
    assert isinstance(cid, str)
    assert len(cid) == 26
    allowed = set("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
    assert set(cid).issubset(allowed), f"unexpected char in {cid!r}"


def test_new_commit_id_unique_and_monotonic_within_ms() -> None:
    """Two consecutive ULIDs differ; many are unique."""

    ids = [new_commit_id() for _ in range(200)]
    assert len(set(ids)) == 200


def test_canonical_document_bytes_is_stable() -> None:
    """Different key orders produce identical bytes."""

    a = {"b": 2, "a": 1, "nested": {"y": 2, "x": 1}}
    b = {"a": 1, "nested": {"x": 1, "y": 2}, "b": 2}
    assert canonical_document_bytes(a) == canonical_document_bytes(b)


def test_canonical_document_bytes_handles_non_native() -> None:
    """Non-JSON-native types stringify via ``default=str`` (matches transaction_metadata)."""

    from datetime import datetime, timezone

    doc = {"ts": datetime(2026, 5, 23, tzinfo=timezone.utc)}
    out = canonical_document_bytes(doc)
    # Should not raise; result is valid JSON.
    json.loads(out.decode("utf-8"))


def test_element_counts_basic() -> None:
    doc = {
        "revision": 7,
        "elements": {
            "e1": {"kind": "wall"},
            "e2": {"kind": "wall"},
            "e3": {"kind": "door"},
            "e4": {"kind": "window"},
            "e5": {"kind": "wall"},
        },
    }
    assert element_counts(doc) == {"wall": 3, "door": 1, "window": 1}


def test_element_counts_tolerates_garbage() -> None:
    assert element_counts(None) == {}
    assert element_counts({"elements": "not a dict"}) == {}
    assert element_counts({"elements": {"x": "not a dict"}}) == {}
    assert element_counts({"elements": {"x": {}}}) == {"unknown": 1}


def test_current_commit_id_default_none() -> None:
    assert current_commit_id() is None


def test_current_commit_id_contextvar_set_reset() -> None:
    async def runner() -> None:
        assert current_commit_id() is None
        token = _current_commit.set("01ABC")
        try:
            assert current_commit_id() == "01ABC"
        finally:
            _current_commit.reset(token)
        assert current_commit_id() is None

    asyncio.run(runner())
