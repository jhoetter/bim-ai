"""OSM-V3-01 — site/neighborhood import route extracted from routes/api.py (BRT-24).

Exposes ``POST /api/v3/models/{model_id}/neighborhood-import`` which
fetches OSM buildings within ``radiusM`` of (lat, lon) and upserts them
as ``neighborhood_mass`` elements on the host model.
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.routes.deps import load_model_row
from bim_ai.site.osm_import import elements_to_masses, fetch_buildings

site_import_router = APIRouter()


@site_import_router.post("/v3/models/{model_id}/neighborhood-import")
async def import_neighborhood(
    model_id: UUID,
    body: dict,
    session: Annotated[AsyncSession, Depends(get_session)],
    user_id: Annotated[str, Query(alias="userId")] = "local-dev",
) -> dict[str, Any]:
    """OSM-V3-01: fetch OSM buildings within radius_m of lat/lon and upsert into the model."""
    lat = float(body.get("lat", 0.0))
    lon = float(body.get("lon", 0.0))
    radius_m = float(body.get("radiusM", 200.0))

    elements = fetch_buildings(lat, lon, radius_m)
    masses = elements_to_masses(elements, lat, lon)

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    existing_osm_ids = {
        elem_id
        for elem_id, elem in doc.elements.items()
        if getattr(elem, "kind", None) == "neighborhood_mass"
        and getattr(elem, "source", None) == "osm"
    }
    for elem_id in existing_osm_ids:
        del doc.elements[elem_id]

    for mass in masses:
        doc.elements[mass["id"]] = mass  # type: ignore[assignment]

    row.document = doc.model_dump(by_alias=True)
    await session.commit()

    return {"imported": len(masses), "masses": masses}
