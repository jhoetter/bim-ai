"""Pydantic request bodies for ``routes_query_resolve`` (BRT-03).

Each model corresponds to exactly one FastAPI handler in
``app/bim_ai/routes_query_resolve.py``. The ground rules match
``reverse_bim_requests.py``:

1. ``model_config = ConfigDict(extra="allow", populate_by_name=True,
   protected_namespaces=())`` on every model. ``extra="allow"`` preserves the
   previous ``dict[str, Any]`` semantics — the handlers forward the whole
   body as a dict to query/resolve helpers in ``bim_ai.query_resolve``,
   which inspect many additional keys (``filter``, ``limit``, ``point``,
   ``lineStart``, ``loopId``, ...).

2. Required-field validation stays in the handler. None of these routes
   raise 422 today — they let the downstream helper return its own ``ok:
   False`` envelope — so no explicit ``if not X: raise`` blocks are
   introduced.

The two routes that already inspect specific keys (``query_*`` for
``include``; ``qa_area_reconciliation`` for ``sourceFacts``/``facts``/
``toleranceM2``) declare those fields explicitly so type-checkers can
follow the data flow.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True, protected_namespaces=())


# ---------------------------------------------------------------------------
# /query/* handlers — forward body to bim_ai.query_resolve.query_*
# ---------------------------------------------------------------------------


class QueryElementsRequest(_Base):
    include: Any | None = None


class QueryLevelsRequest(_Base):
    include: Any | None = None


class QueryTypesRequest(_Base):
    include: Any | None = None


class QueryViewsRequest(_Base):
    include: Any | None = None


class QueryHostsRequest(_Base):
    """Forwarded wholesale to ``query_hosts``; extras allowed."""


class QueryNearestWallRequest(_Base):
    """Forwarded wholesale to ``query_nearest_wall``; extras allowed."""


class QueryRoomAccessGraphRequest(_Base):
    """Forwarded wholesale to ``query_room_access_graph``; extras allowed."""


class QueryEnclosedLoopsRequest(_Base):
    """Forwarded wholesale to ``query_enclosed_loops``; extras allowed."""


# ---------------------------------------------------------------------------
# /resolve/* handlers
# ---------------------------------------------------------------------------


class ResolveActiveOrDefaultLevelRequest(_Base):
    """Forwarded wholesale to ``resolve_active_or_default_level``."""


class ResolveDefaultPlanViewRequest(_Base):
    """Forwarded wholesale to ``resolve_default_plan_view``."""


class ResolveWallByLineRequest(_Base):
    """Forwarded wholesale to ``resolve_wall_by_line``."""


class ResolveFloorSupportsRequest(_Base):
    """Forwarded wholesale to ``resolve_floor_supports``."""


class ResolveOpeningSourceMatchRequest(_Base):
    """Forwarded wholesale to ``resolve_opening_source_match``."""


class ResolveWallOpeningHostRequest(_Base):
    """Forwarded wholesale to ``resolve_wall_opening_host``."""


class ResolveDormerOpeningHostRequest(_Base):
    """Forwarded wholesale to ``resolve_dormer_opening_host``."""


class ResolveRoofPositionFromSourcePointRequest(_Base):
    """Forwarded wholesale to ``resolve_roof_position_from_source_point``."""


class ResolveRoomBoundaryEdgesRequest(_Base):
    """Forwarded wholesale to ``resolve_room_boundary_edges``."""


class ResolveHostFaceRequest(_Base):
    """Forwarded wholesale to ``resolve_host_face``."""


class ResolveFamilyTypeRequest(_Base):
    """Forwarded wholesale to ``resolve_family_type``."""


class ResolveRoomBoundaryRequest(_Base):
    """Forwarded wholesale to ``resolve_room_boundary``."""


class ResolveLoopForBoundaryRequest(_Base):
    """Forwarded wholesale to ``resolve_loop_for_boundary``."""


class ValidateRoofDormerSourceAlignmentRequest(_Base):
    """Forwarded wholesale to ``validate_roof_dormer_source_alignment``."""


# ---------------------------------------------------------------------------
# /qa/* handlers
# ---------------------------------------------------------------------------


class QaAdvisorRequest(_Base):
    """Forwarded wholesale to ``qa_advisor``."""


class QaAreaReconciliationRequest(_Base):
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    facts: Any | None = None
    tolerance_m2: Any | None = Field(default=None, alias="toleranceM2")


__all__ = [
    "QaAdvisorRequest",
    "QaAreaReconciliationRequest",
    "QueryElementsRequest",
    "QueryEnclosedLoopsRequest",
    "QueryHostsRequest",
    "QueryLevelsRequest",
    "QueryNearestWallRequest",
    "QueryRoomAccessGraphRequest",
    "QueryTypesRequest",
    "QueryViewsRequest",
    "ResolveActiveOrDefaultLevelRequest",
    "ResolveDefaultPlanViewRequest",
    "ResolveDormerOpeningHostRequest",
    "ResolveFamilyTypeRequest",
    "ResolveFloorSupportsRequest",
    "ResolveHostFaceRequest",
    "ResolveLoopForBoundaryRequest",
    "ResolveOpeningSourceMatchRequest",
    "ResolveRoofPositionFromSourcePointRequest",
    "ResolveRoomBoundaryEdgesRequest",
    "ResolveRoomBoundaryRequest",
    "ResolveWallByLineRequest",
    "ResolveWallOpeningHostRequest",
    "ValidateRoofDormerSourceAlignmentRequest",
]
