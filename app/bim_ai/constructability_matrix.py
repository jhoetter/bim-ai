from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

from bim_ai.constructability_geometry import PhysicalParticipant

ConstructabilityCheckType = Literal["hard", "clearance", "penetration", "duplicate"]

DEFAULT_CONSTRUCTABILITY_MATRIX_VERSION = "constructability-matrix-v1"


@dataclass(frozen=True)
class ConstructabilityMatrixCell:
    group_a: str
    group_b: str
    check_type: ConstructabilityCheckType
    rule_id: str
    severity: str
    tolerance_mm: float = 0.0
    enabled: bool = True
    message: str = ""

    def matches(self, a: PhysicalParticipant, b: PhysicalParticipant) -> bool:
        if not self.enabled:
            return False
        group_a = participant_matrix_group(a)
        group_b = participant_matrix_group(b)
        return {self.group_a, self.group_b} == {group_a, group_b}


DEFAULT_CONSTRUCTABILITY_MATRIX: tuple[ConstructabilityMatrixCell, ...] = (
    ConstructabilityMatrixCell(
        group_a="furniture",
        group_b="wall",
        check_type="hard",
        rule_id="furniture_wall_hard_clash",
        severity="warning",
        tolerance_mm=1.0,
        message=(
            "Furniture or family collision proxy intersects a wall; move it, host it, "
            "or add an intentional recess/opening."
        ),
    ),
    ConstructabilityMatrixCell(
        group_a="stair",
        group_b="wall",
        check_type="hard",
        rule_id="stair_wall_hard_clash",
        severity="warning",
        tolerance_mm=1.0,
        message="Stair collision proxy intersects a wall; revise the stair opening or wall layout.",
    ),
    ConstructabilityMatrixCell(
        group_a="structural_linear",
        group_b="wall",
        check_type="hard",
        rule_id="physical_hard_clash",
        severity="warning",
        tolerance_mm=1.0,
        message=(
            "Structural member collision proxy intersects a wall; add an opening, "
            "revise framing, or record an intentional bearing condition."
        ),
    ),
    ConstructabilityMatrixCell(
        group_a="furniture",
        group_b="furniture",
        check_type="hard",
        rule_id="physical_hard_clash",
        severity="warning",
        tolerance_mm=1.0,
        message="Placed objects overlap each other; move or separate duplicate/overlapping assets.",
    ),
    ConstructabilityMatrixCell(
        group_a="stair",
        group_b="ceiling",
        check_type="hard",
        rule_id="physical_hard_clash",
        severity="warning",
        tolerance_mm=1.0,
        message="Stair envelope intersects a ceiling proxy; verify headroom or revise the opening.",
    ),
    ConstructabilityMatrixCell(
        group_a="stair",
        group_b="roof",
        check_type="hard",
        rule_id="physical_hard_clash",
        severity="warning",
        tolerance_mm=1.0,
        message="Stair envelope intersects a roof proxy; verify headroom and roof/stair geometry.",
    ),
    ConstructabilityMatrixCell(
        group_a="mep_linear",
        group_b="ceiling",
        check_type="hard",
        rule_id="physical_hard_clash",
        severity="warning",
        tolerance_mm=1.0,
        message="MEP run intersects a ceiling proxy; add a route opening, plenum clearance, or reroute.",
    ),
)


def participant_matrix_group(participant: PhysicalParticipant) -> str:
    if participant.kind in {"placed_asset", "family_instance", "family_kit_instance"}:
        return "furniture"
    if participant.kind in {"beam", "column"}:
        return "structural_linear"
    if participant.kind in {"pipe", "duct"}:
        return "mep_linear"
    return participant.kind


def hard_clash_cell_for(
    a: PhysicalParticipant,
    b: PhysicalParticipant,
    *,
    matrix: tuple[ConstructabilityMatrixCell, ...] = DEFAULT_CONSTRUCTABILITY_MATRIX,
) -> ConstructabilityMatrixCell | None:
    for cell in matrix:
        if cell.check_type == "hard" and cell.matches(a, b):
            return cell
    return None


def default_matrix_as_dict() -> dict[str, object]:
    return {
        "version": DEFAULT_CONSTRUCTABILITY_MATRIX_VERSION,
        "cells": [asdict(cell) for cell in DEFAULT_CONSTRUCTABILITY_MATRIX],
    }
