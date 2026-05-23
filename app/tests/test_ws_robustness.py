"""CQ-01 WebSocket robustness — unit/integration tests for Hub.

Tests:
  1. test_replay_window_hit — replay buffer returns missed deltas on resumeFrom
  2. test_replay_window_miss_forces_resync — cleared buffer returns None (RESYNC)
  3. test_backpressure_disconnect — depth >= threshold closes socket with 1011
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from starlette.websockets import WebSocketDisconnect

from bim_ai.hub import Hub
from bim_ai.routes import api as routes_api


class _MockWS:
    """Minimal synchronous mock WebSocket for Hub tests."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.close_code: int | None = None

    async def send_json(self, data: dict[str, Any]) -> None:
        self.sent.append(data)

    async def close(self, code: int = 1000) -> None:
        self.close_code = code


class _SlowWS(_MockWS):
    """WebSocket whose send_json yields before completing (simulates slow consumer)."""

    def __init__(self, delay: float = 0.02) -> None:
        super().__init__()
        self._delay = delay

    async def send_json(self, data: dict[str, Any]) -> None:
        await asyncio.sleep(self._delay)
        self.sent.append(data)


class _DisconnectOnSendWS(_MockWS):
    async def accept(self) -> None:
        pass

    async def send_json(self, data: dict[str, Any]) -> None:
        raise WebSocketDisconnect(code=1006)

    async def receive_json(self) -> dict[str, Any]:
        raise AssertionError("receive_json should not run after bootstrap disconnect")


class _ReceiveDisconnectWS(_MockWS):
    async def accept(self) -> None:
        pass

    async def receive_json(self) -> dict[str, Any]:
        raise WebSocketDisconnect(code=1000)


class _SessionContext:
    async def __aenter__(self) -> object:
        return object()

    async def __aexit__(self, *args: object) -> None:
        return None


async def test_replay_window_hit() -> None:
    hub = Hub()
    model_id = "model-replay-hit"

    ws_a: Any = _MockWS()
    hub.subscribe(model_id, ws_a)

    # Publish 5 deltas; client "sees" the first 3
    seqs: list[int] = []
    for i in range(5):
        seq = await hub.publish(model_id, {"type": "delta", "n": i})
        seqs.append(seq)

    last_seen = seqs[2]  # client received seq 1,2,3; missed 4,5

    hub.unregister(ws_a)

    # Reconnect and replay
    replayed = hub.resume(model_id, last_seen)
    assert replayed is not None, "Expected window hit, got RESYNC"
    assert len(replayed) == 2
    assert replayed[0]["seq"] == seqs[3]
    assert replayed[1]["seq"] == seqs[4]

    # Simulate the route sending replayed payloads + replay_done
    ws_b: Any = _MockWS()
    hub.subscribe(model_id, ws_b)
    for payload in replayed:
        await ws_b.send_json(payload)
    await ws_b.send_json({"type": "replay_done", "modelId": model_id, "resumedFrom": last_seen})

    assert len(ws_b.sent) == 3
    assert ws_b.sent[-1]["type"] == "replay_done"


async def test_publish_normalizes_uuid_model_ids_for_string_subscribers() -> None:
    hub = Hub()
    model_uuid = uuid4()
    model_id = str(model_uuid)

    ws: Any = _MockWS()
    hub.subscribe(model_id, ws)

    seq = await hub.publish(model_uuid, {"type": "delta", "modelId": model_id, "n": 1})

    assert seq == 1
    assert ws.sent == [{"type": "delta", "modelId": model_id, "n": 1, "seq": 1}]
    assert hub.resume(model_id, 0) == ws.sent


