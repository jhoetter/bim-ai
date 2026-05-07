"""SKT-01 — sketch session HTTP API (floor-only slice).

Sketch sessions are transient scratchpads, not persisted commands. They live in
:class:`SketchSessionRegistry` (in-process) and only emit a single persisted
`CreateFloor` on `Finish`. That commit goes through the regular `try_commit`
path so undo/redo, constraint evaluation, and WebSocket broadcasts all work as
they do for any other authoring command.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.elements import LevelElem, Vec2Mm, WallElem
from bim_ai.engine import (
    clone_document,
    compute_delta_wire,
    diff_undo_cmds,
    try_commit,
)
from bim_ai.hub import Hub
from bim_ai.routes_deps import (
    delete_redos,
    document_to_wire,
    get_hub,
    load_model_row,
    violations_wire,
)
from bim_ai.sketch_pick_walls import (
    rebuild_picked_walls_lines,
)
from bim_ai.sketch_session import (
    PickedWall,
    PickWallsOffsetMode,
    SketchLine,
    SketchSession,
    SketchValidationState,
    get_sketch_registry,
)
from bim_ai.sketch_validation import (
    derive_closed_loop_polygon,
    validate_sketch_session,
)
from bim_ai.tables import UndoStackRecord

sketch_router = APIRouter()


def _session_payload(session: SketchSession, validation: SketchValidationState) -> dict[str, Any]:
    return {
        "session": session.model_dump(by_alias=True),
        "validation": validation.model_dump(by_alias=True),
    }


# --- Request envelopes ----------------------------------------------------------------


class OpenSketchSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    model_id: UUID = Field(alias="modelId")
    element_kind: str = Field(default="floor", alias="elementKind")
    level_id: str = Field(alias="levelId")
    pick_walls_offset_mode: PickWallsOffsetMode = Field(
        default="interior_face", alias="pickWallsOffsetMode"
    )


class AddSketchLineRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    from_mm: Vec2Mm = Field(alias="fromMm")
    to_mm: Vec2Mm = Field(alias="toMm")


class RemoveSketchLineRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    line_index: int = Field(alias="lineIndex")


class MoveSketchVertexRequest(BaseModel):
    """Move every endpoint coincident with `fromMm` to `toMm`.

    Coincidence is decided by the sketch-validation vertex tolerance (sub-mm)
    so two lines that share a vertex stay glued after the move.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    from_mm: Vec2Mm = Field(alias="fromMm")
    to_mm: Vec2Mm = Field(alias="toMm")


