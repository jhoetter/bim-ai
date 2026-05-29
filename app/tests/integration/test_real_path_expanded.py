"""TEST-CQ-11 — expanded real-path integration coverage.

Brings the in-memory real-path integration lane from 2 → 8 tests
covering:

  - Sketch save → publish → snapshot retrieval round-trip
  - Public-link create → resolve (permission check, success path)
  - Public-link revoked → 410 (permission check, denial path)
  - Activity restore (migration roll-forward + roll-back semantics
    over the activity log)
  - Roles grant → list → revoke (admin-only, audit roundtrip)
  - WebSocket subscribe → command → broadcast for two parallel
    subscribers (multi-client end-to-end)

Every test mounts the real FastAPI app via ``TestClient`` and runs
through the production route handlers; only the SQLAlchemy session
is swapped for the same in-memory simulator already used by
``test_real_path_smoke.py``. This keeps the per-test budget under
~5s and avoids requiring a live Postgres for the standard CI lane.

DB-backed variants live in ``test_real_path_db.py`` and run only
when ``BIM_AI_RUN_DB_REAL_PATH=1``.
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin
from bim_ai.hub import Hub
from bim_ai.main import app as real_app
from bim_ai.routes.deps import document_to_wire
from bim_ai.seed_library import SEED_PROJECT_ID
from bim_ai.tables import (
    ActivityRowRecord,
    CommentRecord,
    ModelRecord,
    ProjectRecord,
    PublicLinkRecord,
    RedoStackRecord,
    RoleAssignmentRecord,
    UndoStackRecord,
)

# ---------------------------------------------------------------------------
# In-memory session simulator (shared shape with test_real_path_smoke.py
# but extended to also satisfy the sharing and public-link routes).
# ---------------------------------------------------------------------------


class _ScalarRows:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = list(rows)

    def all(self) -> list[Any]:
        return list(self._rows)

    def first(self) -> Any | None:
        return self._rows[0] if self._rows else None

    def __iter__(self) -> Iterator[Any]:
        return iter(self._rows)


class _Result:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = list(rows)

    def scalars(self) -> _ScalarRows:
        return _ScalarRows(self._rows)

    def scalar_one_or_none(self) -> Any | None:
        if not self._rows:
            return None
        if len(self._rows) > 1:
            raise AssertionError(f"expected at most one row, got {len(self._rows)}")
        return self._rows[0]


def _select_entity(statement: Any) -> type[Any] | None:
    descriptions = getattr(statement, "column_descriptions", None)
    if not descriptions:
        return None
    entity = descriptions[0].get("entity")
    return entity if isinstance(entity, type) else None


def _where_clauses(statement: Any) -> list[Any]:
    # SQLAlchemy stores compiled WHERE criteria on the Select statement;
    # we only need their .left/.right shape for the small set of filters
    # the sharing routes actually issue.
    whereclause = getattr(statement, "whereclause", None)
    if whereclause is None:
        return []
    if hasattr(whereclause, "clauses"):
        return list(whereclause.clauses)
    return [whereclause]


def _row_matches(row: Any, clauses: list[Any]) -> bool:
    """Best-effort matcher for the simulator: handle the equality
    filters the route handlers use."""
    for clause in clauses:
        try:
            col = clause.left
            target = clause.right
            attr = col.key
            # SQL bound params expose their value as `.value` or `.effective_value`.
            value: Any
            if hasattr(target, "value"):
                value = target.value
            elif hasattr(target, "effective_value"):
                value = target.effective_value
            else:
                value = target
            if str(getattr(row, attr, None)) != str(value):
                return False
        except AttributeError:
            # Non-eq clause — bail to "match", deferring to caller.
            continue
    return True


class _RealPathSession:
    """A more capable in-memory session: supports the sharing tables
    on top of the smoke-test base.
    """

    def __init__(self) -> None:
        self.project = ProjectRecord(id=SEED_PROJECT_ID, slug="seeds", title="Seed Library")
        self.model = ModelRecord(
            id=uuid4(),
            project_id=SEED_PROJECT_ID,
            slug="real-path-expanded",
            revision=1,
            document=self._initial_document(),
        )
        self.undo_rows: list[UndoStackRecord] = []
        self.redo_rows: list[RedoStackRecord] = []
        self.comment_rows: list[CommentRecord] = []
        self.activity_rows: list[ActivityRowRecord] = []
        self.role_rows: list[RoleAssignmentRecord] = []
        self.public_link_rows: list[PublicLinkRecord] = []
        self._next_undo_id = 1

    @staticmethod
    def _initial_document() -> dict[str, Any]:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        return document_to_wire(doc)

    def _rows_for(self, entity: type[Any]) -> list[Any]:
        if entity is ProjectRecord:
            return [self.project]
        if entity is ModelRecord:
            return [self.model]
        if entity is UndoStackRecord:
            return list(reversed(self.undo_rows))
        if entity is RedoStackRecord:
            return list(self.redo_rows)
        if entity is CommentRecord:
            return list(reversed(self.comment_rows))
        if entity is ActivityRowRecord:
            return list(reversed(self.activity_rows))
        if entity is RoleAssignmentRecord:
            return list(self.role_rows)
        if entity is PublicLinkRecord:
            return list(self.public_link_rows)
        return []

    async def execute(self, statement: Any) -> _Result:
        entity = _select_entity(statement)
        if entity is None:
            return _Result([])

        clauses = _where_clauses(statement)
        rows = self._rows_for(entity)
        if clauses:
            rows = [r for r in rows if _row_matches(r, clauses)]
        return _Result(rows)

    async def get(self, entity: type[Any], row_id: Any) -> Any | None:
        if entity is ModelRecord and str(row_id) == str(self.model.id):
            return self.model
        if entity is CommentRecord:
            return next(
                (row for row in self.comment_rows if str(row.id) == str(row_id)),
                None,
            )
        if entity is ActivityRowRecord:
            return next(
                (row for row in self.activity_rows if str(row.id) == str(row_id)),
                None,
            )
        if entity is RoleAssignmentRecord:
            return next(
                (row for row in self.role_rows if str(row.id) == str(row_id)),
                None,
            )
        if entity is PublicLinkRecord:
            return next(
                (row for row in self.public_link_rows if str(row.id) == str(row_id)),
                None,
            )
        return None

    def add(self, row: Any) -> None:
        if isinstance(row, UndoStackRecord):
            if row.id is None:
                row.id = self._next_undo_id
                self._next_undo_id += 1
            self.undo_rows.append(row)
        elif isinstance(row, RedoStackRecord):
            self.redo_rows.append(row)
        elif isinstance(row, CommentRecord):
            self.comment_rows.append(row)
        elif isinstance(row, ActivityRowRecord):
            self.activity_rows.append(row)
        elif isinstance(row, RoleAssignmentRecord):
            self.role_rows.append(row)
        elif isinstance(row, PublicLinkRecord):
            self.public_link_rows.append(row)

    async def delete(self, row: Any) -> None:
        if isinstance(row, RoleAssignmentRecord):
            self.role_rows = [r for r in self.role_rows if r.id != row.id]
        elif isinstance(row, PublicLinkRecord):
            self.public_link_rows = [r for r in self.public_link_rows if r.id != row.id]
        elif isinstance(row, CommentRecord):
            self.comment_rows = [r for r in self.comment_rows if r.id != row.id]
        elif isinstance(row, UndoStackRecord):
            self.undo_rows = [r for r in self.undo_rows if r.id != row.id]
        elif isinstance(row, RedoStackRecord):
            self.redo_rows = [r for r in self.redo_rows if r.id != row.id]

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None

    async def refresh(self, _row: Any) -> None:
        return None

    async def flush(self) -> None:
        # `emit_activity_row` calls `session.flush()`. The in-memory
        # simulator is already write-through (add() mutates the row
        # lists), so flush is a no-op for our purposes.
        return None


class _SessionContext:
    def __init__(self, session: _RealPathSession) -> None:
        self._session = session

    async def __aenter__(self) -> _RealPathSession:
        return self._session

    async def __aexit__(self, *_exc: object) -> None:
        return None


@contextmanager
def _real_path_client(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, UUID, _RealPathSession]]:
    session = _RealPathSession()
    hub = Hub()

    async def override_session() -> Any:
        yield session

    monkeypatch.setattr("bim_ai.routes.api.SessionMaker", lambda: _SessionContext(session))
    real_app.state.hub = hub
    real_app.dependency_overrides[get_session] = override_session
    try:
        yield TestClient(real_app), session.model.id, session
    finally:
        real_app.dependency_overrides.pop(get_session, None)


def _level_bundle(
    parent_revision: int,
    *,
    level_id: str = "lvl-real-path",
    client_op_id: str = "cq11-real-path",
    elevation_mm: int = 0,
) -> dict[str, Any]:
    return {
        "commands": [
            {
                "type": "createLevel",
                "id": level_id,
                "name": "Ground",
                "elevationMm": elevation_mm,
            }
        ],
        "parentRevision": parent_revision,
        "clientOpId": client_op_id,
        "userId": "cq11",
    }


# ---------------------------------------------------------------------------
# Test 1 — Sketch save → publish → snapshot round-trip
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_sketch_session_publish_round_trip_appears_in_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Open a sketch session, add a quad of lines, finish — assert
    the snapshot picks up at least one floor element and the
    revision has advanced."""
    from bim_ai.sketch_session import get_sketch_registry

    get_sketch_registry()._sessions.clear()  # type: ignore[attr-defined]  # noqa: SLF001

    with _real_path_client(monkeypatch) as (client, model_id, _):
        # 1. Seed a level (parent of the sketch session).
        committed = client.post(
            f"/api/models/{model_id}/commands/bundle",
            json=_level_bundle(parent_revision=1),
        )
        assert committed.status_code == 200, committed.text

        # 2. Open a sketch session against the level.
        open_resp = client.post(
            "/api/sketch-sessions",
            json={
                "modelId": str(model_id),
                "elementKind": "floor",
                "levelId": "lvl-real-path",
            },
        )
        assert open_resp.status_code == 200, open_resp.text
        session_id = open_resp.json()["session"]["sessionId"]

        # 3. Add four lines forming a simple rectangle.
        rect = [
            ((0, 0), (4000, 0)),
            ((4000, 0), (4000, 3000)),
            ((4000, 3000), (0, 3000)),
            ((0, 3000), (0, 0)),
        ]
        for (x1, y1), (x2, y2) in rect:
            line_resp = client.post(
                f"/api/sketch-sessions/{session_id}/lines",
                json={"fromMm": {"xMm": x1, "yMm": y1}, "toMm": {"xMm": x2, "yMm": y2}},
            )
            assert line_resp.status_code == 200, line_resp.text

        # 4. Finish (publish) the sketch — should commit floor commands.
        finish_resp = client.post(
            f"/api/sketch-sessions/{session_id}/finish",
            json={"name": "Test Floor", "userId": "cq11", "clientOpId": "cq11-finish"},
        )
        assert finish_resp.status_code == 200, finish_resp.text

        # 5. Retrieve the snapshot — revision has advanced past 2 and
        #    the sketch's floor element is present.
        snap = client.get(f"/api/models/{model_id}/snapshot")
        assert snap.status_code == 200
        snap_body = snap.json()
        assert snap_body["revision"] > 2, "sketch finish must advance revision"
        elements = snap_body["elements"]
        floor_kinds = {
            e.get("kind") for e in elements.values() if isinstance(e, dict)
        }
        assert "floor" in floor_kinds, f"expected a floor element after sketch finish; got kinds {floor_kinds}"


