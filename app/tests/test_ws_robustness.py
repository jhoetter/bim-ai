"""CQ-01 WebSocket robustness — unit/integration tests for Hub.

Tests:
  1. test_replay_window_hit — replay buffer returns missed deltas on resumeFrom
  2. test_replay_window_miss_forces_resync — cleared buffer returns None (RESYNC)
  3. test_backpressure_disconnect — depth >= threshold closes socket with 1011
"""

from __future__ import annotations

import asyncio
from typing import Any

from bim_ai.hub import Hub


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
    await ws_b.send_json(
        {"type": "replay_done", "modelId": model_id, "resumedFrom": last_seen}
    )

    assert len(ws_b.sent) == 3
    assert ws_b.sent[-1]["type"] == "replay_done"


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
