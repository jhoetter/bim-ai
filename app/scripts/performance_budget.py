from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

# PERF-A07: default persistence path. Lives under spec/generated so the
# committed snapshot doubles as the budget-trend artifact — `git log -p
# spec/generated/performance-budget.json` produces a readable diff over time.
_REPO_ROOT = Path(__file__).resolve().parents[2]
PERSIST_DEFAULT_PATH = _REPO_ROOT / "spec" / "generated" / "performance-budget.json"

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    LevelElem,
    PlanViewElem,
    RoomElem,
    RoomSeparationElem,
    ScheduleElem,
    SheetElem,
    Vec2Mm,
    WallElem,
    WindowElem,
)
from bim_ai.engine import try_commit
from bim_ai.plan_projection_wire import resolve_plan_projection_wire
from bim_ai.room_derivation import compute_room_boundary_derivation
from bim_ai.routes.api import build_evidence_package_payload
from bim_ai.routes.deps import violations_wire
from bim_ai.schedule_derivation import derive_schedule_table

MODEL_ID = UUID("00000000-0000-0000-0000-000000000001")

BUDGETS_MS: dict[str, float] = {
    "small.evaluate": 500.0,
    "small.room_derivation": 250.0,
    "small.plan_projection": 250.0,
    "small.insert_window_commit": 150.0,
    "small.insert_door_commit": 150.0,  # PERF-B05
    # PERF-CQ-02 (2026-05-29): create_wall_commit was paying for nine
    # info-only documentation advisor passes on every commit because the
    # PERF-B07 fast-path gate was a narrow allowlist (door/window/opening
    # + endpoint moves) that didn't cover createWall. Widening the gate
    # to every single-element non-schema-altering verb dropped local p50
    # from ~100 ms to ~79 ms, and the CI p50 from ~660 ms to ~240 ms
    # (~3x runner penalty). Budget reset from 1000 ms back to 400 ms.
    "small.create_wall_commit": 400.0,
    "small.move_wall_commit": 150.0,  # PERF-B05 (move existing endpoint)
    # PERF-H05: large-plan budgets. Numbers calibrated against
    # GitHub-hosted runners (~2.5x slower than dev boxes for synchronous
    # geometry work). evaluate p50 ≈ 9.9 s on CI vs ≈ 3.9 s locally —
    # bumped budget to 12 s to absorb runner variance without masking
    # genuine regressions.
    "large_plan.room_derivation": 5_000.0,
    "large_plan.plan_projection": 2_000.0,
    "large_plan.evaluate": 12_000.0,
    "small.evidence_package": 1_500.0,
    "schedule_heavy.room_schedule": 500.0,
    "schedule_heavy.door_schedule": 250.0,
    "schedule_heavy.window_schedule": 250.0,
    # schedule_heavy.evidence_package p50 ≈ 7.1 s on CI; budget bumped
    # from 6 s to 8.5 s for the same runner-variance reason.
    "schedule_heavy.evidence_package": 8_500.0,
    "documentation_heavy.plan_projection": 500.0,
    "documentation_heavy.evidence_package": 8_000.0,
    # PERF-CQ-01: budget lowered 1500 → 1000 after the corner-index
    # refactor (replaces O(h² × v²) Cartesian enumeration with a
    # pre-bucketed candidate-rectangle index). Uncached p50 measured on
    # a developer box dropped from ~132ms to ~30ms (4.3× speedup); the
    # CI runner sees the same proportional win.
    "room_stress.room_derivation": 1_000.0,
}


def _pt(x_mm: float, y_mm: float) -> Vec2Mm:
    return Vec2Mm(xMm=x_mm, yMm=y_mm)


def _room_outline(x0: float, y0: float, width: float, depth: float) -> list[Vec2Mm]:
    return [
        _pt(x0, y0),
        _pt(x0 + width, y0),
        _pt(x0 + width, y0 + depth),
        _pt(x0, y0 + depth),
    ]