class PickWallRequest(BaseModel):
    """SKT-02 — toggle a wall in/out of the sketch session.

    If the wall id is already among the session's `picked_walls`, it's removed
    (toggle off). Otherwise the wall's centerline (or interior-face offset)
    is added as a sketch line. After every toggle the registry re-derives all
    picked-wall lines so a flipped offset mode or a freshly added neighbour
    triggers a corner re-trim.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    wall_id: str = Field(alias="wallId")


class SetPickWallsOffsetModeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    mode: PickWallsOffsetMode


class FinishSketchSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    name: str = Field(default="Floor")
    floor_type_id: str | None = Field(default=None, alias="floorTypeId")
    thickness_mm: float | None = Field(default=None, alias="thicknessMm")
    user_id: str | None = Field(default="local-dev", alias="userId")
    client_op_id: str | None = Field(default=None, alias="clientOpId")


# --- Endpoints ------------------------------------------------------------------------


# `ceiling` is reserved by the SKT-01 schema but waits on a CeilingElem +
# createCeiling command (own WP). Ship floor / roof / room_separation now.
_SUPPORTED_ELEMENT_KINDS = {"floor", "roof", "room_separation"}


@sketch_router.post("/sketch-sessions")
async def open_sketch_session(
    body: OpenSketchSessionRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if body.element_kind not in _SUPPORTED_ELEMENT_KINDS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"unsupported_element_kind: '{body.element_kind}' — supported: "
                f"{sorted(_SUPPORTED_ELEMENT_KINDS)}"
            ),
        )

    row = await load_model_row(session, body.model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)
    level = doc.elements.get(body.level_id)
    if not isinstance(level, LevelElem):
        raise HTTPException(
            status_code=400,
            detail=f"level_id '{body.level_id}' must reference an existing Level",
        )

    sk = get_sketch_registry().open(
        model_id=str(body.model_id),
        element_kind=body.element_kind,  # type: ignore[arg-type]
        level_id=body.level_id,
        pick_walls_offset_mode=body.pick_walls_offset_mode,
    )
    return _session_payload(sk, validate_sketch_session(sk))


@sketch_router.get("/sketch-sessions/{session_id}")
async def get_sketch_session(session_id: str) -> dict[str, Any]:
    sk = get_sketch_registry().get(session_id)
    if sk is None:
        raise HTTPException(status_code=404, detail="sketch session not found")
    return _session_payload(sk, validate_sketch_session(sk))


@sketch_router.post("/sketch-sessions/{session_id}/lines")
async def add_sketch_line(session_id: str, body: AddSketchLineRequest) -> dict[str, Any]:
    reg = get_sketch_registry()
    try:
        sk = reg.require_open(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    sk = sk.model_copy(
        update={"lines": [*sk.lines, SketchLine(from_mm=body.from_mm, to_mm=body.to_mm)]}
    )
    reg.replace(sk)
    return _session_payload(sk, validate_sketch_session(sk))


@sketch_router.post("/sketch-sessions/{session_id}/remove-line")
async def remove_sketch_line(session_id: str, body: RemoveSketchLineRequest) -> dict[str, Any]:
    reg = get_sketch_registry()
    try:
        sk = reg.require_open(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if body.line_index < 0 or body.line_index >= len(sk.lines):
        raise HTTPException(
            status_code=400,
            detail=f"line_index {body.line_index} out of range (0..{len(sk.lines) - 1})",
        )
    new_lines = list(sk.lines)
    new_lines.pop(body.line_index)
    sk = sk.model_copy(update={"lines": new_lines})
    reg.replace(sk)
    return _session_payload(sk, validate_sketch_session(sk))


@sketch_router.post("/sketch-sessions/{session_id}/move-vertex")
async def move_sketch_vertex(session_id: str, body: MoveSketchVertexRequest) -> dict[str, Any]:
    reg = get_sketch_registry()
    try:
        sk = reg.require_open(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    eps_mm = 0.5

    def _coincident(a: Vec2Mm) -> bool:
        return (
            abs(a.x_mm - body.from_mm.x_mm) <= eps_mm and abs(a.y_mm - body.from_mm.y_mm) <= eps_mm
        )

    new_lines: list[SketchLine] = []
    for line in sk.lines:
        new_from = body.to_mm if _coincident(line.from_mm) else line.from_mm
        new_to = body.to_mm if _coincident(line.to_mm) else line.to_mm
        new_lines.append(SketchLine(from_mm=new_from, to_mm=new_to))
    sk = sk.model_copy(update={"lines": new_lines})
    reg.replace(sk)
    return _session_payload(sk, validate_sketch_session(sk))


@sketch_router.post("/sketch-sessions/{session_id}/pick-wall")
async def pick_wall(
    session_id: str,
    body: PickWallRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    reg = get_sketch_registry()
    try:
        sk = reg.require_open(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    row = await load_model_row(session, UUID(sk.model_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    wall = doc.elements.get(body.wall_id)
    if not isinstance(wall, WallElem):
        raise HTTPException(
            status_code=400,
            detail=f"wall_id '{body.wall_id}' must reference an existing wall",
        )

    walls_by_id: dict[str, WallElem] = {
        eid: el for eid, el in doc.elements.items() if isinstance(el, WallElem)
    }

    already_picked = next((p for p in sk.picked_walls if p.wall_id == body.wall_id), None)
    if already_picked is not None:
        new_picked = [p for p in sk.picked_walls if p.wall_id != body.wall_id]
    else:
        new_picked = [
            *sk.picked_walls,
            PickedWall(wall_id=body.wall_id, line_index=-1),
        ]
    sk = sk.model_copy(update={"picked_walls": new_picked})
    new_lines, repinned = rebuild_picked_walls_lines(sk, walls_by_id)
    sk = sk.model_copy(update={"lines": new_lines, "picked_walls": repinned})
    reg.replace(sk)
    return _session_payload(sk, validate_sketch_session(sk))


@sketch_router.post("/sketch-sessions/{session_id}/pick-walls-offset-mode")
async def set_pick_walls_offset_mode(
    session_id: str,
    body: SetPickWallsOffsetModeRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    reg = get_sketch_registry()
    try:
        sk = reg.require_open(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    sk = sk.model_copy(update={"pick_walls_offset_mode": body.mode})
    if sk.picked_walls:
        row = await load_model_row(session, UUID(sk.model_id))
        if row is None:
            raise HTTPException(status_code=404, detail="Model not found")
        doc = Document.model_validate(row.document)
        walls_by_id: dict[str, WallElem] = {
            eid: el for eid, el in doc.elements.items() if isinstance(el, WallElem)
        }
        new_lines, repinned = rebuild_picked_walls_lines(sk, walls_by_id)
        sk = sk.model_copy(update={"lines": new_lines, "picked_walls": repinned})
    reg.replace(sk)
    return _session_payload(sk, validate_sketch_session(sk))


@sketch_router.post("/sketch-sessions/{session_id}/cancel")
async def cancel_sketch_session(session_id: str) -> dict[str, Any]:
    reg = get_sketch_registry()
    sk = reg.get(session_id)
    if sk is None:
        raise HTTPException(status_code=404, detail="sketch session not found")
    sk = sk.model_copy(update={"status": "cancelled"})
    reg.replace(sk)
    reg.discard(session_id)
    return {"ok": True, "sessionId": session_id, "status": "cancelled"}


def _build_finish_commands(
    sk: SketchSession,
    body: FinishSketchSessionRequest,
) -> list[dict[str, Any]]:
    """Translate the sketch's lines into one or more authoring commands.

    - floor / ceiling / roof: one closed-loop polygon → single Create*Cmd
    - room_separation: one line per sketch segment → one CreateRoomSeparation
      command per line (matches Revit behaviour where each separator is
      independently authored)
    """

    if sk.element_kind == "room_separation":
        return [
            {
                "type": "createRoomSeparation",
                "name": body.name or "Separation",
                "levelId": sk.level_id,
                "start": {"xMm": ln.from_mm.x_mm, "yMm": ln.from_mm.y_mm},
                "end": {"xMm": ln.to_mm.x_mm, "yMm": ln.to_mm.y_mm},
            }
            for ln in sk.lines
        ]

    polygon = derive_closed_loop_polygon(list(sk.lines))
    if len(polygon) < 3:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "sketch_invalid",
                "validation": {
                    "valid": False,
                    "issues": [{"code": "open_loop", "message": "no closed loop derivable"}],
                },
            },
        )
    boundary_payload = [{"xMm": x, "yMm": y} for (x, y) in polygon]

    if sk.element_kind == "floor":
        cmd: dict[str, Any] = {
            "type": "createFloor",
            "name": body.name or "Floor",
            "levelId": sk.level_id,
            "boundaryMm": boundary_payload,
        }
        if body.floor_type_id is not None:
            cmd["floorTypeId"] = body.floor_type_id
        if body.thickness_mm is not None:
            cmd["thicknessMm"] = body.thickness_mm
        return [cmd]

    if sk.element_kind == "roof":
        return [
            {
                "type": "createRoof",
                "name": body.name or "Roof",
                "referenceLevelId": sk.level_id,
                "footprintMm": boundary_payload,
                "roofGeometryMode": "mass_box",
            }
        ]

    raise HTTPException(
        status_code=400,
        detail=f"unsupported_element_kind: '{sk.element_kind}'",
    )


_KIND_TO_NEW_ID_FIELD: dict[str, tuple[str, str]] = {
    "floor": ("floor", "floorId"),
    "roof": ("roof", "roofId"),
    "room_separation": ("room_separation", "roomSeparationId"),
}


@sketch_router.post("/sketch-sessions/{session_id}/finish")
async def finish_sketch_session(
    session_id: str,
    body: FinishSketchSessionRequest,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    reg = get_sketch_registry()
    try:
        sk = reg.require_open(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    validation = validate_sketch_session(sk)
    if not validation.valid:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "sketch_invalid",
                "validation": validation.model_dump(by_alias=True),
            },
        )

    cmds = _build_finish_commands(sk, body)

    model_uuid = UUID(sk.model_id)
    row = await load_model_row(session, model_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    baseline_doc = Document.model_validate(row.document)
    doc_before = clone_document(baseline_doc)

    current_doc = baseline_doc
    last_cmd: dict[str, Any] | None = None
    last_violations: list[Any] = []
    new_doc = None
    for cmd in cmds:
        try:
            ok, candidate, _cmd_obj, violations, code = try_commit(current_doc, cmd)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid command: {exc}") from exc
        if not ok or candidate is None:
            viols_wire = [v.model_dump(by_alias=True) for v in violations]
            raise HTTPException(
                status_code=409, detail={"reason": code, "violations": viols_wire}
            )
        current_doc = candidate
        last_cmd = cmd
        last_violations = violations
        new_doc = candidate

    if new_doc is None or last_cmd is None:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "sketch_invalid",
                "validation": {
                    "valid": False,
                    "issues": [{"code": "empty_sketch", "message": "no commands emitted"}],
                },
            },
        )

    uid = body.user_id or "local-dev"
    undo_cmds = diff_undo_cmds(doc_before, new_doc)
    await delete_redos(session, model_uuid, uid)
    session.add(
        UndoStackRecord(
            model_id=model_uuid,
            user_id=uid,
            revision_after=new_doc.revision,
            forward_commands=cmds,
            undo_commands=undo_cmds,
            created_at=datetime.now(UTC),
        )
    )

    wire_doc = document_to_wire(new_doc)
    row.document = wire_doc  # type: ignore[assignment]
    row.revision = new_doc.revision
    await session.commit()

    delta = compute_delta_wire(doc_before, new_doc)
    if body.client_op_id:
        delta["clientOpId"] = body.client_op_id
    await hub.broadcast_json(model_uuid, {"type": "delta", "modelId": str(model_uuid), **delta})

    sk = sk.model_copy(update={"status": "finished"})
    reg.replace(sk)
    reg.discard(session_id)

    target_kind, id_field_name = _KIND_TO_NEW_ID_FIELD[sk.element_kind]
    new_ids: list[str] = [
        el_id
        for el_id, el in new_doc.elements.items()
        if el_id not in doc_before.elements and getattr(el, "kind", None) == target_kind
    ]
    primary_id = new_ids[0] if new_ids else None

    response: dict[str, Any] = {
        "ok": True,
        "sessionId": session_id,
        "status": "finished",
        # Back-compat: floorId stays populated for floor sketches; new id_field
        # carries the kind-specific id for ceiling / roof / room_separation.
        "floorId": primary_id if sk.element_kind == "floor" else None,
        id_field_name: primary_id,
        "createdElementIds": new_ids,
        "modelId": str(model_uuid),
        "revision": new_doc.revision,
        "elements": wire_doc["elements"],
        "violations": violations_wire(new_doc.elements),
        "appliedCommand": last_cmd,
        "appliedCommands": cmds,
        "clientOpId": body.client_op_id,
        "delta": delta,
    }
    # Drop noise from the response when last_violations is the default empty list.
    _ = last_violations
    return response