# ---------------------------------------------------------------------------
# Test 2 — Public-link create → resolve (permission check success)
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_public_link_v3_create_and_resolve_round_trip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Admin creates a public link, anyone hits /shared/{token}, and
    the model document round-trips with the publicLink envelope
    attached.
    """
    with _real_path_client(monkeypatch) as (client, model_id, _):
        # 1. Seed one element so the snapshot has something to ship.
        committed = client.post(
            f"/api/models/{model_id}/commands/bundle",
            json=_level_bundle(parent_revision=1, level_id="lvl-share"),
        )
        assert committed.status_code == 200

        # 2. Create a public link as admin (default user resolves to
        #    admin when no RoleAssignmentRecord exists).
        link_resp = client.post(
            f"/api/models/{model_id}/public-links",
            json={"displayName": "Test Link"},
        )
        assert link_resp.status_code == 200, link_resp.text
        link_body = link_resp.json()
        token = link_body["token"]
        assert link_body.get("displayName") == "Test Link"

        # 3. Resolve the token — should return the model document.
        resolved = client.get(f"/api/shared/{token}")
        assert resolved.status_code == 200, resolved.text
        body = resolved.json()
        assert body["modelId"] == str(model_id)
        assert body["revision"] >= 2
        assert body["publicLink"]["displayName"] == "Test Link"
        # open_count is bumped via an UPDATE; the in-memory simulator
        # short-circuits non-SELECT statements, so we just assert the
        # field is reported and is a non-negative int (the DB-real
        # path test in test_real_path_db.py asserts the increment).
        assert isinstance(body["publicLink"]["openCount"], int)
        assert body["publicLink"]["openCount"] >= 0


# ---------------------------------------------------------------------------
# Test 3 — Public-link revoked → 410 (permission denial)
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_revoked_public_link_returns_410(monkeypatch: pytest.MonkeyPatch) -> None:
    """A revoked public-link token must NOT leak the snapshot."""
    with _real_path_client(monkeypatch) as (client, model_id, session):
        link_resp = client.post(
            f"/api/models/{model_id}/public-links",
            json={"displayName": "Soon-revoked"},
        )
        assert link_resp.status_code == 200
        token = link_resp.json()["token"]
        link_id = link_resp.json()["id"]

        # First resolve must succeed.
        ok = client.get(f"/api/shared/{token}")
        assert ok.status_code == 200

        # Revoke the link via the public route (POST .../revoke).
        revoke = client.post(f"/api/models/{model_id}/public-links/{link_id}/revoke")
        assert revoke.status_code == 200, revoke.text

        # Now a resolve must return 410 (Gone), not 200.
        denied = client.get(f"/api/shared/{token}")
        assert denied.status_code == 410, (
            f"expected 410 after revoke, got {denied.status_code}: {denied.text}"
        )

        # Sanity: the link row is marked revoked in the simulator.
        assert any(r.is_revoked for r in session.public_link_rows)


# ---------------------------------------------------------------------------
# Test 4 — Undo → Redo round-trip (migration roll-back + roll-forward)
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_undo_then_redo_round_trip_restores_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Roll-back (undo) and roll-forward (redo) over a representative
    bundle commit. After the round-trip the snapshot's element set
    matches what we committed, and the revision counter monotonically
    advanced through both operations.
    """
    with _real_path_client(monkeypatch) as (client, model_id, session):
        # 1. Commit a level (revision 1 → 2).
        committed = client.post(
            f"/api/models/{model_id}/commands/bundle",
            json=_level_bundle(
                parent_revision=1,
                level_id="lvl-undo-redo",
                client_op_id="cq11-ur-1",
            ),
        )
        assert committed.status_code == 200
        assert committed.json()["revision"] == 2

        # Snapshot at revision 2 must include the level we created.
        post_commit = client.get(f"/api/models/{model_id}/snapshot").json()
        assert "lvl-undo-redo" in post_commit["elements"]

        # 2. Undo (revision 2 → 3, but the level should be gone).
        undo = client.post(
            f"/api/models/{model_id}/undo",
            json={"userId": "cq11"},
        )
        assert undo.status_code == 200, undo.text
        post_undo = client.get(f"/api/models/{model_id}/snapshot").json()
        assert post_undo["revision"] > post_commit["revision"]
        # The element should no longer be present after the rollback.
        assert "lvl-undo-redo" not in post_undo["elements"]

        # The undo entry should have been removed from the undo stack
        # AND a row appended to the redo stack — the simulator records
        # both lists directly.
        assert len(session.undo_rows) == 0
        assert len(session.redo_rows) == 1

        # 3. Redo (roll forward again — level should be back).
        redo = client.post(
            f"/api/models/{model_id}/redo",
            json={"userId": "cq11"},
        )
        assert redo.status_code == 200, redo.text
        post_redo = client.get(f"/api/models/{model_id}/snapshot").json()
        assert post_redo["revision"] > post_undo["revision"]
        assert "lvl-undo-redo" in post_redo["elements"]