def _add_grid_level(
    elements: dict[str, Any],
    *,
    prefix: str,
    level_name: str,
    elevation_mm: float,
    cols: int,
    rows: int,
    cell_w_mm: float,
    cell_d_mm: float,
) -> None:
    level_id = f"{prefix}-level"
    width = cols * cell_w_mm
    depth = rows * cell_d_mm
    elements[level_id] = LevelElem(
        kind="level",
        id=level_id,
        name=level_name,
        elevationMm=elevation_mm,
    )
    elements[f"{prefix}-plan"] = PlanViewElem(
        kind="plan_view",
        id=f"{prefix}-plan",
        name=f"{level_name} plan",
        levelId=level_id,
        cropMinMm={"xMm": -1_000, "yMm": -1_000},
        cropMaxMm={"xMm": width + 1_000, "yMm": depth + 1_000},
    )

    wall_specs = [
        ("south", (0, 0), (width, 0)),
        ("east", (width, 0), (width, depth)),
        ("north", (width, depth), (0, depth)),
        ("west", (0, depth), (0, 0)),
    ]
    for suffix, (sx, sy), (ex, ey) in wall_specs:
        wall_id = f"{prefix}-wall-{suffix}"
        elements[wall_id] = WallElem(
            kind="wall",
            id=wall_id,
            name=f"{level_name} {suffix}",
            levelId=level_id,
            start=_pt(sx, sy),
            end=_pt(ex, ey),
            thicknessMm=240,
            heightMm=3_000,
        )

    for col in range(cols + 1):
        x = col * cell_w_mm
        elements[f"{prefix}-sep-v-{col:02d}"] = RoomSeparationElem(
            kind="room_separation",
            id=f"{prefix}-sep-v-{col:02d}",
            levelId=level_id,
            start=_pt(x, 0),
            end=_pt(x, depth),
        )
    for row in range(rows + 1):
        y = row * cell_d_mm
        elements[f"{prefix}-sep-h-{row:02d}"] = RoomSeparationElem(
            kind="room_separation",
            id=f"{prefix}-sep-h-{row:02d}",
            levelId=level_id,
            start=_pt(0, y),
            end=_pt(width, y),
        )

    for row in range(rows):
        for col in range(cols):
            room_id = f"{prefix}-room-{row:02d}-{col:02d}"
            elements[room_id] = RoomElem(
                kind="room",
                id=room_id,
                name=f"{level_name} R{row + 1:02d}.{col + 1:02d}",
                levelId=level_id,
                outlineMm=_room_outline(
                    col * cell_w_mm,
                    row * cell_d_mm,
                    cell_w_mm,
                    cell_d_mm,
                ),
                programmeCode="OFFICE" if (row + col) % 3 else "MEETING",
                department="Core" if col % 2 else "Client",
                finishSet="standard",
                targetAreaM2=round((cell_w_mm * cell_d_mm) / 1_000_000.0, 3),
            )

    for idx in range(max(2, min(cols, 10))):
        along_t = (idx + 1) / (max(2, min(cols, 10)) + 1)
        elements[f"{prefix}-door-{idx:02d}"] = DoorElem(
            kind="door",
            id=f"{prefix}-door-{idx:02d}",
            wallId=f"{prefix}-wall-south",
            alongT=along_t,
            widthMm=900,
        )
        elements[f"{prefix}-window-{idx:02d}"] = WindowElem(
            kind="window",
            id=f"{prefix}-window-{idx:02d}",
            wallId=f"{prefix}-wall-north",
            alongT=along_t,
            widthMm=1_200,
            sillHeightMm=900,
            heightMm=1_300,
        )


def _add_schedules_and_sheets(elements: dict[str, Any], *, prefix: str, plan_id: str) -> None:
    schedule_defs = [
        ("rooms", "Rooms", {"category": "room"}),
        ("rooms-client", "Client rooms", {"category": "room", "filterEquals": {"department": "Client"}}),
        ("doors", "Doors", {"category": "door"}),
        ("windows", "Windows", {"category": "window"}),
    ]
    viewport_refs = [f"plan:{plan_id}"]
    for key, name, filters in schedule_defs:
        schedule_id = f"{prefix}-schedule-{key}"
        viewport_refs.append(f"schedule:{schedule_id}")
        elements[schedule_id] = ScheduleElem(
            kind="schedule",
            id=schedule_id,
            name=name,
            sheetId=f"{prefix}-sheet-1",
            filters=filters,
        )

    elements[f"{prefix}-sheet-1"] = SheetElem(
        kind="sheet",
        id=f"{prefix}-sheet-1",
        name="Documentation Sheet 1",
        viewportsMm=[
            {
                "viewportId": f"{prefix}-vp-{idx}",
                "viewRef": view_ref,
                "xMm": 500 + idx * 1_200,
                "yMm": 700 + idx * 200,
                "widthMm": 4_800,
                "heightMm": 2_400,
            }
            for idx, view_ref in enumerate(viewport_refs)
        ],
    )
    elements[f"{prefix}-sheet-2"] = SheetElem(
        kind="sheet",
        id=f"{prefix}-sheet-2",
        name="Documentation Sheet 2",
        viewportsMm=[
            {
                "viewportId": f"{prefix}-vp-detail",
                "viewRef": f"plan:{plan_id}",
                "xMm": 900,
                "yMm": 900,
                "widthMm": 6_000,
                "heightMm": 4_000,
            },
        ],
    )


