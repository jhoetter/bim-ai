"""MRK-V3-01 — REST tests for comment CRUD routes and mark_orphaned_comments."""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict, Field


class _CreateBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    thread_id: str | None = Field(default=None, alias="threadId")
    author_id: str = Field(alias="authorId")
    body: str
    anchor: dict


_ELEMENT_ANCHOR: dict[str, Any] = {"kind": "element", "elementId": "wall-001"}
_POINT_ANCHOR: dict[str, Any] = {
    "kind": "point",
    "worldMm": {"xMm": 0.0, "yMm": 0.0, "zMm": 0.0},
}
_REGION_ANCHOR: dict[str, Any] = {
    "kind": "region",
    "minMm": {"xMm": 0.0, "yMm": 0.0, "zMm": 0.0},
    "maxMm": {"xMm": 1000.0, "yMm": 1000.0, "zMm": 2800.0},
}

MODEL_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Stub app
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    from bim_ai.comments import Comment

    _store: dict[str, list[dict]] = {}

    def _comments(model_id: str) -> list[dict]:
        return _store.setdefault(model_id, [])

    app = FastAPI()

    @app.post("/models/{model_id}/comments")
    async def create_comment(model_id: str, body: _CreateBody) -> Any:
        cid = str(uuid.uuid4())
        tid = body.thread_id if body.thread_id else cid
        raw: dict[str, Any] = {
            "id": cid,
            "modelId": model_id,
            "threadId": tid,
            "authorId": body.author_id,
            "body": body.body,
            "anchor": body.anchor,
            "createdAt": int(time.time() * 1000),
            "isOrphaned": False,
        }
        comment = Comment.model_validate(raw)
        _comments(model_id).append(comment.model_dump(by_alias=True))
        return comment.model_dump(by_alias=True)

    @app.get("/models/{model_id}/comments")
    async def list_comments(model_id: str, threadId: str | None = None) -> Any:
        comments = list(_comments(model_id))
        if threadId is not None:
            comments = [c for c in comments if c.get("threadId") == threadId]
        return {"comments": comments}

    @app.patch("/models/{model_id}/comments/{comment_id}/resolve")
    async def resolve_comment(model_id: str, comment_id: str) -> Any:
        comments = _comments(model_id)
        for i, c in enumerate(comments):
            if c.get("id") == comment_id:
                c = dict(c)
                c["resolvedAt"] = int(time.time() * 1000)
                comments[i] = c
                return c
        raise HTTPException(status_code=404, detail="Comment not found")

    @app.delete("/models/{model_id}/comments/{comment_id}")
    async def delete_comment(model_id: str, comment_id: str) -> Any:
        comments = _comments(model_id)
        for i, c in enumerate(comments):
            if c.get("id") == comment_id:
                comments.pop(i)
                return {"deleted": True, "id": comment_id}
        raise HTTPException(status_code=404, detail="Comment not found")

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCreateComment:
    def test_create_element_anchor(self, client: TestClient) -> None:
        res = client.post(
            f"/models/{MODEL_ID}/comments",
            json={"authorId": "user-1", "body": "Check this wall", "anchor": _ELEMENT_ANCHOR},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["id"] == body["threadId"]
        assert body["anchor"]["kind"] == "element"
        assert body["isOrphaned"] is False

    def test_create_point_anchor(self, client: TestClient) -> None:
        res = client.post(
            f"/models/{MODEL_ID}/comments",
            json={"authorId": "user-1", "body": "Point comment", "anchor": _POINT_ANCHOR},
        )
        assert res.status_code == 200
        assert res.json()["anchor"]["kind"] == "point"

    def test_create_region_anchor(self, client: TestClient) -> None:
        res = client.post(
            f"/models/{MODEL_ID}/comments",
            json={"authorId": "user-1", "body": "Region comment", "anchor": _REGION_ANCHOR},
        )
        assert res.status_code == 200
        assert res.json()["anchor"]["kind"] == "region"

    def test_reply_shares_thread_id(self, client: TestClient) -> None:
        parent = client.post(
            f"/models/{MODEL_ID}/comments",
            json={"authorId": "user-1", "body": "Root", "anchor": _ELEMENT_ANCHOR},
        ).json()
        reply = client.post(
            f"/models/{MODEL_ID}/comments",
            json={
                "authorId": "user-2",
                "body": "Reply",
                "anchor": _ELEMENT_ANCHOR,
                "threadId": parent["id"],
            },
        ).json()
        assert reply["threadId"] == parent["id"]
        assert reply["id"] != parent["id"]


class TestListComments:
    def test_list_all(self, client: TestClient) -> None:
        for i in range(2):
            client.post(
                f"/models/{MODEL_ID}/comments",
                json={"authorId": f"user-{i}", "body": f"Msg {i}", "anchor": _ELEMENT_ANCHOR},
            )
        res = client.get(f"/models/{MODEL_ID}/comments")
        assert res.status_code == 200
        assert len(res.json()["comments"]) >= 2

    def test_filter_by_thread_id(self, client: TestClient) -> None:
        parent = client.post(
            f"/models/{MODEL_ID}/comments",
            json={"authorId": "user-1", "body": "Root", "anchor": _ELEMENT_ANCHOR},
        ).json()
        client.post(
            f"/models/{MODEL_ID}/comments",
            json={
                "authorId": "user-2",
                "body": "Reply",
                "anchor": _ELEMENT_ANCHOR,
                "threadId": parent["id"],
            },
        )
        res = client.get(f"/models/{MODEL_ID}/comments", params={"threadId": parent["id"]})
        assert res.status_code == 200
        comments = res.json()["comments"]
        assert all(c["threadId"] == parent["id"] for c in comments)


class TestResolveComment:
    def test_resolve_sets_resolved_at(self, client: TestClient) -> None:
        comment = client.post(
            f"/models/{MODEL_ID}/comments",
            json={"authorId": "user-1", "body": "Needs fixing", "anchor": _ELEMENT_ANCHOR},
        ).json()
        res = client.patch(f"/models/{MODEL_ID}/comments/{comment['id']}/resolve")
        assert res.status_code == 200
        assert res.json()["resolvedAt"] is not None

    def test_resolve_404_unknown(self, client: TestClient) -> None:
        res = client.patch(f"/models/{MODEL_ID}/comments/nonexistent/resolve")
        assert res.status_code == 404


class TestDeleteComment:
    def test_delete_removes_comment(self, client: TestClient) -> None:
        comment = client.post(
            f"/models/{MODEL_ID}/comments",
            json={"authorId": "user-1", "body": "Delete me", "anchor": _ELEMENT_ANCHOR},
        ).json()
        res = client.delete(f"/models/{MODEL_ID}/comments/{comment['id']}")
        assert res.status_code == 200
        assert res.json()["deleted"] is True

    def test_delete_404_unknown(self, client: TestClient) -> None:
        res = client.delete(f"/models/{MODEL_ID}/comments/nonexistent")
        assert res.status_code == 404


class TestMarkOrphanedComments:
    def test_orphans_element_anchored_comment(self) -> None:
        from bim_ai.comments import Comment, mark_orphaned_comments

        c = Comment.model_validate(
            {
                "id": "c1",
                "modelId": "m1",
                "threadId": "c1",
                "authorId": "u1",
                "body": "test",
                "anchor": {"kind": "element", "elementId": "wall-del"},
                "createdAt": 0,
            }
        )
        result = mark_orphaned_comments([c], {"wall-del"})
        assert result[0].is_orphaned is True

    def test_does_not_orphan_point_anchor(self) -> None:
        from bim_ai.comments import Comment, mark_orphaned_comments

        c = Comment.model_validate(
            {
                "id": "c2",
                "modelId": "m1",
                "threadId": "c2",
                "authorId": "u1",
                "body": "test",
                "anchor": {"kind": "point", "worldMm": {"xMm": 0, "yMm": 0, "zMm": 0}},
                "createdAt": 0,
            }
        )
        result = mark_orphaned_comments([c], {"some-element"})
        assert result[0].is_orphaned is False

    def test_already_orphaned_not_re_processed(self) -> None:
        from bim_ai.comments import Comment, mark_orphaned_comments

        c = Comment.model_validate(
            {
                "id": "c3",
                "modelId": "m1",
                "threadId": "c3",
                "authorId": "u1",
                "body": "test",
                "anchor": {"kind": "element", "elementId": "wall-gone"},
                "createdAt": 0,
                "isOrphaned": True,
            }
        )
        result = mark_orphaned_comments([c], {"wall-gone"})
        assert result[0].is_orphaned is True
