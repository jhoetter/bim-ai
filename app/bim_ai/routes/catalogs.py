from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from bim_ai.family_catalog_format import load_catalog_by_id, load_catalog_index

catalogs_router = APIRouter()


@catalogs_router.get("/family-catalogs")
async def list_family_catalogs() -> dict[str, Any]:
    """Return the index of bundled external family catalogs."""
    entries = load_catalog_index()
    return {"catalogs": [e.model_dump(by_alias=True) for e in entries]}


@catalogs_router.get("/family-catalogs/{catalog_id}")
async def get_family_catalog(catalog_id: str) -> dict[str, Any]:
    """Return the full payload of one external family catalog."""
    payload = load_catalog_by_id(catalog_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return payload.model_dump(by_alias=True)


@catalogs_router.get("/v3/catalog")
async def catalog_query_endpoint(
    kind: str | None = None,
    maxWidthMm: float | None = None,
    minWidthMm: float | None = None,
    tag: str | None = None,
    style: str | None = None,
    page: int = 0,
    pageSize: int = 50,
) -> dict:
    from bim_ai.catalog.query import query_catalog

    return query_catalog(
        kind=kind,
        max_width_mm=maxWidthMm,
        min_width_mm=minWidthMm,
        tag=tag,
        style=style,
        page=page,
        page_size=pageSize,
    )