# ---------------------------------------------------------------------------
# Test 5 — Roles grant → list → revoke (admin-only audit roundtrip)
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_role_grant_list_revoke_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    """The role-assignment surface honours the admin gate and
    round-trips a single user→role mapping cleanly."""
    with _real_path_client(monkeypatch) as (client, model_id, _):
        # 0. Baseline: no roles.
        before = client.get(f"/api/models/{model_id}/roles").json()
        assert before["roles"] == []

        # 1. Grant a user a viewer role (default user resolves to admin).
        grant = client.post(
            f"/api/models/{model_id}/roles",
            json={"subjectKind": "user", "subjectId": "alice", "role": "viewer"},
        )
        assert grant.status_code == 200, grant.text
        assignment_id = grant.json()["id"]
        assert grant.json()["role"] == "viewer"

        # 2. List should now include alice.
        listed = client.get(f"/api/models/{model_id}/roles").json()
        assert any(r["subjectId"] == "alice" and r["role"] == "viewer" for r in listed["roles"])

        # 3. Non-admin user cannot revoke.
        denied = client.delete(
            f"/api/models/{model_id}/roles/{assignment_id}?userId=alice",
        )
        assert denied.status_code == 403

        # 4. Admin can revoke.
        revoked = client.delete(f"/api/models/{model_id}/roles/{assignment_id}")
        assert revoked.status_code == 200

        # 5. Listing again is back to empty.
        after = client.get(f"/api/models/{model_id}/roles").json()
        assert all(r["subjectId"] != "alice" for r in after["roles"])


