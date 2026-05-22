from __future__ import annotations

import time
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

markups_router = APIRouter()

# Module-level in-memory store keyed by model_id; matches the previous route
# behavior without requiring a database migration for markup CRUD.
_markups_store: dict[str, list[dict]] = {}


def _get_markups(model_id: str) -> list[dict]:
    return _markups_store.setdefault(model_id, [])


class MarkupCreateBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    view_id: str | None = Field(default=None, alias="viewId")
    anchor: dict = Field(...)
    shape: dict = Field(...)
    author_id: str = Field(alias="authorId")


@markups_router.post("/models/{model_id}/markups")
async def create_markup(model_id: UUID, body: MarkupCreateBody) -> dict[str, Any]:
    from bim_ai.markups import Markup, Vec2Px, _rdp_simplify, sanitize_color

    mid = str(uuid4())
    shape = dict(body.shape)
    if shape.get("kind") == "freehand":
        path = shape.get("pathPx", [])
        simplified = _rdp_simplify([Vec2Px.model_validate(p) for p in path])
        shape["pathPx"] = [p.model_dump(by_alias=True) for p in simplified]
        shape["color"] = sanitize_color(shape.get("color", "var(--cat-edit)"))
    elif shape.get("kind") == "arrow":
        shape["color"] = sanitize_color(shape.get("color", "var(--cat-edit)"))

    raw: dict[str, Any] = {
        "id": mid,
        "modelId": str(model_id),
        "viewId": body.view_id,
        "anchor": body.anchor,
        "shape": shape,
        "authorId": body.author_id,
        "createdAt": int(time.time() * 1000),
        "resolvedAt": None,
    }
    markup = Markup.model_validate(raw)
    _get_markups(str(model_id)).append(markup.model_dump(by_alias=True))
    return markup.model_dump(by_alias=True)


@markups_router.get("/models/{model_id}/markups")
async def list_markups(
    model_id: UUID,
    view_id: Annotated[str | None, Query(alias="viewId")] = None,
    resolved: Annotated[str | None, Query(alias="resolved")] = None,
) -> dict[str, Any]:
    markups = list(_get_markups(str(model_id)))
    if view_id is not None:
        markups = [markup for markup in markups if markup.get("viewId") == view_id]
    if resolved is not None and resolved.lower() == "false":
        markups = [markup for markup in markups if markup.get("resolvedAt") is None]
    return {"markups": markups}


@markups_router.patch("/models/{model_id}/markups/{markup_id}/resolve")
async def resolve_markup(model_id: UUID, markup_id: str) -> dict[str, Any]:
    markups = _get_markups(str(model_id))
    for index, markup in enumerate(markups):
        if markup.get("id") == markup_id:
            resolved_markup = dict(markup)
            resolved_markup["resolvedAt"] = int(time.time() * 1000)
            markups[index] = resolved_markup
            return resolved_markup
    raise HTTPException(status_code=404, detail="Markup not found")


@markups_router.delete("/models/{model_id}/markups/{markup_id}")
async def delete_markup(model_id: UUID, markup_id: str) -> dict[str, Any]:
    markups = _get_markups(str(model_id))
    for index, markup in enumerate(markups):
        if markup.get("id") == markup_id:
            markups.pop(index)
            return {"deleted": True, "id": markup_id}
    raise HTTPException(status_code=404, detail="Markup not found")
