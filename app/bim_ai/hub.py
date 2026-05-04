from __future__ import annotations

from typing import Any

from fastapi import WebSocket


class Hub:
    """WebSocket subscribers with delta broadcasts and ephemeral presence snapshots."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._presence: dict[str, dict[str, dict[str, Any]]] = {}
        # WebSocket python id → (model_id, peer_id)
        self._socket_meta: dict[int, tuple[str, str]] = {}

    def subscribe(self, model_id: str, websocket: WebSocket) -> None:
        wsid = id(websocket)
        _, pid = self._socket_meta.get(wsid, (model_id, ""))
        self._socket_meta[wsid] = (model_id, pid)
        self._rooms.setdefault(model_id, set()).add(websocket)

    def unregister(self, websocket: WebSocket) -> None:
        wsid = id(websocket)
        tup = self._socket_meta.pop(wsid, None)
        if not tup:
            return
        mid, peer_id = tup
        if peer_id:
            peers = self._presence.get(mid)
            if peers:
                peers.pop(peer_id, None)

        room = self._rooms.get(mid)
        if room:
            room.discard(websocket)
            if not room:
                self._rooms.pop(mid, None)

    def set_peer_id(self, websocket: WebSocket, peer_id: str) -> tuple[str | None, str]:
        wsid = id(websocket)
        tup = self._socket_meta.get(wsid)
        if tup is None:
            return None, peer_id
        mid, _ = tup
        self._socket_meta[wsid] = (mid, peer_id)
        return mid, peer_id

    def touch_presence(
        self, model_id: str, peer_id: str, patch: dict[str, Any]
    ) -> dict[str, dict[str, Any]]:
        room = self._presence.setdefault(model_id, {})

        base = dict(room.get(peer_id, {}))

        base.update(patch)

        base.setdefault("peerId", peer_id)

        room[peer_id] = base

        return room

    async def broadcast_presence(self, model_id: str) -> None:
        peers = dict(self._presence.get(model_id, {}))
        payload: dict[str, Any] = {
            "type": "presence_state",
            "modelId": model_id,
            "payload": {"peers": peers},
        }
        await self.broadcast_json(model_id, payload)

    async def broadcast_json(self, model_id: str, payload: dict[str, Any]) -> None:
        room = self._rooms.get(model_id)
        if not room:
            return

        stale: list[WebSocket] = []

        for ws in list(room):
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(ws)

        for ws in stale:
            self.unregister(ws)
