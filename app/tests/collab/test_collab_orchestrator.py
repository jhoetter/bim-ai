"""COL-V3-01 — unit tests for CollabOrchestrator and CollabRoom."""

from __future__ import annotations

import pytest

from bim_ai.collab.orchestrator import CollabOrchestrator, CollabRoom, get_orchestrator

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _FakeConn:
    """Minimal WebSocket stub that records sent bytes."""

    def __init__(self) -> None:
        self.sent: list[bytes] = []
        self._closed = False

    async def send_bytes(self, data: bytes) -> None:
        if self._closed:
            raise RuntimeError("closed")
        self.sent.append(data)

    def close(self) -> None:
        self._closed = True


# ---------------------------------------------------------------------------
# CollabRoom
# ---------------------------------------------------------------------------


def test_room_created_on_first_access() -> None:
    orch = CollabOrchestrator()
    room = orch.get_room("model-123")
    assert isinstance(room, CollabRoom)
    assert room.model_id == "model-123"


@pytest.mark.asyncio
async def test_broadcast_reaches_all_connections() -> None:
    room = CollabRoom("m1")
    a, b = _FakeConn(), _FakeConn()
    room.join(a)
    room.join(b)
    await room.broadcast(b"hello")
    assert b"hello" in a.sent
    assert b"hello" in b.sent


@pytest.mark.asyncio
async def test_broadcast_excludes_sender() -> None:
    room = CollabRoom("m1")
    sender, other = _FakeConn(), _FakeConn()
    room.join(sender)
    room.join(other)
    await room.broadcast(b"msg", exclude=sender)
    assert not sender.sent
    assert b"msg" in other.sent


def test_leave_removes_connection() -> None:
    room = CollabRoom("m1")
    conn = _FakeConn()
    room.join(conn)
    assert conn in room.connections
    room.leave(conn)
    assert conn not in room.connections


def test_remove_empty_rooms() -> None:
    orch = CollabOrchestrator()
    room = orch.get_room("model-abc")
    conn = _FakeConn()
    room.join(conn)
    room.leave(conn)
    orch.remove_empty_rooms()
    assert "model-abc" not in orch._rooms


@pytest.mark.asyncio
async def test_broadcast_prunes_dead_connections() -> None:
    room = CollabRoom("m1")
    dead = _FakeConn()
    dead.close()
    alive = _FakeConn()
    room.join(dead)
    room.join(alive)
    await room.broadcast(b"data")
    assert dead not in room.connections
    assert b"data" in alive.sent


def test_get_orchestrator_returns_singleton() -> None:
    o1 = get_orchestrator()
    o2 = get_orchestrator()
    assert o1 is o2
