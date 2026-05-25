"""Pydantic request bodies for ``routes/api.py``.

Originally hosted three loose request types: ``SemanticAuthoringRequest``,
``ReverseBimHybridSliceExecuteRequest``, and ``ReverseBimHybridRunExecuteRequest``.
All three were the engine-side schema for methodology routes that moved
to bim-agent in the 2026-05-25 clean-separation work — the matching route
handlers are gone, the model classes were unused, and the file is now
intentionally empty.

Kept as a placeholder so any stray ``from bim_ai.models.api_requests import``
fails fast with a clear ``ImportError`` instead of leaving stale schema
around.
"""

from __future__ import annotations

__all__: list[str] = []
