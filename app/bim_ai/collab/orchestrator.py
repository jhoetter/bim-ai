"""COL-V3-01 — server-side collab orchestrator.

Manages one yjs Y-WebSocket room per modelId. Relays raw yjs sync + awareness
messages between browser clients. Does NOT interpret CRDT contents — yjs
algorithms handle merge deterministically on the client side.

# Architecture note
yjs is the in-flight transport for pre-commit, live-preview mutations only.
The canonical commit boundary remains try_commit_bundle (engine.py). When a
user wants to persist changes they POST to /api/models/{model_id}/bundles
via CMD-V3-01, the same HTTP route used by the REST API and the agent. yjs
state is ephemeral between commits; the server is still authoritative at
every commit boundary.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)


class CollabRoom:
    """One room = one model's in-flight CRDT state."""

    def __init__(self, model_id: str) -> None:
        self.model_id = model_id
        self.connections: set[Any] = set()
        self.awareness_states: dict[str, dict] = {}

    async def broadcast(self, message: bytes, exclude: Any = None) -> None:
        """Broadcast a yjs sync message to all connections except sender."""
        dead: set[Any] = set()
        for conn in self.connections:
            if conn is exclude:
                continue
            try:
                await conn.send_bytes(message)
            except Exception:
                dead.add(conn)
        self.connections -= dead

    def join(self, conn: Any) -> None:
        self.connections.add(conn)

    def leave(self, conn: Any) -> None:
        self.connections.discard(conn)


class CollabOrchestrator:
    """Multiplexes collab rooms by model_id."""

    def __init__(self) -> None:
        self._rooms: dict[str, CollabRoom] = {}

    def get_room(self, model_id: str) -> CollabRoom:
        if model_id not in self._rooms:
            self._rooms[model_id] = CollabRoom(model_id)
        return self._rooms[model_id]

    def remove_empty_rooms(self) -> None:
        empty = [mid for mid, r in self._rooms.items() if not r.connections]
        for mid in empty:
            del self._rooms[mid]


_orchestrator: CollabOrchestrator | None = None


def get_orchestrator() -> CollabOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = CollabOrchestrator()
    return _orchestrator