# ---------------------------------------------------------------------------
# Test 6 — WebSocket multi-client broadcast
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_ws_two_subscribers_both_see_broadcast_delta(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two WebSocket subscribers must both receive the delta after
    a single bundle commit — proves the broadcast topology is real
    (not a single-subscriber happy path)."""
    with _real_path_client(monkeypatch) as (client, model_id, _):
        # Wait for hub to be ready; warm-up by getting initial snapshot.
        with (
            client.websocket_connect(f"/ws/{model_id}") as ws_a,
            client.websocket_connect(f"/ws/{model_id}") as ws_b,
        ):
            init_a = ws_a.receive_json()
            init_b = ws_b.receive_json()
            assert init_a["type"] == "snapshot"
            assert init_b["type"] == "snapshot"
            assert init_a["revision"] == init_b["revision"] == 1

            client_op_id = f"cq11-broadcast-{int(time.time() * 1000)}"
            committed = client.post(
                f"/api/models/{model_id}/commands/bundle",
                json=_level_bundle(
                    parent_revision=1,
                    level_id="lvl-broadcast",
                    client_op_id=client_op_id,
                ),
            )
            assert committed.status_code == 200

            delta_a = ws_a.receive_json()
            delta_b = ws_b.receive_json()
            assert delta_a["type"] == "delta"
            assert delta_b["type"] == "delta"
            assert delta_a["clientOpId"] == client_op_id
            assert delta_b["clientOpId"] == client_op_id
            assert delta_a["modelId"] == str(model_id)
            assert delta_b["modelId"] == str(model_id)