def build_small_fixture() -> Document:
    elements: dict[str, Any] = {}
    _add_grid_level(
        elements,
        prefix="small",
        level_name="EG",
        elevation_mm=0,
        cols=4,
        rows=3,
        cell_w_mm=4_000,
        cell_d_mm=3_200,
    )
    _add_schedules_and_sheets(elements, prefix="small", plan_id="small-plan")
    return Document(revision=1, elements=elements)


def build_schedule_heavy_fixture() -> Document:
    elements: dict[str, Any] = {}
    _add_grid_level(
        elements,
        prefix="heavy",
        level_name="EG",
        elevation_mm=0,
        cols=16,
        rows=10,
        cell_w_mm=3_800,
        cell_d_mm=3_000,
    )
    _add_schedules_and_sheets(elements, prefix="heavy", plan_id="heavy-plan")
    return Document(revision=1, elements=elements)


def build_room_stress_fixture() -> Document:
    elements: dict[str, Any] = {}
    _add_grid_level(
        elements,
        prefix="stress",
        level_name="EG",
        elevation_mm=0,
        cols=24,
        rows=14,
        cell_w_mm=3_600,
        cell_d_mm=2_800,
    )
    return Document(revision=1, elements=elements)


def build_large_plan_fixture() -> Document:
    """PERF-H05: a synthetic large plan for picking / snapping / interaction
    budget regression. Sized between `documentation_heavy` (2×10×8) and a
    hypothetical "real" large model — large enough to surface scale
    cliffs without making every CI lane wait 30s+ on the evaluate pass.

    20 cols × 12 rows × 2 levels ≈ 1000 walls + 480 rooms before
    separations and schedules. The intent is that any future plan
    spatial index (PERF-H02) or raycast acceleration (PERF-I05) can be
    diffed against this fixture in CI without needing real seed models.
    """
    elements: dict[str, Any] = {}
    for index, level_name in enumerate(["EG", "OG"]):
        prefix = f"large-{index}"
        _add_grid_level(
            elements,
            prefix=prefix,
            level_name=level_name,
            elevation_mm=index * 3_200,
            cols=20,
            rows=12,
            cell_w_mm=3_200,
            cell_d_mm=2_600,
        )
    _add_schedules_and_sheets(elements, prefix="large-0", plan_id="large-0-plan")
    return Document(revision=1, elements=elements)


def build_documentation_heavy_fixture() -> Document:
    elements: dict[str, Any] = {}
    for index, level_name in enumerate(["EG", "OG"]):
        prefix = f"doc-{index}"
        _add_grid_level(
            elements,
            prefix=prefix,
            level_name=level_name,
            elevation_mm=index * 3_200,
            cols=10,
            rows=8,
            cell_w_mm=3_800,
            cell_d_mm=3_000,
        )
        _add_schedules_and_sheets(elements, prefix=prefix, plan_id=f"{prefix}-plan")

    # Add a sheet that references both levels so evidence-package assembly covers
    # cross-level drawing sets rather than only independent single-level sheets.
    elements["doc-combined-sheet"] = SheetElem(
        kind="sheet",
        id="doc-combined-sheet",
        name="Combined Documentation Sheet",
        viewportsMm=[
            {
                "viewportId": "doc-combined-eg",
                "viewRef": "plan:doc-0-plan",
                "xMm": 600,
                "yMm": 600,
                "widthMm": 4_800,
                "heightMm": 3_000,
            },
            {
                "viewportId": "doc-combined-og",
                "viewRef": "plan:doc-1-plan",
                "xMm": 5_800,
                "yMm": 600,
                "widthMm": 4_800,
                "heightMm": 3_000,
            },
            {
                "viewportId": "doc-combined-room-schedule",
                "viewRef": "schedule:doc-0-schedule-rooms",
                "xMm": 600,
                "yMm": 4_000,
                "widthMm": 5_000,
                "heightMm": 2_200,
            },
            {
                "viewportId": "doc-combined-window-schedule",
                "viewRef": "schedule:doc-1-schedule-windows",
                "xMm": 5_900,
                "yMm": 4_000,
                "widthMm": 5_000,
                "heightMm": 2_200,
            },
        ],
    )
    return Document(revision=1, elements=elements)


