"""Shared pytest hooks.

PERF-C05 added a process-level LRU cache for room-boundary derivation
keyed on `(revision, len(elements), sorted(element ids))`, and PERF-C06
layered a per-level slice cache on top keyed on
`(level_id, level_element_fingerprint, settings_digest)`. Tests that
construct documents with overlapping fingerprints (same revision, same
element set, different monkey-patched globals or different model
contents from a previous test) can hit a stale cache entry in either
layer. `reset_room_boundary_doc_cache` clears both, so each
`compute_room_boundary_derivation` call runs against the document the
test built.
"""

from __future__ import annotations

import pytest

from bim_ai.room_derivation import reset_room_boundary_doc_cache


@pytest.fixture(autouse=True)
def _reset_room_boundary_doc_cache() -> None:
    reset_room_boundary_doc_cache()
