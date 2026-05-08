"""SKT-01 — `SketchSession` transient state machine.

Sessions are server-side scratchpads for sketch-mode authoring: lines, vertices,
and validation state are tracked in-memory until `Finish` translates the closed
loop into a single persisted command (e.g. `CreateFloor`). Sessions never enter
the `Document` snapshot — they have no element id, no undo entry, no IFC trace.

Element kinds supported: `floor`, `roof`, `room_separation`, `ceiling`,
`in_place_mass`, `void_cut`, `detail_region`. The first three came in the
wave2-3/wave3-4 slices; the latter four landed in wave-04 (this file).

Each sub-mode is registered in :data:`SUBMODES` with a validator and a
Finish-emitter; :func:`finish_session` is the single dispatch entry point that
the HTTP route calls.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from threading import RLock
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import Vec2Mm

SketchElementKind = Literal[
    "floor",
    "roof",
    "room_separation",
    "ceiling",
    "in_place_mass",
    "void_cut",
    "detail_region",
    "stair",
]
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
    options: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Sub-mode-specific options threaded through to the Finish-emitter. "
            "void_cut requires `hostElementId` and `depthMm`; in_place_mass uses "
            "`heightMm` / `rotationDeg` / `materialKey`; detail_region uses "
            "`hostViewId`. Stored on the session so a tool that locks an option "
            "(e.g. picked host) does not need to re-pass it on Finish."
        ),
    )


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
        options: dict[str, Any] | None = None,
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
                options=dict(options or {}),
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


# ---- Sub-mode dispatch ---------------------------------------------------------------
#
# Every supported `element_kind` has:
#   - a `validator`: ensures the session's lines are well-formed for the kind.
#     Polygon-style kinds use `assert_closed_loop` over the derived polygon;
#     line-set kinds use `assert_line_set` over the raw segments.
#   - an `emitter`: translates the (validated) session + sub-mode options into
#     a list of authoring commands (typically one) that the engine commits
#     through `try_commit`.
#
# The HTTP route in `routes_sketch.py` wraps `finish_session` so the same code
# path is exercised by tests (which call `finish_session` directly) and by
# real authoring (which goes through the route).


# A Finish-emitter receives the validated session plus a merged options dict
# (the per-kind defaults overlaid with whatever the request body supplies)
# and returns a list of engine commands as plain dicts.
FinishEmitter = Callable[["SketchSession", dict[str, Any]], list[dict[str, Any]]]
# A Validator receives the session and raises `SketchInvalidError` if the
# sketch is unfit for Finish; otherwise returns silently.
SketchValidator = Callable[["SketchSession"], None]


@dataclass(frozen=True)
class SubmodeSpec:
    """Validator + Finish-emitter for one element kind."""

    validator: SketchValidator
    emitter: FinishEmitter


def _validate_polygon_session(session: SketchSession) -> None:
    """Validate a polygon-style sub-mode (floor / roof / ceiling / mass / void).

    Two layers, both required:

    1. :func:`validate_session` does the structural check (vertex incidence,
       zero-length lines, self-intersection) on the original ``SketchLine``
       list. This catches the most common authoring mistakes ("I forgot the
       last segment").
    2. :func:`assert_closed_loop` is the lightweight guard on the derived
       polygon — degenerate consecutive vertices land here.

    Imports happen inside the function to avoid a circular import between
    `sketch_session` and `sketch_validation` (the latter imports from this
    module at top level).
    """

    from bim_ai.sketch_validation import (
        SketchInvalidError,
        assert_closed_loop,
        derive_closed_loop_polygon,
        validate_session,
    )

    state = validate_session(list(session.lines))
    if not state.valid and state.issues:
        first = state.issues[0]
        raise SketchInvalidError(first.code, first.message)

    polygon_xy = derive_closed_loop_polygon(list(session.lines))
    polygon = [Vec2Mm(xMm=x, yMm=y) for (x, y) in polygon_xy]
    assert_closed_loop(polygon)


def _validate_line_set_session(session: SketchSession) -> None:
    """Validate a line-set sub-mode (room_separation / detail_region)."""

    from bim_ai.sketch_validation import assert_line_set

    segments = [(ln.from_mm, ln.to_mm) for ln in session.lines]
    assert_line_set(segments)


def _polygon_payload(session: SketchSession) -> list[dict[str, float]]:
    from bim_ai.sketch_validation import derive_closed_loop_polygon

    polygon = derive_closed_loop_polygon(list(session.lines))
    return [{"xMm": x, "yMm": y} for (x, y) in polygon]


def _emit_floor(session: SketchSession, opts: dict[str, Any]) -> list[dict[str, Any]]:
    cmd: dict[str, Any] = {
        "type": "createFloor",
        "name": opts.get("name", "Floor"),
        "levelId": session.level_id,
        "boundaryMm": _polygon_payload(session),
    }
    if "floorTypeId" in opts and opts["floorTypeId"] is not None:
        cmd["floorTypeId"] = opts["floorTypeId"]
    if "thicknessMm" in opts and opts["thicknessMm"] is not None:
        cmd["thicknessMm"] = opts["thicknessMm"]
    return [cmd]


def _emit_roof(session: SketchSession, opts: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "type": "createRoof",
            "name": opts.get("name", "Roof"),
            "referenceLevelId": session.level_id,
            "footprintMm": _polygon_payload(session),
            "roofGeometryMode": opts.get("roofGeometryMode", "mass_box"),
        }
    ]


def _emit_room_separation(
    session: SketchSession, opts: dict[str, Any]
) -> list[dict[str, Any]]:
    name = opts.get("name", "Separation")
    return [
        {
            "type": "createRoomSeparation",
            "name": name,
            "levelId": session.level_id,
            "start": {"xMm": ln.from_mm.x_mm, "yMm": ln.from_mm.y_mm},
            "end": {"xMm": ln.to_mm.x_mm, "yMm": ln.to_mm.y_mm},
        }
        for ln in session.lines
    ]


def _emit_ceiling(session: SketchSession, opts: dict[str, Any]) -> list[dict[str, Any]]:
    cmd: dict[str, Any] = {
        "type": "createCeiling",
        "name": opts.get("name", "Ceiling"),
        "levelId": session.level_id,
        "boundaryMm": _polygon_payload(session),
    }
    if "heightOffsetMm" in opts and opts["heightOffsetMm"] is not None:
        cmd["heightOffsetMm"] = opts["heightOffsetMm"]
    if "thicknessMm" in opts and opts["thicknessMm"] is not None:
        cmd["thicknessMm"] = opts["thicknessMm"]
    if "ceilingTypeId" in opts and opts["ceilingTypeId"] is not None:
        cmd["ceilingTypeId"] = opts["ceilingTypeId"]
    return [cmd]


def _emit_in_place_mass(
    session: SketchSession, opts: dict[str, Any]
) -> list[dict[str, Any]]:
    cmd: dict[str, Any] = {
        "type": "createMass",
        "name": opts.get("name", "Mass"),
        "levelId": session.level_id,
        "footprintMm": _polygon_payload(session),
    }
    if "heightMm" in opts and opts["heightMm"] is not None:
        cmd["heightMm"] = opts["heightMm"]
    if "rotationDeg" in opts and opts["rotationDeg"] is not None:
        cmd["rotationDeg"] = opts["rotationDeg"]
    if "materialKey" in opts and opts["materialKey"] is not None:
        cmd["materialKey"] = opts["materialKey"]
    return [cmd]


def _emit_void_cut(session: SketchSession, opts: dict[str, Any]) -> list[dict[str, Any]]:
    from bim_ai.sketch_validation import SketchInvalidError

    host_id = opts.get("hostElementId")
    if not host_id:
        raise SketchInvalidError(
            "missing_host",
            "void_cut Finish requires `hostElementId` in options.",
        )
    depth = opts.get("depthMm")
    if depth is None or float(depth) <= 0:
        raise SketchInvalidError(
            "invalid_depth",
            "void_cut Finish requires positive `depthMm` in options.",
        )
    return [
        {
            "type": "createVoidCut",
            "hostElementId": host_id,
            "profileMm": _polygon_payload(session),
            "depthMm": float(depth),
        }
    ]


def _emit_detail_region(
    session: SketchSession, opts: dict[str, Any]
) -> list[dict[str, Any]]:
    from bim_ai.sketch_validation import SketchInvalidError

    host_view_id = opts.get("hostViewId")
    if not host_view_id:
        raise SketchInvalidError(
            "missing_host_view",
            "detail_region Finish requires `hostViewId` in options.",
        )
    # Detail region commits as one filled polygon. The session lines describe
    # an open or closed line-set; we reuse them as the boundary in order, plus
    # we close the loop by appending the start vertex if needed. The engine's
    # createDetailRegion validator only requires ≥3 boundary points.
    boundary: list[dict[str, float]] = []
    for ln in session.lines:
        boundary.append({"xMm": ln.from_mm.x_mm, "yMm": ln.from_mm.y_mm})
    if session.lines:
        last = session.lines[-1]
        boundary.append({"xMm": last.to_mm.x_mm, "yMm": last.to_mm.y_mm})
    cmd: dict[str, Any] = {
        "type": "createDetailRegion",
        "hostViewId": host_view_id,
        "boundaryMm": boundary,
    }
    for k in ("fillColour", "fillPattern", "strokeMm", "strokeColour"):
        if k in opts and opts[k] is not None:
            cmd[k] = opts[k]
    return [cmd]


def _emit_stair(session: SketchSession, opts: dict[str, Any]) -> list[dict[str, Any]]:
    """KRN-07 closeout — emit a CreateStair with shape='sketch' from the session
    line set. The polyline runs through every line's `from_mm` plus the last
    line's `to_mm` (preserving authoring order).
    """

    from bim_ai.sketch_validation import SketchInvalidError

    base_level_id = opts.get("baseLevelId") or session.level_id
    top_level_id = opts.get("topLevelId")
    if not top_level_id:
        raise SketchInvalidError(
            "missing_top_level",
            "stair Finish requires `topLevelId` in options.",
        )

    if not session.lines:
        raise SketchInvalidError(
            "empty_sketch",
            "stair Finish requires at least one sketch line.",
        )

    path: list[dict[str, float]] = []
    for ln in session.lines:
        path.append({"xMm": ln.from_mm.x_mm, "yMm": ln.from_mm.y_mm})
    last = session.lines[-1]
    path.append({"xMm": last.to_mm.x_mm, "yMm": last.to_mm.y_mm})

    cmd: dict[str, Any] = {
        "type": "createStair",
        "name": opts.get("name", "Stair"),
        "baseLevelId": base_level_id,
        "topLevelId": top_level_id,
        "runStartMm": path[0],
        "runEndMm": path[-1],
        "shape": "sketch",
        "sketchPathMm": path,
    }
    for k in ("widthMm", "riserMm", "treadMm", "riserCount"):
        if k in opts and opts[k] is not None:
            cmd[k] = opts[k]
    return [cmd]


SUBMODES: dict[str, SubmodeSpec] = {
    "floor": SubmodeSpec(_validate_polygon_session, _emit_floor),
    "roof": SubmodeSpec(_validate_polygon_session, _emit_roof),
    "room_separation": SubmodeSpec(_validate_line_set_session, _emit_room_separation),
    "ceiling": SubmodeSpec(_validate_polygon_session, _emit_ceiling),
    "in_place_mass": SubmodeSpec(_validate_polygon_session, _emit_in_place_mass),
    "void_cut": SubmodeSpec(_validate_polygon_session, _emit_void_cut),
    "detail_region": SubmodeSpec(_validate_line_set_session, _emit_detail_region),
    "stair": SubmodeSpec(_validate_line_set_session, _emit_stair),
}


def finish_session(
    session: SketchSession,
    options: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Validate the session for its sub-mode, then return the Finish commands.

    Raises :class:`SketchInvalidError` on validation failure (open loop /
    empty line set / missing required option). Caller is responsible for
    feeding the returned commands through `try_commit` and persisting the
    document.
    """

    spec = SUBMODES.get(session.element_kind)
    if spec is None:
        raise ValueError(f"unsupported element_kind: {session.element_kind!r}")

    spec.validator(session)

    merged: dict[str, Any] = {}
    merged.update(session.options or {})
    if options:
        merged.update(options)

    return spec.emitter(session, merged)