def _elapsed_ms(func: Callable[[], Any]) -> float:
    start = time.perf_counter()
    func()
    return (time.perf_counter() - start) * 1_000.0


def _measure(
    name: str,
    func: Callable[[], Any],
    *,
    repeats: int = 5,
    warmups: int = 1,
) -> dict[str, Any]:
    for _ in range(warmups):
        func()
    samples = [_elapsed_ms(func) for _ in range(repeats)]
    p50 = statistics.median(samples)
    return {
        "name": name,
        "budgetMs": BUDGETS_MS.get(name),
        "minMs": round(min(samples), 3),
        "p50Ms": round(p50, 3),
        "maxMs": round(max(samples), 3),
        "samplesMs": [round(sample, 3) for sample in samples],
        "pass": BUDGETS_MS.get(name) is None or p50 <= BUDGETS_MS[name],
    }


def run_budgets() -> dict[str, Any]:
    small = build_small_fixture()
    schedule_heavy = build_schedule_heavy_fixture()
    documentation_heavy = build_documentation_heavy_fixture()
    room_stress = build_room_stress_fixture()
    large_plan = build_large_plan_fixture()

    results = [
        _measure("small.evaluate", lambda: violations_wire(small.elements)),
        _measure("small.room_derivation", lambda: compute_room_boundary_derivation(small)),
        _measure(
            "small.plan_projection",
            lambda: resolve_plan_projection_wire(
                small,
                plan_view_id="small-plan",
                fallback_level_id="small-level",
                global_plan_presentation="default",
            ),
        ),
        _measure(
            "small.insert_window_commit",
            lambda: try_commit(
                small,
                {
                    "type": "insertWindowOnWall",
                    "id": "perf-window-east",
                    "wallId": "small-wall-east",
                    "alongT": 0.5,
                    "widthMm": 1_200,
                    "sillHeightMm": 900,
                    "heightMm": 1_300,
                },
            ),
        ),
        # PERF-B05: hosted-opening + wall-creation budgets beyond
        # insert_window. Each command targets a fresh id so re-running
        # within one process does not collide.
        _measure(
            "small.insert_door_commit",
            lambda: try_commit(
                small,
                {
                    "type": "insertDoorOnWall",
                    "id": f"perf-door-{uuid4().hex[:6]}",
                    "wallId": "small-wall-south",
                    "alongT": 0.5,
                    "widthMm": 900,
                },
            ),
        ),
        _measure(
            "small.create_wall_commit",
            lambda: try_commit(
                small,
                {
                    "type": "createWall",
                    "id": f"perf-wall-{uuid4().hex[:6]}",
                    "levelId": "small-level",
                    "start": {"xMm": 1, "yMm": 1},
                    "end": {"xMm": 1, "yMm": 5_000},
                    "thicknessMm": 240,
                    "heightMm": 3_000,
                },
            ),
        ),
        # PERF-B05: move-wall budget. Slightly nudges an existing wall's
        # endpoint so the command exercises the wall-geometry-change path
        # (which dirties hosted openings + room boundaries) rather than a
        # no-op. The east wall on the small fixture sits at x=16000.
        _measure(
            "small.move_wall_commit",
            lambda: try_commit(
                small,
                {
                    "type": "moveWallEndpoints",
                    "wallId": "small-wall-east",
                    "start": {"xMm": 16_000, "yMm": 0},
                    "end": {"xMm": 16_050, "yMm": 9_600},
                },
            ),
        ),
        _measure(
            "small.evidence_package",
            lambda: build_evidence_package_payload(model_id=MODEL_ID, doc=small),
            repeats=3,
        ),
        _measure(
            "schedule_heavy.room_schedule",
            lambda: derive_schedule_table(schedule_heavy, "heavy-schedule-rooms"),
        ),
        _measure(
            "schedule_heavy.door_schedule",
            lambda: derive_schedule_table(schedule_heavy, "heavy-schedule-doors"),
        ),
        _measure(
            "schedule_heavy.window_schedule",
            lambda: derive_schedule_table(schedule_heavy, "heavy-schedule-windows"),
        ),
        _measure(
            "schedule_heavy.evidence_package",
            lambda: build_evidence_package_payload(model_id=MODEL_ID, doc=schedule_heavy),
            repeats=3,
        ),
        _measure(
            "documentation_heavy.plan_projection",
            lambda: resolve_plan_projection_wire(
                documentation_heavy,
                plan_view_id="doc-0-plan",
                fallback_level_id="doc-0-level",
                global_plan_presentation="default",
            ),
            repeats=3,
        ),
        _measure(
            "documentation_heavy.evidence_package",
            lambda: build_evidence_package_payload(model_id=MODEL_ID, doc=documentation_heavy),
            repeats=3,
        ),
        _measure(
            "room_stress.room_derivation",
            lambda: compute_room_boundary_derivation(room_stress),
            repeats=3,
        ),
        # PERF-H05: large-plan budgets — give H02 / I05 follow-ups a
        # scale fixture to diff against.
        _measure(
            "large_plan.room_derivation",
            lambda: compute_room_boundary_derivation(large_plan),
            repeats=3,
        ),
        _measure(
            "large_plan.plan_projection",
            lambda: resolve_plan_projection_wire(
                large_plan,
                plan_view_id="large-0-plan",
                fallback_level_id="large-0-level",
                global_plan_presentation="default",
            ),
            repeats=3,
        ),
        _measure(
            "large_plan.evaluate",
            lambda: violations_wire(large_plan.elements),
            repeats=3,
        ),
    ]
    fixtures = {
        "small": {"revision": small.revision, "elementCount": len(small.elements)},
        "schedule_heavy": {
            "revision": schedule_heavy.revision,
            "elementCount": len(schedule_heavy.elements),
        },
        "documentation_heavy": {
            "revision": documentation_heavy.revision,
            "elementCount": len(documentation_heavy.elements),
        },
        "room_stress": {
            "revision": room_stress.revision,
            "elementCount": len(room_stress.elements),
        },
        "large_plan": {
            "revision": large_plan.revision,
            "elementCount": len(large_plan.elements),
        },
    }
    return {
        "format": "bimAiPerformanceBudget_v1",
        "fixtures": fixtures,
        "results": results,
        "ok": all(bool(result["pass"]) for result in results),
    }


