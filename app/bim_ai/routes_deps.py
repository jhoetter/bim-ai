from __future__ import annotations

import time
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.constraints import evaluate
from bim_ai.constraints_core import Violation
from bim_ai.document import Document
from bim_ai.hub import Hub
from bim_ai.model_integrity import ModelIntegrityFinding, check_model_integrity_invariants
from bim_ai.model_integrity_hosting import hosted_opening_integrity_violations
from bim_ai.tables import ModelRecord, RedoStackRecord, RoleAssignmentRecord


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
    viols_list = [
        *evaluate(elements),  # type: ignore[arg-type]
        *_model_integrity_violations(elements),
    ]
    viols_list.sort(key=lambda v: (v.rule_id, tuple(sorted(v.element_ids)), v.severity))
    return [v.model_dump(by_alias=True) for v in viols_list]


def _model_integrity_violations(elements: dict) -> list[Violation]:
    violations = [
        _integrity_finding_to_violation(finding)
        for finding in check_model_integrity_invariants(elements)
        if finding.severity == "error"
    ]
    violations.extend(hosted_opening_integrity_violations(elements))  # type: ignore[arg-type]
    return violations


def _integrity_finding_to_violation(finding: ModelIntegrityFinding) -> Violation:
    return Violation(
        rule_id=finding.rule_id,
        severity=finding.severity,
        message=finding.message,
        element_ids=list(finding.element_ids),
        blocking=finding.severity == "error",
        discipline="coordination",
        blocking_class="model_integrity",
    )


async def delete_redos(session: AsyncSession, model_id: UUID, user_id: str) -> None:
    await session.execute(
        delete(RedoStackRecord).where(
            RedoStackRecord.model_id == model_id,
            RedoStackRecord.user_id == user_id,
        ),
    )


async def resolve_caller_role(session: AsyncSession, model_id: str | UUID, user_id: str) -> str:
    """Return the caller's role for model_id. Defaults to 'admin' when no record exists."""
    res = await session.execute(
        select(RoleAssignmentRecord).where(
            RoleAssignmentRecord.model_id == str(model_id),
            RoleAssignmentRecord.subject_kind == "user",
            RoleAssignmentRecord.subject_id == user_id,
        )
    )
    record = res.scalars().first()
    return record.role if record is not None else "admin"


async def resolve_token_role(session: AsyncSession, model_id_str: str, token: str) -> str:
    """Resolve a public-link token to a role; raises 403 if invalid or expired."""
    now_ms = int(time.time() * 1000)
    res = await session.execute(
        select(RoleAssignmentRecord).where(
            RoleAssignmentRecord.model_id == model_id_str,
            RoleAssignmentRecord.subject_kind == "public-link",
            RoleAssignmentRecord.subject_id == token,
        )
    )
    record = res.scalars().first()
    if record is None:
        raise HTTPException(status_code=403, detail="Invalid public-link token")
    if record.expires_at is not None and record.expires_at < now_ms:
        raise HTTPException(status_code=403, detail="Public-link token has expired")
    return record.role


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