async def test_replay_window_miss_forces_resync() -> None:
    hub = Hub()
    model_id = "model-replay-miss"

    ws_a: Any = _MockWS()
    hub.subscribe(model_id, ws_a)

    for i in range(5):
        await hub.publish(model_id, {"type": "delta", "n": i})

    # Wipe the ring buffer so from_seq is before oldest entry
    hub._buffer[model_id].clear()

    # Any non-None resume_from should now be a window miss
    result = hub.resume(model_id, from_seq=0)
    assert result is None, "Expected None (RESYNC) after clearing buffer"


async def test_websocket_loop_unregisters_when_initial_send_disconnects(monkeypatch: Any) -> None:
    hub = Hub()
    model_id = uuid4()
    ws: Any = _DisconnectOnSendWS()

    async def fake_load_model_row(session: object, row_model_id: object) -> object:
        assert row_model_id == model_id
        return object()

    monkeypatch.setattr(routes_api, "SessionMaker", lambda: _SessionContext())
    monkeypatch.setattr(routes_api, "load_model_row", fake_load_model_row)

    await routes_api.websocket_loop(ws, model_id, hub, resume_from=0)

    assert str(model_id) not in hub._rooms
    assert id(ws) not in hub._socket_meta


async def test_websocket_loop_skips_duplicate_initial_snapshot_when_revision_matches(
    monkeypatch: Any,
) -> None:
    hub = Hub()
    model_id = uuid4()
    ws: Any = _ReceiveDisconnectWS()

    async def fake_load_model_row(session: object, row_model_id: object) -> object:
        assert row_model_id == model_id
        return SimpleNamespace(document={"revision": 7, "elements": {}})

    monkeypatch.setattr(routes_api, "SessionMaker", lambda: _SessionContext())
    monkeypatch.setattr(routes_api, "load_model_row", fake_load_model_row)

    await routes_api.websocket_loop(
        ws,
        model_id,
        hub,
        send_initial_snapshot=False,
        snapshot_revision=7,
    )

    assert ws.sent == [
        {
            "type": "replay_done",
            "modelId": str(model_id),
            "resumedFrom": None,
            "snapshotRevision": 7,
        }
    ]
    assert str(model_id) not in hub._rooms


async def test_websocket_loop_sends_snapshot_when_client_revision_is_stale(
    monkeypatch: Any,
) -> None:
    hub = Hub()
    model_id = uuid4()
    ws: Any = _ReceiveDisconnectWS()

    async def fake_load_model_row(session: object, row_model_id: object) -> object:
        assert row_model_id == model_id
        return SimpleNamespace(document={"revision": 8, "elements": {}})

    monkeypatch.setattr(routes_api, "SessionMaker", lambda: _SessionContext())
    monkeypatch.setattr(routes_api, "load_model_row", fake_load_model_row)

    await routes_api.websocket_loop(
        ws,
        model_id,
        hub,
        send_initial_snapshot=False,
        snapshot_revision=7,
    )

    assert len(ws.sent) == 1
    assert ws.sent[0]["type"] == "snapshot"
    assert ws.sent[0]["modelId"] == str(model_id)
    assert ws.sent[0]["revision"] == 8
    assert str(model_id) not in hub._rooms


async def test_backpressure_disconnect() -> None:
    import bim_ai.hub as hub_module

    original_threshold = hub_module.BACKPRESSURE_THRESHOLD
    hub_module.BACKPRESSURE_THRESHOLD = 1
    try:
        hub = Hub()
        model_id = "model-backpressure"

        ws: Any = _SlowWS(delay=0.05)
        hub.subscribe(model_id, ws)

        # Two concurrent broadcasts — second should exceed threshold
        await asyncio.gather(
            hub.broadcast_json(model_id, {"type": "delta", "n": 1}),
            hub.broadcast_json(model_id, {"type": "delta", "n": 2}),
        )

        assert ws.close_code == 1011, f"Expected close code 1011, got {ws.close_code}"
        # Socket should have been unregistered
        assert model_id not in hub._rooms or ws not in hub._rooms.get(model_id, set())
    finally:
        hub_module.BACKPRESSURE_THRESHOLD = original_threshold
