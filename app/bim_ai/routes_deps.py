from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.hub import Hub
from bim_ai.tables import ModelRecord, RedoStackRecord


def get_hub(request: Request) -> Hub:
    return request.app.state.hub


def document_to_wire(doc: Document) -> dict[str, Any]:
    return {
        "revision": doc.revision,
        "elements": {kid: elem.model_dump(by_alias=True) for kid, elem in doc.elements.items()},
    }


def _commands_include_move_level_elevation(cmds: list[dict[str, Any]]) -> bool:
    return any(str(c.get("type") or "") == "moveLevelElevation" for c in cmds)


async def load_model_row(session: AsyncSession, model_id: UUID) -> ModelRecord | None:
    res = await session.execute(select(ModelRecord).where(ModelRecord.id == model_id))
    return res.scalar_one_or_none()


def violations_wire(elements: dict) -> list[dict[str, Any]]:
    viols_list = evaluate(elements)  # type: ignore[arg-type]
    return [v.model_dump(by_alias=True) for v in viols_list]


async def delete_redos(session: AsyncSession, model_id: UUID, user_id: str) -> None:
    await session.execute(
        delete(RedoStackRecord).where(
            RedoStackRecord.model_id == model_id,
            RedoStackRecord.user_id == user_id,
        ),
    )


PERSPECTIVE_IDS = sorted(
    [
        "architecture",
        "construction",
        "coordination",
        "fire-safety",
        "mep",
        "structure",
        "agent",
    ]
)

WORKSPACE_LAYOUT_PRESET_IDS = [
    "classic",
    "split_plan_3d",
    "split_plan_section",
    "coordination",
    "schedules_focus",
    "agent_review",
]