def _git_commit_sha() -> str | None:
    """Best-effort short commit SHA for the persisted snapshot."""
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(_REPO_ROOT),
            stderr=subprocess.DEVNULL,
            timeout=2,
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        return None
    sha = out.decode("utf-8").strip()
    return sha or None


def _enrich_with_traceability(report: dict[str, Any]) -> dict[str, Any]:
    return {
        **report,
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "commitSha": _git_commit_sha(),
        "host": os.uname().nodename if hasattr(os, "uname") else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run BIM AI backend performance budgets.")
    parser.add_argument("--json", action="store_true", help="Print the full JSON report.")
    parser.add_argument("--out", type=Path, help="Optional path for the JSON report.")
    parser.add_argument(
        "--persist",
        action="store_true",
        help=(
            "PERF-A07: also write the report to spec/generated/performance-budget.json "
            "with commitSha + capturedAt + host metadata so the committed snapshot "
            "doubles as a trend artifact under git history."
        ),
    )
    parser.add_argument(
        "--fail-on-budget",
        action="store_true",
        help="Exit non-zero when any p50 timing exceeds its budget.",
    )
    args = parser.parse_args()

    report = run_budgets()
    if args.persist or args.out:
        enriched = _enrich_with_traceability(report)
        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(json.dumps(enriched, indent=2, sort_keys=True) + "\n")
        if args.persist:
            PERSIST_DEFAULT_PATH.parent.mkdir(parents=True, exist_ok=True)
            PERSIST_DEFAULT_PATH.write_text(json.dumps(enriched, indent=2, sort_keys=True) + "\n")

    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        for result in report["results"]:
            status = "PASS" if result["pass"] else "FAIL"
            print(
                f"{status} {result['name']}: p50={result['p50Ms']}ms "
                f"budget={result['budgetMs']}ms max={result['maxMs']}ms"
            )

    return 1 if args.fail_on_budget and not report["ok"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
