from __future__ import annotations

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
from bim_ai.routes_deps import document_to_wire
from bim_ai.seed_library import SEED_PROJECT_ID
from bim_ai.tables import (
    ActivityRowRecord,
    CommentRecord,
    ModelRecord,
    ProjectRecord,
    RedoStackRecord,
    UndoStackRecord,
)


class _ScalarRows:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def all(self) -> list[Any]:
        return list(self._rows)

    def __iter__(self) -> Iterator[Any]:
        return iter(self._rows)


class _Result:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def scalars(self) -> _ScalarRows:
        return _ScalarRows(self._rows)

    def scalar_one_or_none(self) -> Any | None:
        if not self._rows:
            return None
        if len(self._rows) > 1:
            raise AssertionError(f"expected at most one row, got {len(self._rows)}")
        return self._rows[0]


class _RealPathSession:
    def __init__(self) -> None:
        self.project = ProjectRecord(id=SEED_PROJECT_ID, slug="seeds", title="Seed Library")
        self.model = ModelRecord(
            id=uuid4(),
            project_id=SEED_PROJECT_ID,
            slug="real-path-smoke",
            revision=1,
            document=self._initial_document(),
        )
        self.undo_rows: list[UndoStackRecord] = []
        self.redo_rows: list[RedoStackRecord] = []
        self.comment_rows: list[CommentRecord] = []
        self.activity_rows: list[ActivityRowRecord] = []
        self._next_undo_id = 1

    @staticmethod
    def _initial_document() -> dict[str, Any]:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        return document_to_wire(doc)

    async def execute(self, statement: Any) -> _Result:
        entity = _selected_entity(statement)
        if entity is ProjectRecord:
            return _Result([self.project])
        if entity is ModelRecord:
            return _Result([self.model])
        if entity is UndoStackRecord:
            return _Result(list(reversed(self.undo_rows)))
        if entity is RedoStackRecord:
            return _Result(list(self.redo_rows))
        if entity is CommentRecord:
            return _Result(list(reversed(self.comment_rows)))
        if entity is ActivityRowRecord:
            return _Result(list(reversed(self.activity_rows)))
        return _Result([])

    async def get(self, entity: type[Any], row_id: Any) -> Any | None:
        if entity is ModelRecord and str(row_id) == str(self.model.id):
            return self.model
        if entity is CommentRecord:
            return next((row for row in self.comment_rows if str(row.id) == str(row_id)), None)
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

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None

    async def refresh(self, _row: Any) -> None:
        return None


class _SessionContext:
    def __init__(self, session: _RealPathSession) -> None:
        self._session = session

    async def __aenter__(self) -> _RealPathSession:
        return self._session

    async def __aexit__(self, *_exc: object) -> None:
        return None


def _selected_entity(statement: Any) -> type[Any] | None:
    descriptions = getattr(statement, "column_descriptions", None)
    if not descriptions:
        return None
    entity = descriptions[0].get("entity")
    return entity if isinstance(entity, type) else None


@contextmanager
def _real_path_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, UUID]]:
    session = _RealPathSession()
    hub = Hub()

    async def override_session() -> Any:
        yield session

    monkeypatch.setattr("bim_ai.routes_api.SessionMaker", lambda: _SessionContext(session))
    real_app.state.hub = hub
    real_app.dependency_overrides[get_session] = override_session
    try:
        yield TestClient(real_app), session.model.id
    finally:
        real_app.dependency_overrides.pop(get_session, None)


def _bundle(
    parent_revision: int,
    client_op_id: str = "cq17-real-path-smoke",
    level_id: str = "lvl-real-path",
) -> dict[str, Any]:
    return {
        "commands": [
            {
                "type": "createLevel",
                "id": level_id,
                "name": "Ground",
                "elevationMm": 0,
            }
        ],
        "parentRevision": parent_revision,
        "clientOpId": client_op_id,
        "userId": "cq17",
    }


@pytest.mark.integration
def test_real_app_routes_commit_activity_comment_and_websocket_delta(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with _real_path_client(monkeypatch) as (client, model_id):
        bootstrap = client.get("/api/bootstrap")
        assert bootstrap.status_code == 200
        assert bootstrap.json()["projects"][0]["seedLibrary"] is True

        snapshot = client.get(f"/api/models/{model_id}/snapshot")
        assert snapshot.status_code == 200
        assert snapshot.json()["revision"] == 1

        with client.websocket_connect(f"/ws/{model_id}") as ws:
            initial = ws.receive_json()
            assert initial["type"] == "snapshot"
            assert initial["revision"] == 1

            committed = client.post(
                f"/api/models/{model_id}/commands/bundle",
                json=_bundle(parent_revision=1),
            )
            assert committed.status_code == 200
            committed_body = committed.json()
            assert committed_body["ok"] is True
            assert committed_body["revision"] == 2
            assert committed_body["clientOpId"] == "cq17-real-path-smoke"

            delta = ws.receive_json()
            assert delta["type"] == "delta"
            assert delta["modelId"] == str(model_id)
            assert delta["clientOpId"] == "cq17-real-path-smoke"

        stale = client.post(
            f"/api/models/{model_id}/commands/bundle",
            json=_bundle(
                parent_revision=1,
                client_op_id="cq17-stale-revision",
                level_id="lvl-stale",
            ),
        )
        assert stale.status_code == 409

        activity = client.get(f"/api/models/{model_id}/activity")
        assert activity.status_code == 200
        assert activity.json()["events"][0]["commandTypes"] == ["createLevel"]

        comment = client.post(
            f"/api/models/{model_id}/comments",
            json={"userDisplay": "CQ17", "body": "Real path comment"},
        )
        assert comment.status_code == 200
        assert comment.json()["body"] == "Real path comment"

        comments = client.get(f"/api/models/{model_id}/comments")
        assert comments.status_code == 200
        assert comments.json()["comments"][0]["body"] == "Real path comment"

        latest_snapshot = client.get(f"/api/models/{model_id}/snapshot")
        assert latest_snapshot.status_code == 200
        assert latest_snapshot.json()["revision"] == 2
        assert "lvl-real-path" in latest_snapshot.json()["elements"]
