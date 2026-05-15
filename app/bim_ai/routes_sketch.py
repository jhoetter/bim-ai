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

from bim_ai.constraints_geometry import polygon_overlap_area_mm2
from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.elements import FloorElem, LevelElem, Vec2Mm, WallElem
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
    SUBMODES,
    PickedWall,
    PickWallsOffsetMode,
    SketchLine,
    SketchSession,
    SketchValidationIssue,
    SketchValidationState,
    finish_session,
    get_sketch_registry,
)
from bim_ai.sketch_validation import (
    SketchInvalidError,
    derive_closed_loop_polygon,
    validate_sketch_session,
)
from bim_ai.tables import UndoStackRecord

sketch_router = APIRouter()
_FLOOR_SKETCH_OVERLAP_EPS_MM2 = 1.0


def _session_payload(session: SketchSession, validation: SketchValidationState) -> dict[str, Any]:
    return {
        "session": session.model_dump(by_alias=True),
        "validation": validation.model_dump(by_alias=True),
    }


def validate_sketch_session_against_document(
    sketch_session: SketchSession,
    doc: Document,
) -> SketchValidationState:
    """Add document-aware live validation to the pure sketch topology checks."""

    validation = validate_sketch_session(sketch_session)
    if not validation.valid or sketch_session.element_kind != "floor":
        return validation

    try:
        proposed = derive_closed_loop_polygon(list(sketch_session.lines))
    except SketchInvalidError as exc:
        return SketchValidationState(
            valid=False,
            issues=[SketchValidationIssue(code=exc.code, message=exc.message)],
        )

    edit_element_id = (
        sketch_session.options.get("editElementId")
        or sketch_session.options.get("sourceElementId")
        or sketch_session.options.get("floorId")
    )
    line_indices = list(range(len(sketch_session.lines))) or None
    issues: list[SketchValidationIssue] = []
    for element in doc.elements.values():
        if not isinstance(element, FloorElem):
            continue
        if element.id == edit_element_id or element.level_id != sketch_session.level_id:
            continue
        existing = [(point.x_mm, point.y_mm) for point in element.boundary_mm]
        overlap_area_mm2 = polygon_overlap_area_mm2(proposed, existing)
        if overlap_area_mm2 <= _FLOOR_SKETCH_OVERLAP_EPS_MM2:
            continue
        label = element.name or element.id
        issues.append(
            SketchValidationIssue(
                code="floor_overlap",
                message=(
                    f"Proposed floor overlaps existing floor '{label}' "
                    f"by {overlap_area_mm2 / 1_000_000:.2f} m2; "
                    "move the boundary or edit the existing slab."
                ),
                line_indices=line_indices,
            )
        )
        break

    if not issues:
        return validation
    return SketchValidationState(valid=False, issues=[*validation.issues, *issues])


