"""Shared pytest hooks.

PERF-C05 added a process-level LRU cache for room-boundary derivation
keyed on `(revision, len(elements), sorted(element ids))`. Tests that
construct documents with overlapping fingerprints (same revision, same
element set, different monkey-patched globals or different model
contents from a previous test) can hit a stale cache entry. Reset the
cache between tests so each `compute_room_boundary_derivation` call
runs against the document the test built.
"""

from __future__ import annotations

import pytest

from bim_ai.room_derivation import reset_room_boundary_doc_cache


@pytest.fixture(autouse=True)
def _reset_room_boundary_doc_cache() -> None:
    reset_room_boundary_doc_cache()
