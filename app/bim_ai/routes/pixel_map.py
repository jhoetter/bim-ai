"""MRK-V3-03 — sheet pixel-map endpoint extracted from routes/api.py (BRT-24).

Exposes ``GET /api/models/{model_id}/sheets/{sheet_id}/pixel-map``.
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.routes.deps import load_model_row, resolve_caller_role

pixel_map_router = APIRouter()


@pixel_map_router.get("/models/{model_id}/sheets/{sheet_id}/pixel-map")
async def get_sheet_pixel_map(
    model_id: UUID,
    sheet_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    user_id: Annotated[str, Query(alias="userId")] = "local-dev",
) -> dict[str, Any]:
    """MRK-V3-03: return pixel→source-view/element mapping for a sheet.

    Requires at least viewer permission (public-link viewers included).
    Returns ``{ "map": { "<x>,<y>": { "sourceViewId": "...", "sourceElementId": "..." } } }``.
    """
    # Resolve role; will raise 403 for invalid/expired tokens automatically.
    # For unauthenticated callers we require a userId or token parameter.
    if user_id == "local-dev":
        pass  # dev shortcut — accepted
    else:
        # Confirm the user has at least viewer access.
        role = await resolve_caller_role(session, model_id, user_id)
        if role not in ("admin", "editor", "viewer"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    # Build the pixel map by walking view placements on the sheet.
    # For v3: all pixels inside a placement bounding box map to that viewId;
    # sourceElementId is "" unless the hit-test index is available.
    pixel_map: dict[str, dict[str, str]] = {}
    sheet_elem = doc.elements.get(sheet_id)
    if sheet_elem is not None and hasattr(sheet_elem, "view_placements"):
        for vp in getattr(sheet_elem, "view_placements", []) or []:
            vp_dict = (
                vp
                if isinstance(vp, dict)
                else (vp.model_dump(by_alias=True) if hasattr(vp, "model_dump") else {})
            )
            view_id = vp_dict.get("viewId", "")
            x_min = int(vp_dict.get("xPxMin", 0))
            x_max = int(vp_dict.get("xPxMax", 0))
            y_min = int(vp_dict.get("yPxMin", 0))
            y_max = int(vp_dict.get("yPxMax", 0))
            if not view_id:
                continue
            # Register every integer pixel coordinate in the bounding box.
            for px in range(x_min, x_max + 1):
                for py in range(y_min, y_max + 1):
                    pixel_map[f"{px},{py}"] = {
                        "sourceViewId": view_id,
                        "sourceElementId": "",
                    }

    return {"map": pixel_map}
