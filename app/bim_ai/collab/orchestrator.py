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

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def _send_error(conn: Any, code: str) -> None:
    """Send a JSON error frame over the WebSocket as bytes."""
    try:
        payload = json.dumps({"type": "error", "code": code}).encode()
        await conn.send_bytes(payload)
    except Exception:
        pass


class CollabRoom:
    """One room = one model's in-flight CRDT state."""

    def __init__(self, model_id: str) -> None:
        self.model_id = model_id
        self.connections: set[Any] = set()
        self.awareness_states: dict[str, dict] = {}
        self._connection_roles: dict[Any, str] = {}

    async def broadcast(
        self,
        message: bytes,
        exclude: Any = None,
        origin_role: str | None = None,
        subspace: str | None = None,
    ) -> None:
        """Broadcast a yjs sync message to all connections except sender.

        COL-V3-02: viewer and public-link-viewer origins are blocked from
        mutating the kernel subspace.
        """
        if origin_role in ("viewer", "public-link-viewer") and subspace == "kernel":
            if exclude is not None:
                await _send_error(exclude, "viewer_mode_kernel_edit_rejected")
            return

        dead: set[Any] = set()
        for conn in self.connections:
            if conn is exclude:
                continue
            try:
                await conn.send_bytes(message)
            except Exception:
                dead.add(conn)
        self.connections -= dead

    def join(self, conn: Any, role: str = "admin") -> None:
        self.connections.add(conn)
        self._connection_roles[conn] = role

    def leave(self, conn: Any) -> None:
        self.connections.discard(conn)
        self._connection_roles.pop(conn, None)

    def get_role(self, conn: Any) -> str:
        return self._connection_roles.get(conn, "admin")


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
