"""PERF-E07 — initial WS snapshot payload is trimmed of ``None`` fields.

The initial snapshot serialisation in ``routes/api.py:websocket_loop`` runs
``el.model_dump(by_alias=True, exclude_none=True)`` so that null-valued
Optional fields don't ship over the wire. The FE coercion paths under
``packages/web/src/state/coercion/`` use truthy / type-guard / ``!= null``
checks that treat absent and explicit-null identically, so this is a pure
size win at the snapshot boundary.

Regression budget: snapshot payload must be at least 30% smaller than the
full ``model_dump`` would have produced on the golden exchange fixture.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from starlette.websockets import WebSocketDisconnect

from bim_ai.document import Document
from bim_ai.hub import Hub
from bim_ai.routes import api as routes_api

FIXTURE = Path(__file__).parent / "fixtures" / "golden_exchange_snapshot.json"

# Snapshot-trim regression budget. The measured reduction on the golden
# fixture is ~50%; we assert ≥30% to match the PERF-E07 issue target while
# leaving headroom for future field additions that may be unavoidably non-None.
MIN_REDUCTION_PCT = 30.0


class _CapturingWS:
    """Minimal WebSocket mock — captures send_json payloads, disconnects on receive."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def accept(self) -> None:
        pass

    async def send_json(self, data: dict[str, Any]) -> None:
        self.sent.append(data)

    async def receive_json(self) -> dict[str, Any]:
        raise WebSocketDisconnect(code=1000)

    async def close(self, code: int = 1000) -> None:
        pass


class _SessionContext:
    async def __aenter__(self) -> object:
        return object()

    async def __aexit__(self, *args: object) -> None:
        return None


def test_initial_snapshot_strips_none_fields() -> None:
    """Direct unit-level check: model_dump(exclude_none) drops None fields and
    keeps a non-trivial size reduction on the golden fixture."""

    data = json.loads(FIXTURE.read_text())
    doc = Document.model_validate(data)

    full_payload = {k: el.model_dump(by_alias=True) for k, el in doc.elements.items()}
    trim_payload = {
        k: el.model_dump(by_alias=True, exclude_none=True) for k, el in doc.elements.items()
    }

    full_bytes = len(json.dumps(full_payload))
    trim_bytes = len(json.dumps(trim_payload))
    reduction_pct = 100.0 * (1.0 - trim_bytes / full_bytes)

    assert reduction_pct >= MIN_REDUCTION_PCT, (
        f"snapshot trim regressed: reduction={reduction_pct:.1f}% "
        f"(full={full_bytes}, trim={trim_bytes}, min required={MIN_REDUCTION_PCT}%)"
    )

    # Sanity: trimmed payload must have NO None values anywhere at the top level.
    for eid, fields in trim_payload.items():
        assert all(v is not None for v in fields.values()), (
            f"trimmed element {eid} still has a None field: {fields}"
        )


async def test_websocket_loop_sends_trimmed_snapshot(monkeypatch: Any) -> None:
    """End-to-end: websocket_loop's snapshot frame contains no None values
    and is smaller than the full dump on the golden fixture."""

    data = json.loads(FIXTURE.read_text())

    hub = Hub()
    model_id = uuid4()
    ws: Any = _CapturingWS()

    from types import SimpleNamespace

    async def fake_load_model_row(session: object, row_model_id: object) -> object:
        assert row_model_id == model_id
        return SimpleNamespace(document=data)

    monkeypatch.setattr(routes_api, "SessionMaker", lambda: _SessionContext())
    monkeypatch.setattr(routes_api, "load_model_row", fake_load_model_row)

    await routes_api.websocket_loop(ws, model_id, hub)

    snapshot_msgs = [m for m in ws.sent if m.get("type") == "snapshot"]
    assert len(snapshot_msgs) == 1, "expected exactly one snapshot frame"
    snap = snapshot_msgs[0]

    # No top-level None fields on any element wire object.
    for eid, fields in snap["elements"].items():
        for k, v in fields.items():
            assert v is not None, f"element {eid} field {k} should have been omitted"

    # Reduction-vs-full sanity check against the same fixture.
    doc = Document.model_validate(data)
    full_payload = {k: el.model_dump(by_alias=True) for k, el in doc.elements.items()}
    full_bytes = len(json.dumps(full_payload))
    trim_bytes = len(json.dumps(snap["elements"]))
    reduction_pct = 100.0 * (1.0 - trim_bytes / full_bytes)

    assert reduction_pct >= MIN_REDUCTION_PCT, (
        f"ws snapshot trim regressed: reduction={reduction_pct:.1f}%"
    )
