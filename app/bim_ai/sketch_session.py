"""SKT-01 — `SketchSession` transient state machine.

Sessions are server-side scratchpads for sketch-mode authoring: lines, vertices,
and validation state are tracked in-memory until `Finish` translates the closed
loop into a single persisted command (e.g. `CreateFloor`). Sessions never enter
the `Document` snapshot — they have no element id, no undo entry, no IFC trace.

Element kinds supported (wave3-4 propagation): `floor`, `roof`,
`room_separation`. `ceiling`, `in_place_mass`, `void_cut`, and `detail_region`
remain deferred follow-ups (each reuses the same protocol). `ceiling`
specifically is gated on a CeilingElem + createCeiling command landing as
its own kernel WP.
"""

from __future__ import annotations

import uuid
from threading import RLock
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import Vec2Mm

SketchElementKind = Literal["floor", "roof", "room_separation"]
SketchSessionStatus = Literal["open", "finished", "cancelled"]
# SKT-02: sub-tool config — does Pick Walls insert wall centerlines or
# offset-by-half-thickness lines along the wall's interior face?
PickWallsOffsetMode = Literal["centerline", "interior_face"]


class SketchLine(BaseModel):
    """A single straight segment in a sketch session, in level-local mm."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    from_mm: Vec2Mm = Field(alias="fromMm")
    to_mm: Vec2Mm = Field(alias="toMm")


class SketchValidationIssue(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    code: str
    message: str
    line_index: int | None = Field(default=None, alias="lineIndex")
    line_indices: list[int] | None = Field(default=None, alias="lineIndices")


class SketchValidationState(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    valid: bool
    issues: list[SketchValidationIssue] = Field(default_factory=list)


class PickedWall(BaseModel):
    """SKT-02 — bookkeeping for a wall referenced via the Pick Walls sub-tool.

    Tracks the wall id so re-clicking the same wall toggles it off, and the
    `line_index` so we know which sketch line to remove on toggle-off and which
    to re-derive when the offset mode flips.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    wall_id: str = Field(alias="wallId")
    line_index: int = Field(alias="lineIndex")


class SketchSession(BaseModel):
    """Transient sketch authoring state.

    Not persisted in the model snapshot. Lives in-process inside a
    :class:`SketchSessionRegistry`. Cleared on `Finish` (after a single
    `CreateFloor` is committed) or `Cancel`.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    session_id: str = Field(alias="sessionId")
    model_id: str = Field(alias="modelId")
    element_kind: SketchElementKind = Field(alias="elementKind")
    level_id: str = Field(alias="levelId")
    lines: list[SketchLine] = Field(default_factory=list)
    status: SketchSessionStatus = "open"
    pick_walls_offset_mode: PickWallsOffsetMode = Field(
        default="interior_face", alias="pickWallsOffsetMode"
    )
    picked_walls: list[PickedWall] = Field(default_factory=list, alias="pickedWalls")


class SketchSessionRegistry:
    """In-memory store for active sketch sessions.

    Keyed by session_id. Sessions are scoped to a single process and lost on
    restart — that's intentional: they're scratch state, not committed authoring.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._sessions: dict[str, SketchSession] = {}

    def open(
        self,
        *,
        model_id: str,
        element_kind: SketchElementKind,
        level_id: str,
        pick_walls_offset_mode: PickWallsOffsetMode = "interior_face",
    ) -> SketchSession:
        with self._lock:
            session_id = str(uuid.uuid4())
            session = SketchSession(
                session_id=session_id,
                model_id=model_id,
                element_kind=element_kind,
                level_id=level_id,
                lines=[],
                status="open",
                pick_walls_offset_mode=pick_walls_offset_mode,
                picked_walls=[],
            )
            self._sessions[session_id] = session
            return session

    def get(self, session_id: str) -> SketchSession | None:
        with self._lock:
            return self._sessions.get(session_id)

    def require_open(self, session_id: str) -> SketchSession:
        session = self.get(session_id)
        if session is None:
            raise KeyError(f"sketch session not found: {session_id}")
        if session.status != "open":
            raise ValueError(f"sketch session {session_id} is {session.status}; cannot mutate")
        return session

    def replace(self, session: SketchSession) -> None:
        with self._lock:
            self._sessions[session.session_id] = session

    def discard(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)


# Process-global registry. Sessions are transient and do not need durable
# storage; one per FastAPI process is fine for the load-bearing slice.
_REGISTRY = SketchSessionRegistry()


def get_sketch_registry() -> SketchSessionRegistry:
    return _REGISTRY