async def _load_sketch_document(
    db_session: AsyncSession,
    sketch_session: SketchSession,
) -> Document:
    row = await load_model_row(db_session, UUID(sketch_session.model_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return Document.model_validate(row.document)


async def _session_payload_with_document(
    sketch_session: SketchSession,
    db_session: AsyncSession,
) -> dict[str, Any]:
    doc = await _load_sketch_document(db_session, sketch_session)
    return _session_payload(
        sketch_session,
        validate_sketch_session_against_document(sketch_session, doc),
    )


# --- Request envelopes ----------------------------------------------------------------


class OpenSketchSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    model_id: UUID = Field(alias="modelId")
    element_kind: str = Field(default="floor", alias="elementKind")
    level_id: str = Field(alias="levelId")
    pick_walls_offset_mode: PickWallsOffsetMode = Field(
        default="interior_face", alias="pickWallsOffsetMode"
    )
    options: dict[str, Any] = Field(default_factory=dict)


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
    # Generic sub-mode options bag — overlaid on top of `session.options` and
    # forwarded to the per-kind Finish-emitter. Lets one Finish endpoint
    # serve every supported `element_kind` without per-kind request models.
    options: dict[str, Any] = Field(default_factory=dict)


# --- Endpoints ------------------------------------------------------------------------


# Wave-04 SKT-01 closeout: every `SketchElementKind` is now wired through a
# SubmodeSpec (validator + Finish-emitter). The route accepts whatever the
# session-side registry advertises so adding a new sub-mode is a one-place edit.
_SUPPORTED_ELEMENT_KINDS = set(SUBMODES.keys())


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
        options=body.options,
    )
    return _session_payload(sk, validate_sketch_session_against_document(sk, doc))


@sketch_router.get("/sketch-sessions/{session_id}")
async def get_sketch_session(
    session_id: str,
    db_session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    sk = get_sketch_registry().get(session_id)
    if sk is None:
        raise HTTPException(status_code=404, detail="sketch session not found")
    return await _session_payload_with_document(sk, db_session)


@sketch_router.post("/sketch-sessions/{session_id}/lines")
async def add_sketch_line(
    session_id: str,
    body: AddSketchLineRequest,
    db_session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
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
    return await _session_payload_with_document(sk, db_session)


@sketch_router.post("/sketch-sessions/{session_id}/remove-line")
async def remove_sketch_line(
    session_id: str,
    body: RemoveSketchLineRequest,
    db_session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
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
    return await _session_payload_with_document(sk, db_session)


@sketch_router.post("/sketch-sessions/{session_id}/move-vertex")
async def move_sketch_vertex(
    session_id: str,
    body: MoveSketchVertexRequest,
    db_session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
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
    return await _session_payload_with_document(sk, db_session)


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
    return _session_payload(sk, validate_sketch_session_against_document(sk, doc))


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

    row = await load_model_row(session, UUID(sk.model_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)

    sk = sk.model_copy(update={"pick_walls_offset_mode": body.mode})
    if sk.picked_walls:
        walls_by_id: dict[str, WallElem] = {
            eid: el for eid, el in doc.elements.items() if isinstance(el, WallElem)
        }
        new_lines, repinned = rebuild_picked_walls_lines(sk, walls_by_id)
        sk = sk.model_copy(update={"lines": new_lines, "picked_walls": repinned})
    reg.replace(sk)
    return _session_payload(sk, validate_sketch_session_against_document(sk, doc))


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
    """Thin adapter around :func:`finish_session`.

    Pulls per-kind option overrides off the request body (back-compat for the
    explicit `name` / `floorTypeId` / `thicknessMm` fields), merges them onto
    the generic `options` dict, and lets the sub-mode dispatch produce the
    commands. Validation errors raised by the validator or emitter are
    re-shaped into 409 HTTPException for the route caller.
    """

    overrides: dict[str, Any] = dict(body.options or {})
    if body.name and "name" not in overrides:
        overrides["name"] = body.name
    if body.floor_type_id is not None and "floorTypeId" not in overrides:
        overrides["floorTypeId"] = body.floor_type_id
    if body.thickness_mm is not None and "thicknessMm" not in overrides:
        overrides["thicknessMm"] = body.thickness_mm

    try:
        return finish_session(sk, overrides)
    except SketchInvalidError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "sketch_invalid",
                "validation": {
                    "valid": False,
                    "issues": [{"code": exc.code, "message": exc.message}],
                },
            },
        ) from exc


_KIND_TO_NEW_ID_FIELD: dict[str, tuple[str, str]] = {
    "floor": ("floor", "floorId"),
    "roof": ("roof", "roofId"),
    "room_separation": ("room_separation", "roomSeparationId"),
    "ceiling": ("ceiling", "ceilingId"),
    "in_place_mass": ("mass", "massId"),
    "void_cut": ("void_cut", "voidCutId"),
    "detail_region": ("detail_region", "detailRegionId"),
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

    model_uuid = UUID(sk.model_id)
    row = await load_model_row(session, model_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    baseline_doc = Document.model_validate(row.document)

    validation = validate_sketch_session_against_document(sk, baseline_doc)
    if not validation.valid:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "sketch_invalid",
                "validation": validation.model_dump(by_alias=True),
            },
        )

    cmds = _build_finish_commands(sk, body)
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
    await hub.publish(model_uuid, {"type": "delta", "modelId": str(model_uuid), **delta})

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
