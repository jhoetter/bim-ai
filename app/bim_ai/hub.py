from __future__ import annotations

import asyncio
import time
from collections import deque
from copy import deepcopy
from typing import Any

from fastapi import WebSocket

BACKPRESSURE_THRESHOLD = 8
# PERF-E06: per-send age cap. If a single ws.send_json await stays in flight
# longer than this, the socket is treated as stuck (TCP backed up, client
# wedged, etc.) and force-closed on the next broadcast attempt. Depth-based
# detection alone misses the case where exactly one send hangs forever.
SEND_AGE_LIMIT_SECONDS = 5.0


class Hub:
    """WebSocket subscribers with delta broadcasts and ephemeral presence snapshots."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._presence: dict[str, dict[str, dict[str, Any]]] = {}
        # WebSocket python id → (model_id, peer_id)
        self._socket_meta: dict[int, tuple[str, str]] = {}
        # Per-model monotonic sequence counter
        self._seq: dict[str, int] = {}
        # Per-model ring buffer: deque of (seq, ts, payload_copy)
        self._buffer: dict[str, deque[tuple[int, float, dict[str, Any]]]] = {}
        # Per-socket in-flight send depth (keyed on id(websocket))
        self._send_queue_depth: dict[int, int] = {}
        # PERF-E06: timestamp when the oldest still-in-flight send started.
        # Cleared when depth returns to 0. Used to detect wedged sockets.
        self._send_oldest_started_at: dict[int, float] = {}

    @staticmethod
    def _model_key(model_id: Any) -> str:
        return str(model_id)

    def subscribe(self, model_id: str, websocket: WebSocket) -> None:
        model_id = self._model_key(model_id)
        wsid = id(websocket)
        _, pid = self._socket_meta.get(wsid, (model_id, ""))
        self._socket_meta[wsid] = (model_id, pid)
        self._rooms.setdefault(model_id, set()).add(websocket)

    def unregister(self, websocket: WebSocket) -> None:
        wsid = id(websocket)
        self._send_queue_depth.pop(wsid, None)
        self._send_oldest_started_at.pop(wsid, None)
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
        model_id = self._model_key(model_id)
        room = self._presence.setdefault(model_id, {})

        base = dict(room.get(peer_id, {}))

        base.update(patch)

        base.setdefault("peerId", peer_id)

        room[peer_id] = base

        return room

    async def publish(self, model_id: str, payload: dict[str, Any]) -> int:
        """Stamp payload with next seq, append to ring buffer, and broadcast."""
        model_id = self._model_key(model_id)
        seq = self._seq.get(model_id, 0) + 1
        self._seq[model_id] = seq
        stamped = {**payload, "seq": seq}

        buf = self._buffer.setdefault(model_id, deque(maxlen=512))
        buf.append((seq, time.monotonic(), deepcopy(stamped)))

        await self.broadcast_json(model_id, stamped)
        return seq

    def resume(self, model_id: str, from_seq: int) -> list[dict[str, Any]] | None:
        """Return buffered payloads with seq > from_seq, or None on window miss."""
        model_id = self._model_key(model_id)
        buf = self._buffer.get(model_id)
        if not buf:
            return None

        oldest_seq = buf[0][0]
        if from_seq + 1 < oldest_seq:
            return None

        return [payload for seq, _ts, payload in buf if seq > from_seq]

    async def broadcast_presence(self, model_id: str) -> None:
        model_id = self._model_key(model_id)
        peers = dict(self._presence.get(model_id, {}))
        payload: dict[str, Any] = {
            "type": "presence_state",
            "modelId": model_id,
            "payload": {"peers": peers},
        }
        await self.broadcast_json(model_id, payload)

    async def broadcast_json(self, model_id: str, payload: dict[str, Any]) -> None:
        # PERF audit #10: sends fan out concurrently via asyncio.gather so one
        # slow socket cannot stall the others. Depth-based backpressure still
        # gates each socket synchronously before the send awaits — the
        # check + increment is atomic within a single _send_one frame.
        # PERF-E06: each socket also has an age cap (SEND_AGE_LIMIT_SECONDS)
        # — a single hung send no longer pins depth at 1 forever and silently
        # blocks all subsequent broadcasts for that socket.
        model_id = self._model_key(model_id)
        room = self._rooms.get(model_id)
        if not room:
            return

        sockets = list(room)
        if not sockets:
            return

        async def _send_one(ws: WebSocket) -> WebSocket | None:
            """Send `payload` to `ws`. Returns the ws if it should be unregistered
            (backpressure-closed or send raised); None on success."""
            wsid = id(ws)
            depth = self._send_queue_depth.get(wsid, 0)
            if depth >= BACKPRESSURE_THRESHOLD:
                try:
                    await ws.close(code=1011)
                except Exception:
                    pass
                return ws
            oldest_started = self._send_oldest_started_at.get(wsid)
            now = time.monotonic()
            if oldest_started is not None and now - oldest_started > SEND_AGE_LIMIT_SECONDS:
                # Some prior send has been awaiting for too long; treat the
                # socket as wedged and disconnect it.
                try:
                    await ws.close(code=1011)
                except Exception:
                    pass
                return ws
            if depth == 0:
                self._send_oldest_started_at[wsid] = now
            self._send_queue_depth[wsid] = depth + 1
            try:
                await ws.send_json(payload)
                return None
            except Exception:
                return ws
            finally:
                new_depth = max(0, self._send_queue_depth.get(wsid, 1) - 1)
                self._send_queue_depth[wsid] = new_depth
                if new_depth == 0:
                    self._send_oldest_started_at.pop(wsid, None)

        results = await asyncio.gather(*(_send_one(ws) for ws in sockets))

        for stale_ws in results:
            if stale_ws is not None:
                self.unregister(stale_ws)
